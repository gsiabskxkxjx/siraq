// يجلب نصوص أحاديث (العربية فقط) من Thaqalayn API وقت البناء، ويتحقق منها، ويضعها في
// www/assets/data/thaqalayn.json ليستوردها التطبيق الأصلي أول تشغيل دون إنترنت.
//
// الصدق في هذا الملف:
//  - لا نكتب حديثاً من عندنا؛ كل نص يأتي من الخدمة ومعه اسم الكتاب ورقم الحديث ورابط الصفحة عند توفره.
//  - لم نتحقق من بنية الاستجابة الفعلية من داخل بيئة التطوير (لا إنترنت فيها)، لذلك يقبل الكود أسماء حقول متعددة
//    ويرفض ما لا يبدو نصاً عربياً سليماً، ويطبع عدد المقبول والمرفوض في سجل البناء.
//  - الفشل غير قاتل: يُكمل البناء بلا أحاديث ويظهر تحذير؛ ويبقى التطبيق يعمل ويعرض الإضافة اليدوية بمصدر.
//  - لا نأخذ الترجمات الإنجليزية (حقوقها لمترجميها)، ولا نأخذ درجات التصحيح (لا نحكم على الروايات).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.THAQALAYN_BASE || 'https://www.thaqalayn-api.net/api/v2').replace(/\/+$/, '');
const SITE = 'https://thaqalayn.net';
const MAX_TOTAL = +(process.env.HADITH_MAX_TOTAL || 1500);
const PER_BOOK_MAX = +(process.env.HADITH_PER_BOOK || 60);
const PER_BOOK_MIN = 15;
const MAX_BOOKS = +(process.env.HADITH_MAX_BOOKS || 60);
const OUT = process.env.THAQALAYN_OUT || join(root, 'www/assets/data/thaqalayn.json');

// أسماء عربية معروفة للكتب (تُطابَق على المعرّف/الاسم بعد تحويله لحروف صغيرة بلا رموز). ما لم يُطابق يُستخدم اسم الخدمة كما هو.
const KNOWN = [
  [/(^|[^a-z])kafi|الكافي/, 'الكافي', 'محمد بن يعقوب الكليني'],
  [/man.?la.?yahduruh|faqih|الفقيه/, 'من لا يحضره الفقيه', 'الشيخ الصدوق'],
  [/tahdhib|tahzib|تهذيب/, 'تهذيب الأحكام', 'الشيخ الطوسي'],
  [/istibsar|الاستبصار/, 'الاستبصار فيما اختلف من الأخبار', 'الشيخ الطوسي'],
  [/amali.*mufid|mufid.*amali/, 'الأمالي (المفيد)', 'الشيخ المفيد'],
  [/amali.*saduq|saduq.*amali|amali.*sadooq/, 'الأمالي (الصدوق)', 'الشيخ الصدوق'],
  [/amali.*tusi|tusi.*amali/, 'الأمالي (الطوسي)', 'الشيخ الطوسي'],
  [/khisal|الخصال/, 'الخصال', 'الشيخ الصدوق'],
  [/(^|[^a-z])tawhid|التوحيد/, 'التوحيد', 'الشيخ الصدوق'],
  [/uyun|oyun|عيون/, 'عيون أخبار الرضا (ع)', 'الشيخ الصدوق'],
  [/kamal.?al.?din|kamaluddin|كمال الدين/, 'كمال الدين وتمام النعمة', 'الشيخ الصدوق'],
  [/thawab|sawab|ثواب/, 'ثواب الأعمال وعقاب الأعمال', 'الشيخ الصدوق'],
  [/maani|ma.?ani|معاني/, 'معاني الأخبار', 'الشيخ الصدوق'],
  [/basair|basa.?ir|بصائر/, 'بصائر الدرجات', 'محمد بن الحسن الصفار'],
  [/tuhaf|تحف/, 'تحف العقول', 'ابن شعبة الحراني'],
  [/kamil.*ziyarat|kamil.*ziyara|كامل الزيارات/, 'كامل الزيارات', 'ابن قولويه'],
  [/nahj|نهج/, 'نهج البلاغة', 'الشريف الرضي (جامع)'],
  [/sahifa|sahifah|صحيفة/, 'الصحيفة السجادية', 'منسوبة إلى الإمام زين العابدين (ع)']
];
// كتب تُعامَل أدعيةً لا روايات (يُعرض كل بند في «الأدعية»)
const DUA_BOOK = /sahifa|sahifah|صحيفة|munajat|مناجاة|ziyarat|زيارات|dua(?!f)|دعاء|mafatih|مفاتيح/;
// كتب رجال وتضعيف ليست أدعية ولا روايات تُعرض (مثل «كتاب الضعفاء»): تُستبعد كلياً
export const NOT_CONTENT = /du.{0,2}afa|ضعفاء|rijal|رجال/;

const AR = /[؀-ۿ]/g;
const arabicRatio = (s) => { const letters = (s.match(/[\p{L}]/gu) || []).length; if (!letters) return 0; return (s.match(AR) || []).length / letters; };
const clean = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const warn = (m) => console.log('::warning title=أحاديث Thaqalayn لم تُضمَّن::' + m);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
const first = (o, keys) => { for (const k of keys) { const v = o && o[k]; if (v != null && String(v).trim() !== '') return v; } return ''; };
const asArray = (j) => (Array.isArray(j) ? j : j && (j.data || j.books || j.hadiths || j.items || j.results) ? [].concat(j.data || j.books || j.hadiths || j.items || j.results) : []);

async function getJson(url, tries = 3, timeoutMs = 180000) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) throw new Error('رمز الاستجابة ' + r.status);
      return await r.json();
    } catch (e) { last = e; console.log('  محاولة ' + i + ' فشلت (' + url.replace(BASE, '…') + '): ' + e.message); if (i < tries) await new Promise((res) => setTimeout(res, 2500 * i)); }
  }
  throw last;
}

export function arabicTitle(id, name, author) {
  const key = (String(id) + ' ' + String(name)).toLowerCase().replace(/[‘’ʿʾ'`]/g, '').replace(/[-_]+/g, ' ');
  for (const [re, t, a] of KNOWN) if (re.test(key)) return { title: t, author: a, known: true };

  return { title: String(name || id), author: String(author || ''), known: false };
}

/* يحوّل عنصراً خاماً إلى بند نظيف أو يعيد null. الحدود تمنع النصوص الفارغة أو المقطوعة أو غير العربية */
export function mapItem(o, i, isDua) {
  const text = clean(first(o, ['arabicText', 'arabic', 'textArabic', 'arabic_text', 'text_ar', 'ar']));
  const min = 40, max = isDua ? 8000 : 1200;
  if (text.length < min || text.length > max) return null;
  if (arabicRatio(text) < 0.75) return null;
  if (/undefined|null|\[object/.test(text)) return null;
  const nraw = first(o, ['hadithNumber', 'number', 'id', 'index']);
  const number = String(nraw !== '' ? nraw : i + 1);
  const url = String(first(o, ['URL', 'url', 'link']));
  const chap = clean(first(o, ['chapter', 'category', 'chapterTitle']));
  return { number, text, url: /^https:\/\//i.test(url) ? url : '', chapter: arabicRatio(chap) > 0.75 && chap.length < 160 ? chap : '' };
}

async function main() {
  console.log('Thaqalayn: ' + BASE);
  const books = asArray(await getJson(BASE + '/allbooks')).map((b) => ({
    id: String(first(b, ['bookId', 'id', 'slug', 'BookId'])), name: clean(first(b, ['BookName', 'bookName', 'name', 'title', 'englishName'])), author: clean(first(b, ['author', 'Author']))
  })).filter((b) => b.id);
  if (!books.length) throw new Error('قائمة الكتب فارغة أو بنية غير متوقعة');
  const take = books.filter((b) => !NOT_CONTENT.test((b.id + ' ' + b.name).toLowerCase())).slice(0, MAX_BOOKS);
  const perBook = Math.max(PER_BOOK_MIN, Math.min(PER_BOOK_MAX, Math.ceil(MAX_TOTAL / take.length)));
  const items = [], duas = [], booksOut = []; const seen = new Set(); let rejected = 0, failed = 0;
  for (const b of take) {
    if (NOT_CONTENT.test((b.id + ' ' + b.name).toLowerCase())) { console.log('استُبعد كتاب رجال/تضعيف: ' + b.id); continue; }
    const isDua = DUA_BOOK.test((b.id + ' ' + b.name).toLowerCase());
    let raw;
    try { raw = asArray(await getJson(BASE + '/' + encodeURIComponent(b.id))); } catch (e) { failed++; console.log('تعذّر كتاب ' + b.id + ': ' + e.message); continue; }
    const ok = []; raw.forEach((o, i) => { const m = mapItem(o, i, isDua); if (!m) { rejected++; return; } const h = createHash('sha1').update(m.text).digest('hex'); if (seen.has(h)) return; seen.add(h); ok.push(m); });
    if (!ok.length) { console.log('  ' + b.id + ': لا بنود صالحة من ' + raw.length); continue; }
    const want = isDua ? Math.min(ok.length, 200) : Math.min(ok.length, perBook);
    // عيّنة موزعة بالتساوي على الكتاب كله (حتماً نفسها في كل بناء) بدل أول صفحات الكتاب فقط
    const pick = []; for (let k = 0; k < want; k++) pick.push(ok[Math.floor((k * ok.length) / want)]);
    const t = arabicTitle(b.id, b.name, b.author);
    const sid = slug(b.id);
    pick.forEach((m) => {
      const rec = { id: sid + '_' + slug(m.number), book: t.title, author: t.author, number: m.number, text: m.text, url: m.url || SITE, chapter: m.chapter, bookId: b.id };
      (isDua ? duas : items).push(rec);
    });
    booksOut.push({ id: b.id, title: t.title, author: t.author, kind: isDua ? 'dua' : 'narration', available: raw.length, valid: ok.length, taken: pick.length });
    console.log('  ' + b.id + ' → ' + t.title + ': ' + pick.length + ' من ' + ok.length + ' صالح (' + raw.length + ' خام)');
    await new Promise((res) => setTimeout(res, 300));
  }
  if (items.length + duas.length < 20) throw new Error('عدد البنود الصالحة قليل جداً (' + (items.length + duas.length) + ') — يُرجَّح أن بنية الاستجابة تغيّرت');
  const body = { version: 1, source: { name: 'Thaqalayn — مكتبة الحديث الشيعي الرقمية', site: SITE, api: BASE, fetchedAt: new Date().toISOString(), note: 'نصوص عربية فقط كما وردت من الخدمة؛ لم تُراجَع في سِراج.' }, books: booksOut, items, duas };
  body.stamp = createHash('sha1').update(JSON.stringify([items.map((x) => x.id + x.text.length), duas.map((x) => x.id + x.text.length)])).digest('hex').slice(0, 16);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(body));
  console.log('تم تضمين ' + items.length + ' حديثاً و' + duas.length + ' دعاء/زيارة من ' + booksOut.length + ' كتاباً (رُفض ' + rejected + ' بنداً شكلاً، وتعذّر ' + failed + ' كتاباً).');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { warn(e.message + ' — سيبقى التطبيق بلا أحاديث مستوردة.'); process.exit(0); });
}

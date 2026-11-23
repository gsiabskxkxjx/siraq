// يجهّز تطبيق «سِراج — التحكم» للحزم داخل APK (أو للاختبار في المتصفح):
//   • ينسخ واجهة التطبيق (control/) وملفات النواة المشتركة من تطبيق سِراج (ui/storage/schema/packcrypto/navigation + الأنماط)
//   • يولّد data/refs.js: مراجع مصغّرة من بيانات سِراج (الأقسام، المؤلفون، عناوين الكتب والأدعية المضمّنة، الأئمة، المحاور، السور)
//     لتفادي تكرار المحتوى بين التطبيقين ولاكتشاف التكرار وسحب المضمّن.
//   • يولّد data/build-info.js (مستودع GitHub لاقتراح رابط تعديل ملف المفاتيح).
// الاستعمال: node scripts/prepare-control.mjs [--out <dir>]
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { bundleFonts } from './lib-fonts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctl = join(root, 'control');
const oi = process.argv.indexOf('--out');
const out = oi > 0 ? process.argv[oi + 1] : join(ctl, 'www');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets', 'js'), { recursive: true });
mkdirSync(join(out, 'assets', 'css'), { recursive: true });
mkdirSync(join(out, 'data'), { recursive: true });

for (const f of ['index.html']) cpSync(join(ctl, f), join(out, f));
cpSync(join(ctl, 'js'), join(out, 'js'), { recursive: true });
cpSync(join(ctl, 'css', 'control.css'), join(out, 'assets', 'css', 'control.css'));
cpSync(join(ctl, 'assets', 'images'), join(out, 'assets', 'images'), { recursive: true });
for (const f of ['style.css', 'responsive.css']) cpSync(join(root, 'assets', 'css', f), join(out, 'assets', 'css', f));
for (const f of ['ui.js', 'storage.js', 'schema.js', 'packcrypto.js', 'navigation.js']) cpSync(join(root, 'assets', 'js', f), join(out, 'assets', 'js', f));

/* ---- المراجع من بيانات سِراج ---- */
const sb = {}; sb.window = sb;
for (const f of ['sample-data.js', 'quran-data.js', 'duas-data.js']) vm.runInNewContext(readFileSync(join(root, 'assets', 'data', f), 'utf8'), sb, { filename: f });
const D = sb.SIRAJ_DATA;
if (!D || !D.sample || !D.quran || !D.duas) throw new Error('بيانات سِراج غير مكتملة');
const refs = {
  sample: {
    sections: D.sample.sections,
    authors: D.sample.authors.map((a) => ({ id: a.id, name: a.name, death: a.death, note: '' })),
    books: D.sample.books.map((b) => ({ id: b.id, title: b.title, author: b.author, section: b.section })),
    imams: D.sample.imams.map((i) => ({ n: i.n, name: i.name, short: i.short })),
    aspects: D.sample.aspects.map((a) => ({ id: a.id, title: a.title }))
  },
  quran: { surahs: D.quran.surahs.map((s) => ({ n: s.n, name: s.name, ayahs: s.ayahs })) },
  duas: { categories: D.duas.categories, items: D.duas.items.map((d) => ({ id: d.id, title: d.title })) }
};
writeFileSync(join(out, 'data', 'refs.js'), '/* مولَّد بواسطة scripts/prepare-control.mjs من بيانات سِراج — لا تعدّله */\nwindow.SIRAJ_DATA = ' + JSON.stringify(refs) + ';\n');
writeFileSync(join(out, 'data', 'build-info.js'), 'window.SIRAJ_BUILD = ' + JSON.stringify({ repo: process.env.GITHUB_REPOSITORY || '', branch: process.env.GITHUB_REF_NAME || 'main', run: process.env.GITHUB_RUN_NUMBER || '', built: new Date().toISOString() }) + ';\n');

/* ---- الخطوط: حزم @fontsource موجودة في node_modules الخاص بمجلد control (إن وُجد) ---- */
bundleFonts(existsSync(join(ctl, 'node_modules')) ? ctl : root, out);

function size(p) { let n = 0; for (const e of readdirSync(p)) { const q = join(p, e); n += statSync(q).isDirectory() ? size(q) : statSync(q).size; } return n; }
console.log('تطبيق التحكم جاهز في ' + out + ' — الحجم: ' + (size(out) / 1048576).toFixed(2) + ' م.ب');

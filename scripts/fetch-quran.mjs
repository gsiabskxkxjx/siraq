// يجلب نص المصحف (طبعة quran-uthmani من مشروع Tanzil عبر AlQuran.cloud) وقت البناء ويتحقق منه
// ثم يضعه في www/assets/data/quran-uthmani.json ليستورده التطبيق أول تشغيل دون إنترنت.
// الفشل هنا غير قاتل: يبقى التطبيق قادراً على التنزيل من داخله، ويظهر تحذير في سجل البناء.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const meta = JSON.parse(readFileSync(join(root, 'assets/data/quran-data.json'), 'utf8'));
const URL_ = process.env.QURAN_URL || (meta.api.base + '/quran/' + meta.api.textEdition);

function warn(msg) { console.log('::warning title=نص المصحف لم يُضمَّن::' + msg); }

async function main() {
  let j;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(URL_, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('رمز الاستجابة ' + r.status);
      j = await r.json();
      break;
    } catch (e) {
      console.log('محاولة ' + i + ' فشلت: ' + e.message);
      if (i === 3) throw e;
      await new Promise((res) => setTimeout(res, 3000 * i));
    }
  }
  if (!j || j.code !== 200 || !j.data || !Array.isArray(j.data.surahs)) throw new Error('بنية الاستجابة غير متوقعة');
  const sur = j.data.surahs;
  if (sur.length !== 114) throw new Error('عدد السور ' + sur.length);
  let total = 0;
  sur.forEach((s, i) => {
    const exp = meta.surahs[i];
    if (s.number !== i + 1) throw new Error('ترتيب السور مضطرب عند ' + (i + 1));
    if (!Array.isArray(s.ayahs) || s.ayahs.length !== exp.ayahs) throw new Error('عدد آيات السورة ' + (i + 1) + ' لا يطابق المعتمد');
    s.ayahs.forEach((a, k) => {
      if (typeof a.text !== 'string' || !a.text.trim()) throw new Error('آية فارغة ' + (i + 1) + ':' + (k + 1));
      if (a.numberInSurah !== k + 1) throw new Error('ترقيم مضطرب في السورة ' + (i + 1));
    });
    total += s.ayahs.length;
  });
  if (total !== meta.totalAyahs) throw new Error('مجموع الآيات ' + total);
  const dir = join(root, 'www/assets/data');
  mkdirSync(dir, { recursive: true });
  // نحتفظ بالحقول اللازمة فقط (النص والترقيم والصفحة) لتقليل الحجم
  const slim = { code: 200, status: 'OK', data: { edition: j.data.edition, surahs: sur.map((s) => ({ number: s.number, ayahs: s.ayahs.map((a) => ({ numberInSurah: a.numberInSurah, text: a.text, page: a.page })) })) } };
  writeFileSync(join(dir, 'quran-uthmani.json'), JSON.stringify(slim));
  console.log('تم تضمين نص المصحف: ' + sur.length + ' سورة، ' + total + ' آية.');
}

main().catch((e) => { warn(e.message + ' — سيُنزَّل النص من داخل التطبيق بدلاً من ذلك.'); process.exit(0); });

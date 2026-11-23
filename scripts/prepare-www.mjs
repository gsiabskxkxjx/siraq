// ينسخ ملفات التطبيق الويب إلى www/ ليحزمها Capacitor داخل الـAPK.
// لا يُنسخ service-worker.js ولا offline.html: الملفات مضمّنة في التطبيق ولا حاجة لها.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const f of ['index.html', 'manifest.json']) {
  if (!existsSync(join(root, f))) throw new Error('ملف ناقص: ' + f);
  cpSync(join(root, f), join(out, f));
}
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });

/* ---- الخطوط محلياً: بدل تحميلها من الإنترنت (يُبطئ شاشة البدء وينقطع دون اتصال) ----
   تأتي من حزم @fontsource (رخصة OFL). إن غابت تُستخدم خطوط النظام العربية. */
const FONTS = [['cairo', 'Cairo', [400, 600, 700, 800]], ['amiri', 'Amiri', [400, 700]], ['amiri-quran', 'Amiri Quran', [400]]];
const RANGES = {
  arabic: 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
};
function bundleFonts() {
  const nm = join(root, 'node_modules', '@fontsource');
  const outDir = join(out, 'assets', 'fonts');
  mkdirSync(outDir, { recursive: true });
  let css = '/* مولَّد بواسطة scripts/prepare-www.mjs من حزم @fontsource (رخصة SIL OFL) */\n';
  let n = 0;
  for (const [id, family, weights] of FONTS) {
    const dir = join(nm, id, 'files');
    if (!existsSync(dir)) { console.log('::warning title=خط ناقص::حزمة الخط ' + id + ' غير موجودة؛ ستُستخدم خطوط النظام'); continue; }
    const have = new Set(readdirSync(dir));
    for (const w of weights) for (const sub of ['arabic', 'latin']) {
      const f = id + '-' + sub + '-' + w + '-normal.woff2';
      if (!have.has(f)) continue;
      copyFileSync(join(dir, f), join(outDir, f));
      css += "@font-face{font-family:'" + family + "';font-style:normal;font-weight:" + w + ';font-display:swap;src:url(../fonts/' + f + ") format('woff2');unicode-range:" + RANGES[sub] + ';}\n';
      n++;
    }
  }
  const idx = join(out, 'index.html');
  let html = readFileSync(idx, 'utf8');
  /* نزيل روابط Google Fonts في كل الأحوال داخل APK (خطوط محلية أو خطوط النظام) */
  html = html.replace(/<link rel="preconnect"[^>]*fonts\.g[^>]*>\s*/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '')
    .replace(/<noscript><link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*><\/noscript>\s*/g, '');
  if (n) {
    writeFileSync(join(out, 'assets', 'css', 'fonts.css'), css);
    html = html.replace('<link rel="stylesheet" href="assets/css/style.css">', '<link rel="stylesheet" href="assets/css/fonts.css">\n<link rel="stylesheet" href="assets/css/style.css">');
  }
  writeFileSync(idx, html);
  console.log('خطوط محلية: ' + n + ' ملف' + (n ? '' : ' (لا شيء؛ خطوط النظام)'));
}
bundleFonts();

function size(p) {
  let n = 0;
  for (const e of readdirSync(p)) {
    const q = join(p, e);
    n += statSync(q).isDirectory() ? size(q) : statSync(q).size;
  }
  return n;
}
console.log('www/ جاهز — الحجم: ' + (size(out) / 1048576).toFixed(2) + ' م.ب');

// خطوط محلية مضمّنة داخل APK بدل تحميلها من الإنترنت (تُبطئ البدء وتنقطع دون اتصال). مشتركة بين تطبيقي سِراج والتحكم.
// تأتي من حزم @fontsource (رخصة OFL). إن غابت تُستخدم خطوط النظام العربية.
import { mkdirSync, existsSync, readdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FONTS = [['cairo', 'Cairo', [400, 600, 700, 800]], ['amiri', 'Amiri', [400, 700]], ['amiri-quran', 'Amiri Quran', [400]]];
const RANGES = {
  arabic: 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
};

/** root: جذر المستودع (فيه node_modules)، out: مجلد www الهدف الذي فيه index.html و assets/css/style.css */
export function bundleFonts(root, out, opt) {
  const skip = new Set((opt && opt.skip) || []);
  const nm = join(root, 'node_modules', '@fontsource');
  const outDir = join(out, 'assets', 'fonts');
  mkdirSync(outDir, { recursive: true });
  let css = '/* مولَّد بواسطة scripts/lib-fonts.mjs من حزم @fontsource (رخصة SIL OFL) */\n';
  let n = 0;
  for (const [id, family, weights] of FONTS) {
    if (skip.has(id)) continue;
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
    const anchor = '<link rel="stylesheet" href="' + ((opt && opt.anchor) || 'assets/css/style.css') + '">';
    html = html.replace(anchor, '<link rel="stylesheet" href="assets/css/fonts.css">\n' + anchor);
  }
  writeFileSync(idx, html);
  console.log('خطوط محلية: ' + n + ' ملف' + (n ? '' : ' (لا شيء؛ خطوط النظام)'));
  return n;
}

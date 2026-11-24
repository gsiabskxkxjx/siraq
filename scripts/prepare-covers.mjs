// يجهّز تطبيق «سِراج — الأغلفة» للحزم داخل APK (أو للاختبار في المتصفح):
//   • ينسخ واجهة التطبيق (covers/) ومحرّك الأغلفة المشترك مع سِراج (assets/js/cover-art.js)
//   • يضمّن خط Amiri محلياً (من @fontsource) بدل Google Fonts
// الاستعمال: node scripts/prepare-covers.mjs [--out <dir>]
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleFonts } from './lib-fonts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cov = join(root, 'covers');
const oi = process.argv.indexOf('--out');
const out = oi > 0 ? process.argv[oi + 1] : join(cov, 'www');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets', 'js'), { recursive: true });
mkdirSync(join(out, 'assets', 'css'), { recursive: true });

cpSync(join(cov, 'index.html'), join(out, 'index.html'));
cpSync(join(cov, 'js'), join(out, 'js'), { recursive: true });
cpSync(join(cov, 'css', 'covers.css'), join(out, 'assets', 'css', 'covers.css'));
cpSync(join(cov, 'assets', 'images'), join(out, 'assets', 'images'), { recursive: true });
cpSync(join(root, 'assets', 'js', 'cover-art.js'), join(out, 'assets', 'js', 'cover-art.js'));

/* الخطوط: Amiri فقط (الواجهة والغلاف). حزم @fontsource في node_modules الخاص بمجلد covers إن وُجد */
bundleFonts(existsSync(join(cov, 'node_modules')) ? cov : root, out, { skip: ['cairo', 'amiri-quran'], anchor: 'assets/css/covers.css' });

function size(p) { let n = 0; for (const e of readdirSync(p)) { const q = join(p, e); n += statSync(q).isDirectory() ? size(q) : statSync(q).size; } return n; }
console.log('تطبيق الأغلفة جاهز في ' + out + ' — الحجم: ' + (size(out) / 1048576).toFixed(2) + ' م.ب');

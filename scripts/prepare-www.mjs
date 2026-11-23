// ينسخ ملفات التطبيق الويب إلى www/ ليحزمها Capacitor داخل الـAPK.
// لا يُنسخ service-worker.js ولا offline.html: الملفات مضمّنة في التطبيق ولا حاجة لها.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
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

function size(p) {
  let n = 0;
  for (const e of readdirSync(p)) {
    const q = join(p, e);
    n += statSync(q).isDirectory() ? size(q) : statSync(q).size;
  }
  return n;
}
console.log('www/ جاهز — الحجم: ' + (size(out) / 1048576).toFixed(2) + ' م.ب');

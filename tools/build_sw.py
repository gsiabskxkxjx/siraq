#!/usr/bin/env python3
"""يولّد قائمة PRECACHE ونسخة VERSION داخل service-worker.js من شجرة الملفات الفعلية.
الاستعمال:  python3 tools/build_sw.py
يستثني: tests/ tools/ docs/ و .zip وملفات مخفية، وأغلفة الكتب التجريبية الكبيرة تُدرج (صغيرة).
"""
import hashlib, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'tests', 'tools', 'docs', 'scripts', 'www', 'android', 'android-signing', 'dist', '.git', 'node_modules', '__pycache__'}
SKIP_FILES = {'package.json', 'package-lock.json', 'capacitor.config.json'}
SKIP_EXT = {'.zip', '.md', '.py', '.map', '.txt'}
KEEP_TXT = {os.path.join('assets', 'lib', 'pdfjs', 'LICENSE-pdfjs.txt')}
SW = os.path.join(ROOT, 'service-worker.js')

files = []
for d, ds, fs in os.walk(ROOT):
    ds[:] = sorted(x for x in ds if x not in SKIP_DIRS and not x.startswith('.'))
    for f in sorted(fs):
        rel = os.path.relpath(os.path.join(d, f), ROOT)
        if f.startswith('.') or f == 'service-worker.js' or f in SKIP_FILES: continue
        if os.path.splitext(f)[1].lower() in SKIP_EXT and rel not in KEEP_TXT: continue
        files.append(rel.replace(os.sep, '/'))
files.sort()
h = hashlib.sha256()
for rel in files:
    h.update(rel.encode()); h.update(open(os.path.join(ROOT, rel), 'rb').read())
version = h.hexdigest()[:10]
urls = ['./'] + ['./' + f for f in files]
block = "/*__BEGIN_GENERATED__*/\nconst VERSION = '%s';\nconst PRECACHE = [\n%s\n];\n/*__END_GENERATED__*/" % (
    version, ',\n'.join("  '%s'" % u for u in urls))
src = open(SW, encoding='utf8').read()
new, n = re.subn(r'/\*__BEGIN_GENERATED__\*/.*?/\*__END_GENERATED__\*/', lambda m: block, src, flags=re.S)
if n != 1: sys.exit('لم يُعثر على علامات التوليد في service-worker.js')
open(SW, 'w', encoding='utf8').write(new)
tot = sum(os.path.getsize(os.path.join(ROOT, f)) for f in files)
print('PRECACHE: %d ملفاً، %.2f MB، النسخة %s' % (len(urls), tot / 1048576, version))

"""اختبار PWA: manifest، تسجيل SW على localhost، التخزين المسبق، العمل دون اتصال، صفحة offline"""
import json, re, os, urllib.request
from common import T, ROOT
t = T(mock=None)
pg = t.pg

# manifest
m = json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf8'))
t.check('manifest: rtl وar وstandalone', m['dir'] == 'rtl' and m['lang'] == 'ar' and m['display'] == 'standalone')
t.check('manifest: أيقونات 192/512/maskable', {(i['sizes'], i['purpose']) for i in m['icons']} >= {('192x192', 'any'), ('512x512', 'any'), ('512x512', 'maskable')})
t.check('manifest: كل الأيقونات موجودة', all(os.path.exists(os.path.join(ROOT, i['src'])) for i in m['icons']), [i['src'] for i in m['icons'] if not os.path.exists(os.path.join(ROOT, i['src']))])
t.check('manifest: اختصارات (4)', len(m['shortcuts']) == 4)
t.check('manifest: رابط في index.html', pg.evaluate("!!document.querySelector('link[rel=manifest]')"))

# كل ملفات PRECACHE موجودة فعلاً
sw = open(os.path.join(ROOT, 'service-worker.js'), encoding='utf8').read()
urls = re.findall(r"^  '(\./[^']*)'", sw, re.M)
miss = [u for u in urls if u != './' and not os.path.exists(os.path.join(ROOT, u[2:]))]
t.check('SW: كل ملفات PRECACHE موجودة', not miss, miss)
t.check('SW: يشمل الملفات الأساسية', all(('./' + x) in urls for x in ['index.html', 'offline.html', 'manifest.json', 'assets/js/daily.js', 'assets/js/app.js', 'assets/lib/pdfjs/pdf.min.mjs']))
# كل سكربت وملف CSS في index.html مُدرج
idx = open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()
refs = [r for r in re.findall(r'(?:src|href)="(assets/[^"]+)"', idx)]
t.check('SW: كل أصول index.html المحلية مُدرجة', all(('./' + r) in urls for r in refs), [r for r in refs if ('./' + r) not in urls])

# تسجيل SW
pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(r=>!!r&&!!r.active)", timeout=20000)
t.check('SW: مسجّل ونشط على localhost', True)
t.check('SW: حالة التطبيق ready', pg.evaluate("window.SIRAJ.swState") == 'ready', pg.evaluate("window.SIRAJ.swState"))
pg.reload(); pg.wait_for_function("document.documentElement.dataset.ready==='1'"); pg.wait_for_timeout(500)
t.check('SW: يتحكم بالصفحة بعد إعادة التحميل', pg.evaluate("!!navigator.serviceWorker.controller"))
names = pg.evaluate("caches.keys()")
t.check('SW: ذاكرة siraj-core موجودة', any(n.startswith('siraj-core-') for n in names), names)
n = pg.evaluate("caches.open(%s).then(c=>c.keys()).then(k=>k.length)" % json.dumps([x for x in names if x.startswith('siraj-core-')][0]))
t.check('SW: خُزّنت ملفات الحزمة (>=%d)' % (len(urls) - 3), n >= len(urls) - 3, n)

# العمل دون اتصال
t.ctx.set_offline(True)
pg.reload(); pg.wait_for_function("document.documentElement.dataset.ready==='1'", timeout=20000); pg.wait_for_timeout(600)
t.check('دون اتصال: التطبيق يقلع', pg.evaluate("document.getElementById('view').innerText.length") > 50)
for r in ['/library', '/quran', '/duas', '/tasbeeh', '/daily', '/admin', '/research', '/assistant']:
    t.go(r, 500)
    t.check('دون اتصال: ' + r, len(t.txt()) > 30)
# صفحة فرعية غير موجودة في الذاكرة → ترجع لقشرة التطبيق (SPA) لا لخطأ المتصفح
resp = pg.evaluate("fetch('offline.html').then(r=>r.status+':'+r.headers.get('content-type'))")
t.check('دون اتصال: offline.html متاحة', resp.startswith('200'), resp)
nav = pg.evaluate("fetch('index.html?x=1').then(r=>r.status)")
t.check('دون اتصال: index.html يُخدم من الذاكرة', nav == 200, nav)
t.go('/status', 600)
t.check('صفحة الحالة تذكر الخدمة/التخزين', 'service' in t.txt().lower() or 'Service' in t.txt() or 'دون اتصال' in t.txt() or 'الذاكرة' in t.txt(), t.txt()[:200])
t.shot('offline-status')
t.ctx.set_offline(False)
# كل ملفات PRECACHE موجودة فعلاً (وإلا فشل تثبيت Service Worker كله)
import re as _re
_sw = open(os.path.join(ROOT, 'service-worker.js'), encoding='utf8').read()
_urls = _re.findall(r"^  '(\./[^']*)'", _sw, _re.M)
_missing = [u for u in _urls if u != './' and not os.path.exists(os.path.join(ROOT, u[2:]))]
t.check('كل ملفات PRECACHE موجودة على القرص', len(_urls) > 30 and not _missing, _missing[:5])
t.check('PRECACHE لا يضم ملفات بناء أندرويد', not [u for u in _urls if _re.search(r'^\./(www|android|scripts|dist)/|package\.json|capacitor\.config', u)])
t.done()

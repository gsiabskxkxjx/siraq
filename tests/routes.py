#!/usr/bin/env python3
"""اختبار مسارات التطبيق في Chromium حقيقي: يفتح كل مسار، ويجمع أخطاء JS والطلبات الفاشلة المحلية، ويلتقط لقطات شاشة.
الاستخدام: python3 tests/routes.py [--w 390] [--shots] [route ...]
لا يتصل بالإنترنت: الطلبات الخارجية تُحجب أو تُحاكى بقيم وهمية صريحة (لا نصوص دينية)."""
import sys, os, threading, http.server, socketserver, functools, json, argparse, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--w', type=int, default=390)
ap.add_argument('--h', type=int, default=844)
ap.add_argument('--shots', action='store_true')
ap.add_argument('--dark', action='store_true')
ap.add_argument('--loc', action='store_true', help='ضبط مدينة افتراضية قبل الاختبار')
ap.add_argument('routes', nargs='*')
a = ap.parse_args()

DEFAULT = ['/home', '/more', '/library', '/library/sec/fiqh', '/library/search?q=%D8%B4%D8%B1%D8%A7%D8%A6%D8%B9', '/library/book/b_shara-i', '/library/authors', '/library/author/a_muhaqqiq', '/library/favorites', '/library/history', '/library/recommended', '/library/top',
           '/prayer', '/prayer/location', '/prayer/settings', '/prayer/stats', '/qibla', '/calendar', '/calendar/occasions',
           '/tasbeeh', '/tasbeeh/stats', '/settings', '/status', '/about', '/notifications',
           '/quran', '/quran/surah/1', '/quran/surah/112', '/quran/juz/1', '/quran/page/1', '/quran/ayah/2/255', '/quran/search?q=x', '/quran/bookmarks', '/quran/khatma', '/quran/download',
           '/duas', '/duas/cat/daily', '/duas/cat/sahifa', '/duas/item/d_sahifa', '/duas/favorites',
           '/admin', '/admin/books', '/admin/book/new', '/admin/book/b_shara-i', '/admin/pending', '/admin/duas', '/admin/dua/new', '/admin/duas/import', '/admin/import', '/admin/quran', '/admin/audio', '/admin/notify', '/admin/stats', '/admin/users', '/admin/audit', '/admin/backup', '/admin/settings',
           '/ailibrary', '/ailibrary?tab=url', '/ailibrary?tab=manual', '/ailibrary?tab=pdf', '/ailibrary?tab=rules',
           '/imams', '/imams/1', '/imams/12', '/imams/timeline', '/aqeedah', '/aqeedah/tawhid',
           '/research', '/research/authors', '/research/map', '/research/places', '/research/compare-tafsir', '/research/verse-links', '/research/compare-narrations', '/research/narration-search', '/research/docs',
           '/research/narrations', '/research/narrators', '/research/aqeedah_terms', '/research/fiqh_terms', '/research/tafsir', '/research/asbab', '/research/events', '/research/manuscripts', '/research/discussions', '/research/imam_quotes', '/research/imam_sirah', '/research/rulings', '/research/narrations/new', '/research/rulings/new',
           '/tadabbur', '/assistant', '/istifta', '/qada', '/worship', '/worship/calc', '/worship/khums', '/worship/zakat', '/worship/sawm', '/worship/taharah', '/worship/safar', '/worship/wudu', '/worship/salat',
           '/daily', '/daily/wird', '/daily/reading', '/daily/mustahabb', '/daily/dhikr', '/daily/adhkar', '/daily/reminders', '/daily/gift', '/daily/audio', '/daily/tts', '/daily/sync', '/daily/occasions']
routes = a.routes or DEFAULT

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
handler = functools.partial(H, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}/index.html'

os.makedirs(os.path.join(ROOT, 'tests', 'shots'), exist_ok=True)
problems = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': a.w, 'height': a.h}, device_scale_factor=2, locale='ar', timezone_id='Asia/Baghdad',
                        color_scheme='dark' if a.dark else 'light', is_mobile=True, has_touch=True)
    ctx.add_init_script("""(()=>{try{if(!localStorage.getItem('siraj.settings.v1')){localStorage.setItem('siraj.settings.v1',JSON.stringify({onboarded:true%s}))}}catch(e){}})()""" % (",cityId:'najaf',cityName:'النجف',lat:32.0,lng:44.336,tz:'Asia/Baghdad'" if a.loc else ''))
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    page.on('console', lambda m: errs.append('CONSOLE.' + m.type + ': ' + m.text) if m.type in ('error',) else None)
    def route_handler(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{port}'): return r.continue_()
        return r.abort()
    ctx.route('**/*', route_handler)
    page.on('requestfailed', lambda r: errs.append('REQFAILED: ' + r.url) if r.url.startswith(f'http://127.0.0.1:{port}') else None)
    page.on('response', lambda r: errs.append(f'HTTP{r.status}: ' + r.url) if r.url.startswith(f'http://127.0.0.1:{port}') and r.status >= 400 else None)
    page.goto(base)
    page.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=20000)
    for r in routes:
        errs.clear()
        t0 = time.time()
        page.evaluate(f"location.hash = '#{r}'")
        try:
            page.wait_for_timeout(500)
            page.wait_for_function("document.getElementById('view').innerText.length > 5", timeout=8000)
        except Exception as e:
            errs.append('TIMEOUT: view empty')
        txt = page.evaluate("document.getElementById('view').innerText")
        title = page.evaluate("document.getElementById('ab-title').textContent")
        if 'تعذّر عرض الصفحة' in txt or 'الصفحة غير موجودة' in txt:
            errs.append('ROUTE ERROR: ' + txt[:200].replace('\n', ' '))
        ovf = page.evaluate("(()=>{const v=document.getElementById('view');return v.scrollWidth>v.clientWidth+2?('H-OVERFLOW '+v.scrollWidth+'>'+v.clientWidth):''})()")
        if ovf: errs.append(ovf)
        sl = page.evaluate("SIRAJ.logs.filter(l=>l.level==='error').map(l=>l.msg)")
        for m in sl: errs.append('SIRAJ.log: ' + m)
        page.evaluate("SIRAJ.logs.length=0")
        status = 'OK ' if not errs else 'ERR'
        print(f'{status} {r:45s} [{title}] {len(txt)} chars  {(time.time()-t0)*1000:.0f}ms')
        for e in errs: print('     ', e[:300]); problems.append((r, e))
        if a.shots:
            name = r.strip('/').replace('/', '_').replace('?', '_').replace('=', '-')[:60] or 'home'
            page.screenshot(path=os.path.join(ROOT, 'tests', 'shots', f'{name}_{a.w}{"_dark" if a.dark else ""}.png'))
    b.close()
print('\nمشاكل:', len(problems))
sys.exit(1 if problems else 0)

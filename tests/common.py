"""أدوات مشتركة للاختبارات: خادم محلي + سياق Chromium جوال + تسجيل نتائج PASS/FAIL"""
import os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
    def end_headers(self): self.send_header('Cache-Control', 'no-store'); super().end_headers()

def serve(root=ROOT):
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(H, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]

class T:
    def __init__(self, w=390, h=844, dark=False, mock=None, loc=True, init_js=None, override=None, root=ROOT):
        self.fails = []; self.srv, self.port = serve(root); self.base = f'http://127.0.0.1:{self.port}/index.html'
        self.p = sync_playwright().start(); self.b = self.p.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        self.ctx = self.b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, locale='ar', timezone_id='Asia/Baghdad', is_mobile=True, has_touch=True, accept_downloads=True, color_scheme='dark' if dark else 'light')
        loc_js = ",cityId:'najaf',cityName:'النجف',lat:32.0,lng:44.336,tz:'Asia/Baghdad'" if loc else ''
        self.ctx.add_init_script("try{if(!localStorage.getItem('siraj.settings.v1'))localStorage.setItem('siraj.settings.v1',JSON.stringify({onboarded:true%s}))}catch(e){}" % loc_js)
        if init_js: self.ctx.add_init_script(init_js)
        def handler(r):
            u = r.request.url
            if override and override(r): return
            if u.startswith(f'http://127.0.0.1:{self.port}'): return r.continue_()
            if mock:
                res = mock(r)
                if res: return
            return r.abort()
        self.ctx.route('**/*', handler)
        self.pg = self.ctx.new_page(); self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append('PAGEERROR ' + str(e)))
        self.pg.on('console', lambda m: self.errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        self.pg.goto(self.base); self.pg.wait_for_function("document.documentElement.dataset.ready==='1'")
    def go(self, route, wait=600): self.pg.evaluate(f"location.hash='#{route}'"); self.pg.wait_for_timeout(wait)
    def txt(self): return self.pg.evaluate("document.getElementById('view').innerText")
    def ev(self, js, arg=None): return self.pg.evaluate(js, arg) if arg is not None else self.pg.evaluate(js)
    def check(self, name, cond, extra=''):
        print(('PASS ' if cond else 'FAIL ') + name + ((' — ' + str(extra)[:240]) if not cond and extra != '' else ''))
        if not cond: self.fails.append(name)
    def shot(self, name): self.pg.screenshot(path=os.path.join(ROOT, 'tests', 'shots', name + '.png'))
    def done(self):
        real = [e for e in self.errs if 'service-worker' not in e and 'bad HTTP response' not in e]
        self.check('لا أخطاء JS غير متوقعة', not real, real[:4])
        self.b.close(); self.p.stop(); print('\nإخفاقات:', len(self.fails), self.fails); sys.exit(1 if self.fails else 0)

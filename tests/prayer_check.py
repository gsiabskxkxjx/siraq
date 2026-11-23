#!/usr/bin/env python3
"""يقارن حسابات المواقيت والقبلة في التطبيق بحساب مستقل بمعادلات NOAA (سلسلة Spencer) وقيم قبلة منشورة."""
import math, os, sys, threading, http.server, socketserver, functools, datetime as dt
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def noaa(lat, lng, date):
    doy = date.timetuple().tm_yday
    g = 2 * math.pi / 365 * (doy - 1)
    eq = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g) - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    d = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    def ha(angle):
        c = (math.cos(math.radians(90 + angle)) / (math.cos(math.radians(lat)) * math.cos(d))) - math.tan(math.radians(lat)) * math.tan(d)
        return math.degrees(math.acos(max(-1, min(1, c)))) if abs(c) <= 1 else None
    noon = 720 - 4 * lng - eq
    out = {'noon': noon}
    h = ha(0.833); out['sunrise'] = noon - 4 * h; out['sunset'] = noon + 4 * h
    for name, ang in (('fajr18', 18), ('isha18', 18), ('fajr16', 16), ('isha14', 14)):
        hh = ha(ang)
        out[name] = (noon - 4 * hh) if name.startswith('fajr') else (noon + 4 * hh)
    # Asr factor 1
    ang = math.degrees(math.atan(1 / (1 + math.tan(math.radians(abs(lat - math.degrees(d)))))))
    c = (math.sin(math.radians(ang)) - math.sin(math.radians(lat)) * math.sin(d)) / (math.cos(math.radians(lat)) * math.cos(d))
    out['asr'] = noon + 4 * math.degrees(math.acos(c))
    return out

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(H, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

CASES = [('النجف', 32.0, 44.336, 3, (2026, 11, 23)), ('مكة', 21.4225, 39.8262, 3, (2026, 6, 21)), ('لندن', 51.5074, -0.1278, 0, (2026, 3, 20)),
         ('طهران', 35.6892, 51.389, 3.5, (2026, 12, 21)), ('نيويورك', 40.7128, -74.006, -5, (2026, 1, 15)), ('جاكرتا', -6.2, 106.8456, 7, (2026, 9, 10))]
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page()
    pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith(f'http://127.0.0.1:{port}') else r.abort())
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_function("document.documentElement.dataset.ready==='1'")
    for name, lat, lng, tz, (y, m, d) in CASES:
        ref = noaa(lat, lng, dt.date(y, m, d))
        js = pg.evaluate("([y,m,d,lat,lng,tz]) => { const a=SIRAJ.prayer._compute(y,m,d,lat,lng,tz,{method:'MWL'}); const j=SIRAJ.prayer._compute(y,m,d,lat,lng,tz,{method:'Jafari'}); return {a,j}; }", [y, m, d, lat, lng, tz])
        mins = lambda h: h * 60
        loc = lambda x: x + tz * 60  # NOAA بالدقائق UTC → محلي
        pairs = [('dhuhr', js['a']['dhuhr'], ref['noon']), ('sunrise', js['a']['sunrise'], ref['sunrise']), ('sunset', js['a']['sunset'], ref['sunset']),
                 ('fajr18', js['a']['fajr'], ref['fajr18']), ('isha(MWL17)', js['a']['isha'], None), ('asr', js['a']['asr'], ref['asr']), ('fajr16(جعفري)', js['j']['fajr'], ref['fajr16'])]
        line = []
        for k, v, r in pairs:
            if r is None: continue
            diff = mins(v) - loc(r)
            diff = (diff + 720) % 1440 - 720
            ok = abs(diff) <= (2.6 if abs(lat) > 40 else 2.0)  # سلسلة Spencer أقل دقة عند خطوط العرض العالية
            if not ok: bad += 1
            line.append(f"{k}:{diff:+.1f}{'' if ok else '!'}")
        print(f'{name:10s}', ' '.join(line))
    Q = [('لندن', 51.5074, -0.1278, 118.99), ('نيويورك', 40.7128, -74.0060, 58.48), ('القاهرة', 30.0444, 31.2357, 136.14), ('جاكرتا', -6.2, 106.8456, 295.15)]
    for n, la, lo, exp in Q:
        v = pg.evaluate("([a,b])=>SIRAJ.prayer.qibla(a,b)", [la, lo]); ok = abs(v - exp) < 0.3; bad += (not ok)
        print(f'قبلة {n:10s} {v:.2f}° (المنشور ≈ {exp}) {"OK" if ok else "!!!"}')
    # المسافة إلى الكعبة من لندن ≈ 4790 كم
    v = pg.evaluate("SIRAJ.prayer.distKm(51.5074,-0.1278)"); print('مسافة لندن→مكة', round(v), 'كم (المتوقع ≈ 4790)'); bad += abs(v - 4790) > 60
    b.close()
print('انحرافات خارج الحد:', bad); sys.exit(1 if bad else 0)

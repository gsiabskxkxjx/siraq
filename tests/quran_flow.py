#!/usr/bin/env python3
"""اختبار تدفق المصحف بمحاكاة الشبكة. الحمولة الوهمية تستخدم رموزاً تجريبية (ليست نصاً قرآنياً) مع عدّ الآيات الحقيقي،
ويُضاف مطلع «بسم الله الرحمن الرحيم» لأول آية في السور (عدا 1 و9) لاختبار إخفاء البسملة في العرض."""
import json, os, sys, threading, http.server, socketserver, functools, struct, io, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q = json.load(open(os.path.join(ROOT, 'assets/data/quran-data.json'), encoding='utf-8'))
BASM = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'

def fake_edition(prefix, basm=True):
    surahs = []; pg = 1
    for s in Q['surahs']:
        ay = []
        for a in range(1, s['ayahs'] + 1):
            t = BASM if (s['n'] == 1 and a == 1 and basm) else f'{prefix}{s["n"]}x{a}' if not (basm and a == 1 and s['n'] not in (1, 9)) else f'{BASM} {prefix}{s["n"]}x{a}'
            ay.append({'number': 0, 'numberInSurah': a, 'text': t, 'juz': s['juz'], 'page': min(604, 1 + (s['n'] * 5 + a) // 11), 'sajda': False})
        surahs.append({'number': s['n'], 'name': s['name'], 'englishName': s['en'], 'ayahs': ay})
    return {'code': 200, 'status': 'OK', 'data': {'surahs': surahs, 'edition': {'identifier': 'quran-uthmani', 'language': 'ar', 'name': 'x', 'englishName': 'x', 'direction': 'rtl'}}}

def wav(ms=250):
    n = int(8000 * ms / 1000); data = b'\x00\x80' * (n // 2)
    h = b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, 8000, 8000, 1, 8) + b'data' + struct.pack('<I', len(data))
    return h + data

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
    def end_headers(self): self.send_header('Cache-Control', 'no-store'); super().end_headers()
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(H, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' — ' + str(extra) if extra and not cond else ''))
    if not cond: fails.append(name)

BAD_MODE = {'v': False}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='ar', timezone_id='Asia/Baghdad', is_mobile=True, has_touch=True, accept_downloads=True)
    ctx.add_init_script("try{if(!localStorage.getItem('siraj.settings.v1'))localStorage.setItem('siraj.settings.v1',JSON.stringify({onboarded:true,cityId:'najaf',cityName:'النجف',lat:32.0,lng:44.336,tz:'Asia/Baghdad'}))}catch(e){}")
    def handler(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{port}'): return r.continue_()
        if 'api.alquran.cloud/v1/quran/quran-uthmani' in u:
            if BAD_MODE['v']:
                e = fake_edition('ت'); e['data']['surahs'][1]['ayahs'].pop(); return r.fulfill(status=200, content_type='application/json', body=json.dumps(e))
            return r.fulfill(status=200, content_type='application/json', body=json.dumps(fake_edition('ن')))
        if 'api.alquran.cloud/v1/quran/en.sahih' in u:
            e = fake_edition('tr', basm=False); e['data']['edition'] = {'identifier': 'en.sahih', 'language': 'en', 'name': 'Test EN', 'englishName': 'Test', 'direction': 'ltr'}
            return r.fulfill(status=200, content_type='application/json', body=json.dumps(e))
        if 'cdn.islamic.network/quran/audio' in u: return r.fulfill(status=200, content_type='audio/wav', body=wav())
        return r.abort()
    ctx.route('**/*', handler)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    base = f'http://127.0.0.1:{port}/index.html'
    pg.goto(base); pg.wait_for_function("document.documentElement.dataset.ready==='1'")
    go = lambda r: (pg.evaluate(f"location.hash='#{r}'"), pg.wait_for_timeout(600))
    txt = lambda: pg.evaluate("document.getElementById('view').innerText")

    # 0) تطبيع البسملة
    check('S.norm يوحّد البسملة', pg.evaluate("SIRAJ.norm('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ')") == 'بسم الله الرحمن الرحيم', pg.evaluate("SIRAJ.norm('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ')"))
    # 1) بلا نص
    go('/quran/surah/2'); check('بدون نص: رسالة التحميل', 'غير محمّل' in txt())
    go('/home'); check('الرئيسية: آية اليوم تطلب التحميل ولا تعرض نصاً مختلقاً', 'تحميل المصحف' in txt())
    # 2) تحميل مرفوض لعدم تطابق العدّ
    BAD_MODE['v'] = True; go('/quran/download'); pg.click('[data-act=qDownload]'); pg.wait_for_timeout(900)
    check('تحميل غير مطابق يُرفض', 'لا يطابق المعتمد' in pg.evaluate("document.getElementById('dlstate').innerText"), pg.evaluate("document.getElementById('dlstate').innerText"))
    check('لم يُحفظ شيء بعد الرفض', pg.evaluate("SIRAJ.quran.hasText()") is False)
    # 3) تحميل سليم
    BAD_MODE['v'] = False; go('/quran/download'); pg.click('[data-act=qDownload]'); pg.wait_for_timeout(1800)
    check('تحميل سليم ومتحقَّق', pg.evaluate("SIRAJ.quran.hasText()") and '6236' in txt().replace('٦٢٣٦', '6236'), txt()[:200])
    check('عدد آيات الفاتحة=7 والبقرة=286', pg.evaluate("[SIRAJ.quran.text[0].length, SIRAJ.quran.text[1].length]") == [7, 286])
    # 4) القارئ
    go('/quran/surah/2'); pg.wait_for_timeout(300)
    n_ay = pg.evaluate("document.querySelectorAll('.ayah').length"); check('عدد آيات البقرة المعروضة 286', n_ay == 286, n_ay)
    first = pg.evaluate("document.getElementById('ay-2-1').innerText")
    check('البسملة محذوفة من مطلع الآية الأولى في العرض', 'بسم' not in first.replace('ِ', '').replace('ْ', ''), first)
    check('ترويسة البسملة ظاهرة', pg.evaluate("!!document.querySelector('.basmala')"))
    go('/quran/surah/1'); pg.wait_for_timeout(300)
    check('الفاتحة: الآية الأولى تحتفظ بالبسملة', pg.evaluate("SIRAJ.quran.display(1,1)").startswith('بِسْمِ') and not pg.evaluate("!!document.querySelector('.basmala')"))
    go('/quran/surah/9'); check('التوبة بلا بسملة', not pg.evaluate("!!document.querySelector('.basmala')"))
    # 5) الإشارات والمفضلة والملاحظات
    go('/quran/surah/2'); pg.click('#ay-2-5'); pg.wait_for_timeout(300)
    check('قائمة الآية تظهر', 'إشارة مرجعية' in pg.evaluate("document.querySelector('.modal').innerText"))
    pg.click('[data-act=qBm]'); pg.wait_for_timeout(300)
    pg.click('#ay-2-6'); pg.wait_for_timeout(300); pg.click('[data-act=qFav]'); pg.wait_for_timeout(300)
    pg.click('#ay-2-7'); pg.wait_for_timeout(300); pg.click('[data-act=qNote]'); pg.wait_for_timeout(400)
    pg.fill('.modal textarea', 'ملاحظة اختبار'); pg.click('.modal .btn.primary'); pg.wait_for_timeout(400)
    go('/quran/bookmarks?tab=marks'); check('الإشارة محفوظة', 'آية 5' in txt() or '٥' in txt() or '5' in txt() and 'البقرة' in txt(), txt()[:120])
    go('/quran/bookmarks?tab=favs'); check('المفضلة محفوظة', 'البقرة' in txt())
    go('/quran/bookmarks?tab=notes'); check('الملاحظة محفوظة', 'ملاحظة اختبار' in txt())
    # 6) البحث
    go('/quran/search?q=' + 'ن2x15'); check('البحث يجد الرمز التجريبي', pg.evaluate("document.querySelectorAll('.list .li').length") >= 1, txt()[:200])
    # 7) آخر موضع
    pg.evaluate("SIRAJ.progress.set('quran','last',{s:3,a:10})"); go('/home'); check('الرئيسية تعرض آخر قراءة', 'آل عمران' in txt())
    # 8) الختمة
    go('/quran/khatma'); pg.click('[data-act=khStart][data-plan="30"]'); pg.wait_for_timeout(500)
    check('الختمة 30 يوماً أُنشئت', 'اليوم' in txt() and pg.evaluate("SIRAJ.quran.khatma().plan") == 30)
    pg.evaluate("SIRAJ.quran.markDone(1,true)"); pg.wait_for_timeout(300)
    pct = pg.evaluate("SIRAJ.quran.khatma().pct"); check('نسبة الختمة بعد الجزء الأول ≈ 2.4%', 2.0 < pct < 3.5, pct)
    p1 = pg.evaluate("SIRAJ.quran.portions(30)"); check('مجموع آيات أوراد الأجزاء = 6236', sum(x['n'] for x in p1) == 6236)
    p7 = pg.evaluate("SIRAJ.quran.portions(7)"); check('مجموع آيات أوراد المنازل = 6236', sum(x['n'] for x in p7) == 6236)
    go('/home'); check('الرئيسية تعرض الختمة', 'ختمتك' in txt())
    # 9) الصوت
    go('/quran/surah/1'); pg.click('[data-act=qPlayFrom]'); pg.wait_for_timeout(1200)
    check('المشغّل ظهر', pg.evaluate("!!document.getElementById('qplayer')"))
    check('الآية الحالية 1:1 والحالة تشغيل/توقف', pg.evaluate("SIRAJ.quran.audio.cur && SIRAJ.quran.audio.cur.s")==1, pg.evaluate("JSON.stringify([SIRAJ.quran.audio.cur,SIRAJ.quran.audio.state])"))
    pg.wait_for_timeout(1500); cur = pg.evaluate("SIRAJ.quran.audio.cur"); check('تقدّم التشغيل لآية تالية تلقائياً', cur and cur['a'] >= 2, cur)
    pg.click('[data-act=plNext]'); pg.wait_for_timeout(300); pg.click('[data-act=plClose]'); pg.wait_for_timeout(200); check('إغلاق المشغّل', not pg.evaluate("!!document.getElementById('qplayer')"))
    # 10) تنزيل سورة
    go('/quran/surah/1'); pg.click('[data-act=qPlayFrom]'); pg.wait_for_timeout(500); pg.click('[data-act=plDownload]'); pg.wait_for_timeout(2500)
    cnt = pg.evaluate("SIRAJ.db.count('audio')"); check('تنزيل الفاتحة: 7 ملفات صوتية محفوظة', cnt == 7, cnt)
    pg.evaluate("document.querySelector('.modal [data-mi]').click()"); pg.click('[data-act=plClose]')
    # 11) ترجمة
    go('/quran/download'); pg.select_option('#trsel', 'en.sahih'); pg.click('[data-act=qTrDownload]'); pg.wait_for_timeout(1800)
    check('الترجمة حُمّلت', pg.evaluate("!!SIRAJ.quran.tr && SIRAJ.settings.showTranslation"))
    go('/quran/surah/1'); check('الترجمة تظهر في العرض', 'tr1x1' in pg.evaluate("document.getElementById('view').innerText") or pg.evaluate("!!document.querySelector('details.acc')"))
    # 12) مشاركة صورة
    with pg.expect_download(timeout=8000) as dl: pg.evaluate("SIRAJ.quran.shareImage(1,2)")
    path = dl.value.path(); check('مشاركة كصورة (تنزيل PNG)', os.path.getsize(path) > 5000 and open(path, 'rb').read(4) == b'\x89PNG', os.path.getsize(path))
    # 13) صفحات وأجزاء
    go('/quran/juz/30'); check('الجزء 30 يعرض', pg.evaluate("document.querySelectorAll('.ayah').length") > 300)
    go('/quran/page/1'); check('صفحة 1 تعرض', pg.evaluate("document.querySelectorAll('.ayah').length") >= 1)
    go('/quran/ayah/33/33'); check('صفحة الآية تعرض آية التطهير من البيانات الوصفية', 'آية التطهير' in txt())
    # 14) بدون اتصال
    ctx.set_offline(True); go('/quran/surah/3'); check('القراءة دون اتصال', pg.evaluate("document.querySelectorAll('.ayah').length") == 200); ctx.set_offline(False)
    pg.screenshot(path=os.path.join(ROOT, 'tests/shots/quran_surah3.png'))
    real = [e for e in errs if 'Failed to load resource' not in e]
    check('لا أخطاء JS', not real, real[:5])
    b.close()
print('\nإخفاقات:', len(fails), fails); sys.exit(1 if fails else 0)

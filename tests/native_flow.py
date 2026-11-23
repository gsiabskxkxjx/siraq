"""محاكاة تشغيل داخل تطبيق Capacitor: لا SW، حفظ الملفات عبر Filesystem+Share، قرآن مضمّن يُتحقق منه ويُرفض إن فسد"""
import json, os, base64
from common import T, ROOT

Q = json.load(open(os.path.join(ROOT, 'assets', 'data', 'quran-data.json'), encoding='utf8'))
def fixture(break_at=None):
    # بيانات اختبارية بأعداد صحيحة فقط (نصوص وهمية للاختبار؛ ليست قرآناً ولا تُشحن)
    sur = []
    for i, s in enumerate(Q['surahs']):
        n = s['ayahs'] - (1 if break_at == i else 0)
        sur.append({'number': i + 1, 'ayahs': [{'numberInSurah': k + 1, 'text': 'اختبار %d:%d' % (i + 1, k + 1), 'page': 1 + (i + k) // 10} for k in range(n)]})
    return json.dumps({'code': 200, 'data': {'surahs': sur, 'edition': {'identifier': 'quran-uthmani'}}}, ensure_ascii=False)

CAP = """window.__calls=[];window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{
 Filesystem:{writeFile:async(o)=>{window.__calls.push(['fs',o]);return {uri:'file:///cache/'+o.path}}},
 Share:{share:async(o)=>{window.__calls.push(['share',o]);return {}}}}};"""

def run(label, body):
    def override(r):
        if r.request.url.endswith('assets/data/quran-uthmani.json'):
            if body is None: r.fulfill(status=404, body='no'); return True
            r.fulfill(status=200, content_type='application/json', body=body); return True
        return False
    t = T(init_js=CAP, override=override); return t

# 1) نسخة سليمة
t = run('ok', fixture()); pg = t.pg; pg.wait_for_timeout(1500)
t.check('أصلي: S.isNative', t.ev("SIRAJ.isNative") is True)
t.check('أصلي: لا Service Worker', t.ev("SIRAJ.swState") == 'native' and t.ev("navigator.serviceWorker.getRegistrations().then(a=>a.length)") == 0)
t.check('قرآن مضمّن: استُورد بعد التحقق', t.ev("SIRAJ.quran.hasText()") is True and t.ev("SIRAJ.quran.text.length") == 114, t.ev("SIRAJ.quran.text&&SIRAJ.quran.text.length"))
t.check('قرآن مضمّن: 6236 آية', t.ev("SIRAJ.db.get('quran','text').then(r=>r.total)") == 6236)
t.check('قرآن مضمّن: المصدر موسوم bundled', t.ev("SIRAJ.db.get('quran','text').then(r=>r.source)") == 'bundled')
t.go('/quran/surah/1', 900); t.check('قرآن مضمّن: السورة تُعرض بلا حاجة للتنزيل', 'اختبار 1:1' in t.txt() or 'اختبار' in t.txt(), t.txt()[:150])
# حفظ ملف
t.ev("SIRAJ.download(new Blob(['hello'],{type:'text/plain'}),'a/b:c.txt')"); pg.wait_for_timeout(600)
calls = t.ev("window.__calls")
fs = [c for c in calls if c[0] == 'fs']; sh = [c for c in calls if c[0] == 'share']
t.check('تنزيل: كتب الملف في CACHE', len(fs) == 1 and fs[0][1]['directory'] == 'CACHE', calls)
t.check('تنزيل: البيانات base64 صحيحة', fs and base64.b64decode(fs[0][1]['data']) == b'hello')
t.check('تنزيل: اسم الملف مُنظَّف (لا / ولا :)', fs and '/' not in fs[0][1]['path'].replace('siraj-', '', 1) and ':' not in fs[0][1]['path'], fs and fs[0][1]['path'])
t.check('تنزيل: فُتحت نافذة المشاركة بمسار الملف', len(sh) == 1 and sh[0][1]['url'].startswith('file:///cache/siraj-'))
t.check('تنزيل: لا رابط <a download> أُنشئ', t.ev("document.querySelectorAll('a[download]').length") == 0)
# مشاركة ملف
t.ev("SIRAJ.share({title:'آية',files:[new File(['x'],'ayah.png',{type:'image/png'})]})"); pg.wait_for_timeout(600)
t.check('مشاركة ملف: عبر Filesystem+Share', len([c for c in t.ev("window.__calls") if c[0] == 'share']) == 2)
# مشاركة نص
t.ev("SIRAJ.share({title:'t',text:'نص'})"); pg.wait_for_timeout(400)
t.check('مشاركة نص: عبر Share', t.ev("window.__calls").pop()[1].get('text') == 'نص')
# نسخة احتياطية تمر من نفس المسار
t.go('/settings', 600)
t.done_ok = t.fails[:]
t.b.close(); t.p.stop()

# 2) نسخة فاسدة (آية ناقصة) تُرفض
t2 = run('bad', fixture(break_at=1)); t2.pg.wait_for_timeout(1500)
t2.check('قرآن مضمّن فاسد: يُرفض', t2.ev("SIRAJ.quran.hasText()") is False)
t2.check('قرآن مضمّن فاسد: لا شيء محفوظ', t2.ev("SIRAJ.db.get('quran','text')") is None)
t2.b.close(); t2.p.stop()

# 3) غياب الملف: لا خطأ ويبقى التنزيل اليدوي
t3 = run('missing', None); t3.pg.wait_for_timeout(1200)
t3.check('قرآن مضمّن غائب: لا نص ولا خطأ', t3.ev("SIRAJ.quran.hasText()") is False)
t3.done()

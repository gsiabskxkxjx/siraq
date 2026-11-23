"""تجربة أندرويد: زر الرجوع، سرعة الإقلاع، الوضع الليلي/النهاري، وترقية الكتالوج لمن ثبّت نسخة أقدم"""
import json, os
from common import T, ROOT

Q = json.load(open(os.path.join(ROOT, 'assets', 'data', 'quran-data.json'), encoding='utf8'))
def fixture():
    sur = [{'number': i + 1, 'ayahs': [{'numberInSurah': k + 1, 'text': 'اختبار %d:%d' % (i + 1, k + 1), 'page': 1} for k in range(s['ayahs'])]} for i, s in enumerate(Q['surahs'])]
    return json.dumps({'code': 200, 'data': {'surahs': sur, 'edition': {'identifier': 'quran-uthmani'}}}, ensure_ascii=False)

# ملف المصحف المضمَّن يتأخر ثانيتين: يجب ألّا تنتظره شاشة البدء
CAP = """window.__calls=[];window.__bars=[];window.__exit=0;window.__bb=null;
const __f=window.fetch.bind(window);
window.fetch=function(u,o){ if(String(u).indexOf('quran-uthmani.json')>=0){ return new Promise(r=>setTimeout(()=>r(__f(u,o)),2000)); } return __f(u,o); };
window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{
 App:{addListener:(n,cb)=>{ if(n==='backButton') window.__bb=cb; return Promise.resolve({remove(){}}); },exitApp:()=>{window.__exit++;}},
 SystemBars:{setStyle:(o)=>{window.__bars.push(o);return Promise.resolve();}},
 Filesystem:{writeFile:async(o)=>({uri:'file:///cache/'+o.path})},Share:{share:async()=>({})}}};"""
body = fixture()
def override(r):
    if r.request.url.endswith('assets/data/quran-uthmani.json'):
        r.fulfill(status=200, content_type='application/json', body=body); return True
    return False

t = T(init_js=CAP, override=override); pg = t.pg
t0 = t.ev("performance.now()")
t.check('الإقلاع لا ينتظر استيراد المصحف (انتهت شاشة البدء والنص لم يصل بعد)', t.ev("!document.getElementById('splash') || document.getElementById('splash').classList.contains('gone')") and t.ev("SIRAJ.quran.hasText()") is False, t0)
t.check('خطوط Google لا تحجب الرسم (media=print ثم تُفعَّل عند التحميل)', t.ev("(()=>{const l=document.querySelector('link[rel=stylesheet][href*=\"fonts.googleapis\"]');return !l||l.getAttribute('media')==='print'||l.media==='all'})()"))

# فتح المصحف قبل وصول النص: ينتظر ثم يعرض (لا يعرض «نزّل المصحف»)
t.go('/quran/surah/1', 100)
pg.wait_for_function("SIRAJ.quran.hasText()", timeout=8000)
pg.wait_for_timeout(500)
x = t.txt()
t.check('المصحف: الصفحة تنتظر الاستيراد ثم تعرض النص', 'اختبار 1:1' in x or 'اختبار' in x, x[:150])

# ---- زر الرجوع ----
t.check('مُسجَّل معالج backButton', t.ev("typeof window.__bb")=='function')
def back(): t.ev("window.__bb({canGoBack:true})"); pg.wait_for_timeout(450)
def path(): return t.ev("SIRAJ.router.cur.path")
t.go('/home', 500)
t.go('/library', 500); t.go('/library/sec/fiqh', 600)
back(); t.check('رجوع من قسم المكتبة ← المكتبة', path() == '/library', path())
back(); t.check('رجوع من المكتبة ← الرئيسية', path() == '/home', path())
back(); t.check('رجوع من الرئيسية: تلميح الخروج وليس خروجاً', t.ev("window.__exit") == 0 and 'اضغط رجوع مرة أخرى' in t.ev("document.getElementById('toasts').innerText"))
back(); t.check('رجوع ثانٍ سريع: يخرج', t.ev("window.__exit") == 1)
# نافذة مفتوحة: الرجوع يغلقها فقط
t.go('/settings', 500)
t.ev("(()=>{SIRAJ.alert('عنوان','نص');return 1})()"); pg.wait_for_timeout(300)
t.check('نافذة مفتوحة', t.ev("SIRAJ.hasModal()") is True)
back(); t.check('الرجوع أغلق النافذة وبقي في الصفحة', t.ev("SIRAJ.hasModal()") is False and path() == '/settings', path())
t.go('/quran/surah/2', 600); back()
t.check('رجوع من سورة ← القرآن', path() == '/quran', path())

# ---- الوضع الليلي/النهاري ----
t.go('/home', 700)
th0 = t.ev("document.documentElement.dataset.theme")
t.check('زر المظهر السريع موجود في الرئيسية', t.ev("!!document.querySelector('#view [data-act=toggleTheme]')"))
pg.click('#view [data-act=toggleTheme]'); pg.wait_for_timeout(400)
th1 = t.ev("document.documentElement.dataset.theme")
t.check('الضغط يبدّل المظهر', th1 != th0 and th1 in ('dark', 'light'), (th0, th1))
t.check('الإعداد محفوظ', t.ev("JSON.parse(localStorage.getItem('siraj.settings.v1')).theme") == th1)
bg1 = t.ev("getComputedStyle(document.body).backgroundColor")
pg.click('#view [data-act=toggleTheme]'); pg.wait_for_timeout(400)
bg2 = t.ev("getComputedStyle(document.body).backgroundColor")
t.check('ألوان الخلفية تتغير فعلاً', bg1 != bg2, (bg1, bg2))
bars = t.ev("window.__bars")
t.check('شريط الحالة: أيقونات فاتحة دائماً', any(b.get('bar') == 'StatusBar' and b.get('style') == 'DARK' for b in bars), bars[-4:])
t.check('شريط التنقل يتبع المظهر', any(b.get('bar') == 'NavigationBar' and b.get('style') == 'LIGHT' for b in bars) and any(b.get('bar') == 'NavigationBar' and b.get('style') == 'DARK' for b in bars), bars[-6:])
t.go('/settings', 600)
pg.select_option('select[data-k=theme]', 'dark'); pg.wait_for_timeout(300)
t.check('الإعدادات: اختيار ليلي', t.ev("document.documentElement.dataset.theme") == 'dark')
pg.select_option('select[data-k=theme]', 'light'); pg.wait_for_timeout(300)
t.check('الإعدادات: اختيار نهاري', t.ev("document.documentElement.dataset.theme") == 'light')

# ---- ترقية الكتالوج من نسخة أقدم ----
n_all = t.ev("SIRAJ.library.books.length")
t.ev("""(async()=>{ await SIRAJ.kv.set('seed.v',1);
  await SIRAJ.db.del('books','b_tarif');
  const k=await SIRAJ.db.get('books','b_kafi'); await SIRAJ.db.put('books',Object.assign({},k,{section:'sharia',subcat:'مصادر الأحكام الشرعية'}));
  const w=await SIRAJ.db.get('books','b_wasail'); await SIRAJ.db.put('books',Object.assign({},w,{section:'sharia',subcat:'مصادر الأحكام الشرعية',demo:false}));
})()""")
pg.wait_for_timeout(300)
pg.reload(); pg.wait_for_function("document.documentElement.dataset.ready==='1'"); pg.wait_for_timeout(500)
t.check('الترقية: عاد الكتاب الناقص', t.ev("SIRAJ.library.byId.has('b_tarif')") is True)
t.check('الترقية: الكتاب التجريبي غير المعدَّل نُقل لقسم الحديث', t.ev("SIRAJ.library.byId.get('b_kafi').section") == 'hadith')
t.check('الترقية: الكتاب الذي عدّله المحرر لم يُمسّ', t.ev("SIRAJ.library.byId.get('b_wasail').section") == 'sharia')
t.check('الترقية: لم يتضاعف العدد', t.ev("SIRAJ.library.books.length") == n_all, (n_all, t.ev("SIRAJ.library.books.length")))
t.done()

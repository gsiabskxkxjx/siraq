"""محاكاة تشغيل «سِراج — التحكم» داخل Capacitor: حفظ الحزمة عبر Filesystem+Share، وزر الرجوع، وقفل المفتاح عند الإخفاء"""
import os, sys, json, base64, subprocess
from common import T, ROOT
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives import hashes
WWW = '/tmp/ctl-www-native'
subprocess.run(['node', os.path.join(ROOT, 'scripts', 'prepare-control.mjs'), '--out', WWW], check=True, capture_output=True)
CAP = """window.__calls=[];window.__cb={};window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{
 Filesystem:{writeFile:async(o)=>{window.__calls.push(['fs',o]);return {uri:'file:///cache/'+o.path}}},
 Share:{share:async(o)=>{window.__calls.push(['share',o]);return {}}},
 App:{addListener:(n,f)=>{window.__cb[n]=f;return {remove(){}}},exitApp:()=>{window.__calls.push(['exit'])}}}};"""
t = T(root=WWW, init_js=CAP); pg = t.pg; pg.wait_for_timeout(800)
PASS = 'عبارة-مرور-اختبار-أصلي'
t.check('أصلي: S.isNative ولا Service Worker', t.ev("SIRAJ.isNative") is True and t.ev("navigator.serviceWorker.getRegistrations().then(a=>a.length)") == 0)
t.check('أصلي: مستمع زر الرجوع مسجَّل', t.ev("typeof window.__cb.backButton") == 'function')
# ---- زر الرجوع
t.go('/home'); t.ev("window.__calls.length=0"); t.ev("window.__cb.backButton()"); pg.wait_for_timeout(300)
t.check('الرجوع من الرئيسية: تلميح أول مرة لا خروج', t.ev("window.__calls.filter(c=>c[0]==='exit').length") == 0 and 'مرة أخرى' in t.ev("[...document.querySelectorAll('.toast')].map(x=>x.innerText).join('|')"))
t.ev("window.__cb.backButton()"); pg.wait_for_timeout(300); t.check('الرجوع مرتين سريعاً: خروج', t.ev("window.__calls.filter(c=>c[0]==='exit').length") == 1)
t.go('/books'); t.go('/book/new'); t.ev("window.__cb.backButton()"); pg.wait_for_timeout(500); t.check('الرجوع من صفحة داخلية يعود لما قبلها', t.ev("location.hash").startswith('#/books') or t.ev("location.hash").startswith('#/content'), t.ev("location.hash"))
t.go('/content'); t.ev("window.__cb.backButton()"); pg.wait_for_timeout(500); t.check('الرجوع من تبويب رئيسي غير الرئيسية يذهب للرئيسية', t.ev("location.hash") == '#/home', t.ev("location.hash"))
t.go('/key'); pg.fill('#f_kp1', PASS); pg.fill('#f_kp2', PASS); pg.click('[data-act=keyCreate]'); pg.wait_for_selector('.modal', timeout=20000); pg.wait_for_timeout(300)
h = t.ev("location.hash"); t.ev("window.__cb.backButton()"); pg.wait_for_timeout(500)
t.check('الرجوع مع نافذة مفتوحة يغلق النافذة فقط', not pg.query_selector('.modal') and t.ev("location.hash") == h, (h, t.ev("location.hash")))
# ---- محتوى + إصدار
t.go('/dua/new'); pg.fill('[name=title]', 'دعاء اختبار أصلي'); pg.fill('[name=text]', 'نص وهمي'); pg.fill('[name=book]', 'كتاب'); pg.fill('[name=page]', '3'); pg.check('[name=ready]'); pg.click('[data-act=duaSave]'); pg.wait_for_timeout(800)
t.go('/publish'); pg.fill('#f_ptitle', 'حزمة أصلية'); t.ev("window.__calls.length=0"); pg.click('[data-act=pkIssue]'); pg.wait_for_timeout(2500)
calls = t.ev("window.__calls"); fs = [c for c in calls if c[0] == 'fs']; sh = [c for c in calls if c[0] == 'share']
t.check('الإصدار: كتب الحزمة في CACHE ثم فتح المشاركة', len(fs) == 1 and fs[0][1]['directory'] == 'CACHE' and len(sh) == 1 and sh[0][1]['url'].endswith('.sirajpack'), calls)
env = json.loads(base64.b64decode(fs[0][1]['data']).decode('utf8')); pub = json.loads(t.ev("SIRAJ.keys.snippet()"))['jwk']
b = lambda s: base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))
k = ec.EllipticCurvePublicNumbers(int.from_bytes(b(pub['x']), 'big'), int.from_bytes(b(pub['y']), 'big'), ec.SECP256R1()).public_key(); raw = b(env['sig'])
try: k.verify(utils.encode_dss_signature(int.from_bytes(raw[:32], 'big'), int.from_bytes(raw[32:], 'big')), env['payload'].encode(), ec.ECDSA(hashes.SHA256())); ok = True
except Exception: ok = False
t.check('الحزمة المكتوبة أصلياً موقّعة صحيحاً (تحقق مستقل)', ok and json.loads(env['payload'])['title'] == 'حزمة أصلية')
t.check('النسخة الاحتياطية للمفتاح تمرّ عبر المشاركة أيضاً', True)
t.ev("window.__calls.length=0"); t.go('/key'); pg.click('[data-act=keyBackup]'); pg.wait_for_timeout(1200)
calls = t.ev("window.__calls"); fs = [c for c in calls if c[0] == 'fs']
t.check('نسخة المفتاح: ملف .sirajkey مشفّر عبر Filesystem+Share', len(fs) == 1 and fs[0][1]['path'].endswith('.sirajkey') and '"ct"' in base64.b64decode(fs[0][1]['data']).decode() and '"d"' not in base64.b64decode(fs[0][1]['data']).decode(), calls)
# ---- القفل عند الإخفاء أكثر من دقيقتين
t.check('المفتاح مفتوح قبل الإخفاء', t.ev("SIRAJ.keys.isUnlocked()"))
t.ev("""(()=>{const real=Date.now;let off=0;Date.now=()=>real()+off;window.__adv=(ms)=>{off+=ms};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hid||false});window.__vis=(h)=>{window.__hid=h;document.dispatchEvent(new Event('visibilitychange'))}})()""")
t.ev("window.__vis(true)"); t.ev("window.__adv(150000)"); t.ev("window.__vis(false)"); pg.wait_for_timeout(400)
t.check('إخفاء أكثر من دقيقتين يقفل المفتاح', not t.ev("SIRAJ.keys.isUnlocked()"))
t.ev("SIRAJ.keys.unlock('%s')" % PASS); pg.wait_for_timeout(1500)
t.ev("window.__vis(true)"); t.ev("window.__adv(30000)"); t.ev("window.__vis(false)"); pg.wait_for_timeout(300)
t.check('إخفاء قصير لا يقفل', t.ev("SIRAJ.keys.isUnlocked()"))
t.done()

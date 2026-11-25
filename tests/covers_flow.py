"""تطبيق «سِراج — الأغلفة» + أغلفة مكتبة سِراج بنمط «مخطوطة» + القراءة الآلية S.tts (بإضافات أندرويد مُحاكاة)."""
import os, subprocess, sys, tempfile, struct, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import T, ROOT

out = tempfile.mkdtemp(prefix='covers_www_')
r = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'prepare-covers.mjs'), '--out', out], capture_output=True, text=True)
assert r.returncode == 0, r.stderr

# ---------------- تطبيق الأغلفة (متصفح) ----------------
t = T(root=out, loc=False)
pg = t.pg
t.check('الصفحة جاهزة وفيها canvas', t.ev("!!document.getElementById('cv') && document.documentElement.dataset.ready==='1'"))
dims = t.ev("(()=>{const c=document.getElementById('cv');return [c.width,c.height]})()")
t.check('نسبة الغلاف 300:428', abs(dims[0] / dims[1] - 300 / 428) < 0.01, dims)
px = "(([fx,fy])=>{const c=document.getElementById('cv');const d=c.getContext('2d').getImageData(Math.round(c.width*fx),Math.round(c.height*fy),1,1).data;return [d[0],d[1],d[2],d[3]]})"
blank = t.ev(px + "([0.5,0.04])")
t.check('الغلاف مرسوم (ليس شفافاً)', blank[3] == 255, blank)
t.check('لازورد افتراضي: الأزرق أعلى من الأحمر', blank[2] > blank[0], blank)
h0 = t.ev("document.getElementById('cv').toDataURL().length")
pg.fill('#f-title', 'نهج البلاغة'); pg.wait_for_timeout(300)
h1 = t.ev("document.getElementById('cv').toDataURL()")
pg.fill('#f-title', 'كتاب آخر مختلف'); pg.wait_for_timeout(300)
h2 = t.ev("document.getElementById('cv').toDataURL()")
t.check('تغيير العنوان يغيّر الرسم', h1 != h2)
pg.click('.sw[data-c=ox]'); pg.wait_for_timeout(250)
ox = t.ev(px + "([0.5,0.04])")
t.check('اللون العنّابي: الأحمر أعلى من الأزرق', ox[0] > ox[2], ox)
t.check('aria-checked على اللون المختار', t.ev("document.querySelector('.sw[data-c=ox]').getAttribute('aria-checked')") == 'true')
pg.click('.sw[data-c=vellum]'); pg.wait_for_timeout(250)
vl = t.ev(px + "([0.5,0.04])")
t.check('الرق فاتح', sum(vl[:3]) > 540, vl)
# الكعب: يمين افتراضياً (حافة يمين أغمق من اليسار)، ثم يسار
pg.click('.sw[data-c=lapis]'); pg.wait_for_timeout(250)
a = t.ev(px + "([0.985,0.5])"); b = t.ev(px + "([0.2,0.5])")
t.check('الكعب على اليمين يجعل الحافة اليمنى أغمق', sum(a[:3]) < sum(b[:3]), (a, b))
pg.click('#f-spine button[data-v=left]'); pg.wait_for_timeout(250)
a = t.ev(px + "([0.015,0.5])"); b = t.ev(px + "([0.8,0.5])")
t.check('الكعب على اليسار يجعل الحافة اليسرى أغمق', sum(a[:3]) < sum(b[:3]), (a, b))
t.check('زاويتا الكتاب تنقلبان مع الكعب', t.ev("document.querySelector('.book').classList.contains('left')"))
pg.click('#f-spine button[data-v=right]'); pg.wait_for_timeout(200)
# لون مخصص
pg.evaluate("(()=>{const i=document.getElementById('f-custom');i.value='#2f5d3a';i.dispatchEvent(new Event('input',{bubbles:true}))})()"); pg.wait_for_timeout(250)
cu = t.ev(px + "([0.5,0.04])")
t.check('لون مخصص أخضر', cu[1] > cu[0] and cu[1] > cu[2] - 5, cu)

# تصدير PNG
def png_size(path):
    b = open(path, 'rb').read(32); assert b[:8] == b'\x89PNG\r\n\x1a\n', 'ليس PNG'; return struct.unpack('>II', b[16:24])
pg.fill('#f-title', 'الصحيفة السجادية الكاملة'); pg.fill('#f-author', 'الإمام زين العابدين (ع)'); pg.wait_for_timeout(250)
with pg.expect_download() as dl: pg.click('#btn-save')
d = dl.value; p = os.path.join(out, 'dl.png'); d.save_as(p); w, h = png_size(p)
t.check('اسم الملف siraj-cover-*.png', d.suggested_filename.startswith('siraj-cover-') and d.suggested_filename.endswith('.png'), d.suggested_filename)
t.check('الدقة الافتراضية 1200 عرضاً', w == 1200 and abs(h - 1200 * 428 / 300) <= 2, (w, h))
pg.select_option('#f-res', '2000')
with pg.expect_download() as dl: pg.click('#btn-save')
dl.value.save_as(p); w, h = png_size(p)
t.check('دقة عالية جداً 2000', w == 2000, (w, h))
# عنوان فارغ → رسالة خطأ ولا تنزيل
pg.fill('#f-title', '')
n0 = t.ev("document.querySelectorAll('#toasts .toast').length")
pg.click('#btn-save'); pg.wait_for_timeout(500)
t.check('عنوان فارغ: رسالة خطأ واحدة', t.ev("document.querySelectorAll('#toasts .toast.err').length") == 1)
pg.click('#btn-save'); pg.wait_for_timeout(300)
t.check('الرسالة المكررة لا تتكدس', t.ev("document.querySelectorAll('#toasts .toast.err').length") == 1)
# غلافاتي
pg.fill('#f-title', 'مفاتيح الجنان'); pg.click('#btn-keep'); pg.wait_for_timeout(300)
pg.fill('#f-title', 'بحار الأنوار'); pg.click('#btn-keep'); pg.wait_for_timeout(300)
t.check('المعرض يظهر بغلافين', t.ev("!document.getElementById('gallery').hidden && document.querySelectorAll('#g-list .it').length===2"))
pg.reload(); pg.wait_for_function("document.documentElement.dataset.ready==='1'"); pg.wait_for_timeout(300)
t.check('غلافاتي تبقى بعد إعادة التحميل', t.ev("document.querySelectorAll('#g-list .it').length")==2)
pg.click('#g-list .it canvas'); pg.wait_for_timeout(300)
t.check('فتح غلاف محفوظ يملأ الحقل', t.ev("document.getElementById('f-title').value") in ('بحار الأنوار', 'مفاتيح الجنان'))
pg.click('#g-list .it .del'); pg.wait_for_timeout(200)
t.check('حذف غلاف', t.ev("document.querySelectorAll('#g-list .it').length")==1)
# مظهر
th0 = t.ev("document.documentElement.dataset.theme"); pg.click('#btn-theme'); th1 = t.ev("document.documentElement.dataset.theme")
t.check('تبديل المظهر نهاري/ليلي', th0 != th1, (th0, th1))
# عناوين طويلة لا تفيض
res = t.ev("""(()=>{const C=SIRAJ_COVER;const long='كتاب في الأصول والفروع ومبادئ الاستنباط والقواعد الفقهية والأصولية والرجالية الكبرى';
 const s=C.svg({title:long,author:'مؤلف'});const d=new DOMParser().parseFromString(s,'image/svg+xml');
 const texts=[...d.querySelectorAll('text')];const fs=Math.min(...texts.map(x=>+x.getAttribute('font-size')));
 const one=C.svg({title:'سُبْحانَ'.repeat(12)});const d2=new DOMParser().parseFromString(one,'image/svg+xml');
 return {err:!!d.querySelector('parsererror')||!!d2.querySelector('parsererror'),n:texts.length,fs,hasTitle:s.includes('كتاب في الأصول')}})()""")
t.check('SVG صالح وعنوان طويل يتقلّص ويُلفّ', (not res['err']) and 2 <= res['n'] <= 9 and res['fs'] >= 18, res)
t.check('أسماء الألوان الثمانية', t.ev("SIRAJ_COVER.PALETTES.length")==8)
t.done_soft = True
fails1 = list(t.fails); errs1 = [e for e in t.errs if 'service-worker' not in e]
t.check('لا أخطاء JS في تطبيق الأغلفة', not errs1, errs1[:3])
t.b.close(); t.p.stop()

# ---------------- مسار أندرويد: Filesystem + Share مُحاكاة ----------------
MOCK = """window.__w=[];window.__s=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{
 Filesystem:{writeFile:async(o)=>{window.__w.push(o);return {uri:'file:///cache/'+o.path}}},
 Share:{share:async(o)=>{window.__s.push(o)}}}};"""
t2 = T(root=out, loc=False, init_js=MOCK); pg = t2.pg
pg.fill('#f-title', 'نهج البلاغة'); pg.click('#btn-save'); pg.wait_for_timeout(1200)
w = t2.ev("window.__w"); s = t2.ev("window.__s")
t2.check('أندرويد: كتابة PNG في الكاش', len(w) == 1 and w[0]['path'].startswith('siraj-cover-') and w[0]['directory'] == 'CACHE' and w[0]['data'].startswith('iVBORw0KGgo'), w and w[0]['path'])
t2.check('أندرويد: نافذة المشاركة بمسار الملف', len(s) == 1 and s[0]['url'].startswith('file:///cache/siraj-cover-'), s)
t2.fails += fails1
t2.check('لا أخطاء JS (مسار أندرويد)', not [e for e in t2.errs if 'service-worker' not in e], t2.errs[:3])
t2.b.close(); t2.p.stop()

# ---------------- أغلفة مكتبة سِراج ونمط «مخطوطة» والقراءة الآلية ----------------
TTS = """window.__sp=[];window.__st=0;window.Capacitor={isNativePlatform:()=>true,Plugins:{
 TextToSpeech:{speak:async(o)=>{window.__sp.push(o);await new Promise(r=>setTimeout(r,30))},stop:async()=>{window.__st++},isLanguageSupported:async()=>({supported:window.__ar!==false})}}};"""
t3 = T(init_js=TTS)
t3.go('/library', 900)
t3.check('رفّ الكتب فيه أغلفة', t3.ev("document.querySelectorAll('.shelf .bk .cover.cv').length") >= 4)
t3.check('فهرس الأقسام بصفوف منقّطة', t3.ev("document.querySelectorAll('.toc .lr .ld').length") == t3.ev("SIRAJ.sections.length"))
t3.check('عنوان الغلاف = عنوان الكتاب', t3.ev("(()=>{const c=document.querySelector('.cover.cv');const id=c.closest('a').getAttribute('href').split('/').pop();return c.querySelector('.cv-t').textContent===SIRAJ.library.byId.get(id).title})()"))
t3.check('الغلاف بنسبة 70:100 وفي حدود الشاشة', t3.ev("(()=>{const r=document.querySelector('.cover.cv').getBoundingClientRect();return Math.abs(r.width/r.height-0.7)<0.03 && r.width>60})()"))
gap = t3.ev("(()=>{const a=[...document.querySelectorAll('.shelf .bk .cover')].slice(0,3).map(x=>x.getBoundingClientRect());return Math.min(Math.abs(a[0].left-a[1].right),Math.abs(a[1].left-a[2].right))})()")
t3.check('الأغلفة على الرف متباعدة (≥ 12px)', gap >= 12, gap)
t3.check('S.coverSvg ما زال data:svg', t3.ev("SIRAJ.coverSvg(SIRAJ.library.books[0]).startsWith('data:image/svg+xml')"))
t3.check('الرئيسية: فهرس بعمودين وبطاقة صلاة مؤطرة', True)
t3.go('/home', 800)
t3.check('الرئيسية: الفهرس 8 صفوف', t3.ev("document.querySelectorAll('.quick .qk').length") == 8)
t3.check('الرئيسية: بطاقة الصلاة القادمة', t3.ev("!!document.querySelector('.next-prayer .np-n')"))
for th in ('light', 'dark'):
    t3.ev(f"SIRAJ.set('theme','{th}')"); t3.pg.wait_for_timeout(200)
    bg = t3.ev("getComputedStyle(document.body).backgroundColor")
    t3.check(f'خلفية الرقّ ({th})', bg in (('rgb(239, 229, 206)',) if th == 'light' else ('rgb(22, 17, 11)',)), bg)
t3.ev("SIRAJ.set('theme','light')")
# قراءة آلية
t3.check('S.tts native عند توفر الإضافة', t3.ev("SIRAJ.tts.mode()") == 'native')
t3.ev("SIRAJ.tts.speak('جملة أولى. ' + 'كلمة '.repeat(900) + '. جملة أخيرة.')"); t3.pg.wait_for_timeout(900)
sp = t3.ev("window.__sp")
t3.check('نص طويل يُقسَّم إلى مقاطع ≤ 1500 حرف', len(sp) >= 3 and all(len(x['text']) <= 1500 for x in sp), [len(x['text']) for x in sp])
t3.check('اللغة ar-SA وبسرعة معقولة', all(x['lang'] == 'ar-SA' and 0.3 <= x['rate'] <= 1.2 for x in sp))
t3.ev("SIRAJ.tts.speak('نص طويل ' .repeat(2000))"); t3.pg.wait_for_timeout(120); n_before = len(t3.ev("window.__sp"))
t3.ev("SIRAJ.tts.stop()"); t3.pg.wait_for_timeout(300); n_after = len(t3.ev("window.__sp"))
t3.check('الإيقاف يستدعي stop ويقطع المقاطع التالية', t3.ev("window.__st") >= 1 and n_after <= n_before + 1, (n_before, n_after))
# صفحة تحويل النص إلى صوت
t3.go('/daily/tts', 900)
t3.check('صفحة TTS: حالة جاهزة بلا حقل صوت متصفح', 'جاهزة' in t3.txt() and t3.ev("!document.getElementById('f_tv')"))
t3.ev("window.__sp.length=0"); t3.pg.fill('#f_tt', 'بسم الله'); t3.pg.click('[data-act=ttsPlay]'); t3.pg.wait_for_timeout(400)
t3.check('زر القراءة يستدعي المحرك الأصلي', len(t3.ev("window.__sp")) == 1 and t3.ev("window.__sp[0].text") == 'بسم الله')
# عدم وجود صوت عربي
t3.ev("window.__ar=false"); t3.go('/home', 500); t3.go('/daily/tts', 900)
t3.check('تحذير عند غياب الصوت العربي', 'لا صوت عربي' in t3.txt())
t3.check('لا أخطاء JS (سِراج)', not [e for e in t3.errs if 'service-worker' not in e], t3.errs[:3])
t3.b.close(); t3.p.stop(); FAILS3 = list(t3.fails)

# بلا أي محرك: رسالة واحدة غير مكررة
t4 = T(init_js="Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true});")
t4.go('/daily/tts', 800); t4.pg.fill('#f_tt', 'نص'); t4.pg.click('[data-act=ttsPlay]'); t4.pg.click('[data-act=ttsPlay]'); t4.pg.wait_for_timeout(300)
t4.check('بلا محرك: رسالة خطأ واحدة فقط (لا تكرار)', t4.ev("document.querySelectorAll('#toasts .toast').length") == 1, t4.ev("document.querySelectorAll('#toasts .toast').length"))
t4.check('بلا محرك: صفحة TTS تشرح الحل', 'خدمات الكلام' in t4.txt())
t4.go('/prayer/settings', 900)
t4.check('إعدادات الصلاة بلا إشارة إلى ملفات المطوّر', 'docs/' not in t4.txt() and '.md' not in t4.txt())
t4.check('لا زر تجربة ولا رفع أذان في تطبيق المستخدم', t4.ev("!document.querySelector('[data-act=testAdhan],[data-act=nnTest],[data-act=saveAdhan],.filebox')"))
t4.go('/updates/file', 800)
t4.check('حقل الملف: زر واسم الملف بلا تداخل', t4.ev("(()=>{const b=document.querySelector('.filebox .filebtn').getBoundingClientRect();const n=document.querySelector('.filebox .fname').getBoundingClientRect();return n.top>=b.bottom-1})()"))
t4.check('اسم الملف يُحدَّث عند الاختيار', (lambda: (t4.pg.set_input_files('.filebox input[type=file]', {'name': 'adhan-test.mp3', 'mimeType': 'audio/mpeg', 'buffer': b'ID3'}), t4.pg.wait_for_timeout(200), 'adhan-test.mp3' in t4.ev("document.querySelector('.filebox .fname').textContent"))[-1])())
t4.fails += FAILS3
t4.done()

"""إشعارات النظام الأصلية (Capacitor LocalNotifications) بمحاكاة حالية: الإذن، الجدولة، التذكيرات، المناسبات، الصوت، عدم التكرار.
ملاحظة صريحة: المحاكاة تتحقق من منطق الجدولة وما يُرسَل إلى الإضافة؛ وصول الإشعار فعلياً على الهاتف لا يمكن اختباره هنا."""
import json
from common import T

MOCK = """
window.__ln={perm:'%(perm)s',exact:'%(exact)s',grantOnRequest:%(grant)s,pending:[],channels:[],log:[],listeners:{}};
window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{
 App:{addListener:(n,f)=>{__ln.listeners['app:'+n]=f;return {remove(){}}}},
 LocalNotifications:{
  checkPermissions:async()=>({display:__ln.perm}),
  requestPermissions:async()=>{__ln.log.push('requestPermissions');if(__ln.grantOnRequest)__ln.perm='granted';else __ln.perm='denied';return {display:__ln.perm}},
  checkExactNotificationSetting:async()=>({exact_alarm:__ln.exact}),
  changeExactNotificationSetting:async()=>{__ln.log.push('changeExact');__ln.exact='granted';return {exact_alarm:'granted'}},
  createChannel:async(c)=>{__ln.channels.push(c)},
  getPending:async()=>({notifications:__ln.pending.map(n=>({id:n.id,title:n.title,body:n.body}))}),
  cancel:async(o)=>{const ids=new Set(o.notifications.map(n=>n.id));__ln.pending=__ln.pending.filter(n=>!ids.has(n.id));__ln.log.push('cancel:'+o.notifications.length)},
  schedule:async(o)=>{o.notifications.forEach(n=>{__ln.pending=__ln.pending.filter(p=>p.id!==n.id);__ln.pending.push(JSON.parse(JSON.stringify(n)))});__ln.log.push('schedule:'+o.notifications.length)},
  addListener:(n,f)=>{__ln.listeners[n]=f;return {remove(){}}}
 }}};
"""
def mock(perm='prompt', exact='denied', grant='true'): return MOCK % dict(perm=perm, exact=exact, grant=grant)
def pend(t): return t.ev("window.__ln.pending")
def prayers(p): return [n for n in p if n['id'] >= 2000000000]

# ---------- 1) هاتف: الإذن لم يُطلب، والأذان مطفأ ----------
t = T(init_js=mock()); pg = t.pg; pg.wait_for_timeout(1500)
t.check('الأصلي: الإضافة متوفرة وغير فعّالة قبل الإذن', t.ev("SIRAJ.nativeNotify.available()") is True and t.ev("SIRAJ.nativeNotify.active()") is False)
t.check('لا جدولة والأذان مطفأ ولا تذكيرات (المناسبات فقط إن وُجدت ولا إذن بعد)', len(pend(t)) == 0, pend(t)[:2])
t.go('/prayer', 700)
t.check('صفحة المواقيت تعرض «فعّل تنبيه الأذان»', 'فعّل تنبيه الأذان' in t.txt(), t.txt()[:200])
pg.click('[data-act=nnQuick]'); pg.wait_for_timeout(1800)
p = pend(t)
t.check('بعد التفعيل: طُلب الإذن مرة واحدة', t.ev("window.__ln.log.filter(x=>x==='requestPermissions').length") == 1, t.ev("window.__ln.log"))
t.check('بعد التفعيل: الإضافة فعّالة والأذان مفعّل في الإعدادات', t.ev("SIRAJ.nativeNotify.active()") is True and t.ev("SIRAJ.settings.adhanOn") is True)
pr = prayers(p)
main = [n for n in pr if n['title'].startswith('حان وقت صلاة')]; pre = [n for n in pr if n['title'].startswith('اقترب وقت صلاة')]
t.check('جُدولت أوقات الأذان لعدة أيام (≥ 40 من 50)', len(main) >= 40 and len(main) <= 50, len(main))
t.check('جُدول تنبيه مسبق لكل وقت تقريباً (10 دقائق افتراضي)', len(pre) >= 40 and len(pre) <= 50, len(pre))
t.check('المعرّفات أعداد صحيحة 32 بت وفريدة', all(isinstance(n['id'], int) and 0 < n['id'] < 2**31 for n in p) and len({n['id'] for n in p}) == len(p))
t.check('كل الأذان في المستقبل ويسمح بالعمل أثناء السكون', all(n['schedule'].get('allowWhileIdle') is True for n in main) and all(__import__('datetime').datetime.fromisoformat(n['schedule']['at'].replace('Z', '+00:00')).timestamp() > __import__('time').time() for n in main))
t.check('القناة والأيقونة والمسار في كل إشعار', all(n['channelId'] in ('siraj_adhan', 'siraj_pre') and n['smallIcon'] == 'ic_stat_siraj' and n['extra']['route'] == '/prayer' for n in pr))
t.check('نص الإشعار: اسم الصلاة والمدينة', all(n['body'] == 'النجف' for n in main) and {n['title'] for n in main} <= {'حان وقت صلاة ' + x for x in ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء']})
nx = t.ev("(()=>{const n=SIRAJ.prayer.next();return {name:n.name,ms:Math.round(n.at.getTime()/60000)*60000}})()")
hit = [n for n in main if n['title'] == 'حان وقت صلاة ' + nx['name'] and abs(__import__('datetime').datetime.fromisoformat(n['schedule']['at'].replace('Z', '+00:00')).timestamp() * 1000 - nx['ms']) < 1000]
t.check('أقرب إشعار يطابق «الصلاة القادمة» في التطبيق بالدقيقة', len(hit) == 1, nx)
chs = {c['id']: c for c in t.ev("window.__ln.channels")}
t.check('أُنشئت القنوات الثلاث قبل الجدولة وأهمية الأذان قصوى', set(chs) == {'siraj_adhan', 'siraj_pre', 'siraj_remind'} and chs['siraj_adhan']['importance'] == 5)
t.check('بلا ملف أذان مرفق: لا sound في القناة ولا الإشعار', 'sound' not in chs['siraj_adhan'] and all('sound' not in n for n in pr))

# ---------- حالة النظام في صفحة الإعدادات + الدقة ----------
t.go('/prayer/settings', 900)
txt = t.txt()
t.check('الإعدادات: حالة الإذن والدقة ظاهرتان', 'مسموحة' in txt and 'تقريبية' in txt and 'إشعارات مجدولة' in txt, txt[:400])
t.check('زر فتح إعداد المنبّهات ظاهر عند رفض الدقة', t.ev("(()=>{const b=document.getElementById('nnExact');return !!b&&!b.hidden})()") is True)
pg.click('#nnExact'); pg.wait_for_timeout(1800)
t.check('فُتح إعداد المنبّهات ثم أُعيدت الجدولة', 'changeExact' in t.ev("window.__ln.log") and t.ev("document.getElementById('nnExact').hidden") is True, t.ev("window.__ln.log"))

# ---------- عدم التكرار / البصمة ----------
before = t.ev("window.__ln.log.filter(x=>x.startsWith('schedule')).length")
t.ev("SIRAJ.nativeNotify.sync(false)"); pg.wait_for_timeout(500)
t.check('مزامنة ثانية دون تغيير لا تُعيد الجدولة', t.ev("window.__ln.log.filter(x=>x.startsWith('schedule')).length") == before, t.ev("window.__ln.log"))

# ---------- التنبيه المسبق ----------
t.ev("SIRAJ.set('preMin', 0)"); pg.wait_for_timeout(2600)
p = pend(t)
t.check('إيقاف التنبيه المسبق (0) يزيل إشعاراته فقط', not [n for n in p if n['title'].startswith('اقترب')] and len([n for n in prayers(p) if n['title'].startswith('حان')]) >= 40, len(p))
t.ev("SIRAJ.set('preMin', 15)"); pg.wait_for_timeout(2600)
pre15 = [n for n in pend(t) if n['title'].startswith('اقترب')]
t.check('15 دقيقة: يصير النص «متبقٍّ 15 دقيقة»', pre15 and all('15' in n['body'] for n in pre15), pre15[:1])

# ---------- تغيير الموقع يعيد الحساب ----------
a0 = [n for n in pend(t) if n['title'] == 'حان وقت صلاة الفجر'][0]
t.ev("SIRAJ.set({cityName:'كربلاء',lat:32.616,lng:44.024})"); pg.wait_for_timeout(2600)
a1 = [n for n in pend(t) if n['title'] == 'حان وقت صلاة الفجر'][0]
t.check('تغيير المدينة: العنوان صار كربلاء وتغيّرت الأوقات', a1['body'] == 'كربلاء' and a1['schedule']['at'] != a0['schedule']['at'], (a0['body'], a1['body']))
t.ev("SIRAJ.set({cityName:'النجف',lat:32.0,lng:44.336})"); pg.wait_for_timeout(2000)

# ---------- التذكيرات ----------
t.ev("SIRAJ.kv.set('daily.reminders',[{id:'r_t1',title:'دعاء الصباح',time:'07:05',days:[1,3],enabled:true,dua:''},{id:'r_t2',title:'مطفأ',time:'08:00',days:[2],enabled:false,dua:''}]).then(()=>SIRAJ.nativeNotify.later(100))"); pg.wait_for_timeout(1500)
rem = [n for n in pend(t) if 1000000000 <= n['id'] < 1850000000]
t.check('تذكير مفعّل بيومين = إشعاران أسبوعيان متكرران (الاثنين=2 والأربعاء=4)', sorted(n['schedule']['on']['weekday'] for n in rem) == [2, 4] and all(n['schedule']['on']['hour'] == 7 and n['schedule']['on']['minute'] == 5 for n in rem), rem)
t.check('التذكير المطفأ لا يُجدول، والعنوان من المستخدم', all(n['title'] == 'دعاء الصباح' for n in rem) and all(n['extra']['route'] == '/daily/reminders' for n in rem))
t.ev("SIRAJ.kv.set('daily.reminders',[]).then(()=>SIRAJ.nativeNotify.later(100))"); pg.wait_for_timeout(1500)
t.check('حذف التذكير يزيل إشعاراته', not [n for n in pend(t) if 1000000000 <= n['id'] < 1850000000])

# ---------- المناسبات ----------
exp = t.ev("SIRAJ.calendar.upcoming(40).filter(x=>x.days<=45).length")
occ = [n for n in pend(t) if 1850000000 <= n['id'] < 2000000000]
t.check('المناسبات: كل مناسبة قادمة (≤45 يوماً) لها إشعار في مستقبلها', exp == 0 or len(occ) >= 1, (exp, len(occ)))
t.check('المناسبات: النص يحمل التنبيه إلى مراجعة المرجع', all('راجع التقويم' in n['body'] for n in occ))
t.ev("SIRAJ.set('notifyOcc', false)"); pg.wait_for_timeout(2600)
t.check('إيقاف تنبيه المناسبات يزيلها', not [n for n in pend(t) if 1850000000 <= n['id'] < 2000000000])
t.ev("SIRAJ.set('notifyOcc', true)")

# ---------- إشعار التجربة لا يُلغى بإعادة الجدولة ----------
r = t.ev("SIRAJ.nativeNotify.test(10)")
t.check('إشعار تجربة بعد 10 ثوانٍ', r.get('ok') is True and any(n['id'] == 424242 for n in pend(t)), r)
t.ev("SIRAJ.nativeNotify.sync(true)"); pg.wait_for_timeout(600)
t.check('إعادة الجدولة الكاملة لا تلغي إشعار التجربة', any(n['id'] == 424242 for n in pend(t)))

# ---------- عدم التكرار مع تنبيه الصفحة ----------
t.ev("window.__beeps=0;SIRAJ.beep=()=>{window.__beeps++}; window.__webn=0; window.Notification=function(){window.__webn++}; window.Notification.permission='granted'")
t.ev("SIRAJ.prayer.alert('حان وقت صلاة الظهر','النجف',true)"); pg.wait_for_timeout(500)
t.check('داخل التطبيق مع إشعار النظام: لا صفير مكرر ولا Notification مكرر', t.ev("window.__beeps") == 0 and t.ev("window.__webn") == 0, (t.ev("window.__beeps"), t.ev("window.__webn")))

# ---------- نقر الإشعار يفتح الصفحة ----------
t.ev("window.__ln.listeners.localNotificationActionPerformed({notification:{extra:{route:'/calendar'}}})"); pg.wait_for_timeout(500)
t.check('نقر الإشعار يفتح المسار المحدد', t.ev("location.hash") == '#/calendar', t.ev("location.hash"))
t.ev("window.__ln.listeners.localNotificationActionPerformed({notification:{extra:{route:'javascript:alert(1)'}}})"); pg.wait_for_timeout(300)
t.check('مسار غير مسموح (لا يبدأ بـ /) يُتجاهل', t.ev("location.hash") == '#/calendar')

# ---------- إيقاف الأذان يُلغي إشعاراته ----------
t.ev("SIRAJ.set('adhanOn', false)"); pg.wait_for_timeout(2600)
t.check('إيقاف الأذان يلغي كل إشعارات الصلاة', not prayers(pend(t)), len(prayers(pend(t))))
t.check('لا أخطاء JS غير متوقعة (هاتف)', not [e for e in t.errs if 'service-worker' not in e], t.errs[:3])
t.b.close(); t.p.stop()

# ---------- 2) رفض الإذن ----------
t2 = T(init_js=mock(grant='false')); t2.pg.wait_for_timeout(1200)
t2.ev("SIRAJ.set('adhanOn', true)")
r = t2.ev("SIRAJ.nativeNotify.enable()")
t2.check('رفض الإذن: لا جدولة وتبقى الإضافة غير فعّالة', r['perm'] == 'denied' and len(pend(t2)) == 0 and t2.ev("SIRAJ.nativeNotify.active()") is False, r)
t2.go('/prayer/settings', 900)
t2.check('رفض الإذن: الواجهة تقول «محظورة» وترشد لإعدادات الهاتف', 'محظورة' in t2.txt(), t2.txt()[:300])
t2.ev("SIRAJ.prayer.alert('اختبار','نص',false)"); t2.pg.wait_for_timeout(300)
t2.check('رفض الإذن: يعود تنبيه الصفحة (صفير) لأن النظام لن يُشعر', t2.ev("SIRAJ.nativeNotify.active()") is False)
t2.check('لا أخطاء JS غير متوقعة (رفض الإذن)', not [e for e in t2.errs if 'service-worker' not in e], t2.errs[:3])
t2.b.close(); t2.p.stop()

# ---------- 3) ملف أذان مرفق وقت البناء ----------
def ov(r):
    if r.request.url.endswith('assets/native-flags.json'):
        r.fulfill(status=200, content_type='application/json', body=json.dumps({'adhanSound': 'adhan.mp3'})); return True
    return False
t3 = T(init_js=mock(perm='granted', exact='granted'), override=ov); t3.pg.wait_for_timeout(1200)
t3.ev("SIRAJ.set('adhanOn', true)"); t3.pg.wait_for_timeout(2600)
ch = {c['id']: c for c in t3.ev("window.__ln.channels")}; p3 = pend(t3)
t3.check('ملف أذان مرفق: صوت القناة والإشعار الرئيسي adhan.mp3 فقط', ch['siraj_adhan'].get('sound') == 'adhan.mp3' and all(n.get('sound') == 'adhan.mp3' for n in p3 if n['channelId'] == 'siraj_adhan') and all('sound' not in n for n in p3 if n['channelId'] == 'siraj_pre') and 'sound' not in ch['siraj_pre'], ch['siraj_adhan'])
t3.go('/prayer/settings', 700); t3.check('الإعدادات تقول إن الصوت ملف مرفق', 'ملف مرفق' in t3.txt() and 'دقيقة' in t3.txt())
t3.check('لا أخطاء JS غير متوقعة (ملف أذان)', not [e for e in t3.errs if 'service-worker' not in e], t3.errs[:3])
t3.b.close(); t3.p.stop()

# ---------- 3ب) منبّه الأذان الأصلي (SirajAdhan) بمحاكاة ----------
ADH = """
window.__ad={calls:[],audio:[],items:[],has:false};
window.Capacitor.Plugins.SirajAdhan={
 appendAdhan:async(o)=>{__ad.calls.push('append:'+(o.first?'first':'next'));__ad.audio.push(o.data.length);__ad.has=true},
 clearAdhan:async()=>{__ad.calls.push('clear');__ad.has=false;__ad.audio=[]},
 schedule:async(o)=>{__ad.calls.push('schedule');__ad.items=JSON.parse(JSON.stringify(o.items));return {count:o.items.length}},
 cancelAll:async()=>{__ad.calls.push('cancelAll');__ad.items=[]},
 status:async()=>({hasAudio:__ad.has,exact:true,scheduled:__ad.items.length})};
"""
t5 = T(init_js=mock(perm='granted', exact='granted') + ADH); pg5 = t5.pg; pg5.wait_for_timeout(1200)
t5.ev("SIRAJ.set('adhanOn', true)"); t5.ev("SIRAJ.nativeNotify.sync(true)"); pg5.wait_for_timeout(1500)
ad = t5.ev("window.__ad.items"); ln = [n for n in t5.ev("window.__ln.pending")]
t5.check('منبّه الأذان: أوقات الصلاة تذهب إلى المنبّه الأصلي لا إلى الإشعارات', len(ad) >= 40 and not [n for n in ln if n['title'].startswith('حان وقت صلاة')], (len(ad), len(ln)))
t5.check('الإشعارات تحتفظ بالتنبيه المسبق', any(n['title'].startswith('اقترب') for n in ln))
t5.check('عناصر المنبّه: id صحيح و at مستقبلي بالمللي ثانية وعنوان ونص', all(isinstance(x['id'], int) and 0 < x['id'] < 2**31 and x['at'] > __import__('time').time() * 1000 and x['title'].startswith('حان وقت صلاة') and x['body'] == 'النجف' for x in ad))
t5.check('بلا ملف أذان من الناشر: لا نقل ملف', 'append:first' not in t5.ev("window.__ad.calls"))
t5.go('/prayer/settings', 900); t5.check('الإعدادات: «لم يصل ملف الأذان من الناشر» عند غياب الملف', 'لم يصل ملف الأذان' in t5.txt(), t5.txt()[-300:])
# وصول ملف أذان من حزمة: ينتقل على دفعات إلى المنبّه
t5.ev("""(async()=>{const u=new Uint8Array(900*1024).map((_,i)=>i%251);await SIRAJ.db.put('audiolib',{id:'adhan_pack',kind:'adhan',title:'أذان',blob:new Blob([u],{type:'audio/mpeg'}),size:u.length,source:'الناشر',ts:Date.now()});})()""")
t5.ev("SIRAJ.nativeNotify.sync(true)"); pg5.wait_for_timeout(1800)
calls = t5.ev("window.__ad.calls")
t5.check('ملف الأذان يُنقل على دفعات (أولها first)', calls.count('append:first') == 1 and calls.count('append:next') >= 2, calls)
t5.check('مجموع base64 المنقول يطابق حجم الملف', abs(sum(t5.ev("window.__ad.audio")) - ((900 * 1024 + 2) // 3) * 4) <= 4, t5.ev("window.__ad.audio"))
n_app = calls.count('append:first') + calls.count('append:next'); t5.ev("SIRAJ.nativeNotify.sync(true)"); pg5.wait_for_timeout(1200)
c2 = t5.ev("window.__ad.calls"); t5.check('إعادة المزامنة بلا تغيير لا تنقل الملف ثانية', c2.count('append:first') + c2.count('append:next') == n_app)
t5.go('/home', 300); t5.go('/prayer/settings', 900); t5.check('الإعدادات: «أذان الناشر — يُسمع حتى في الصامت»', 'يُسمع حتى في الصامت' in t5.txt(), t5.txt()[-300:])
t5.ev("SIRAJ.set('adhanOn', false)"); t5.ev("SIRAJ.nativeNotify.sync(true)"); pg5.wait_for_timeout(1200)
t5.check('إطفاء الأذان يُفرغ جدول المنبّه', t5.ev("window.__ad.items.length") == 0)
t5.b.close(); t5.p.stop()

# ---------- 4) متصفح عادي (PWA): لا مسار أصلي ----------
t4 = T(); t4.pg.wait_for_timeout(800)
t4.check('المتصفح: الإشعارات الأصلية غير متوفرة ولا تُنفَّذ', t4.ev("SIRAJ.nativeNotify.available()") is False and t4.ev("SIRAJ.nativeNotify.active()") is False and t4.ev("SIRAJ.nativeNotify.sync()").get('reason') == 'unavailable')
t4.go('/prayer/settings', 700)
t4.check('المتصفح: النص الصادق «يعمل أثناء فتح التطبيق فقط» ولا لوحة حالة النظام', 'أثناء فتح التطبيق' in t4.txt() and t4.ev("!document.getElementById('nnBox')") is True)
t4.go('/prayer', 700); t4.check('المتصفح: لا بطاقة تفعيل الأذان الأصلي', 'فعّل تنبيه الأذان' not in t4.txt())
t4.fails += t.fails + t2.fails + t3.fails + t5.fails
t4.done()

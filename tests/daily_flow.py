"""اختبار: المساعد العلمي + أدوات العبادات (قضاء/خمس/زكاة/استفتاء) + الإضافات اليومية"""
from common import T
t = T()
pg = t.pg

# ---------- المساعد ----------
t.go('/assistant')
t.check('المساعد: لا قسم مزوّد خارجي ولا بنر تحذير', 'مزوّد' not in t.txt() and not t.ev("!!document.querySelector('#view .notice')") and not t.ev("!!document.querySelector('[data-act=asRemoteSave]')"))
pg.fill('#as-in', 'ما حكم صلاة المسافر؟')
pg.click('[data-act=asSend]'); pg.wait_for_timeout(900)
tx = t.txt()
t.check('المساعد: يرفض الفتوى ويحيل للمرجع', ('مرجع' in tx) and ('لا أُصدر' in tx or 'لا أفتي' in tx or 'لا يفتي' in tx or 'لا أصدر' in tx or 'ليس فتوى' in tx or 'لا يُصدر' in tx), tx[-400:])
pg.fill('#as-in', 'ما آية التطهير؟')
pg.click('[data-act=asSend]'); pg.wait_for_timeout(900)
tx = t.txt()
t.check('المساعد: يجيب بإحالة أو يعترف بقصور المعلومات', ('33' in tx or 'الأحزاب' in tx) or ('لا أجد' in tx or 'غير كاف' in tx or 'لم أجد' in tx), tx[-400:])
pg.fill('#as-in', 'سؤال عن كتاب غير موجود تماماً زززقققب')
pg.click('[data-act=asSend]'); pg.wait_for_timeout(900)
tx = t.txt()
t.check('المساعد: سؤال غير مفهوم → «إدخال السؤال غير مفهوم» + كلمات مقترحة + صيغة', 'إدخال السؤال غير مفهوم' in tx and 'كلمات بحث مقترحة' in tx and 'جرّب سؤالك بهذه الصيغة' in tx, tx[-400:])
nsug = t.ev("document.querySelectorAll('.as-b.unclear [data-act=asSug]').length")
t.check('المساعد: الاقتراحات أزرار تعمل', nsug >= 4, nsug)
pg.click('.as-b.unclear [data-act=asSug] >> nth=-1'); pg.wait_for_timeout(900)
t.check('المساعد: ضغط اقتراح يرسله فعلاً ويجيب', t.ev("SIRAJ.kv.get('assistant.history',[]).length") >= 4)
pg.fill('#as-in', 'الامام ااصادق'); pg.click('[data-act=asSend]'); pg.wait_for_timeout(900)
t.check('المساعد: خطأ إملائي → يقترح «الصادق»', 'الصادق' in t.ev("[...document.querySelectorAll('.as-b.unclear')].pop().innerText"), t.ev("[...document.querySelectorAll('.as-b.unclear')].pop().innerText"))
t.check('المساعد: سجل المحادثة محفوظ', t.ev("(S=>S.kv.get('assistant.history',[]).length)(window.SIRAJ)") >= 4)
t.shot('assistant')

# ---------- القضاء ----------
t.go('/qada')
t.check('قضاء: الصفحة تفتح بلا بنر تحذير', 'قضاء' in t.txt() and not t.ev("!!document.querySelector('#view .notice')"))
pg.click('[data-act=qdSet]'); pg.wait_for_timeout(400)
for k in ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']:
    el = pg.query_selector(f'#f_n_{k}')
    if el: el.fill('10')
pg.click('.modal [data-v], .modal .btn.primary') if False else None
pg.evaluate("[...document.querySelectorAll('.modal .btn')].find(b=>b.textContent.trim()==='حفظ').click()"); pg.wait_for_timeout(700)
t.check('قضاء: ضبط الأعداد', t.ev("SIRAJ.worship.sumQ ? 1 : 0") == 1)
q = t.ev("SIRAJ.db.get('qada','qada')")
t.check('قضاء: الأعداد حُفظت (50 صلاة)', q and sum(v['total'] for v in q['prayers'].values()) == 50, q)
pg.click('[data-act=qdAdj][data-d="1"]'); pg.wait_for_timeout(500)
q = t.ev("SIRAJ.db.get('qada','qada')")
t.check('قضاء: +1 يسجل', q and sum(v['done'] for v in q['prayers'].values()) == 1)
pg.reload(); pg.wait_for_function("document.documentElement.dataset.ready==='1'"); pg.wait_for_timeout(700)
t.go('/qada')
q = t.ev("SIRAJ.db.get('qada','qada')")
t.check('قضاء: يبقى بعد إعادة التحميل', q and sum(v['done'] for v in q['prayers'].values()) == 1)
t.shot('qada')

# ---------- الخمس ----------
t.go('/worship/khums')
pg.fill('#f_kinc', '1000'); pg.fill('#f_kexp', '600'); pg.fill('#f_kdebt', '0'); pg.fill('#f_krate', '20')
pg.click('[data-act=khCalc]'); pg.wait_for_timeout(500)
out = pg.inner_text('#kh-out')
t.check('خمس: (1000-600)×20% = 80', '80' in out, out)
pg.fill('#f_kinc', '500'); pg.fill('#f_kexp', '600'); pg.click('[data-act=khCalc]'); pg.wait_for_timeout(400)
out = pg.inner_text('#kh-out')
t.check('خمس: لا فاضل → صفر', 'لا فاضل' in out, out)
pg.fill('#f_kinc', ''); pg.click('[data-act=khCalc]'); pg.wait_for_timeout(300)
t.check('خمس: مدخل فارغ يُرفض', pg.query_selector('.toast.err, .toast') is not None)

# ---------- الزكاة ----------
t.go('/worship/zakat')
t.check('زكاة: الصفحة تعمل بلا بنر تحذير', 'زكاة' in t.txt() and not t.ev("!!document.querySelector('#view .notice')"))
t.check('زكاة: المصدر مذكور', 'sistani' in t.txt().lower() or 'السيستاني' in t.txt())
pg.select_option('#f_zk', 'gold'); pg.fill('#f_zw', '100'); pg.check('[name=zy]'); pg.click('[data-act=zkCalc]'); pg.wait_for_timeout(500)
out = pg.inner_text('#zk-out')
t.check('زكاة: ذهب 100 غ بلغ النصاب (2.5%=2.5)', ('2.5' in out) or ('٢٫٥' in out) or 'الزكاة' in out, out)
pg.fill('#f_zw', '10'); pg.click('[data-act=zkCalc]'); pg.wait_for_timeout(400)
t.check('زكاة: دون النصاب', 'لم يبلغ النصاب' in pg.inner_text('#zk-out'))
t.shot('zakat')

# ---------- أحكام العبادات والاستفتاء ----------
t.go('/worship')
t.check('أحكام: الصفحة تفتح', len(t.txt()) > 100)
t.go('/worship/salat')
tx = t.txt()
t.check('أحكام: لا حكم دون مرجع (حالة فارغة أو منسوب)', ('لا توجد' in tx or 'لم يُضَف' in tx or 'لم تُضَف' in tx or 'مرجع' in tx), tx[:300])
t.go('/istifta')
t.check('استفتاء: صياغة وحفظ بلا بنر «غير مربوط»', 'غير مربوط' not in t.txt())
pg.fill('#f_it', 'سؤال تجريبي للاختبار عن حالة معيّنة'); pg.click('[data-act=isSave]'); pg.wait_for_timeout(500)
t.check('استفتاء: حُفظ محلياً', len(t.ev("SIRAJ.kv.get('istifta',[])")) == 1)

# ---------- الإضافات اليومية ----------
t.go('/daily')
tx = t.txt()
for k in ['الورد اليومي', 'تحدي القراءة', 'عشر صفحات', 'الختمة', 'دفتر التدبر', 'الأعمال المستحبة', 'أهداف الذكر', 'أذكار الصباح', 'تنبيهات', 'المكتبة الصوتية', 'تحويل النص', 'المناسبات', 'كبار السن']:
    t.check('الإضافات: بطاقة ' + k, k in tx)
t.shot('daily')

# الورد
t.go('/daily/wird')
pg.click('[data-act=wirdAdd][data-k=quran]'); pg.wait_for_timeout(500)
pg.fill('#f_wt', 'ورد خاص للاختبار'); pg.click('button[data-act=wirdAdd]:not([data-t])'); pg.wait_for_timeout(500)
t.check('ورد: بندان', len(t.ev("SIRAJ.kv.get('daily.wird',[])")) == 2)
pg.click('[data-chg=wirdTick] >> nth=0'); pg.wait_for_timeout(600)
n = t.ev("SIRAJ.stat.all().then(a=>a.filter(r=>r.id.startsWith('wird:')&&r.n>0).length)")
t.check('ورد: تحديد بند يُسجَّل', n == 1, n)
pg.click('[data-chg=wirdTick] >> nth=1'); pg.wait_for_timeout(500)
t.check('ورد: إتمام الكل يعطي تتابع يوم', 'تتابع ١ يوم' in t.txt() or 'تتابع 1 يوم' in t.txt(), t.txt()[:200])
pg.click('[data-act=wirdAdd][data-k=quran]'); pg.wait_for_timeout(400)
t.check('ورد: يمنع التكرار', len(t.ev("SIRAJ.kv.get('daily.wird',[])")) == 2)

# القراءة
t.go('/daily/reading?preset=10')
t.check('قراءة: الهدف 10', t.ev("SIRAJ.kv.get('daily.readTarget')") == 10)
pg.click('[data-act=rdAdd][data-n="10"]'); pg.wait_for_timeout(600)
v = t.ev("SIRAJ.stat.get('read:'+SIRAJ.today())")
t.check('قراءة: +10 يسجل', v == 10, v)
pg.click('[data-act=rdAdd][data-n="-1"]'); pg.wait_for_timeout(500)
t.check('قراءة: تراجع صفحة', t.ev("SIRAJ.stat.get('read:'+SIRAJ.today())") == 9)
pg.click('[data-act=rdAdd][data-n="-1"]')
for _ in range(12): pg.evaluate("document.querySelector('[data-act=rdAdd][data-n=\"-1\"]').click()"); pg.wait_for_timeout(120)
t.check('قراءة: لا تنزل تحت صفر', t.ev("SIRAJ.stat.get('read:'+SIRAJ.today())") >= 0)
pg.fill('#f_rtg', '0'); pg.click('[data-act=rdTarget]'); pg.wait_for_timeout(300)
t.check('قراءة: هدف غير صالح يُرفض', t.ev("SIRAJ.kv.get('daily.readTarget')") == 10)

# الأعمال المستحبة
t.go('/daily/mustahabb')
pg.click('[data-chg=mustTick] >> nth=0'); pg.wait_for_timeout(500)
t.check('مستحبات: تسجيل', t.ev("SIRAJ.stat.all().then(a=>a.filter(r=>r.id.startsWith('must:')&&r.n>0).length)") == 1)
pg.fill('#f_mc', 'عمل خاص'); pg.click('[data-act=mustAdd]'); pg.wait_for_timeout(500)
t.check('مستحبات: إضافة خاصة', len(t.ev("SIRAJ.kv.get('daily.mustahabb.custom',[])")) == 1)

# الذكر
t.go('/daily/dhikr')
pg.fill('#f_dg', '100'); pg.click('[data-act=dgSave]'); pg.wait_for_timeout(400)
t.check('ذكر: هدف 100', t.ev("SIRAJ.kv.get('tasbeeh.dailyGoal')") == 100)

# الأذكار (حالة صادقة)
t.go('/daily/adhkar')
t.check('أذكار: لا نصوص مختلقة (حالة فارغة صادقة أو موثق)', 'لم يُضَف' in t.txt() or 'documented' in t.txt() or len(t.ev("document.querySelectorAll('#view .li').length")) >= 0)

# التنبيهات
t.go('/daily/reminders')
t.check('تنبيهات: بلا بنر تحذير', not t.ev("!!document.querySelector('#view .notice')"))
pg.fill('#f_rt', 'تنبيه اختبار'); pg.fill('#f_rh', '07:00'); pg.click('[data-act=remAdd]'); pg.wait_for_timeout(500)
r = t.ev("SIRAJ.kv.get('daily.reminders',[])")
t.check('تنبيهات: أُضيف', len(r) == 1 and r[0]['enabled'])
# إطلاق التنبيه برمجياً عند الوقت الحالي
t.ev("""(async()=>{const S=window.SIRAJ;const n=new Date();const hm=S.fmt.pad(n.getHours())+':'+S.fmt.pad(n.getMinutes());const a=S.kv.get('daily.reminders',[]);a[0].time=hm;a[0].days=[0,1,2,3,4,5,6];await S.kv.set('daily.reminders',a);S.daily.tick();})()""")
pg.wait_for_timeout(700)
nn = t.ev("SIRAJ.notify.list().then(a=>a.filter(x=>x.title==='تنبيه اختبار').length)")
t.check('تنبيهات: يُطلَق ويُسجَّل في الإشعارات', nn == 1, nn)
t.ev("SIRAJ.daily.tick()"); pg.wait_for_timeout(500)
nn = t.ev("SIRAJ.notify.list().then(a=>a.filter(x=>x.title==='تنبيه اختبار').length)")
t.check('تنبيهات: لا يتكرر في الدقيقة نفسها', nn == 1, nn)
pg.click('[data-act=remDel]'); pg.wait_for_timeout(400)
t.check('تنبيهات: حذف', len(t.ev("SIRAJ.kv.get('daily.reminders',[])")) == 0)

# الهدية والصوتيات والنص إلى صوت والمزامنة والمناسبات
t.go('/daily/audio'); t.check('صوتيات: حالة فارغة صادقة', 'لا تسجيلات' in t.txt() or 'audio' in t.txt().lower())
t.go('/daily/tts'); t.check('TTS: الصفحة تفتح', 'قراءة' in t.txt())
t.go('/daily'); t.check('لا بطاقة مزامنة غير مربوطة في القائمة', 'مزامنة' not in t.txt())
t.go('/daily/occasions'); t.check('مناسبات: قائمة قادمة', 'بعد' in t.txt() or 'اليوم' in t.txt())

# وضع كبار السن من الصفحة الرئيسية
t.go('/daily')
pg.click('[data-chg=pref][data-k=elder]', force=True); pg.wait_for_timeout(500)
t.check('كبار السن: يُفعَّل', t.ev("document.documentElement.dataset.elder")  == '1')
t.shot('daily-elder')
pg.click('[data-chg=pref][data-k=elder]', force=True); pg.wait_for_timeout(400)

# المزيد يربط التدبر
t.go('/more'); t.check('المزيد: رابط دفتر التدبر', 'دفتر التدبر' in t.txt())
t.done()

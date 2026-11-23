"""قواعد التوثيق في شاشة المداخل بتطبيق التحكم (نُقلت من اختبار الموسوعة بعد جعل سِراج للقراءة فقط):
لا مدخل بلا مصدر • مصدر بلا موضع • حكم عالم بلا مصدر • آية غير صالحة • لفظ بلا مصدر • قول بلا قائل ومصدر — والمقبول يصير «جاهز» فقط بعد الاجتياز."""
import os, subprocess
from common import T, ROOT
WWW = '/tmp/ctl-www-entries'
subprocess.run(['node', os.path.join(ROOT, 'scripts', 'prepare-control.mjs'), '--out', WWW], check=True, capture_output=True)
t = T(root=WWW); pg = t.pg
errs = lambda: t.ev("document.getElementById('ent-errs').innerText")
cnt = lambda: t.ev("SIRAJ.db.all('entries').then(a=>a.length)")
def src(i, book='الكافي', page='12', author='الكليني'):
    pg.evaluate("(i)=>{while(document.querySelectorAll('[data-rows=sources] [data-row]').length<=i)document.querySelector('[data-act=rowAdd][data-name=sources]').click();}", i)
    row = pg.locator('[data-rows=sources] [data-row]').nth(i)
    row.locator('[data-k=book]').fill(book); row.locator('[data-k=author]').fill(author); row.locator('[data-k=page]').fill(page)

t.go('/entries'); tx = t.txt(); t.check('كل مجموعات المداخل الـ13 مدرجة', t.ev("document.querySelectorAll('a.li').length") == 13, tx[:100])
# ----- رواية
t.go('/entry/narrations/new'); pg.fill('[name=title]', 'رواية اختبار'); pg.fill('[name=text]', 'نص اختباري وهمي للرواية'); pg.check('[name=ready]')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(600)
t.check('بلا مصدر: لا يصير جاهزاً ويُحفظ مسودة', 'لا يُحفظ مدخل بلا مصدر' in errs() and cnt() == 1 and t.ev("SIRAJ.db.all('entries').then(a=>a[0].ready)") is False, errs())
eid = t.ev("SIRAJ.db.all('entries').then(a=>a[0].id)")
pg.locator('[data-rows=sources] [data-row] [data-k=book]').first.fill('الكافي'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(500)
t.check('مصدر بلا جزء/صفحة/رقم/رابط مرفوض', 'حدّد جزءاً أو صفحة' in errs())
pg.locator('[data-rows=sources] [data-row] [data-k=page]').first.fill('45')
pg.click('[data-act=rowAdd][data-name=rulings]'); pg.locator('[data-rows=rulings] [data-row] [data-k=scholar]').first.fill('عالم اختباري'); pg.locator('[data-rows=rulings] [data-row] [data-k=ruling]').first.fill('قول منسوب')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(500)
t.check('حكم عالم بلا مصدر مرفوض', 'اذكر مصدر الحكم' in errs())
pg.locator('[data-rows=rulings] [data-row] [data-k=source]').first.fill('كتاب الرجال ص 9')
pg.fill('[name=verses]', '2:999'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(500)
t.check('آية خارج السورة مرفوضة', 'آية غير صالحة' in errs())
pg.fill('[name=verses]', '33:33، 2:255')
pg.click('[data-act=rowAdd][data-name=variants]'); pg.locator('[data-rows=variants] [data-row] [data-k=text]').first.fill('لفظ آخر للاختبار')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(500)
t.check('لفظ بلا مصدر مرفوض', 'اذكر مصدر هذا اللفظ' in errs())
pg.locator('[data-rows=variants] [data-row] [data-k=source]').first.fill('الأمالي ص 3')
pg.click('[data-act=rowAdd][data-name=isnads]'); pg.locator('[data-rows=isnads] [data-k=line]').first.fill('أ عن ب عن ج')
src(1, 'الأمالي', '3', 'المفيد')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(1200)
e = t.ev("SIRAJ.db.all('entries')")
t.check('بعد الاستيفاء: حُفظ مدخل واحد (بلا تكرار) وصار جاهزاً', len(e) == 1 and e[0]['ready'] is True and e[0]['id'] == eid, e)
t.check('البيانات: مصدران، آيتان بصيغة موحّدة، سند ولفظ وحكم منسوب', len(e[0]['sources']) == 2 and e[0]['verses'] == ['33:33', '2:255'] and e[0]['isnads'] == ['أ عن ب عن ج'] and e[0]['variants'][0]['source'] == 'الأمالي ص 3' and e[0]['scholarRulings'][0]['scholar'] == 'عالم اختباري', e[0])
t.check('بعد النجاح يعود لقائمة المجموعة', '/entries/narrations' in pg.url, pg.url)
# ----- تعديل: يبقى جاهزاً إن صحّ، ويسقط إلى مسودة إن حُذف المصدر
t.go(f'/entry/narrations/{eid}'); pg.fill('[name=title]', 'رواية اختبار معدّلة'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(900)
e = t.ev("SIRAJ.db.all('entries')"); t.check('التعديل لا ينشئ نسخة ويحافظ على «جاهز»', len(e) == 1 and e[0]['title'] == 'رواية اختبار معدّلة' and e[0]['ready'] is True)
t.go(f'/entry/narrations/{eid}'); pg.click('[data-act=rowDel] >> nth=0'); pg.click('[data-act=rowDel] >> nth=0'); pg.wait_for_timeout(200)
t.ev("document.querySelectorAll('[data-rows=sources] [data-row]').forEach(r=>r.remove())"); pg.click('[data-act=entSave]'); pg.wait_for_timeout(700)
e = t.ev("SIRAJ.db.all('entries')"); t.check('حذف كل المصادر يُسقط المدخل إلى «مسودة»', e[0]['ready'] is False and 'بلا مصدر' in errs(), errs())
# ----- تفسير: آية مطلوبة
t.go('/entry/tafsir/new'); pg.fill('[name=title]', 'تفسير'); pg.fill('[name=text]', 'مقتطف'); pg.fill('[name=x_mufassir]', 'م'); src(0, 'تفسير', '1', ''); pg.check('[name=ready]'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(600)
t.check('التفسير بلا آية لا يصير جاهزاً', 'رقم الآية مطلوب' in errs() and t.ev("SIRAJ.db.all('entries').then(a=>a.filter(x=>x.collection==='tafsir').every(x=>!x.ready))"))
# ----- أقوال المسألة
t.go('/entry/discussions/new'); pg.fill('[name=title]', 'مسألة'); pg.fill('[name=text]', 'عرض المسألة'); src(0, 'كتاب', '4', '')
pg.click('[data-act=rowAdd][data-name=positions]'); pg.locator('[data-rows=positions] [data-row] [data-k=holder]').first.fill('مدرسة ما'); pg.locator('[data-rows=positions] [data-row] [data-k=view]').first.fill('قول')
pg.check('[name=ready]'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(600)
t.check('قول بلا مصدر مرفوض', 'القائل والقول ومصدره' in errs())
# ----- حدث: السنة الهجرية المعقولة
t.go('/entry/events/new'); pg.fill('[name=title]', 'حدث'); pg.fill('[name=text]', 'وصف'); pg.fill('[name=x_year]', '99999'); src(0, 'مصدر', '2', ''); pg.check('[name=ready]'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(600)
t.check('سنة هجرية غير معقولة مرفوضة', 'السنة الهجرية غير معقولة' in errs())
# ----- صفحة الإصدار: لا تحسب إلا الجاهز
t.go('/publish'); t.check('العدّاد يحسب الجاهز فقط (0) والمسودات خارج الحزمة', 'مسودات خارج الحزمة' in t.txt(), t.txt()[:250])
t.shot('ctl_entry_errors')
t.done()

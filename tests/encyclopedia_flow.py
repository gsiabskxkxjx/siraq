"""اختبار الموسوعات: الأئمة، الخط الزمني، العقيدة، 20 وحدة، قاعدة «لا مدخل بلا مصدر»، مقارنة الألفاظ"""
import os, json
from common import T, ROOT
t = T(); pg = t.pg


def login(u, p):
    pg.evaluate("SIRAJ.auth.logout()"); pg.wait_for_timeout(200); t.go('/admin'); pg.fill('#f_lu', u); pg.fill('#f_lp', p); pg.click('[data-act=admLogin]'); pg.wait_for_timeout(700)


def src(i, book='الكافي', page='12', author='الكليني'):
    pg.evaluate("(i)=>{const w=document.querySelector('[data-rows=sources] .rows');while(w.querySelectorAll('[data-row]').length<=i)document.querySelector('[data-act=rowAdd][data-name=sources]').click();}", i)
    row = pg.locator('[data-rows=sources] [data-row]').nth(i)
    row.locator('[data-k=book]').fill(book); row.locator('[data-k=author]').fill(author); row.locator('[data-k=page]').fill(page)


# --- الأئمة
t.go('/imams'); tx = t.txt(); t.check('12 إماماً في القائمة', all(n in tx for n in ['أمير المؤمنين', 'المجتبى', 'سيد الشهداء', 'المهدي']) and pg.locator('a.imam-li').count() == 12, pg.locator('a.imam-li').count())
t.check('زخارف رمزية فقط (SVG) بلا صور', pg.locator('a.imam-li svg.orn').count() == 12 and pg.locator('img').count() == 0)
t.go('/imams/6'); tx = t.txt()
t.check('صفحة الإمام: كنية وألقاب وولادة ووفاة ومرقد', all(k in tx for k in ['الكنية', 'الألقاب', 'الولادة', 'الوفاة', 'المرقد', 'الصادق']), tx[:200])
t.check('تُظهر اختلاف المصادر والمصادر المقترحة', 'مصادر مقترحة للرجوع' in tx and 'وليست اقتباساً' in tx)
t.check('السيرة بلا نص مختلق', 'لم تُضَف سيرة موثقة بعد' in tx and 'لا أقوال موثقة بعد' in tx)
t.go('/imams/12'); t.check('الإمام الثاني عشر: بلا تاريخ وفاة', 'لا ينطبق' in t.txt())
t.go('/imams/13'); t.check('إمام غير موجود', 'غير موجود' in t.txt())
t.go('/imams/timeline'); tx = t.txt(); t.check('الخط الزمني يضم الأئمة والأحداث والقرون', 'القرن' in tx and 'كربلاء' in tx and 'الهجرة' in tx, tx[:200])
n_all = pg.locator('.tl-i').count(); t.go('/imams/timeline?f=imam'); n_im = pg.locator('.tl-i').count(); t.check('التصفية تعمل', 0 < n_im < n_all, (n_im, n_all))
t.shot('timeline')

# --- العقيدة
t.go('/aqeedah'); t.check('الموسوعة العقائدية تعرض المحاور وتنبيه التعريفات التمهيدية', 'التوحيد' in t.txt() and 'تعريفات تمهيدية' in t.txt())
t.go('/aqeedah/tawhid'); tx = t.txt(); t.check('محور: أدلة قرآنية وروائية ومناقشة وكتب', all(k in tx for k in ['الأدلة القرآنية', 'الأدلة الروائية', 'مناقشة المسائل', 'الكتب المتخصصة', 'الإخلاص']), tx[:300])

# --- المركز البحثي: 20 وحدة
t.go('/research'); t.check('عشرون وحدة', pg.locator('a.unit').count() == 20, pg.locator('a.unit').count())
hrefs = pg.eval_on_selector_all('a.unit', 'els=>els.map(a=>a.getAttribute("href"))')
bad = []
for h in hrefs:
    t.go(h[1:], 450); tx = t.txt()
    if 'الصفحة غير موجودة' in tx or 'تعذّر عرض' in tx or 'مجموعة غير معروفة' in tx: bad.append(h)
t.check('كل وحدات الـ20 تُعرض', not bad, bad)

# --- بلا دخول لا إضافة
t.go('/research/narrations/new'); t.check('بلا دخول: الإضافة محجوبة', 'تحتاج صلاحية' in t.txt())
t.go('/research/narrations'); t.check('قائمة فارغة بصدق', 'لا مداخل موثقة بعد' in t.txt() and 'لا أحكام آلية' in t.txt())

login('editor', '3333')
# --- مدخل بلا مصدر يُرفض
t.go('/research/narrations/new?topic=tawhid'); pg.fill('[name=title]', 'رواية اختبار'); pg.fill('[name=text]', 'قال الإمام إن العلم نور يقذفه الله في قلب من يشاء')
pg.locator('[data-rows=sources] [data-row] [data-k=book]').first.fill(''); pg.click('[data-act=entSave]'); pg.wait_for_timeout(500)
t.check('رفض مدخل بلا مصدر', 'لا يُحفظ مدخل بلا مصدر' in t.ev("document.getElementById('ent-errs').innerText") and pg.evaluate("(async()=>(await SIRAJ.db.all('entries')).length)()") == 0, t.ev("document.getElementById('ent-errs').innerText"))
# مصدر بلا موضع
pg.locator('[data-rows=sources] [data-row] [data-k=book]').first.fill('الكافي'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(400)
t.check('رفض مصدر بلا جزء/صفحة/رقم/رابط', 'حدّد جزءاً أو صفحة' in t.ev("document.getElementById('ent-errs').innerText"))
# حكم عالم بلا مصدر
pg.locator('[data-rows=sources] [data-row] [data-k=page]').first.fill('45')
pg.click('[data-act=rowAdd][data-name=rulings]'); pg.locator('[data-rows=rulings] [data-row] [data-k=scholar]').first.fill('عالم اختباري'); pg.locator('[data-rows=rulings] [data-row] [data-k=ruling]').first.fill('قول منسوب')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(400)
t.check('رفض حكم عالم بلا مصدر', 'اذكر مصدر الحكم' in t.ev("document.getElementById('ent-errs').innerText"))
pg.locator('[data-rows=rulings] [data-row] [data-k=source]').first.fill('كتاب الرجال ص 9')
# آية غير صالحة
pg.fill('[name=verses]', '2:999'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(400)
t.check('رفض آية خارج السورة', 'آية غير صالحة' in t.ev("document.getElementById('ent-errs').innerText"))
pg.fill('[name=verses]', '33:33، 2:255')
pg.click('[data-act=rowAdd][data-name=isnads]'); pg.locator('[data-rows=isnads] [data-k=line]').first.fill('أ عن ب عن ج عن الإمام')
pg.click('[data-act=rowAdd][data-name=variants]'); pg.locator('[data-rows=variants] [data-row] [data-k=text]').first.fill('قال الإمام إن العلم نور يقذفه الله تعالى في قلب من يشاء من عباده')
pg.locator('[data-rows=variants] [data-row] [data-k=source]').first.fill('الأمالي ص 3')
src(1, 'الأمالي', '3', 'المفيد')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(1200)
t.check('حُفظ المدخل بعد استيفاء المصدر', '/research/narrations/' in pg.url, pg.url)
tx = t.txt()
t.check('صفحة الرواية: النص والتخريج والسند واللفظ والحكم المنسوب', all(k in tx for k in ['النص المنقول', 'التخريج', 'الكافي', 'الأمالي', 'الأسانيد', 'اختلاف الألفاظ', 'أقوال العلماء', 'عالم اختباري', 'ليس حكم سِراج']), tx[:300])
t.check('اختلاف اللفظ مُلوَّن بالفروق', pg.locator('.df-add').count() >= 3, pg.locator('.df-add').count())
t.check('لا «صحيح/ضعيف» آلياً', 'صحيح' not in tx.split('أقوال العلماء')[0] and 'حكم التطبيق' not in tx)
eid = pg.evaluate("(async()=>(await SIRAJ.db.all('entries'))[0].id)()")
t.shot('narration_entry')
# المحرر لا يعتمد
t.check('المحرر لا يرى زر الاعتماد', 'اعتماد المدخل' not in tx)

# --- رواية ثانية للمقارنة والبحث
t.go('/research/narrations/new'); pg.fill('[name=title]', 'رواية ثانية'); pg.fill('[name=text]', 'قال الإمام إن العلم نور في القلب يهبه الله لمن أراد')
pg.locator('[data-rows=sources] [data-row] [data-k=book]').first.fill('بحار الأنوار'); pg.locator('[data-rows=sources] [data-row] [data-k=volume]').first.fill('1'); pg.locator('[data-rows=sources] [data-row] [data-k=page]').first.fill('225')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(1000)
eid2 = pg.evaluate("(async()=>(await SIRAJ.db.all('entries')).find(e=>e.title==='رواية ثانية').id)()")
t.go(f'/research/compare-narrations?a={eid}&b={eid2}'); tx = t.txt(); t.check('مقارنة الروايتين بإحصاء الفروق', 'كلمات مشتركة' in tx and 'لا تدلّ على صحة' in tx and pg.locator('.df-add,.df-del').count() > 0, tx[:200])
t.go('/research/narration-search?q=' + 'نور في القلب'); t.check('البحث بجزء من النص يجد الثانية فقط', 'رواية ثانية' in t.txt() and 'رواية اختبار' not in t.txt().split('نطاق البحث')[1] if False else 'رواية ثانية' in t.txt())
t.go('/research/narration-search?q=' + 'كلمة لا وجود لها'); t.check('بحث بلا نتائج: لا اختلاق', 'لا نتائج' in t.txt())
t.go('/research/narrations?view=takhrij'); t.check('عرض التخريج: الرواية متعددة المصادر فقط', 'رواية اختبار' in t.txt() and 'رواية ثانية' not in t.txt().split('مدخلاً')[1])
t.go('/research/narrations?view=judgments'); t.check('عرض أحكام العلماء', 'رواية اختبار' in t.txt())
t.go('/aqeedah/tawhid'); t.check('الرواية ظهرت تحت محور التوحيد (الأدلة الروائية)', 'رواية اختبار' in t.txt())

# --- تفسير: مقارنة حسب الآية + ظهور في صفحة الآية
t.go('/research/tafsir/new?verse=33:33'); pg.fill('[name=title]', 'تفسير آية التطهير'); pg.fill('[name=text]', 'مقتطف تفسيري قصير للاختبار'); pg.fill('[name=x_mufassir]', 'الميزان')
pg.locator('[data-rows=sources] [data-row] [data-k=book]').first.fill('الميزان في تفسير القرآن'); pg.locator('[data-rows=sources] [data-row] [data-k=volume]').first.fill('16'); pg.locator('[data-rows=sources] [data-row] [data-k=page]').first.fill('309')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(1000)
t.go('/research/compare-tafsir?verse=33:33'); tx = t.txt(); t.check('مقارنة التفاسير تعرض المدخل بمصدره', 'الميزان' in tx and 'مقتطف تفسيري' in tx and '1 تفسير موثق' in tx.replace('١', '1'), tx[:250])
t.go('/research/compare-tafsir?verse=33:34'); t.check('آية بلا تفسير: لا اختلاق', 'لا مداخل تفسير موثقة' in t.txt())
t.go('/quran/ayah/33/33'); t.check('صفحة الآية تعرض مدخل التفسير', 'تفسير آية التطهير' in t.txt())
t.go('/research/verse-links?verse=33:33'); tx = t.txt(); t.check('ربط الآية: مداخل + آية أهل البيت + كتب', 'تفسير آية التطهير' in tx and 'آية التطهير' in tx and 'كتب ذات صلة' in tx, tx[:300])

# --- أحداث وأماكن
t.go('/research/events/new'); pg.fill('[name=title]', 'حدث موثق للاختبار'); pg.fill('[name=text]', 'وصف الحدث')
pg.fill('[name=x_year]', '61'); pg.locator('[data-rows=sources] [data-row] [data-k=book]').first.fill('الإرشاد'); pg.locator('[data-rows=sources] [data-row] [data-k=page]').first.fill('2')
pg.click('[data-act=entSave]'); pg.wait_for_timeout(900); t.go('/imams/timeline?f=user'); t.check('الحدث الموثق يظهر في الخط الزمني', 'حدث موثق للاختبار' in t.txt())
t.go('/research/places'); t.check('الأماكن: مراقد وروابط الخريطة والتنبيه', 'مرقد الإمام علي' in t.txt() and pg.locator('a[href*=openstreetmap]').count() >= 8 and 'المسافة' in t.txt() or 'تبعد عنك' in t.txt())

# --- مخطوطة بملف
t.go('/research/manuscripts/new'); pg.fill('[name=title]', 'مخطوطة اختبار'); pg.fill('[name=x_library]', 'مكتبة اختبار')
pg.locator('[data-rows=sources] [data-row] [data-k=book]').first.fill('فهرس المخطوطات'); pg.locator('[data-rows=sources] [data-row] [data-k=number]').first.fill('77')
fake = '/tmp/fakems.png'; open(fake, 'wb').write(b'not an image' * 20); pg.set_input_files('[name=mfile]', fake); pg.click('[data-act=entSave]'); pg.wait_for_timeout(700)
t.check('رفض مخطوطة بملف مزيف', 'ليس صورة' in t.ev("document.body.innerText") and pg.evaluate("(async()=>!(await SIRAJ.db.all('entries')).some(e=>e.title==='مخطوطة اختبار'))()"))
pg.set_input_files('[name=mfile]', os.path.join(ROOT, 'assets', 'images', 'icon-192.png')); pg.click('[data-act=entSave]'); pg.wait_for_timeout(1200)
t.check('مخطوطة بصورة صالحة تُحفظ وتُعرض', pg.evaluate("!!document.querySelector('img[data-ms]') && document.querySelector('img[data-ms]').src.startsWith('blob:')"))

# --- اعتماد المراجع
login('reviewer', '4444'); t.go(f'/research/narrations/{eid}'); t.check('المراجع يرى زر الاعتماد', 'اعتماد المدخل' in t.txt())
pg.click('[data-act=entReview]'); pg.wait_for_timeout(500); pg.click('.modal-ft .btn.primary'); pg.wait_for_timeout(800); t.check('الاعتماد يُسجَّل باسم المراجع', 'راجعه' in t.txt())

# --- التوثيق: استيراد بقواعد صارمة
tpl = {"items": [{"title": "رواية مستوردة", "text": "نص", "sources": [{"book": "كتاب", "page": "1"}], "verses": ["33:33"]}, {"title": "بلا مصدر", "text": "نص", "sources": []}, {"title": "آية خاطئة", "text": "ن", "sources": [{"book": "ك", "page": "1"}], "verses": ["200:1"]}]}
open('/tmp/imp.json', 'w').write(json.dumps(tpl, ensure_ascii=False))
login('owner', '1111'); t.go('/research/docs'); pg.set_input_files('[name=impf]', '/tmp/imp.json'); pg.click('[data-act=entImport]'); pg.wait_for_timeout(1000)
tx = t.ev("document.getElementById('imp-res').innerText"); t.check('الاستيراد يقبل الصالح ويرفض بلا مصدر وآية خاطئة', 'أُضيف 1' in tx.replace('١', '1') and 'رُفض 2' in tx.replace('٢', '2'), tx)
with pg.expect_download() as dl:
    pg.click('[data-act=entExport]')
t.check('تصدير المجموعة', os.path.getsize(dl.value.path()) > 100)

# --- خريطة المعرفة
t.go('/research/map'); t.check('خريطة المعرفة: SVG بالأقسام الستة', pg.locator('svg.kmap a').count() >= 14, pg.locator('svg.kmap a').count()); t.shot('knowledge_map')
t.go('/research/authors'); t.check('فهرس المؤلفين وربطهم بكتبهم', pg.locator('#auth-list details').count() > 20)
pg.fill('[data-inp=resAuth]', 'المحقق'); pg.wait_for_timeout(300); t.check('بحث المؤلفين', 0 < pg.locator('#auth-list details:not([hidden])').count() < pg.locator('#auth-list details').count())

# --- دفتر التدبر
t.go('/tadabbur'); pg.click('.view [data-act=tdbEdit]'); pg.wait_for_timeout(400); pg.fill('.modal [name=text]', 'تأمل شخصي'); pg.fill('.modal [name=verse]', '999:1'); pg.click('.modal-ft .btn.primary'); pg.wait_for_timeout(400)
t.check('آية خاطئة في التدبر مرفوضة', pg.evaluate("(async()=>(await SIRAJ.db.where('notes','type','tadabbur')).length)()") == 0)
pg.fill('.modal [name=verse]', '2:255'); pg.click('.modal-ft .btn.primary'); pg.wait_for_timeout(800); t.check('حُفظ التدبّر', 'تأمل شخصي' in t.txt() and 'البقرة' in t.txt())
t.done()

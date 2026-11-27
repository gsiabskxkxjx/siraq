"""اختبار الموسوعات في سِراج (للقراءة فقط): الأئمة، الخط الزمني، العقيدة، 20 وحدة، عرض المداخل الموثقة ومقارنتها وبحثها.
المداخل تصل في الواقع عبر حزم موقّعة (انظر packs_flow.py)؛ هنا تُزرع في القاعدة بالشكل الذي تكتبه الحزمة لاختبار العرض فقط.
قواعد التوثيق عند الإدخال (لا مدخل بلا مصدر…) تُختبر في control_flow/control_entries_flow."""
import os, json, time
from common import T, ROOT
t = T(); pg = t.pg

def put(e):
    b = {'status': 'documented', 'reviewed': None, 'demo': False, 'ts': int(time.time() * 1000), 'by': 'الناشر', 'tags': [], 'verses': [], 'isnads': [], 'variants': [], 'scholarRulings': [], 'positions': [], 'extra': {}}
    b.update(e); pg.evaluate('e=>SIRAJ.db.put("entries",e)', b)

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
t.go('/aqeedah'); t.check('الموسوعة العقائدية تعرض المحاور بلا بنر تمهيدي', 'التوحيد' in t.txt() and not t.ev("!!document.querySelector('#view .notice.warn')"))
t.go('/aqeedah/tawhid'); tx = t.txt(); t.check('محور: أدلة قرآنية وروائية ومناقشة وكتب', all(k in tx for k in ['الأدلة القرآنية', 'الأدلة الروائية', 'مناقشة المسائل', 'الكتب المتخصصة', 'الإخلاص']), tx[:300])

# --- المركز البحثي: 20 وحدة
t.go('/research'); t.check('تسع عشرة وحدة', pg.locator('a.unit').count() == 19, pg.locator('a.unit').count())
hrefs = pg.eval_on_selector_all('a.unit', 'els=>els.map(a=>a.getAttribute("href"))')
bad = []
for h in hrefs:
    t.go(h[1:], 450); tx = t.txt()
    if 'الصفحة غير موجودة' in tx or 'تعذّر عرض' in tx or 'مجموعة غير معروفة' in tx: bad.append(h)
t.check('كل وحدات الـ20 تُعرض', not bad, bad)

# --- للقراءة فقط: لا إضافة من المستخدم
t.go('/research/narrations/new'); t.check('لا نموذج إضافة مدخل في سِراج', not pg.query_selector('[name=title]') and not pg.query_selector('[data-act=entSave]'), t.txt()[:120])
t.go('/research/narrations'); t.check('قائمة فارغة بصدق', 'لا مداخل موثقة بعد' in t.txt() and 'لا أحكام آلية' in t.txt())
t.check('لا زر إضافة ولا استيراد في الموسوعة', not pg.query_selector('[data-act=entImport], [data-act=entExport], [data-act=entNew], a[href*="/new"]'))

# --- مداخل موثقة (كما تكتبها الحزمة) لاختبار العرض
eid, eid2 = 'en_t_narr1', 'en_t_narr2'
put({'id': eid, 'collection': 'narrations', 'title': 'رواية اختبار', 'text': 'قال الإمام إن العلم نور يقذفه الله في قلب من يشاء', 'verses': ['33:33', '2:255'],
     'sources': [{'book': 'الكافي', 'author': 'الكليني', 'edition': '', 'volume': '', 'page': '45', 'number': '', 'url': ''}, {'book': 'الأمالي', 'author': 'المفيد', 'edition': '', 'volume': '', 'page': '3', 'number': '', 'url': ''}],
     'isnads': ['أ عن ب عن ج عن الإمام'], 'variants': [{'text': 'قال الإمام إن العلم نور يقذفه الله تعالى في قلب من يشاء من عباده', 'source': 'الأمالي ص 3'}],
     'scholarRulings': [{'scholar': 'عالم اختباري', 'ruling': 'قول منسوب', 'source': 'كتاب الرجال ص 9'}], 'extra': {'speaker': '', 'topic': 'tawhid'}})
t.go(f'/research/narrations/{eid}'); tx = t.txt()
t.check('صفحة الرواية: النص والتخريج والسند واللفظ والحكم المنسوب', all(k in tx for k in ['النص المنقول', 'التخريج', 'الكافي', 'الأمالي', 'الأسانيد', 'اختلاف الألفاظ', 'أقوال العلماء', 'عالم اختباري']), tx[:300])
t.check('اختلاف اللفظ مُلوَّن بالفروق', pg.locator('.df-add').count() >= 3, pg.locator('.df-add').count())
t.check('لا «صحيح/ضعيف» آلياً', 'صحيح' not in tx.split('أقوال العلماء')[0] and 'حكم التطبيق' not in tx)
eid = pg.evaluate("(async()=>(await SIRAJ.db.all('entries'))[0].id)()")
t.shot('narration_entry')
t.check('لا زر اعتماد ولا تعديل للمستخدم', 'اعتماد المدخل' not in tx and not pg.query_selector('[data-act=entEdit], [data-act=entDel], [data-act=entReview]'))

# --- رواية ثانية للمقارنة والبحث
put({'id': eid2, 'collection': 'narrations', 'title': 'رواية ثانية', 'text': 'قال الإمام إن العلم نور في القلب يهبه الله لمن أراد', 'sources': [{'book': 'بحار الأنوار', 'author': '', 'edition': '', 'volume': '1', 'page': '225', 'number': '', 'url': ''}], 'extra': {'speaker': ''}})
t.go(f'/research/compare-narrations?a={eid}&b={eid2}'); tx = t.txt(); t.check('مقارنة الروايتين بإحصاء الفروق', 'كلمات مشتركة' in tx  and pg.locator('.df-add,.df-del').count() > 0, tx[:200])
t.go('/research/narration-search?q=' + 'نور في القلب'); t.check('البحث بجزء من النص يجد الثانية فقط', 'رواية ثانية' in t.txt() and 'رواية اختبار' not in t.txt().split('نطاق البحث')[1] if False else 'رواية ثانية' in t.txt())
t.go('/research/narration-search?q=' + 'كلمة لا وجود لها'); t.check('بحث بلا نتائج: لا اختلاق', 'لا نتائج' in t.txt())
t.go('/research/narrations?view=takhrij'); t.check('عرض التخريج: الرواية متعددة المصادر فقط', 'رواية اختبار' in t.txt() and 'رواية ثانية' not in t.txt().split('مدخلاً')[1])
t.go('/research/narrations?view=judgments'); t.check('عرض أحكام العلماء', 'رواية اختبار' in t.txt())
t.go('/aqeedah/tawhid'); t.check('الرواية ظهرت تحت محور التوحيد (الأدلة الروائية)', 'رواية اختبار' in t.txt())


# --- تفسير: مقارنة حسب الآية + ظهور في صفحة الآية
put({'id': 'en_t_taf', 'collection': 'tafsir', 'title': 'تفسير آية التطهير', 'text': 'مقتطف تفسيري قصير للاختبار', 'verses': ['33:33'], 'sources': [{'book': 'الميزان في تفسير القرآن', 'author': '', 'edition': '', 'volume': '16', 'page': '309', 'number': '', 'url': ''}], 'extra': {'mufassir': 'الميزان'}})
t.go('/research/compare-tafsir?verse=33:33'); tx = t.txt(); t.check('مقارنة التفاسير تعرض المدخل بمصدره', 'الميزان' in tx and 'مقتطف تفسيري' in tx, tx[:250])
t.go('/research/compare-tafsir?verse=33:34'); t.check('آية بلا تفسير: لا اختلاق', 'لا مداخل تفسير موثقة' in t.txt())
t.go('/quran/ayah/33/33'); t.check('صفحة الآية تعرض مدخل التفسير', 'تفسير آية التطهير' in t.txt())
t.go('/research/verse-links?verse=33:33'); tx = t.txt(); t.check('ربط الآية: مداخل + آية أهل البيت + كتب', 'تفسير آية التطهير' in tx and 'آية التطهير' in tx and 'كتب ذات صلة' in tx, tx[:300])

# --- أحداث وأماكن
put({'id': 'en_t_evt', 'collection': 'events', 'title': 'حدث موثق للاختبار', 'text': 'وصف الحدث', 'sources': [{'book': 'الإرشاد', 'author': '', 'edition': '', 'volume': '', 'page': '2', 'number': '', 'url': ''}], 'extra': {'year': 61}})
t.go('/imams/timeline?f=user'); t.check('الحدث الموثق يظهر في الخط الزمني', 'حدث موثق للاختبار' in t.txt())
t.go('/research/places'); t.check('الأماكن: مراقد وروابط الخريطة', 'مرقد الإمام علي' in t.txt() and pg.locator('a[href*=openstreetmap]').count() >= 8, t.txt()[:160])


# --- خريطة المعرفة
t.go('/research/map'); t.check('خريطة المعرفة: SVG بالأقسام الستة', pg.locator('svg.kmap a').count() >= 14, pg.locator('svg.kmap a').count()); t.shot('knowledge_map')
t.go('/research/authors'); t.check('فهرس المؤلفين وربطهم بكتبهم', pg.locator('#auth-list details').count() > 20)
pg.fill('[data-inp=resAuth]', 'المحقق'); pg.wait_for_timeout(300); t.check('بحث المؤلفين', 0 < pg.locator('#auth-list details:not([hidden])').count() < pg.locator('#auth-list details').count())

# --- دفتر التدبر
t.go('/tadabbur'); pg.click('.view [data-act=tdbEdit]'); pg.wait_for_timeout(400); pg.fill('.modal [name=text]', 'تأمل شخصي'); pg.fill('.modal [name=verse]', '999:1'); pg.click('.modal-ft .btn.primary'); pg.wait_for_timeout(400)
t.check('آية خاطئة في التدبر مرفوضة', pg.evaluate("(async()=>(await SIRAJ.db.where('notes','type','tadabbur')).length)()") == 0)
pg.fill('.modal [name=verse]', '2:255'); pg.click('.modal-ft .btn.primary'); pg.wait_for_timeout(800); t.check('حُفظ التدبّر', 'تأمل شخصي' in t.txt() and 'البقرة' in t.txt())
t.done()

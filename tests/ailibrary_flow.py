"""اختبار SIRAJ AI LIBRARY بمحاكاة استجابات archive.org (لا اتصال حقيقي) + إدخال يدوي + فهرس PDF"""
import os, json
from common import T, ROOT

SEARCH = {"response": {"docs": [
    {"identifier": "test-item-one", "title": "شرح اللمعة الدمشقية - كتاب اختبار", "creator": "مؤلف تجريبي", "year": 1999, "language": ["ara"], "licenseurl": "https://creativecommons.org/publicdomain/zero/1.0/"},
    {"identifier": "test-item-two", "title": "Dictionary of Test Terms", "creator": "A. Tester", "year": 2001, "language": ["eng"]}]}}
META = {"metadata": {"identifier": "test-item-one", "title": "شرح اللمعة الدمشقية - كتاب اختبار", "creator": "مؤلف تجريبي", "date": "1999", "language": "ara",
                     "description": "كتاب في الفقه: الطهارة والصلاة والصيام والخمس والزكاة", "subject": ["فقه", "طهارة"], "licenseurl": "https://creativecommons.org/publicdomain/zero/1.0/",
                     "contents": "باب الطهارة\nباب الصلاة\nباب الصيام"}}
META_ND = {"metadata": {"identifier": "test-item-two", "title": "Dictionary of Test Terms", "creator": "A. Tester", "date": "2001", "language": "eng", "description": "reference", "licenseurl": "https://creativecommons.org/licenses/by-nc-nd/4.0/", "possible-copyright-status": "NOT_IN_COPYRIGHT"}}
calls = []


def mock(r):
    u = r.request.url; calls.append(u)
    if 'advancedsearch.php' in u: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(SEARCH)); return True
    if 'archive.org/metadata/test-item-one' in u: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(META)); return True
    if 'archive.org/metadata/test-item-two' in u: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(META_ND)); return True
    return False


t = T(mock=mock); pg = t.pg


def login(u, p):
    t.go('/admin'); pg.fill('#f_lu', u); pg.fill('#f_lp', p); pg.click('[data-act=admLogin]'); pg.wait_for_timeout(700)


def modal(label):
    pg.click(f'.modal-ft .btn:has-text("{label}")'); pg.wait_for_timeout(700)


t.go('/ailibrary'); t.check('بلا دخول: لا أدوات إضافة', 'لإضافة كتب يلزم الدخول' in t.txt())
login('owner', '1111'); t.go('/ailibrary')
t.check('الصفحة تعرض المسار الثماني والتنبيه', 'اقتراحات تُراجَع ولا تُنشر تلقائياً' in t.txt() and 'طابور المراجعة' in t.txt())

# --- فحص الرخصة (وحدة)
lic = pg.evaluate("[SIRAJ.ailib.checkLicense({licenseurl:'https://creativecommons.org/publicdomain/zero/1.0/'}),SIRAJ.ailib.checkLicense({}),SIRAJ.ailib.checkLicense({licenseurl:'https://creativecommons.org/licenses/by-nc-nd/4.0/'}),SIRAJ.ailib.checkLicense({'access-restricted-item':'true'}),SIRAJ.ailib.checkLicense({'possible-copyright-status':'NOT_IN_COPYRIGHT'})]")
t.check('CC0 → ملك عام', lic[0]['status'].startswith('ملك عام') and lic[0]['sure'])
t.check('بلا رخصة → غير محدد ولا نشر', lic[1]['status'] == 'غير محدد' and not lic[1]['canHostFile'])
t.check('CC BY-NC-ND → تنبيهات ND وNC', lic[2]['status'].startswith('مرخّص') and any('ND' in n for n in lic[2]['notes']) and any('NC' in n for n in lic[2]['notes']), lic[2]['notes'])
t.check('مقيّد الوصول → لا إعادة نشر', 'لا إعادة نشر' in lic[3]['status'])
t.check('NOT_IN_COPYRIGHT ترجيح فقط: يبقى غير محدد', lic[4]['status'] == 'غير محدد' and any('تحقق بشري' in n for n in lic[4]['notes']))

# --- اقتراح القسم
sg = pg.evaluate("[SIRAJ.ailib.suggestSection('شرح اللمعة الدمشقية فقه الطهارة والصلاة والصيام').top.id, SIRAJ.ailib.suggestSection('تفسير الميزان في تفسير القرآن').top.id, SIRAJ.ailib.suggestSection('رواية خيالية عن البحر'), SIRAJ.ailib.suggestSection('ما نزل من القرآن في علي وآية المباهلة').top.id]")
t.check('فقه → fiqh', sg[0] == 'fiqh', sg); t.check('تفسير → tafsir', sg[1] == 'tafsir', sg); t.check('نص بلا صلة → لا اقتراح', sg[2]['top'] is None, sg[2]); t.check('آية المباهلة → ayat', sg[3] == 'ayat', sg)

# --- كشف التكرار
t.check('تكرار كتاب موجود يُكتشف', pg.evaluate("SIRAJ.ailib.duplicates('شرائع الإسلام في مسائل الحلال والحرام','المحقق الحلي','').length")>=1)
t.check('كتاب غير موجود → لا تكرار', pg.evaluate("SIRAJ.ailib.duplicates('كتاب لا وجود له إطلاقا في المكتبة xyz','فلان','').length")==0)

# --- بحث archive.org (محاكى)
t.go('/ailibrary?tab=search'); pg.fill('#f_aq', 'اللمعة'); pg.click('[data-act=ailSearch]'); pg.wait_for_timeout(1200)
t.check('تُعرض نتائج المصدر (2)', 'شرح اللمعة الدمشقية' in t.txt() and 'Dictionary of Test Terms' in t.txt() and 'لم يتحقق منها أحد' in t.txt(), t.txt()[:300])
t.check('الطلب ذهب إلى archive.org فقط', any('advancedsearch.php' in c for c in calls))
n0 = pg.evaluate("SIRAJ.library.books.length")
pg.click('[data-act=ailAnalyze][data-i="0"]'); pg.wait_for_timeout(1500)
ov = t.ev("document.getElementById('overlay-root').innerText")
t.check('نافذة التحليل: رخصة ملك عام + قسم مقترح + فهرس', 'ملك عام' in ov and 'الفقه' in ov and '3 بنداً' in ov.replace('٣', '3'), ov[:400])
t.shot('ailib_preview')
modal('إرسال إلى طابور الموافقة')
t.check('انتقل إلى طابور الموافقة', '/admin/pending' in pg.url, pg.url)
b = pg.evaluate("(()=>{const b=SIRAJ.library.books.find(b=>b.title.startsWith('شرح اللمعة'));return b&&{st:b.status,sec:b.section,ps:b.proposedSection,hasPdf:b.hasPdf,src:b.sourceUrl,cr:b.copyright,toc:b.toc,ai:b.aiNote,dl:b.allowDownload,authorId:b.authorId}})()")
t.check('الاقتراح pending بلا ملف ولا تنزيل', b and b['st'] == 'pending' and not b['hasPdf'] and not b['dl'], b)
t.check('رابط المصدر المحفوظ archive.org/details', b and b['src'] == 'https://archive.org/details/test-item-one', b)
t.check('القسم المقترح fiqh والفهرس 3 بنود وملاحظة AI', b and b['sec'] == 'fiqh' and b['ps'] == 'fiqh' and len(b['toc']) == 3 and 'مصدر البيانات' in b['ai'], b)
t.check('لم يُنشأ مؤلف قبل الموافقة', b and b['authorId'] is None)
t.check('الطابور يعرض ملاحظة سِراج AI والفهرس', 'ملاحظة سِراج AI' in t.txt() and 'الفهرس المستخرج' in t.txt())
t.check('لم يُحمَّل أي ملف من المصدر', not any('/download/' in c for c in calls), calls)
t.check('عدد الكتب زاد واحداً', pg.evaluate("SIRAJ.library.books.length") == n0 + 1)

# --- النشر يتطلب مؤلفاً وبعدها ينشئ المؤلف
bid = pg.evaluate("SIRAJ.library.books.find(b=>b.title.startsWith('شرح اللمعة')).id")
pg.click(f'[data-act=admApprove][data-id="{bid}"]'); pg.wait_for_timeout(500); modal('نشر'); pg.wait_for_timeout(500)
st = pg.evaluate("(id)=>{const b=SIRAJ.library.byId.get(id);return [b.status,!!b.authorId]}", bid)
t.check('بعد موافقة المالك: منشور ومؤلفه مسجّل', st[0] == 'published' and st[1], st)

# --- تكرار: نفس العنصر مرة ثانية يحذّر
t.go('/ailibrary?tab=url'); pg.fill('#f_aurl', 'https://archive.org/details/test-item-one'); pg.click('[data-act=ailFetch]'); pg.wait_for_timeout(1300)
ov = t.ev("document.getElementById('overlay-root').innerText"); t.check('إعادة نفس الرابط: تحذير تكرار', 'احتمال تكرار' in ov and 'نفس رابط المصدر' in ov, ov[:300])
modal('إلغاء')

# --- رخصة ND وعنصر لاتيني بلا قسم
pg.fill('#f_aurl', 'test-item-two'); pg.click('[data-act=ailFetch]'); pg.wait_for_timeout(1300)
ov = t.ev("document.getElementById('overlay-root').innerText"); t.check('عنصر لاتيني: لا اقتراح قسم + تنبيه ND', 'لا اقتراح' in ov and 'ND' in ov, ov[:300])
modal('إلغاء')

# --- إدخال يدوي
t.go('/ailibrary?tab=manual'); pg.fill('#f_mt', 'كتاب يدوي للتحليل'); pg.fill('#f_ma', 'مؤلف يدوي'); pg.fill('#f_msn', 'مكتبة غير مربوطة'); pg.fill('#f_msu', 'https://example.org/book/1'); pg.fill('#f_md', 'تفسير آيات القرآن وعلوم القرآن'); pg.fill('#f_mlic', 'غير معلنة')
pg.click('[data-act=ailManual]'); pg.wait_for_timeout(800)
ov = t.ev("document.getElementById('overlay-root').innerText"); t.check('الإدخال اليدوي: اقتراح التفسير', 'التفسير' in ov and 'غير محدد' in ov, ov[:300])
modal('إرسال إلى طابور الموافقة')
t.check('الإدخال اليدوي دخل الطابور', pg.evaluate("SIRAJ.library.pending().some(b=>b.title==='كتاب يدوي للتحليل'&&b.aiSource==='manual'&&b.copyright==='غير محدد')"))

# --- بلا إنترنت: خطأ صريح لا نتائج مختلقة
t.go('/ailibrary?tab=search'); t.ctx.set_offline(True); pg.fill('#f_aq', 'اختبار'); pg.click('[data-act=ailSearch]'); pg.wait_for_timeout(1000)
tx = pg.evaluate("document.getElementById('ail-res').innerText"); t.check('بلا إنترنت: رسالة خطأ صريحة ولا نتائج', 'تعذّر البحث' in tx and 'شرح اللمعة' not in tx, tx[:300]); t.ctx.set_offline(False)

# --- فهرس من PDF بلا إشارات: لا يُختلق
pdfp = os.path.join(ROOT, 'tests', 'fixtures', 'sample.pdf')
t.go('/admin/book/new'); pg.fill('[name=title]', 'كتاب بملف للفهرس'); pg.fill('[name=author]', 'م'); pg.set_input_files('[name=pdf]', pdfp); pg.click('[data-act=admSaveBook][data-mode=draft]'); pg.wait_for_timeout(1500)
t.go('/ailibrary?tab=pdf'); t.check('قائمة الكتب بملفات PDF', 'كتاب بملف للفهرس' in t.txt())
pg.click('[data-act=ailToc]'); pg.wait_for_timeout(2500)
ov = t.ev("document.getElementById('overlay-root').innerText"); t.check('PDF بلا إشارات: لا فهرس مختلق', 'لا فهرس في الملف' in ov or 'تعذّر' in t.ev("document.body.innerText"), ov[:200])
t.done()

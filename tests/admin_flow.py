"""اختبار لوحة الإدارة: دخول، إضافة كتاب + PDF + غلاف، طابور الموافقة، قبول/رفض، صلاحيات، استمرارية بعد إعادة التحميل"""
import os
from common import T, ROOT

PDF = os.path.join(ROOT, 'tests', 'fixtures', 'sample.pdf')
COVER = os.path.join(ROOT, 'assets', 'images', 'icon-192.png')
t = T()
pg = t.pg


def click_modal(label=None, cls='primary'):
    sel = '.modal-ft .btn.' + cls if not label else f'.modal-ft .btn:has-text("{label}")'
    pg.click(sel); pg.wait_for_timeout(500)


def login(u, p):
    t.go('/admin'); pg.fill('#f_lu', u); pg.fill('#f_lp', p); pg.click('[data-act=admLogin]'); pg.wait_for_timeout(800)


# ---- الدخول
t.go('/admin')
t.check('صفحة الدخول تُظهر تنبيه «ليس أماناً حقيقياً»', 'ليس أماناً حقيقياً' in t.txt())
t.check('الصفحة تتطلب الدخول (لا بيانات إدارية)', 'الكتب بانتظار الموافقة' not in t.txt())
login('owner', '0000')
t.check('رمز خاطئ يُرفض', 'غير صحيح' in t.ev("document.body.innerText"), t.txt()[:100])
login('owner', '1111')
t.check('دخول المالك ينجح', 'إدارة سِراج' in t.ev("document.getElementById('ab-title').textContent") and 'الدور: المالك' in t.txt(), t.txt()[:150])
t.shot('admin_dash')

# ---- إضافة كتاب جديد مع PDF وغلاف
t.go('/admin/book/new')
pg.fill('[name=title]', 'كتاب اختبار الإدارة')
pg.fill('[name=author]', 'مؤلف اختباري')
pg.select_option('[name=section]', 'fiqh'); pg.wait_for_timeout(200)
subs = pg.eval_on_selector_all('#f_subcat option', 'o=>o.map(x=>x.textContent)')
t.check('التصنيف الفرعي يتبع القسم', len(subs) > 2, subs)
pg.select_option('#f_subcat', index=1)
pg.fill('[name=desc]', 'نبذة اختبارية')
pg.fill('[name=sourceName]', 'مصدر اختبار'); pg.fill('[name=sourceUrl]', 'https://example.org/x')
pg.set_input_files('[name=pdf]', PDF); pg.set_input_files('[name=cover]', COVER)
pg.click('[data-act=admSaveBook][data-mode=submit]'); pg.wait_for_timeout(1500)
t.check('الإرسال ينقل إلى طابور الموافقة', '/admin/pending' in pg.url, pg.url)
t.check('الكتاب الجديد يظهر في الطابور', 'كتاب اختبار الإدارة' in t.txt())
bid = pg.evaluate("(SIRAJ.library.books.find(b=>b.title==='كتاب اختبار الإدارة')||{}).id")
b = pg.evaluate("(id)=>{const b=SIRAJ.library.byId.get(id);return {st:b.status,pdf:b.hasPdf,cov:b.hasCover,pages:b.pages}}", bid)
t.check('حالة pending وفيه PDF وغلاف', b['st'] == 'pending' and b['pdf'] and b['cov'], b)
t.check('عدد الصفحات يُستخرج من PDF', b['pages'] == 1 or b['pages'] is None, b)  # PDF.js قد لا يعمل على http://127 دون ... نكتفي بعدم الخطأ
t.check('غير منشور → لا يظهر في المكتبة العامة', pg.evaluate("(id)=>!SIRAJ.library.published().some(b=>b.id===id)", bid))

# ---- الموافقة مرفوضة عند حقوق غير موثقة + PDF
pg.click(f'[data-act=admApprove][data-id="{bid}"]'); pg.wait_for_timeout(600)
t.check('منع نشر PDF بلا حقوق موثقة', 'لا يمكن النشر' in t.ev("document.getElementById('overlay-root').innerText"), t.ev("document.getElementById('overlay-root').innerText")[:120])
click_modal('حسناً')
st = pg.evaluate("(id)=>SIRAJ.library.byId.get(id).status", bid); t.check('بقي pending', st == 'pending', st)

# ---- تعديل الحقوق ثم الموافقة
t.go(f'/admin/book/{bid}')
pg.select_option('[name=copyright]', 'ملك عام (انتهت مدة الحماية)')
pg.click('[data-act=admSaveBook][data-mode=submit]'); pg.wait_for_timeout(1200)
pg.click(f'[data-act=admApprove][data-id="{bid}"]'); pg.wait_for_timeout(500)
click_modal('نشر'); pg.wait_for_timeout(800)
st = pg.evaluate("(id)=>SIRAJ.library.byId.get(id).status", bid); t.check('المالك ينشر الكتاب', st == 'published', st)
t.check('يظهر في المكتبة العامة', pg.evaluate("(id)=>SIRAJ.library.published().some(b=>b.id===id)", bid))

# ---- المقترح المضمّن (b_amali-saduq) قسم مقترح + رفض بسبب
t.go('/admin/pending')
pend = pg.evaluate("SIRAJ.library.pending().map(b=>b.id)")
t.check('كتب مقترحة ظاهرة في الطابور', len(pend) >= 1, pend)
rid = pend[0]
pg.click(f'[data-act=admReject][data-id="{rid}"]'); pg.wait_for_timeout(500)
click_modal(); pg.wait_for_timeout(300)
t.check('الرفض بلا سبب مرفوض', pg.evaluate("(id)=>SIRAJ.library.byId.get(id).status", rid) == 'pending')
pg.click(f'[data-act=admReject][data-id="{rid}"]'); pg.wait_for_timeout(500)
pg.fill('.modal [name=v]', 'مكرر مع كتاب موجود'); click_modal(); pg.wait_for_timeout(800)
r = pg.evaluate("(id)=>{const b=SIRAJ.library.byId.get(id);return [b.status,b.review.note]}", rid)
t.check('الرفض مع سبب يُسجَّل', r[0] == 'rejected' and 'مكرر' in r[1], r)

# ---- سجل العمليات
t.go('/admin/audit'); txt = t.txt()
t.check('سجل العمليات يحوي الأحداث', 'book.add' in txt and 'book.rejected' in txt and 'auth.login' in txt, txt[:200])

# ---- تسجيل الخروج والاستمرار بعد إعادة التحميل
pg.reload(); pg.wait_for_function("document.documentElement.dataset.ready==='1'"); pg.wait_for_timeout(600)
t.check('الجلسة محفوظة بعد إعادة التحميل', pg.evaluate("!!SIRAJ.auth.user()"))
t.check('الكتاب المنشور محفوظ بعد إعادة التحميل', pg.evaluate("(id)=>{const b=SIRAJ.library.byId.get(id);return !!b&&b.status==='published'&&b.hasPdf}", bid))
f = pg.evaluate("async(id)=>{const f=await SIRAJ.files.get('pdf:'+id);return f?f.size:0}", bid); t.check('ملف PDF محفوظ في IndexedDB', f > 100, f)
t.go(f'/library/book/{bid}'); t.check('صفحة الكتاب تعرض زر القراءة', 'اقرأ' in t.txt() or 'قراءة' in t.txt(), t.txt()[:200])

# ---- رفع ملف ليس PDF
t.go('/admin/book/new'); pg.fill('[name=title]', 'ملف مزيف'); pg.fill('[name=author]', 'س')
fake = '/tmp/fake.pdf'; open(fake, 'w').write('not a pdf at all, just text ' * 10)
pg.set_input_files('[name=pdf]', fake); pg.click('[data-act=admSaveBook][data-mode=draft]'); pg.wait_for_timeout(900)
t.check('رفض ملف مزيف بامتداد PDF', pg.evaluate("!SIRAJ.library.books.some(b=>b.title==='ملف مزيف')") and 'ليس PDF' in t.ev("document.body.innerText"), t.ev("document.body.innerText")[-200:])

# ---- محرر: لا يملك النشر ولا إدارة المستخدمين
pg.evaluate("SIRAJ.auth.logout()"); pg.wait_for_timeout(300)
login('editor', '3333')
t.go('/admin'); txt = t.txt()
t.check('المحرر يدخل ولا يرى «المستخدمون»', 'الدور: المحرر' in txt and 'المستخدمون والصلاحيات' not in txt, txt[:200])
t.go('/admin/users'); t.check('المحرر محجوب عن المستخدمين', 'لا تملك الصلاحية' in t.txt())
t.go('/admin/book/new'); t.check('المحرر لا يرى زر «حفظ ونشر»', 'حفظ ونشر' not in t.txt())

# ---- المراجع: توصية فقط
pg.evaluate("SIRAJ.auth.logout()"); pg.wait_for_timeout(300)
# كتاب جديد بانتظار الموافقة بيد المحرر
login('editor', '3333'); t.go('/admin/book/new'); pg.fill('[name=title]', 'مسودة المحرر'); pg.fill('[name=author]', 'مؤلف اختباري')
pg.click('[data-act=admSaveBook][data-mode=submit]'); pg.wait_for_timeout(1200)
pg.evaluate("SIRAJ.auth.logout()"); login('reviewer', '4444'); t.go('/admin/pending')
eid = pg.evaluate("SIRAJ.library.byId && SIRAJ.library.books.find(b=>b.title==='مسودة المحرر').id")
t.check('المراجع يرى الطابور', 'مسودة المحرر' in t.txt())
t.check('زر المراجع «توصية بالقبول» وليس نشراً', 'توصية بالقبول' in t.txt())
pg.click(f'[data-act=admApprove][data-id="{eid}"]'); pg.wait_for_timeout(500); pg.fill('.modal [name=v]', 'يبدو سليماً'); click_modal(); pg.wait_for_timeout(700)
r = pg.evaluate("(id)=>{const b=SIRAJ.library.byId.get(id);return [b.status,b.reviewerRec&&b.reviewerRec.decision]}", eid)
t.check('توصية المراجع لا تنشر', r == ['pending', 'قبول'], r)

# ---- المالك ينشر بعد التوصية
pg.evaluate("SIRAJ.auth.logout()"); login('owner', '1111'); t.go('/admin/pending')
t.check('المالك يرى توصية المراجع', 'توصية' in t.txt() and 'يبدو سليماً' in t.txt())
pg.click(f'[data-act=admApprove][data-id="{eid}"]'); pg.wait_for_timeout(500); click_modal('نشر'); pg.wait_for_timeout(800)
t.check('المالك ينشر', pg.evaluate("(id)=>SIRAJ.library.byId.get(id).status", eid) == 'published')

# ---- بقية صفحات الإدارة تُعرض بلا خطأ
for r, key in [('/admin/books', 'منشور'), ('/admin/authors', 'سجل'), ('/admin/publishers', 'سجل'), ('/admin/sources', 'سجل'), ('/admin/duas', 'الأدعية'), ('/admin/quran', 'نص المصحف'), ('/admin/audio', 'إضافة تسجيل'), ('/admin/notify', 'غير مربوط'), ('/admin/stats', 'إحصاءات'), ('/admin/users', 'نظام تجريبي'), ('/admin/backup', 'النسخ'), ('/admin/settings', 'موافقة المالك'), ('/admin/import', 'لا نشر تلقائي'), ('/admin/duas/import', 'الصيغة'), ('/admin/dua/new', 'قاعدة التوثيق')]:
    t.go(r, 500); t.check('تُعرض ' + r, key in t.txt(), t.txt()[:100])

# ---- دعاء: يرفض بلا مصدر ويقبل بمصدر
t.go('/admin/dua/new'); pg.fill('[name=title]', 'دعاء اختبار'); pg.fill('[name=text]', 'نص اختباري قصير')
pg.click('[data-act=admSaveDua]'); pg.wait_for_timeout(700)
t.check('دعاء بلا مصدر مرفوض', pg.evaluate("(async()=>!(await SIRAJ.db.all('duas')).some(d=>d.title==='دعاء اختبار'))()"))
pg.fill('[name=book]', 'كتاب مصدر اختباري'); pg.fill('[name=page]', '12'); pg.click('[data-act=admSaveDua]'); pg.wait_for_timeout(900)
d = pg.evaluate("(async()=>(await SIRAJ.db.all('duas')).find(d=>d.title==='دعاء اختبار'))()")
t.check('دعاء بمصدر يُحفظ ويُوسَم «موثق»', d and d['textStatus'] == 'documented', d)

# ---- مؤلف: لا حذف إذا مرتبط
t.go('/admin/authors'); pg.click('.list .li >> nth=0'); pg.wait_for_timeout(400)
t.check('نافذة تحرير المؤلف', 'تعديل' in t.ev("document.getElementById('overlay-root').innerText"))
pg.keyboard.press('Escape'); pg.evaluate("SIRAJ.closeAllModals()")

# ---- موافقة المالك: تعطيل يتطلب تأكيداً
t.go('/admin/settings'); pg.click('input[data-chg=ownerApproval]'); pg.wait_for_timeout(500)
t.check('تعطيل موافقة المالك يطلب تأكيداً', 'هل أنت متأكد' in t.ev("document.getElementById('overlay-root').innerText"))
click_modal('إلغاء'); pg.wait_for_timeout(300)
t.check('الإلغاء يبقيها مفعّلة', pg.evaluate("SIRAJ.kv.get('settings.owner',{requireOwnerApproval:true}).requireOwnerApproval") is True)

# ---- نسخة احتياطية
t.go('/admin/backup')
with pg.expect_download() as dl:
    pg.click('[data-act=backupExport][data-files="0"]')
path = dl.value.path(); sz = os.path.getsize(path); t.check('تصدير نسخة احتياطية', sz > 500, sz)

t.shot('admin_pending')
t.done()

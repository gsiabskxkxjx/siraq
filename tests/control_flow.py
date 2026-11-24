"""اختبار تطبيق «سِراج — التحكم»: مفتاح مشفّر، مسودات/جاهز، فحص التوثيق، إصدار حزمة موقّعة، سحب، إعلانات.
يكتب الحزم الناتجة في /tmp/siraj-e2e ليستعملها packs_flow.py (تثبيتها في سِراج)."""
import os, sys, json, subprocess, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import T, ROOT

OUT = '/tmp/siraj-e2e'; WWW = '/tmp/ctl-www-test'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
subprocess.run(['node', os.path.join(ROOT, 'scripts', 'prepare-control.mjs'), '--out', WWW], check=True, capture_output=True)

t = T(root=WWW); pg = t.pg
PASS = 'عبارة-مرور-للاختبار-123'

def click_modal(label=None, cls='primary'):
    sel = '.modal-ft .btn.' + cls if not label else f'.modal-ft .btn:has-text("{label}")'
    pg.click(sel); pg.wait_for_timeout(350)

def toast_text(): return pg.evaluate("[...document.querySelectorAll('.toast')].map(x=>x.innerText).join('|')")

# ---------- 0) الإقلاع ----------
t.check('التطبيق جاهز بلا حسابات/إدارة', t.ev("!document.querySelector('[data-act=login]') && !location.hash.includes('admin')"))
t.check('قاعدة بيانات التحكم منفصلة عن سِراج', t.ev("window.SIRAJ_DB_NAME==='siraj-control-db'"))
t.check('لا مفتاح عند أول تشغيل', t.ev("!SIRAJ.keys.exists()"))
t.check('المراجع من سِراج محمّلة (أقسام/مؤلفون/أدعية)', t.ev("SIRAJ.sections.length>=5 && SIRAJ.data.sample.authors.length>50 && SIRAJ.data.duas.categories.length>3"))

# ---------- 1) إنشاء المفتاح ----------
t.go('/key')
t.check('شاشة إنشاء المفتاح', 'إنشاء مفتاح جديد' in t.txt())
pg.fill('#f_kp1', 'قصيرة'); pg.fill('#f_kp2', 'قصيرة'); pg.click('[data-act=keyCreate]'); pg.wait_for_timeout(300)
t.check('عبارة قصيرة مرفوضة', not t.ev("SIRAJ.keys.exists()"))
pg.fill('#f_kp1', PASS); pg.fill('#f_kp2', PASS + 'x'); pg.click('[data-act=keyCreate]'); pg.wait_for_timeout(300)
t.check('عبارتان مختلفتان مرفوضتان', not t.ev("SIRAJ.keys.exists()"))
pg.fill('#f_kp1', PASS); pg.fill('#f_kp2', PASS); pg.click('[data-act=keyCreate]')
pg.wait_for_selector('.modal', timeout=20000); pg.wait_for_timeout(300)
t.check('رسالة نسخ احتياطي بعد الإنشاء', 'نسخة احتياطية' in t.ev("document.querySelector('.modal').innerText"))
click_modal('حسناً')
rec = t.ev("SIRAJ.keys.record()")
kid = t.ev("SIRAJ.keys.id()")
t.check('بصمة المفتاح 16 خانة سداسية', len(kid) == 16 and all(c in '0123456789abcdef' for c in kid), kid)
t.check('المفتاح مفتوح بعد الإنشاء', t.ev("SIRAJ.keys.isUnlocked()"))
t.check('السجل المخزَّن مشفّر (ct موجود، ولا jwk خاص ب d)', 'ct' in rec and 'iter' in rec and '"d"' not in json.dumps(rec), list(rec))
snippet = t.ev("SIRAJ.keys.snippet()"); pub = json.loads(snippet)
t.check('المقطع العام يحوي jwk عام فقط', set(pub['jwk'].keys()) == {'kty', 'crv', 'x', 'y'} and pub['id'] == kid, pub)
open(OUT + '/pubkey.json', 'w').write(snippet)
t.ev("SIRAJ.keys.lock(); SIRAJ.router.refresh()"); pg.wait_for_timeout(500)
t.check('عند القفل تظهر حالة «مقفل»', 'مقفل' in t.txt())
wrong = t.ev("SIRAJ.keys.unlock('عبارة خاطئة تماماً').then(()=>'OPEN').catch(e=>'ERR')")
t.check('عبارة خاطئة لا تفتح المفتاح', wrong == 'ERR' and not t.ev("SIRAJ.keys.isUnlocked()"))
pg.click('[data-act=keyUnlock]'); pg.wait_for_selector('.modal'); pg.fill('.modal [name=v]', PASS); click_modal('فتح'); pg.wait_for_timeout(800)
t.check('فتح بعبارة صحيحة عبر الواجهة', t.ev("SIRAJ.keys.isUnlocked()"))
with pg.expect_download() as dl: pg.click('[data-act=keyBackup]')
dl.value.save_as(OUT + '/publisher.sirajkey'); bk = json.load(open(OUT + '/publisher.sirajkey'))
t.check('ملف النسخة الاحتياطية = السجل المشفّر', bk.get('id') == kid and bk.get('app') == 'siraj-control-key' and 'ct' in bk and '"d"' not in json.dumps(bk))
t.shot('ctl_key')

# ---------- 2) كتاب: مسودة ثم جاهز ----------
sec = t.ev("({id:SIRAJ.sections[0].id, sub:SIRAJ.sections[0].subcats[0]})")
t.go('/book/new')
pg.fill('[name=title]', 'كتاب تجريبي للاختبار'); pg.fill('[name=author]', 'مؤلف تجريبي للاختبار'); pg.fill('[name=authorDeath]', '1400')
pg.select_option('[name=section]', sec['id']); pg.check('[name=ready]'); pg.click('[data-act=bkSave]'); pg.wait_for_timeout(800)
t.check('كتاب بلا مصدر لا يصير جاهزاً (يُحفظ مسودة + سبب)', t.ev("document.getElementById('bk-errs').innerText").find('المصدر') >= 0)
books = t.ev("SIRAJ.db.all('books')")
t.check('حُفظ مسودة', len(books) == 1 and books[0]['ready'] is False, books)
t.check('أُنشئ مؤلف جديد تلقائياً', t.ev("SIRAJ.db.all('authors')").__len__() == 1)
pg.fill('[name=sourceName]', 'فهرس تجريبي'); pg.fill('[name=sourceUrl]', 'https://example.org/fihris/1'); pg.check('[name=ready]'); pg.click('[data-act=bkSave]'); pg.wait_for_timeout(900)
books = t.ev("SIRAJ.db.all('books')")
t.check('الكتاب جاهز بعد إضافة المصدر (بلا تكرار)', len(books) == 1 and books[0]['ready'] is True, books)
t.check('حقل حالة النشر غير موجود في مسودة الناشر (لا نشر تلقائي)', all('status' not in b for b in books))
bid = books[0]['id']; aid = books[0]['authorId']

# ---------- 3) دعاء: نص بلا مصدر مرفوض ----------
t.go('/dua/new')
pg.fill('[name=title]', 'دعاء تجريبي للاختبار'); pg.fill('[name=text]', 'نص اختباري وهمي — ليس نصاً دينياً'); pg.check('[name=ready]'); pg.click('[data-act=duaSave]'); pg.wait_for_timeout(800)
d = t.ev("SIRAJ.db.all('duas')")
t.check('نص دعاء بلا كتاب/موضع لا يصير جاهزاً', len(d) == 1 and d[0]['ready'] is False and 'الكتاب' in t.ev("document.getElementById('dua-errs').innerText"), d)
pg.fill('[name=book]', 'كتاب اختباري'); pg.fill('[name=page]', '12'); pg.check('[name=ready]'); pg.click('[data-act=duaSave]'); pg.wait_for_timeout(900)
d = t.ev("SIRAJ.db.all('duas')"); t.check('الدعاء جاهز بعد توثيقه', len(d) == 1 and d[0]['ready'] is True and d[0]['textSource']['page'] == '12', d)
did = d[0]['id']

# ---------- 4) مدخل موسوعة ----------
t.go('/entry/fiqh_terms/new')
pg.fill('[name=title]', 'مصطلح تجريبي'); pg.fill('[name=text]', 'تعريف اختباري وهمي'); pg.check('[name=ready]'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(800)
e = t.ev("SIRAJ.db.all('entries')"); t.check('مدخل بلا مصدر يُحفظ مسودة', len(e) == 1 and e[0]['ready'] is False, e)
pg.fill('[data-rows=sources] [data-k=book]', 'كتاب اختباري'); pg.fill('[data-rows=sources] [data-k=page]', '7'); pg.check('[name=ready]'); pg.click('[data-act=entSave]'); pg.wait_for_timeout(900)
e = t.ev("SIRAJ.db.all('entries')"); t.check('المدخل جاهز بعد التوثيق', len(e) == 1 and e[0]['ready'] is True and e[0]['sources'][0]['page'] == '7', e)
eid = e[0]['id']

# ---------- 5) الاستيراد: مسودات فقط + رفض غير الموثّق ----------
imp = [{"title": "كتاب مستورد", "author": "مؤلف تجريبي للاختبار", "section": sec['id'], "sourceName": "فهرس", "copyright": "غير محدد"}, {"title": "كتاب بلا مصدر", "author": "ما", "section": sec['id']}]
json.dump(imp, open(OUT + '/imp.json', 'w'), ensure_ascii=False)
t.go('/import'); pg.set_input_files('[name=jf]', OUT + '/imp.json'); pg.click('[data-act=impRun]'); pg.wait_for_timeout(900)
b2 = t.ev("SIRAJ.db.all('books')")
t.check('الاستيراد: المستند يدخل مسودة والناقص يُرفض', len(b2) == 2 and sum(1 for b in b2 if b['ready']) == 1 and 'رُفض 1' in t.ev("document.getElementById('imp-out').innerText"), t.ev("document.getElementById('imp-out').innerText"))
imp_id = [b['id'] for b in b2 if b['id'] != bid][0]

# ---------- 6) صفحة الإصدار: العدّاد والفحص ----------
t.go('/publish'); tx = t.txt()
t.check('الإصدار: 1 كتاب جاهز، 1 دعاء، 1 مدخل', t.ev("[...document.querySelectorAll('.kv')].slice(0,3).map(k=>k.querySelector('b').innerText).join(',')") in ('١,١,١', '1,1,1'), tx[:300])
t.check('المسودة المستوردة خارج الحزمة', 'مسودات خارج الحزمة' in tx)
t.shot('ctl_publish')

# ---------- 7) إصدار الحزمة 1 (المفتاح مقفل → يطلب العبارة) ----------
t.ev("SIRAJ.keys.lock()"); t.go('/publish'); pg.wait_for_timeout(300)
pg.fill('#f_ptitle', 'حزمة اختبار ١'); pg.fill('#f_pnotes', 'ملاحظة للمستخدم'); pg.click('[data-act=pkIssue]'); pg.wait_for_selector('.modal'); pg.fill('.modal [name=v]', 'خاطئة'); click_modal('فتح'); pg.wait_for_timeout(500)
t.check('عبارة خاطئة عند الإصدار لا توقّع', not t.ev("SIRAJ.keys.isUnlocked()"))
pg.wait_for_selector('.modal'); pg.fill('.modal [name=v]', PASS)
with pg.expect_download(timeout=30000) as dl: click_modal('فتح'); pg.wait_for_timeout(1500)
dl.value.save_as(OUT + '/pack1.sirajpack'); t.check('اسم الملف siraj-pack-<seq>.sirajpack', dl.value.suggested_filename.startswith('siraj-pack-') and dl.value.suggested_filename.endswith('.sirajpack'), dl.value.suggested_filename)
env1 = json.load(open(OUT + '/pack1.sirajpack')); pl1 = json.loads(env1['payload'])
t.check('الغلاف: format/alg/keyId', env1['format'] == 'siraj-pack/1' and env1['alg'] == 'ES256' and env1['keyId'] == kid)
t.check('الحمولة: عدد العناصر وختم seq', pl1['seq'] > 1_000_000 and len(pl1['books']) == 1 and len(pl1['duas']) == 1 and len(pl1['entries']) == 1 and len(pl1['authors']) == 1, {k: (len(v) if isinstance(v, list) else v) for k, v in pl1.items()})
t.check('المسودات غير موجودة في الحزمة', all(b['id'] != imp_id for b in pl1['books']))
t.check('حقول الكتاب مقيّدة (لا ready/status/updated)', not ({'ready', 'status', 'updated', 'hasPdf'} & set(pl1['books'][0])), list(pl1['books'][0]))
t.check('الإصدار يسجَّل في السجل', len(t.ev("SIRAJ.kv.get('ctl.history',[])")) == 1 and t.ev("SIRAJ.kv.get('ctl.seq')") == pl1['seq'])
# تحقق مستقل بمكتبة Python cryptography (ليس نفس شيفرة التطبيق)
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives import hashes
import base64
def b64u(s): return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))
def indep_verify(env, jwk):
    pubk = ec.EllipticCurvePublicNumbers(int.from_bytes(b64u(jwk['x']), 'big'), int.from_bytes(b64u(jwk['y']), 'big'), ec.SECP256R1()).public_key()
    raw = b64u(env['sig']); r, s = int.from_bytes(raw[:32], 'big'), int.from_bytes(raw[32:], 'big')
    try: pubk.verify(utils.encode_dss_signature(r, s), env['payload'].encode('utf-8'), ec.ECDSA(hashes.SHA256())); return True
    except Exception: return False
t.check('التوقيع صحيح بتحقق مستقل (Python cryptography)', indep_verify(env1, pub['jwk']))
tam = dict(env1); tam['payload'] = env1['payload'].replace('حزمة اختبار ١', 'حزمة اختبار ٢')
t.check('تعديل الحمولة يُبطل التوقيع (تحقق مستقل)', tam['payload'] != env1['payload'] and not indep_verify(tam, pub['jwk']))

# فحص الملف داخل التطبيق
t.go('/publish'); pg.set_input_files('[name=vfile]', OUT + '/pack1.sirajpack'); pg.click('[data-act=pkVerify]'); pg.wait_for_timeout(800)
t.check('«فحص ملف حزمة» يؤكد التوقيع', 'التوقيع صحيح' in t.ev("document.getElementById('vf-out').innerText"))
json.dump(tam, open(OUT + '/tampered-title.sirajpack', 'w'), ensure_ascii=False)
pg.set_input_files('[name=vfile]', OUT + '/tampered-title.sirajpack'); pg.click('[data-act=pkVerify]'); pg.wait_for_timeout(800)
t.check('«فحص ملف حزمة» يكشف التعديل', 'غير مطابق' in t.ev("document.getElementById('vf-out').innerText"))

# ---------- 8) سحب مضمّن + إعلان + سحب دعاء من الجاهز ----------
bundled = t.ev("(()=>{const b=SIRAJ.data.sample.books[3];return {id:b.id,title:b.title}})()")
t.go('/withdraw?k=books&q=' + bundled['title'][:6]); pg.wait_for_timeout(400)
btn = pg.locator(f'[data-act=wdToggle][data-id="{bundled["id"]}"]')
t.check('بحث السحب يعرض الكتاب المضمّن', btn.count() == 1)
btn.click(); pg.wait_for_timeout(500)
t.check('تسجيل السحب', bundled['id'] in t.ev("SIRAJ.kv.get('ctl.withdraw').books"))
t.go('/notices'); pg.fill('#f_ntitle', 'إعلان اختباري'); pg.fill('#f_nbody', 'نص الإعلان'); pg.click('[data-act=ntAdd]'); pg.wait_for_timeout(500)
t.check('تسجيل الإعلان', len(t.ev("SIRAJ.kv.get('ctl.notices')")) == 1)
# الدعاء يعود مسودة → يختفي من اللقطة
t.go('/dua/' + did); pg.uncheck('[name=ready]'); pg.click('[data-act=duaSave]'); pg.wait_for_timeout(800)
t.go('/publish'); pg.fill('#f_ptitle', 'حزمة اختبار ٢'); pg.click('[data-act=pkIssue]'); 
with pg.expect_download(timeout=30000) as dl: pg.wait_for_timeout(1500)
dl.value.save_as(OUT + '/pack2.sirajpack')
env2 = json.load(open(OUT + '/pack2.sirajpack')); pl2 = json.loads(env2['payload'])
t.check('الحزمة 2: رقم أكبر من الأولى', pl2['seq'] > pl1['seq'], (pl1['seq'], pl2['seq']))
t.check('الحزمة 2: الدعاء غاب (لقطة) والكتاب والمدخل باقيان', len(pl2['duas']) == 0 and len(pl2['books']) == 1 and len(pl2['entries']) == 1)
t.check('الحزمة 2: السحب والإعلان', pl2['withdraw']['books'] == [bundled['id']] and [n['title'] for n in pl2['notices']] == ['إعلان اختباري'])
t.check('الحزمة 2 موقّعة بالمفتاح نفسه (تحقق مستقل)', indep_verify(env2, pub['jwk']))
json.dump({'keyId': kid, 'seq1': pl1['seq'], 'seq2': pl2['seq'], 'id1': pl1['id'], 'id2': pl2['id'], 'bookId': bid, 'authorId': aid, 'duaId': did, 'entryId': eid, 'bundled': bundled}, open(OUT + '/meta.json', 'w'), ensure_ascii=False)

# ---------- 9) استعادة المفتاح من النسخة (جهاز جديد) + حذف ----------
t.go('/key'); pg.click('[data-act=keyDelete]'); pg.wait_for_selector('.modal'); click_modal('احذف'); pg.wait_for_timeout(600)
t.check('حذف المفتاح من الجهاز', not t.ev("SIRAJ.keys.exists()"))
pg.set_input_files('[name=kfile]', OUT + '/publisher.sirajkey'); pg.fill('#f_kimpp', 'خاطئة'); pg.click('[data-act=keyImport]'); pg.wait_for_timeout(1500)
t.check('استعادة بعبارة خاطئة تفشل', not t.ev("SIRAJ.keys.exists()"))
pg.fill('#f_kimpp', PASS); pg.click('[data-act=keyImport]'); pg.wait_for_timeout(1800)
t.check('استعادة المفتاح بنفس البصمة', t.ev("SIRAJ.keys.exists() && SIRAJ.keys.id()") == kid)

# ---------- 9ب) كتب سِراج المضمّنة تظهر في «الكتب» ويُعدَّل عليها مع PDF ----------
import hashlib
PDFB = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'; open('/tmp/test-book.pdf', 'wb').write(PDFB)
t.go('/books', 700); nb = t.ev("SIRAJ.data.sample.books.length")
t.check('«الكتب» تعرض كتب سِراج المضمّنة مباشرة (بدّون تبويب جانبي)', t.ev("document.querySelectorAll('#view .li').length") >= 40 and 'مضمّن' in t.txt() and nb >= 400, t.txt()[:200])
t.go('/books?st=bundled&q=' + t.ev("encodeURIComponent(SIRAJ.data.sample.books[0].title.split(' ')[0])"), 700)
first = t.ev("SIRAJ.data.sample.books[0].id"); pg.click(f'a.li[href="#/book/{first}"]'); pg.wait_for_timeout(900)
t.check('فتح كتاب مضمّن يعرض نموذج التعديل ببياناته وإرفاق PDF', t.ev("document.querySelector('[name=title]').value") == t.ev("SIRAJ.data.sample.books[0].title") and 'ملف PDF للكتاب' in t.txt())
t.check('فتحه لا يكتب شيئاً قبل الحفظ', t.ev("SIRAJ.db.all('books').then(a=>a.filter(b=>b.replaces==='%s').length)" % first) == 0)
pg.click('[data-act=bkSave]'); pg.wait_for_timeout(900)
clone = t.ev("SIRAJ.db.all('books').then(a=>a.find(b=>b.replaces==='%s'))" % first)
t.check('الحفظ ينشئ نسخة معدّلة (مسودة) بمعرّف جديد', clone and clone['id'] != first and clone['ready'] is False)
t.go('/book/' + first, 700); t.check('إعادة فتح المضمّن تفتح نسختك لا نسخة جديدة', t.ev("document.getElementById('bkform').dataset.id") == clone['id'])
pg.fill('[name=sourceName]', 'فهرس اختباري'); pg.fill('[name=sourceUrl]', 'https://example.org/b'); pg.set_input_files('[name=pdfFile]', '/tmp/test-book.pdf'); pg.check('[name=ready]'); pg.click('[data-act=bkSave]'); pg.wait_for_timeout(1200)
t.check('PDF مع حقوق «غير محدد»: لا يُقبل جاهزاً', t.ev("SIRAJ.db.get('books','%s').then(b=>b.ready)" % clone['id']) is False and t.ev("SIRAJ.db.get('books','%s').then(b=>b.hasPdf)" % clone['id']) is True)
t.go('/book/' + clone['id'], 700); pg.select_option('[name=copyright]', 'مرخّص — Creative Commons'); pg.check('[name=allowDownload]'); pg.check('[name=ready]'); pg.click('[data-act=bkSave]'); pg.wait_for_timeout(1200)
t.check('بحقوق «مرخّص»: يصير جاهزاً ومعه PDF', t.ev("SIRAJ.db.get('books','%s').then(b=>b.ready&&b.hasPdf&&b.allowDownload)" % clone['id']) is True)
t.go('/books?st=pdf', 600); t.check('فلتر «فيها PDF»', clone['id'] in t.ev("[...document.querySelectorAll('#view a.li')].map(a=>a.getAttribute('href')).join(' ')"))
t.go('/duas'); dfirst = t.ev("document.querySelector('[data-act=duaClone]').dataset.id"); pg.click(f'[data-act=duaClone][data-id="{dfirst}"]'); pg.wait_for_timeout(900)
t.check('دعاء مضمّن: ينسخ مسودة للتعديل', '/dua/pd_' in t.ev("location.hash") and t.ev("SIRAJ.db.all('duas').then(a=>a.some(d=>d.replaces==='%s'&&!d.ready))" % dfirst))
# الإصدار: الأصل يُسحب تلقائياً والنسخة تدخل بمعرّفها الجديد ومعها PDF بالبصمة
t.go('/publish'); pg.fill('#f_ptitle', 'حزمة تعديل مضمّن')
if not t.ev("SIRAJ.keys.isUnlocked()"):
    pg.click('[data-act=pkIssue]'); pg.wait_for_selector('.modal'); pg.fill('.modal [name=v]', PASS)
    with pg.expect_download(timeout=30000) as dl: click_modal('فتح'); pg.wait_for_timeout(1800)
else:
    with pg.expect_download(timeout=30000) as dl: pg.click('[data-act=pkIssue]'); pg.wait_for_timeout(1800)
dl.value.save_as(OUT + '/pack3.sirajpack'); env3 = json.load(open(OUT + '/pack3.sirajpack')); pl3 = json.loads(env3['payload'])
t.check('الحزمة: نسخة الكتاب بمعرّفها الجديد وسحب الأصل تلقائياً', clone['id'] in [b['id'] for b in pl3['books']] and first in pl3['withdraw']['books'] and first not in [b['id'] for b in pl3['books']], pl3['withdraw'])
t.check('الحزمة: لا حقل replaces/ready/hasPdf ضمن الكتاب', not ({'replaces', 'ready', 'hasPdf', 'allowDownload'} & set(next(b for b in pl3['books'] if b['id'] == clone['id']))))
sha = hashlib.sha256(PDFB).hexdigest(); ref = [x for x in pl3['pdfs'] if x['id'] == clone['id']]
t.check('الحمولة تحمل بصمة SHA-256 للـPDF والملف في الغلاف بالبصمة نفسها', len(ref) == 1 and ref[0]['sha'] == sha and ref[0]['allow'] is True and base64.b64decode(env3['blobs'][sha]) == PDFB, ref)
t.check('التوقيع صحيح والغلاف يحمل الملف (تحقق مستقل)', indep_verify(env3, pub['jwk']) and 'pdfs' in pl3)

# ملف أكبر من 25 م.ب: يُحفظ محلياً (حتى 1 غ.ب) لكن الإصدار يمنعه برسالة واضحة
t.ev("""async (id) => { try { window.__orig = await SIRAJ.files.get('ctl.pdf.' + id); await SIRAJ.files.put('ctl.pdf.' + id, new Blob(['%PDF-1.4\\n', new Uint8Array(26 * 1048576)], { type: 'application/pdf' }), { name: 'big.pdf' }); return 'ok ' + (await SIRAJ.files.get('ctl.pdf.' + id)).size; } catch (e) { return 'ERR ' + e; } }""", clone['id'])
t.go('/home', 400); t.go('/publish', 1200); t.check('ملف PDF أكبر من 25 م.ب يمنع الإصدار برسالة تشير إلى رابط البث', 'ولا يمكن إرساله داخل الحزمة' in t.txt(), t.txt()[:300])
t.ev("""async (id) => { await SIRAJ.files.put('ctl.pdf.' + id, window.__orig.blob, { name: window.__orig.name }); }""", clone['id'])
t.check('نموذج الكتاب يعلن حد 1 غيغابايت', 'حتى 1 غيغابايت' in (t.go('/book/' + clone['id'], 700) or t.txt()) or 'حتى 1 غيغابايت' in t.txt())

# ---------- 10) التنقل ورجوع أندرويد ----------
t.go('/home'); t.check('الرئيسية تعرض آخر حزمة', 'آخر حزمة' in t.txt())
t.shot('ctl_home_after')
t.done()

"""اختبار «تحديثات المحتوى» في سِراج: حزم حقيقية صادرة من تطبيق التحكم + حزم مصنوعة بمفاتيح Python لاختبار الهجمات.
يشغّل control_flow.py أولاً إن لم تكن حزمه موجودة."""
import os, sys, json, base64, hashlib, subprocess, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import T, ROOT
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives import hashes

OUT = '/tmp/siraj-e2e'
if not os.path.exists(OUT + '/pack2.sirajpack') or '--regen' in sys.argv:
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tests', 'control_flow.py')], capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:]); sys.exit('control_flow فشل')
M = json.load(open(OUT + '/meta.json')); PUB = json.load(open(OUT + '/pubkey.json'))

# ---------- مفاتيح Python: B موثوق، C غير موثوق ----------
def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def newkey():
    k = ec.generate_private_key(ec.SECP256R1()); n = k.public_key().public_numbers()
    x, y = b64u(n.x.to_bytes(32, 'big')), b64u(n.y.to_bytes(32, 'big'))
    return {'k': k, 'jwk': {'kty': 'EC', 'crv': 'P-256', 'x': x, 'y': y}, 'id': hashlib.sha256((x + '.' + y).encode()).hexdigest()[:16]}
KB, KC = newkey(), newkey()
def sign(key, pl, key_id=None, raw_payload=None):
    payload = raw_payload if raw_payload is not None else json.dumps(pl, ensure_ascii=False)
    r, s = utils.decode_dss_signature(key['k'].sign(payload.encode('utf-8'), ec.ECDSA(hashes.SHA256())))
    return {'format': 'siraj-pack/1', 'keyId': key_id or key['id'], 'alg': 'ES256', 'payload': payload, 'sig': b64u(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}
def base(pid, seq, **kw):
    d = {'v': 1, 'app': 'SIRAJ', 'id': pid, 'seq': seq, 'created': datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%S.000Z'), 'title': 'حزمة ' + pid, 'notes': '', 'authors': [], 'books': [], 'duas': [], 'entries': [], 'withdraw': {'books': [], 'duas': [], 'entries': []}, 'notices': []}
    d.update(kw); return d
def book(i, **kw):
    b = {'id': i, 'title': 'كتاب ' + i, 'author': 'مؤلف ب', 'authorId': 'pa_b', 'authorDeath': 1300, 'section': 'fiqh', 'subcat': '', 'desc': 'نبذة', 'tags': ['ت'], 'publisher': '', 'year': None, 'edition': '', 'pages': None, 'lang': 'العربية', 'sourceName': 'فهرس اختباري', 'sourceUrl': 'https://example.org/b', 'digitalUrl': '', 'copyright': 'غير محدد'}
    b.update(kw); return b
AUTH_B = {'id': 'pa_b', 'name': 'مؤلف ب', 'death': 1300, 'note': ''}
def save(name, env): p = OUT + '/' + name + '.sirajpack'; json.dump(env, open(p, 'w'), ensure_ascii=False); return p

def keys_js(keys):
    return 'window.SIRAJ_PUBLISHER_KEYS=' + json.dumps([{'name': n, 'id': k['id'], 'jwk': k['jwk']} for n, k in keys], ensure_ascii=False) + ';'

# ===== أ0) المفتاح المشحون مع التطبيق (مفتاح الناشر العام من تطبيق التحكم) =====
SHIPPED = '9df05ff68810d3a2'
t = T(); pg = t.pg
ks = t.ev("window.SIRAJ_PUBLISHER_KEYS")
t.check('المشحون: مفتاح ناشر واحد ببصمة التحكم المتفق عليها', len(ks) == 1 and ks[0]['id'] == SHIPPED and ks[0]['name'] == 'الناشر', ks)
chk = t.ev("""(async()=>{const k=window.SIRAJ_PUBLISHER_KEYS[0];const j=k.jwk;
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(j.x+'.'+j.y));
  const id=[...new Uint8Array(h)].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  let ok=false;try{await crypto.subtle.importKey('jwk',{kty:j.kty,crv:j.crv,x:j.x,y:j.y,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);ok=true}catch(e){}
  return {id,ok,pub:!('d' in j)}})()""")
t.check('المشحون: البصمة = أول 16 خانة من SHA-256(x.y) والنقطة على المنحنى P-256 ولا مفتاح خاص', chk['id'] == SHIPPED and chk['ok'] and chk['pub'], chk)
t.go('/updates'); t.check('صفحة التحديثات تعرض بصمة الناشر الموثوق', SHIPPED in t.txt() and 'لا يوجد مفتاح ناشر' not in t.txt(), t.txt()[:200])
t.b.close(); t.p.stop()

# ===== أ) بلا أي مفتاح موثوق (سيناريو افتراضي بقائمة فارغة: كل حزمة تُرفض) =====
def empty_keys(r):
    if r.request.url.endswith('assets/data/publisher-keys.js'):
        r.fulfill(status=200, content_type='application/javascript', body='window.SIRAJ_PUBLISHER_KEYS=[];'); return True
    return False
t = T(override=empty_keys); pg = t.pg
t.check('بلا مفتاح: القائمة فارغة', t.ev("(window.SIRAJ_PUBLISHER_KEYS||[]).length") == 0)
t.go('/updates'); t.check('يعرض غياب مفتاح الناشر', 'لا يوجد مفتاح ناشر' in t.txt())
pg.set_input_files('[name=packfile]', OUT + '/pack1.sirajpack'); pg.click('[data-act=packCheck]'); pg.wait_for_timeout(700)
t.check('أي حزمة تُرفض بلا مفتاح موثوق', 'لا يوجد مفتاح ناشر موثوق' in t.ev("document.getElementById('pack-res').innerText") and t.ev("document.querySelector('[data-act=packApply]')") is None)
t.check('لا مسارات إدارة ولا رفع ملفات من المستخدم', t.ev("!SIRAJ.admin && !SIRAJ.ailibrary"))
for r in ['/admin', '/admin/books', '/research/import', '/library/upload']:
    t.go(r, 500); t.check('المسار ' + r + ' غير متاح', t.ev("!!document.querySelector('#view .empty, #view .notfound')") or 'غير موجود' in t.txt() or t.ev("location.hash") != '#' + r, t.txt()[:80])
t.check('لا حقول رفع ملفات كتب في الواجهة', t.ev("!document.querySelector('input[type=file][name=pdf], input[type=file][name=cover]')"))
t.b.close(); t.p.stop()

# ===== ب) مفتاحان موثوقان: التحكم + B =====
KEYS_JS = keys_js([('ناشر التحكم', {'jwk': PUB['jwk'], 'id': PUB['id']}), ('ناشر ب', KB)])
def override(r):
    if r.request.url.endswith('assets/data/publisher-keys.js'):
        r.fulfill(status=200, content_type='application/javascript', body=KEYS_JS); return True
    return False
t = T(override=override); pg = t.pg
def res(): return pg.evaluate("document.getElementById('pack-res').innerText")
def check_pack(path, wait=900):
    pg.set_input_files('[name=packfile]', path); pg.click('[data-act=packCheck]'); pg.wait_for_timeout(wait); return res()
def install(path):
    txt = check_pack(path)
    if not pg.query_selector('[data-act=packApply]'): return txt
    pg.click('[data-act=packApply]'); pg.wait_for_selector('.modal'); pg.click('.modal-ft .btn.primary'); pg.wait_for_timeout(1500); return res()
def dbget(store, i): return t.ev("(s,i)=>SIRAJ.db.get(s,i)", [store, i]) if False else pg.evaluate("([s,i])=>SIRAJ.db.get(s,i)", [store, i])

# بيانات المستخدم قبل التحديثات
pg.evaluate("SIRAJ.db.put('notes',{id:'n_user1',text:'ملاحظتي الخاصة',ts:1}).then(()=>SIRAJ.kv.set('user.marker',{a:1}))")
nb0 = pg.evaluate("SIRAJ.db.all('books').then(a=>a.length)"); nd0 = pg.evaluate("SIRAJ.db.all('duas').then(a=>a.length)")
t.go('/updates'); tx = t.txt()
t.check('يعرض الناشرَين الموثوقَين ببصمتيهما', PUB['id'] in tx and KB['id'] in tx and 'ناشر التحكم' in tx, tx[:300])

# ---- الحزمة 1 الحقيقية من تطبيق التحكم ----
txt = check_pack(OUT + '/pack1.sirajpack')
t.check('حزمة التحكم: التوقيع صحيح بمفتاح ناشر التحكم', 'التوقيع صحيح' in txt and 'ناشر التحكم' in txt and 'حزمة اختبار ١' in txt, txt[:200])
t.check('المعاينة تعرض المحتوى قبل التثبيت (كتاب/دعاء/مدخل)', 'كتاب' in txt and 'دعاء' in txt and 'مدخل' in txt)
t.check('الفحص وحده لا يكتب شيئاً', pg.evaluate("SIRAJ.db.get('books','%s')" % M['bookId']) is None)
t.shot('packs_preview')
txt = install(OUT + '/pack1.sirajpack')
t.check('تثبيت الحزمة 1', 'تم التثبيت' in txt, txt[:200])
b = dbget('books', M['bookId']); d = dbget('duas', M['duaId']); e = dbget('entries', M['entryId']); a = dbget('authors', M['authorId'])
t.check('الكتاب وصل منشوراً ومختوماً بالحزمة والمفتاح', b and b['status'] == 'published' and b['pack']['key'] == PUB['id'] and b['pack']['seq'] == M['seq1'] and b['hasPdf'] is False and b['allowDownload'] is False, b)
t.check('المؤلف وصل', a and a['name'] == 'مؤلف تجريبي للاختبار' and a['pack']['key'] == PUB['id'], a)
t.check('الدعاء وصل بنصه ومصدره وحالة موثّق', d and d['textStatus'] == 'documented' and d['textSource']['page'] == '12', d)
t.check('المدخل وصل موثّقاً بمصدره', e and e['status'] == 'documented' and e['sources'][0]['page'] == '7' and e['collection'] == 'fiqh_terms', e)
t.check('الكتاب ظاهر في المكتبة', pg.evaluate("SIRAJ.library.published().some(b=>b.id==='%s')" % M['bookId']))
t.go('/library/book/' + M['bookId'], 800); tx = t.txt()
t.check('صفحة الكتاب تعرض البيانات والمصدر', 'كتاب تجريبي للاختبار' in tx and 'فهرس تجريبي' in tx, tx[:300])
t.check('لا زر تحميل/قراءة PDF لكتاب من حزمة', not pg.query_selector('[data-act=download], [data-act=readPdf]'))
t.go('/duas/item/' + M['duaId'], 800); t.check('صفحة الدعاء تعرض النص ومصدره', 'نص اختباري وهمي' in t.txt() and 'كتاب اختباري' in t.txt(), t.txt()[:200])
t.go('/research/fiqh_terms', 800); t.check('المدخل يظهر في الموسوعة', 'مصطلح تجريبي' in t.txt(), t.txt()[:200])
t.check('عدّاد الكتب زاد بواحد والأدعية بواحد', pg.evaluate("SIRAJ.db.all('books').then(a=>a.length)") == nb0 + 1 and pg.evaluate("SIRAJ.db.all('duas').then(a=>a.length)") == nd0 + 1)
t.check('بيانات المستخدم لم تُمَسّ', pg.evaluate("SIRAJ.db.get('notes','n_user1').then(x=>!!x&&x.text==='ملاحظتي الخاصة')") and pg.evaluate("SIRAJ.kv.get('user.marker')") == {'a': 1})
st = pg.evaluate("SIRAJ.kv.get('packs.state')"); t.check('حالة الحزم: seq والمفتاح', st['keys'][PUB['id']]['seq'] == M['seq1'] and st['history'][0]['rejected'] == 0, st)

# إعادة تثبيت نفسها: آمنة
t.go('/updates'); txt = check_pack(OUT + '/pack1.sirajpack'); t.check('الحزمة نفسها: «مثبّتة من قبل»', 'مثبّتة من قبل' in txt)

# ---- هجمات على الملف ----
env1 = json.load(open(OUT + '/pack1.sirajpack'))
tam = dict(env1); tam['payload'] = env1['payload'].replace('حزمة اختبار ١', 'حزمة اختبار ٩'); 
txt = check_pack(save('x-tamper', tam)); t.check('تعديل الحمولة بعد التوقيع → مرفوض', 'التوقيع غير صحيح' in txt and not pg.query_selector('[data-act=packApply]'), txt[:160])
tam2 = dict(env1); tam2['payload'] = env1['payload'][:-1] + ' }' if env1['payload'].endswith('}') else env1['payload'] + ' '
txt = check_pack(save('x-tamper2', tam2)); t.check('مسافة زائدة واحدة تُبطل التوقيع', 'التوقيع غير صحيح' in txt)
sw = dict(env1); sw['keyId'] = KB['id']
txt = check_pack(save('x-swapid', sw)); t.check('ادّعاء بصمة مفتاح آخر موثوق → مرفوض', 'لم يُقبل' in txt and not pg.query_selector('[data-act=packApply]'), txt[:160])
unk = sign(KC, base('packC_1', 99999999, books=[book('bk_c1')], authors=[AUTH_B]))
txt = check_pack(save('x-unknown', unk)); t.check('مفتاح غير موثوق → مرفوض', 'غير موثوق' in txt, txt[:160])
unk2 = dict(unk); unk2['keyId'] = PUB['id']
txt = check_pack(save('x-unknown-claim', unk2)); t.check('توقيع مفتاح غريب بادّعاء بصمة الناشر → مرفوض', 'التوقيع غير صحيح' in txt, txt[:160])
txt = check_pack(save('x-garbage', {'hello': 'world'})); t.check('ملف JSON عشوائي → ليس حزمة', 'ليس ملف حزمة' in txt)
open(OUT + '/x-text.sirajpack', 'w').write('not json at all'); txt = check_pack(OUT + '/x-text.sirajpack'); t.check('ملف غير JSON → مرفوض', 'ليس ملف حزمة' in txt)
bad_alg = dict(env1); bad_alg['alg'] = 'none'; txt = check_pack(save('x-alg', bad_alg)); t.check('alg=none → مرفوض', 'ليس ملف حزمة' in txt)
nosig = {k: v for k, v in env1.items() if k != 'sig'}; txt = check_pack(save('x-nosig', nosig)); t.check('بلا توقيع → مرفوض', 'ليس ملف حزمة' in txt)
t.check('لم يتغيّر شيء بعد كل الهجمات', pg.evaluate("SIRAJ.kv.get('packs.state')")['history'].__len__() == 1)

# ---- الحزمة 2 الحقيقية: لقطة (الدعاء يغيب) + سحب مضمّن + إعلان ----
bund = M['bundled']; t.check('الكتاب المضمّن موجود قبل السحب', dbget('books', bund['id']) is not None)
txt = install(OUT + '/pack2.sirajpack'); t.check('تثبيت الحزمة 2', 'تم التثبيت' in txt, txt[:200])
t.check('اللقطة: الدعاء اختفى لأن الناشر لم يعد ينشره', dbget('duas', M['duaId']) is None)
t.check('الكتاب والمدخل باقيان', dbget('books', M['bookId']) is not None and dbget('entries', M['entryId']) is not None)
t.check('السحب: الكتاب المضمّن حُذف', dbget('books', bund['id']) is None)
t.check('الإعلان وصل إلى الإشعارات مرة واحدة', pg.evaluate("SIRAJ.db.all('notifications').then(a=>a.filter(n=>n.id.startsWith('pk_%s_')&&n.title==='إعلان اختباري').length)" % PUB['id']) == 1)
pg.reload(); pg.wait_for_function("document.documentElement.dataset.ready==='1'"); pg.wait_for_timeout(800)
t.check('بعد إعادة التشغيل: المسحوب لا يعود (الزرع يحترم السحب)', dbget('books', bund['id']) is None and pg.evaluate("SIRAJ.packs.isWithdrawn('books','%s')" % bund['id']))
t.go('/updates'); txt = install(OUT + '/pack2.sirajpack'); t.check('إعادة تثبيت الحزمة 2: لا تكرار للإعلان', pg.evaluate("SIRAJ.db.all('notifications').then(a=>a.filter(n=>n.title==='إعلان اختباري').length)") == 1)
t.go('/updates'); txt = check_pack(OUT + '/pack1.sirajpack')
t.check('منع الرجوع: الحزمة 1 بعد 2 مرفوضة', 'أقدم من المثبّتة' in txt and not pg.query_selector('[data-act=packApply]'), txt[:160])

# ---- حزم المفتاح B: تحقق العناصر رغم صحة التوقيع ----
sample_book = pg.evaluate("SIRAJ.data.sample.books[10].id"); wd_book = pg.evaluate("SIRAJ.data.sample.books[11].id"); sample_dua = pg.evaluate("SIRAJ.data.duas.items[0].id"); cat0 = pg.evaluate("SIRAJ.data.duas.categories[0].id")
good_dua = {'id': 'du_b_ok', 'kind': 'dua', 'title': 'دعاء ب سليم', 'cat': cat0, 'text': 'نص وهمي للاختبار', 'textSource': {'book': 'كتاب ب', 'author': '', 'edition': '', 'part': '', 'page': '5', 'url': ''}}
pl = base('packB_1', 100,
    authors=[AUTH_B],
    books=[book('bk_b_ok'), book('bk_b_nosrc', sourceName='', sourceUrl=''), book('bk_b_jsurl', sourceUrl='javascript:alert(1)'),
           book(sample_book, title='محاولة استبدال مضمّن'), book('bk_b_noauth', authorId='pa_zzz'), book('bk_b_badsec', section='لا_قسم'),
           book('bk_b_xss', title='<img src=x onerror="window.__xss=1">عنوان'),
           book('bk_b_over', title='حقول زائدة', status='draft', hasPdf=True, allowDownload=True, reads=9999, downloads=777, demo=True, pack={'key': 'fake'})],
    duas=[good_dua, {'id': 'du_b_nosrc', 'kind': 'dua', 'title': 'نص بلا مصدر', 'cat': cat0, 'text': 'نص', 'textSource': {'book': '', 'page': ''}}, {'id': 'du_b_title', 'kind': 'dua', 'title': 'عنوان فقط', 'cat': cat0, 'text': '', 'textSource': None},
          dict(good_dua, id=sample_dua, title='محاولة استبدال دعاء مضمّن'), dict(good_dua, id='du_b_badcat', cat='لا_تصنيف')],
    entries=[{'id': 'en_b_ok', 'collection': 'fiqh_terms', 'title': 'مصطلح ب', 'text': 'تعريف وهمي', 'verses': [], 'tags': [], 'sources': [{'book': 'كتاب ب', 'page': '3'}], 'extra': {'related': ''}},
             {'id': 'en_b_nosrc', 'collection': 'fiqh_terms', 'title': 'بلا مصدر', 'text': 'نص', 'sources': []},
             {'id': 'en_b_badcol', 'collection': 'no_such', 'title': 'مجموعة غريبة', 'text': 'نص', 'sources': [{'book': 'ك', 'page': '1'}]},
             {'id': 'en_b_verse', 'collection': 'tafsir', 'title': 'آية غير موجودة', 'text': 'نص', 'verses': ['2:9999'], 'sources': [{'book': 'ك', 'page': '1'}], 'extra': {'mufassir': 'م'}}],
    withdraw={'books': [wd_book], 'duas': [], 'entries': []})
txt = install(save('b1', sign(KB, pl))); t.check('حزمة B: تثبّتت جزئياً مع قائمة مرفوضات', 'تم التثبيت' in txt and 'لم تُقبل' in txt, txt[:400])
ok_ids = {'bk_b_ok': True, 'bk_b_xss': True, 'bk_b_over': True}; bad_b = ['bk_b_nosrc', 'bk_b_jsurl', 'bk_b_noauth', 'bk_b_badsec']
t.check('الكتب السليمة دخلت', all(dbget('books', i) for i in ok_ids))
t.check('الكتب غير الموثّقة/الخطرة رُفضت (بلا مصدر، javascript:، مؤلف مجهول، قسم مجهول)', not any(dbget('books', i) for i in bad_b))
orig = pg.evaluate("SIRAJ.data.sample.books.find(b=>b.id==='%s')" % sample_book)
t.check('محاولة استبدال كتاب مضمّن مرفوضة (يبقى الأصل)', (dbget('books', sample_book) or {}).get('title') == orig['title'] and not (dbget('books', sample_book) or {}).get('pack'))
t.check('سحب كتاب مضمّن آخر من ناشر موثوق يحذفه', dbget('books', wd_book) is None and pg.evaluate("SIRAJ.packs.isWithdrawn('books','%s')" % wd_book))
ov = dbget('books', 'bk_b_over')
t.check('الحقول الزائدة ألغيت: منشور، بلا PDF، بلا تحميل، عدّاد صفر، ختم الحزمة الحقيقي', ov['status'] == 'published' and ov['hasPdf'] is False and ov['allowDownload'] is False and ov['reads'] == 0 and ov['downloads'] == 0 and ov['demo'] is False and ov['pack']['key'] == KB['id'], ov)
t.check('دعاء سليم دخل وبلا مصدر رُفض وعنوان فقط دخل «ناقص»', dbget('duas', 'du_b_ok') and dbget('duas', 'du_b_nosrc') is None and (dbget('duas', 'du_b_title') or {}).get('textStatus') == 'missing')
t.check('دعاء مضمّن لم يُستبدل ولا بتصنيف مجهول', (dbget('duas', sample_dua) or {}).get('title') != 'محاولة استبدال دعاء مضمّن' and dbget('duas', 'du_b_badcat') is None)
t.check('مداخل: السليم دخل؛ بلا مصدر/مجموعة مجهولة/آية خارج السورة رُفضت', dbget('entries', 'en_b_ok') and not any(dbget('entries', i) for i in ['en_b_nosrc', 'en_b_badcol', 'en_b_verse']))
t.go('/library/book/bk_b_xss', 900); 
t.check('XSS: عنوان فيه HTML لا يُنفَّذ ولا يُنشأ عنصره', pg.evaluate("window.__xss===undefined && !document.querySelector('#view img[src=x]')") and '<img' in t.txt(), t.txt()[:120])
st = pg.evaluate("SIRAJ.kv.get('packs.state')"); t.check('تاريخ B يسجّل عدد المرفوض', st['history'][0]['key'] == KB['id'] and st['history'][0]['rejected'] >= 11, st['history'][0])

# ---- seq: نفس الرقم بمعرّف مختلف يرفض ----
t.go('/updates'); txt = check_pack(save('b-conflict', sign(KB, base('packB_OTHER', 100)))); t.check('الرقم نفسه بمعرّف مختلف → مرفوض', 'معرّفها مختلف' in txt and not pg.query_selector('[data-act=packApply]'), txt[:160])
txt = check_pack(save('b-older', sign(KB, base('packB_0', 50)))); t.check('رقم أقدم من المثبّت للمفتاح نفسه → مرفوض', 'أقدم' in txt)
# مفتاح التحكم ومفتاح B مستقلان في عدّاد seq: حزمة B برقم صغير جداً كانت ستُقبل لو لم يثبّت B سابقاً، لكن seq 150 > 100 مقبول
# ---- حزمة B2: لقطة + رفع السحب + حذف المتقادم ----
pl2 = base('packB_2', 150, authors=[AUTH_B], books=[book('bk_b_ok', title='كتاب ب بعد التحديث')], duas=[good_dua], entries=[], withdraw={'books': [], 'duas': [], 'entries': []})
txt = install(save('b2', sign(KB, pl2))); t.check('تثبيت B2', 'تم التثبيت' in txt, txt[:200])
t.check('تحديث نفس المعرّف (تعديل عنوان) يقبل ويحفظ ختم seq الجديد', (dbget('books', 'bk_b_ok') or {}).get('title') == 'كتاب ب بعد التحديث' and dbget('books', 'bk_b_ok')['pack']['seq'] == 150)
t.check('لقطة B: كتب B الغائبة حُذفت (xss, over)', dbget('books', 'bk_b_xss') is None and dbget('books', 'bk_b_over') is None and dbget('entries', 'en_b_ok') is None and dbget('duas', 'du_b_title') is None)
orig2 = pg.evaluate("SIRAJ.data.sample.books.find(b=>b.id==='%s')" % wd_book)
t.check('رفع السحب يعيد الكتاب المضمّن (من بيانات التطبيق)', (dbget('books', wd_book) or {}).get('title') == orig2['title'] and not pg.evaluate("SIRAJ.packs.isWithdrawn('books','%s')" % wd_book))
t.check('حزم ناشر التحكم لم تتأثر بحزم B', dbget('books', M['bookId']) is not None and dbget('entries', M['entryId']) is not None)

# ---- النسخ الاحتياطي لا يحقن محتوى ----
inj = {'app': 'SIRAJ', 'stores': {'books': [{'id': 'evil_book', 'title': 'شرير', 'status': 'published', 'section': 'fiqh'}], 'duas': [{'id': 'evil_dua', 'title': 'x', 'text': 'y'}], 'entries': [{'id': 'evil_en', 'collection': 'fiqh_terms', 'title': 'x'}], 'users': [{'id': 'u_evil', 'role': 'admin'}], 'notes': [{'id': 'n_restored', 'text': 'ملاحظة مستعادة'}]}, 'kv': {'packs.state': {'keys': {}, 'history': [], 'withdrawn': {}}, 'seed.v': 0, 'auth.session': {'uid': 'u_evil'}, 'user.restored': 1}}
n = pg.evaluate("t=>SIRAJ.backup.import(t)", json.dumps(inj))
t.check('الاستعادة تقبل بيانات المستخدم فقط', pg.evaluate("SIRAJ.db.get('notes','n_restored').then(x=>!!x)") and pg.evaluate("SIRAJ.kv.get('user.restored')") == 1)
t.check('الاستعادة لا تحقن كتباً/أدعية/مداخل/مستخدمين', all(dbget(s, i) is None for s, i in [('books', 'evil_book'), ('duas', 'evil_dua'), ('entries', 'evil_en')]) and pg.evaluate("SIRAJ.db.all('users').then(a=>a.length)") == 0)
t.check('الاستعادة لا تعبث بحالة الحزم ولا الجلسات', pg.evaluate("SIRAJ.kv.get('packs.state')")['keys'][KB['id']]['seq'] == 150 and pg.evaluate("SIRAJ.kv.get('auth.session')") is None and pg.evaluate("SIRAJ.kv.get('seed.v')") != 0)
bk = pg.evaluate("SIRAJ.backup.export().then(b=>b.text())"); jb = json.loads(bk)
t.check('تصدير النسخة: لا كتب/أدعية/مداخل ولا حالة الحزم', not ({'books', 'duas', 'entries', 'authors', 'users'} & set(jb['stores'])) and 'packs.state' not in jb['kv'])
t.check('نسخة المستخدم تحوي ملاحظته', any(x['id'] == 'n_user1' for x in jb['stores']['notes']))
t.go('/updates'); t.shot('packs_after'); t.check('صفحة التحديثات تعرض السجل', 'السجل' in t.txt() and 'حزمة' in t.txt())
t.done()

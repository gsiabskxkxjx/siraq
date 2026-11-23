"""سكربت جلب الأحاديث (scripts/fetch-thaqalayn.mjs) ضد خادم وهمي: قبول/رفض البنود، العيّنة، الكتب الفاشلة، الفشل غير القاتل.
النصوص هنا اختبارية صريحة («نص اختبار…») وليست أحاديث؛ الاختبار يثبت منطق التحقق لا صحة مطابقته لبنية الخدمة الحقيقية."""
import json, os, subprocess, sys, threading, http.server, socketserver, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + ((' — ' + str(x)[:300]) if not c else ''))
    if not c: fails.append(n)

def fake(i, pre='نص اختبار صريح لا يمثل حديثاً ولا رواية رقم'):
    return f'{pre} {i} لأجل التحقق من منطق الاستيراد فقط وليس لأي غرض آخر'
KAFI = [{'id': i, 'arabicText': fake(i), 'englishText': 'English translation must be ignored', 'URL': f'https://thaqalayn.net/hadith/1/1/1/{i}', 'chapter': 'English chapter'} for i in range(1, 201)]
KAFI += [{'id': 900, 'arabicText': 'قصير'}, {'id': 901, 'arabicText': 'only english text here that is long enough to pass the length limit for sure'}, {'id': 902, 'arabicText': fake(1)},  # مكرر
         {'id': 903, 'arabicText': '<p>' + fake(903) + '</p>'}, {'id': 904, 'arabicText': 'ن' * 5000}]
FAQIH = [{'hadithNumber': 7000 + i, 'arabic': fake(i, 'اختبار آخر رقم')} for i in range(60)]
SAH = [{'id': i, 'arabicText': fake(i, 'اختبار دعاء رقم') + ' ' + 'كلمة ' * 300} for i in range(1, 11)]
BOOKS = [{'bookId': 'Al-Kafi-Volume-1', 'BookName': 'Al-Kafi - Volume 1', 'author': 'Shaykh al-Kulayni'},
         {'bookId': 'Man-La-Yahduruh-al-Faqih-Volume-1', 'BookName': 'Man La Yahduruh al-Faqih', 'author': 'Shaykh al-Saduq'},
         {'bookId': 'Al-Sahifa-al-Sajjadiyya', 'BookName': 'Al-Sahifa al-Sajjadiyya'},
         {'bookId': 'Broken-Book', 'BookName': 'Broken'}, {'bookId': 'Unknown-Book-X', 'BookName': 'Some Unknown Book', 'author': 'Someone'}]
UNK = [{'id': i, 'arabicText': fake(i, 'اختبار كتاب مجهول رقم')} for i in range(30)]
DATA = {'/allbooks': BOOKS, '/Al-Kafi-Volume-1': KAFI, '/Man-La-Yahduruh-al-Faqih-Volume-1': FAQIH, '/Al-Sahifa-al-Sajjadiyya': SAH, '/Unknown-Book-X': UNK}
MODE = {'allbooks_fail': False}
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = self.path.split('?')[0]
        if p.startswith('/api/v2'): p = p[7:]
        if (p == '/allbooks' and MODE['allbooks_fail']) or p == '/Broken-Book' or p not in DATA:
            self.send_response(500); self.end_headers(); return
        b = json.dumps(DATA[p], ensure_ascii=False).encode(); self.send_response(200); self.send_header('content-type', 'application/json'); self.end_headers(); self.wfile.write(b)
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]; threading.Thread(target=srv.serve_forever, daemon=True).start()

def run(out, extra=None):
    env = dict(os.environ, THAQALAYN_BASE=f'http://127.0.0.1:{port}/api/v2', THAQALAYN_OUT=out, HADITH_MAX_TOTAL='100', HADITH_PER_BOOK='40', **(extra or {}))
    return subprocess.run(['node', os.path.join(ROOT, 'scripts/fetch-thaqalayn.mjs')], env=env, capture_output=True, text=True, timeout=120)

d = tempfile.mkdtemp(); out = os.path.join(d, 'x', 'thaqalayn.json')
r = run(out)
check('السكربت ينتهي بنجاح', r.returncode == 0, r.stdout + r.stderr)
j = json.load(open(out, encoding='utf8'))
by = {b['id']: b for b in j['books']}
check('الكتاب المعطوب تجاوزه دون إيقاف البقية', 'Broken-Book' not in by and len(j['books']) == 4, [b['id'] for b in j['books']])
k = by['Al-Kafi-Volume-1']
check('الصالح من الكافي يستثني القصير والإنجليزي والمكرر والطويل جداً (201 مقبولاً؛ والمأخوذ 20 = ceil(100/5 كتب))', k['valid'] == 201 and k['taken'] == 20, k)
check('أسماء عربية للكتب المعروفة', k['title'] == 'الكافي' and by['Man-La-Yahduruh-al-Faqih-Volume-1']['title'] == 'من لا يحضره الفقيه', [b['title'] for b in j['books']])
check('كتاب مجهول يبقى باسم الخدمة ويحتفظ بمؤلفه', by['Unknown-Book-X']['title'] == 'Some Unknown Book' and by['Unknown-Book-X']['author'] == 'Someone')
check('الصحيفة تُصنَّف أدعية لا روايات', by['Al-Sahifa-al-Sajjadiyya']['kind'] == 'dua' and len(j['duas']) == 10 and all(x['book'] == 'الصحيفة السجادية' for x in j['duas']))
check('الإجمالي ضمن الحد (100 تقريباً) والعيّنة موزعة (ليست أول N)', len(j['items']) <= 100 + 5 and max(int(x['number']) for x in j['items'] if x['bookId'] == 'Al-Kafi-Volume-1') > 150, len(j['items']))
check('لا ترجمة إنجليزية في المخرجات', 'English translation' not in json.dumps(j, ensure_ascii=False) and 'English chapter' not in json.dumps(j, ensure_ascii=False))
check('رابط الحديث محفوظ إن كان https وإلا يرجع لموقع المصدر', any(x['url'].startswith('https://thaqalayn.net/hadith/') for x in j['items']) and all(x['url'].startswith('https://') for x in j['items']))
check('HTML منزوع من النص', all('<' not in x['text'] for x in j['items']))
check('كل بند فيه كتاب ورقم ونص ومعرّف فريد', all(x['book'] and x['number'] and x['text'] and x['id'] for x in j['items']) and len({x['id'] for x in j['items']}) == len(j['items']))
check('بصمة التغيّر موجودة', len(j['stamp']) == 16)
r2 = run(out + '2'); j2 = json.load(open(out + '2', encoding='utf8'))
check('حتمية: بناءان متتاليان يعطيان البصمة نفسها', j2['stamp'] == j['stamp'])

# فشل قائمة الكتب: الخروج بنجاح مع تحذير وبلا ملف
MODE['allbooks_fail'] = True; out3 = os.path.join(d, 'none.json'); r3 = run(out3)
check('فشل الخدمة غير قاتل (exit 0) مع تحذير ولا ملف', r3.returncode == 0 and '::warning' in r3.stdout and not os.path.exists(out3), r3.stdout[-300:])
sys.exit(1 if fails else 0)

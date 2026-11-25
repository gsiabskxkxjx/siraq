"""استيراد الأحاديث المضمَّنة داخل التطبيق (thaqalayn.json) — النصوص اختبارية صريحة وليست أحاديث."""
import json
from common import T

CAP = "window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{}};"
def fx(stamp, drop=()):
    def txt(i, p): return f'{p} {i} نص اختبار صريح لا يمثل حديثاً يُستخدم للتحقق من الاستيراد فقط'
    items = []
    for bk, bid in (('الكافي', 'kafi'), ('من لا يحضره الفقيه', 'faqih')):
        for i in range(1, 31):
            if f'{bid}_{i}' in drop: continue
            items.append({'id': f'{bid}_{i}', 'book': bk, 'author': 'مؤلف اختبار', 'number': str(i), 'text': txt(i, bk), 'url': f'https://thaqalayn.net/hadith/{bid}/{i}', 'chapter': '', 'bookId': bid})
    duas = [{'id': f'sahifa_{i}', 'book': 'الصحيفة السجادية', 'author': '', 'number': str(i), 'text': txt(i, 'دعاء'), 'url': 'https://thaqalayn.net', 'chapter': '', 'bookId': 'sahifa'} for i in range(1, 4)]
    return {'version': 1, 'source': {'name': 'Thaqalayn', 'site': 'https://thaqalayn.net', 'fetchedAt': '2026-11-23T10:00:00Z'}, 'books': [], 'items': items, 'duas': duas, 'stamp': stamp}
STATE = {'body': json.dumps(fx('s1'), ensure_ascii=False), 'hits': 0}
def override(r):
    if r.request.url.endswith('assets/data/thaqalayn.json'):
        STATE['hits'] += 1; r.fulfill(status=200, content_type='application/json', body=STATE['body']); return True
    return False

t = T(init_js=CAP, override=override); pg = t.pg
pg.wait_for_function("SIRAJ.kv.get('thaqalaynImport')", timeout=8000)
st = t.ev("SIRAJ.kv.get('thaqalaynImport')")
t.check('استُورد 60 حديثاً و3 أدعية', st['n'] == 60 and st['nd'] == 3, st)
n = t.ev("SIRAJ.db.where('entries','collection','narrations').then(a=>a.filter(e=>e.status==='imported').length)")
t.check('الروايات في موسوعة الروايات بحالة imported', n == 60, n)
e = t.ev("SIRAJ.db.get('entries','nth_kafi_5')")
t.check('المدخل: مصدر بكتاب ورقم ورابط https ونص', e['sources'][0]['book'] == 'الكافي' and e['sources'][0]['number'] == '5' and e['sources'][0]['url'].startswith('https://thaqalayn.net') and 'الكافي 5' in e['text'], e)
t.check('المدخل يجتاز قاعدة «لا مدخل بلا مصدر» (كتاب + موضع)', bool(e['sources'][0]['book']) and bool(e['sources'][0]['number']))
t.check('الاستيراد لا ينتظره الإقلاع (انتهى الإقلاع قبل الكتابة أو أثناءها دون خطأ)', t.ev("document.documentElement.dataset.ready")=='1')

t.go('/research/narrations', 700); x = t.txt()
t.check('القائمة: إشعار «رواية مستوردة آلياً» والعدد', 'مستوردة آلياً' in x and ('60' in x or '٦٠' in x), x[:400])
t.check('القائمة: مرشحات الكتب (الكافي، من لا يحضره الفقيه)', 'الكافي (' in x and 'من لا يحضره الفقيه (' in x, x[:600])
t.check('القائمة: شارة «مستورد آلياً — لم يُراجَع»', 'مستورد آلياً — لم يُراجَع' in x)
t.go('/research/narrations?book=' + 'الكافي', 700); x = t.txt()
t.check('مرشح الكتاب يُظهر الكافي فقط (30)', ('30' in x or '٣٠' in x) and 'من لا يحضره الفقيه — حديث' not in x, x[:300])
t.go('/research/narrations/nth_kafi_5', 700); x = t.txt()
t.check('صفحة الرواية: تنبيه الاستيراد + رابط التحقق + النص', 'نص مستورد آلياً' in x and 'thaqalayn.net' in t.ev("document.getElementById('view').innerHTML") and 'نص اختبار صريح' in x, x[:300])
t.go('/duas/cat/sahifa', 700); x = t.txt()
t.check('الأدعية المستوردة تظهر في تصنيف الصحيفة بعنوان من مطلع النص', 'الصحيفة السجادية' in x and 'نص اختبار صريح' in x and '—' not in x.split('الصحيفة السجادية')[0][-3:], x[:300])
t.go('/home', 900); x = t.txt()
t.check('الرئيسية: حديث اليوم يعرض مصدراً (كتاب ورقم)', 'حديث اليوم' in x and 'المصدر:' in x and 'رقم' in x, x[:900])

# الاستيراد المكرر بنفس البصمة لا يكتب شيئاً
r = t.ev("SIRAJ.thaqalayn.importBundled()")
t.check('الاستيراد المكرر بنفس البصمة مخبأ', r.get('cached') is True, r)

# مدخل اعتمده مراجع لا يُستبدل، والمحذوف من الملف الجديد يُزال، والجديد البصمة يُحدَّث
t.ev("(async()=>{const e=await SIRAJ.db.get('entries','nth_kafi_6'); e.status='reviewed'; e.reviewed={by:'مراجع'}; e.text='نص عدّله المراجع بعد المقابلة بالمصدر'; await SIRAJ.db.put('entries',e); return 1})()")
STATE['body'] = json.dumps(fx('s2', drop=('kafi_7', 'faqih_1')), ensure_ascii=False)
r = t.ev("SIRAJ.thaqalayn.importBundled()")
t.check('بصمة جديدة: يُعاد الاستيراد (58)', r.get('n') == 58 and not r.get('cached'), r)
t.check('المدخل المعتمد من مراجع بقي بنصه', t.ev("SIRAJ.db.get('entries','nth_kafi_6').then(e=>e.status==='reviewed'&&e.text.startsWith('نص عدّله'))"))
t.check('المحذوف من الملف الجديد أُزيل', t.ev("SIRAJ.db.get('entries','nth_kafi_7')") is None and t.ev("SIRAJ.db.get('entries','nth_faqih_1')") is None)
t.check('بقية المدخلات باقية', t.ev("SIRAJ.db.where('entries','collection','narrations').then(a=>a.filter(e=>/^nth_/.test(e.id)).length)") == 58)

# ملف فاسد: لا ينهار ولا يمسح ما سبق
STATE['body'] = '{"version":2,"items":"x"}'
r = t.ev("SIRAJ.thaqalayn.importBundled(true)")
t.check('ملف بنية غير متوقعة: يُرفض بهدوء', r.get('n') == 0 and r.get('reason') == 'invalid', r)
t.check('ما سبق بقي سليماً', t.ev("SIRAJ.db.where('entries','collection','narrations').then(a=>a.filter(e=>/^nth_/.test(e.id)).length)") == 58)
STATE['body'] = json.dumps({'version': 1, 'items': [{'id': 'a', 'book': 'ك', 'number': '1', 'text': 'قصير', 'url': 'http://x'}], 'duas': [], 'stamp': 'z'})
r = t.ev("SIRAJ.thaqalayn.importBundled(true)")
t.check('بنود غير صالحة (قصير/غير https) تُهمل', r.get('n') == 0, r)
t.done()

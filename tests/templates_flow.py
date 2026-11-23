"""اختبار أن قوالب docs/import-templates تُقبل فعلاً من شاشات الاستيراد (وأن غير الموثق يُرفض)"""
import os, json, tempfile
from common import T, ROOT
t = T(); pg = t.pg
TP = os.path.join(ROOT, 'docs', 'import-templates')

def login(u, p):
    t.go('/admin'); pg.fill('#f_lu', u); pg.fill('#f_lp', p); pg.click('[data-act=admLogin]'); pg.wait_for_timeout(800)
login('owner', '1111')

# كتب: تدخل pending لا published
t.go('/admin/import')
pg.set_input_files('[name=jf]', os.path.join(TP, 'books-import.template.json')); pg.click('[data-act=admImportBooks]'); pg.wait_for_timeout(900)
b = t.ev("SIRAJ.library.books.filter(b=>b.title==='عنوان الكتاب')")
t.check('استيراد كتب: أُضيف الكتاب', len(b) == 1, t.txt()[-200:])
t.check('استيراد كتب: حالته بانتظار الموافقة وليس منشوراً', b and b[0]['status'] == 'pending')
t.check('استيراد كتب: حالة الحقوق «غير محدد» ولا ملف', b and b[0]['copyright'] == 'غير محدد' and not b[0].get('hasPdf'))
pg.set_input_files('[name=jf]', os.path.join(TP, 'books-import.template.json')); pg.click('[data-act=admImportBooks]'); pg.wait_for_timeout(900)
t.check('استيراد كتب: التكرار يُتخطى', len(t.ev("SIRAJ.library.books.filter(b=>b.title==='عنوان الكتاب')")) == 1)

# أدعية
t.go('/admin/duas/import')
pg.set_input_files('[name=jf]', os.path.join(TP, 'duas-import.template.json')); pg.click('[data-act=admImportDuas]'); pg.wait_for_timeout(900)
d = t.ev("SIRAJ.db.all('duas').then(a=>a.filter(x=>x.title==='عنوان الدعاء'))")
t.check('استيراد أدعية: قُبل القالب (له مصدر)', len(d) == 1, t.txt()[-200:])
# دعاء بلا مصدر يُرفض
tmp = os.path.join(tempfile.mkdtemp(), 'bad.json')
json.dump([{"title": "بلا مصدر", "kind": "dua", "cat": "daily", "text": "نص"}], open(tmp, 'w', encoding='utf8'), ensure_ascii=False)
pg.set_input_files('[name=jf]', tmp); pg.click('[data-act=admImportDuas]'); pg.wait_for_timeout(900)
t.check('استيراد أدعية: بلا مصدر يُرفض', len(t.ev("SIRAJ.db.all('duas').then(a=>a.filter(x=>x.title==='بلا مصدر'))")) == 0 and 'رُفض' in t.txt(), t.txt()[-200:])

# الموسوعات: روايات وتفسير
for col, tpl, title in [('narrations', 'narrations-import.template.json', 'عنوان وصفي'), ('tafsir', 'tafsir-import.template.json', None)]:
    t.go('/research/docs')
    pg.select_option('#f_impcol', col)
    pg.set_input_files('[name=impf]', os.path.join(TP, tpl)); pg.click('[data-act=entImport]'); pg.wait_for_timeout(900)
    n = t.ev("SIRAJ.db.where('entries','collection','%s').then(a=>a.length)" % col)
    t.check('استيراد %s: قُبل القالب' % col, n == 1, t.txt()[-250:])
# رواية بلا مصدر تُرفض
json.dump([{"title": "رواية بلا مصدر", "text": "نص", "sources": []}], open(tmp, 'w', encoding='utf8'), ensure_ascii=False)
t.go('/research/docs'); pg.select_option('#f_impcol', 'narrations'); pg.set_input_files('[name=impf]', tmp); pg.click('[data-act=entImport]'); pg.wait_for_timeout(900)
t.check('استيراد روايات: بلا مصدر يُرفض', t.ev("SIRAJ.db.where('entries','collection','narrations').then(a=>a.length)") == 1)
t.done()

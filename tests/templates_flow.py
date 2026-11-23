"""اختبار أن قوالب docs/import-templates تُقبل من شاشة «استيراد من ملف» في تطبيق التحكم (كمسودات) وأن غير الموثّق يُرفض"""
import os, json, tempfile, subprocess
from common import T, ROOT
WWW = '/tmp/ctl-www-tpl'
subprocess.run(['node', os.path.join(ROOT, 'scripts', 'prepare-control.mjs'), '--out', WWW], check=True, capture_output=True)
t = T(root=WWW); pg = t.pg
TP = os.path.join(ROOT, 'docs', 'import-templates')
def imp(kind, path, col=None):
    t.go('/import'); pg.select_option('#f_imptype', kind)
    if col: pg.select_option('#f_impcol', col)
    pg.set_input_files('[name=jf]', path); pg.click('[data-act=impRun]'); pg.wait_for_timeout(1000)
    return t.ev("document.getElementById('imp-out').innerText")

# كتب: تدخل مسودة لا «جاهز»
out = imp('books', os.path.join(TP, 'books-import.template.json'))
b = t.ev("SIRAJ.db.all('books').then(a=>a.filter(b=>b.title==='عنوان الكتاب'))")
t.check('استيراد كتب: أُضيف الكتاب', len(b) == 1, out)
t.check('استيراد كتب: مسودة وليس جاهزاً', b and b[0]['ready'] is False)
t.check('استيراد كتب: حالة الحقوق «غير محدد» ولا ملف', b and b[0]['copyright'] == 'غير محدد' and not b[0].get('hasPdf'))
out = imp('books', os.path.join(TP, 'books-import.template.json'))
t.check('استيراد كتب: التكرار يُرفض', len(t.ev("SIRAJ.db.all('books').then(a=>a.filter(b=>b.title==='عنوان الكتاب'))")) == 1 and 'مكرر' in out, out)

# أدعية
out = imp('duas', os.path.join(TP, 'duas-import.template.json'))
d = t.ev("SIRAJ.db.all('duas').then(a=>a.filter(x=>x.title==='عنوان الدعاء'))")
t.check('استيراد أدعية: قُبل القالب (له مصدر) كمسودة', len(d) == 1 and d[0]['ready'] is False, out)
tmp = os.path.join(tempfile.mkdtemp(), 'bad.json')
json.dump([{"title": "بلا مصدر", "kind": "dua", "cat": "daily", "text": "نص"}], open(tmp, 'w', encoding='utf8'), ensure_ascii=False)
out = imp('duas', tmp)
t.check('استيراد أدعية: بلا مصدر يُرفض', len(t.ev("SIRAJ.db.all('duas').then(a=>a.filter(x=>x.title==='بلا مصدر'))")) == 0 and 'رُفض' in out, out)

# الموسوعات: روايات وتفسير
for col, tpl in [('narrations', 'narrations-import.template.json'), ('tafsir', 'tafsir-import.template.json')]:
    imp('entries', os.path.join(TP, tpl), col)
    es = t.ev("SIRAJ.db.all('entries').then(a=>a.filter(x=>x.collection==='%s'))" % col)
    t.check('استيراد %s: قُبل القالب كمسودة' % col, len(es) == 1 and es[0]['ready'] is False, t.ev("document.getElementById('imp-out').innerText"))
t.check('التفسير: العنوان والمفسّر من القالب', t.ev("SIRAJ.db.all('entries').then(a=>a.find(x=>x.collection==='tafsir'))")['extra']['mufassir'] == 'اسم كتاب التفسير')
json.dump([{"title": "رواية بلا مصدر", "text": "نص", "sources": []}], open(tmp, 'w', encoding='utf8'), ensure_ascii=False)
imp('entries', tmp, 'narrations')
t.check('استيراد روايات: بلا مصدر يُرفض', t.ev("SIRAJ.db.all('entries').then(a=>a.filter(x=>x.collection==='narrations').length)") == 1)
t.check('لا شيء من المستورد «جاهز» تلقائياً', t.ev("Promise.all(['books','duas','entries'].map(s=>SIRAJ.db.all(s))).then(r=>r.flat().filter(x=>x.ready).length)") == 0)
t.done()

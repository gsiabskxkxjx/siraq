#!/usr/bin/env python3
"""قارئ PDF: فتح ملف حقيقي (reportlab) والتحقق من العرض والصفحات والبحث والفهرس والتظليل والإشارات واستئناف القراءة."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import T
t = T(); BID = 'b_shara-i'
# إرفاق الملف كما يفعل المحرر
t.ev("""async (id) => { const r = await fetch('tests/fixtures/sample.pdf'); const blob = await r.blob(); await SIRAJ.files.put('pdf:' + id, blob);
  const b = SIRAJ.library.byId.get(id); b.hasPdf = true; await SIRAJ.library.save(b); }""", BID)
t.go('/library/book/' + BID); t.check('زر القراءة يظهر بعد إرفاق PDF', 'قراءة' in t.txt())
t.go('/library/read/' + BID, 2500)
t.check('عدد الصفحات 12', t.ev("document.getElementById('rd-total').textContent").strip().endswith('12') or '١٢' in t.ev("document.getElementById('rd-total').textContent"), t.ev("document.getElementById('rd-total').textContent"))
t.check('12 عنصر صفحة', t.ev("document.querySelectorAll('.pdf-page').length") == 12)
nonblank = lambda i: t.ev("""(i)=>{const c=document.querySelector('#pg-'+i+' canvas'); if(!c) return -1; const x=c.getContext('2d'); const d=x.getImageData(0,0,c.width,c.height).data; let dark=0; for(let k=0;k<d.length;k+=16){ if(d[k]<120) dark++; } return dark;}""", i)
t.check('الصفحة 1 مرسومة وفيها نص', nonblank(1) > 200, nonblank(1))
t.check('طبقة النص موجودة', t.ev("document.querySelectorAll('#pg-1 .textLayer span').length") > 5)
# الانتقال لصفحة 5
t.pg.fill('#rd-page', '5'); t.pg.dispatch_event('#rd-page', 'change'); t.pg.wait_for_timeout(1500)
t.check('الانتقال إلى صفحة 5 يرسمها', nonblank(5) > 200, nonblank(5))
# تحرير الصفحات البعيدة
t.pg.fill('#rd-page', '12'); t.pg.dispatch_event('#rd-page', 'change'); t.pg.wait_for_timeout(1500)
t.check('الصفحة 12 مرسومة', nonblank(12) > 200, nonblank(12))
rendered = t.ev("document.querySelectorAll('.pdf-page canvas').length"); t.check('لا تبقى كل الصفحات في الذاكرة (تحميل كسول)', rendered <= 11, rendered)
# الفهرس
t.pg.click('[data-act=rdDrawer][data-tab=outline]'); t.pg.wait_for_timeout(800)
t.check('الفهرس يعرض 12 فصلاً', t.ev("document.querySelectorAll('#rd-dr-bd .li').length") == 12, t.ev("document.getElementById('rd-dr-bd').innerText")[:100])
t.pg.click('#rd-dr-bd .li:nth-child(3)'); t.pg.wait_for_timeout(900); t.check('النقر على فصل يفتح صفحته', t.ev("document.getElementById('rd-page').value") == '3', t.ev("document.getElementById('rd-page').value"))
# البحث
t.pg.click('[data-act=rdDrawer][data-tab=search]'); t.pg.wait_for_timeout(300); t.pg.fill('#rd-q', 'needle'); t.pg.press('#rd-q', 'Enter'); t.pg.wait_for_timeout(2500)
res = t.ev("document.querySelectorAll('#rd-res .li').length"); t.check('البحث يجد صفحتين (3 و9)', res == 2, t.ev("document.getElementById('rd-res').innerText")[:150])
t.pg.click('#rd-res .li:nth-child(3)'); t.pg.wait_for_timeout(1500); t.check('نتيجة البحث تنقل إلى صفحة 9', t.ev("document.getElementById('rd-page').value") == '9', t.ev("document.getElementById('rd-page').value"))
t.check('إبراز النتائج في طبقة النص', t.ev("document.querySelectorAll('#pg-9 .textLayer span.hit').length") >= 1)
# إشارة مرجعية
t.pg.click('#rd-bm'); t.pg.wait_for_timeout(300); t.check('الإشارة حُفظت', t.ev("SIRAJ.bm.has('book','%s:9')" % BID))
# تظليل
t.ev("""()=>{const sp=document.querySelector('#pg-9 .textLayer span'); const r=document.createRange(); r.selectNodeContents(sp); const s=getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange'));}""")
t.pg.wait_for_timeout(500); t.check('شريط التظليل يظهر عند تحديد نص', t.ev("!document.getElementById('rd-sel').hidden"))
t.pg.click('[data-act=rdHl]'); t.pg.wait_for_timeout(500)
t.check('التظليل محفوظ في IndexedDB', t.ev("SIRAJ.db.where('highlights','bookId','%s')" % BID).__len__() == 1)
t.check('التظليل مرسوم فوق الصفحة', t.ev("document.querySelectorAll('#pg-9 .hl-layer i').length") >= 1)
# تكبير
w0 = t.ev("document.getElementById('pg-9').getBoundingClientRect().width"); t.pg.click('[data-act=rdZoom][data-d="0.2"]'); t.pg.wait_for_timeout(1500)
w1 = t.ev("document.getElementById('pg-9').getBoundingClientRect().width"); t.check('التكبير يزيد عرض الصفحة', w1 > w0 * 1.1, (w0, w1))
t.check('الصفحة الحالية تبقى 9 بعد التكبير', t.ev("document.getElementById('rd-page').value") == '9', t.ev("document.getElementById('rd-page').value"))
t.shot('reader_p9')
# استئناف
t.pg.wait_for_timeout(900); t.go('/library/book/' + BID); t.go('/library/read/' + BID, 2500)
t.check('الاستئناف عند آخر صفحة (9)', t.ev("document.getElementById('rd-page').value") == '9', t.ev("document.getElementById('rd-page').value"))
t.check('سجل التقدم محفوظ', (t.ev("SIRAJ.progress.get('book','%s')" % BID) or {}).get('page') == 9)
t.go('/library/book/' + BID); t.check('عدّاد القراءات زاد', (t.ev("SIRAJ.library.byId.get('%s').reads" % BID) or 0) >= 1)
t.done()

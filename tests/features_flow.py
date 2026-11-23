"""ميزات أُضيفت بعد مراجعة قائمة الـ100: تصنيف العصور، تكرار مقطع صوتي للدعاء، جدولة الدعاء"""
import struct, base64
from common import T
t = T(); pg = t.pg

# ---------- العصور (#75) ----------
t.go('/library/eras')
tx = t.txt()
t.check('عصور: الصفحة وشرح طريقة الحساب', 'سنة وفاة المؤلف' in tx and 'القرن' in tx, tx[:200])
t.check('عصور: لا تخمين (عصر غير محدد يُذكر عند غياب السنة أو لا حاجة)', 'يُخمَّن' in tx)
first = pg.evaluate("document.querySelector('#view .li').getAttribute('href')")
n_shown = pg.evaluate("parseInt(document.querySelector('#view .li .li-s, #view .li .li-end').innerText.replace(/\\D/g,'')||'0')")
pg.click('#view .li >> nth=0'); pg.wait_for_timeout(700)
cnt = pg.evaluate("document.querySelectorAll('#view a[href^=\"#/library/book/\"]').length")
t.check('عصور: الضغط يفتح نتائج مصفّاة', 'era=' in first and cnt >= 1, (first, cnt))
# صحة الحساب: كل كتب النتيجة لها نفس القرن
era = int(first.split('era=')[1])
rows = t.ev("SIRAJ.library.search({era:%d}).map(b=>[b.title,b.authorDeath])" % era)
t.check('عصور: كل النتائج ضمن القرن %d' % era, rows and all((era == 0 and not d) or (d and -(-d // 100) == era) for _, d in rows), rows[:3])
t.go('/library/search?era=%d' % era)
t.check('عصور: قائمة العصر في نموذج البحث', pg.evaluate("!!document.querySelector('#f_era')"))
t.check('عصور: chip في المكتبة', (t.go('/library') or True) and 'العصور' in t.txt())

# ---------- دعاء موثق + تسجيل صوتي ----------
sr = 8000; n = sr * 4
wav = b'RIFF' + struct.pack('<I', 36 + n * 2) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, sr, sr * 2, 2, 16) + b'data' + struct.pack('<I', n * 2) + b'\x00\x00' * n
b64 = base64.b64encode(wav).decode()
t.ev("""(async()=>{const S=window.SIRAJ;const b=await (await fetch('data:audio/wav;base64,%s')).blob();await S.files.put('au_test',b,{});
 const d=await S.db.get('duas','d_kumayl')||(await S.db.all('duas'))[0];
 d.text='سطر اختبار الواجهة الأول\\nسطر اختبار الواجهة الثاني';d.textStatus='documented';d.textSource={book:'كتاب اختبار',edition:'ط١',page:'١'};d.audio='au_test';d.demo=false;await S.db.put('duas',d);window.__duaId=d.id;})()""" % b64)
pg.wait_for_timeout(400)
did = pg.evaluate("window.__duaId")
t.go('/duas/item/' + did, 900)
t.check('دعاء: نص موثق وخيار تكرار المقطع', 'تكرار مقطع' in t.txt() and pg.evaluate("!!document.getElementById('dua-au')"))
t.check('دعاء: زر جدولة', 'جدولة قراءة هذا الدعاء' in t.txt())
pg.evaluate("document.getElementById('dua-au').load()"); pg.wait_for_function("document.getElementById('dua-au').readyState>=1", timeout=8000)
pg.evaluate("document.getElementById('dua-au').currentTime=0.5"); pg.click('[data-act=duaA]'); pg.wait_for_timeout(200)
t.check('تكرار: تحديد البداية', pg.inner_text('#dua-a') != '—', pg.inner_text('#dua-a'))
pg.click('[data-act=duaB]'); pg.wait_for_timeout(200)
t.check('تكرار: النهاية بنفس لحظة البداية تُرفض', pg.inner_text('#dua-b') == '—')
pg.evaluate("document.getElementById('dua-au').currentTime=2.0"); pg.click('[data-act=duaB]'); pg.wait_for_timeout(300)
t.check('تكرار: المقطع محدد', 'يتكرر المقطع' in pg.inner_text('#dua-abst'), pg.inner_text('#dua-abst'))
# عند تجاوز النهاية يعود إلى البداية
pg.evaluate("(()=>{const a=document.getElementById('dua-au');a.pause();a.currentTime=2.3;a.dispatchEvent(new Event('timeupdate'))})()"); pg.wait_for_timeout(200)
ct = pg.evaluate("document.getElementById('dua-au').currentTime")
t.check('تكرار: يقفز إلى البداية بعد النهاية (%.2f)' % ct, ct < 1.0, ct)
pg.click('[data-act=duaABclr]'); pg.wait_for_timeout(150)
t.check('تكرار: إلغاء المقطع', 'لا مقطع' in pg.inner_text('#dua-abst'))
pg.check('#dua-all'); t.check('تكرار: كامل التسجيل (loop)', pg.evaluate("document.getElementById('dua-au').loop"))

# ---------- الجدولة (#40) ----------
pg.click('a:has-text("جدولة قراءة هذا الدعاء")'); pg.wait_for_timeout(700)
t.check('جدولة: الصفحة تفتح بالدعاء مختاراً', pg.evaluate("document.getElementById('f_rd').value") == did, pg.evaluate("document.getElementById('f_rd').value"))
t.check('جدولة: العنوان معبّأ', 'قراءة:' in pg.evaluate("document.getElementById('f_rt').value"))
pg.fill('#f_rh', '21:30'); pg.click('[data-act=remAdd]'); pg.wait_for_timeout(500)
r = t.ev("SIRAJ.kv.get('daily.reminders',[])")
t.check('جدولة: التنبيه حُفظ مرتبطاً بالدعاء', len(r) == 1 and r[0]['dua'] == did and r[0]['time'] == '21:30', r)
t.done()

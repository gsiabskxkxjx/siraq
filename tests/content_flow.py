"""الأدعية القرآنية: السحب من المصحف المحمَّل + التحقق الآلي من الآية.
ملاحظة صريحة: الاختبار يستعمل نص مصحف تجريبي (رموز اختبار) مع «آيات اختبارية» لثلاثة مواضع فقط بكلماتها الدالّة،
وهدفه إثبات منطق التحقق والإسقاط والتحديث؛ ولا يثبت صحة المطابقة على نص المصحف الحقيقي (يظهر ذلك في سجل التطبيق عند التشغيل)."""
import json, os
from common import T, ROOT

Q = json.load(open(os.path.join(ROOT, 'assets', 'data', 'quran-data.json'), encoding='utf8'))
t = T(); pg = t.pg

# قبل تحميل المصحف: لا أدعية قرآنية ولا قوائم فارغة مضللة
t.go('/duas', 700)
x = t.txt()
t.check('بلا مصحف: تظهر بطاقة «تحميل المصحف» وعدد المواضع', 'الأدعية القرآنية' in x and 'تحميل المصحف' in x, x[:300])
t.check('بلا مصحف: لا مدخلات qd_ في المخزن', t.ev("SIRAJ.db.all('duas').then(a=>a.filter(d=>/^qd_/.test(d.id)).length)") == 0)

# تهيئة نص تجريبي: كل آية «اختبار س:ع» إلا ثلاثة مواضع بنص اختبار فيه الكلمات الدالّة
SET = """(()=>{const Q=SIRAJ.quran, D=SIRAJ.data.quran;
 Q.text=D.surahs.map((s,i)=>Array.from({length:s.ayahs},(_,k)=>'اختبار '+(i+1)+':'+(k+1)));
 Q.text[0][5]='ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ';           // 1:6
 Q.text[0][6]='صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ';        // 1:7
 Q.text[1][200]='رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةً وَفِى ٱلْـَٔاخِرَةِ حَسَنَةً';   // 2:201
 Q.text[2][7]='رَبَّنَا لَا تُزِغْ قُلُوبَنَا';                  // 3:8
 Q.fp='t1'; return true})()"""
t.ev(SET)
r = t.ev("SIRAJ.quranDuas.sync(true)")
t.check('المزامنة: 3 أدعية فقط تحققت (1:6-7 و2:201 و3:8)', r['n'] == 3, r)
t.check('المزامنة: الباقي أُسقط ولم يُعرض (74)', r['skipped'] == t.ev("SIRAJ.quranDuas.total()") - 3, r)
items = t.ev("SIRAJ.db.all('duas').then(a=>a.filter(d=>/^qd_/.test(d.id)))")
ids = sorted(i['id'] for i in items)
t.check('معرّفات الأدعية', ids == ['qd_1_6_7', 'qd_2_201', 'qd_3_8'], ids)
d = [i for i in items if i['id'] == 'qd_2_201'][0]
t.check('الدعاء موثق ومصدره القرآن والسورة والآية', d['textStatus'] == 'documented' and d['textSource']['book'] == 'القرآن الكريم' and 'البقرة' in d['textSource']['page'] and '٢٠١' in d['textSource']['page'], d['textSource'])
t.check('نص الآية فيه رقمها بين الزخرفتين', '﴿٢٠١﴾' in d['text'], d['text'])
t.check('يجتاز تحقق المحرّر (مصدر + موضع)', t.ev("SIRAJ.duas.validate(%s)" % json.dumps(d, ensure_ascii=False)) == [])
r2 = t.ev("SIRAJ.quranDuas.sync()")
t.check('المزامنة التالية مخبأة (لا إعادة كتابة)', r2.get('cached') is True, r2)

# ظهورها في الواجهة
t.go('/duas', 300); t.ev("SIRAJ.router.refresh()"); pg.wait_for_timeout(500)
x = t.txt()
t.check('الصفحة تعرض عدد الأدعية القرآنية', 'الأدعية القرآنية' in x and ('٣' in x or '3' in x) and 'دعاءً من القرآن الكريم' in x, x[:400])
t.go('/duas/cat/quran', 600)
x = t.txt()
t.check('تصنيف «الأدعية القرآنية» يسرد الثلاثة', all(k in x for k in ['حسنة الدنيا', 'الثبات على الهداية', 'الصراط المستقيم']), x[:400])
t.go('/duas/item/qd_2_201', 600)
x = t.txt()
t.check('قارئ الدعاء يعرض النص والمصدر', 'حَسَنَةً' in x and 'القرآن الكريم' in x and 'نص موثق' in x, x[:500])
t.go('/duas?q=' + 'الثبات', 600)
t.check('البحث يجد الدعاء', 'الثبات على الهداية' in t.txt())

# إسقاط ما لم يعد يتحقق: تغيّر نص 3:8 فلا تبقى نسخة قديمة
t.ev("(()=>{SIRAJ.quran.text[2][7]='اختبار 3:8'; SIRAJ.quran.fp='t2'; return true})()")
r3 = t.ev("SIRAJ.quranDuas.sync()")
left = t.ev("SIRAJ.db.all('duas').then(a=>a.filter(d=>/^qd_/.test(d.id)).map(d=>d.id).sort())")
t.check('عند تغيّر النص تُحذف المدخلات التي لم تعد تتحقق', r3['n'] == 2 and left == ['qd_1_6_7', 'qd_2_201'], (r3, left))

# مراجع القائمة سليمة شكلاً ولا تتجاوز عدد آيات السورة ولا تتكرر
bad = t.ev("""(()=>{const D=SIRAJ.data.quran; const out=[]; const seen=new Set();
 SIRAJ.quranDuas.LIST.forEach(r=>{const m=/^(\\d+):(\\d+)(?:-(\\d+))?$/.exec(r[0]); if(!m){out.push('صيغة '+r[0]);return;}
  const s=+m[1],a=+m[2],b=+(m[3]||m[2]); const sur=D.surahs[s-1]; if(!sur||a<1||b<a||b>sur.ayahs) out.push('خارج المدى '+r[0]);
  if(seen.has(r[0])) out.push('مكرر '+r[0]); seen.add(r[0]);
  if(!r[1]||!r[2]||!r[2].length) out.push('ناقص '+r[0]);});
 return out;})()""")
t.check('مراجع الأدعية القرآنية سليمة (%d موضعاً)' % t.ev("SIRAJ.quranDuas.total()"), bad == [], bad)

t.done()

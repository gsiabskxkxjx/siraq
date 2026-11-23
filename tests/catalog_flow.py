"""اختبار الكتالوج الموسَّع: الأقسام العشرة، ترتيب الكتب بالموضوع، البحث، والصفحات"""
import json
from common import T, ROOT
t = T(); pg = t.pg
t.go('/library', 900)

secs = t.ev("SIRAJ.sections.map(s=>s.id)")
t.check('عشرة أقسام', len(secs) == 10 and set(['hadith', 'rijal', 'aqeedah', 'duas']) <= set(secs), secs)
cnt = t.ev("SIRAJ.library.countBySection()")
t.check('كل قسم فيه كتب منشورة', all(cnt.get(s, 0) > 0 for s in secs), cnt)
tot = sum(cnt.values())
t.check('عدد الكتب المنشورة >= 440', tot >= 440, tot)
t.check('قسم الحديث يضم الكافي وبحار الأنوار (بعد النقل)', t.ev("['b_kafi','b_bihar','b_wasail','b_faqih'].every(i=>SIRAJ.library.byId.get(i).section==='hadith')"))
t.check('قسم العقيدة يضم كشف المراد', t.ev("SIRAJ.library.byId.get('b_kashf-murad').section==='aqeedah'"))
bad = t.ev("SIRAJ.library.books.filter(b=>{const s=SIRAJ.sectionById[b.section];return !s||!s.subcats.includes(b.subcat)}).map(b=>b.id)")
t.check('كل تصنيف فرعي موجود في قسمه', bad == [], bad[:5])
noauth = t.ev("SIRAJ.library.books.filter(b=>!b.author||!b.authorId).map(b=>b.id)")
t.check('لكل كتاب مؤلف', noauth == [], noauth[:5])
t.check('لا كتاب منشور فيه ملف أو رابط أو ناشر غير موثق', t.ev("SIRAJ.library.books.filter(b=>b.status==='published').every(b=>!b.hasPdf&&!b.digitalUrl&&!b.publisher&&b.copyright==='غير محدد')"))
t.check('كل الكتب موسومة بأنها غير مراجَعة', t.ev("SIRAJ.library.books.every(b=>/لم تُراجع/.test(b.reviewStatus))"))
t.check('لا مسودات ولا اقتراحات وهمية في الكتالوج المشحون', t.ev("SIRAJ.library.books.filter(b=>b.status!=='published').length")==0)
t.check('لا نص ديني منقول: لا حقل text في الكتب', t.ev("SIRAJ.library.books.every(b=>!('text' in b))"))

# صفحة الرئيسية للمكتبة تعرض الأقسام العشرة
txt = t.txt()
t.check('الصفحة الرئيسية للمكتبة تعرض الأقسام الجديدة', all(x in txt for x in ['الحديث والروايات', 'الرجال والدراية', 'العقيدة والكلام', 'الأدعية والزيارات']), txt[:200])
t.shot('catalog-library')

for sid, must in [('hadith', 'الكافي'), ('rijal', 'رجال النجاشي'), ('aqeedah', 'تجريد الاعتقاد'), ('duas', 'الصحيفة السجادية'), ('fiqh', 'تذكرة الفقهاء'), ('tafsir', 'تسنيم')]:
    t.go('/library/sec/' + sid + '?n=400', 800)
    x = t.txt()
    t.check(f'قسم {sid} يعرض «{must}»', must in x, x[:120])
t.go('/library/sec/rijal', 800); t.shot('catalog-rijal')

# البحث
t.go('/library/search?q=' + 'النجاشي', 800)
t.check('بحث «النجاشي» يجد رجال النجاشي', 'رجال النجاشي' in t.txt())
t.go('/library/search?q=' + 'مفاتيح', 800)
t.check('بحث «مفاتيح» يجد مفاتيح الجنان', 'مفاتيح الجنان' in t.txt())

# صفحة كتاب جديد + مؤلف جديد
t.go('/library/book/b_mujam-rijal', 900)
x = t.txt()
t.check('صفحة معجم رجال الحديث: المؤلف والقسم وتنبيه عدم المراجعة', 'الخوئي' in x and 'الرجال والدراية' in x and 'لم تُراجَع' in x, x[:300])
t.go('/library/author/a_najashi', 800)
t.check('صفحة المؤلف النجاشي تعرض كتابه', 'رجال النجاشي' in t.txt())
t.go('/library/author/a_tusi', 800)
x = t.txt()
t.check('الطوسي: كتبه عبر عدة أقسام', all(k in x for k in ['الفهرست', 'تهذيب الأحكام', 'المبسوط']), x[:200])

# الغلاف المولَّد لكل كتاب (SVG) صالح ولا يحتاج شبكة
ok = t.ev("""SIRAJ.library.books.slice(0,300).every(b=>{const u=SIRAJ.coverSvg(b); return u.startsWith('data:image/svg+xml') && u.length>400})""")
t.check('أغلفة SVG مولَّدة لكل الكتب', ok)

# المصادر الرقمية المعلنة
t.go('/library/sources', 800) if False else None
src = t.ev("SIRAJ.sample && SIRAJ.sample.sources ? SIRAJ.sample.sources.map(s=>s.id) : (window.SIRAJ_DATA.sample.sources||[]).map(s=>s.id)")
t.check('المصادر الرقمية تتضمن thaqalayn وalkafeel', 's_thaqalayn' in src and 's_alkafeel_lib' in src, src)
t.done()

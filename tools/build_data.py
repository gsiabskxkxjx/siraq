# -*- coding: utf-8 -*-
"""
يولّد ملفات البيانات:
  assets/data/sample-data.json  + sample-data.js
  assets/data/quran-data.json   + quran-data.js     (بيانات وصفية للقرآن فقط، لا نص آيات)
  assets/data/duas-data.json    + duas-data.js      (فهرس الأدعية والزيارات، النصوص فارغة حتى تُوثَّق)
ملفات .js مجرد غلاف لتعمل البيانات عند فتح الملف مباشرة (file://) حيث يُمنع fetch.
الاستخدام:  python3 tools/build_data.py
"""
import json, os, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from data_library import SECTIONS, AUTHORS, BOOKS, PROPOSALS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "assets", "data")
TPL = os.path.join(ROOT, "docs", "import-templates")
os.makedirs(DATA, exist_ok=True); os.makedirs(TPL, exist_ok=True)

def dump(name, key, obj):
    p = os.path.join(DATA, name + ".json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    with open(os.path.join(DATA, name + ".js"), "w", encoding="utf-8") as f:
        f.write("/* مولَّد من %s.json بواسطة tools/build_data.py — لا تعدّله يدوياً */\n" % name)
        f.write("window.SIRAJ_DATA=window.SIRAJ_DATA||{};window.SIRAJ_DATA[%s]=" % json.dumps(key))
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

# ---------------------------------------------------------------- مصادر
SOURCES = [
    dict(id="s_alislam", name="مؤسسة الإمام علي (ع) – al-islam.org", url="https://www.al-islam.org/", kind="مكتبة رقمية", note="مصدر مقترح للبحث والتحقق؛ تُراجع حقوق كل كتاب على حدة."),
    dict(id="s_eshia", name="مكتبة أهل البيت (ع) الرقمية – lib.eshia.ir", url="https://lib.eshia.ir/", kind="مكتبة رقمية", note="مصدر مقترح للبحث والتحقق؛ لا يُنسخ منها دون ترخيص."),
    dict(id="s_noorlib", name="مكتبة نور – noorlib.ir", url="https://www.noorlib.ir/", kind="مكتبة رقمية", note="مصدر مقترح للبحث والتحقق."),
    dict(id="s_shiaonline", name="المكتبة الشيعية – shiaonlinelibrary.com", url="https://shiaonlinelibrary.com/", kind="مكتبة رقمية", note="مصدر مقترح للبحث والتحقق."),
    dict(id="s_thaqalayn", name="مكتبة الثقلين للحديث – thaqalayn.net", url="https://thaqalayn.net/", kind="مكتبة حديث رقمية", note="مكتبة رقمية للحديث الشيعي بنصوص عربية مع ترجمات إنجليزية؛ تُراجع شروط الاستخدام قبل أي ربط برمجي أو نسخ."),
    dict(id="s_alkafeel_lib", name="مكتبة العتبة العباسية المقدسة – alkafeel.net/library", url="https://alkafeel.net/library/", kind="مكتبة رقمية", note="مكتبة ومركز معلومات رقمي؛ بعض الخدمات بنظام العضوية. للتحقق والبحث لا للنسخ."),
    dict(id="s_ablibrary", name="مكتبة أهل البيت (قاعدة نصوص عربية/فارسية)", url="https://agakhanlibrary.org/ablibrary", kind="قاعدة نصوص", note="قاعدة نصوص برمجية تضم نحو 18 ألف مجلد حسب وصف مكتبة آغا خان؛ وصفها هنا للتعريف فقط وقد تتطلب اشتراكاً."),
    dict(id="s_wikishia", name="ويكي شيعة – wikishia.net", url="https://en.wikishia.net/", kind="موسوعة مرجعية", note="مرجع للتحقق من المعلومات الببليوغرافية الأولية (المؤلف، سنة الوفاة، وصف الكتاب)."),
    dict(id="s_archive", name="الأرشيف الرقمي – archive.org", url="https://archive.org/", kind="أرشيف رقمي", note="وجود ملف PDF ليس دليلاً على جواز إعادة نشره؛ تُراجع الرخصة."),
    dict(id="s_tanzil", name="مشروع تنزيل – tanzil.net", url="https://tanzil.net/", kind="نص القرآن", note="نص قرآني موثّق (رخصة CC-BY 3.0، يُمنع تعديله)."),
    dict(id="s_alquran_cloud", name="AlQuran.cloud – Islamic Network", url="https://alquran.cloud/", kind="واجهة برمجية", note="يخدم نص تنزيل وتلاوات وترجمات عبر API مفتوح."),
]

# ---------------------------------------------------------------- كتب
AUTH = {a[0]: a for a in AUTHORS}
base = datetime.datetime(2026, 11, 1, 9, 0)
books = []
def mk(i, row, status, proposed=None, ai_note=""):
    bid, title, aid, sec, sub, desc, tags = row[:7]
    a = AUTH[aid]
    t = (base + datetime.timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%S")
    books.append(dict(
        id="b_" + bid, title=title, authorId=aid, author=a[1], authorDeath=a[2],
        section=sec, subcat=sub, desc=desc, tags=tags,
        publisher="", year=None, edition="", pages=None, lang="العربية",
        sourceName="", sourceUrl="", copyright="غير محدد", digitalUrl="",
        reviewStatus="بيانات تجريبية – لم تُراجع على المصدر", addedAt=t,
        status=status, demo=True, proposedSection=proposed, aiNote=ai_note,
        hasPdf=False, hasCover=False, allowDownload=False, reads=0, downloads=0))
for i, row in enumerate(BOOKS):
    mk(i, row, "published")

authors = [dict(id=a[0], name=a[1], death=a[2], note=a[3]) for a in AUTHORS]

# ---------------------------------------------------------------- الأئمة
def imam(n, name, short, kunya, titles, father, bplace, bdate, byear, ddate, dyear, dcause, burial, vari, events, sources_hint):
    return dict(n=n, name=name, short=short, kunya=kunya, titles=titles, father=father,
                birth=dict(place=bplace, date=bdate, hijriYear=byear),
                death=dict(date=ddate, hijriYear=dyear, cause=dcause), burial=burial,
                variance=vari, events=events, sourcesHint=sources_hint)

SRC_COMMON = ["الإرشاد في معرفة حجج الله على العباد – الشيخ المفيد", "إعلام الورى بأعلام الهدى – الطبرسي", "كشف الغمة في معرفة الأئمة – الأربلي", "الأنوار البهية – الشيخ عباس القمي"]
IMAMS = [
    imam(1, "الإمام علي بن أبي طالب (ع)", "أمير المؤمنين", "أبو الحسن، أبو تراب", ["أمير المؤمنين", "المرتضى", "الوصي", "حيدر"],
         "أبو طالب بن عبد المطلب", "مكة المكرمة (المشهور: داخل الكعبة المشرفة)", "13 رجب", -23, "21 رمضان", 40,
         "استشهد بضربة سيف في مسجد الكوفة ليلة 19 رمضان وتوفي في 21 منه (المشهور)", "النجف الأشرف",
         "تاريخ الولادة والوفاة هنا على المشهور؛ ويختلف بعض المؤرخين في تفاصيلها.",
         [dict(y=10, t="واقعة الغدير (18 ذو الحجة) على المشهور"), dict(y=35, t="بدء الخلافة الظاهرية"), dict(y=36, t="معركة الجمل"), dict(y=37, t="معركة صفين"), dict(y=38, t="معركة النهروان"), dict(y=40, t="الاستشهاد في الكوفة")], SRC_COMMON),
    imam(2, "الإمام الحسن بن علي المجتبى (ع)", "المجتبى", "أبو محمد", ["المجتبى", "الزكي", "السبط الأكبر"],
         "الإمام علي (ع)، وأمه فاطمة الزهراء (ع)", "المدينة المنورة", "15 رمضان", 3, "28 صفر", 50,
         "استشهد بالسم على المشهور عند الإمامية", "البقيع – المدينة المنورة",
         "في تاريخ الوفاة اختلاف في بعض المصادر (49 أو 50 هـ).",
         [dict(y=41, t="الصلح مع معاوية")], SRC_COMMON),
    imam(3, "الإمام الحسين بن علي (ع)", "سيد الشهداء", "أبو عبد الله", ["سيد الشهداء", "سبط رسول الله"],
         "الإمام علي (ع)، وأمه فاطمة الزهراء (ع)", "المدينة المنورة", "3 شعبان", 4, "10 محرم", 61,
         "استشهد في واقعة كربلاء", "كربلاء المقدسة", "",
         [dict(y=60, t="الخروج من المدينة إلى مكة ثم العراق"), dict(y=61, t="واقعة كربلاء (10 محرم)")], SRC_COMMON + ["اللهوف في قتلى الطفوف – السيد ابن طاووس"]),
    imam(4, "الإمام علي بن الحسين زين العابدين (ع)", "زين العابدين", "أبو محمد (وقيل: أبو الحسن)", ["زين العابدين", "السجاد", "سيد الساجدين"],
         "الإمام الحسين (ع)", "المدينة المنورة", "5 شعبان", 38, "25 محرم", 95,
         "استشهد بالسم على المشهور عند الإمامية", "البقيع – المدينة المنورة",
         "يختلف في سنة الولادة (37 أو 38) وفي سنة الوفاة (94 أو 95).",
         [dict(y=61, t="العودة من كربلاء مع أهل البيت إلى المدينة"), dict(y=None, t="تُنسب إليه الصحيفة السجادية ورسالة الحقوق")], SRC_COMMON),
    imam(5, "الإمام محمد بن علي الباقر (ع)", "الباقر", "أبو جعفر", ["الباقر", "باقر العلوم"],
         "الإمام زين العابدين (ع)", "المدينة المنورة", "1 رجب", 57, "7 ذو الحجة", 114,
         "استشهد بالسم على المشهور عند الإمامية", "البقيع – المدينة المنورة",
         "يختلف في يوم الولادة (1 رجب أو 3 صفر) وفي سنة الوفاة.",
         [dict(y=None, t="اتساع الحركة العلمية في المدينة")], SRC_COMMON),
    imam(6, "الإمام جعفر بن محمد الصادق (ع)", "الصادق", "أبو عبد الله", ["الصادق"],
         "الإمام الباقر (ع)", "المدينة المنورة", "17 ربيع الأول", 83, "25 شوال", 148,
         "استشهد بالسم على المشهور عند الإمامية", "البقيع – المدينة المنورة", "",
         [dict(y=None, t="ازدهار الحركة العلمية في المدينة مع انتقال الحكم من الأمويين إلى العباسيين")], SRC_COMMON),
    imam(7, "الإمام موسى بن جعفر الكاظم (ع)", "الكاظم", "أبو الحسن (الأول)، أبو إبراهيم", ["الكاظم", "العبد الصالح", "باب الحوائج (لقب شائع)"],
         "الإمام الصادق (ع)", "الأبواء (بين مكة والمدينة)", "7 صفر", 128, "25 رجب", 183,
         "توفي في سجن بغداد، واستشهد بالسم على المشهور عند الإمامية", "الكاظمية – بغداد", "",
         [dict(y=None, t="السجن في عهد هارون العباسي")], SRC_COMMON),
    imam(8, "الإمام علي بن موسى الرضا (ع)", "الرضا", "أبو الحسن (الثاني)", ["الرضا", "عالم آل محمد"],
         "الإمام الكاظم (ع)", "المدينة المنورة", "11 ذو القعدة", 148, "آخر صفر", 203,
         "استشهد بالسم على المشهور عند الإمامية", "مشهد المقدسة – إيران",
         "يختلف في يوم الوفاة (آخر صفر أو 17 صفر أو غير ذلك بحسب المصادر).",
         [dict(y=201, t="ولاية العهد في عهد المأمون")], SRC_COMMON + ["عيون أخبار الرضا – الشيخ الصدوق"]),
    imam(9, "الإمام محمد بن علي الجواد (ع)", "الجواد", "أبو جعفر (الثاني)", ["الجواد", "التقي"],
         "الإمام الرضا (ع)", "المدينة المنورة", "10 رجب", 195, "29 ذو القعدة", 220,
         "استشهد بالسم على المشهور عند الإمامية", "الكاظمية – بغداد",
         "يختلف في يوم الولادة (10 رجب أو 19 رمضان) وفي يوم الوفاة (29 أو 30 ذو القعدة).",
         [], SRC_COMMON),
    imam(10, "الإمام علي بن محمد الهادي (ع)", "الهادي", "أبو الحسن (الثالث)", ["الهادي", "النقي"],
         "الإمام الجواد (ع)", "صُرْيا قرب المدينة المنورة", "15 ذو الحجة", 212, "3 رجب", 254,
         "استشهد بالسم على المشهور عند الإمامية", "سامراء – العراق",
         "يختلف في يوم الولادة (15 ذو الحجة أو 2 رجب).",
         [dict(y=None, t="الاستقدام إلى سامراء في عهد المتوكل العباسي")], SRC_COMMON),
    imam(11, "الإمام الحسن بن علي العسكري (ع)", "العسكري", "أبو محمد", ["العسكري", "الزكي"],
         "الإمام الهادي (ع)", "المدينة المنورة (المشهور)", "8 ربيع الثاني", 232, "8 ربيع الأول", 260,
         "استشهد بالسم على المشهور عند الإمامية", "سامراء – العراق",
         "يختلف في يوم الولادة (8 أو 10 ربيع الثاني).",
         [dict(y=260, t="بداية الغيبة الصغرى بعد استشهاده")], SRC_COMMON),
    imam(12, "الإمام محمد بن الحسن المهدي (عج)", "المهدي", "أبو القاسم", ["المهدي", "القائم", "الحجة", "صاحب الزمان", "بقية الله"],
         "الإمام الحسن العسكري (ع)", "سامراء", "15 شعبان", 255, "—", None,
         "حيّ غائب عند الإمامية", "—", "يعتمد على عقيدة الإمامية؛ ويختلف فيه غيرهم.",
         [dict(y=260, t="بداية الغيبة الصغرى"), dict(y=329, t="بداية الغيبة الكبرى")], SRC_COMMON + ["كمال الدين وتمام النعمة – الشيخ الصدوق"]),
]

EVENTS = [
    dict(y=1, t="الهجرة النبوية من مكة إلى المدينة", k="عام"),
    dict(y=2, t="غزوة بدر الكبرى", k="عام"),
    dict(y=10, t="حجة الوداع وواقعة الغدير (18 ذو الحجة) على المشهور", k="عام"),
    dict(y=11, t="وفاة النبي محمد (ص)", k="عام"),
    dict(y=36, t="معركة الجمل", k="عام"), dict(y=37, t="معركة صفين", k="عام"), dict(y=38, t="معركة النهروان", k="عام"),
    dict(y=40, t="استشهاد الإمام علي (ع)", k="إمام"), dict(y=41, t="صلح الإمام الحسن (ع)", k="إمام"),
    dict(y=61, t="واقعة كربلاء", k="إمام"),
    dict(y=260, t="بداية الغيبة الصغرى", k="إمام"), dict(y=329, t="بداية الغيبة الكبرى", k="إمام"),
]

# ---------------------------------------------------------------- مناسبات (هجري)  m: شهر 1-12 ، d: يوم
OCC = [
    (1,1,"رأس السنة الهجرية","عام"),(1,10,"يوم عاشوراء – استشهاد الإمام الحسين (ع)","حزن"),(1,25,"استشهاد الإمام زين العابدين (ع)","حزن"),
    (2,20,"الأربعين الحسيني","حزن"),(2,28,"وفاة النبي (ص) واستشهاد الإمام الحسن (ع)","حزن"),(2,30,"استشهاد الإمام الرضا (ع) (آخر صفر)","حزن"),
    (3,8,"استشهاد الإمام الحسن العسكري (ع)","حزن"),(3,12,"المولد النبوي عند أكثر المسلمين (12 ربيع الأول)","فرح"),(3,17,"المولد النبوي وولادة الإمام الصادق (ع) عند الإمامية","فرح"),
    (4,8,"ولادة الإمام الحسن العسكري (ع)","فرح"),
    (6,3,"شهادة السيدة فاطمة الزهراء (ع) على إحدى الروايتين","حزن"),(6,20,"ولادة السيدة فاطمة الزهراء (ع) على المشهور","فرح"),
    (7,1,"ولادة الإمام الباقر (ع)","فرح"),(7,3,"استشهاد الإمام الهادي (ع)","حزن"),(7,10,"ولادة الإمام الجواد (ع)","فرح"),(7,13,"ولادة الإمام علي (ع)","فرح"),(7,25,"استشهاد الإمام الكاظم (ع)","حزن"),(7,27,"المبعث النبوي الشريف","فرح"),
    (8,3,"ولادة الإمام الحسين (ع)","فرح"),(8,4,"ولادة أبي الفضل العباس (ع)","فرح"),(8,5,"ولادة الإمام زين العابدين (ع)","فرح"),(8,15,"ولادة الإمام المهدي (عج)","فرح"),
    (9,1,"بداية شهر رمضان المبارك","عبادة"),(9,15,"ولادة الإمام الحسن المجتبى (ع)","فرح"),(9,19,"ضربة الإمام علي (ع) وليلة القدر الأولى","حزن"),(9,21,"استشهاد الإمام علي (ع) وليلة القدر","حزن"),(9,23,"ليلة القدر الثالثة","عبادة"),
    (10,1,"عيد الفطر المبارك","فرح"),(10,25,"استشهاد الإمام الصادق (ع)","حزن"),
    (11,11,"ولادة الإمام الرضا (ع)","فرح"),(11,29,"استشهاد الإمام الجواد (ع)","حزن"),
    (12,7,"استشهاد الإمام الباقر (ع)","حزن"),(12,9,"يوم عرفة","عبادة"),(12,10,"عيد الأضحى المبارك","فرح"),(12,15,"ولادة الإمام الهادي (ع)","فرح"),(12,18,"عيد الغدير الأغر","فرح"),(12,24,"يوم المباهلة","فرح"),
]
OCCASIONS = [dict(m=m, d=d, title=t, kind=k, note="تاريخ مشهور؛ يتفاوت بعض المناسبات بين المصادر والمراجع.") for m, d, t, k in OCC]

HIJRI_MONTHS = ["محرم","صفر","ربيع الأول","ربيع الآخر","جمادى الأولى","جمادى الآخرة","رجب","شعبان","رمضان","شوال","ذو القعدة","ذو الحجة"]

# ---------------------------------------------------------------- أماكن (إحداثيات تقريبية)
PLACES = [
    dict(id="p_najaf", name="مرقد الإمام علي (ع)", city="النجف الأشرف", country="العراق", lat=31.9959, lng=44.3150, who="الإمام علي (ع)"),
    dict(id="p_karbala", name="مرقد الإمام الحسين (ع) وأخيه العباس (ع)", city="كربلاء المقدسة", country="العراق", lat=32.6168, lng=44.0324, who="الإمام الحسين (ع) وأبو الفضل العباس (ع)"),
    dict(id="p_kadhimiya", name="مرقد الإمامين الكاظمين (ع)", city="الكاظمية، بغداد", country="العراق", lat=33.3800, lng=44.3394, who="الإمام الكاظم (ع) والإمام الجواد (ع)"),
    dict(id="p_samarra", name="مرقد الإمامين العسكريين (ع)", city="سامراء", country="العراق", lat=34.1990, lng=43.8760, who="الإمام الهادي (ع) والإمام العسكري (ع)"),
    dict(id="p_mashhad", name="مرقد الإمام الرضا (ع)", city="مشهد", country="إيران", lat=36.2880, lng=59.6157, who="الإمام الرضا (ع)"),
    dict(id="p_qom", name="مرقد السيدة فاطمة المعصومة (ع)", city="قم", country="إيران", lat=34.6416, lng=50.8764, who="السيدة فاطمة بنت الإمام الكاظم (ع)"),
    dict(id="p_baqi", name="مقبرة البقيع", city="المدينة المنورة", country="السعودية", lat=24.4673, lng=39.6143, who="الأئمة الحسن والسجاد والباقر والصادق (ع)"),
    dict(id="p_nabawi", name="المسجد النبوي الشريف", city="المدينة المنورة", country="السعودية", lat=24.4672, lng=39.6111, who="النبي محمد (ص)"),
    dict(id="p_kufa", name="مسجد الكوفة", city="الكوفة", country="العراق", lat=32.0289, lng=44.3992, who="من معالم الكوفة المرتبطة بالإمام علي (ع)"),
    dict(id="p_zaynab", name="مقام السيدة زينب (ع)", city="ريف دمشق", country="سوريا", lat=33.4449, lng=36.3402, who="السيدة زينب بنت علي (ع)", note="في موضع قبرها أقوال أخرى؛ يُراجع المصدر."),
]

# ---------------------------------------------------------------- مدن (مواقيت)
CITIES = [
    ("najaf","النجف","العراق",32.0000,44.3360,"Asia/Baghdad"),("karbala","كربلاء","العراق",32.6160,44.0249,"Asia/Baghdad"),
    ("baghdad","بغداد","العراق",33.3152,44.3661,"Asia/Baghdad"),("kufa","الكوفة","العراق",32.0289,44.3992,"Asia/Baghdad"),
    ("samarra","سامراء","العراق",34.1986,43.8739,"Asia/Baghdad"),("basra","البصرة","العراق",30.5085,47.7835,"Asia/Baghdad"),
    ("hilla","الحلة","العراق",32.4637,44.4196,"Asia/Baghdad"),("nasiriyah","الناصرية","العراق",31.0439,46.2576,"Asia/Baghdad"),
    ("mosul","الموصل","العراق",36.3350,43.1189,"Asia/Baghdad"),("erbil","أربيل","العراق",36.1912,44.0092,"Asia/Baghdad"),
    ("mashhad","مشهد","إيران",36.2605,59.6168,"Asia/Tehran"),("qom","قم","إيران",34.6399,50.8759,"Asia/Tehran"),("tehran","طهران","إيران",35.6892,51.3890,"Asia/Tehran"),
    ("beirut","بيروت","لبنان",33.8938,35.5018,"Asia/Beirut"),("damascus","دمشق","سوريا",33.5138,36.2765,"Asia/Damascus"),
    ("makkah","مكة المكرمة","السعودية",21.3891,39.8579,"Asia/Riyadh"),("madinah","المدينة المنورة","السعودية",24.5247,39.5692,"Asia/Riyadh"),
    ("qatif","القطيف","السعودية",26.5652,50.0089,"Asia/Riyadh"),("riyadh","الرياض","السعودية",24.7136,46.6753,"Asia/Riyadh"),
    ("kuwait","الكويت","الكويت",29.3759,47.9774,"Asia/Kuwait"),("manama","المنامة","البحرين",26.2285,50.5860,"Asia/Bahrain"),
    ("doha","الدوحة","قطر",25.2854,51.5310,"Asia/Qatar"),("dubai","دبي","الإمارات",25.2048,55.2708,"Asia/Dubai"),("muscat","مسقط","عُمان",23.5880,58.3829,"Asia/Muscat"),
    ("cairo","القاهرة","مصر",30.0444,31.2357,"Africa/Cairo"),("amman","عمّان","الأردن",31.9454,35.9284,"Asia/Amman"),
    ("istanbul","إسطنبول","تركيا",41.0082,28.9784,"Europe/Istanbul"),("baku","باكو","أذربيجان",40.4093,49.8671,"Asia/Baku"),
    ("karachi","كراتشي","باكستان",24.8607,67.0011,"Asia/Karachi"),("lucknow","لكناؤ","الهند",26.8467,80.9462,"Asia/Kolkata"),
    ("london","لندن","بريطانيا",51.5074,-0.1278,"Europe/London"),("stockholm","ستوكهولم","السويد",59.3293,18.0686,"Europe/Stockholm"),
    ("berlin","برلين","ألمانيا",52.5200,13.4050,"Europe/Berlin"),("detroit","ديترويت","أمريكا",42.3314,-83.0458,"America/Detroit"),
    ("toronto","تورنتو","كندا",43.6532,-79.3832,"America/Toronto"),("sydney","سيدني","أستراليا",-33.8688,151.2093,"Australia/Sydney"),
]
CITIES = [dict(id=c[0], name=c[1], country=c[2], lat=c[3], lng=c[4], tz=c[5]) for c in CITIES]

# ---------------------------------------------------------------- أذكار
DHIKR = [
    dict(id="zahra", title="تسبيح السيدة فاطمة الزهراء (ع)", phases=[dict(t="الله أكبر", n=34), dict(t="الحمد لله", n=33), dict(t="سبحان الله", n=33)],
         note="الترتيب المشهور عند الإمامية؛ تُراجع الرسالة العملية للمرجع في الأحكام."),
    dict(id="subhan", title="سبحان الله", phases=[dict(t="سبحان الله", n=33)], note=""),
    dict(id="hamd", title="الحمد لله", phases=[dict(t="الحمد لله", n=33)], note=""),
    dict(id="akbar", title="الله أكبر", phases=[dict(t="الله أكبر", n=34)], note=""),
    dict(id="tahlil", title="لا إله إلا الله", phases=[dict(t="لا إله إلا الله", n=100)], note=""),
    dict(id="istighfar", title="أستغفر الله", phases=[dict(t="أستغفر الله", n=100)], note=""),
    dict(id="hawqala", title="لا حول ولا قوة إلا بالله", phases=[dict(t="لا حول ولا قوة إلا بالله", n=100)], note=""),
    dict(id="salawat", title="اللهم صلِّ على محمد وآل محمد", phases=[dict(t="اللهم صلِّ على محمد وآل محمد", n=100)], note=""),
]
MUSTAHABB = ["صلاة الليل", "نوافل الصلوات اليومية", "تعقيبات الصلاة", "تسبيح الزهراء (ع) بعد الصلاة", "قراءة القرآن", "الاستغفار", "الصدقة", "الدعاء للمؤمنين"]

# ---------------------------------------------------------------- آيات أهل البيت (مراجع فقط، لا نص)
AHL_VERSES = [
    dict(id="v_tathir", name="آية التطهير", s=33, a=33, section="ayat", subcat="آية التطهير"),
    dict(id="v_wilaya", name="آية الولاية", s=5, a=55, section="ayat", subcat="آية الولاية"),
    dict(id="v_mawadda", name="آية المودة", s=42, a=23, section="ayat", subcat="آية المودة"),
    dict(id="v_mubahala", name="آية المباهلة", s=3, a=61, section="ayat", subcat="آية المباهلة"),
    dict(id="v_ikmal", name="آية إكمال الدين", s=5, a=3, section="ayat", subcat="آية إكمال الدين"),
    dict(id="v_tabligh", name="آية التبليغ", s=5, a=67, section="ayat", subcat="آية التبليغ"),
]
for v in AHL_VERSES:
    v["agreement"] = "موضع الآية متفق عليه؛ أما سبب نزولها ودلالتها فمحل بحث بين المدارس الإسلامية، وتُعرض الأقوال بمصادرها."
    v["relatedBooks"] = ["b_mizan", "b_majma-bayan", "b_shawahid", "b_tawil-ayat", "b_muraja-at"]

ASPECTS = [
    dict(id="tawhid", title="التوحيد", brief="إثبات وحدانية الله ونفي الشريك عنه.", verses=["112:1-4"], books=["b_aqaid-imamiyya", "b_kashf-murad"]),
    dict(id="adl", title="العدل الإلهي", brief="تنزيه الله عن الظلم وعن فعل القبيح.", verses=[], books=["b_kashf-murad", "b_aqaid-imamiyya"]),
    dict(id="nubuwwa", title="النبوة", brief="بعثة الأنبياء ورسالاتهم وعصمتهم عند الإمامية.", verses=[], books=["b_aqaid-imamiyya", "b_kashf-murad"]),
    dict(id="imama", title="الإمامة", brief="مسألة الإمامة وخلافة النبي (ص) محل خلاف تاريخي وكلامي بين المذاهب.", verses=["5:55", "5:67", "5:3", "33:33"], books=["b_muraja-at", "b_ghadir", "b_abaqat"], disputed=True),
    dict(id="maad", title="المعاد", brief="الإيمان بالبعث والحساب والجزاء.", verses=[], books=["b_aqaid-imamiyya", "b_itiqadat"]),
]
for a in ASPECTS:
    a.setdefault("disputed", False)
    a["status"] = "تعريف تمهيدي عام، لا يُغني عن الرجوع إلى المصادر المذكورة."

sample = dict(
    meta=dict(app="سِراج", en="SIRAJ", tagline="نور العلم وهداية الطريق", sub="القرآن • العترة • المعرفة", version="0.1.0-demo",
              dataNotice="بيانات المكتبة تجريبية ومحدودة، تحتوي معلومات ببليوغرافية عامة فقط (عنوان، مؤلف، سنة وفاة المؤلف، نبذة). لم تُراجَع على المصادر الأصلية ولا تحتوي نصوص كتب."),
    sections=SECTIONS, sources=SOURCES, authors=authors, books=books,
    imams=IMAMS, events=EVENTS, occasions=OCCASIONS, hijriMonths=HIJRI_MONTHS, places=PLACES, cities=CITIES,
    dhikr=DHIKR, mustahabb=MUSTAHABB, ahlVerses=AHL_VERSES, aspects=ASPECTS,
    ayatSectionHint="اعرض الآيات والنصوص مع مصادرها، وفرّق بين المتفق عليه ومحل الخلاف البحثي.",
)
dump("sample-data", "sample", sample)

# ---------------------------------------------------------------- القرآن (وصفي فقط)
NAMES = "الفاتحة البقرة آل_عمران النساء المائدة الأنعام الأعراف الأنفال التوبة يونس هود يوسف الرعد إبراهيم الحجر النحل الإسراء الكهف مريم طه الأنبياء الحج المؤمنون النور الفرقان الشعراء النمل القصص العنكبوت الروم لقمان السجدة الأحزاب سبأ فاطر يس الصافات ص الزمر غافر فصلت الشورى الزخرف الدخان الجاثية الأحقاف محمد الفتح الحجرات ق الذاريات الطور النجم القمر الرحمن الواقعة الحديد المجادلة الحشر الممتحنة الصف الجمعة المنافقون التغابن الطلاق التحريم الملك القلم الحاقة المعارج نوح الجن المزمل المدثر القيامة الإنسان المرسلات النبأ النازعات عبس التكوير الانفطار المطففين الانشقاق البروج الطارق الأعلى الغاشية الفجر البلد الشمس الليل الضحى الشرح التين العلق القدر البينة الزلزلة العاديات القارعة التكاثر العصر الهمزة الفيل قريش الماعون الكوثر الكافرون النصر المسد الإخلاص الفلق الناس".split()
EN = "Al-Fatihah|Al-Baqarah|Ali 'Imran|An-Nisa|Al-Ma'idah|Al-An'am|Al-A'raf|Al-Anfal|At-Tawbah|Yunus|Hud|Yusuf|Ar-Ra'd|Ibrahim|Al-Hijr|An-Nahl|Al-Isra|Al-Kahf|Maryam|Ta-Ha|Al-Anbiya|Al-Hajj|Al-Mu'minun|An-Nur|Al-Furqan|Ash-Shu'ara|An-Naml|Al-Qasas|Al-'Ankabut|Ar-Rum|Luqman|As-Sajdah|Al-Ahzab|Saba|Fatir|Ya-Sin|As-Saffat|Sad|Az-Zumar|Ghafir|Fussilat|Ash-Shura|Az-Zukhruf|Ad-Dukhan|Al-Jathiyah|Al-Ahqaf|Muhammad|Al-Fath|Al-Hujurat|Qaf|Adh-Dhariyat|At-Tur|An-Najm|Al-Qamar|Ar-Rahman|Al-Waqi'ah|Al-Hadid|Al-Mujadila|Al-Hashr|Al-Mumtahanah|As-Saff|Al-Jumu'ah|Al-Munafiqun|At-Taghabun|At-Talaq|At-Tahrim|Al-Mulk|Al-Qalam|Al-Haqqah|Al-Ma'arij|Nuh|Al-Jinn|Al-Muzzammil|Al-Muddaththir|Al-Qiyamah|Al-Insan|Al-Mursalat|An-Naba|An-Nazi'at|'Abasa|At-Takwir|Al-Infitar|Al-Mutaffifin|Al-Inshiqaq|Al-Buruj|At-Tariq|Al-A'la|Al-Ghashiyah|Al-Fajr|Al-Balad|Ash-Shams|Al-Layl|Ad-Duha|Ash-Sharh|At-Tin|Al-'Alaq|Al-Qadr|Al-Bayyinah|Az-Zalzalah|Al-'Adiyat|Al-Qari'ah|At-Takathur|Al-'Asr|Al-Humazah|Al-Fil|Quraysh|Al-Ma'un|Al-Kawthar|Al-Kafirun|An-Nasr|Al-Masad|Al-Ikhlas|Al-Falaq|An-Nas".split("|")
COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]
MADANI = {2,3,4,5,8,9,13,22,24,33,47,48,49,55,57,58,59,60,61,62,63,64,65,66,76,98,99,110}
JUZ = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]]
assert len(NAMES) == 114 and len(EN) == 114 and len(COUNTS) == 114, (len(NAMES), len(EN), len(COUNTS))
assert sum(COUNTS) == 6236, sum(COUNTS)
assert len(JUZ) == 30
def juz_of(s, a=1):
    j = 1
    for i, (js, ja) in enumerate(JUZ):
        if (s, a) >= (js, ja): j = i + 1
    return j
surahs = [dict(n=i+1, name=NAMES[i].replace("_", " "), en=EN[i], ayahs=COUNTS[i], type="مدنية" if (i+1) in MADANI else "مكية", juz=juz_of(i+1)) for i in range(114)]
quran = dict(
    meta=dict(note="بيانات وصفية فقط (أسماء السور وعدد الآيات وبدايات الأجزاء). لا يحتوي هذا الملف أي نص قرآني.",
              typeNote="تصنيف مكية/مدنية بحسب مصحف المدينة وبيانات Tanzil، وقد تختلف بعض السور عند علماء آخرين؛ تُستبدل بقيمة الواجهة عند تحميل النص."),
    surahs=surahs, juzStarts=JUZ, manazil=[1,5,10,17,26,37,50],
    sajdaWajib=[[32,15],[41,37],[53,62],[96,19]], totalAyahs=6236,
    api=dict(base="https://api.alquran.cloud/v1", textEdition="quran-uthmani",
             audioCdn="https://cdn.islamic.network/quran/audio",
             audioBitrate=128, defaultAudio=[["ar.alafasy","مشاري العفاسي"],["ar.husary","محمود خليل الحصري"],["ar.minshawi","محمد صديق المنشاوي"]],
             defaultTranslations=[["en.sahih","English – Sahih International"],["en.asad","English – Muhammad Asad"],["en.pickthall","English – Pickthall"]]),
    attribution=dict(text="نص القرآن الكريم: مشروع Tanzil (tanzil.net) – رخصة Creative Commons Attribution 3.0، النص يُعرض كما هو دون تعديل. يُجلب عبر واجهة AlQuran.cloud.",
                     links=[["tanzil.net","https://tanzil.net/"],["alquran.cloud","https://alquran.cloud/"]]),
)
dump("quran-data", "quran", quran)

# ---------------------------------------------------------------- أدعية وزيارات (فهرس فقط)
DUA_CATS = [
    dict(id="daily", title="الأدعية اليومية"), dict(id="week", title="أدعية الأسبوع"), dict(id="ramadan", title="شهر رمضان"),
    dict(id="muharram", title="محرم وصفر"), dict(id="occasions", title="المناسبات"), dict(id="ziyarat-jamia", title="الزيارات الجامعة"),
    dict(id="ziyarat-special", title="زيارات مخصوصة"), dict(id="sahifa", title="الصحيفة السجادية"), dict(id="books", title="كتب الأدعية"),
    dict(id="quran", title="الأدعية القرآنية"),
]
MAF = "ورد في مفاتيح الجنان للشيخ عباس القمي (يُراجَع موضع النص والطبعة)"
def d(i, kind, title, cat, src="", note=""):
    return dict(id=i, kind=kind, title=title, cat=cat, commonSource=src, note=note, text="", textSource=None, textStatus="missing", audio=None, demo=False)
DUAS = [
    d("d_sahifa", "collection", "الصحيفة السجادية", "sahifa", "منسوبة إلى الإمام زين العابدين (ع)", "تُضاف أدعيتها كبنود مستقلة مع الطبعة والرقم."),
    d("d_mafatih", "collection", "مفاتيح الجنان", "books", "الشيخ عباس القمي", "كتاب جامع للأدعية والزيارات والأعمال."),
    d("d_kumayl", "dua", "دعاء كميل", "week", MAF, "يُذكر أنه يُقرأ في ليلة الجمعة وليلة النصف من شعبان؛ يُراجَع المصدر."),
    d("d_tawassul", "dua", "دعاء التوسل", "week", MAF),
    d("d_nudba", "dua", "دعاء الندبة", "week", MAF, "يُذكر أنه يُقرأ في الجمعة والأعياد الأربعة؛ يُراجَع المصدر."),
    d("d_sabah", "dua", "دعاء الصباح", "daily", MAF),
    d("d_ahd", "dua", "دعاء العهد", "daily", MAF),
    d("d_faraj", "dua", "دعاء الفرج", "daily", MAF),
    d("d_week", "collection", "أدعية أيام الأسبوع", "week"),
    d("d_ramadan", "collection", "أدعية شهر رمضان", "ramadan"),
    d("d_muharram", "collection", "أدعية شهر محرم وصفر", "muharram"),
    d("d_occasions", "collection", "أدعية المناسبات", "occasions"),
    d("d_daily", "collection", "الأدعية اليومية", "daily"),
    d("z_jamia_gen", "collection", "الزيارات الجامعة", "ziyarat-jamia"),
    d("z_jamia_kabira", "ziyarah", "الزيارة الجامعة الكبيرة", "ziyarat-jamia", MAF),
    d("z_ashura", "ziyarah", "زيارة عاشوراء", "ziyarat-special", MAF),
    d("z_warith", "ziyarah", "زيارة وارث", "ziyarat-special", MAF),
    d("z_amin", "ziyarah", "زيارة أمين الله", "ziyarat-special", MAF),
    d("z_arbaeen", "ziyarah", "زيارة الأربعين", "ziyarat-special", MAF),
]
DEMO = d("demo_reader_test", "demo", "نص اختبار القارئ (ليس دعاءً)", "daily", "", "لاختبار ميزات القراءة فقط، وليس نصاً دينياً.")
DEMO.update(demo=True, textStatus="demo", textSource=dict(book="نص تجريبي من إنشاء المشروع", page="", note="ليس دعاءً ولا نصاً دينياً"),
            text="هذا نص تجريبي لاختبار واجهة القراءة فقط، وليس دعاءً ولا نصاً دينياً.\nيمكنك تكبير الخط وتصغيره، وتبديل الوضع الليلي، وحفظ موضع القراءة، ومشاركة النص، وإضافته إلى المفضلة.\nعند توفر نص موثق لأي دعاء، يُضاف من لوحة الإدارة مع ذكر المصدر والطبعة والصفحة.\nكل سطر في هذا النص يمكن تحديده كموضع قراءة.")
duas = dict(categories=DUA_CATS, items=DUAS + [DEMO],
            policy="لا تُنشر نصوص أدعية أو زيارات دون مصدر وطبعة. الفهرس أسماء فقط حتى يضيف محرر نصاً موثقاً.")
dump("duas-data", "duas", duas)

# قوالب الاستيراد (docs/import-templates/*.json) تُحرَّر يدوياً وتتحقق منها tests/templates_flow.py؛ لا يكتبها هذا السكربت.

print("OK: books=%d (published=%d) authors=%d surahs=%d" % (len(books), len(BOOKS), len(authors), len(surahs)))

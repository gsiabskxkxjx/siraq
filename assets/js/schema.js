/* =====================================================================
   سِراج — schema.js : قواعد المحتوى المشتركة بين تطبيق سِراج وتطبيق التحكم
   مصدر واحد للحقيقة: ما يُقبل في الحزمة (وما يُرفض) هو نفسه ما يفرضه تطبيق التحكم عند الإصدار.
   المبادئ: لا مدخل ديني بلا مصدر • لا نص دعاء بلا كتاب وموضع • لا نصوص من الذاكرة • الروابط http(s) فقط.
   ===================================================================== */
(function () {
  'use strict';
  const S = (window.SIRAJ = window.SIRAJ || {});
  const SUR = () => ((S.data && S.data.quran && S.data.quran.surahs) || []);
  const str = (v) => String(v == null ? '' : v).trim();
  const isUrl = (u) => /^https?:\/\/[^\s]+$/i.test(str(u));

  /* ---------------- الآيات والمصادر ---------------- */
  function parseVerse(v) {
    const m = /^\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*$/.exec(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (!m) return null; const s = +m[1], a = +m[2], b = +(m[3] || m[2]); const su = SUR()[s - 1];
    if (!su || a < 1 || b < a || b > su.ayahs) return null; return { s, a, b, str: s + ':' + a + (b > a ? '-' + b : '') };
  }
  const hasLocator = (x) => !!(str(x.page) || str(x.volume) || str(x.number) || str(x.url));

  /* ---------------- حالات حقوق النشر ---------------- */
  const COPY = [
    { v: 'غير محدد', ok: false, note: 'لا يُنشر أي ملف' }, { v: 'ملك عام (انتهت مدة الحماية)', ok: true }, { v: 'مرخّص — Creative Commons', ok: true }, { v: 'بإذن خطي من الناشر أو المؤلف', ok: true },
    { v: 'متاح للتصفح من مصدره فقط (لا إعادة نشر)', ok: false, note: 'رابط خارجي فقط' }, { v: 'محمي — لا يُنشر', ok: false }
  ];
  const copyOk = (v) => { const c = COPY.find((x) => x.v === v); return !!(c && c.ok); };

  /* ---------------- مجموعات المداخل (الموسوعة) ---------------- */
  const RULING_TOPICS = [['taharah', 'الطهارة والنجاسات'], ['wudu', 'الوضوء'], ['salat', 'الصلاة'], ['sawm', 'الصيام'], ['safar', 'السفر'], ['khums', 'الخمس'], ['zakat', 'الزكاة'], ['qada', 'القضاء'], ['other', 'أخرى']];
  const COLS = {
    narrations: { title: 'موسوعة الروايات', one: 'رواية', icon: 'scroll', textLabel: 'نص الرواية كما في المصدر', textReq: true, narr: true, extra: [['speaker', 'المروي عنه (القائل)', 'text']], hint: 'انسخ النص من طبعة معتمدة بحروفه؛ لا تكتبه من الذاكرة ولا تُعدّله.' },
    narrators: { title: 'موسوعة الرواة', one: 'راوٍ', icon: 'users', textLabel: 'نبذة عن الراوي (كما في مصدر رجالي)', textReq: true, judg: true, extra: [['death', 'سنة الوفاة (هـ)', 'number'], ['tabaqa', 'الطبقة / العصر', 'text']], hint: 'التوثيق والتضعيف يُدخلان كأقوال منسوبة لقائليها في قسم «أحكام العلماء» لا كحكم من التطبيق.' },
    aqeedah_terms: { title: 'المصطلحات العقائدية', one: 'مصطلح', icon: 'network', textLabel: 'التعريف كما في المصدر', textReq: true, extra: [['related', 'مصطلحات ذات صلة', 'text']] },
    fiqh_terms: { title: 'المصطلحات الفقهية', one: 'مصطلح', icon: 'gavel', textLabel: 'التعريف كما في المصدر', textReq: true, extra: [['related', 'مصطلحات ذات صلة', 'text']] },
    tafsir: { title: 'مقارنة التفاسير', one: 'مدخل تفسير', icon: 'book-open', textLabel: 'نص التفسير (مقتطف قصير من المصدر)', textReq: true, verseReq: true, extra: [['mufassir', 'المفسِّر', 'text']], hint: 'اقتصر على مقتطف قصير مع المصدر؛ لا تُنسخ كتب كاملة دون ترخيص.' },
    asbab: { title: 'أسباب النزول', one: 'سبب نزول', icon: 'scroll', textLabel: 'ما ورد في سبب النزول كما في المصدر', textReq: true, verseReq: true, extra: [] },
    events: { title: 'أحداث تاريخية', one: 'حدث', icon: 'timeline', textLabel: 'وصف الحدث', textReq: true, extra: [['year', 'السنة الهجرية', 'number', true]], hint: 'اذكر الخلاف في التاريخ إن وُجد في خانة النص مع مصدره.' },
    places: { title: 'أماكن ومراقد', one: 'مكان', icon: 'map-pin', textLabel: 'نبذة', textReq: false, extra: [['city', 'المدينة', 'text'], ['country', 'البلد', 'text'], ['lat', 'خط العرض', 'number'], ['lng', 'خط الطول', 'number']] },
    manuscripts: { title: 'أرشيف المخطوطات', one: 'مخطوطة', icon: 'file', textLabel: 'وصف المخطوطة', textReq: false, extra: [['mauthor', 'المؤلف', 'text'], ['library', 'المكتبة الحافظة', 'text'], ['shelf', 'رقم الحفظ', 'text'], ['copyDate', 'تاريخ النسخ', 'text']], hint: 'لا تُرفع صور مخطوطة دون إذن الجهة الحافظة أو ما يثبت أنها مباحة.' },
    discussions: { title: 'مناقشة المسائل العقائدية', one: 'مسألة', icon: 'scale', textLabel: 'عرض المسألة', textReq: true, positions: true, extra: [['topic', 'المحور', 'aspect']], hint: 'أدخل كل قول مع قائله ومصدره؛ لا يُعرض الخلاف على أنه إجماع.' },
    imam_quotes: { title: 'الأقوال المنقولة عن الأئمة', one: 'قول منقول', icon: 'scroll', textLabel: 'النص كما في المصدر', textReq: true, extra: [['imam', 'الإمام', 'imam', true]], hint: 'القول يُنسب بمصدره؛ التطبيق لا يحكم بثبوته.' },
    rulings: { title: 'الأحكام الشرعية الموثقة', one: 'حكم شرعي', icon: 'gavel', textLabel: 'نص الحكم كما في الرسالة العملية', textReq: true, extra: [['marja', 'المرجع صاحب الفتوى', 'text', true], ['topic', 'الباب', 'select', true, RULING_TOPICS]], hint: 'انسخ الحكم بنصه من الرسالة العملية للمرجع المسمّى مع رقم المسألة. لا تكتب فتوى من عندك ولا تنسب لمرجع ما لم تتحقق منه.' },
    imam_sirah: { title: 'سيرة الأئمة', one: 'مدخل سيرة', icon: 'timeline', textLabel: 'نص السيرة (مقتطف من مصدر)', textReq: true, extra: [['imam', 'الإمام', 'imam', true]] }
  };

  /* ---------------- التحقق: المدخل ---------------- */
  function validateEntry(e) {
    const c = COLS[e.collection]; const err = [];
    if (!c) return ['مجموعة غير معروفة']; if (!str(e.title)) err.push('العنوان مطلوب');
    if (c.textReq && !str(e.text)) err.push('النص مطلوب');
    if (c.verseReq && !(e.verses || []).length) err.push('رقم الآية مطلوب (مثال 2:255)');
    (e.verses || []).forEach((v) => { if (!parseVerse(v)) err.push('آية غير صالحة: ' + v + ' (الصيغة سورة:آية أو سورة:من-إلى)'); });
    const srcs = e.sources || [];
    if (!srcs.length) err.push('لا يُحفظ مدخل بلا مصدر: أضف مصدراً واحداً على الأقل');
    srcs.forEach((x, i) => { if (!str(x.book)) err.push('المصدر ' + (i + 1) + ': اسم الكتاب مطلوب'); else if (!hasLocator(x)) err.push('المصدر ' + (i + 1) + ': حدّد جزءاً أو صفحة أو رقماً أو رابطاً'); if (x.url && !/^https?:\/\//i.test(x.url)) err.push('المصدر ' + (i + 1) + ': الرابط يجب أن يبدأ بـ http(s)'); });
    (e.scholarRulings || []).forEach((r, i) => { if (!str(r.scholar) || !str(r.ruling)) err.push('حكم العالِم ' + (i + 1) + ': اسم القائل ونص الحكم مطلوبان'); else if (!str(r.source)) err.push('حكم ' + r.scholar + ': اذكر مصدر الحكم'); });
    (e.variants || []).forEach((v, i) => { if (!str(v.text)) err.push('اللفظ ' + (i + 1) + ': النص مطلوب'); else if (!str(v.source)) err.push('اللفظ ' + (i + 1) + ': اذكر مصدر هذا اللفظ'); });
    (e.positions || []).forEach((p, i) => { if (!str(p.holder) || !str(p.view) || !str(p.source)) err.push('القول ' + (i + 1) + ': القائل والقول ومصدره مطلوبة'); });
    (c.extra || []).forEach(([k, l, t, req]) => { const v = (e.extra || {})[k]; if (req && (v == null || v === '')) err.push(l + ' مطلوب'); if (k === 'year' && v != null && v !== '' && !(Number.isFinite(+v) && +v >= -100 && +v <= 1600)) err.push('السنة الهجرية غير معقولة'); if (k === 'lat' && v !== '' && v != null && !(+v >= -90 && +v <= 90)) err.push('خط العرض بين -90 و90'); if (k === 'lng' && v !== '' && v != null && !(+v >= -180 && +v <= 180)) err.push('خط الطول بين -180 و180'); });
    return err;
  }

  /* ---------------- التحقق: الدعاء ---------------- */
  const DUA_KINDS = ['dua', 'ziyarah', 'collection'];
  function validateDua(it) {
    const errs = [];
    if (!str(it.title)) errs.push('العنوان مطلوب');
    if (it.kind && !DUA_KINDS.includes(it.kind)) errs.push('نوع غير معروف: ' + it.kind);
    if (str(it.text)) {
      const s = it.textSource || {};
      if (!str(s.book)) errs.push('اسم الكتاب المصدر مطلوب لأي نص');
      if (!str(s.page) && !str(s.part) && !str(s.url)) errs.push('أضف رقم الصفحة أو الجزء أو رابطاً للتحقق');
      if (s.url && !isUrl(s.url)) errs.push('الرابط يجب أن يبدأ بـ http(s)');
    }
    return errs;
  }

  /* ---------------- التحقق: الكتاب (بيانات ببليوغرافية فقط؛ لا ملفات) ---------------- */
  function validateBook(b) {
    const errs = [];
    if (!str(b.title)) errs.push('عنوان الكتاب مطلوب');
    if (!str(b.author)) errs.push('المؤلف مطلوب');
    if (!S.sectionById || !S.sectionById[b.section]) errs.push('القسم غير معروف');
    else if (b.subcat && !(S.sectionById[b.section].subcats || []).includes(b.subcat)) errs.push('التصنيف الفرعي «' + b.subcat + '» غير موجود في هذا القسم');
    if (!str(b.sourceName) && !str(b.sourceUrl)) errs.push('المصدر مطلوب: اسم المصدر أو رابطه (من أين أُخذت بيانات الكتاب؟)');
    if (b.sourceUrl && !isUrl(b.sourceUrl)) errs.push('رابط المصدر يجب أن يبدأ بـ http(s)');
    if (b.digitalUrl && !isUrl(b.digitalUrl)) errs.push('رابط النسخة الرقمية يجب أن يبدأ بـ http(s)');
    if (b.year != null && b.year !== '' && !(Number.isFinite(+b.year) && +b.year > 0 && +b.year < 3000)) errs.push('سنة النشر غير معقولة');
    if (b.pages != null && b.pages !== '' && !(Number.isFinite(+b.pages) && +b.pages > 0 && +b.pages < 100000)) errs.push('عدد الصفحات غير معقول');
    if (b.authorDeath != null && b.authorDeath !== '' && !(Number.isFinite(+b.authorDeath) && +b.authorDeath > -100 && +b.authorDeath < 1600)) errs.push('سنة وفاة المؤلف غير معقولة');
    if (b.copyright && !COPY.some((c) => c.v === b.copyright)) errs.push('حالة حقوق غير معروفة');
    return errs;
  }
  function validateAuthor(a) {
    const errs = [];
    if (!str(a.name)) errs.push('اسم المؤلف مطلوب');
    if (a.death != null && a.death !== '' && !(Number.isFinite(+a.death) && +a.death > -100 && +a.death < 1600)) errs.push('سنة الوفاة غير معقولة');
    return errs;
  }

  S.schema = { COLS, RULING_TOPICS, COPY, copyOk, parseVerse, hasLocator, validateEntry, validateDua, validateBook, validateAuthor, DUA_KINDS, isUrl, str };
})();

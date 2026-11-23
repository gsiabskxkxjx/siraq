/* =====================================================================
   سِراج — ailibrary.js : SIRAJ AI LIBRARY
   مسار العمل: اكتشاف ← بيانات وصفية ← فحص الرخصة ← كشف التكرار ← اقتراح القسم ← الفهرس ← المصدر ← طابور المراجعة
   قواعد ثابتة:
     • لا تُخترع كتب ولا مؤلفون: كل نتيجة تأتي من استجابة مصدر حقيقي أو من إدخال المستخدم نفسه.
     • وجود ملف PDF عند مصدر ما ليس إذناً بإعادة نشره: لا يُنزَّل أي ملف ولا يُنشر؛ يُحفظ رابط المصدر فقط.
     • لا نشر تلقائي: كل اقتراح يدخل «الكتب بانتظار الموافقة» وقرار النشر لصاحب الصلاحية.
     • الاقتراحات الآلية (القسم، الرخصة) تُعرض بأدلتها ويقرّرها المراجع البشري.
   المصدر الوحيد المربوط تقنياً هنا: archive.org (واجهة بحث وبيانات وصفية عامة). بقية المكتبات: روابط بحث يدوي فقط
   لأنها لا تقدّم واجهة برمجية مفتوحة موثّقة تعمل من المتصفح؛ ربطها يحتاج خادماً/اتفاقاً مع المصدر.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const esc = S.esc; const L = () => S.library;
  const can = (c) => !!(S.auth && S.auth.can(c));

  /* ---------------- 1) فحص الرخصة ---------------- */
  function checkLicense(m) {
    const notes = []; let status = 'غير محدد'; let sure = false; const ev = [];
    const lic = String(m.licenseurl || m.license || '').trim();
    if (/creativecommons\.org\/publicdomain\/(zero|mark)/i.test(lic)) { status = 'ملك عام (انتهت مدة الحماية)'; sure = true; ev.push('رابط الرخصة المعلن: ' + lic); }
    else if (/creativecommons\.org\/licenses\//i.test(lic)) {
      status = 'مرخّص — Creative Commons'; sure = true; ev.push('رابط الرخصة المعلن: ' + lic);
      if (/-nd\b|\/by-nd|\/by-nc-nd/i.test(lic)) notes.push('الرخصة تمنع التعديل (ND): لا يجوز تحويل النص أو اقتطاعه.');
      if (/-nc\b|\/by-nc/i.test(lic)) notes.push('الرخصة تمنع الاستخدام التجاري (NC).');
    } else if (lic) { ev.push('رخصة معلنة: ' + lic); notes.push('رخصة غير معروفة للنظام: تُراجع يدوياً.'); }
    if (String(m['possible-copyright-status'] || '').toUpperCase() === 'NOT_IN_COPYRIGHT') notes.push('المصدر يصنّف الكتاب «غير محمي بحق النشر» (possible-copyright-status) — هذا ترجيح من المصدر لا حكم قانوني؛ يلزم تحقق بشري قبل أي نشر للملف.');
    if (String(m['access-restricted-item'] || '').toLowerCase() === 'true') { status = 'متاح للتصفح من مصدره فقط (لا إعادة نشر)'; ev.push('المصدر يقيّد الوصول إلى هذا العنصر'); }
    if (m.rights) ev.push('حقوق: ' + String(m.rights).slice(0, 200));
    if (!ev.length) notes.push('لم يُعلن المصدر رخصة واضحة. تبقى الحالة «غير محدد» ولا يُنشر ملف.');
    notes.push('وجود PDF عند المصدر ليس إذناً بإعادة نشره. سِراج لا ينزّل الملف: يحفظ الرابط للتصفح من مصدره.');
    return { status, sure, evidence: ev, notes, canHostFile: sure && /ملك عام|Creative/.test(status) };
  }

  /* ---------------- 2) اقتراح القسم (بالكلمات المفتاحية مع إظهار الدليل) ---------------- */
  const KW = {
    fiqh: ['فقه', 'فقهي', 'طهاره', 'صلاه', 'صيام', 'خمس', 'زكاه', 'حج', 'عمره', 'وضوء', 'نجاسات', 'عروه', 'مكاسب', 'شرائع', 'جواهر', 'منهاج', 'تحرير الوسيله', 'مناسك', 'قواعد فقهيه', 'مسائل مستحدثه', 'بيع', 'نكاح'],
    sharia: ['اصول الفقه', 'شريعه', 'تشريع', 'مقاصد', 'اخلاق', 'حقوق', 'واجبات', 'اجتهاد', 'استنباط', 'مصادر الاحكام', 'دراسات شرعيه', 'نظام اسري'],
    tafsir: ['تفسير', 'قران', 'ميزان', 'مجمع البيان', 'علوم القران', 'ناسخ', 'منسوخ', 'محكم', 'متشابه', 'سوره', 'اسباب النزول', 'تنزيل', 'اعجاز', 'تدبر'],
    ahkam: ['استفتاءات', 'استفتاء', 'فتاوي', 'فتاوى', 'اجوبه', 'رساله عمليه', 'توضيح المسائل', 'مسائل شرعيه', 'احكام المراه', 'احكام الطلاق', 'احكام السفر', 'منهاج الصالحين'],
    ayat: ['ايه التطهير', 'ايه الولايه', 'ايه المودة', 'ايه المباهله', 'اكمال الدين', 'ايه التبليغ', 'ما نزل', 'نزل في', 'نزول', 'ايات الامامه', 'ايات اهل البيت', 'ايات نازله', 'شواهد التنزيل'],
    hadith: ['حديث', 'احاديث', 'روايات', 'الكتب الاربعه', 'الكافي', 'الفقيه', 'التهذيب', 'الاستبصار', 'وسائل الشيعه', 'بحار الانوار', 'امالي', 'مستدرك', 'اربعون حديثا', 'جوامع حديثيه', 'شرح الحديث'],
    rijal: ['علم الرجال', 'رجال', 'رواه', 'تراجم', 'فهرست', 'طبقات', 'درايه', 'مصطلح الحديث', 'جرح وتعديل', 'معجم رجال'],
    aqeedah: ['عقيده', 'عقائد', 'علم الكلام', 'توحيد', 'نبوه', 'معاد', 'امامه', 'مهدويه', 'غيبه', 'فلسفه', 'حكمه متعاليه', 'اصول الدين'],
    duas: ['دعاء', 'ادعيه', 'مناجاه', 'مزار', 'صحيفه سجاديه', 'مفاتيح الجنان', 'اقبال الاعمال', 'تعقيبات', 'اوراد', 'اذكار', 'اعمال الشهور'],
    fadail: ['فضائل', 'مناقب', 'اهل البيت', 'سيره', 'فاطمه', 'الزهراء', 'الحسين', 'الحسن', 'المهدي', 'زياره', 'مناسبات', 'عاشوراء', 'غدير', 'مقامات', 'تاريخ الائمه']
  };
  function suggestSection(text) {
    const tt = ' ' + S.norm(text) + ' ';
    const scored = Object.keys(KW).map((id) => {
      const hits = KW[id].filter((k) => { const nk = S.norm(k); return nk.length <= 3 ? tt.includes(' ' + nk + ' ') : tt.includes(nk); }); return { id, score: hits.reduce((a, h) => a + (h.length > 5 ? 2 : 1), 0), hits };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    const top = scored[0] || null; let sub = '';
    if (top) { const subs = (S.sectionById[top.id].subcats || []); const best = subs.map((sc) => ({ sc, n: S.norm(sc).split(' ').filter((w) => w.length > 2 && tt.includes(w)).length })).sort((a, b) => b.n - a.n)[0]; if (best && best.n) sub = best.sc; }
    return { top, alt: scored.slice(1, 3), subcat: sub, confident: !!top && top.score >= 3 && (!scored[1] || top.score >= scored[1].score * 1.5) };
  }

  /* ---------------- 3) كشف التكرار ---------------- */
  const bigrams = (s) => { const a = new Set(); for (let i = 0; i < s.length - 1; i++) a.add(s.slice(i, i + 2)); return a; };
  function duplicates(title, author, url) {
    const out = []; const byUrl = url ? L().books.find((b) => b.sourceUrl && b.sourceUrl.replace(/\/+$/, '') === url.replace(/\/+$/, '')) : null;
    if (byUrl) out.push({ book: byUrl, kind: 'نفس رابط المصدر', strong: true });
    L().findDuplicates(title, author).forEach((d) => { if (!out.some((o) => o.book.id === d.book.id)) out.push({ book: d.book, kind: 'عنوان ومؤلف متقاربان', strong: true }); });
    const nt = S.norm(title); const bt = bigrams(nt);
    L().books.forEach((b) => { if (out.some((o) => o.book.id === b.id)) return; const bb = bigrams(b._nt); let i = 0; bt.forEach((x) => { if (bb.has(x)) i++; }); const dice = bt.size + bb.size ? 2 * i / (bt.size + bb.size) : 0; if (dice >= 0.7) out.push({ book: b, kind: 'عنوان مشابه (تحقق من المؤلف)', strong: false }); });
    return out;
  }

  /* ---------------- 4) الفهرس ---------------- */
  function tocFrom(meta) {
    const raw = meta.contents || meta['table_of_contents'] || meta.toc; if (!raw) return [];
    return String(Array.isArray(raw) ? raw.join('\n') : raw).split(/\r?\n|<br\s*\/?>|;\s*/).map((x) => x.replace(/<[^>]*>/g, '').trim()).filter((x) => x && x.length < 200).slice(0, 80);
  }

  /* ---------------- التحليل الكامل ---------------- */
  function analyze(rec) {
    const title = String(rec.title || '').trim(); const author = String(rec.author || '').trim();
    const lic = checkLicense(rec.licenseMeta || {}); const subjects = [].concat(rec.subject || []).join(' '); const desc = String(rec.desc || '');
    const sec = suggestSection([title, author, subjects, desc].join(' ')); const dups = duplicates(title, author, rec.sourceUrl); const toc = rec.toc || [];
    const lines = [];
    lines.push('مصدر البيانات: ' + (rec.sourceName || 'إدخال يدوي') + (rec.sourceUrl ? ' — ' + rec.sourceUrl : ''));
    lines.push(sec.top ? 'القسم المقترح: ' + S.sectionById[sec.top.id].title + ' (الأدلة: ' + sec.top.hits.slice(0, 5).join('، ') + ')' + (sec.confident ? '' : ' — ثقة منخفضة، يلزم اختيار بشري') : 'لم يتمكن النظام من اقتراح قسم: يلزم اختيار بشري.');
    lines.push('الرخصة: ' + lic.status + (lic.evidence.length ? ' — ' + lic.evidence.join(' | ') : ' — لا دليل'));
    if (dups.length) lines.push('احتمال تكرار: ' + dups.slice(0, 3).map((d) => d.book.title + ' (' + d.kind + ')').join('؛ '));
    lines.push(toc.length ? 'الفهرس: ' + S.n(toc.length) + ' بنداً من بيانات المصدر' : 'الفهرس: غير متوفر في بيانات المصدر (يُستخرج لاحقاً من PDF مرفوع)');
    return { title, author, lic, sec, dups, toc, aiNote: lines.join('\n') };
  }

  /* ---------------- archive.org ---------------- */
  const AR = { search: 'https://archive.org/advancedsearch.php', meta: 'https://archive.org/metadata/' };
  async function getJson(url, ms) {
    if (navigator.onLine === false) throw new Error('الجهاز غير متصل بالإنترنت');
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms || 15000);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('رد المصدر: ' + r.status); return await r.json(); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'انتهت مهلة الاتصال بالمصدر' : (e.message === 'Failed to fetch' ? 'تعذّر الوصول إلى المصدر (لا إنترنت أو حجب من الشبكة أو المتصفح)' : e.message)); }
    finally { clearTimeout(to); }
  }
  async function searchArchive(q, lang) {
    const query = '(' + q + ') AND mediatype:texts' + (lang ? ' AND language:(' + lang + ')' : '');
    const u = AR.search + '?q=' + encodeURIComponent(query) + '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=language&fl[]=licenseurl&fl[]=subject&fl[]=description&rows=20&page=1&output=json';
    const j = await getJson(u); const docs = (j.response && j.response.docs) || [];
    return docs.filter((d) => d.identifier && d.title).map((d) => ({ id: d.identifier, title: [].concat(d.title)[0], author: [].concat(d.creator || [])[0] || '', year: d.year || null, lang: [].concat(d.language || []).join('، '), licenseurl: [].concat(d.licenseurl || [])[0] || '', subject: [].concat(d.subject || []).slice(0, 8), desc: [].concat(d.description || [])[0] || '' }));
  }
  async function fetchArchiveMeta(id) {
    const j = await getJson(AR.meta + encodeURIComponent(id)); const m = j.metadata || {}; if (!m.identifier) throw new Error('لم يُرجع المصدر بيانات لهذا المعرّف');
    const one = (v) => [].concat(v || [])[0] || '';
    return { id: m.identifier, title: String(one(m.title)), author: String(one(m.creator)), year: parseInt(one(m.date || m.year), 10) || null, publisher: String(one(m.publisher)), lang: [].concat(m.language || []).join('، '), subject: [].concat(m.subject || []).slice(0, 10), desc: String([].concat(m.description || []).join(' ')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600), licenseMeta: m, toc: tocFrom(m), sourceUrl: 'https://archive.org/details/' + m.identifier };
  }
  const idFromInput = (v) => { v = String(v || '').trim(); const m = v.match(/archive\.org\/(?:details|download)\/([^/?#\s]+)/i); return m ? m[1] : /^[A-Za-z0-9._-]{4,}$/.test(v) ? v : ''; };

  /* ---------------- إرسال إلى طابور المراجعة ---------------- */
  async function toQueue(rec, an, section, subcat) {
    if (!can('books.add')) throw new Error('لا تملك صلاحية إضافة الكتب');
    if (!rec.title.trim()) throw new Error('العنوان مطلوب');
    if (an.dups.some((d) => d.strong) && !(await S.confirm('هذا الكتاب يشبه كتاباً موجوداً: «' + an.dups[0].book.title + '». هل تريد إرساله للمراجعة رغم ذلك؟', { yes: 'إرسال' }))) return null;
    const lic = an.lic; const b = {
      id: S.uid('b'), title: rec.title.trim(), author: (rec.author || '').trim() || 'غير محدد', authorId: null, authorDeath: null, section, subcat: subcat || '', desc: rec.desc || '', tags: (rec.subject || []).slice(0, 6), publisher: rec.publisher || '', year: rec.year || null, edition: '', pages: null, lang: rec.lang || 'العربية',
      sourceName: rec.sourceName || '', sourceUrl: rec.sourceUrl || '', digitalUrl: rec.sourceUrl || '', copyright: lic.status, reviewStatus: 'اقتراح آلي — بانتظار مراجعة بشرية', addedAt: new Date().toISOString(), status: 'pending', demo: false,
      proposedSection: an.sec.top ? an.sec.top.id : null, aiNote: an.aiNote, toc: an.toc, hasPdf: false, hasCover: false, allowDownload: false, reads: 0, downloads: 0, aiSource: rec.kind || 'manual'
    };
    await L().save(b); await S.audit('ailibrary.propose', b.title, b.sourceUrl || 'manual'); await S.notify.add({ title: 'اقتراح جديد من سِراج AI LIBRARY', body: b.title, kind: 'review' });
    return b;
  }

  const SRC = [
    { id: 'archive', name: 'archive.org', url: 'https://archive.org/', live: true, note: 'واجهة بحث وبيانات وصفية عامة — مربوطة هنا (تتطلب إنترنت).' },
    { id: 'alislam', name: 'al-islam.org', url: 'https://www.al-islam.org/search?search_api_fulltext=', live: false, note: 'غير مربوط: لا واجهة برمجية مفتوحة موثّقة. افتح البحث وانسخ البيانات إلى «إدخال يدوي».' },
    { id: 'eshia', name: 'lib.eshia.ir', url: 'https://lib.eshia.ir/', live: false, note: 'غير مربوط: يتطلب اتفاقاً مع المصدر أو خادماً وسيطاً. تُراعى شروط استخدامه.' },
    { id: 'noor', name: 'noorlib.ir', url: 'https://www.noorlib.ir/', live: false, note: 'غير مربوط: كما سبق.' },
    { id: 'shiaonline', name: 'shiaonlinelibrary.com', url: 'https://shiaonlinelibrary.com/', live: false, note: 'غير مربوط: كما سبق.' },
    { id: 'thaqalayn', name: 'thaqalayn.net', url: 'https://thaqalayn.net/', live: false, note: 'غير مربوط: مكتبة حديث رقمية (عربي مع ترجمة إنجليزية). شروط استخدامها غير مراجَعة هنا، فلا ربط برمجي قبل مراجعتها.' },
    { id: 'alkafeel', name: 'مكتبة العتبة العباسية', url: 'https://alkafeel.net/library/', live: false, note: 'غير مربوط: بعض خدماتها بنظام العضوية. افتحها للبحث والتحقق.' }
  ];
  const LOG = () => S.kv.get('ailib.log', []);
  const logAdd = async (o) => { const a = [Object.assign({ ts: Date.now() }, o)].concat(LOG()).slice(0, 25); await S.kv.set('ailib.log', a); };
  let results = [];

  const stepper = () => S.h`<div class="steps">${['اكتشاف', 'بيانات وصفية', 'فحص الرخصة', 'كشف التكرار', 'اقتراح القسم', 'الفهرس', 'المصدر', 'طابور المراجعة'].map((t, i) => S.h`<span class="step"><i>${S.n(i + 1)}</i>${t}</span>`)}</div>`;

  S.router.add('/ailibrary', (p, q) => {
    const tab = q.tab || 'search';
    if (S.auth && !S.auth.user()) return { title: 'سِراج AI LIBRARY', nav: 'more', back: '/more', html: S.h`<div class="stack">${S.ui.notice('info', 'لإضافة كتب يلزم الدخول', 'هذه الأداة تُدخل اقتراحات إلى طابور المراجعة، فهي لأصحاب الصلاحية.')}<a class="btn primary block" href="#/admin">دخول إدارة سِراج (تجريبي)</a>${rulesCard()}</div>` };
    if (!can('books.add')) return { title: 'سِراج AI LIBRARY', nav: 'more', back: '/more', html: S.ui.notice('err', 'لا تملك الصلاحية', 'تحتاج صلاحية «إضافة كتب».') };
    const tabs = [['search', 'بحث archive.org'], ['url', 'من رابط/معرّف'], ['manual', 'إدخال يدوي'], ['pdf', 'فهرس من PDF'], ['rules', 'القواعد والمصادر']];
    return {
      title: 'سِراج AI LIBRARY', nav: 'more', back: '/admin',
      html: S.h`<div class="stack">${S.ui.notice('warn', 'اقتراحات تُراجَع ولا تُنشر تلقائياً', 'النظام يجمع ويحلّل فقط. لا يخترع كتباً ولا يُنزّل ملفات ولا ينشر. القرار النهائي للمراجع/المالك.')}${stepper()}
        <div class="chips">${tabs.map(([k, t]) => S.h`<a class="chip ${tab === k ? 'active' : ''}" href="#/ailibrary?tab=${k}">${t}</a>`)}</div>
        <div id="ailib-body">${tab === 'search' ? searchTab() : tab === 'url' ? urlTab() : tab === 'manual' ? manualTab() : tab === 'pdf' ? pdfTab() : rulesCard()}</div>
        ${tab !== 'rules' ? logCard() : ''}</div>`
    };
  });
  const rulesCard = () => S.h`<div class="card"><div class="card-t">${S.icon('shield')} قواعد سِراج AI LIBRARY</div><ul class="list-b small"><li>لا يخترع النظام كتاباً أو مؤلفاً؛ لا يظهر إلا ما عاد من مصدر حقيقي أو أدخلته أنت.</li><li>وجود PDF عند مصدر ليس إذناً بإعادة نشره: لا يُنزَّل ولا يُرفع.</li><li>كل اقتراح يدخل «الكتب بانتظار الموافقة».</li><li>القسم والرخصة المقترحان ظنّيان ويُعرض دليلهما؛ المراجع هو من يقرّر.</li><li>يُكشف التكرار بالعنوان والمؤلف ورابط المصدر قبل الإرسال.</li></ul></div>
    <div class="card"><div class="card-t">${S.icon('link')} المصادر المقترحة</div>${SRC.map((s) => S.h`<div class="kv"><div><a href="${S.url(s.url)}" target="_blank" rel="noopener noreferrer"><b>${s.name}</b></a><div class="tiny muted">${s.note}</div></div>${s.live ? S.ui.badge('مربوط', 'ok') : S.ui.badge('غير مربوط', 'warn')}</div>`)}</div>`;
  const searchTab = () => S.h`<div class="card"><div class="card-t">${S.icon('search')} اكتشاف في archive.org</div>${S.f.text('aq', 'كلمات البحث', '', { placeholder: 'مثال: شرائع الإسلام' })}${S.f.select('alang', 'اللغة', [{ v: '', t: 'أي لغة' }, { v: 'ara', t: 'العربية' }, { v: 'per', t: 'الفارسية' }, { v: 'eng', t: 'الإنجليزية' }], 'ara')}<button class="btn primary block" data-act="ailSearch">${S.icon('search')} بحث</button><p class="tiny muted nm">يتطلب إنترنت. يُرسل نص البحث إلى archive.org مباشرة من متصفحك.</p></div><div id="ail-res"></div>`;
  const urlTab = () => S.h`<div class="card"><div class="card-t">${S.icon('link')} جلب بيانات عنصر محدّد</div>${S.f.text('aurl', 'رابط archive.org/details/… أو المعرّف', '', { ltr: true })}<button class="btn primary block" data-act="ailFetch">${S.icon('download')} جلب البيانات وتحليلها</button></div>`;
  const manualTab = () => S.h`<div class="card" id="ail-man"><div class="card-t">${S.icon('edit')} إدخال بيانات كتاب لتحليله</div><p class="small muted nm">لكتب وجدتها في مكتبة غير مربوطة. يُجرى عليها فحص التكرار واقتراح القسم وفحص الرخصة ثم تدخل الطابور.</p>
    ${S.f.text('mt', 'العنوان', '', { required: true })}${S.f.text('ma', 'المؤلف', '')}${S.f.text('mp', 'الناشر', '')}<div class="grid2">${S.f.text('my', 'السنة', '', { type: 'number', ltr: true })}${S.f.text('ml', 'اللغة', 'العربية')}</div>${S.f.text('msn', 'اسم المصدر', '')}${S.f.text('msu', 'رابط المصدر', '', { ltr: true, placeholder: 'https://' })}${S.f.text('mlic', 'الرخصة كما يعلنها المصدر (نص أو رابط)', '')}${S.f.area('md', 'نبذة', '', { rows: 3 })}${S.f.area('mtoc', 'الفهرس (سطر لكل بند، اختياري)', '', { rows: 3 })}
    <button class="btn primary block" data-act="ailManual">${S.icon('sparkle')} تحليل</button></div>`;
  const pdfTab = () => {
    const withPdf = L().books.filter((b) => b.hasPdf);
    return S.h`<div class="card"><div class="card-t">${S.icon('list')} استخراج الفهرس من PDF مرفوع</div><p class="small muted nm">يقرأ إشارات (Bookmarks) الملف نفسه عبر PDF.js على جهازك. إن لم يحوِ الملف إشارات فلا فهرس يُختلق.</p>${withPdf.length ? S.h`<div class="list">${withPdf.map((b) => S.h`<button class="li" data-act="ailToc" data-id="${b.id}"><span class="li-body"><span class="li-t">${b.title}</span><span class="li-s">${b.toc && b.toc.length ? 'فهرس محفوظ: ' + S.n(b.toc.length) + ' بنداً' : 'لا فهرس بعد'}</span></span>${S.icon('chevron-left')}</button>`)}</div>` : S.ui.empty('file', 'لا كتب بملفات PDF', 'ارفع ملفاً من «إدارة الكتب» أولاً.')}</div>`;
  };
  const logCard = () => { const lg = LOG(); return lg.length ? S.h`<div class="card"><div class="card-t">${S.icon('clock')} آخر العمليات</div>${lg.slice(0, 8).map((l) => S.h`<div class="kv"><span>${l.what}</span><span class="tiny muted">${S.fmt.dt(l.ts)}</span></div>`)}</div>` : ''; };

  /* ----- الإجراءات ----- */
  function resultCard(r, i) {
    return S.h`<div class="card"><b>${r.title}</b><div class="small muted">${r.author || 'مؤلف غير مذكور'}${r.year ? ' • ' + S.n(r.year) : ''}${r.lang ? ' • ' + r.lang : ''}</div><div class="tiny muted op-ltr">${r.id}</div><div class="row wrap mt">${r.licenseurl ? S.ui.badge('رخصة معلنة', 'info') : S.ui.badge('بلا رخصة معلنة', 'warn')}</div><button class="btn sm primary mt" data-act="ailAnalyze" data-i="${i}">${S.icon('sparkle')} تحليل وإرسال للمراجعة</button></div>`;
  }
  S.act('ailSearch', async (el) => {
    const q = S.$('#f_aq').value.trim(); if (q.length < 2) return S.toast('اكتب كلمتين للبحث على الأقل', 'err'); const out = S.$('#ail-res'); out.innerHTML = '<div class="notice info"><div>جارٍ البحث في archive.org …</div></div>'; el.disabled = true;
    try { results = await searchArchive(q, S.$('#f_alang').value); await logAdd({ what: 'بحث archive.org: «' + q + '» — ' + results.length + ' نتيجة' }); S.mount(out, results.length ? S.h`<div class="small muted">${S.n(results.length)} نتيجة من archive.org (لم يتحقق منها أحد بعد)</div>${results.map(resultCard)}` : S.ui.empty('search', 'لا نتائج', 'جرّب كلمات أخرى. لن يُنشئ سِراج كتباً من عنده.')); }
    catch (e) { await logAdd({ what: 'فشل البحث: ' + e.message }); S.mount(out, S.ui.notice('err', 'تعذّر البحث', e.message + '. لا نتائج، ولا يُولَّد بديل. يمكنك استخدام «إدخال يدوي».')); } finally { el.disabled = false; }
  });
  S.act('ailAnalyze', async (el) => {
    const r = results[+el.dataset.i]; if (!r) return; el.disabled = true;
    try { const m = await fetchArchiveMeta(r.id); await preview(Object.assign({ sourceName: 'archive.org', kind: 'archive' }, m)); } catch (e) { S.toast(e.message, 'err'); } finally { el.disabled = false; }
  });
  S.act('ailFetch', async (el) => {
    const id = idFromInput(S.$('#f_aurl').value); if (!id) return S.toast('رابط أو معرّف غير صالح', 'err'); el.disabled = true;
    try { const m = await fetchArchiveMeta(id); await logAdd({ what: 'جلب بيانات: ' + id }); await preview(Object.assign({ sourceName: 'archive.org', kind: 'archive' }, m)); } catch (e) { S.toast(e.message, 'err'); } finally { el.disabled = false; }
  });
  S.act('ailManual', async () => {
    const d = S.f.read(S.$('#ail-man')); if (!d.mt.trim()) return S.toast('العنوان مطلوب', 'err'); if (d.msu && !/^https?:\/\//i.test(d.msu)) return S.toast('رابط المصدر يجب أن يبدأ بـ http(s)', 'err');
    const lic = d.mlic.trim(); const licenseMeta = /^https?:/i.test(lic) ? { licenseurl: lic } : lic ? { rights: lic } : {};
    await preview({ title: d.mt, author: d.ma, publisher: d.mp, year: d.my, lang: d.ml, sourceName: d.msn || 'إدخال يدوي', sourceUrl: d.msu.trim(), desc: d.md, licenseMeta, toc: d.mtoc.split('\n').map((x) => x.trim()).filter(Boolean), kind: 'manual' });
  });
  async function preview(rec) {
    const an = analyze(rec); const opts = S.sections.map((s) => ({ v: s.id, t: s.title })); const sel = an.sec.top ? an.sec.top.id : S.sections[0].id;
    const subs = (id, cur) => ['<option value="">— بلا —</option>'].concat((S.sectionById[id].subcats || []).map((x) => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`)).join('');
    const ok = await S.modal({
      title: 'نتيجة التحليل',
      body: S.h`<div class="stack s"><div><b>${rec.title}</b><div class="small muted">${rec.author || 'المؤلف غير مذكور — يُحدَّد عند المراجعة'}</div></div>
        <div class="card flat"><div class="small"><b>الرخصة:</b> ${S.ui.badge(an.lic.status, an.lic.sure ? 'ok' : 'warn')}</div>${an.lic.evidence.map((e) => S.h`<div class="tiny">${e}</div>`)}${an.lic.notes.map((n) => S.h`<div class="tiny muted">• ${n}</div>`)}</div>
        ${an.dups.length ? S.h`<div class="notice warn">${S.icon('alert')}<div><b>احتمال تكرار</b>${an.dups.slice(0, 3).map((d) => S.h`<div class="tiny">${d.book.title} — ${d.kind}${d.book.status !== 'published' ? ' (' + d.book.status + ')' : ''}</div>`)}</div></div>` : S.h`<div class="small ok">${S.icon('check-circle')} لا تكرار ظاهر في المكتبة الحالية</div>`}
        <div class="field"><label>القسم ${an.sec.top ? (an.sec.confident ? '(مقترح)' : '(مقترح بثقة منخفضة)') : '(لا اقتراح — اختر)'}</label><select class="select" name="sec" data-chg="ailSec">${opts.map((o) => S.h`<option value="${o.v}" ${o.v === sel ? S.raw('selected') : ''}>${o.t}</option>`)}</select>${an.sec.top ? S.h`<span class="hint">الدليل: ${an.sec.top.hits.slice(0, 5).join('، ')}</span>` : ''}</div>
        <div class="field"><label>التصنيف الفرعي</label><select class="select" name="sub" id="ail-sub">${S.raw(subs(sel, an.sec.subcat))}</select></div>
        <div class="small">${an.toc.length ? 'الفهرس: ' + S.n(an.toc.length) + ' بنداً' : 'لا فهرس في بيانات المصدر'}</div>
        <div class="small">${rec.sourceUrl ? S.h`المصدر: <a href="${S.url(rec.sourceUrl)}" target="_blank" rel="noopener noreferrer">${rec.sourceName}</a>` : 'بلا رابط مصدر — سيُطلب توثيقه عند المراجعة'}</div></div>`,
      actions: [{ label: 'إلغاء', cls: 'ghost', value: false }, { label: 'إرسال إلى طابور الموافقة', cls: 'primary', value: true, onClick: async (box) => { try { const b = await toQueue(rec, an, box.querySelector('[name=sec]').value, box.querySelector('[name=sub]').value); if (!b) return false; await logAdd({ what: 'أُرسل للمراجعة: ' + b.title }); } catch (e) { S.toast(e.message, 'err'); return false; } } }]
    });
    if (ok === true) { S.toast('أُرسل إلى «الكتب بانتظار الموافقة»', 'ok'); S.router.go('/admin/pending'); }
  }
  S.onChange('ailSec', (el) => { const s = S.sectionById[el.value]; S.$('#ail-sub').innerHTML = ['<option value="">— بلا —</option>'].concat((s.subcats || []).map((x) => `<option>${esc(x)}</option>`)).join(''); });
  S.act('ailToc', async (el) => {
    const b = L().byId.get(el.dataset.id); const f = await S.files.get('pdf:' + b.id); if (!f) return S.toast('الملف غير موجود', 'err'); S.toast('جارٍ قراءة الإشارات …');
    let ol; try { ol = await S.reader.outline(f.blob); } catch (e) { return S.toast('تعذّر قراءة PDF: ' + e.message + (location.protocol === 'file:' ? ' (PDF.js لا يعمل من file:// — افتح عبر HTTPS أو localhost)' : ''), 'err'); }
    if (!ol.length) return S.alert('لا فهرس في الملف', S.h`<p>لا يحوي هذا الملف إشارات (Bookmarks)، فلم يُستخرج فهرس. لا يُختلق فهرس من غير المصدر.</p>`);
    if (!(await S.confirm('عُثر على ' + ol.length + ' بنداً. حفظها فهرساً للكتاب؟', { yes: 'حفظ' }))) return;
    b.toc = ol.map((x) => '  '.repeat(x.depth) + x.title + (x.page ? ' — ص ' + x.page : '')); await L().save(b); await S.audit('book.toc', b.title, ol.length + ' items'); S.toast('حُفظ الفهرس', 'ok'); S.router.refresh();
  });

  S.ailib = { analyze, checkLicense, suggestSection, duplicates, searchArchive, fetchArchiveMeta, idFromInput, SRC };
})();

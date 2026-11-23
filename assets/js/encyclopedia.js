/* =====================================================================
   سِراج — encyclopedia.js : الموسوعة العقائدية • موسوعة الأئمة الاثني عشر • الموسوعة العلمية والبحثية (20 وحدة)
   مبادئ ثابتة:
     • كل مدخل ديني (رواية، تفسير، سبب نزول، سيرة، قول، مصطلح…) يُرفض حفظه إن لم يكن له مصدر واحد على الأقل
       فيه اسم الكتاب وموضع (جزء/صفحة/رقم/رابط). لا نصوص دينية مُضمَّنة في التطبيق: تصل عبر حزم موقّعة من الناشر مع مصدرها (انظر packs.js).
     • لا أحكام آلية على الروايات: أحكام العلماء تُدخَل منسوبة لقائلها ومصدرها وتُعرض كما هي، ولا تُجمَع في «حكم عام».
     • الخلاف يُعرض بوضوح، ولا يُقدَّم المختلف فيه حقيقةً متفقاً عليها.
     • الصور الرمزية زخارف هندسية فقط؛ لا تُرسم وجوه ولا صور تاريخية.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const esc = S.esc; const L = () => S.library;
  const SUR = () => S.data.quran.surahs;

  /* ---------------- أدوات: الآيات والمصادر والفروق ---------------- */
  const { parseVerse, hasLocator, COLS, RULING_TOPICS, validateEntry } = S.schema; /* قواعد مشتركة مع تطبيق التحكم */
  const verseLabel = (v) => { const p = parseVerse(v); return p ? 'سورة ' + SUR()[p.s - 1].name + ' ' + S.n(p.a) + (p.b > p.a ? '–' + S.n(p.b) : '') : v; };
  const verseLink = (v) => { const p = parseVerse(v); return p ? S.h`<a class="chip" href="#/quran/ayah/${p.s}/${p.a}">${verseLabel(v)}</a>` : S.h`<span class="chip">${v}</span>`; };
  const inVerse = (v, s, a) => { const p = parseVerse(v); return !!p && p.s === s && a >= p.a && a <= p.b; };
  const cite = (x) => [x.book, x.author ? '— ' + x.author : '', x.edition ? '، ط ' + x.edition : '', x.volume ? '، ج ' + x.volume : '', x.page ? '، ص ' + x.page : '', x.number ? '، رقم ' + x.number : ''].join('').replace(/\s+،/g, '،');
  const srcView = (x) => S.h`<div class="src-row"><div><b>${x.book}</b>${x.author ? S.h` <span class="muted">— ${x.author}</span>` : ''}</div><div class="tiny muted">${[x.edition ? 'ط ' + x.edition : '', x.volume ? 'ج ' + x.volume : '', x.page ? 'ص ' + x.page : '', x.number ? 'رقم ' + x.number : ''].filter(Boolean).join(' • ')}</div>${x.url ? S.h`<a class="tiny" href="${S.url(x.url)}" target="_blank" rel="noopener noreferrer">رابط المصدر</a>` : ''}</div>`;

  function diffWords(a, b) { // يعيد عمليات eq/del/add بين نصين (مقارنة بعد إسقاط التشكيل)
    const A = String(a).split(/\s+/).filter(Boolean), B = String(b).split(/\s+/).filter(Boolean);
    if (A.length * B.length > 360000) return null; const na = A.map(S.norm), nb = B.map(S.norm);
    const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (na[i] === nb[j]) { out.push({ t: 'eq', w: B[j] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: 'del', w: A[i++] }); else out.push({ t: 'add', w: B[j++] }); }
    while (i < A.length) out.push({ t: 'del', w: A[i++] }); while (j < B.length) out.push({ t: 'add', w: B[j++] });
    return out;
  }
  const diffHtml = (ops) => (ops ? S.h`${ops.map((o) => S.h`<span class="df-${o.t}">${o.w}</span> `)}` : S.h`<span class="muted">النص أطول من أن يُقارَن آلياً.</span>`);
  const diffStats = (ops) => (ops ? { add: ops.filter((o) => o.t === 'add').length, del: ops.filter((o) => o.t === 'del').length, same: ops.filter((o) => o.t === 'eq').length } : null);

  /* ---------------- مجموعات المداخل ---------------- */
  const getCol = (id) => COLS[id];

  const allEntries = async (col) => (col ? S.db.where('entries', 'collection', col) : S.db.all('entries'));
  const statusBadge = (e) => (e.status === 'imported' ? S.ui.badge('مستورد آلياً — لم يُراجَع', 'warn') : e.status === 'reviewed' ? S.ui.badge('راجعه ' + ((e.reviewed || {}).by || ''), 'ok') : S.ui.badge('موثّق بمصدر', 'info'));

  /* ---------------- الزخرفة الرمزية (هندسية بلا وجوه) ---------------- */
  const ornament = (n, size) => S.h`<svg class="orn" viewBox="0 0 100 100" width="${size || 72}" height="${size || 72}" role="img" aria-label="زخرفة رمزية"><g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="24" y="24" width="52" height="52"/><rect x="24" y="24" width="52" height="52" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="31"/><circle cx="50" cy="50" r="22" stroke-opacity=".5"/></g><text x="50" y="58" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor" font-family="Cairo,sans-serif">${S.n(n)}</text></svg>`;
  const gYear = (h) => Math.round(h * 0.970229 + 621.5744);
  const yrStr = (h) => (h < 0 ? S.n(-h) + ' قبل الهجرة' : S.n(h) + ' هـ') + ' (≈ ' + S.n(gYear(h)) + ' م)';
  const plainName = (n) => n.replace(/^الإمام\s+/, '').replace(/\s*\(.*?\)\s*/g, '').split(/\s+/).slice(0, 3).join(' ');

  /* =========================== موسوعة الأئمة =========================== */
  const PLACE_OF = { 1: 'p_najaf', 2: 'p_baqi', 3: 'p_karbala', 4: 'p_baqi', 5: 'p_baqi', 6: 'p_baqi', 7: 'p_kadhimiya', 8: 'p_mashhad', 9: 'p_kadhimiya', 10: 'p_samarra', 11: 'p_samarra' };
  S.router.add('/imams', () => {
    const D = S.data.sample;
    return {
      title: 'موسوعة الأئمة الاثني عشر', nav: 'more', back: '/more',
      html: S.h`<div class="stack"><div class="card hero-mini"><b>أئمة أهل البيت (ع)</b><p class="small nm">صفحة لكل إمام: الاسم والكنية والألقاب والولادة والوفاة والأحداث والمصادر. الزخارف رمزية هندسية؛ لا تُعرض صور تاريخية مختلَقة.</p></div>
        ${S.ui.notice('info', 'عن التواريخ', 'التواريخ مشهورة عند الإمامية وقد تختلف فيها المصادر؛ يُذكر الاختلاف في صفحة كل إمام. راجع المصادر للتحقق.')}
        <a class="btn block" href="#/imams/timeline">${S.icon('timeline')} الخط الزمني للأئمة والأحداث</a>
        <div class="list">${D.imams.map((m) => S.h`<a class="li imam-li" href="#/imams/${m.n}"><span class="li-ico gold">${ornament(m.n, 44)}</span><span class="li-body"><span class="li-t">${m.name}</span><span class="li-s">${m.kunya} • ${m.short}</span></span>${S.icon('chevron-left')}</a>`)}</div></div>`
    };
  });
  S.router.add('/imams/timeline', async (p, q) => {
    const D = S.data.sample; const f = q.f || 'all'; const items = [];
    D.imams.forEach((m) => { if (m.birth && m.birth.hijriYear != null) items.push({ y: m.birth.hijriYear, t: 'ولادة ' + m.name, k: 'imam', n: m.n }); if (m.death && m.death.hijriYear != null) items.push({ y: m.death.hijriYear, t: (m.n === 12 ? '' : 'وفاة/شهادة ') + m.name, k: 'imam', n: m.n }); (m.events || []).forEach((e) => items.push({ y: e.y, t: e.t + ' — ' + m.short, k: 'event', n: m.n })); });
    D.events.forEach((e) => items.push({ y: e.y, t: e.t, k: 'event' }));
    (await allEntries('events')).forEach((e) => items.push({ y: +e.extra.year, t: e.title, k: 'user', id: e.id, src: (e.sources[0] || {}).book }));
    const seen = new Set(); const uniq = items.filter((x) => { const key = x.y + '|' + x.t; if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => a.y - b.y);
    const rows = uniq.filter((x) => f === 'all' || (f === 'imam' && x.k === 'imam') || (f === 'event' && x.k === 'event') || (f === 'user' && x.k === 'user'));
    const cent = {}; rows.forEach((x) => { const c = x.y < 1 ? 0 : Math.ceil(x.y / 100); (cent[c] = cent[c] || []).push(x); });
    return {
      title: 'الخط الزمني', nav: 'more', back: '/imams',
      html: S.h`<div class="stack"><div class="chips">${[['all', 'الكل'], ['imam', 'ولادات ووفيات الأئمة'], ['event', 'أحداث'], ['user', 'مضافة بمصادر']].map(([k, t]) => S.h`<a class="chip ${f === k ? 'active' : ''}" href="#/imams/timeline?f=${k}">${t}</a>`)}</div>
        ${S.ui.notice('info', 'ملاحظة', 'السنوات هجرية، والميلادية تقريبية بالتحويل الحسابي. الأحداث العامة من بيانات تمهيدية تُراجَع على المصادر؛ أضِف أحداثاً موثقة من «أحداث تاريخية».')}
        ${rows.length ? Object.keys(cent).sort((a, b) => a - b).map((c) => S.h`<div class="tl-group"><div class="tl-h">${+c === 0 ? 'قبل الهجرة وبدايتها' : 'القرن ' + S.n(c) + ' هـ'}</div>${cent[c].map((x) => S.h`<${S.raw(x.n || x.id ? 'a' : 'div')} class="tl-i ${x.k}" ${S.raw(x.n ? 'href="#/imams/' + x.n + '"' : x.id ? 'href="#/research/events/' + esc(x.id) + '"' : '')}><span class="tl-y">${S.n(Math.abs(x.y))}${x.y < 0 ? ' ق.هـ' : ' هـ'}</span><span class="tl-t">${x.t}${x.src ? S.h`<small> — ${x.src}</small>` : ''}</span></${S.raw(x.n || x.id ? 'a' : 'div')}>`)}</div>`) : S.ui.empty('timeline', 'لا عناصر في هذا التصنيف')}
        </div>`
    };
  });
  S.router.add('/imams/:n', async (p) => {
    const m = S.data.sample.imams.find((x) => x.n === +p.n); if (!m) return { title: 'إمام', back: '/imams', html: S.ui.empty('alert', 'غير موجود') };
    const quotes = (await allEntries('imam_quotes')).filter((e) => +e.extra.imam === m.n); const sirah = (await allEntries('imam_sirah')).filter((e) => +e.extra.imam === m.n);
    const narr = (await allEntries('narrations')).filter((e) => (e.extra.speaker || '') && S.norm(e.extra.speaker).includes(S.norm(plainName(m.name)).split(' ')[0]) && S.norm(e.extra.speaker).includes(S.norm(plainName(m.name)).split(' ').slice(-1)[0]));
    const books = L().search({ q: plainName(m.name) }).slice(0, 6); const place = S.data.sample.places.find((x) => x.id === PLACE_OF[m.n]);
    const ent = (e, c) => S.h`<a class="li" href="#/research/${c}/${e.id}"><span class="li-body"><span class="li-t">${e.title}</span><span class="li-s">${cite(e.sources[0])}</span></span>${S.icon('chevron-left')}</a>`;
    return {
      title: m.short, nav: 'more', back: '/imams', actions: [{ icon: 'chevron-right', label: 'السابق', href: '#/imams/' + (m.n > 1 ? m.n - 1 : 12) }, { icon: 'chevron-left', label: 'التالي', href: '#/imams/' + (m.n < 12 ? m.n + 1 : 1) }],
      html: S.h`<div class="stack"><div class="card imam-hero"><div class="gold">${ornament(m.n, 96)}</div><h2 class="nm">${m.name}</h2><div class="small muted">زخرفة هندسية رمزية — لا صورة تاريخية</div></div>
        <div class="card"><div class="kv"><span>الكنية</span><b>${m.kunya}</b></div><div class="kv"><span>الألقاب</span><b>${m.titles.join('، ')}</b></div><div class="kv"><span>الأب والأم</span><b>${m.father}</b></div>
          <div class="kv"><span>الولادة</span><b>${m.birth.date ? m.birth.date + ' — ' : ''}${yrStr(m.birth.hijriYear)}<br><small>${m.birth.place || ''}</small></b></div>
          ${m.death.hijriYear != null ? S.h`<div class="kv"><span>الوفاة/الشهادة</span><b>${m.death.date ? m.death.date + ' — ' : ''}${yrStr(m.death.hijriYear)}<br><small>${m.death.cause || ''}</small></b></div>` : S.h`<div class="kv"><span>الوفاة</span><b>لا ينطبق (الإمام الحجة المنتظَر عند الإمامية)</b></div>`}
          <div class="kv"><span>المرقد</span><b>${m.burial || '—'}</b></div>${place ? S.h`<a class="btn sm mt" href="#/research/places">${S.icon('map-pin')} المكان في «الأماكن والمراقد»</a>` : ''}</div>
        ${m.variance ? S.ui.notice('warn', 'اختلاف في المصادر', m.variance) : ''}
        <div class="card"><div class="card-t">${S.icon('timeline')} أحداث مرتبطة</div>${(m.events || []).length ? m.events.map((e) => S.h`<div class="kv"><span>${S.n(e.y)} هـ</span><b>${e.t}</b></div>`) : S.h`<p class="small muted nm">لا أحداث مضمَّنة. أضِف أحداثاً موثقة من «أحداث تاريخية».</p>`}<a class="btn sm mt" href="#/imams/timeline">الخط الزمني الكامل</a></div>
        <div class="card"><div class="card-t">${S.icon('scroll')} السيرة</div>${sirah.length ? sirah.map((e) => ent(e, 'imam_sirah')) : S.h`<p class="small muted nm">لم تُضَف سيرة موثقة بعد. لا يعرض سِراج نصوص سيرة غير موثقة.</p>`}</div>
        <div class="card"><div class="card-t">${S.icon('scroll')} الأقوال المنقولة</div>${quotes.length ? quotes.map((e) => ent(e, 'imam_quotes')) : S.h`<p class="small muted nm">لا أقوال موثقة بعد.</p>`}</div>
        ${narr.length ? S.h`<div class="card"><div class="card-t">${S.icon('scroll')} روايات في الموسوعة عن هذا الإمام</div>${narr.map((e) => ent(e, 'narrations'))}</div>` : ''}
        <div class="card"><div class="card-t">${S.icon('link')} مصادر مقترحة للرجوع</div><ul class="list-b small">${(m.sourcesHint || []).map((x) => S.h`<li>${x}</li>`)}</ul><p class="tiny muted nm">قائمة كتب للرجوع إليها وليست اقتباساً منها. لم يُنقل منها نص.</p></div>
        <div class="card"><div class="card-t">${S.icon('library')} كتب من المكتبة (بحث بالاسم)</div>${books.length ? S.h`<div class="stack s">${books.map(L().row)}</div>` : S.h`<p class="small muted nm">لا نتائج بالاسم في المكتبة الحالية.</p>`}<p class="tiny muted nm">نتائج بحث نصي في المكتبة وليست توثيقاً لعلاقة الكتاب بالإمام.</p></div></div>`
    };
  });

  /* =========================== الموسوعة العقائدية =========================== */
  const ASPECT_EXTRA = [['quran', 'الأدلة القرآنية'], ['narr', 'الأدلة الروائية'], ['disc', 'مناقشة المسائل'], ['books', 'الكتب المتخصصة']];
  S.router.add('/aqeedah', async () => {
    const A = S.data.sample.aspects; const disc = await allEntries('discussions'); const terms = await allEntries('aqeedah_terms');
    return {
      title: 'الموسوعة العقائدية', nav: 'more', back: '/more',
      html: S.h`<div class="stack"><div class="card hero-mini"><b>الموسوعة العقائدية</b><p class="small nm">أصول الاعتقاد مع الأدلة القرآنية والروائية والمصادر المتخصصة. يُظهر سِراج الأقوال المختلفة بمصادرها ولا يقدّم المختلَف فيه على أنه متفق عليه.</p></div>
        ${S.ui.notice('warn', 'تعريفات تمهيدية', 'الملخصات هنا تمهيدية عامة ولا تغني عن الكتب المتخصصة المذكورة. ما لم يُوثَّق بمصدر لا يُعرض نصاً.')}
        <div class="list">${A.map((a) => S.h`<a class="li" href="#/aqeedah/${a.id}"><span class="li-ico">${S.icon('network')}</span><span class="li-body"><span class="li-t">${a.title}</span><span class="li-s">${a.brief}</span></span>${a.disputed ? S.ui.badge('فيه خلاف بحثي', 'warn') : ''}${S.icon('chevron-left')}</a>`)}</div>
        <div class="grid2"><a class="card tap" href="#/research/aqeedah_terms"><b>المصطلحات العقائدية</b><div class="small muted">${S.n(terms.length)} مدخلاً موثقاً</div></a><a class="card tap" href="#/research/discussions"><b>مناقشة المسائل</b><div class="small muted">${S.n(disc.length)} مسألة موثقة</div></a></div>
        <a class="btn block" href="#/library/sec/ayat">${S.icon('library')} الآيات النازلة في أهل البيت (المكتبة)</a></div>`
    };
  });
  S.router.add('/aqeedah/:id', async (p) => {
    const a = S.data.sample.aspects.find((x) => x.id === p.id); if (!a) return { title: 'عقيدة', back: '/aqeedah', html: S.ui.empty('alert', 'غير موجود') };
    const ents = await allEntries(); const mine = (col) => ents.filter((e) => e.collection === col && (e.extra.topic === a.id || (e.tags || []).includes(a.id)));
    const narr = mine('narrations'); const disc = mine('discussions'); const terms = mine('aqeedah_terms'); const books = (a.books || []).map((id) => L().byId.get(id)).filter(Boolean);
    const ent = (e, c) => S.h`<a class="li" href="#/research/${c}/${e.id}"><span class="li-body"><span class="li-t">${e.title}</span><span class="li-s">${cite(e.sources[0])}</span></span>${S.icon('chevron-left')}</a>`;
    return {
      title: a.title, nav: 'more', back: '/aqeedah',
      html: S.h`<div class="stack"><div class="card"><b>${a.title}</b><p class="nm">${a.brief}</p>${a.disputed ? S.ui.notice('warn', 'موضع خلاف بحثي', 'تتعدد الأقوال في تفاصيل هذه المسألة بين المدارس؛ تُعرض الأقوال بمصادرها ولا يُعتمد قول واحد على أنه الإجماع.') : ''}<div class="tiny muted">${a.status}</div></div>
        <div class="card"><div class="card-t">${S.icon('book-open')} الأدلة القرآنية</div>${(a.verses || []).length ? S.h`<div class="chips">${a.verses.map(verseLink)}</div><p class="tiny muted nm">مواضع الآيات للرجوع؛ الاستدلال بها وتفسيرها في الكتب أدناه ومقارنة التفاسير.</p>` : S.h`<p class="small muted nm">لم تُحدَّد آيات مضمَّنة لهذا المحور؛ أضِف مداخل تفسير موثقة.</p>`}<a class="btn sm mt" href="#/research/compare-tafsir">${S.icon('book-open')} مقارنة التفاسير</a></div>
        <div class="card"><div class="card-t">${S.icon('scroll')} الأدلة الروائية</div>${narr.length ? narr.map((e) => ent(e, 'narrations')) : S.h`<p class="small muted nm">لا روايات موثقة مربوطة بهذا المحور بعد.</p>`}</div>
        <div class="card"><div class="card-t">${S.icon('scale')} مناقشة المسائل والأقوال</div>${disc.length ? disc.map((e) => ent(e, 'discussions')) : S.h`<p class="small muted nm">لا مناقشات موثقة بعد.</p>`}</div>
        ${terms.length ? S.h`<div class="card"><div class="card-t">${S.icon('network')} مصطلحات</div>${terms.map((e) => ent(e, 'aqeedah_terms'))}</div>` : ''}
        <div class="card"><div class="card-t">${S.icon('library')} الكتب المتخصصة</div>${books.length ? S.h`<div class="stack s">${books.map(L().row)}</div>` : S.h`<p class="small muted nm">لا كتب مربوطة.</p>`}<a class="btn sm mt" href="#/library/sec/fiqh">${S.icon('library')} تصفّح المكتبة</a></div></div>`
    };
  });

  /* =========================== مركز البحث: الوحدات العشرون =========================== */
  const UNITS = [
    [1, 'موسوعة الروايات', 'scroll', '/research/narrations', 'narrations'], [2, 'موسوعة الرواة', 'users', '/research/narrators', 'narrators'], [3, 'فهرس المؤلفين', 'user', '/research/authors'], [4, 'المصطلحات العقائدية', 'network', '/research/aqeedah_terms', 'aqeedah_terms'],
    [5, 'المصطلحات الفقهية', 'gavel', '/research/fiqh_terms', 'fiqh_terms'], [6, 'خريطة المعرفة الإسلامية', 'grid', '/research/map'], [7, 'الخط الزمني التاريخي', 'timeline', '/imams/timeline'], [8, 'الأماكن والمراقد', 'map-pin', '/research/places'],
    [9, 'أرشيف المخطوطات', 'file', '/research/manuscripts', 'manuscripts'], [10, 'مقارنة التفاسير', 'book-open', '/research/compare-tafsir', 'tafsir'], [11, 'مقارنة الروايات', 'scale', '/research/compare-narrations'], [12, 'البحث عن رواية بجزء من نصها', 'search', '/research/narration-search'],
    [13, 'تخريج الروايات', 'link', '/research/narrations?view=takhrij'], [14, 'اختلاف ألفاظ الرواية', 'repeat', '/research/narrations?view=variants'], [15, 'الأسانيد المتاحة', 'network', '/research/narrations?view=isnad'], [16, 'أحكام العلماء على الروايات', 'gavel', '/research/narrations?view=judgments'],
    [17, 'ربط الآيات بالكتب والروايات', 'book-open', '/research/verse-links'], [18, 'ربط المؤلفين بمؤلفاتهم', 'library', '/research/authors'], [19, 'دفتر التدبر', 'notebook', '/tadabbur'], [20, 'نظام توثيق التراث', 'shield', '/research/docs']
  ];
  S.router.add('/research', async () => {
    const ents = await allEntries(); const cnt = (c) => ents.filter((e) => e.collection === c).length;
    return {
      title: 'الموسوعة العلمية والبحثية', nav: 'more', back: '/more',
      html: S.h`<div class="stack"><div class="card hero-mini"><b>عشرون وحدة بحثية</b><p class="small nm">أدوات توثيق ومقارنة. كل مدخل بمصدره، والأحكام منسوبة لقائليها، ولا يصدر التطبيق أحكاماً آلية على صحة الروايات.</p></div>
        <div class="grid2">${UNITS.map(([n, t, ic, href, col]) => S.h`<a class="card tap unit" href="#${href}"><div class="row between"><span class="unit-n">${S.n(n)}</span>${S.icon(ic)}</div><b>${t}</b>${col ? S.h`<div class="tiny muted">${S.n(cnt(col))} مدخلاً</div>` : ''}</a>`)}</div>
        <div class="card"><div class="card-t">${S.icon('plus')} مجموعات إضافية</div><div class="chips">${['asbab', 'events', 'discussions', 'imam_quotes', 'imam_sirah'].map((c) => S.h`<a class="chip" href="#/research/${c}">${COLS[c].title} (${S.n(cnt(c))})</a>`)}</div></div>
        ${S.ui.notice('info', 'مصدر المداخل', S.h`<span>المداخل الموثقة تصل إلى التطبيق عبر <a href="#/updates">تحديثات المحتوى</a> الموقّعة من الناشر؛ لا يمكن لأي مستخدم إضافة مداخل. التصفح والمقارنة متاحان للجميع.</span>`)}</div>`
    };
  });

  /* ---------- فهرس المؤلفين وربطهم بمؤلفاتهم (3 و18) ---------- */
  S.router.add('/research/authors', () => {
    const by = new Map(); L().published().forEach((b) => { const k = b.authorId || b.author; (by.get(k) || by.set(k, []).get(k)).push(b); });
    const rows = Array.from(by.entries()).map(([k, bs]) => ({ k, a: L().authors.get(k) || { name: bs[0].author, death: bs[0].authorDeath }, bs })).sort((x, y) => x.a.name.localeCompare(y.a.name, 'ar'));
    return {
      title: 'فهرس المؤلفين', nav: 'more', back: '/research',
      html: S.h`<div class="stack"><div class="searchbox">${S.icon('search')}<input class="input" data-inp="resAuth" placeholder="ابحث باسم المؤلف أو الكتاب" autocomplete="off"></div><div class="small muted">${S.n(rows.length)} مؤلفاً من الكتب المنشورة فقط</div>
        <div id="auth-list">${rows.map((r) => S.h`<details class="acc" data-s="${S.norm(r.a.name + ' ' + r.bs.map((b) => b.title).join(' '))}"><summary><b>${r.a.name}</b> <span class="small muted">${r.a.death ? 'ت ' + S.n(r.a.death) + ' هـ • ' : ''}${S.n(r.bs.length)} كتاب</span></summary><div class="acc-b">${r.bs.map((b) => S.h`<a class="li" href="#/library/book/${b.id}"><span class="li-body"><span class="li-t">${b.title}</span><span class="li-s">${(S.sectionById[b.section] || {}).title || ''}</span></span>${S.icon('chevron-left')}</a>`)}${r.a.id ? S.h`<a class="btn xs mt" href="#/library/author/${r.a.id}">صفحة المؤلف</a>` : ''}</div></details>`)}</div></div>`
    };
  });
  S.onInput('resAuth', (el) => { const t = S.norm(el.value); S.$$('#auth-list details').forEach((d) => { d.hidden = !!t && !d.dataset.s.includes(t); if (t && !d.hidden) d.open = true; }); });

  /* ---------- خريطة المعرفة (6) ---------- */
  S.router.add('/research/map', async () => {
    const ents = await allEntries(); const cnt = L().countBySection(); const secs = S.sections; const W = 400, C = 200; const pt = (i, n, r) => { const t = -Math.PI / 2 + (2 * Math.PI * i) / n; return [C + r * Math.cos(t), C + r * Math.sin(t)]; };
    const OUT = [['narrations', 'روايات', 'fadail'], ['narrators', 'رواة', 'fadail'], ['tafsir', 'تفسير', 'tafsir'], ['asbab', 'أسباب نزول', 'ayat'], ['fiqh_terms', 'فقهية', 'fiqh'], ['aqeedah_terms', 'عقائدية', null], ['places', 'أماكن', 'fadail'], ['manuscripts', 'مخطوطات', null]];
    const secPos = secs.map((s, i) => pt(i, secs.length, 95)); const idx = Object.fromEntries(secs.map((s, i) => [s.id, i]));
    const outs = OUT.map((o, i) => { const p = pt(i + 0.5, OUT.length, 168); return { o, p, n: ents.filter((e) => e.collection === o[0]).length }; });
    const nodeS = secs.map((s, i) => S.h`<a href="#/library/sec/${s.id}"><circle cx="${secPos[i][0]}" cy="${secPos[i][1]}" r="30" class="mp-s"/><text x="${secPos[i][0]}" y="${secPos[i][1] - 3}" class="mp-t" text-anchor="middle">${s.title.length > 14 ? s.title.slice(0, 13) + '…' : s.title}</text><text x="${secPos[i][0]}" y="${secPos[i][1] + 12}" class="mp-n" text-anchor="middle">${S.n(cnt[s.id] || 0)} كتاب</text></a>`);
    return {
      title: 'خريطة المعرفة', nav: 'more', back: '/research',
      html: S.h`<div class="stack"><div class="card"><svg viewBox="0 0 ${W} ${W}" class="kmap" role="img" aria-label="خريطة المعرفة">${secs.map((s, i) => S.h`<line x1="${C}" y1="${C}" x2="${secPos[i][0]}" y2="${secPos[i][1]}" class="mp-l"/>`)}${outs.map((x) => (x.o[2] != null ? S.h`<line x1="${x.p[0]}" y1="${x.p[1]}" x2="${secPos[idx[x.o[2]]][0]}" y2="${secPos[idx[x.o[2]]][1]}" class="mp-l2"/>` : S.h`<line x1="${x.p[0]}" y1="${x.p[1]}" x2="${C}" y2="${C}" class="mp-l2"/>`))}<circle cx="${C}" cy="${C}" r="26" class="mp-c"/><text x="${C}" y="${C + 5}" text-anchor="middle" class="mp-ct">سِراج</text>${nodeS}${outs.map((x) => S.h`<a href="#/research/${x.o[0]}"><circle cx="${x.p[0]}" cy="${x.p[1]}" r="23" class="mp-o"/><text x="${x.p[0]}" y="${x.p[1] - 1}" text-anchor="middle" class="mp-t">${x.o[1]}</text><text x="${x.p[0]}" y="${x.p[1] + 11}" text-anchor="middle" class="mp-n">${S.n(x.n)}</text></a>`)}</svg>
        <p class="tiny muted nm">الدوائر الكبيرة أقسام المكتبة (بعدد الكتب المنشورة)، والخارجية مجموعات البحث (بعدد المداخل الموثقة). الخطوط تصنيف منهجي للتنقل لا ادعاء علمي بالعلاقة. اضغط أي دائرة للدخول.</p></div>
        ${secs.map((s) => { const subs = {}; L().published().filter((b) => b.section === s.id).forEach((b) => { if (b.subcat) subs[b.subcat] = (subs[b.subcat] || 0) + 1; }); return S.h`<details class="acc"><summary><b>${s.title}</b> <span class="small muted">${S.n(cnt[s.id] || 0)} كتاب</span></summary><div class="acc-b">${s.subcats.map((sc) => S.h`<a class="li" href="#/library/sec/${s.id}?sub=${sc}"><span class="li-body"><span class="li-t">${sc}</span></span><span class="li-end">${S.n(subs[sc] || 0)}</span></a>`)}</div></details>`; })}</div>`
    };
  });

  /* ---------- الأماكن والمراقد (8) ---------- */
  const hav = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r; const x = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  S.router.add('/research/places', async () => {
    const loc = S.prayer && S.prayer.loc && S.prayer.loc(); const mine = (await allEntries('places')).map((e) => ({ id: e.id, name: e.title, city: e.extra.city || '', country: e.extra.country || '', lat: e.extra.lat === '' || e.extra.lat == null ? null : +e.extra.lat, lng: e.extra.lng === '' || e.extra.lng == null ? null : +e.extra.lng, who: e.text, user: true, src: cite(e.sources[0]) }));
    const all = S.data.sample.places.concat(mine); if (loc) all.forEach((p) => { if (p.lat != null) p.km = hav(loc.lat, loc.lng, p.lat, p.lng); });
    return {
      title: 'الأماكن والمراقد', nav: 'more', back: '/research', actions: [],
      html: S.h`<div class="stack">${S.ui.notice('info', 'عن الإحداثيات', 'إحداثيات المراقد المضمَّنة تقريبية للتنقل على الخريطة وليست مسحاً دقيقاً. الخريطة تُفتح في موقع خارجي (OpenStreetMap) وتتطلب إنترنت.')}${loc ? '' : S.ui.notice('info', 'لعرض المسافة عنك', 'حدّد موقعك من «الصلاة ← الموقع».')}
        ${all.map((p) => S.h`<div class="card"><div class="row between"><b>${p.name}</b>${p.user ? S.ui.badge('مضاف بمصدر', 'info') : ''}</div><div class="small muted">${[p.city, p.country].filter(Boolean).join('، ')}</div>${p.who ? S.h`<div class="small">${p.who}</div>` : ''}${p.src ? S.h`<div class="tiny muted">المصدر: ${p.src}</div>` : ''}${p.km != null ? S.h`<div class="small">${S.icon('compass')} تبعد عنك نحو <b>${S.n(Math.round(p.km))}</b> كم (خط مستقيم)</div>` : ''}${p.lat != null ? S.h`<a class="btn sm mt" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}" target="_blank" rel="noopener noreferrer">${S.icon('map-pin')} فتح على الخريطة</a>` : ''}</div>`)}</div>`
    };
  });

  /* ---------- مقارنة التفاسير (10) + ربط الآيات (17) ---------- */
  const verseForm = (action, cur) => S.h`<div class="card"><div class="grid2"><div class="field"><label>السورة</label><select class="select" id="vs-s">${SUR().map((x) => S.h`<option value="${x.n}" ${cur && cur.s === x.n ? S.raw('selected') : ''}>${S.n(x.n)}. ${x.name}</option>`)}</select></div>${S.f.text('vsa', 'الآية', cur ? cur.a : '', { type: 'number', ltr: true, min: 1 })}</div><button class="btn primary block" data-act="${action}">عرض</button></div>`;
  const readVerseForm = () => { const s = +S.$('#vs-s').value, a = +S.$('#f_vsa').value; const su = SUR()[s - 1]; if (!(a >= 1 && a <= su.ayahs)) { S.toast('رقم الآية خارج السورة (1–' + su.ayahs + ')', 'err'); return null; } return s + ':' + a; };
  S.act('cmpTafsirGo', () => { const v = readVerseForm(); if (v) S.router.go('/research/compare-tafsir?verse=' + v); });
  S.act('verseLinksGo', () => { const v = readVerseForm(); if (v) S.router.go('/research/verse-links?verse=' + v); });
  S.router.add('/research/compare-tafsir', async (p, q) => {
    const pv = q.verse ? parseVerse(q.verse) : null; const list = pv ? (await allEntries('tafsir')).filter((e) => (e.verses || []).some((v) => inVerse(v, pv.s, pv.a))) : [];
    const libs = L().published().filter((b) => b.section === 'tafsir').slice(0, 8);
    return {
      title: 'مقارنة التفاسير', nav: 'more', back: '/research',
      html: S.h`<div class="stack">${verseForm('cmpTafsirGo', pv)}
        ${pv ? S.h`<div class="card hero-mini"><b>${verseLabel(pv.str)}</b>${S.quran && S.quran.hasText() ? S.h`<p class="q-inline">${S.quran.display(pv.s, pv.a)}</p>` : S.h`<p class="tiny muted nm">نص الآية يظهر بعد تنزيل المصحف من «القرآن ← التنزيلات».</p>`}</div>
          ${list.length ? S.h`${S.ui.notice('info', S.n(list.length) + ' تفسير موثق لهذه الآية', 'تُعرض كما أُدخلت بمصادرها؛ التطبيق لا يُرجّح بين الأقوال.')}${list.map((e) => S.h`<div class="card"><div class="row between"><b>${e.extra.mufassir || (e.sources[0] || {}).book}</b>${statusBadge(e)}</div><p class="quote">${e.text}</p><div class="tiny muted">${e.sources.map(cite).join(' ؛ ')}</div><a class="btn xs mt" href="#/research/tafsir/${e.id}">فتح المدخل</a></div>`)}` : S.ui.empty('book-open', 'لا مداخل تفسير موثقة لهذه الآية', 'لا يختلق سِراج تفاسير. ارجع إلى كتب التفسير في المكتبة أو أضف مدخلاً بمصدره.')}
          ${libs.length ? S.h`${S.ui.sectionTitle('كتب التفسير في المكتبة', '#/library/sec/tafsir')}<div class="stack s">${libs.map(L().row)}</div>` : ''}` : ''}</div>`
    };
  });
  S.router.add('/research/verse-links', async (p, q) => {
    const pv = q.verse ? parseVerse(q.verse) : null; let ents = [], ahl = [], asp = [], notes = [];
    if (pv) { ents = (await allEntries()).filter((e) => (e.verses || []).some((v) => inVerse(v, pv.s, pv.a))); ahl = S.data.sample.ahlVerses.filter((v) => v.s === pv.s && pv.a >= v.a && pv.a <= v.a); asp = S.data.sample.aspects.filter((a) => (a.verses || []).some((v) => inVerse(v, pv.s, pv.a))); notes = (await S.db.where('notes', 'type', 'quran')).filter((n) => n.ref === pv.s + ':' + pv.a); }
    const books = Array.from(new Set(ahl.flatMap((v) => v.relatedBooks).concat(asp.flatMap((a) => a.books || [])))).map((id) => L().byId.get(id)).filter((b) => b && L().visible(b));
    return {
      title: 'ربط الآيات بالكتب والروايات', nav: 'more', back: '/research',
      html: S.h`<div class="stack">${verseForm('verseLinksGo', pv)}
        ${pv ? S.h`<div class="card hero-mini"><b>${verseLabel(pv.str)}</b><a class="btn sm mt" href="#/quran/ayah/${pv.s}/${pv.a}">صفحة الآية</a></div>
          ${ahl.map((v) => S.h`<div class="notice gold">${S.icon('star')}<div><b>${v.name}</b><div class="small">${v.agreement}</div></div></div>`)}${asp.map((a) => S.h`<a class="notice info" href="#/aqeedah/${a.id}">${S.icon('network')}<div>مذكورة في محور عقدي: <b>${a.title}</b></div></a>`)}
          <div class="card"><div class="card-t">${S.icon('scroll')} مداخل موثقة مربوطة بالآية</div>${ents.length ? ents.map((e) => S.h`<a class="li" href="#/research/${e.collection}/${e.id}"><span class="li-body"><span class="li-t">${e.title}</span><span class="li-s">${COLS[e.collection].title} • ${cite(e.sources[0])}</span></span>${S.icon('chevron-left')}</a>`) : S.h`<p class="small muted nm">لا مداخل بعد.</p>`}</div>
          <div class="card"><div class="card-t">${S.icon('library')} كتب ذات صلة</div>${books.length ? S.h`<div class="stack s">${books.map(L().row)}</div>` : S.h`<p class="small muted nm">لا كتب مرتبطة بهذه الآية في البيانات الحالية.</p>`}</div>
          ${notes.length ? S.h`<div class="card"><div class="card-t">${S.icon('notebook')} ملاحظاتي</div>${notes.map((n) => S.h`<p class="nm">${n.text}</p>`)}</div>` : ''}` : ''}</div>`
    };
  });

  /* ---------- مقارنة الروايات (11) والبحث بجزء من النص (12) ---------- */
  S.router.add('/research/compare-narrations', async (p, q) => {
    const list = (await allEntries('narrations')).sort((a, b) => a.title.localeCompare(b.title, 'ar')); const A = list.find((e) => e.id === q.a), B = list.find((e) => e.id === q.b);
    const ops = A && B ? diffWords(A.text, B.text) : null; const st = diffStats(ops);
    return {
      title: 'مقارنة الروايات', nav: 'more', back: '/research',
      html: S.h`<div class="stack">${list.length < 2 ? S.ui.empty('scale', 'تحتاج روايتين موثقتين على الأقل', 'تصل الروايات الموثقة عبر تحديثات المحتوى الموقّعة؛ حين تتوفر روايتان أو أكثر تظهر المقارنة هنا.', S.h`<a class="btn" href="#/updates">تحديثات المحتوى</a>`) : S.h`<div class="card">${S.f.select('cmpa', 'الرواية الأولى', [{ v: '', t: '— اختر —' }].concat(list.map((e) => ({ v: e.id, t: e.title }))), q.a || '')}${S.f.select('cmpb', 'الرواية الثانية', [{ v: '', t: '— اختر —' }].concat(list.map((e) => ({ v: e.id, t: e.title }))), q.b || '')}<button class="btn primary block" data-act="cmpNarrGo">${S.icon('scale')} قارن</button></div>`}
        ${A && B ? S.h`${S.ui.notice('info', 'قراءة المقارنة', 'المقارنة لفظية فقط (كلمات). لا تدلّ على صحة أو ضعف أيٍّ من الروايتين، والحكم عليهما للعلماء بمصادرهم.')}
          <div class="card"><div class="kv"><span>كلمات مشتركة</span><b>${S.n(st ? st.same : '—')}</b></div><div class="kv"><span>كلمات في الثانية فقط</span><b class="ok">${S.n(st ? st.add : '—')}</b></div><div class="kv"><span>كلمات في الأولى فقط</span><b class="bad">${S.n(st ? st.del : '—')}</b></div></div>
          <div class="card"><div class="card-t">الفروق</div><p class="quote diff">${diffHtml(ops)}</p><div class="tiny muted"><span class="df-add">أخضر</span> زيادة في الثانية • <span class="df-del">مشطوب</span> موجود في الأولى فقط</div></div>
          <div class="card"><b>${A.title}</b><div class="tiny muted">${A.sources.map(cite).join(' ؛ ')}</div><p class="quote">${A.text}</p></div><div class="card"><b>${B.title}</b><div class="tiny muted">${B.sources.map(cite).join(' ؛ ')}</div><p class="quote">${B.text}</p></div>` : ''}</div>`
    };
  });
  S.act('cmpNarrGo', () => { const a = S.$('#f_cmpa').value, b = S.$('#f_cmpb').value; if (!a || !b || a === b) return S.toast('اختر روايتين مختلفتين', 'err'); S.router.go('/research/compare-narrations?a=' + a + '&b=' + b); });
  S.router.add('/research/narration-search', async (p, q) => {
    const term = (q.q || '').trim(); const toks = S.norm(term).split(' ').filter(Boolean); let res = [];
    if (toks.length) (await allEntries('narrations')).forEach((e) => { const pool = [{ w: 'النص', t: e.text }].concat((e.variants || []).map((v, i) => ({ w: 'لفظ آخر ' + S.n(i + 1), t: v.text }))); const hits = pool.filter((x) => toks.every((t) => S.norm(x.t).includes(t))); if (hits.length) res.push({ e, hits }); });
    const snip = (t) => { const n = S.norm(t); const i = n.indexOf(toks[0]); const s = Math.max(0, i - 40); return (s ? '… ' : '') + t.slice(s, s + 160) + (t.length > s + 160 ? ' …' : ''); };
    return {
      title: 'البحث عن رواية', nav: 'more', back: '/research',
      html: S.h`<div class="stack"><div class="searchbox">${S.icon('search')}<input class="input" id="nsq" value="${term}" placeholder="جزء من نص الرواية (دون تشكيل)" enterkeyhint="search" autocomplete="off"></div><button class="btn primary block" data-act="nsGo">بحث</button>
        ${S.ui.notice('info', 'نطاق البحث', 'يبحث في الروايات الموثقة المُضافة إلى سِراج (نصها وألفاظها الأخرى) فقط. لا يبحث في النصوص الكاملة للكتب، ولا يُعيد رواية غير موجودة في الموسوعة.')}
        ${toks.length ? (res.length ? S.h`<div class="small muted">${S.n(res.length)} رواية</div>${res.map((r) => S.h`<a class="card tap" href="#/research/narrations/${r.e.id}"><b>${r.e.title}</b><p class="small nm">${snip(r.hits[0].t)}</p><div class="tiny muted">${r.hits[0].w} • ${cite(r.e.sources[0])}</div></a>`)}` : S.ui.empty('search', 'لا نتائج', 'لم تُوجد رواية موثقة بهذا النص في الموسوعة.')) : ''}</div>`,
      mount() { const i = S.$('#nsq'); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/research/narration-search?q=' + encodeURIComponent(i.value)); }); }
    };
  });
  S.act('nsGo', () => S.router.go('/research/narration-search?q=' + encodeURIComponent(S.$('#nsq').value)));

  /* ---------- نظام توثيق التراث (20) ---------- */
  S.router.add('/research/docs', async () => {
    const ents = await allEntries(); const rows = Object.keys(COLS).map((c) => { const es = ents.filter((e) => e.collection === c); return { c, n: es.length, rev: es.filter((e) => e.status === 'reviewed').length }; });
    return {
      title: 'نظام توثيق التراث', nav: 'more', back: '/research',
      html: S.h`<div class="stack"><div class="card"><div class="card-t">${S.icon('shield')} قواعد التوثيق</div><ul class="list-b small"><li>لا يُحفظ مدخل بلا مصدر: اسم الكتاب + (جزء/صفحة/رقم/رابط).</li><li>النص يُنسخ من طبعة معتمدة كما هو؛ لا تُكتب النصوص الدينية من الذاكرة.</li><li>أحكام العلماء تُنسب لقائلها ومصدرها، ولا يُصدر التطبيق حكماً آلياً.</li><li>الخلاف يُدخل أقوالاً منسوبة، لا حقيقةً واحدة.</li><li>لا يُضاف أي مدخل داخل هذا التطبيق: يصل من الناشر في حزمة موقّعة تُفحص بالقواعد نفسها قبل قبولها.</li></ul></div>
        <div class="card"><div class="card-t">${S.icon('chart')} حالة المجموعات</div><div class="table-wrap"><table class="tbl"><tr><th>المجموعة</th><th>مداخل</th><th>مراجَعة</th></tr>${rows.map((r) => S.h`<tr><td><a href="#/research/${r.c}">${COLS[r.c].title}</a></td><td>${S.n(r.n)}</td><td>${S.n(r.rev)}</td></tr>`)}</table></div></div></div>`
    };
  });
  /* ---------- دفتر التدبر (19) ---------- */
  S.router.add('/tadabbur', async (p, q) => {
    const mine = (await S.db.where('notes', 'type', 'tadabbur')).sort((a, b) => b.ts - a.ts); const qn = (await S.db.where('notes', 'type', 'quran')).sort((a, b) => b.ts - a.ts); const term = S.norm(q.q || '');
    const f = (n) => !term || S.norm(n.text + ' ' + (n.title || '')).includes(term);
    const refTxt = (r) => { const v = parseVerse(r); return v ? verseLabel(v.str) : r; };
    return {
      title: 'دفتر التدبر', nav: 'quran', back: '/research', actions: [{ icon: 'plus', label: 'تدبّر جديد', act: 'tdbEdit' }, { icon: 'download', label: 'تصدير', act: 'tdbExport' }],
      html: S.h`<div class="stack"><div class="searchbox">${S.icon('search')}<input class="input" id="tdq" value="${q.q || ''}" placeholder="ابحث في دفترك"></div>${S.ui.notice('info', 'دفترك خاص بجهازك', 'ما تكتبه هنا يبقى في هذا المتصفح، ويدخل في النسخ الاحتياطي. اكتب تأملاتك بكلماتك؛ ولا يُنسب إلى المصادر ما لم تذكر مصدره بنفسك.')}
        ${mine.filter(f).length ? mine.filter(f).map((n) => S.h`<div class="card"><div class="row between"><b>${n.title || 'تدبّر'}</b><span class="tiny muted">${S.fmt.dt(n.ts)}</span></div>${n.verse ? S.h`<a class="chip" href="#/quran/ayah/${n.verse.split(':')[0]}/${n.verse.split(':')[1].split('-')[0]}">${refTxt(n.verse)}</a>` : ''}<p class="nm">${n.text}</p><div class="row"><button class="btn xs" data-act="tdbEdit" data-id="${n.id}">تعديل</button><button class="btn xs danger" data-act="tdbDel" data-id="${n.id}">حذف</button></div></div>`) : S.ui.empty('notebook', 'لا تدبّرات بعد', 'سجّل ما يفتح الله عليك من فهم في آية أو دعاء.', S.h`<button class="btn primary" data-act="tdbEdit">كتابة تدبّر</button>`)}
        ${qn.filter(f).length ? S.h`${S.ui.sectionTitle('ملاحظاتي على الآيات')}${qn.filter(f).map((n) => S.h`<a class="li" href="#/quran/ayah/${n.ref.split(':')[0]}/${n.ref.split(':')[1]}"><span class="li-body"><span class="li-t">${refTxt(n.ref)}</span><span class="li-s">${n.text}</span></span>${S.icon('chevron-left')}</a>`)}` : ''}</div>`,
      mount() { const i = S.$('#tdq'); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/tadabbur?q=' + encodeURIComponent(i.value)); }); }
    };
  });
  S.act('tdbEdit', async (el) => {
    const n = el.dataset.id ? await S.db.get('notes', el.dataset.id) : null;
    S.modal({ title: n ? 'تعديل التدبّر' : 'تدبّر جديد', body: S.h`${S.f.text('title', 'عنوان (اختياري)', n ? n.title : '')}${S.f.text('verse', 'الآية (اختياري، مثل 2:255)', n ? n.verse : '', { ltr: true })}${S.f.area('text', 'تدبّرك', n ? n.text : '', { rows: 6 })}`, actions: [{ label: 'إلغاء', cls: 'ghost' }, { label: 'حفظ', cls: 'primary', onClick: async (box) => { const d = S.f.read(box); if (!d.text.trim()) { S.toast('اكتب نص التدبّر', 'err'); return false; } if (d.verse.trim() && !parseVerse(d.verse)) { S.toast('آية غير صالحة (الصيغة 2:255)', 'err'); return false; } await S.db.put('notes', { id: n ? n.id : S.uid('nt'), type: 'tadabbur', ref: d.verse.trim() ? parseVerse(d.verse).str : '', verse: d.verse.trim() ? parseVerse(d.verse).str : '', title: d.title.trim(), text: d.text.trim(), ts: n ? n.ts : Date.now() }); S.toast('حُفظ', 'ok'); S.router.refresh(); } }] });
  });
  S.act('tdbDel', async (el) => { if (await S.confirm('حذف هذا التدبّر؟', { danger: true, yes: 'حذف' })) { await S.db.del('notes', el.dataset.id); S.router.refresh(); } });
  S.act('tdbExport', async () => { const a = (await S.db.where('notes', 'type', 'tadabbur')).concat(await S.db.where('notes', 'type', 'quran')).sort((x, y) => x.ts - y.ts); if (!a.length) return S.toast('الدفتر فارغ', 'err'); const t = a.map((n) => '— ' + S.fmt.dt(n.ts) + (n.title ? ' • ' + n.title : '') + (n.verse || n.ref ? ' • ' + (n.verse || n.ref) : '') + '\n' + n.text).join('\n\n'); S.download(new Blob(['﻿' + t], { type: 'text/plain;charset=utf-8' }), 'siraj-tadabbur.txt'); });

  /* ---------- قوائم المجموعات وصفحة المدخل ---------- */
  S.router.add('/research/:col', async (p, q) => {
    const c = COLS[p.col]; if (!c) return { title: 'غير موجود', back: '/research', html: S.ui.empty('alert', 'مجموعة غير معروفة', p.col) };
    let rows = (await allEntries(p.col)).sort((a, b) => (b.ts || 0) - (a.ts || 0)); const view = q.view || ''; const term = S.norm(q.q || '');
    if (term) rows = rows.filter((e) => S.norm(e.title + ' ' + e.text + ' ' + (e.tags || []).join(' ') + ' ' + e.sources.map((s) => s.book).join(' ')).includes(term));
    const V = { takhrij: [(e) => e.sources.length > 1, (e) => S.n(e.sources.length) + ' مصادر'], variants: [(e) => (e.variants || []).length, (e) => S.n(e.variants.length) + ' ألفاظ أخرى'], isnad: [(e) => (e.isnads || []).length, (e) => S.n(e.isnads.length) + ' أسانيد'], judgments: [(e) => (e.scholarRulings || []).length, (e) => S.n(e.scholarRulings.length) + ' أقوال علماء'] };
    const vf = p.col === 'narrations' && V[view]; if (vf) rows = rows.filter(vf[0]); const lim = +(q.n || 40);
    // مرشّح الكتاب + عدّاد المستورد آلياً (لعرضه بصدق): يُحسب قبل التصفية بالكتاب
    const bk = p.col === 'narrations' ? (q.book || '') : ''; const bookCounts = new Map(); let nImp = 0;
    if (p.col === 'narrations') { rows.forEach((e) => { const b = (e.sources[0] || {}).book || ''; if (b) bookCounts.set(b, (bookCounts.get(b) || 0) + 1); if (e.status === 'imported') nImp++; }); if (bk) rows = rows.filter((e) => ((e.sources[0] || {}).book || '') === bk); }
    const topBooks = [...bookCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    const bkHref = (b) => '#/research/narrations?' + [b ? 'book=' + encodeURIComponent(b) : '', view ? 'view=' + view : '', q.q ? 'q=' + encodeURIComponent(q.q) : ''].filter(Boolean).join('&');
    return {
      title: c.title, nav: 'more', back: '/research', actions: [],
      html: S.h`<div class="stack"><div class="searchbox">${S.icon('search')}<input class="input" id="rsq" value="${q.q || ''}" placeholder="بحث في ${c.title}" autocomplete="off"></div>
        ${p.col === 'narrations' ? S.h`<div class="chips">${[['', 'الكل'], ['takhrij', 'التخريج'], ['variants', 'اختلاف الألفاظ'], ['isnad', 'الأسانيد'], ['judgments', 'أحكام العلماء']].map(([k, t]) => S.h`<a class="chip ${view === k ? 'active' : ''}" href="#/research/narrations${k ? '?view=' + k : ''}">${t}</a>`)}</div>${S.ui.notice('warn', 'لا أحكام آلية', 'يعرض سِراج ما أُدخل من أقوال العلماء منسوباً لهم فقط، ولا يُصدر حكماً بصحة أي رواية.')}${nImp ? S.ui.notice('info', S.n(nImp) + ' رواية مستوردة آلياً', 'جُلبت وقت بناء التطبيق من Thaqalayn (thaqalayn.net) بنصها العربي ورقمها ورابطها، ولم تُراجَع في سِراج. افتح الرابط في كل رواية للتحقق قبل النقل أو الاستدلال.') : ''}${topBooks.length > 1 ? S.h`<div class="chips"><a class="chip ${bk ? '' : 'active'}" href="${bkHref('')}">كل الكتب</a>${topBooks.map(([b, n]) => S.h`<a class="chip ${bk === b ? 'active' : ''}" href="${bkHref(b)}">${b} (${S.n(n)})</a>`)}</div>` : ''}` : ''}
        ${p.col === 'imam_quotes' || p.col === 'imam_sirah' ? S.ui.notice('info', 'ملاحظة', 'تُعرض هذه المداخل أيضاً في صفحة كل إمام.') : ''}
        <div class="small muted">${S.n(rows.length)} مدخلاً</div>
        ${rows.length ? S.h`<div class="list">${rows.slice(0, lim).map((e) => S.h`<a class="li" href="#/research/${p.col}/${e.id}"><span class="li-body"><span class="li-t">${e.title}</span><span class="li-s">${cite(e.sources[0])}${e.verses.length ? ' • ' + e.verses.map(verseLabel).join('، ') : ''}</span></span>${vf ? S.ui.badge(vf[1](e), 'info') : statusBadge(e)}${S.icon('chevron-left')}</a>`)}</div>${rows.length > lim ? S.h`<a class="btn block" href="#/research/${p.col}?n=${lim + 40}&keep=1">عرض المزيد</a>` : ''}` : S.ui.empty(c.icon, term ? 'لا نتائج' : 'لا مداخل موثقة بعد', 'لا يضمّن سِراج نصوصاً دينية غير موثقة؛ تصل المداخل من الناشر مع مصادرها عبر تحديثات المحتوى.', S.h`<a class="btn" href="#/updates">تحديثات المحتوى</a>`)}</div>`,
      mount() { const i = S.$('#rsq'); i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') S.router.go('/research/' + p.col + '?q=' + encodeURIComponent(i.value) + (view ? '&view=' + view : '')); }); }
    };
  });
  S.router.add('/research/:col/:id', async (p) => {
    const c = COLS[p.col]; const e = await S.db.get('entries', p.id); if (!c || !e || e.collection !== p.col) return { title: 'غير موجود', back: '/research/' + p.col, html: S.ui.empty('alert', 'المدخل غير موجود') };
    const fav = S.fav.has('entry', e.id); const base = e.text; let fileUrl = null; const fl = e.fileId ? await S.files.get(e.fileId) : null; const isImg = fl && /^image\//.test(fl.type);
    return {
      title: c.one, nav: 'more', back: '/research/' + p.col,
      html: S.h`<div class="stack"><div class="card"><div class="row between"><b class="q-name">${e.title}</b>${statusBadge(e)}</div>
        ${e.verses.length ? S.h`<div class="chips">${e.verses.map(verseLink)}</div>` : ''}${(c.extra || []).map(([k, l, t]) => (e.extra[k] !== '' && e.extra[k] != null ? S.h`<div class="kv"><span>${l}</span><b>${t === 'imam' ? ((S.data.sample.imams.find((i) => i.n === +e.extra[k]) || {}).short || e.extra[k]) : t === 'aspect' ? ((S.data.sample.aspects.find((a) => a.id === e.extra[k]) || {}).title || e.extra[k]) : t === 'select' ? ((RULING_TOPICS.find((r) => r[0] === e.extra[k]) || [])[1] || e.extra[k]) : e.extra[k]}</b></div>` : ''))}
        ${e.status === 'imported' ? S.ui.notice('warn', 'نص مستورد آلياً', 'وصل هذا النص من ' + ((e.imported || {}).from === 'thaqalayn' ? 'Thaqalayn (thaqalayn.net)' : 'ملف الاستيراد') + ' ولم يُراجَع في سِراج. قارنه بالمصدر عبر رابط الرواية، ثم يمكن للمراجع اعتماده.') : ''}${e.text ? S.h`<div class="label-t">${e.status === 'imported' ? 'النص كما وصل من مصدر الاستيراد' : 'النص المنقول (كما أدخله الناشر من المصدر)'}</div><p class="quote">${e.text}</p><div class="tiny muted">عرض النص لا يعني ثبوته؛ ${p.col === 'narrations' ? 'والحكم على الرواية لأهل الاختصاص بمصادرهم.' : 'والتحقق من المصدر واجب.'}</div>` : ''}
        ${e.tags.length ? S.h`<div class="chips">${e.tags.map((t) => S.h`<span class="chip">${t}</span>`)}</div>` : ''}</div>
        ${isImg ? S.h`<div class="card"><img data-ms="${e.fileId}" alt="صورة المخطوطة" style="max-width:100%;border-radius:8px"></div>` : fl ? S.h`<div class="card"><button class="btn block" data-act="entFileDl" data-id="${e.fileId}">${S.icon('download')} تنزيل الملف المرفق (${S.fmt.bytes(fl.size)})</button></div>` : ''}
        <div class="card"><div class="card-t">${S.icon('link')} ${p.col === 'narrations' ? 'التخريج: مواضع الرواية في المصادر' : 'المصادر'} (${S.n(e.sources.length)})</div>${e.sources.map(srcView)}</div>
        ${(e.isnads || []).length ? S.h`<div class="card"><div class="card-t">${S.icon('network')} الأسانيد (${S.n(e.isnads.length)})</div>${e.isnads.map((s, i) => S.h`<div class="small"><b>${S.n(i + 1)}.</b> ${s}</div>`)}</div>` : ''}
        ${(e.variants || []).length ? S.h`<div class="card"><div class="card-t">${S.icon('repeat')} اختلاف الألفاظ (${S.n(e.variants.length)})</div><p class="tiny muted nm">المقارنة بالنص الأصلي أعلاه: <span class="df-add">زيادة</span> • <span class="df-del">محذوف</span></p>${e.variants.map((v, i) => { const ops = diffWords(base, v.text); const st = diffStats(ops); return S.h`<div class="card flat"><b class="small">اللفظ ${S.n(i + 1)}</b>${st ? S.h` <span class="tiny muted">(+${S.n(st.add)} / −${S.n(st.del)})</span>` : ''}<p class="quote diff">${diffHtml(ops)}</p><div class="tiny muted">المصدر: ${v.source}</div></div>`; })}</div>` : ''}
        ${(e.scholarRulings || []).length ? S.h`<div class="card"><div class="card-t">${S.icon('gavel')} أقوال العلماء (منسوبة لقائليها)</div>${S.ui.notice('warn', 'ليس حكم سِراج', 'هذه أقوال أدخلها الناشر من مصادرها. لا يجمعها التطبيق في حكم واحد ولا يُرجّح بينها.')}${e.scholarRulings.map((r) => S.h`<div class="card flat"><b>${r.scholar}</b><p class="nm">${r.ruling}</p><div class="tiny muted">المصدر: ${r.source}</div></div>`)}</div>` : ''}
        ${(e.positions || []).length ? S.h`<div class="card"><div class="card-t">${S.icon('scale')} الأقوال في المسألة (${S.n(e.positions.length)})</div>${S.ui.notice('info', 'عرض للخلاف', 'تُعرض الأقوال كما نُقلت بمصادرها دون ترجيح، ولا يُعدّ أيٌّ منها إجماعاً ما لم يذكر المصدر ذلك.')}${e.positions.map((r) => S.h`<div class="card flat"><b>${r.holder}</b><p class="nm">${r.view}</p><div class="tiny muted">المصدر: ${r.source}</div></div>`)}</div>` : ''}
        <div class="grid2"><button class="btn" data-act="entCopy" data-id="${e.id}">${S.icon('copy')} نسخ مع المصدر</button><button class="btn" data-act="entFav" data-id="${e.id}">${S.icon('heart')} ${fav ? 'إزالة من المفضلة' : 'إلى المفضلة'}</button>${p.col === 'narrations' ? S.h`<a class="btn" href="#/research/compare-narrations?a=${e.id}">${S.icon('scale')} قارن برواية أخرى</a>` : ''}</div>
        <div class="tiny muted">أُضيف ${S.fmt.dt(e.ts)}${e.by ? ' بواسطة ' + e.by : ''}${e.reviewed ? ' • راجعه ' + e.reviewed.by + ' ' + S.fmt.dt(e.reviewed.at) : ''}</div></div>`,
      async mount(root) { if (isImg) { const im = S.$('img[data-ms]', root); if (im && fl) { fileUrl = URL.createObjectURL(fl.blob); im.src = fileUrl; } } }, unmount() { if (fileUrl) URL.revokeObjectURL(fileUrl); }
    };
  });
  S.act('entFileDl', async (el) => { const f = await S.files.get(el.dataset.id); if (f) S.download(f.blob, f.name || 'file'); });
  S.act('entCopy', async (el) => { const e = await S.db.get('entries', el.dataset.id); S.copy([e.title, e.text, '', 'المصادر:'].concat(e.sources.map((s) => '— ' + cite(s) + (s.url ? ' ' + s.url : ''))).filter((x) => x !== undefined).join('\n') + '\n\n(منقول من تطبيق سِراج — راجع المصدر للتحقق)'); });
  S.act('entFav', async (el) => { await S.fav.toggle('entry', el.dataset.id); S.router.refresh(); });

  S.enc = { RULING_TOPICS, COLS, validateEntry, parseVerse, diffWords, cite, UNITS };
})();

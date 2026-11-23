/* =====================================================================
   سِراج — library.js : المكتبة الإسلامية (عشرة أقسام)، البحث، التصنيف، صفحة الكتاب
   مصمَّمة لتستوعب 1800 كتاب وأكثر: فهرس بحث في الذاكرة + عرض مُقسَّم على دفعات.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const TARGET = 300, PAGE = 30;

  const L = (S.library = {
    books: [], authors: new Map(), pageSize: PAGE, target: TARGET,
    async init() {
      const rows = await S.db.all('books'); L.books = rows;
      const au = await S.db.all('authors'); L.authors = new Map(au.map((a) => [a.id, a]));
      L.reindex();
    },
    reindex() {
      const byId = new Map();
      L.books.forEach((b) => {
        byId.set(b.id, b);
        b._nt = S.norm(b.title); b._na = S.norm(b.author);
        b._ns = S.norm(((S.sectionById[b.section] || {}).title || '') + ' ' + (b.subcat || ''));
        b._nx = S.norm((b.desc || '') + ' ' + (b.tags || []).join(' ') + ' ' + (b.publisher || ''));
        b._n = b._nt + ' ' + b._na + ' ' + b._ns + ' ' + b._nx;
      });
      S.libraryIndex = { byId }; L.byId = byId;
    },
    published: () => L.books.filter((b) => b.status === 'published'),
    countBySection() { const m = {}; S.sections.forEach((s) => (m[s.id] = 0)); L.published().forEach((b) => { m[b.section] = (m[b.section] || 0) + 1; }); return m; },
    async save(b) { await S.db.put('books', b); const i = L.books.findIndex((x) => x.id === b.id); if (i >= 0) L.books[i] = b; else L.books.push(b); L.reindex(); return b; },
    async remove(id) {
      await S.db.del('books', id); await S.files.del('pdf:' + id); await S.files.del('cover:' + id); S.dropCoverUrl(id);
      L.books = L.books.filter((b) => b.id !== id); L.reindex();
      await S.db.del('favorites', 'book:' + id); await S.db.del('progress', 'book:' + id);
      const hl = await S.db.where('highlights', 'bookId', id); for (const h of hl) await S.db.del('highlights', h.id);
    },
    visible: (b) => b.status === 'published',
    /* بحث وفلترة وترتيب */
    /* العصر = القرن الهجري لسنة وفاة المؤلف (0 = غير محدد). يُحسب من البيانات ولا يُخمَّن. */
    era(b) { return b.authorDeath > 0 ? Math.ceil(b.authorDeath / 100) : 0; },
    eraName(c) { const N = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر']; return c ? 'القرن ' + (N[c] || S.n(c)) + ' الهجري' : 'عصر غير محدد'; },
    search(o) {
      o = o || {}; const toks = S.norm(o.q || '').split(' ').filter(Boolean);
      let rows = o.includeAll ? L.books.slice() : L.published();
      if (o.section) rows = rows.filter((b) => b.section === o.section);
      if (o.subcat) rows = rows.filter((b) => b.subcat === o.subcat);
      if (o.author) rows = rows.filter((b) => b.authorId === o.author);
      if (o.fav) rows = rows.filter((b) => S.fav.has('book', b.id));
      if (o.era !== undefined && o.era !== '') rows = rows.filter((b) => L.era(b) === +o.era);
      if (o.yf || o.yt) rows = rows.filter((b) => b.year && (!o.yf || b.year >= +o.yf) && (!o.yt || b.year <= +o.yt));
      if (toks.length) {
        const mode = o.mode || 'all'; const field = mode === 'author' ? '_na' : mode === 'section' ? '_ns' : mode === 'subject' ? '_nx' : '_n';
        rows = rows.map((b) => {
          const hay = b[field] + (mode === 'subject' ? ' ' + b._ns : '');
          if (!toks.every((t) => hay.includes(t))) return null;
          let sc = 1; toks.forEach((t) => { if (b._nt.startsWith(t)) sc += 3; else if (b._nt.includes(t)) sc += 2; if (b._na.includes(t)) sc += 1.5; });
          return { b, sc };
        }).filter(Boolean);
        if ((o.sort || 'rel') === 'rel') rows.sort((x, y) => y.sc - x.sc);
        rows = rows.map((r) => r.b);
      }
      const sort = o.sort || 'rel';
      if (sort === 'recent') rows.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
      else if (sort === 'alpha') rows.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
      else if (sort === 'reads') rows.sort((a, b) => (b.reads || 0) - (a.reads || 0));
      else if (sort === 'year') rows.sort((a, b) => (b.year || 0) - (a.year || 0));
      return rows;
    },
    /* كشف النسخ المكررة (عنوان + مؤلف) */
    findDuplicates(title, author, ignoreId) {
      const nt = S.norm(title), na = S.norm(author).replace(/\(.*?\)/g, ''); const bg = (s) => { const a = new Set(); for (let i = 0; i < s.length - 1; i++) a.add(s.slice(i, i + 2)); return a; };
      const bt = bg(nt); const out = [];
      L.books.forEach((b) => {
        if (b.id === ignoreId) return;
        const bb = bg(b._nt); let inter = 0; bt.forEach((x) => { if (bb.has(x)) inter++; });
        const dice = bt.size + bb.size ? (2 * inter) / (bt.size + bb.size) : 0;
        const sameAuthor = !na || b._na.includes(na) || na.includes(b._na) || S.norm(b.author).split(' ').filter((w) => w.length > 3).some((w) => na.includes(w));
        if ((nt === b._nt && sameAuthor) || (dice >= 0.82 && sameAuthor)) out.push({ book: b, score: dice });
      });
      return out.sort((a, b) => b.score - a.score);
    },
    similar(b, n) {
      const out = L.published().filter((x) => x.id !== b.id).map((x) => ({ x, s: (x.subcat === b.subcat ? 3 : 0) + (x.section === b.section ? 1 : 0) + (x.authorId === b.authorId ? 2 : 0) + ((x.tags || []).filter((t) => (b.tags || []).includes(t)).length) })).filter((r) => r.s > 1).sort((a, c) => c.s - a.s);
      return out.slice(0, n || 6).map((r) => r.x);
    },
    recommended(n) {
      const hist = S.progress.all().filter((p) => p.type === 'book').sort((a, b) => b.ts - a.ts);
      const favs = L.published().filter((b) => S.fav.has('book', b.id));
      const seeds = hist.map((p) => L.byId.get(p.ref)).concat(favs).filter(Boolean);
      const secCount = {}; seeds.forEach((b) => (secCount[b.section] = (secCount[b.section] || 0) + 1));
      const seen = new Set(seeds.map((b) => b.id)); const pool = L.published().filter((b) => !seen.has(b.id));
      const day = Math.floor(Date.now() / 86400000);
      pool.sort((a, b) => ((secCount[b.section] || 0) - (secCount[a.section] || 0)) || (((a.id.charCodeAt(2) || 0) * 31 + day) % 17) - (((b.id.charCodeAt(2) || 0) * 31 + day) % 17));
      return { books: pool.slice(0, n || 8), personalized: seeds.length > 0 };
    }
  });

  /* ---------- مكوّنات العرض ---------- */
  const val = (x) => (x == null || x === '' ? S.h`<span class="badge warn">غير موثّق</span>` : x);
  const statusBadge = (b) => b.status === 'published' ? S.ui.badge('منشور', 'ok') : b.status === 'pending' ? S.ui.badge('بانتظار الموافقة', 'warn') : b.status === 'rejected' ? S.ui.badge('مرفوض', 'bad') : S.ui.badge('يحتاج مراجعة', 'info');
  const cover = (b) => S.h`<div class="cover"><img data-cover="${b.id}" src="${S.coverSvg(b)}" alt="" loading="lazy" decoding="async"></div>`;
  L.row = (b) => S.h`<a class="bookrow" href="#/library/book/${b.id}">${cover(b)}<div class="grow"><div class="bk-t">${b.title}</div><div class="bk-a">${b.author}</div><div class="row wrap mt-s">${S.ui.badge((S.sectionById[b.section] || {}).title || '')}${b.subcat ? S.ui.badge(b.subcat) : ''}${b.hasPdf ? S.ui.badge('PDF محلي', 'ok') : ''}${b.status !== 'published' ? statusBadge(b) : ''}${S.fav.has('book', b.id) ? S.icon('heart', 'fill') : ''}</div></div></a>`;
  L.card = (b) => S.h`<a class="bookcard" href="#/library/book/${b.id}">${cover(b)}<div class="bk-t">${b.title}</div><span class="bk-a">${b.author}</span></a>`;
  S.ui.bookRow = L.row; S.ui.bookCard = L.card;

  function sectionCard(s, cnt) {
    const pct = Math.min(100, (cnt / TARGET) * 100);
    return S.h`<a class="sec-card" href="#/library/sec/${s.id}"><span class="sn">${S.icon(S.hasIcon(s.icon) ? s.icon : 'book-open')}</span><span class="grow"><b>${s.n}. ${s.title}</b><span class="small muted" style="display:block">${S.n(cnt)} كتاب في النسخة التجريبية • الهدف ${S.n(TARGET)}</span><span class="bar" style="display:block;margin-top:6px"><i style="width:${pct}%"></i></span></span>${S.icon('chevron-left')}</a>`;
  }

  /* ---------- صفحة المكتبة ---------- */
  S.router.add('/library', () => {
    const counts = L.countBySection(); const total = L.published().length;
    const recent = L.published().slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')).slice(0, 10);
    const last = S.progress.last('book'); const lastBook = last && L.byId.get(last.ref);
    const rec = L.recommended(8);
    return {
      title: 'المكتبة', nav: 'library', back: false,
      actions: [{ icon: 'heart', label: 'المفضلة', href: '#/library/favorites' }, { icon: 'search', label: 'بحث', href: '#/library/search' }],
      html: S.h`<div class="stack">
        <div class="searchbox">${S.icon('search')}<input class="input" id="lib-q" type="search" placeholder="ابحث في الكتب والمؤلفين والموضوعات…" enterkeyhint="search" autocomplete="off"></div>
        <div class="chips"><a class="chip" href="#/library/search?sort=recent">${S.icon('clock')} الأحدث</a><a class="chip" href="#/library/top">${S.icon('chart')} الأكثر قراءة</a><a class="chip" href="#/library/favorites">${S.icon('heart')} المفضلة</a><a class="chip" href="#/library/history">${S.icon('book-open')} سجل القراءة</a><a class="chip" href="#/library/authors">${S.icon('users')} المؤلفون</a><a class="chip" href="#/library/eras">${S.icon('timeline')} العصور</a><a class="chip" href="#/library/search?sort=alpha">${S.icon('sort')} أبجدياً</a></div>
        ${S.ui.notice('gold', 'مكتبة تجريبية', S.h`<span>تحتوي هذه النسخة <b>${S.n(total)}</b> كتاباً بمعلومات ببليوغرافية عامة فقط (لا نصوص كتب). تصل الإضافات والتصحيحات عبر <a href="#/updates">تحديثات المحتوى</a> الموقّعة.</span>`)}
        ${last && lastBook ? S.h`<div class="card tap gold-edge" data-act="goto" data-to="/library/read/${lastBook.id}"><div class="card-t">${S.icon('book-open')} تابع القراءة</div><div class="row"><div style="width:54px">${cover(lastBook)}</div><div class="grow"><b>${lastBook.title}</b><div class="small muted">${lastBook.author}${last.page ? ' • صفحة ' + S.n(last.page) : ''}</div></div></div></div>` : ''}
        ${S.ui.sectionTitle('الأقسام (' + S.n(S.sections.length) + ')')}
        <div class="stack s">${S.sections.map((s) => sectionCard(s, counts[s.id] || 0))}</div>
        ${recent.length ? S.h`${S.ui.sectionTitle('أُضيف حديثاً', '#/library/search?sort=recent')}<div class="hscroll">${recent.map(L.card)}</div>` : ''}
        ${rec.books.length ? S.h`${S.ui.sectionTitle(rec.personalized ? 'مقترحة لك' : 'كتب مقترحة', '#/library/recommended')}<div class="hscroll">${rec.books.map(L.card)}</div><p class="tiny muted">اقتراحات محلية تعتمد على مفضلتك وسجل قراءتك في هذا الجهاز فقط.</p>` : ''}
      </div>`,
      mount(root) { const f = S.$('#lib-q', root); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { S.router.go('/library/search?q=' + encodeURIComponent(f.value)); } }); }
    };
  });
  S.act('goto', (el) => S.router.go(el.dataset.to));
  S.act('libSearchGo', () => { const v = S.$('#lib-q'); if (v) S.router.go('/library/search?q=' + encodeURIComponent(v.value)); });

  /* ---------- قسم ---------- */
  S.router.add('/library/sec/:id', (p, q) => {
    const sec = S.sectionById[p.id]; if (!sec) return { title: 'قسم غير معروف', back: '/library', html: S.ui.empty('alert', 'قسم غير معروف') };
    const sub = q.sub || ''; const sort = q.sort || 'alpha'; const lim = +(q.n || PAGE);
    const rows = L.search({ section: sec.id, subcat: sub || undefined, sort });
    const subs = sec.subcats;
    return {
      title: sec.title, nav: 'library', back: '/library', actions: [{ icon: 'search', label: 'بحث', href: '#/library/search?sec=' + sec.id }],
      html: S.h`<div class="stack"><p class="muted small nm">${sec.desc}</p>
        ${p.id === 'ayat' ? S.ui.notice('info', 'منهج العرض', S.data.sample.ayatSectionHint) : ''}
        <div class="chips"><a class="chip ${!sub ? 'active' : ''}" href="#/library/sec/${sec.id}?sort=${sort}">الكل</a>${subs.map((s) => S.h`<a class="chip ${sub === s ? 'active' : ''}" href="#/library/sec/${sec.id}?sub=${encodeURIComponent(s)}&sort=${sort}">${s}</a>`)}</div>
        <div class="row between"><span class="small muted">${S.n(rows.length)} كتاب</span><select class="select" style="width:auto;min-height:38px" data-chg="secSort" data-sec="${sec.id}" data-sub="${sub}">${[['alpha', 'أبجدياً'], ['recent', 'الأحدث'], ['reads', 'الأكثر قراءة'], ['year', 'سنة النشر']].map(([v, t]) => S.h`<option value="${v}" ${v === sort ? S.raw('selected') : ''}>${t}</option>`)}</select></div>
        <div>${rows.slice(0, lim).map(L.row)}</div>
        ${rows.length > lim ? S.h`<a class="btn block" href="#/library/sec/${sec.id}?sub=${encodeURIComponent(sub)}&sort=${sort}&n=${lim + PAGE}&keep=1">عرض المزيد (${S.n(rows.length - lim)})</a>` : ''}
        ${!rows.length ? S.ui.empty('book-open', 'لا توجد كتب في هذا التصنيف بعد', 'ستظهر الكتب هنا عند وصول تحديث محتوى يتضمنها.') : ''}
      </div>`
    };
  });
  S.onChange('secSort', (el) => S.router.go(`/library/sec/${el.dataset.sec}?sub=${encodeURIComponent(el.dataset.sub)}&sort=${el.value}`));

  /* ---------- بحث ---------- */
  S.router.add('/library/search', (p, q) => {
    const o = { q: q.q || '', mode: q.mode || 'all', section: q.sec || '', subcat: q.sub || '', yf: q.yf || '', yt: q.yt || '', sort: q.sort || 'rel', fav: q.fav === '1', era: q.era != null ? q.era : '' };
    const rows = L.search(o); const lim = +(q.n || PAGE);
    const modes = [['all', 'شامل'], ['author', 'المؤلف'], ['section', 'القسم'], ['subject', 'الموضوع']];
    const more = (n) => '#/library/search?' + new URLSearchParams(Object.assign({}, q, { n, keep: '1' })).toString();
    return {
      title: 'بحث في المكتبة', nav: 'library', back: '/library',
      html: S.h`<div class="stack">
        <div id="sf" class="stack s">
          <div class="searchbox">${S.icon('search')}<input class="input" name="q" value="${o.q}" type="search" placeholder="كلمة من العنوان أو المؤلف أو الموضوع" autocomplete="off"></div>
          <div class="chips">${modes.map(([v, t]) => S.h`<label class="chip ${o.mode === v ? 'active' : ''}"><input type="radio" name="mode" value="${v}" ${o.mode === v ? S.raw('checked') : ''} hidden>${t}</label>`)}</div>
          <div class="grid2">${S.f.select('sec', 'القسم', [{ v: '', t: 'كل الأقسام' }].concat(S.sections.map((s) => ({ v: s.id, t: s.title }))), o.section)}${S.f.select('sort', 'الترتيب', [['rel', 'الأقرب'], ['recent', 'الأحدث'], ['alpha', 'أبجدياً'], ['reads', 'الأكثر قراءة'], ['year', 'سنة النشر']].map(([v, t]) => ({ v, t })), o.sort)}</div>
          <div class="grid2">${S.f.text('yf', 'سنة النشر من', o.yf, { type: 'number', inputmode: 'numeric' })}${S.f.text('yt', 'إلى', o.yt, { type: 'number', inputmode: 'numeric' })}</div>
          ${S.f.select('era', 'العصر (قرن وفاة المؤلف)', [{ v: '', t: 'كل العصور' }].concat(Array.from(new Set(L.published().map((b) => L.era(b)))).sort((x, y) => x - y).map((c) => ({ v: c, t: L.eraName(c) }))), o.era)}
          ${S.f.check('fav', 'المفضلة فقط', o.fav)}
          <button class="btn primary block" data-act="doSearch">${S.icon('search')} بحث</button>
        </div>
        <div class="row between"><b>${S.n(rows.length)} نتيجة</b>${o.q ? S.h`<a class="small" href="#/library/search">مسح</a>` : ''}</div>
        <div>${rows.slice(0, lim).map(L.row)}</div>
        ${rows.length > lim ? S.h`<a class="btn block" href="${more(lim + PAGE)}">عرض المزيد</a>` : ''}
        ${!rows.length ? S.ui.empty('search', 'لا نتائج', 'جرّب كلمات أقل أو غيّر نوع البحث.') : ''}
      </div>`,
      mount(root) { const f = S.$('#sf', root); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); S.$('[data-act=doSearch]', f).click(); } }); S.$$('input[name=mode]', f).forEach((r) => r.addEventListener('change', () => S.$('[data-act=doSearch]', f).click())); }
    };
  });
  S.act('doSearch', (el) => {
    const d = S.f.read(el.closest('#sf')); const p = new URLSearchParams();
    if (d.q) p.set('q', d.q); if (d.mode && d.mode !== 'all') p.set('mode', d.mode); if (d.sec) p.set('sec', d.sec); if (d.sort && d.sort !== 'rel') p.set('sort', d.sort);
    if (d.era !== '' && d.era != null) p.set('era', d.era); if (d.yf) p.set('yf', d.yf); if (d.yt) p.set('yt', d.yt); if (d.fav) p.set('fav', '1');
    S.router.go('/library/search' + (p.toString() ? '?' + p : ''));
  });

  /* ---------- قوائم أخرى ---------- */
  function simpleList(title, rows, emptyMsg, back) {
    return { title, nav: 'library', back: back || '/library', html: S.h`<div>${rows.length ? rows.map(L.row) : S.ui.empty('book-open', emptyMsg[0], emptyMsg[1])}</div>` };
  }
  S.router.add('/library/favorites', () => simpleList('المفضلة', L.published().filter((b) => S.fav.has('book', b.id)), ['لا توجد كتب مفضلة', 'اضغط على القلب في صفحة أي كتاب لإضافته.']));
  S.router.add('/library/history', () => {
    const ids = S.progress.all().filter((p) => p.type === 'book').sort((a, b) => b.ts - a.ts).map((p) => L.byId.get(p.ref)).filter((b) => b && L.visible(b));
    return simpleList('سجل القراءة', ids, ['لم تقرأ أي كتاب بعد', 'يُسجَّل هنا كل كتاب تفتحه في القارئ.']);
  });
  S.router.add('/library/top', () => simpleList('الأكثر قراءة', L.search({ sort: 'reads' }).filter((b) => (b.reads || 0) > 0).slice(0, 50), ['لا توجد قراءات مسجّلة بعد', 'يُحسب العدّاد محلياً عند فتح الكتب في هذا الجهاز.']));
  S.router.add('/library/recommended', () => simpleList('كتب مقترحة', L.recommended(30).books, ['لا توجد اقتراحات', '']));
  S.router.add('/library/eras', () => {
    const cnt = {}; L.published().forEach((b) => { const c = L.era(b); cnt[c] = (cnt[c] || 0) + 1; });
    const rows = Object.keys(cnt).map(Number).sort((x, y) => (x || 99) - (y || 99));
    return { title: 'تصنيف العصور', nav: 'library', back: '/library', html: S.h`<div class="stack">${S.ui.notice('info', 'كيف يُحسب العصر؟', 'القرن الهجري لسنة وفاة المؤلف المسجلة في بيانات الكتاب. من لا سنة وفاة مسجلة له يظهر تحت «عصر غير محدد» ولا يُخمَّن.')}<div class="list">${rows.length ? rows.map((c) => S.ui.li({ href: '#/library/search?era=' + c, icon: 'timeline', t: L.eraName(c), s: S.n(cnt[c]) + ' كتاب' })) : S.ui.empty('timeline', 'لا كتب')}</div></div>` };
  });
  S.router.add('/library/authors', () => {
    const cnt = {}; L.published().forEach((b) => (cnt[b.authorId] = (cnt[b.authorId] || 0) + 1));
    const rows = Array.from(L.authors.values()).filter((a) => cnt[a.id]).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return { title: 'فهرس المؤلفين', nav: 'library', back: '/library', html: S.h`<div class="list">${rows.map((a) => S.ui.li({ href: '#/library/author/' + a.id, icon: 'user', t: a.name, s: (a.death ? 'ت ' + S.n(a.death) + ' هـ • ' : '') + S.n(cnt[a.id]) + ' كتاب' }))}</div>` };
  });
  S.router.add('/library/author/:id', (p) => {
    const a = L.authors.get(p.id); if (!a) return { title: 'مؤلف', back: '/library/authors', html: S.ui.empty('alert', 'مؤلف غير معروف') };
    const rows = L.search({ author: a.id, sort: 'alpha' });
    return { title: 'سيرة المؤلف', nav: 'library', back: '/library/authors', html: S.h`<div class="stack"><div class="card"><div class="h2">${a.name}</div>${a.death ? S.h`<p class="muted nm">سنة الوفاة: ${S.n(a.death)} هـ</p>` : ''}${a.note ? S.h`<p>${a.note}</p>` : ''}<p class="tiny muted">معلومات عامة مختصرة تحتاج توثيقاً من مصدر مرجعي قبل الاعتماد عليها في البحث.</p></div>${S.ui.sectionTitle('مؤلفاته في المكتبة')}<div>${rows.map(L.row)}</div></div>` };
  });

  /* ---------- صفحة الكتاب ---------- */
  function searchLinks(b) {
    const q = encodeURIComponent(b.title + ' ' + (b.author || '').replace(/\(.*?\)/g, ''));
    return [['archive.org', 'https://archive.org/search?query=' + q], ['lib.eshia.ir', 'https://lib.eshia.ir/'], ['al-islam.org', 'https://www.al-islam.org/'], ['noorlib.ir', 'https://www.noorlib.ir/'], ['shiaonlinelibrary.com', 'https://shiaonlinelibrary.com/'], ['thaqalayn.net', 'https://thaqalayn.net/'], ['مكتبة العتبة العباسية', 'https://alkafeel.net/library/']];
  }
  S.router.add('/library/book/:id', async (p) => {
    const b = L.byId.get(p.id);
    if (!b || !L.visible(b)) return { title: 'كتاب', back: '/library', html: S.ui.empty('alert', 'الكتاب غير متاح', 'قد يكون قيد المراجعة أو محذوفاً.') };
    const sec = S.sectionById[b.section] || {}; const fav = S.fav.has('book', b.id); const au = L.authors.get(b.authorId);
    const sim = L.similar(b, 8);
    const f = b.hasPdf ? await S.files.get('pdf:' + b.id) : null;
    return {
      title: 'تفاصيل الكتاب', nav: 'library', back: '/library/sec/' + b.section,
      actions: [{ icon: fav ? 'heart' : 'heart', label: 'مفضلة', act: 'bookFav', attrs: `data-id="${S.esc(b.id)}"` }, { icon: 'share', label: 'مشاركة', act: 'bookShare', attrs: `data-id="${S.esc(b.id)}"` }],
      html: S.h`<div class="stack">
        <div class="detail-head">${cover(b)}<div class="grow"><div class="h2">${b.title}</div><a href="#/library/author/${b.authorId}" class="muted">${b.author}</a><div class="row wrap mt-s">${S.ui.badge(sec.title || '', 'gold')}${b.subcat ? S.ui.badge(b.subcat) : ''}${statusBadge(b)}</div>${fav ? S.h`<div class="small mt-s ok">${S.icon('heart', 'fill')} في المفضلة</div>` : ''}</div></div>
        <div class="grid2">
          ${b.hasPdf ? S.h`<a class="btn primary" href="#/library/read/${b.id}">${S.icon('book-open')} قراءة</a>` : S.h`<button class="btn" disabled>${S.icon('file')} لا يوجد PDF</button>`}
          ${b.hasPdf && b.allowDownload ? S.h`<button class="btn" data-act="bookDownload" data-id="${b.id}">${S.icon('download')} تنزيل</button>` : S.h`<button class="btn" disabled title="التنزيل مسموح فقط عند ثبوت الترخيص">${S.icon('lock')} التنزيل غير مسموح</button>`}
        </div>
        ${!b.hasPdf ? S.ui.notice('info', 'لا يوجد ملف محلي لهذا الكتاب', 'الكتب في هذه النسخة بيانات ببليوغرافية فقط؛ استخدم روابط المصدر أدناه للوصول إلى النسخ المتاحة قانونياً.') : ''}
        <div class="card"><div class="card-t">${S.icon('info')} نبذة تعريفية</div><p class="nm">${b.desc || S.raw('<span class="badge warn">غير موثّقة</span>')}</p></div>
        <div class="card"><div class="card-t">${S.icon('list')} البيانات الببليوغرافية</div><dl class="kv">
          <dt>المؤلف</dt><dd>${b.author}${b.authorDeath ? ' (ت ' + S.n(b.authorDeath) + ' هـ)' : ''}</dd>
          <dt>القسم</dt><dd>${sec.title || ''}</dd><dt>التصنيف الفرعي</dt><dd>${val(b.subcat)}</dd>
          <dt>دار النشر</dt><dd>${val(b.publisher)}</dd><dt>سنة النشر</dt><dd>${val(b.year && S.n(b.year))}</dd>
          <dt>رقم الطبعة</dt><dd>${val(b.edition)}</dd><dt>عدد الصفحات</dt><dd>${val(b.pages && S.n(b.pages))}</dd>
          <dt>اللغة</dt><dd>${val(b.lang)}</dd>
          <dt>حقوق النشر</dt><dd>${b.copyright && b.copyright !== 'غير محدد' ? S.ui.badge(b.copyright, 'ok') : S.ui.badge('غير محدد — لا يُنشر دون ترخيص', 'warn')}</dd>
          <dt>مراجعة المسؤول</dt><dd>${b.reviewStatus}</dd><dt>تاريخ الإضافة</dt><dd>${b.addedAt ? S.fmt.dt(b.addedAt) : '—'}</dd><dt>حالة النشر</dt><dd>${statusBadge(b)}</dd>
          ${b.hasPdf && f ? S.h`<dt>الملف المحلي</dt><dd>${S.fmt.bytes(f.size)}</dd>` : ''}
        </dl></div>
        <div class="card"><div class="card-t">${S.icon('link')} المصادر والروابط</div>
          <div class="stack s">
            ${b.sourceUrl ? S.h`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${S.url(b.sourceUrl)}">${S.icon('globe')} رابط المصدر${b.sourceName ? ' — ' + b.sourceName : ''}</a>` : S.h`<span class="small muted">رابط المصدر غير موثّق لهذا الكتاب.</span>`}
            ${b.digitalUrl ? S.h`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${S.url(b.digitalUrl)}">${S.icon('file')} رابط النسخة الرقمية</a>` : ''}
            <details class="acc"><summary>ابحث عن الكتاب في المصادر المقترحة</summary><div class="acc-b stack s">${searchLinks(b).map(([n, u]) => S.h`<a class="btn sm ghost" target="_blank" rel="noopener noreferrer" href="${u}">${n}</a>`)}<p class="tiny muted nm">فتح هذه الروابط يتم خارج التطبيق. تحقّق من حقوق كل كتاب بشكل مستقل؛ وجود PDF ليس دليلاً على جواز إعادة نشره.</p></div></details>
          </div></div>
        ${au ? S.h`<div class="card"><div class="card-t">${S.icon('user')} سيرة المؤلف</div><p class="nm"><b>${au.name}</b>${au.death ? ' — ت ' + S.n(au.death) + ' هـ' : ''}</p>${au.note ? S.h`<p class="small muted nm">${au.note}</p>` : ''}<a class="small" href="#/library/author/${au.id}">كل كتب المؤلف في المكتبة</a></div>` : ''}
        ${b.demo ? S.ui.notice('warn', 'بيانات تجريبية', 'هذه البيانات عامة ولم تُراجَع على طبعة بعينها. لا تعتمد عليها في التوثيق.') : ''}
        ${sim.length ? S.h`${S.ui.sectionTitle('كتب مشابهة')}<div class="hscroll">${sim.map(L.card)}</div>` : ''}
      </div>`
    };
  });
  S.act('bookFav', async (el) => { const id = el.dataset.id; const on = await S.fav.toggle('book', id); S.toast(on ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'ok'); S.router.refresh(); });
  S.act('bookShare', (el) => { const b = L.byId.get(el.dataset.id); S.share({ title: b.title, text: b.title + ' — ' + b.author + '\n(عبر تطبيق سِراج)' }); });
  S.act('bookDownload', async (el) => {
    const b = L.byId.get(el.dataset.id); const f = await S.files.get('pdf:' + b.id); if (!f) return S.toast('الملف غير موجود', 'err');
    S.download(f.blob, (b.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'book') + '.pdf'); b.downloads = (b.downloads || 0) + 1; await L.save(b); S.stat.inc('downloads:' + b.id);
  });
})();

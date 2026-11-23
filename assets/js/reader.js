/* =====================================================================
   سِراج — reader.js : قارئ PDF (PDF.js المضمَّن، رخصة Apache-2.0)
   عرض بالصفحات مع تحميل كسول، فهرس الكتاب، بحث داخل الملف، تظليل وملاحظات، إشارات، حفظ آخر صفحة، أوضاع قراءة.
   يعمل دون إنترنت؛ لكنه يحتاج HTTPS/localhost لأن PDF.js وحدات ES (لا تعمل من file://) — وإلا يُعرض بديل صريح.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const L = () => S.library;
  const LIB = () => new URL('assets/lib/pdfjs/', document.baseURI).href;
  let pdfjs = null;
  async function loadPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import(LIB() + 'pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = LIB() + 'pdf.worker.min.mjs'; return pdfjs;
  }
  const THEMES = ['dark', 'sepia', 'light']; const THEME_AR = { dark: 'ليلي', sepia: 'ورقي', light: 'نهاري' };

  /* حالة القارئ الحالية */
  let R = null;
  function cleanup() {
    if (!R) return; try { R.io && R.io.disconnect(); } catch (e) { /* */ } try { R.doc && R.doc.destroy(); } catch (e) { /* */ }
    try { R.wake && R.wake.release(); } catch (e) { /* */ } document.removeEventListener('selectionchange', R.selFn); if (R.blobUrl) URL.revokeObjectURL(R.blobUrl); R = null;
  }

  S.router.add('/library/read/:id', async (p, q) => {
    const b = L().byId.get(p.id); const back = '/library/book/' + p.id;
    if (!b || !L().visible(b)) return { title: 'قراءة', bar: true, back: '/library', html: S.ui.empty('alert', 'الكتاب غير متاح') };
    const f = b.hasPdf ? await S.files.get('pdf:' + b.id) : null;
    if (!f) return { title: b.title, back, html: S.ui.empty('file', 'لا يوجد ملف PDF لهذا الكتاب', 'يمكن للمحرر إرفاق ملف مرخّص من صفحة الكتاب.', S.h`<a class="btn" href="#${back}">العودة</a>`) };
    if (S.isFile) {
      const u = URL.createObjectURL(f.blob);
      return { title: b.title, back, html: S.h`<div class="stack">${S.ui.notice('warn', 'القارئ المدمج غير متاح عند الفتح من ملف', 'يحتاج قارئ سِراج إلى تشغيل التطبيق عبر HTTPS أو localhost (راجع README). يمكنك الآن فتح الملف بتطبيق PDF في جهازك:')}<a class="btn primary block" href="${u}" target="_blank" rel="noopener">${S.icon('file')} فتح الملف خارجياً</a></div>` };
    }
    const th = THEMES.includes(S.settings.readerTheme) ? S.settings.readerTheme : 'dark';
    return {
      title: b.title, bar: false, noNav: true, back,
      html: S.h`<div class="reader ${th}" id="rd">
        <div class="reader-bar"><button class="iconbtn" data-act="rdBack" aria-label="رجوع">${S.icon('arrow-right')}</button><div class="rt">${b.title}</div>
          <button class="iconbtn" data-act="rdDrawer" data-tab="search" aria-label="بحث في الكتاب">${S.icon('search')}</button><button class="iconbtn" data-act="rdDrawer" data-tab="outline" aria-label="الفهرس">${S.icon('list')}</button><button class="iconbtn" data-act="rdBm" aria-label="إشارة للصفحة" id="rd-bm">${S.icon('bookmark')}</button><button class="iconbtn" data-act="rdMenu" aria-label="المزيد">${S.icon('more-v')}</button></div>
        <div class="pdf-stage" id="pdfstage"><div class="loading" id="rd-loading">جارٍ فتح الكتاب…</div></div>
        <div class="reader-foot"><button class="iconbtn" data-act="rdGo" data-d="-1" aria-label="الصفحة السابقة">${S.icon('chevron-right')}</button><input type="range" id="rd-range" min="1" max="1" value="1" aria-label="الصفحة" dir="rtl"><input type="number" id="rd-page" min="1" value="1" inputmode="numeric" aria-label="رقم الصفحة"><span id="rd-total" style="min-width:34px;text-align:center">/ —</span><button class="iconbtn" data-act="rdGo" data-d="1" aria-label="الصفحة التالية">${S.icon('chevron-left')}</button><button class="iconbtn" data-act="rdZoom" data-d="-0.2" aria-label="تصغير">${S.icon('minus')}</button><button class="iconbtn" data-act="rdZoom" data-d="0.2" aria-label="تكبير">${S.icon('plus')}</button></div>
        <div id="rd-sel" hidden style="position:absolute;inset-inline:12px;bottom:70px;z-index:5;background:var(--emerald-dark);border:1px solid var(--gold);border-radius:14px;padding:8px;display:flex;gap:8px;justify-content:center"><button class="btn sm gold" data-act="rdHl">${S.icon('edit')} تظليل</button><button class="btn sm" data-act="rdHlNote">${S.icon('notebook')} تظليل + ملاحظة</button><button class="btn sm" data-act="rdCopySel">${S.icon('copy')} نسخ</button></div>
      </div>`,
      mount: () => openBook(b, f, +q.page || 0),
      unmount: cleanup
    };
  });

  async function openBook(b, f, jumpTo) {
    const stage = document.getElementById('pdfstage'); cleanup();
    R = { b, scale: 1, zoom: S.kv.get('reader.zoom', 1), pages: [], cur: 1, textCache: {}, hl: {}, query: '', rendering: new Set(), selFn: null };
    try {
      const lib = await loadPdfjs(); const buf = await f.blob.arrayBuffer();
      R.doc = await lib.getDocument({ data: buf }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') stage.innerHTML = '<div class="loading">الملف محمي بكلمة مرور ولا يمكن فتحه.</div>';
      else stage.innerHTML = `<div class="loading">تعذّر فتح الملف: ${S.esc((e && e.message) || e)}<br><a class="btn sm mt" href="#/library/book/${b.id}">رجوع</a></div>`;
      S.log('error', 'pdf open: ' + ((e && e.message) || e)); return;
    }
    const n = R.doc.numPages; R.n = n; stage.innerHTML = '';
    const p1 = await R.doc.getPage(1); R.vp1 = p1.getViewport({ scale: 1 });
    R.fit = (stage.clientWidth - 20) / R.vp1.width; R.scale = R.fit * R.zoom;
    (await S.db.where('highlights', 'bookId', b.id)).forEach((h) => { (R.hl[h.page] = R.hl[h.page] || []).push(h); });
    for (let i = 1; i <= n; i++) {
      const d = document.createElement('div'); d.className = 'pdf-page'; d.dataset.p = i; d.id = 'pg-' + i; d.style.cssText = `width:${R.vp1.width * R.scale}px;height:${R.vp1.height * R.scale}px;margin-bottom:10px;--scale-factor:${R.scale};--total-scale-factor:${R.scale}`;
      stage.appendChild(d); R.pages.push({ el: d, done: false, scale: 0 });
    }
    document.getElementById('rd-range').max = n; document.getElementById('rd-total').textContent = '/ ' + S.n(n); document.getElementById('rd-page').max = n;
    R.io = new IntersectionObserver((es) => { es.forEach((e) => { const i = +e.target.dataset.p; if (e.isIntersecting) R.pages[i - 1].vis = true; else R.pages[i - 1].vis = false; }); pump(); }, { root: stage, rootMargin: '900px 0px' });
    R.pages.forEach((pg) => R.io.observe(pg.el));
    stage.addEventListener('scroll', S.debounce(onScroll, 120), { passive: true });
    const pr = S.progress.get('book', b.id); const start = jumpTo || (pr && pr.page) || 1; goto(S.clamp(start, 1, n), true);
    b.reads = (b.reads || 0) + 1; L().save(b).catch(() => {}); S.stat.inc('reads:' + b.id);
    try { if (navigator.wakeLock) R.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
    R.selFn = S.debounce(onSelection, 200); document.addEventListener('selectionchange', R.selFn); paintBm();
  }

  function pump() {
    if (!R) return; const vis = R.pages.map((p, i) => (p.vis ? i + 1 : 0)).filter(Boolean); vis.forEach((i) => renderPage(i));
    // تحرير الصفحات البعيدة للحفاظ على الذاكرة
    const done = R.pages.map((p, i) => (p.done ? i + 1 : 0)).filter(Boolean);
    if (done.length > 9) done.filter((i) => Math.abs(i - R.cur) > 5).forEach((i) => release(i));
  }
  function release(i) { const pg = R.pages[i - 1]; if (!pg.done) return; pg.el.innerHTML = ''; pg.done = false; pg.scale = 0; }
  async function renderPage(i) {
    const rec = R.pages[i - 1]; if (!rec || R.rendering.has(i) || (rec.done && rec.scale === R.scale)) return; R.rendering.add(i); const my = R;
    try {
      const page = await R.doc.getPage(i); if (R !== my) return; const vp = page.getViewport({ scale: R.scale }); const dpr = Math.min(window.devicePixelRatio || 1, 2);
      rec.el.innerHTML = ''; rec.el.style.width = Math.floor(vp.width) + 'px'; rec.el.style.height = Math.floor(vp.height) + 'px'; rec.el.style.setProperty('--scale-factor', R.scale); rec.el.style.setProperty('--total-scale-factor', R.scale);
      const cv = document.createElement('canvas'); cv.className = 'pdf-canvas'; cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr); cv.style.width = Math.floor(vp.width) + 'px'; cv.style.height = Math.floor(vp.height) + 'px'; rec.el.appendChild(cv);
      const tr = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
      try { await page.render({ canvas: cv, canvasContext: cv.getContext('2d'), viewport: vp, transform: tr }).promise; }
      catch (e) { if (e && e.name === 'RenderingCancelledException') return; throw e; }
      if (R !== my) return;
      const tl = document.createElement('div'); tl.className = 'textLayer'; rec.el.appendChild(tl);
      try { const t = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp }); await t.render(); } catch (e) { S.log('warn', 'textLayer: ' + e.message); }
      const hl = document.createElement('div'); hl.className = 'hl-layer'; rec.el.appendChild(hl); rec.done = true; rec.scale = R.scale; drawHl(i); markHits(i);
      const ld = document.getElementById('rd-loading'); if (ld) ld.remove();
    } catch (e) { S.log('error', 'render p' + i + ': ' + e.message); } finally { R && R.rendering.delete(i); }
  }
  function onScroll() {
    if (!R) return; const stage = document.getElementById('pdfstage'); const mid = stage.getBoundingClientRect().top + stage.clientHeight / 3; let cur = R.cur;
    for (let i = 0; i < R.pages.length; i++) { const r = R.pages[i].el.getBoundingClientRect(); if (r.bottom > mid) { cur = i + 1; break; } }
    setCur(cur);
  }
  function setCur(n) {
    if (!R || n === R.cur && R.shown) return; R.cur = n; R.shown = true; document.getElementById('rd-page').value = n; document.getElementById('rd-range').value = n; paintBm();
    clearTimeout(R.saveT); R.saveT = setTimeout(() => S.progress.set('book', R.b.id, n, { page: n, total: R.n }), 500);
  }
  function goto(n, instant) {
    if (!R) return; n = S.clamp(n, 1, R.n); const el = R.pages[n - 1].el; el.scrollIntoView({ block: 'start', behavior: instant ? 'auto' : 'smooth' }); setCur(n); setTimeout(pump, 80);
  }
  S.act('rdBack', () => S.router.back('/library'));
  S.act('rdGo', (el) => goto((R ? R.cur : 1) + +el.dataset.d));
  document.addEventListener('change', (e) => { if (!R) return; if (e.target.id === 'rd-page') goto(+e.target.value); if (e.target.id === 'rd-range') goto(+e.target.value, true); });
  document.addEventListener('input', (e) => { if (R && e.target.id === 'rd-range') document.getElementById('rd-page').value = e.target.value; });
  S.act('rdZoom', async (el) => {
    if (!R) return; const z = S.clamp(Math.round((R.zoom + +el.dataset.d) * 10) / 10, 0.5, 3.5); R.zoom = z; S.kv.set('reader.zoom', z); R.scale = R.fit * z; const cur = R.cur;
    R.pages.forEach((p, i) => { p.el.style.width = R.vp1.width * R.scale + 'px'; p.el.style.height = R.vp1.height * R.scale + 'px'; p.done = false; p.el.innerHTML = ''; });
    goto(cur, true); pump();
  });

  /* ---------- الإشارات ---------- */
  const bmId = () => R.b.id + ':' + R.cur;
  async function paintBm() { if (!R) return; const on = await S.bm.has('book', bmId()); const b = document.getElementById('rd-bm'); if (b) b.style.color = on ? 'var(--gold-light)' : '#fff'; }
  S.act('rdBm', async () => { const id = bmId(); if (await S.bm.has('book', id)) { await S.bm.remove('book', id); S.toast('أُزيلت الإشارة', 'ok'); } else { await S.bm.add('book', id, R.b.title + ' — صفحة ' + R.cur, { bookId: R.b.id, page: R.cur }); S.toast('أُضيفت إشارة للصفحة ' + S.n(R.cur), 'ok'); } paintBm(); });

  /* ---------- التظليل والملاحظات ---------- */
  function drawHl(i) {
    const pg = R.pages[i - 1]; const layer = pg.el.querySelector('.hl-layer'); if (!layer) return;
    layer.innerHTML = (R.hl[i] || []).map((h) => h.rects.map((r) => `<i style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%"></i>`).join('')).join('');
  }
  function onSelection() {
    if (!R) return; const sel = window.getSelection(); const bar = document.getElementById('rd-sel'); if (!bar) return;
    const ok = sel && !sel.isCollapsed && sel.toString().trim() && sel.anchorNode && (sel.anchorNode.parentElement || sel.anchorNode).closest && (sel.anchorNode.parentElement || sel.anchorNode).closest('.textLayer');
    bar.hidden = !ok;
  }
  function selectionRects() {
    const sel = window.getSelection(); if (!sel || sel.isCollapsed) return null; const range = sel.getRangeAt(0); const node = (range.startContainer.parentElement || range.startContainer).closest('.pdf-page'); if (!node) return null;
    const pr = node.getBoundingClientRect(); const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2).map((r) => ({ x: (r.left - pr.left) / pr.width, y: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height }));
    return rects.length ? { page: +node.dataset.p, rects, text: sel.toString().trim().slice(0, 600) } : null;
  }
  async function addHl(withNote) {
    const s = selectionRects(); if (!s) return S.toast('حدّد نصاً أولاً', 'err'); let note = '';
    if (withNote) { const v = await S.prompt('ملاحظة على المقطع', { multiline: true, label: s.text.slice(0, 90) + (s.text.length > 90 ? '…' : '') }); if (v === null) return; note = v.trim(); }
    const rec = { id: S.uid('hl'), bookId: R.b.id, page: s.page, rects: s.rects, text: s.text, note, ts: Date.now() }; await S.db.put('highlights', rec);
    (R.hl[s.page] = R.hl[s.page] || []).push(rec); drawHl(s.page); window.getSelection().removeAllRanges(); document.getElementById('rd-sel').hidden = true; S.toast(note ? 'حُفظ التظليل والملاحظة' : 'حُفظ التظليل', 'ok');
  }
  S.act('rdHl', () => addHl(false)); S.act('rdHlNote', () => addHl(true));
  S.act('rdCopySel', () => { const t = window.getSelection().toString(); if (t) S.copy(t + '\n— ' + R.b.title + ' (ص ' + R.cur + ')'); });

  /* ---------- البحث داخل الكتاب ---------- */
  async function pageText(i) { if (R.textCache[i] != null) return R.textCache[i]; const pg = await R.doc.getPage(i); const tc = await pg.getTextContent(); const items = tc.items.map((x) => x.str); R.textCache[i] = items; return items; }
  function markHits(i) { if (!R || !R.query) return; const toks = S.norm(R.query).split(' ').filter(Boolean); const tl = R.pages[i - 1].el.querySelector('.textLayer'); if (!tl) return; tl.querySelectorAll('span').forEach((sp) => { const t = S.norm(sp.textContent); if (t && toks.some((k) => t.includes(k))) sp.classList.add('hit'); }); }
  async function runSearch(q, out) {
    const toks = S.norm(q).split(' ').filter(Boolean); if (!toks.length) return; R.query = q; const token = (R.searchTok = (R.searchTok || 0) + 1); const res = [];
    out.innerHTML = '<p class="small muted">جارٍ البحث…</p>';
    for (let i = 1; i <= R.n && res.length < 120; i++) {
      if (token !== R.searchTok) return; const items = await pageText(i); const norm = items.map((t) => S.norm(t)); const joined = norm.join(' ');
      if (toks.every((k) => joined.includes(k))) { const idx = norm.findIndex((t) => t.includes(toks[0])); res.push({ page: i, snip: idx >= 0 ? items.slice(Math.max(0, idx - 1), idx + 3).join(' ') : '' }); }
      if (i % 12 === 0) out.innerHTML = `<p class="small muted">بحث… ${S.n(i)}/${S.n(R.n)} — ${S.n(res.length)} نتيجة</p>`;
    }
    out.innerHTML = res.length ? `<p class="small muted">${S.n(res.length)} صفحة تحتوي النص</p>` + res.map((r) => `<button class="li" data-act="rdPage" data-p="${r.page}"><span class="li-body"><span class="li-t">صفحة ${S.n(r.page)}</span><span class="li-s">${S.esc(r.snip.slice(0, 120))}</span></span></button>`).join('') : '<p class="small muted">لا نتائج. إذا كان الملف صوراً ممسوحة ضوئياً فلا يوجد نص قابل للبحث (يلزم OCR).</p>';
    R.pages.forEach((p, i) => { if (p.done) markHits(i + 1); });
  }
  S.act('rdPage', (el) => { closeDrawer(); goto(+el.dataset.p); });

  /* ---------- الأدراج: فهرس / بحث / إشارات / ملاحظاتي ---------- */
  function closeDrawer() { const d = document.getElementById('rd-drawer'); if (d) d.remove(); }
  S.act('rdClose', closeDrawer);
  S.act('rdDrawer', (el) => openDrawer(el.dataset.tab));
  async function outlineItems() {
    if (R.outline) return R.outline; const out = []; const ol = await R.doc.getOutline();
    async function walk(items, depth) {
      for (const it of items || []) {
        if (out.length > 400) return; let pageNo = null;
        try { let dest = it.dest; if (typeof dest === 'string') dest = await R.doc.getDestination(dest); if (Array.isArray(dest)) pageNo = (await R.doc.getPageIndex(dest[0])) + 1; } catch (e) { /* */ }
        out.push({ t: it.title, p: pageNo, d: depth }); if (it.items && it.items.length) await walk(it.items, depth + 1);
      }
    }
    await walk(ol, 0); R.outline = out; return out;
  }
  async function openDrawer(tab) {
    if (!R) return; closeDrawer(); const rd = document.getElementById('rd');
    const d = document.createElement('div'); d.className = 'drawer'; d.id = 'rd-drawer';
    d.innerHTML = `<div class="dr-hd"><span>${{ outline: 'فهرس الكتاب', search: 'بحث في الكتاب', marks: 'الإشارات', notes: 'تظليلاتي وملاحظاتي' }[tab]}</span><button class="iconbtn" data-act="rdClose" aria-label="إغلاق">${S.icon('close').s}</button></div>
      <div class="tabs" style="padding:0 8px">${['outline', 'search', 'marks', 'notes'].map((t) => `<button class="tab ${t === tab ? 'active' : ''}" data-act="rdDrawer" data-tab="${t}">${{ outline: 'الفهرس', search: 'بحث', marks: 'إشارات', notes: 'ملاحظات' }[t]}</button>`).join('')}</div><div class="dr-bd" id="rd-dr-bd"></div>`;
    rd.appendChild(d); const bd = document.getElementById('rd-dr-bd');
    if (tab === 'outline') { bd.innerHTML = '<p class="small muted">جارٍ القراءة…</p>'; const o = await outlineItems(); bd.innerHTML = o.length ? o.map((x) => `<button class="li" ${x.p ? `data-act="rdPage" data-p="${x.p}"` : 'disabled'} style="padding-inline-start:${14 + x.d * 14}px"><span class="li-body"><span class="li-t">${S.esc(x.t)}</span></span>${x.p ? `<span class="li-end small">${S.n(x.p)}</span>` : ''}</button>`).join('') : '<p class="small muted">لا فهرس مضمّن داخل هذا الملف. استخدم البحث أو الانتقال لرقم صفحة.</p>'; }
    else if (tab === 'search') { bd.innerHTML = `<div class="searchbox">${S.icon('search').s}<input class="input" id="rd-q" placeholder="ابحث في نص الكتاب" value="${S.esc(R.query || '')}" enterkeyhint="search"></div><div id="rd-res" class="mt"></div>`; const inp = document.getElementById('rd-q'); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(inp.value, document.getElementById('rd-res')); }); inp.focus(); }
    else if (tab === 'marks') { const m = (await S.bm.list('book')).filter((x) => x.bookId === R.b.id).sort((a, b) => a.page - b.page); bd.innerHTML = m.length ? m.map((x) => `<button class="li" data-act="rdPage" data-p="${x.page}"><span class="li-ico">${S.icon('bookmark').s}</span><span class="li-body"><span class="li-t">صفحة ${S.n(x.page)}</span><span class="li-s">${S.fmt.dt(x.ts)}</span></span></button>`).join('') : '<p class="small muted">لا إشارات. اضغط أيقونة الإشارة في الأعلى لحفظ الصفحة.</p>'; }
    else { const all = Object.values(R.hl).flat().sort((a, b) => a.page - b.page || a.ts - b.ts); const pn = (await S.db.where('notes', 'type', 'book')).filter((n) => n.bookId === R.b.id); bd.innerHTML = (all.length || pn.length) ? all.map((h) => `<div class="card flat"><button class="btn xs" data-act="rdPage" data-p="${h.page}">ص ${S.n(h.page)}</button> <button class="btn xs danger" data-act="rdHlDel" data-id="${h.id}">حذف</button><p class="small nm mt-s">${S.esc(h.text.slice(0, 200))}</p>${h.note ? `<p class="nm gold">${S.esc(h.note)}</p>` : ''}</div>`).join('') + pn.map((n) => `<div class="card flat"><button class="btn xs" data-act="rdPage" data-p="${n.page}">ص ${S.n(n.page)}</button> <button class="btn xs danger" data-act="rdNoteDel" data-id="${n.id}">حذف</button><p class="nm">${S.esc(n.text)}</p></div>`).join('') : '<p class="small muted">لا تظليلات أو ملاحظات بعد. حدّد نصاً في الصفحة ثم اختر «تظليل».</p>'; }
  }
  S.act('rdHlDel', async (el) => { const id = el.dataset.id; await S.db.del('highlights', id); Object.keys(R.hl).forEach((k) => { R.hl[k] = R.hl[k].filter((h) => h.id !== id); drawHl(+k); }); openDrawer('notes'); });
  S.act('rdNoteDel', async (el) => { await S.db.del('notes', el.dataset.id); openDrawer('notes'); });

  /* ---------- القائمة ---------- */
  S.act('rdMenu', () => {
    S.modal({
      title: 'خيارات القراءة',
      body: S.h`<div class="grid2"><button class="btn" data-act="rdTheme">${S.icon('moon')} المظهر: ${THEME_AR[S.settings.readerTheme] || 'ليلي'}</button><button class="btn" data-act="rdFit">${S.icon('text-size')} ملاءمة العرض</button><button class="btn" data-act="rdPageNote">${S.icon('notebook')} ملاحظة على الصفحة</button><button class="btn" data-act="rdDrawerM" data-tab="notes">${S.icon('edit')} تظليلاتي</button><a class="btn" href="#/library/book/${R ? R.b.id : ''}" data-act="closeM">${S.icon('info')} بيانات الكتاب</a><button class="btn" data-act="rdFull">${S.icon('eye')} ملء الشاشة</button></div>`,
      actions: [{ label: 'إغلاق', cls: 'ghost' }]
    });
  });
  S.act('rdDrawerM', (el) => { S.closeAllModals(); openDrawer(el.dataset.tab); });
  S.act('rdTheme', () => { const i = THEMES.indexOf(S.settings.readerTheme); const nx = THEMES[(i + 1) % THEMES.length]; S.set('readerTheme', nx); const rd = document.getElementById('rd'); THEMES.forEach((t) => rd.classList.remove(t)); rd.classList.add(nx); S.closeAllModals(); S.toast('مظهر القراءة: ' + THEME_AR[nx]); });
  S.act('rdFit', () => { S.closeAllModals(); if (!R) return; R.zoom = 1; S.kv.set('reader.zoom', 1); R.fit = (document.getElementById('pdfstage').clientWidth - 20) / R.vp1.width; R.scale = R.fit; const cur = R.cur; R.pages.forEach((p) => { p.el.style.width = R.vp1.width * R.scale + 'px'; p.el.style.height = R.vp1.height * R.scale + 'px'; p.done = false; p.el.innerHTML = ''; }); goto(cur, true); pump(); });
  S.act('rdFull', () => { S.closeAllModals(); const e = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else e.requestFullscreen(); } catch (x) { S.toast('ملء الشاشة غير مدعوم', 'err'); } });
  S.act('rdPageNote', async () => { S.closeAllModals(); const v = await S.prompt('ملاحظة على صفحة ' + S.n(R.cur), { multiline: true, label: 'تُحفظ في جهازك فقط' }); if (!v || !v.trim()) return; await S.db.put('notes', { id: S.uid('nt'), type: 'book', ref: R.b.id + ':' + R.cur, bookId: R.b.id, page: R.cur, text: v.trim(), ts: Date.now() }); S.toast('حُفظت الملاحظة', 'ok'); });
  async function outlineOf(blob) {
    const lib = await loadPdfjs(); const d = await lib.getDocument({ data: await blob.arrayBuffer() }).promise; const out = [];
    try {
      const ol = await d.getOutline(); const walk = async (items, depth) => {
        for (const it of items || []) {
          let page = null; try { let dest = it.dest; if (typeof dest === 'string') dest = await d.getDestination(dest); if (Array.isArray(dest) && dest[0] && typeof dest[0] === 'object') page = (await d.getPageIndex(dest[0])) + 1; } catch (e) { /* */ }
          out.push({ title: String(it.title || '').trim(), depth, page }); if (it.items && it.items.length && depth < 3) await walk(it.items, depth + 1);
        }
      }; await walk(ol, 0);
    } finally { d.destroy(); }
    return out.filter((x) => x.title);
  }
  S.reader = { outline: outlineOf, pageCount: async (blob) => { try { const lib = await loadPdfjs(); const d = await lib.getDocument({ data: await blob.arrayBuffer() }).promise; const n = d.numPages; d.destroy(); return n; } catch (e) { return null; } }, open: (id, page) => S.router.go('/library/read/' + id + (page ? '?page=' + page : '')) };
})();

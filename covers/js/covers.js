/* سِراج — الأغلفة: اكتب اسم الكتاب → غلاف بشكل «المخطوطة». المحرّك المشترك في assets/js/cover-art.js. */
(function () {
  'use strict';
  const C = window.SIRAJ_COVER; const $ = (s) => document.querySelector(s);
  const KEY = 'siraj.covers.v1';
  const st = { title: '', author: '', color: 'lapis', spine: 'right', res: 1200 };
  let saved = { theme: 'auto', list: [] };
  try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (j && typeof j === 'object') saved = Object.assign(saved, j); if (!Array.isArray(saved.list)) saved.list = []; } catch (e) { /* التخزين غير متاح */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* */ } };
  const cap = (n) => { try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]; } catch (e) { return null; } };
  const isNative = () => { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } };

  function toast(msg, kind) {
    const box = $('#toasts'); for (const el of box.children) if (el.dataset.m === msg) return;
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.dataset.m = msg; t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, kind === 'err' ? 5000 : 2600);
  }
  const opts = () => ({ title: st.title.trim() || 'اسم الكتاب', author: st.author.trim(), color: st.color, spine: st.spine });
  const cv = $('#cv'); let raf = 0;
  function paint() {
    raf = 0; const w = Math.min(900, Math.round(cv.getBoundingClientRect().width * (window.devicePixelRatio || 1)) || 540);
    C.draw(cv, w, opts()); $('.book').classList.toggle('left', st.spine === 'left');
  }
  const repaint = () => { if (!raf) raf = requestAnimationFrame(paint); };

  /* ---------- الألوان ---------- */
  function buildSwatches() {
    const box = $('#swatches'); box.textContent = '';
    C.PALETTES.forEach((p) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (p.light ? ' vel' : ''); b.style.background = p.bg; b.setAttribute('role', 'radio'); b.dataset.c = p.id;
      b.setAttribute('aria-label', 'لون ' + p.name); b.title = p.name; b.setAttribute('aria-checked', String(p.id === st.color)); box.appendChild(b);
    });
    const c = document.createElement('label'); c.className = 'sw custom'; c.title = 'لون مخصص'; c.setAttribute('aria-label', 'لون مخصص');
    c.innerHTML = '<input type="color" id="f-custom" value="#1F3A6B" aria-label="اختيار لون مخصص">'; box.appendChild(c);
  }
  $('#swatches').addEventListener('click', (e) => {
    const b = e.target.closest('.sw[data-c]'); if (!b) return; st.color = b.dataset.c;
    document.querySelectorAll('.sw[data-c]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); repaint();
  });
  $('#swatches').addEventListener('input', (e) => { if (e.target.id === 'f-custom') { st.color = e.target.value; document.querySelectorAll('.sw[data-c]').forEach((x) => x.setAttribute('aria-checked', 'false')); repaint(); } });

  $('#f-title').addEventListener('input', (e) => { st.title = e.target.value; repaint(); });
  $('#f-author').addEventListener('input', (e) => { st.author = e.target.value; repaint(); });
  $('#f-spine').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; st.spine = b.dataset.v; document.querySelectorAll('#f-spine button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); repaint(); });
  $('#f-res').addEventListener('change', (e) => { st.res = +e.target.value || 1200; });

  /* ---------- تصدير ---------- */
  const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error || new Error('read')); r.readAsDataURL(blob); });
  async function makeBlob() {
    if (!st.title.trim()) { toast('اكتب اسم الكتاب أولاً', 'err'); $('#f-title').focus(); return null; }
    return C.toBlob(opts(), st.res);
  }
  const fname = () => 'siraj-cover-' + Date.now() + '.png';
  async function nativeSave(blob, name, share) {
    const FS = cap('Filesystem'), SH = cap('Share'); if (!FS || !SH) throw new Error('إضافة الملفات/المشاركة غير متوفرة');
    const w = await FS.writeFile({ path: name, data: await b64(blob), directory: 'CACHE' });
    await SH.share({ title: st.title.trim() || 'غلاف', url: w.uri, dialogTitle: share ? 'مشاركة الغلاف' : 'حفظ الغلاف (اختر «حفظ» أو مجلداً)' });
  }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function act(mode) {
    const btn = mode === 'save' ? $('#btn-save') : $('#btn-share'); btn.disabled = true;
    try {
      const blob = await makeBlob(); if (!blob) return; const name = fname();
      window.__lastCoverBlob = { size: blob.size, type: blob.type, mode };
      if (isNative()) { await nativeSave(blob, name, mode === 'share'); if (mode === 'save') toast('اختر «حفظ» من النافذة لتخزين الصورة'); return; }
      if (mode === 'share' && navigator.canShare) {
        const f = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: st.title.trim() }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      }
      download(blob, name); toast('تم حفظ الصورة في مجلد التنزيلات', 'ok');
    } catch (e) { if (e && /cancel|abort/i.test(String(e.message || e.name || ''))) return; toast('تعذّر إنشاء الصورة: ' + (e && e.message ? e.message : e), 'err'); }
    finally { btn.disabled = false; }
  }
  $('#btn-save').addEventListener('click', () => act('save'));
  $('#btn-share').addEventListener('click', () => act('share'));

  /* ---------- غلافاتي (محفوظة على الجهاز) ---------- */
  function renderGallery() {
    const box = $('#g-list'); box.textContent = ''; $('#gallery').hidden = !saved.list.length;
    saved.list.forEach((it, i) => {
      const d = document.createElement('div'); d.className = 'it'; const c = document.createElement('canvas'); c.setAttribute('role', 'button'); c.tabIndex = 0;
      c.setAttribute('aria-label', 'فتح غلاف ' + it.title); C.draw(c, 260, it); d.appendChild(c);
      const t = document.createElement('div'); t.className = 'cap'; t.textContent = it.title; d.appendChild(t);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'del'; x.textContent = 'حذف'; x.setAttribute('aria-label', 'حذف غلاف ' + it.title); d.appendChild(x);
      const open = () => { Object.assign(st, { title: it.title, author: it.author || '', color: it.color, spine: it.spine || 'right' }); syncForm(); repaint(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      c.addEventListener('click', open); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      x.addEventListener('click', () => { saved.list.splice(i, 1); persist(); renderGallery(); toast('حُذف الغلاف'); });
      box.appendChild(d);
    });
  }
  $('#btn-keep').addEventListener('click', () => {
    if (!st.title.trim()) { toast('اكتب اسم الكتاب أولاً', 'err'); $('#f-title').focus(); return; }
    const it = opts(); saved.list = saved.list.filter((x) => !(x.title === it.title && x.author === it.author)); saved.list.unshift(it); saved.list = saved.list.slice(0, 60);
    persist(); renderGallery(); toast('أُضيف إلى غلافاتي', 'ok');
  });
  function syncForm() {
    $('#f-title').value = st.title; $('#f-author').value = st.author;
    document.querySelectorAll('.sw[data-c]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.c === st.color)));
    document.querySelectorAll('#f-spine button').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.v === st.spine)));
  }

  /* ---------- المظهر ---------- */
  $('#btn-theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme; const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; saved.theme = nx; persist();
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = nx === 'dark' ? '#211A11' : '#F8F1E0';
  });

  buildSwatches(); renderGallery(); paint();
  C.ensureFont().then(() => { paint(); renderGallery(); }); /* بعد تحميل خط Amiri */
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { repaint(); });
  window.addEventListener('resize', repaint);
  document.documentElement.dataset.ready = '1';
})();

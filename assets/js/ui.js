/* =====================================================================
   سِراج — ui.js : النواة المشتركة (قوالب آمنة، أيقونات، نوافذ، إعدادات، تواريخ، أدوات)
   لا يعتمد على أي مكتبة. كل النصوص المُدخلة تمر عبر esc() لمنع حقن HTML.
   ===================================================================== */
(function () {
  'use strict';
  const S = (window.SIRAJ = window.SIRAJ || {});
  S.version = '1.0.0';
  S.isFile = location.protocol === 'file:';
  /* داخل تطبيق أندرويد (Capacitor) تتوفر window.Capacitor وإضافاته. نتحقق عند كل استعمال لا مرة واحدة. */
  Object.defineProperty(S, 'isNative', { get() { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } } });
  const cap = (n) => { try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]; } catch (e) { return null; } };
  const blobB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error || new Error('تعذّرت قراءة الملف')); r.readAsDataURL(blob); });
  /* حفظ ملف داخل التطبيق الأصلي: كتابة في مجلد الكاش ثم نافذة المشاركة ليختار المستخدم «حفظ» (ملفات/درايف…). */
  S.nativeSave = async function (blob, name, title) {
    const FS = cap('Filesystem'), SH = cap('Share'); if (!FS || !SH) throw new Error('إضافة الملفات/المشاركة غير متوفرة في هذا الإصدار');
    const safe = String(name || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    const w = await FS.writeFile({ path: 'siraj-' + Date.now() + '-' + safe, data: await blobB64(blob), directory: 'CACHE' });
    await SH.share({ title: title || safe, url: w.uri, dialogTitle: 'حفظ أو مشاركة الملف' });
    return true;
  };
  S.logs = [];
  S.log = function (level, msg, extra) {
    S.logs.push({ t: new Date().toISOString(), level, msg: String(msg), extra: extra ? String(extra) : '' });
    if (S.logs.length > 200) S.logs.shift();
    if (level === 'error') console.error('[SIRAJ]', msg, extra || '');
  };

  /* ---------- قوالب HTML آمنة ---------- */
  class SafeHTML { constructor(s) { this.s = s; } toString() { return this.s; } }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  const raw = (s) => new SafeHTML(String(s == null ? '' : s));
  function part(v) {
    if (v instanceof SafeHTML) return v.s;
    if (Array.isArray(v)) return v.map(part).join('');
    if (v === false || v == null) return '';
    return esc(v);
  }
  function h(strings, ...vals) {
    let out = '';
    for (let i = 0; i < strings.length; i++) { out += strings[i]; if (i < vals.length) out += part(vals[i]); }
    return new SafeHTML(out);
  }
  S.h = h; S.raw = raw; S.esc = esc; S.SafeHTML = SafeHTML;
  S.url = function (u) {
    u = String(u || '').trim();
    if (!u) return '#';
    if (/^(https?:|mailto:|tel:|geo:|blob:|data:image\/)/i.test(u) || /^[#./]/.test(u)) return u;
    return '#';
  };
  S.$ = (sel, root) => (root || document).querySelector(sel);
  S.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  S.mount = function (el, html) { const one = (x) => (x instanceof SafeHTML ? x.s : String(x == null ? '' : x)); el.innerHTML = Array.isArray(html) ? html.map(one).join('') : one(html); return el; };
  S.uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  S.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  S.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  S.clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  /* ---------- الأيقونات (مخطط SVG موحّد) ---------- */
  const IC = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    'book-open': '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    library: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><path d="M16.5 6.5l3.9-.9 3 13.2-3.9.9z" transform="translate(-1.5 0)"/>',
    beads: '<circle cx="12" cy="3.8" r="1.8"/><circle cx="18.6" cy="7" r="1.8"/><circle cx="20.2" cy="14" r="1.8"/><circle cx="16" cy="19.4" r="1.8"/><circle cx="8" cy="19.4" r="1.8"/><circle cx="3.8" cy="14" r="1.8"/><circle cx="5.4" cy="7" r="1.8"/><path d="M12 21.4V23"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>',
    'chevron-left': '<path d="M15 18l-6-6 6-6"/>',
    'chevron-right': '<path d="M9 18l6-6-6-6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    upload: '<path d="M12 16V4"/><path d="M7 8l5-5 5 5"/><path d="M4 20h16"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 5 5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    mosque: '<path d="M12 2.5c-2.6 2-4 3.6-4 6.5h8c0-2.9-1.4-4.5-4-6.5z"/><path d="M5 21v-9h14v9"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M3 21h18M5 12V8.5M19 12V8.5"/>',
    play: '<path d="M7 4l13 8-13 8z" class="f"/>', pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    'skip-next': '<path d="M19 5L9 12l10 7z"/><path d="M5 5v14"/>', 'skip-prev': '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    volume: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    scroll: '<path d="M8 21h11a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-2 2z"/><path d="M8 21a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2h4"/><path d="M19 18V5a2 2 0 0 0-2-2H6"/>',
    notebook: '<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    'map-pin': '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    timeline: '<path d="M12 3v18"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M14 7h6M4 17h6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    scale: '<path d="M12 3v18M5 21h14M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    gavel: '<path d="M13 5l6 6M10 8l6 6M5 21l8-8"/><path d="M3 21h8"/>',
    'help-circle': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.5"/>',
    'heart-handshake': '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/><path d="M8 12l2.5 2.5L16 9"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2M16 12h0M16 16h0"/>',
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><path d="M12 20h0"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.5M3 12h.5M3 18h.5"/>',
    'more-v': '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    'text-size': '<path d="M4 20L9 5l5 15M5.8 15h6.4M16 20l3-9 3 9M17 17h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8M9 18h6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M11 7.3L6 15.8M13 7.3l5 8.5M7.5 18h9"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
  };
  function injectSprite() {
    if (document.getElementById('sprite')) return;
    const s = Object.keys(IC).map((k) => `<symbol id="i-${k}" viewBox="0 0 24 24">${IC[k]}</symbol>`).join('');
    const d = document.createElement('div');
    d.id = 'sprite'; d.hidden = true;
    d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute">${s}</svg>`;
    document.body.prepend(d);
  }
  S.icon = (name, cls) => raw(`<svg class="i ${esc(cls || '')}" aria-hidden="true" focusable="false"><use href="#i-${esc(name)}"/></svg>`);
  S.hasIcon = (n) => !!IC[n];

  /* ---------- الأحداث المفوَّضة ---------- */
  const actions = {}, inputs = {}, changes = {};
  S.act = (name, fn) => { actions[name] = fn; };
  S.onInput = (name, fn) => { inputs[name] = fn; };
  S.onChange = (name, fn) => { changes[name] = fn; };
  function guard(fn, el, ev) {
    try {
      const r = fn(el, ev);
      if (r && typeof r.catch === 'function') r.catch((e) => S.fail(e));
    } catch (e) { S.fail(e); }
  }
  S.fail = function (e, msg) {
    S.log('error', (e && e.message) || e, e && e.stack);
    S.toast(msg || ('تعذّر إكمال العملية: ' + ((e && e.message) || e)), 'err');
  };
  function wireEvents() {
    document.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-act]');
      if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
      const fn = actions[t.dataset.act];
      if (!fn) { S.log('warn', 'إجراء غير معرّف: ' + t.dataset.act); return; }
      if (t.tagName !== 'A' || t.getAttribute('href') === '#') ev.preventDefault();
      guard(fn, t, ev);
    });
    document.addEventListener('input', (ev) => {
      const t = ev.target.closest('[data-inp]'); if (t && inputs[t.dataset.inp]) guard(inputs[t.dataset.inp], t, ev);
    });
    document.addEventListener('change', (ev) => {
      const t = ev.target.closest('[data-chg]'); if (t && changes[t.dataset.chg]) guard(changes[t.dataset.chg], t, ev);
    });
  }

  /* ---------- الإعدادات (LocalStorage) ---------- */
  const SKEY = 'siraj.settings.v1';
  const DEFAULTS = {
    theme: 'auto', fontScale: 1, quranScale: 1, elder: false, digits: 'en', userName: '', marja: '',
    cityId: '', cityName: '', lat: null, lng: null, tz: '', calcMethod: 'Jafari', asr: 'Standard', madhab: 'jafari',
    hijriCal: 'umalqura', hijriOffset: 0, tune: { imsak: 0, fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    adhanOn: false, preMin: 10, notifyOcc: true, vibrate: true, sound: true,
    reciter: 'ar.alafasy', quranMode: 'flow', translation: '', showTranslation: false, readerTheme: 'dark', maxPdfMB: 80,
    remoteAi: { enabled: false, endpoint: '' }, onboarded: false, lang: 'ar'
  };
  S.settings = Object.assign({}, DEFAULTS);
  try { const raw0 = localStorage.getItem(SKEY); if (raw0) S.settings = Object.assign({}, DEFAULTS, JSON.parse(raw0)); } catch (e) { /* التخزين غير متاح */ }
  S.set = function (key, val) {
    if (typeof key === 'object') Object.assign(S.settings, key); else S.settings[key] = val;
    try { localStorage.setItem(SKEY, JSON.stringify(S.settings)); } catch (e) { S.log('warn', 'تعذّر حفظ الإعدادات'); }
    S.applySettings();
  };
  S.applySettings = function () {
    const st = S.settings, root = document.documentElement;
    let th = st.theme;
    if (th === 'auto') th = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.dataset.theme = th;
    root.dataset.elder = st.elder ? '1' : '0';
    root.style.setProperty('--fscale', String(st.fontScale));
    root.style.setProperty('--q-scale', String(st.quranScale));
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = th === 'dark' ? '#211A11' : '#F8F1E0';
    S.theme = th; S.syncBars(th);
    S.$$ && S.$$('[data-act=toggleTheme]').forEach((b) => { b.innerHTML = S.icon(th === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', th === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'); });
    document.dispatchEvent(new CustomEvent('siraj:settings'));
  };
  /* ألوان أيقونات شريطي النظام في أندرويد: شريط الحالة فوق ترويسة خضراء داكنة دائماً، وشريط التنقل تحت الشريط السفلي */
  S.syncBars = function (th) {
    if (!S.isNative) return;
    const sb = cap('SystemBars'); if (!sb || !sb.setStyle) return;
    try { Promise.resolve(sb.setStyle({ style: 'DARK', bar: 'StatusBar' })).catch(() => {}); } catch (e) { /* */ }
    try { Promise.resolve(sb.setStyle({ style: th === 'dark' ? 'DARK' : 'LIGHT', bar: 'NavigationBar' })).catch(() => {}); } catch (e) { /* */ }
  };
  S.toggleTheme = function () { S.set('theme', (S.theme || 'light') === 'dark' ? 'light' : 'dark'); };

  /* ---------- الأرقام والتواريخ ---------- */
  const AR_DIG = '٠١٢٣٤٥٦٧٨٩';
  S.n = function (v) { const s = String(v); return S.settings.digits === 'ar' ? s.replace(/\d/g, (d) => AR_DIG[+d]) : s; };
  S.arNum = (v) => String(v).replace(/\d/g, (d) => AR_DIG[+d]); // دائماً هندي (لأرقام الآيات)
  S.fmt = {
    pad: (n) => String(n).padStart(2, '0'),
    bytes(b) { if (b == null) return '—'; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return S.n(b.toFixed(i ? 1 : 0)) + ' ' + u[i]; },
    gdate(d, opt) { try { return new Intl.DateTimeFormat('ar-IQ-u-ca-gregory-nu-' + (S.settings.digits === 'ar' ? 'arab' : 'latn'), opt || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { return d.toDateString(); } },
    time(d) { return S.n(S.fmt.pad(d.getHours()) + ':' + S.fmt.pad(d.getMinutes())); },
    hm(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return S.n(S.fmt.pad(Math.floor(s / 3600)) + ':' + S.fmt.pad(Math.floor(s % 3600 / 60)) + ':' + S.fmt.pad(s % 60)); },
    dt(ts) { const d = new Date(ts); return S.n(d.getFullYear() + '/' + S.fmt.pad(d.getMonth() + 1) + '/' + S.fmt.pad(d.getDate()) + ' ' + S.fmt.pad(d.getHours()) + ':' + S.fmt.pad(d.getMinutes())); },
    day(ts) { const d = new Date(ts); return d.getFullYear() + '-' + S.fmt.pad(d.getMonth() + 1) + '-' + S.fmt.pad(d.getDate()); }
  };
  S.today = () => S.fmt.day(Date.now());

  /* التاريخ الهجري: Intl (أم القرى أو المدني) مع بديل حسابي، وإزاحة يدوية لمطابقة الرؤية */
  function civilHijri(date) { // خوارزمية الجدول المدني (تقريبية)
    const jd = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000 + 2440587.5 + 0.5);
    let l = jd - 1948440 + 10632; const n = Math.floor((l - 1) / 10631); l = l - 10631 * n + 354;
    const j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    const m = Math.floor((24 * l) / 709); const d = l - Math.floor((709 * m) / 24); const y = 30 * n + j - 30;
    return { y, m, d, approx: true };
  }
  const hijriFmt = {};
  S.hijri = function (date, opts) {
    const st = S.settings; opts = opts || {};
    const off = opts.offset != null ? opts.offset : st.hijriOffset || 0;
    const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    dt.setDate(dt.getDate() + off);
    const cal = opts.cal || st.hijriCal || 'umalqura';
    try {
      const f = hijriFmt[cal] || (hijriFmt[cal] = new Intl.DateTimeFormat('en-u-ca-islamic' + (cal === 'civil' ? '-civil' : '-umalqura') + '-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }));
      const parts = f.formatToParts(dt); const g = (t) => parseInt((parts.find((p) => p.type === t) || {}).value, 10);
      const o = { y: g('year'), m: g('month'), d: g('day') };
      if (o.y > 1000 && o.m >= 1 && o.m <= 12 && o.d >= 1) return o;
    } catch (e) { /* يتجاوز للحساب البديل */ }
    return civilHijri(dt);
  };
  S.hijriStr = function (date, opts) {
    const o = S.hijri(date, opts); const M = (S.data && S.data.sample.hijriMonths) || [];
    return S.n(o.d) + ' ' + (M[o.m - 1] || o.m) + ' ' + S.n(o.y) + ' هـ';
  };

  /* ---------- معالجة النص العربي للبحث ---------- */
  S.norm = function (s) {
    return String(s == null ? '' : s)
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g, '')
      .replace(/[آأإٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, (d) => String(AR_DIG.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .toLowerCase().replace(/\s+/g, ' ').trim();
  };

  /* ---------- مساعدات عامة ---------- */
  S.download = function (blob, name) {
    if (S.isNative) { S.nativeSave(blob, name).catch((e) => { if (e && /cancel/i.test(String(e.message || e))) return; S.toast('تعذّر حفظ الملف: ' + (e && e.message ? e.message : e), 'err'); }); return; }
    const a = document.createElement('a'); const u = URL.createObjectURL(blob);
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 4000);
  };
  S.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); S.toast('تم النسخ', 'ok'); return true; }
    catch (e) {
      try { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); S.toast(ok ? 'تم النسخ' : 'تعذّر النسخ', ok ? 'ok' : 'err'); return ok; }
      catch (e2) { S.toast('تعذّر النسخ', 'err'); return false; }
    }
  };
  S.share = async function (o) {
    if (S.isNative) {
      try {
        if (o.files && o.files[0]) { await S.nativeSave(o.files[0], o.files[0].name, o.title); return true; }
        const SH = cap('Share'); if (SH) { await SH.share({ title: o.title, text: o.text, url: o.url, dialogTitle: o.title }); return true; }
      } catch (e) { if (e && /cancel/i.test(String(e.message || e))) return false; S.toast('تعذّرت المشاركة', 'err'); return false; }
    }
    try {
      if (navigator.share) {
        const data = { title: o.title, text: o.text, url: o.url };
        if (o.files && navigator.canShare && navigator.canShare({ files: o.files })) data.files = o.files;
        await navigator.share(data); return true;
      }
    } catch (e) { if (e && e.name === 'AbortError') return false; }
    if (o.files && o.files[0]) { S.download(o.files[0], o.files[0].name); S.toast('تم حفظ الملف على جهازك (المشاركة المباشرة غير متاحة)', 'ok'); return true; }
    await S.copy([o.title, o.text, o.url].filter(Boolean).join('\n')); return true;
  };
  S.readFile = (file, as) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); as === 'text' ? r.readAsText(file) : as === 'dataurl' ? r.readAsDataURL(file) : r.readAsArrayBuffer(file); });
  S.sha256 = async function (str) {
    try { if (crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); } } catch (e) { /* غير آمن */ }
    let h1 = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619); } return 'fnv' + (h1 >>> 0).toString(16);
  };
  S.vibrate = (ms) => { if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* */ } };
  let actx;
  S.beep = function (freq, ms, vol) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(vol || 0.15, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (ms || 80) / 1000);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (ms || 80) / 1000 + 0.02);
    } catch (e) { /* */ }
  };

  /* ---------- الغلاف المولَّد ---------- */
  /* غلاف «مخطوطة» بحسب العنوان فقط (ليس غلافاً حقيقياً للكتاب). المحرّك في cover-art.js؛ هنا لون ثابت لكل كتاب من معرّفه. */
  S.coverPal = function (b) {
    const C = window.SIRAJ_COVER; const dark = C ? C.PALETTES.slice(0, 7) : [{ id: 'lapis', bg: '#1F3A6B' }];
    let hsh = 0; for (const c of String(b.id)) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    const p = dark[hsh % dark.length];
    return { id: p.id, bg: p.bg, c1: C ? C.mix(p.bg, '#ffffff', 0.1) : p.bg, c2: C ? C.mix(p.bg, '#000000', 0.2) : p.bg };
  };
  S.coverSvg = function (b) {
    const C = window.SIRAJ_COVER; const p = S.coverPal(b);
    const svg = C ? C.svg({ title: b.title || 'كتاب', author: String(b.author || '').replace(/\(.*?\)/g, '').trim(), color: p.id })
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 428"><rect width="300" height="428" fill="' + p.bg + '"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  /* ---------- الإشعارات المنبثقة (Toast) ---------- */
  S.toast = function (msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    /* نفس الرسالة ما زالت ظاهرة (نقرات متكررة): لا نكدّسها، بل نُبقي الموجودة */
    for (const el of box.children) if (el.dataset.msg === String(msg) && !el.dataset.gone) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; return; }
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.dataset.msg = String(msg);
    t.innerHTML = `<span>${esc(msg)}</span>`; box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.dataset.gone = '1'; t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, kind === 'err' ? 5200 : 2600);
  };

  /* ---------- النوافذ (مع دعم زر الرجوع في أندرويد) ---------- */
  const modals = []; let ignorePop = 0;
  function closeModal(m, val, fromPop) {
    if (m.closed) return; m.closed = true; m.el.remove();
    const i = modals.indexOf(m); if (i >= 0) modals.splice(i, 1);
    if (!modals.length) { const r = document.getElementById('overlay-root'); if (r) r.style.pointerEvents = ''; }
    if (m.opts.onClose) try { m.opts.onClose(val); } catch (e) { /* */ }
    if (!fromPop && !m.skipBack) {
      /* لا نُكمل وعد النافذة قبل أن يستقر history.back()، وإلا ألغى رجوعُها أي تنقّل يجريه المستدعي بعد الإغلاق مباشرة */
      ignorePop++; let fin = false; const done = () => { if (!fin) { fin = true; m.resolve(val); } };
      try { window.addEventListener('popstate', done, { once: true }); history.back(); setTimeout(done, 300); } catch (e) { ignorePop--; done(); }
    } else m.resolve(val);
  }
  S.hasModal = () => modals.length > 0;
  S.closeAllModals = () => { modals.slice().forEach((m) => { m.skipBack = true; closeModal(m); }); };
  window.addEventListener('popstate', () => {
    if (ignorePop > 0) { ignorePop--; return; }
    const m = modals[modals.length - 1]; if (m) closeModal(m, undefined, true);
  });
  S.modal = function (opts) {
    return new Promise((resolve) => {
      const root = document.getElementById('overlay-root');
      const back = document.createElement('div'); back.className = 'modal-back';
      const box = document.createElement('div'); box.className = 'modal' + (opts.center ? ' center-m' : '');
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      const acts = (opts.actions || []).map((a, i) => `<button class="btn ${esc(a.cls || '')}" data-mi="${i}">${esc(a.label)}</button>`).join('');
      box.innerHTML = `<div class="grab"></div>${opts.title ? `<div class="modal-hd"><h3>${esc(opts.title)}</h3><button class="iconbtn" data-mclose aria-label="إغلاق">${S.icon('close')}</button></div>` : ''}<div class="modal-body">${part(opts.body || '')}</div>${acts ? `<div class="modal-ft">${acts}</div>` : ''}`;
      back.appendChild(box); root.appendChild(back); root.style.pointerEvents = 'auto';
      const m = { el: back, opts, resolve, closed: false };
      modals.push(m);
      try { history.pushState({ sirajModal: 1 }, '', location.href); } catch (e) { m.skipBack = true; }
      back.addEventListener('click', (ev) => {
        if (ev.target === back && !opts.persistent) closeModal(m);
        else if (ev.target.closest('[data-mclose]')) closeModal(m);
        else {
          const b = ev.target.closest('[data-mi]');
          if (b) {
            const a = opts.actions[+b.dataset.mi];
            Promise.resolve(a.onClick ? a.onClick(box, m) : undefined).then((r) => { if (r === false) return; closeModal(m, a.value !== undefined ? a.value : true); }).catch((e) => S.fail(e));
          }
        }
      });
      m.close = (v) => closeModal(m, v); m.box = box;
      if (opts.onMount) { try { opts.onMount(box, m); } catch (e) { S.fail(e); } }
      const fi = box.querySelector('input,textarea,select'); if (fi && opts.autofocus !== false && !opts.noFocus) setTimeout(() => { try { fi.focus(); } catch (e) { /* */ } }, 60);
    });
  };
  S.sheet = (title, body, onMount) => S.modal({ title, body, onMount });
  S.confirm = (msg, o) => { o = o || {}; return S.modal({ title: o.title || 'تأكيد', body: S.h`<p>${msg}</p>`, center: true, actions: [{ label: o.no || 'إلغاء', value: false, cls: 'ghost' }, { label: o.yes || 'تأكيد', value: true, cls: o.danger ? 'danger' : 'primary' }] }).then((v) => v === true); };
  S.alert = (title, body) => S.modal({ title, body, center: true, actions: [{ label: 'حسناً', cls: 'primary', value: true }] });
  S.prompt = function (title, o) {
    o = o || {}; let val = null;
    return S.modal({
      title, center: true,
      body: S.h`<div class="field">${o.label ? S.h`<label>${o.label}</label>` : ''}${o.multiline ? S.h`<textarea class="textarea" name="v" rows="4" placeholder="${o.placeholder || ''}">${o.value || ''}</textarea>` : S.h`<input class="input" name="v" type="${o.type || 'text'}" value="${o.value || ''}" placeholder="${o.placeholder || ''}">`}${o.hint ? S.h`<span class="hint">${o.hint}</span>` : ''}</div>`,
      actions: [{ label: 'إلغاء', cls: 'ghost', value: '__cancel' }, { label: o.ok || 'حفظ', cls: 'primary', value: '__ok', onClick: (box) => { val = box.querySelector('[name=v]').value; return true; } }]
    }).then((v) => (v === '__ok' ? val : null));
  };

  /* ---------- بناء الحقول وقراءة النماذج ---------- */
  const f = (S.f = {});
  const attr = (o) => Object.keys(o || {}).filter((k) => o[k] !== undefined && o[k] !== false && o[k] !== null).map((k) => (o[k] === true ? k : `${k}="${esc(o[k])}"`)).join(' ');
  f.text = (name, label, value, o) => { o = o || {}; return S.h`<div class="field">${label ? S.h`<label for="f_${name}">${label}${o.required ? S.raw(' <span class="bad">*</span>') : ''}</label>` : ''}<input class="input ${o.ltr ? 'ltr' : ''}" id="f_${name}" name="${name}" type="${o.type || 'text'}" value="${value == null ? '' : value}" ${S.raw(attr({ placeholder: o.placeholder, required: o.required, min: o.min, max: o.max, step: o.step, inputmode: o.inputmode, maxlength: o.maxlength, dir: o.dir }))}>${o.hint ? S.h`<span class="hint">${o.hint}</span>` : ''}</div>`; };
  f.area = (name, label, value, o) => { o = o || {}; return S.h`<div class="field">${label ? S.h`<label for="f_${name}">${label}${o.required ? S.raw(' <span class="bad">*</span>') : ''}</label>` : ''}<textarea class="textarea ${o.ltr ? 'ltr' : ''}" id="f_${name}" name="${name}" rows="${o.rows || 4}" ${S.raw(attr({ placeholder: o.placeholder, required: o.required }))}>${value == null ? '' : value}</textarea>${o.hint ? S.h`<span class="hint">${o.hint}</span>` : ''}</div>`; };
  f.select = (name, label, options, value, o) => { o = o || {}; return S.h`<div class="field">${label ? S.h`<label for="f_${name}">${label}</label>` : ''}<select class="select" id="f_${name}" name="${name}" ${S.raw(attr({ 'data-chg': o.chg, 'data-k': o.k, 'data-num': o.num }))}>${options.map((x) => S.h`<option value="${x.v}" ${String(x.v) === String(value) ? S.raw('selected') : ''}>${x.t}</option>`)}</select>${o.hint ? S.h`<span class="hint">${o.hint}</span>` : ''}</div>`; };
  f.check = (name, label, checked) => S.h`<label class="check"><input type="checkbox" name="${name}" ${checked ? S.raw('checked') : ''}><span>${label}</span></label>`;
  /* حقل ملف بزرّ واضح واسم الملف في سطر مستقل (بدل عنصر المتصفح الأصلي الذي يتداخل نصّه في الشاشات الضيقة) */
  f.file = (name, label, accept, hint) => S.h`<div class="field"><label>${label}</label><div class="filebox"><label class="btn block filebtn">${S.icon('upload')} <span>اختيار ملف</span><input class="sr-file" type="file" name="${name}" accept="${accept || ''}"></label><div class="fname" aria-live="polite">لم يُختر ملف بعد</div>${hint ? S.h`<span class="hint">${hint}</span>` : ''}</div></div>`;
  document.addEventListener('change', (e) => { const i = e.target; if (!(i && i.matches && i.matches('.filebox input[type=file]'))) return; const n = i.closest('.filebox').querySelector('.fname'); if (n) n.textContent = i.files && i.files[0] ? i.files[0].name : 'لم يُختر ملف بعد'; });
  f.read = function (root) {
    const out = {};
    S.$$('[name]', root).forEach((el) => {
      const n = el.name;
      if (el.type === 'checkbox') out[n] = el.checked;
      else if (el.type === 'file') out[n] = el.files && el.files[0] ? el.files[0] : null;
      else if (el.type === 'radio') { if (el.checked) out[n] = el.value; }
      else if (el.type === 'number') out[n] = el.value === '' ? null : Number(el.value);
      else out[n] = el.value;
    });
    return out;
  };

  /* ---------- تحميل البيانات المضمّنة ---------- */
  S.loadData = function () {
    const D = window.SIRAJ_DATA || {};
    if (!D.sample || !D.quran || !D.duas) throw new Error('ملفات البيانات غير محمّلة (assets/data/*.js)');
    S.data = D; S.data.sample = D.sample; S.data.quran = D.quran; S.data.duas = D.duas;
    S.sections = D.sample.sections; S.sectionById = Object.fromEntries(D.sample.sections.map((s) => [s.id, s]));
  };

  /* ---------- مكوّنات عرض مشتركة ---------- */
  S.ui = {
    empty: (icon, title, sub, btn) => S.h`<div class="empty">${S.icon(icon || 'info')}<div><b>${title}</b></div>${sub ? S.h`<p class="small">${sub}</p>` : ''}${btn || ''}</div>`,
    notice: (kind, title, body) => S.h`<div class="notice ${kind}">${S.icon(kind === 'err' ? 'alert' : kind === 'ok' ? 'check-circle' : kind === 'warn' ? 'alert' : 'info')}<div>${title ? S.h`<b>${title}</b>` : ''}${body}</div></div>`,
    badge: (txt, kind) => S.h`<span class="badge ${kind || ''}">${txt}</span>`,
    ring(pct, label) { const r = 38, c = 2 * Math.PI * r; return S.h`<div class="ring-wrap"><svg viewBox="0 0 90 90"><circle class="trk" cx="45" cy="45" r="${r}"/><circle class="prg" cx="45" cy="45" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - S.clamp(pct, 0, 100) / 100)}"/></svg><b>${label != null ? label : S.n(Math.round(pct)) + '%'}</b></div>`; },
    /* فاصل مزخرف: خط – معيّن – خط */
    ornament: () => S.raw('<svg class="mk-orn" viewBox="0 0 210 14" aria-hidden="true"><path d="M0 7h88M122 7h88" stroke="currentColor" stroke-width="1" fill="none"/><path d="M105 1l6 6-6 6-6-6z" fill="currentColor"/><circle cx="92" cy="7" r="1.6" fill="currentColor"/><circle cx="118" cy="7" r="1.6" fill="currentColor"/></svg>'),
    sectionTitle: (t, link, label) => S.h`<div class="sec-title"><span>${t}</span>${link ? S.h`<a class="small" href="${link}">${label || 'عرض الكل'}</a>` : ''}</div>`,
    li: (o) => S.h`<${S.raw(o.href ? 'a' : 'button')} class="li" ${S.raw(o.href ? `href="${esc(o.href)}"` : `data-act="${esc(o.act || '')}"${o.attrs ? ' ' + o.attrs : ''}`)}>${o.icon ? S.h`<span class="li-ico">${S.icon(o.icon)}</span>` : ''}<span class="li-body"><span class="li-t">${o.t}</span>${o.s ? S.h`<span class="li-s">${o.s}</span>` : ''}</span><span class="li-end">${o.end || ''}${S.icon('chevron-left', 'rtl-flip-no')}</span></${S.raw(o.href ? 'a' : 'button')}>`
  };

  S.init = function () {
    injectSprite(); wireEvents(); S.applySettings();
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.settings.theme === 'auto') S.applySettings(); }); } catch (e) { /* */ } }
  };
  window.addEventListener('error', (e) => { S.log('error', e.message, (e.filename || '') + ':' + e.lineno); });
  window.addEventListener('unhandledrejection', (e) => { S.log('error', 'Promise: ' + ((e.reason && e.reason.message) || e.reason), e.reason && e.reason.stack); });
})();

/* =====================================================================
   سِراج — navigation.js : موجّه الصفحات (Hash Router) وشريط التطبيق والتنقل السفلي
   كل صفحة تعيد كائناً: { title, html, nav, back, bar, actions, mount(root), unmount(), noNav }
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const routes = []; const scrollMap = {}; let token = 0; let curView = null;
  const NAVS = [
    { key: 'home', label: 'الرئيسية', icon: 'home', href: '#/home' },
    { key: 'quran', label: 'القرآن', icon: 'book-open', href: '#/quran' },
    { key: 'library', label: 'المكتبة', icon: 'library', href: '#/library' },
    { key: 'tasbeeh', label: 'المسبحة', icon: 'beads', href: '#/tasbeeh' },
    { key: 'more', label: 'المزيد', icon: 'grid', href: '#/more' }
  ];
  function compile(pattern) {
    const keys = []; const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (m, k) => { keys.push(k); return '/([^/]+)'; }).replace(/\/\*$/, '/(.*)') + '/?$');
    return { re, keys };
  }
  function parse() {
    let h = location.hash.replace(/^#/, ''); if (!h || h === '/') h = '/home';
    const qi = h.indexOf('?'); const path = qi >= 0 ? h.slice(0, qi) : h; const q = {};
    if (qi >= 0) new URLSearchParams(h.slice(qi + 1)).forEach((v, k) => (q[k] = v));
    return { path: decodeURI(path), q };
  }
  const R = (S.router = {
    cur: { path: '/home', params: {}, q: {} },
    add(pattern, handler) { const c = compile(pattern); routes.push({ pattern, re: c.re, keys: c.keys, handler }); },
    go(path, o) { o = o || {}; const target = '#' + path; if (o.replace) location.replace(target); else location.hash = target; },
    replace(path) { location.replace('#' + path); },
    back(fallback) { const v = curView; const to = typeof (v && v.back) === 'string' ? v.back : fallback; if (to) R.go(to); else history.back(); },
    refresh() { return render(true); },
    async start() { window.addEventListener('hashchange', () => render()); if (!location.hash) location.replace('#/home'); await render(); }
  });
  function matchRoute(path) {
    for (const r of routes) { const m = r.re.exec(path); if (m) { const params = {}; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); if (r.pattern.endsWith('/*')) params.rest = m[m.length - 1]; return { r, params }; } }
    return null;
  }
  async function render(force) {
    const my = ++token; const { path, q } = parse(); const view = document.getElementById('view');
    if (curView && curView.path) scrollMap[curView.path] = view.scrollTop;
    if (curView && curView.unmount) { try { curView.unmount(); } catch (e) { S.log('warn', 'unmount: ' + e.message); } }
    S.closeAllModals && S.closeAllModals();
    const found = matchRoute(path);
    R.cur = { path, params: found ? found.params : {}, q };
    let v;
    try {
      v = found ? await found.r.handler(found.params, q) : { title: 'غير موجود', back: '/home', html: S.ui.empty('alert', 'الصفحة غير موجودة', 'المسار: ' + path, S.h`<a class="btn primary" href="#/home">العودة للرئيسية</a>`) };
    } catch (e) {
      S.log('error', 'فشل عرض ' + path + ': ' + e.message, e.stack);
      v = { title: 'خطأ', back: '/home', html: S.ui.empty('alert', 'تعذّر عرض الصفحة', e.message, S.h`<a class="btn primary" href="#/home">الرئيسية</a>`) };
    }
    if (my !== token) return; // وصل طلب أحدث
    v = v || {}; v.path = path; curView = v;
    applyBar(v); applyNav(v);
    S.mount(view, v.html || '');
    view.classList.toggle('nonav', !!v.noNav);
    document.body.classList.toggle('hide-nav', !!v.noNav);
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
    view.scrollTop = q.keep || force === true ? view.scrollTop : (scrollMap[path] || 0);
    document.title = (v.title ? v.title + ' — ' : '') + 'سِراج';
    S.hydrateCovers && S.hydrateCovers(view);
    S.updateBell && S.updateBell();
    if (v.mount) { try { await v.mount(view); } catch (e) { S.fail(e); } }
  }
  function applyBar(v) {
    const bar = document.getElementById('appbar'); const show = v.bar !== false;
    bar.hidden = !show; if (!show) return;
    const back = document.getElementById('ab-back');
    back.hidden = v.back === false || v.back == null;
    document.getElementById('ab-title').textContent = v.title || 'سِراج';
    const acts = document.getElementById('ab-actions');
    S.mount(acts, (v.actions || []).map((a) => a.href ? S.h`<a class="iconbtn" href="${a.href}" aria-label="${a.label}" title="${a.label}">${S.icon(a.icon)}</a>` : S.h`<button class="iconbtn" data-act="${a.act}" ${S.raw(a.attrs || '')} aria-label="${a.label}" title="${a.label}">${S.icon(a.icon)}</button>`));
  }
  function applyNav(v) { S.$$('#bottomnav .nb').forEach((b) => b.classList.toggle('active', b.dataset.nav === v.nav)); }
  S.buildNav = function () {
    S.mount(document.getElementById('bottomnav'), NAVS.map((n) => S.h`<a class="nb" data-nav="${n.key}" href="${n.href}">${S.icon(n.icon)}<span>${n.label}</span></a>`));
  };
  S.act('back', () => R.back());
  S.setTitle = (t) => { const el = document.getElementById('ab-title'); if (el) el.textContent = t; document.title = t + ' — سِراج'; };

  /* تحديث شارة الإشعارات */
  S.updateBell = async function () {
    try { const n = await S.notify.unread(); S.$$('[data-bell]').forEach((b) => { b.textContent = n ? S.n(n > 9 ? '9+' : n) : ''; b.hidden = !n; }); } catch (e) { /* */ }
  };

  /* مؤقّت ثانية واحدة للعدّ التنازلي والتنبيهات */
  const ticks = [];
  S.onTick = (fn) => ticks.push(fn);
  setInterval(() => { if (document.hidden) return; const now = new Date(); ticks.forEach((f) => { try { f(now); } catch (e) { /* */ } }); }, 1000);
})();

/* =====================================================================
   سِراج — app.js : الإقلاع، زرع البيانات التجريبية، تسجيل Service Worker
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  S.online = navigator.onLine;
  S.installEvent = null;

  async function hashPin(pin, salt) { return S.sha256(salt + ':' + pin); }

  const CATALOG_V = 3; /* ارفعه عند توسيع الكتالوج المضمَّن ليصل التحديث إلى من ثبّت نسخة أقدم */
  async function seed() {
    const D = S.data.sample; const done = S.kv.get('seed.v', 0);
    if (done >= 1 && done < CATALOG_V) {
      /* تحديث الكتالوج دون المساس بما عدّله المحرر: يُضاف الناقص فقط، وتُنقل الكتب التجريبية غير المعدَّلة إلى القسم الأدق */
      const have = new Map((await S.db.all('books')).map((b) => [b.id, b]));
      const addB = [], mv = [];
      for (const b of D.books) {
        const o = have.get(b.id);
        if (!o) addB.push(Object.assign({}, b));
        else if (o.demo && (o.section !== b.section || o.subcat !== b.subcat)) mv.push(Object.assign({}, o, { section: b.section, subcat: b.subcat }));
      }
      if (addB.length) await S.db.putMany('books', addB);
      if (mv.length) await S.db.putMany('books', mv);
      const haveA = new Set((await S.db.all('authors')).map((a) => a.id)); const addA = D.authors.filter((a) => !haveA.has(a.id));
      if (addA.length) await S.db.putMany('authors', addA);
      const haveS = new Set((await S.db.all('sources')).map((x) => x.id)); const addS = D.sources.filter((x) => !haveS.has(x.id));
      if (addS.length) await S.db.putMany('sources', addS);
      await S.kv.set('seed.v', CATALOG_V);
    }
    if (done < 1) {
      await S.db.putMany('books', D.books.map((b) => Object.assign({}, b)));
      await S.db.putMany('authors', D.authors);
      await S.db.putMany('sources', D.sources);
      const users = [];
      for (const u of D.users) { const salt = S.uid('s'); users.push({ id: u.id, name: u.name, username: u.username, role: u.role, salt, hash: await hashPin(u.pin, salt), grants: [], active: true, demo: true }); }
      await S.db.putMany('users', users);
      await S.notify.add({ title: 'أهلاً بك في سِراج', body: 'هذه نسخة HTML تجريبية. بياناتك تُحفظ في هذا المتصفح فقط ولا تُرفع إلى أي خادم.', kind: 'info' });
      await S.kv.set('seed.v', CATALOG_V);
    }
    // فهرس الأدعية: يُضاف الناقص فقط دون المساس بتعديلات المستخدم
    const have = new Set((await S.db.all('duas')).map((d) => d.id)); const add = S.data.duas.items.filter((d) => !have.has(d.id));
    if (add.length) await S.db.putMany('duas', add);
    if (!S.kv.get('settings.owner')) await S.kv.set('settings.owner', { requireOwnerApproval: true, maxCoverMB: 5 });
  }
  S.resetDemo = async function () {
    for (const st of ['books', 'authors', 'sources', 'duas', 'entries', 'users', 'notifications', 'audit', 'files']) await S.db.clear(st);
    await S.kv.set('seed.v', 0); await seed(); if (S.library) await S.library.init();
  };

  function registerSW() {
    if (S.isNative) { S.swState = 'native'; return; } /* الملفات مضمّنة داخل التطبيق: لا حاجة لـ Service Worker */
    const ok = 'serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
    S.swState = ok ? 'registering' : (S.isFile ? 'file' : 'insecure');
    if (!ok) return;
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      S.sw = reg; S.swState = 'ready';
      reg.addEventListener('updatefound', () => { const nw = reg.installing; if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) S.toast('يتوفر تحديث للتطبيق — أعد فتحه لتفعيله'); }); });
    }).catch((e) => { S.swState = 'failed'; S.log('warn', 'SW: ' + e.message); });
  }

  window.addEventListener('online', () => { S.online = true; S.toast('عاد الاتصال بالإنترنت', 'ok'); document.dispatchEvent(new CustomEvent('siraj:net')); });
  window.addEventListener('offline', () => { S.online = false; S.toast('أنت الآن دون اتصال — المحتوى المحمّل يعمل محلياً'); document.dispatchEvent(new CustomEvent('siraj:net')); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvent = e; });
  window.addEventListener('appinstalled', () => { S.installEvent = null; S.toast('تم تثبيت سِراج على جهازك', 'ok'); });

  S.act('install', async () => {
    if (S.installEvent) { S.installEvent.prompt(); await S.installEvent.userChoice; S.installEvent = null; }
    else S.alert('تثبيت التطبيق', S.h`<p>لتثبيت سِراج: افتح قائمة Chrome (⋮) ثم اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.</p><p class="small muted">يتطلب التثبيت فتح التطبيق عبر رابط HTTPS (انظر README). لا يعمل التثبيت عند فتح الملف مباشرة.</p>`);
  });

  /* زر الرجوع في أندرويد: نافذة مفتوحة ← تُغلق؛ صفحة داخلية ← الصفحة الأم أو الرئيسية؛ الرئيسية ← ضغطتان للخروج */
  function installBackButton() {
    if (!S.isNative) return;
    let tries = 0;
    const attach = () => {
      let A = null; try { A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; } catch (e) { /* */ }
      if (!A || !A.addListener) { if (++tries < 20) setTimeout(attach, 250); else S.log('warn', 'زر الرجوع: إضافة App غير متاحة'); return; }
      let last = 0;
      S.onBackButton = function () {
        if (S.hasModal && S.hasModal()) { history.back(); return 'modal'; }
        const path = (S.router && S.router.cur && S.router.cur.path) || '/home';
        if (path !== '/home' && path !== '/') { S.router.back('/home'); return 'back'; }
        const now = Date.now();
        if (now - last < 2200) { try { A.exitApp(); } catch (e) { /* */ } return 'exit'; }
        last = now; S.toast('اضغط رجوع مرة أخرى للخروج'); return 'hint';
      };
      A.addListener('backButton', () => { try { S.onBackButton(); } catch (e) { S.log('warn', 'backButton: ' + e.message); } });
    };
    attach();
  }

  async function boot() {
    try {
      S.loadData(); S.init(); S.buildNav();
      const ok = await S.db.open();
      await S.kv.load(); await S.fav.load(); await S.progress.load();
      await seed();
      if (S.library) await S.library.init();
      if (S.auth) await S.auth.restore();
      if (S.quran && S.quran.init) await S.quran.init();
      ['prayer', 'calendar', 'daily', 'worship'].forEach((m) => { try { if (S[m] && S[m].init) S[m].init(); } catch (e) { S.log('error', 'init ' + m + ': ' + e.message, e.stack); } });
      registerSW(); installBackButton();
      if (S.thaqalayn && S.thaqalayn.init) S.thaqalayn.init();
      S.db.persist();
      await S.router.start();
      if (!ok) S.toast('تعذّر استخدام التخزين الدائم — البيانات ستُفقد عند الإغلاق', 'err');
      S.updateBell();
    } catch (e) {
      S.log('error', 'فشل الإقلاع: ' + e.message, e.stack);
      const v = document.getElementById('view'); if (v) v.innerHTML = `<div class="empty"><b>تعذّر تشغيل التطبيق</b><p class="small">${S.esc ? S.esc(e.message) : e.message}</p></div>`;
    } finally {
      const sp = document.getElementById('splash'); if (sp) { sp.classList.add('gone'); setTimeout(() => sp.remove(), 450); }
      document.documentElement.dataset.ready = '1';
    }
  }
  S.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

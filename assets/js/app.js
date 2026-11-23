/* =====================================================================
   سِراج — app.js : الإقلاع، زرع البيانات التجريبية، تسجيل Service Worker
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  S.online = navigator.onLine;
  S.installEvent = null;

  async function hashPin(pin, salt) { return S.sha256(salt + ':' + pin); }

  async function seed() {
    const D = S.data.sample; const done = S.kv.get('seed.v', 0);
    if (done < 1) {
      await S.db.putMany('books', D.books.map((b) => Object.assign({}, b)));
      await S.db.putMany('authors', D.authors);
      await S.db.putMany('sources', D.sources);
      const users = [];
      for (const u of D.users) { const salt = S.uid('s'); users.push({ id: u.id, name: u.name, username: u.username, role: u.role, salt, hash: await hashPin(u.pin, salt), grants: [], active: true, demo: true }); }
      await S.db.putMany('users', users);
      await S.notify.add({ title: 'أهلاً بك في سِراج', body: 'هذه نسخة HTML تجريبية. بياناتك تُحفظ في هذا المتصفح فقط ولا تُرفع إلى أي خادم.', kind: 'info' });
      await S.kv.set('seed.v', 1);
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
      registerSW();
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

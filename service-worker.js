/* =====================================================================
   سِراج — service-worker.js
   - تخزين مسبق للقشرة (الواجهة) ليعمل التطبيق دون اتصال بعد أول زيارة عبر https/localhost.
   - لا يعمل من file:// (قيد المتصفح).
   - لا يعترض: الطلبات غير GET، طلبات Range (الصوت)، ومزوّدي البيانات (AlQuran.cloud، الصوتيات، archive.org، أي مزوّد ذكاء خارجي):
     هذه تتعامل معها الصفحة نفسها وتخزن نتائجها في IndexedDB.
   - الخطوط (Google Fonts): stale-while-revalidate في ذاكرة تشغيلية منفصلة.
   - يُعاد توليد قائمة PRECACHE والنسخة بواسطة: python3 tools/build_sw.py
   ===================================================================== */
/*__BEGIN_GENERATED__*/
const VERSION = 'da0787c7b6';
const PRECACHE = [
  './',
  './android-resources/adhan.mp3',
  './android-resources/java/AdhanBootReceiver.java',
  './android-resources/java/AdhanReceiver.java',
  './android-resources/java/AdhanService.java',
  './android-resources/java/AdhanStore.java',
  './android-resources/java/MainActivity.java',
  './android-resources/java/SirajAdhanPlugin.java',
  './assets/css/makhtuta.css',
  './assets/css/responsive.css',
  './assets/css/style.css',
  './assets/data/duas-data.js',
  './assets/data/duas-data.json',
  './assets/data/publisher-keys.js',
  './assets/data/quran-data.js',
  './assets/data/quran-data.json',
  './assets/data/sample-data.js',
  './assets/data/sample-data.json',
  './assets/images/apple-touch-icon.png',
  './assets/images/favicon-32.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/icon-maskable-512.png',
  './assets/images/icon-maskable.svg',
  './assets/images/icon.svg',
  './assets/images/logo-horizontal.svg',
  './assets/images/logo-mark.png',
  './assets/images/logo-mark.svg',
  './assets/images/logo-splash.png',
  './assets/images/logo-splash.svg',
  './assets/images/logo.png',
  './assets/js/app.js',
  './assets/js/assistant.js',
  './assets/js/calendar.js',
  './assets/js/cover-art.js',
  './assets/js/daily.js',
  './assets/js/duas.js',
  './assets/js/encyclopedia.js',
  './assets/js/home.js',
  './assets/js/library.js',
  './assets/js/native-notify.js',
  './assets/js/navigation.js',
  './assets/js/packcrypto.js',
  './assets/js/packs.js',
  './assets/js/prayer.js',
  './assets/js/quran-audio.js',
  './assets/js/quran-duas.js',
  './assets/js/quran.js',
  './assets/js/schema.js',
  './assets/js/settings.js',
  './assets/js/storage.js',
  './assets/js/tasbeeh.js',
  './assets/js/thaqalayn.js',
  './assets/js/tts.js',
  './assets/js/ui.js',
  './assets/js/worship.js',
  './index.html',
  './manifest.json',
  './offline.html'
];
/*__END_GENERATED__*/

const CORE = 'siraj-core-' + VERSION;
const RUNTIME = 'siraj-fonts-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    // نضيف كل ملف على حدة كي لا يُفشل ملفٌ واحد مفقود التثبيت كله
    await Promise.all(PRECACHE.map(async (u) => { try { const r = await fetch(new Request(u, { cache: 'reload' })); if (r.ok) await c.put(u, r); } catch (err) { /* يُكمَل */ } }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => (k.startsWith('siraj-core-') && k !== CORE)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); if (e.data === 'version' && e.ports[0]) e.ports[0].postMessage(VERSION); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== self.location.origin) return; // لا نعترض المزوّدين الآخرين

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CORE);
      try {
        const net = await fetch(req);
        return net;
      } catch (err) {
        return (await c.match('./index.html')) || (await c.match('./')) || (await c.match('./offline.html')) || new Response('دون اتصال', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }
  e.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const c = await caches.open(CORE);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const net = await fetch(req);
    if (net && net.ok && net.type === 'basic') c.put(req, net.clone());
    return net;
  } catch (err) {
    if (req.destination === 'document') return (await c.match('./offline.html')) || Response.error();
    return Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(RUNTIME);
  const hit = await c.match(req);
  const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); return; } }
    if (self.clients.openWindow) await self.clients.openWindow('./index.html');
  })());
});

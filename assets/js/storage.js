/* =====================================================================
   سِراج — storage.js : IndexedDB + LocalStorage
   كل ما يُحفظ هنا يبقى داخل متصفح هذا الجهاز فقط؛ لا يُرفع إلى أي خادم.
   إن تعذّر IndexedDB (وضع التصفح الخفي مثلاً) يعمل التطبيق بذاكرة مؤقتة مع تنبيه واضح.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const NAME = window.SIRAJ_DB_NAME || 'siraj-db', VER = 1; /* تطبيق التحكم يضبط اسماً مختلفاً */
  const STORES = {
    books: { kp: 'id', idx: ['status', 'section'] }, files: { kp: 'id' }, authors: { kp: 'id' }, publishers: { kp: 'id' },
    sources: { kp: 'id' }, quran: { kp: 'id' }, audio: { kp: 'id' }, audiolib: { kp: 'id' }, duas: { kp: 'id' },
    entries: { kp: 'id', idx: ['collection'] }, favorites: { kp: 'id', idx: ['type'] }, bookmarks: { kp: 'id', idx: ['type'] },
    progress: { kp: 'id' }, notes: { kp: 'id', idx: ['type', 'ref'] }, highlights: { kp: 'id', idx: ['bookId'] },
    tasbeeh: { kp: 'id', idx: ['date'] }, prayerlog: { kp: 'id', idx: ['date'] }, qada: { kp: 'id' }, stats: { kp: 'id' },
    users: { kp: 'id' }, notifications: { kp: 'id' }, audit: { kp: 'id' }, kv: { kp: 'k' }
  };
  S.STORES = Object.keys(STORES);
  let db = null; const mem = {};

  const DB = (S.db = {
    ok: false, mem: false, persisted: false, error: '',
    open() {
      return new Promise((resolve) => {
        const fallback = (why) => { DB.mem = true; DB.ok = false; DB.error = why || ''; Object.keys(STORES).forEach((s) => (mem[s] = new Map())); resolve(false); };
        if (!window.indexedDB) return fallback('IndexedDB غير مدعوم');
        let req; try { req = indexedDB.open(NAME, VER); } catch (e) { return fallback(e.message); }
        req.onupgradeneeded = () => {
          const d = req.result;
          Object.entries(STORES).forEach(([n, c]) => {
            if (d.objectStoreNames.contains(n)) return;
            const st = d.createObjectStore(n, { keyPath: c.kp });
            (c.idx || []).forEach((i) => st.createIndex(i, i, { unique: false }));
          });
        };
        req.onsuccess = () => { db = req.result; DB.ok = true; db.onversionchange = () => db.close(); resolve(true); };
        req.onerror = () => fallback((req.error && req.error.message) || 'فشل فتح قاعدة البيانات');
        req.onblocked = () => fallback('قاعدة البيانات محجوبة بتبويب آخر');
        setTimeout(() => { if (!db && !DB.mem) fallback('انتهت مهلة فتح قاعدة البيانات'); }, 6000);
      });
    },
    _tx(store, mode) { return db.transaction(store, mode).objectStore(store); },
    _p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); },
    async get(store, key) { if (DB.mem) return mem[store].get(key); return DB._p(DB._tx(store, 'readonly').get(key)); },
    async put(store, obj) {
      if (DB.mem) { mem[store].set(obj[STORES[store].kp], obj); return obj; }
      try { await DB._p(DB._tx(store, 'readwrite').put(obj)); } catch (e) {
        if (e && e.name === 'QuotaExceededError') throw new Error('مساحة التخزين في المتصفح ممتلئة. احذف ملفات أو كتباً ثم أعد المحاولة.');
        throw e;
      }
      return obj;
    },
    async putMany(store, arr) {
      if (DB.mem) { arr.forEach((o) => mem[store].set(o[STORES[store].kp], o)); return; }
      await new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); const st = t.objectStore(store); arr.forEach((o) => st.put(o)); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('أُلغيت العملية')); });
    },
    async del(store, key) { if (DB.mem) { mem[store].delete(key); return; } await DB._p(DB._tx(store, 'readwrite').delete(key)); },
    async all(store) { if (DB.mem) return Array.from(mem[store].values()); return DB._p(DB._tx(store, 'readonly').getAll()); },
    async where(store, index, val) {
      if (DB.mem) return Array.from(mem[store].values()).filter((o) => o[index] === val);
      return DB._p(DB._tx(store, 'readonly').index(index).getAll(IDBKeyRange.only(val)));
    },
    async clear(store) { if (DB.mem) { mem[store].clear(); return; } await DB._p(DB._tx(store, 'readwrite').clear()); },
    async count(store) { if (DB.mem) return mem[store].size; return DB._p(DB._tx(store, 'readonly').count()); },
    async estimate() { try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { /* */ } return null; },
    async persist() {
      try { if (navigator.storage && navigator.storage.persist) { DB.persisted = await navigator.storage.persisted() || await navigator.storage.persist(); } } catch (e) { /* */ }
      return DB.persisted;
    }
  });

  /* ---------- kv: مخزن مفتاح/قيمة بذاكرة مباشرة ---------- */
  const cache = {};
  S.kv = {
    async load() { (await DB.all('kv')).forEach((r) => (cache[r.k] = r.v)); },
    get(k, def) { return k in cache ? cache[k] : def; },
    set(k, v) { cache[k] = v; return DB.put('kv', { k, v }).catch((e) => S.fail(e)); },
    del(k) { delete cache[k]; return DB.del('kv', k); },
    all: () => Object.assign({}, cache)
  };

  /* ---------- مفضلة / علامات / تقدّم القراءة ---------- */
  const favSet = new Set(), progMap = new Map();
  S.fav = {
    async load() { (await DB.all('favorites')).forEach((f) => favSet.add(f.id)); },
    key: (t, r) => t + ':' + r,
    has: (t, r) => favSet.has(t + ':' + r),
    async toggle(t, r, meta) {
      const id = t + ':' + r;
      if (favSet.has(id)) { favSet.delete(id); await DB.del('favorites', id); return false; }
      favSet.add(id); await DB.put('favorites', Object.assign({ id, type: t, ref: r, ts: Date.now() }, meta || {})); return true;
    },
    async list(t) { return (await DB.where('favorites', 'type', t)).sort((a, b) => b.ts - a.ts); }
  };
  S.progress = {
    async load() { (await DB.all('progress')).forEach((p) => progMap.set(p.id, p)); },
    get: (t, r) => progMap.get(t + ':' + r) || null,
    async set(t, r, pos, extra) {
      const id = t + ':' + r; const rec = Object.assign({ id, type: t, ref: r }, progMap.get(id) || {}, { pos, ts: Date.now() }, extra || {});
      progMap.set(id, rec); await DB.put('progress', rec); return rec;
    },
    last(t) { let best = null; progMap.forEach((p) => { if (p.type === t && (!best || p.ts > best.ts)) best = p; }); return best; },
    all: () => Array.from(progMap.values())
  };
  S.bm = {
    async add(type, ref, label, extra) { const id = type + ':' + ref; const r = Object.assign({ id, type, ref, label, ts: Date.now() }, extra || {}); await DB.put('bookmarks', r); return r; },
    async remove(type, ref) { await DB.del('bookmarks', type + ':' + ref); },
    async has(type, ref) { return !!(await DB.get('bookmarks', type + ':' + ref)); },
    async list(type) { const a = type ? await DB.where('bookmarks', 'type', type) : await DB.all('bookmarks'); return a.sort((x, y) => y.ts - x.ts); }
  };
  S.stat = {
    async inc(key, by) { const r = (await DB.get('stats', key)) || { id: key, n: 0 }; r.n += by || 1; r.ts = Date.now(); await DB.put('stats', r); return r.n; },
    async get(key) { const r = await DB.get('stats', key); return r ? r.n : 0; },
    async all() { return DB.all('stats'); }
  };

  /* ---------- الإشعارات داخل التطبيق ---------- */
  S.notify = {
    async add(o) { const n = Object.assign({ id: S.uid('n'), ts: Date.now(), read: false, kind: 'info' }, o); await DB.put('notifications', n); S.updateBell && S.updateBell(); return n; },
    async list() { return (await DB.all('notifications')).sort((a, b) => b.ts - a.ts); },
    async unread() { return (await DB.all('notifications')).filter((n) => !n.read).length; },
    async markAll() { const a = await DB.all('notifications'); await DB.putMany('notifications', a.map((n) => Object.assign(n, { read: true }))); S.updateBell && S.updateBell(); },
    async clear() { await DB.clear('notifications'); S.updateBell && S.updateBell(); }
  };

  /* ---------- سجل العمليات المحلي (تحديثات المحتوى وما شابه) ---------- */
  S.audit = async function (action, target, details) {
    const rec = { id: S.uid('a'), ts: Date.now(), user: S.auditUser || 'هذا الجهاز', role: 'user', action, target: target || '', details: details || '' };
    try { await DB.put('audit', rec); } catch (e) { S.log('warn', 'تعذّر تسجيل العملية'); }
    return rec;
  };

  /* ---------- الملفات (PDF / أغلفة / مخطوطات) ---------- */
  S.files = {
    async put(id, blob, meta) { await DB.put('files', Object.assign({ id, blob, size: blob.size, type: blob.type, ts: Date.now() }, meta || {})); },
    async get(id) { return DB.get('files', id); },
    async del(id) { await DB.del('files', id); },
    async list() { return DB.all('files'); }
  };
  const coverUrls = new Map();
  S.coverUrl = async function (book) {
    if (!book || !book.hasCover) return null;
    if (coverUrls.has(book.id)) return coverUrls.get(book.id);
    const f = await S.files.get('cover:' + book.id); if (!f) return null;
    const u = URL.createObjectURL(f.blob); coverUrls.set(book.id, u); return u;
  };
  S.dropCoverUrl = (id) => { const u = coverUrls.get(id); if (u) URL.revokeObjectURL(u); coverUrls.delete(id); };
  S.hydrateCovers = async function (root) {
    const imgs = S.$$('img[data-cover]', root || document);
    for (const im of imgs) {
      const b = S.libraryIndex && S.libraryIndex.byId.get(im.dataset.cover);
      if (b && b.hasCover) { const u = await S.coverUrl(b); if (u && im.isConnected) im.src = u; }
    }
  };

  /* ---------- نسخ احتياطي / استعادة ----------
     النسخة تضم بيانات المستخدم الشخصية فقط (مفضلة، ملاحظات، تقدّم، مسبحة، قضاء…). لا تدخل فيها الكتب ولا الأدعية ولا المداخل:
     المحتوى يصل فقط عبر حزم موقّعة، فلا يجوز أن يكون ملف «نسخة احتياطية» قناةً لحقن محتوى غير موقّع. */
  const USER_STORES = ['favorites', 'bookmarks', 'progress', 'notes', 'highlights', 'tasbeeh', 'prayerlog', 'qada', 'stats'];
  const FILE_STORES = ['audio', 'audiolib']; /* تلاوات منزَّلة وأذان مخصص من المستخدم */
  const KV_RESERVED = /^(seed\.v|packs\.|thaqalaynImport|quranDuas|settings\.owner|auth\.|ailib\.)/;
  const b2b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const b64tob = async (u) => (await fetch(u)).blob();
  S.backup = {
    USER_STORES,
    async export(opts) {
      opts = opts || {}; const out = { app: 'SIRAJ', kind: 'user-data', version: S.version, exportedAt: new Date().toISOString(), includeFiles: !!opts.includeFiles, stores: {}, kv: {}, settings: S.settings };
      const stores = USER_STORES.concat(opts.includeFiles ? FILE_STORES : []);
      for (const s of stores) {
        let rows = await DB.all(s);
        if (FILE_STORES.includes(s)) {
          const conv = [];
          for (const r of rows) { const c = Object.assign({}, r); if (c.blob) { c.blob = await b2b64(c.blob); c.__blob = true; } conv.push(c); }
          rows = conv;
        }
        out.stores[s] = rows;
      }
      const kv = S.kv.all(); Object.keys(kv).forEach((k) => { if (!KV_RESERVED.test(k)) out.kv[k] = kv[k]; });
      return new Blob([JSON.stringify(out)], { type: 'application/json' });
    },
    async import(text, opts) {
      opts = opts || {}; let data; try { data = JSON.parse(text); } catch (e) { throw new Error('الملف ليس JSON صالحاً'); }
      if (!data || data.app !== 'SIRAJ' || !data.stores) throw new Error('هذا ليس ملف نسخة احتياطية من سِراج');
      let n = 0; const allowed = USER_STORES.concat(FILE_STORES);
      for (const [s, rows] of Object.entries(data.stores)) {
        if (!allowed.includes(s) || !Array.isArray(rows)) continue; /* أي مخزن آخر (كتب/أدعية/مداخل…) يُتجاهل عمداً */
        const conv = [];
        for (const r of rows) { const c = Object.assign({}, r); if (c.__blob) { c.blob = await b64tob(c.blob); delete c.__blob; } conv.push(c); }
        if (opts.replace) await DB.clear(s);
        await DB.putMany(s, conv); n += conv.length;
      }
      if (data.kv && typeof data.kv === 'object') for (const [k, v] of Object.entries(data.kv)) { if (!KV_RESERVED.test(k)) { await S.kv.set(k, v); n++; } }
      if (data.settings && opts.settings) S.set(data.settings);
      return n;
    }
  };

  /* ---------- حالة التخزين للعرض ---------- */
  S.storageInfo = async function () {
    const est = await DB.estimate();
    return { idb: DB.ok, mem: DB.mem, persisted: DB.persisted, usage: est && est.usage, quota: est && est.quota, error: DB.error };
  };
})();

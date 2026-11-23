/* =====================================================================
   سِراج — thaqalayn.js : استيراد الأحاديث المضمَّنة وقت البناء (التطبيق الأصلي فقط)
   الملف assets/data/thaqalayn.json تنتجه scripts/fetch-thaqalayn.mjs في GitHub Actions من Thaqalayn API.
   لا يُكتب أي نص هنا. إن لم يوجد الملف (نسخة الويب أو فشل الجلب أثناء البناء) لا يحدث شيء ولا تظهر قوائم فارغة مضللة.
   المستورد يحمل status = «imported» (مستورد آلياً — لم يُراجَع) إلى أن يعتمده مراجع؛ والمدخل الذي عدّله محرّر لا يُستبدل.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const FILE = 'assets/data/thaqalayn.json';
  const str = (x) => (typeof x === 'string' ? x : '');

  function okItem(it) { return it && str(it.id) && str(it.book) && str(it.text).length >= 20 && str(it.number) && /^https:\/\//.test(str(it.url)); }

  const T = (S.thaqalayn = {
    last: null,
    /* يقرأ الملف المضمَّن ويستورده. force=true يتجاوز شرط «أصلي فقط» وبصمة التكرار (للاختبار/الاستعادة اليدوية) */
    async importBundled(force) {
      if (!S.isNative && !force) return { n: 0, reason: 'web' };
      let j;
      try { const r = await fetch(FILE, { cache: 'no-store' }); if (!r.ok) return { n: 0, reason: 'absent' }; j = await r.json(); } catch (e) { return { n: 0, reason: 'absent' }; }
      if (!j || j.version !== 1 || !Array.isArray(j.items)) { S.log('warn', 'thaqalayn.json: بنية غير متوقعة'); return { n: 0, reason: 'invalid' }; }
      const st = S.kv.get('thaqalaynImport');
      if (!force && st && st.stamp === j.stamp) return { n: st.n, nd: st.nd, cached: true };
      const at = (j.source && j.source.fetchedAt) || new Date().toISOString(); const base = Date.parse(at) || Date.now();
      const items = j.items.filter(okItem); const duas = (Array.isArray(j.duas) ? j.duas : []).filter(okItem);
      const have = new Map((await S.db.all('entries')).filter((e) => /^nth_/.test(e.id)).map((e) => [e.id, e]));
      const haveD = new Map((await S.db.all('duas')).filter((d) => /^nth_/.test(d.id)).map((d) => [d.id, d]));
      const ents = [], keep = new Set();
      items.forEach((it, i) => {
        const id = 'nth_' + it.id; if (S.packs && S.packs.isWithdrawn('entries', id)) return; keep.add(id); const cur = have.get(id); if (cur && cur.status !== 'imported') return; // اعتُمد أو عُدّل: لا نمسه
        ents.push({
          id, collection: 'narrations', title: it.book + ' — حديث ' + it.number + (it.chapter ? ' (' + it.chapter + ')' : ''), text: it.text, verses: [], tags: ['مستورد'],
          sources: [{ book: it.book, author: str(it.author), edition: '', volume: '', page: '', number: it.number, url: it.url }],
          isnads: [], variants: [], scholarRulings: [], positions: [], extra: { speaker: '' },
          status: 'imported', imported: { from: 'thaqalayn', at, site: (j.source && j.source.site) || '' }, demo: false, ts: base - i, by: 'استيراد آلي'
        });
      });
      const ds = [], keepD = new Set();
      duas.forEach((it, i) => {
        const id = 'nth_' + it.id; if (S.packs && S.packs.isWithdrawn('duas', id)) return; keepD.add(id); const cur = haveD.get(id); if (cur && !cur.bundled) return;
        ds.push({
          id, kind: 'dua', title: it.book + ' — ' + it.number, cat: /صحيفة/.test(it.book) ? 'sahifa' : 'books', commonSource: it.book, note: 'مستورد آلياً من Thaqalayn ولم يُراجَع في سِراج.',
          text: it.text, textSource: { book: it.book, author: str(it.author), edition: '', part: '', page: '', url: it.url }, textStatus: 'documented', audio: null, demo: false, bundled: true, imported: true, order: 2000 + i
        });
      });
      for (const [id, e] of have) if (!keep.has(id) && e.status === 'imported') await S.db.del('entries', id);
      for (const [id, d] of haveD) if (!keepD.has(id) && d.bundled) await S.db.del('duas', id);
      if (ents.length) await S.db.putMany('entries', ents);
      if (ds.length) await S.db.putMany('duas', ds);
      const n = items.length, nd = duas.length; await S.kv.set('thaqalaynImport', { stamp: j.stamp, n, nd, at: Date.now() });
      await S.audit('thaqalayn.import', String(j.stamp), n + ' narrations, ' + nd + ' duas');
      T.last = { n, nd, skipped: j.items.length - items.length };
      return { n, nd, written: ents.length + ds.length };
    },
    /* في الخلفية بعد ظهور الواجهة؛ لا يؤخر شاشة البدء. ثم يحدّث الصفحة الحالية إن كانت تعرض هذا المحتوى */
    init() {
      if (!S.isNative) return;
      setTimeout(() => {
        T.importBundled().then((r) => { if (r && !r.cached && (r.n || r.nd)) { const p = (S.router && S.router.cur && S.router.cur.path) || ''; if (/^\/(home|research|duas)/.test(p)) { try { S.router.refresh(); } catch (e) { /* */ } } } })
          .catch((e) => S.log('warn', 'thaqalayn: ' + e.message));
      }, 1200);
    }
  });
})();

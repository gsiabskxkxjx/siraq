/* =====================================================================
   سِراج — التحكم : keys.js — مفتاح التوقيع (يُولَّد هنا ولا يغادر الجهاز إلا مشفّراً بعبارة مرور)
   • المخزَّن في الجهاز هو المفتاح السري المشفّر (PBKDF2 600k + AES-GCM) مع المفتاح العام.
   • لا يُفكّ التشفير إلا بإدخال عبارة المرور، ويُقفل تلقائياً بعد 10 دقائق.
   • فقدان الجهاز دون نسخة احتياطية يعني فقدان القدرة على النشر بهذا المفتاح (تُنشأ مفاتيح جديدة وتُضاف لسِراج).
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const P = S.pcrypto;
  const REC = 'ctl.key', AUTOLOCK = 10 * 60 * 1000;
  let live = null, timer = null;
  const build = () => window.SIRAJ_BUILD || {};
  S.saveBlob = async function (blob, name, title) {
    if (S.isNative) { await S.nativeSave(blob, name, title); return 'share'; }
    S.download(blob, name); return 'download';
  };

  const K = (S.keys = {
    record: () => S.kv.get(REC, null),
    exists: () => !!K.record(),
    isUnlocked: () => !!live,
    id: () => (K.record() || {}).id || '',
    pub: () => (K.record() || {}).pub || null,
    lock() { live = null; clearTimeout(timer); },
    _arm() { clearTimeout(timer); timer = setTimeout(() => { live = null; S.log('info', 'قُفل المفتاح تلقائياً'); try { if (/^\/(key|publish|home)/.test(S.router.cur.path)) S.router.refresh(); } catch (e) { /* */ } }, AUTOLOCK); },
    async create(pass) {
      const g = await P.generate(); const sealed = await P.seal(g.private, pass, { pub: g.public, id: g.id, created: Date.now(), app: 'siraj-control-key' });
      await S.kv.set(REC, sealed); live = { priv: g.private, id: g.id }; K._arm(); await S.audit('key.create', g.id); return sealed;
    },
    async unlock(pass) {
      const rec = K.record(); if (!rec) throw new Error('لا يوجد مفتاح');
      const priv = await P.unseal(rec, pass);
      if (priv.x !== rec.pub.x || priv.y !== rec.pub.y) throw new Error('المفتاح المخزَّن لا يطابق مفتاحه العام (ملف تالف)');
      live = { priv, id: rec.id }; K._arm(); return true;
    },
    /* يطلب عبارة المرور إن كان المفتاح مقفلاً. true عند الجاهزية */
    async ensureUnlocked(why) {
      if (!K.exists()) { S.toast('أنشئ المفتاح أولاً من تبويب «المفتاح»', 'err'); return false; }
      if (live) { K._arm(); return true; }
      for (let i = 0; i < 3; i++) {
        const pass = await S.prompt('فتح المفتاح', { label: why || 'أدخل عبارة المرور لفتح مفتاح التوقيع', type: 'password', ok: 'فتح' });
        if (pass == null) return false;
        try { await K.unlock(pass); return true; } catch (e) { S.toast(e.message, 'err'); }
      }
      return false;
    },
    async sign(payloadStr) { if (!live) throw new Error('المفتاح مقفل'); K._arm(); return P.sign(payloadStr, live.priv, live.id); },
    snippet() { const r = K.record(); return JSON.stringify({ name: 'الناشر', id: r.id, jwk: r.pub }, null, 2); },
    exportBlob() { return new Blob([JSON.stringify(K.record())], { type: 'application/json' }); },
    async importText(text, pass) {
      let rec; try { rec = JSON.parse(text); } catch (e) { throw new Error('الملف ليس مفتاحاً صالحاً'); }
      if (!rec || rec.app !== 'siraj-control-key' || !P.validPub(rec.pub) || !rec.ct) throw new Error('هذا ليس ملف مفتاح من تطبيق التحكم');
      if ((await P.keyId(rec.pub)) !== rec.id) throw new Error('معرّف المفتاح لا يطابق مفتاحه العام');
      const priv = await P.unseal(rec, pass); if (priv.x !== rec.pub.x || priv.y !== rec.pub.y) throw new Error('المفتاح السري لا يطابق العام');
      await S.kv.set(REC, rec); live = { priv, id: rec.id }; K._arm(); await S.audit('key.import', rec.id); return rec;
    },
    async remove() { const id = K.id(); K.lock(); await S.kv.del(REC); await S.audit('key.delete', id); }
  });

  /* ---------------- شاشة المفتاح ---------------- */
  const ghEdit = () => { const b = build(); return b.repo ? 'https://github.com/' + b.repo + '/edit/' + (b.branch || 'main') + '/assets/data/publisher-keys.js' : ''; };
  S.router.add('/key', () => {
    const r = K.record(); const gh = ghEdit();
    if (!r) return {
      title: 'مفتاح النشر', nav: 'key', back: false,
      html: S.h`<div class="stack">
        ${S.ui.notice('info', 'ما هو مفتاح النشر؟', 'زوج مفاتيح رقمي يُولَّد على هذا الهاتف. المفتاح السري يوقّع به التطبيق كل حزمة محتوى، والمفتاح العام تضعه في سِراج ليتأكد أن الحزمة منك أنت. لا أحد غيرك يستطيع إصدار محتوى يقبله سِراج.')}
        <div class="card"><div class="card-t">${S.icon('key')} إنشاء مفتاح جديد</div>
          ${S.f.text('kp1', 'عبارة المرور (8 أحرف فأكثر)', '', { type: 'password' })}${S.f.text('kp2', 'أعد كتابتها', '', { type: 'password' })}
          ${S.ui.notice('warn', 'احفظ عبارة المرور', 'لا يمكن استرجاعها. من يملك الملف المشفّر وعبارة المرور يستطيع النشر باسمك؛ ومن يفقد أحدهما يفقد القدرة على النشر بهذا المفتاح.')}
          <button class="btn primary block" data-act="keyCreate">${S.icon('key')} إنشاء المفتاح</button></div>
        <div class="card"><div class="card-t">${S.icon('upload')} لدي نسخة احتياطية</div>${S.f.file('kfile', 'ملف المفتاح المشفّر (.sirajkey)', '')}${S.f.text('kimpp', 'عبارة المرور', '', { type: 'password' })}<button class="btn block" data-act="keyImport">${S.icon('upload')} استعادة المفتاح</button></div></div>`
    };
    return {
      title: 'مفتاح النشر', nav: 'key', back: false,
      html: S.h`<div class="stack">
        <div class="card"><div class="row between"><b>بصمة المفتاح</b>${K.isUnlocked() ? S.ui.badge('مفتوح', 'ok') : S.ui.badge('مقفل', 'warn')}</div>
          <div class="fp tile-n">${r.id}</div><div class="tiny muted">أُنشئ ${S.fmt.dt(r.created)} • يُقفل تلقائياً بعد 10 دقائق</div>
          <div class="grid2 mt">${K.isUnlocked() ? S.h`<button class="btn" data-act="keyLock">${S.icon('lock')} قفل الآن</button>` : S.h`<button class="btn primary" data-act="keyUnlock">${S.icon('key')} فتح</button>`}<button class="btn" data-act="keyBackup">${S.icon('download')} نسخة احتياطية</button></div></div>
        <div class="card"><div class="card-t">${S.icon('shield')} المفتاح العام (لسِراج)</div>
          <p class="small muted nm">هذا الجزء علني وآمن للمشاركة. أضفه مرة واحدة إلى سِراج ليقبل حزمك: الصقه داخل القائمة في <span class="op-ltr">assets/data/publisher-keys.js</span> ثم أعد بناء سِراج.</p>
          <pre class="pre" id="keysnip">${K.snippet()}</pre>
          <div class="grid2 mt"><button class="btn" data-act="keyCopy">${S.icon('copy')} نسخ</button><button class="btn" data-act="keyShare">${S.icon('share')} مشاركة</button></div>
          ${gh ? S.h`<a class="btn gold block mt" target="_blank" rel="noopener noreferrer" href="${gh}">${S.icon('link')} فتح ملف المفاتيح في GitHub لتعديله</a>` : ''}
          <p class="tiny muted nm mt">بعد التحديث تظهر البصمة <b class="fp">${r.id}</b> في سِراج ← المزيد ← تحديثات المحتوى؛ طابقها للتأكد.</p></div>
        <div class="card"><div class="card-t">${S.icon('alert')} منطقة الخطر</div><p class="small muted nm">حذف المفتاح من هذا الهاتف لا يمكن التراجع عنه إلا بنسخة احتياطية.</p><button class="btn danger block mt" data-act="keyDelete">${S.icon('trash')} حذف المفتاح من هذا الهاتف</button></div></div>`
    };
  });
  S.act('keyCreate', async () => {
    const a = S.$('#f_kp1').value, b = S.$('#f_kp2').value;
    if (a.length < 8) return S.toast('عبارة المرور أقصر من 8 أحرف', 'err'); if (a !== b) return S.toast('العبارتان غير متطابقتين', 'err');
    S.toast('جارٍ توليد المفتاح…'); try { await K.create(a); } catch (e) { return S.toast(e.message, 'err'); }
    S.router.refresh();
    await S.alert('تم إنشاء المفتاح', S.h`<p>الخطوة التالية مهمة: اضغط «نسخة احتياطية» واحفظ الملف خارج الهاتف (درايف أو رسائل محفوظة)، ثم أضف المفتاح العام إلى سِراج.</p>`);
  });
  S.act('keyImport', async () => {
    const f = S.$('[name=kfile]').files[0], p = S.$('#f_kimpp').value; if (!f) return S.toast('اختر ملف المفتاح', 'err'); if (!p) return S.toast('أدخل عبارة المرور', 'err');
    try { await K.importText(await S.readFile(f, 'text'), p); S.toast('استُعيد المفتاح', 'ok'); S.router.refresh(); } catch (e) { S.toast(e.message, 'err'); }
  });
  S.act('keyUnlock', async () => { if (await K.ensureUnlocked()) { S.toast('فُتح المفتاح', 'ok'); S.router.refresh(); } });
  S.act('keyLock', () => { K.lock(); S.toast('قُفل المفتاح'); S.router.refresh(); });
  S.act('keyCopy', async () => { await S.copy(K.snippet()); S.toast('نُسخ المفتاح العام', 'ok'); });
  S.act('keyShare', () => S.share({ title: 'مفتاح سِراج العام', text: K.snippet() }));
  S.act('keyBackup', async () => {
    try { await S.saveBlob(K.exportBlob(), 'siraj-publisher-' + K.id() + '.sirajkey', 'نسخة احتياطية لمفتاح النشر'); S.toast('احفظ الملف في مكان آمن خارج الهاتف', 'ok'); } catch (e) { S.toast(e.message, 'err'); }
  });
  S.act('keyDelete', async () => {
    if (!(await S.confirm('سيُحذف مفتاح النشر من هذا الهاتف. بدون نسخة احتياطية لن تستطيع الإصدار بهذا المفتاح بعد اليوم. متابعة؟', { danger: true, yes: 'احذف' }))) return;
    await K.remove(); S.toast('حُذف المفتاح'); S.router.refresh();
  });
})();

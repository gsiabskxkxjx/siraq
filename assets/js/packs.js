/* =====================================================================
   سِراج — packs.js : «تحديثات المحتوى» — القناة الوحيدة لوصول محتوى جديد إلى التطبيق
   • الحزمة ملف .sirajpack موقّع (ECDSA P-256) بمفتاح الناشر من تطبيق «سِراج — التحكم».
   • لا يُقبل إلا ما وُقّع بأحد المفاتيح المضمّنة في assets/data/publisher-keys.js، وأي تعديل بايت واحد يُبطل التوقيع.
   • حتى الحزمة الموقّعة تمرّ على القواعد نفسها (schema.js): لا مدخل بلا مصدر، ولا نص دعاء بلا كتاب وموضع.
   • الحزمة لقطة كاملة لما ينشره الناشر: ما اختفى منها يُحذف، وما سُحب من المحتوى المضمّن يُخفى.
   • لا تمسّ الحزمة بيانات المستخدم (مفضلة، ملاحظات، تقدّم…) ولا تستبدل محتوى مضمّناً بنفس المعرّف.
   • منع الرجوع: لا تُقبل حزمة رقمها أقدم من المثبّتة من المفتاح نفسه.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const P = S.pcrypto; const SC = S.schema; const str = SC.str;
  const MAX_CHARS = 40 * 1048576;
  const LIM = { books: 6000, authors: 6000, duas: 6000, entries: 30000, notices: 30, withdraw: 20000 };
  const ID_RE = /^[A-Za-z0-9_.:-]{3,64}$/;
  const STORE = { books: 'books', authors: 'authors', duas: 'duas', entries: 'entries' };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const strs = (v, max) => arr(v).map((x) => str(x)).filter(Boolean).slice(0, max || 50);
  const numOrNull = (v) => (v === '' || v == null || !Number.isFinite(+v) ? null : +v);
  const REASON = {
    format: 'هذا ليس ملف حزمة سِراج صالحاً.', nokeys: 'لا يوجد مفتاح ناشر موثوق في هذا الإصدار من سِراج، فلا يمكن قبول أي حزمة. أضف المفتاح العام من تطبيق التحكم ثم أعد بناء التطبيق.',
    unknownKey: 'الحزمة موقّعة بمفتاح غير موثوق عند هذا التطبيق.', badSig: 'التوقيع غير صحيح: الملف عُدِّل بعد توقيعه أو لم يُوقَّع بمفتاح الناشر. لم يُقبل.',
    payload: 'محتوى الحزمة تالف أو غير مكتمل.', big: 'الملف أكبر من الحد المسموح.', crypto: 'تعذّر التحقق: المتصفح لا يوفّر التشفير المطلوب.'
  };
  const fail = (code, extra) => ({ ok: false, code, reason: REASON[code] + (extra ? ' ' + extra : '') });

  const state = () => S.kv.get('packs.state', null) || { keys: {}, history: [], withdrawn: {} };
  const T = (S.packs = {
    FORMAT: P.FORMAT,
    state,
    /* المفاتيح الموثوقة المضمّنة: يُحسب المعرّف من المفتاح نفسه لا من الحقل المكتوب */
    async trusted() {
      const out = [];
      for (const k of arr(window.SIRAJ_PUBLISHER_KEYS)) { if (k && P.validPub(k.jwk)) { try { out.push({ name: str(k.name) || 'الناشر', jwk: P.pub(k.jwk), id: await P.keyId(k.jwk) }); } catch (e) { /* */ } } }
      return out;
    },
    /* هل سحب الناشر هذا المعرّف من المحتوى المضمّن؟ (متزامنة: تُستعمل في الإقلاع قبل أي استيراد) */
    isWithdrawn(kind, id) { const w = state().withdrawn || {}; return Object.values(w).some((m) => (m[kind] || []).includes(id)); },

    /* ---------------- التحقق: يقرأ نص الملف ويعيد نتيجة دون أي كتابة ---------------- */
    async verify(text) {
      if (typeof text !== 'string' || text.length > MAX_CHARS) return fail('big');
      let env; try { env = JSON.parse(text); } catch (e) { return fail('format'); }
      if (!env || env.format !== P.FORMAT || env.alg !== P.ALG || typeof env.payload !== 'string' || typeof env.sig !== 'string') return fail('format');
      let keys; try { keys = await T.trusted(); } catch (e) { return fail('crypto'); }
      if (!keys.length) return fail('nokeys');
      const cand = keys.filter((k) => !env.keyId || k.id === env.keyId);
      if (!cand.length) return fail('unknownKey');
      let key = null;
      try { for (const k of cand) { if (await P.verify(env, k.jwk)) { key = k; break; } } } catch (e) { return fail('crypto'); }
      if (!key) return fail('badSig');
      let pl; try { pl = JSON.parse(env.payload); } catch (e) { return fail('payload'); }
      if (!pl || pl.v !== 1 || pl.app !== 'SIRAJ' || !ID_RE.test(str(pl.id)) || !Number.isInteger(pl.seq) || pl.seq < 1 || !Number.isFinite(Date.parse(pl.created))) return fail('payload');
      for (const k of Object.keys(LIM)) if (k !== 'withdraw' && pl[k] != null && (!Array.isArray(pl[k]) || pl[k].length > LIM[k])) return fail('payload', '(' + k + ')');
      const wd = pl.withdraw || {}; for (const k of ['books', 'duas', 'entries']) if (wd[k] != null && (!Array.isArray(wd[k]) || wd[k].length > LIM.withdraw)) return fail('payload', '(withdraw)');
      const counts = { books: arr(pl.books).length, authors: arr(pl.authors).length, duas: arr(pl.duas).length, entries: arr(pl.entries).length, withdraw: ['books', 'duas', 'entries'].reduce((n, k) => n + arr(wd[k]).length, 0), notices: arr(pl.notices).length };
      const st = state(); const prev = st.keys[key.id]; let note = '';
      if (prev && pl.seq < prev.seq) return { ok: false, code: 'older', reason: 'هذه الحزمة أقدم من المثبّتة (رقم ' + S.n(pl.seq) + ' مقابل ' + S.n(prev.seq) + '). لا يُسمح بالرجوع إلى نسخة أقدم.' };
      if (prev && pl.seq === prev.seq) { if (pl.id === prev.packId) note = 'same'; else return { ok: false, code: 'conflict', reason: 'رقم الحزمة مطابق لحزمة مثبّتة لكن معرّفها مختلف؛ لا تُقبل حزمتان بالرقم نفسه.' }; }
      return { ok: true, env, payload: pl, key, counts, same: note === 'same', fingerprint: (await P.sha(env.payload)).slice(0, 12) };
    },

    /* ---------------- التنظيف: لا يُنقل إلى القاعدة إلا الحقول المعروفة ---------------- */
    _book(x, ctx) {
      const b = { id: str(x.id), title: str(x.title), author: str(x.author), authorId: str(x.authorId), authorDeath: numOrNull(x.authorDeath), section: str(x.section), subcat: str(x.subcat), desc: str(x.desc), tags: strs(x.tags, 20),
        publisher: str(x.publisher), year: numOrNull(x.year), edition: str(x.edition), pages: numOrNull(x.pages), lang: str(x.lang) || 'العربية', sourceName: str(x.sourceName), sourceUrl: str(x.sourceUrl), digitalUrl: str(x.digitalUrl),
        copyright: str(x.copyright) || 'غير محدد', reviewStatus: 'وصل من الناشر عبر حزمة موقّعة', addedAt: str(x.addedAt) || ctx.createdIso, status: 'published', demo: false, hasPdf: false, hasCover: false, allowDownload: false, reads: 0, downloads: 0 };
      const er = [];
      if (!ID_RE.test(b.id)) er.push('معرّف كتاب غير صالح');
      er.push.apply(er, SC.validateBook(b));
      if (b.authorId && !ctx.authorIds.has(b.authorId)) er.push('مؤلف غير معرّف: ' + b.authorId); else if (!b.authorId) er.push('معرّف المؤلف مطلوب');
      return { rec: b, errs: er };
    },
    _author(x) {
      const a = { id: str(x.id), name: str(x.name), death: numOrNull(x.death), note: str(x.note) }; const er = [];
      if (!ID_RE.test(a.id)) er.push('معرّف مؤلف غير صالح'); er.push.apply(er, SC.validateAuthor(a)); return { rec: a, errs: er };
    },
    _dua(x, i) {
      const ts = x.textSource && typeof x.textSource === 'object' ? x.textSource : null; const text = str(x.text);
      const d = { id: str(x.id), kind: SC.DUA_KINDS.includes(x.kind) ? x.kind : 'dua', title: str(x.title), cat: str(x.cat), commonSource: str(x.commonSource), note: str(x.note), text: String(x.text == null ? '' : x.text).replace(/\r/g, '').trim(),
        textSource: text && ts ? { book: str(ts.book), author: str(ts.author), edition: str(ts.edition), part: str(ts.part), page: str(ts.page), url: str(ts.url) } : null, textStatus: text ? 'documented' : 'missing', audio: null, demo: false, bundled: false, order: 6000 + i };
      const er = []; if (!ID_RE.test(d.id)) er.push('معرّف دعاء غير صالح');
      if (!(S.data.duas.categories || []).some((c) => c.id === d.cat)) er.push('تصنيف أدعية غير معروف: ' + d.cat);
      er.push.apply(er, SC.validateDua(d)); if (text && !d.textSource) er.push('نص بلا مصدر'); return { rec: d, errs: er };
    },
    _entry(x, i, ctx) {
      const c = SC.COLS[str(x.collection)]; const ex = x.extra && typeof x.extra === 'object' ? x.extra : {}; const extra = {};
      if (c) (c.extra || []).forEach(([k, , t]) => { const v = ex[k]; if (v == null || v === '') extra[k] = ''; else extra[k] = t === 'number' || t === 'imam' ? (Number.isFinite(+v) ? +v : '') : str(v); });
      if (c && ex.topic != null && !(c.extra || []).some((e) => e[0] === 'topic')) extra.topic = str(ex.topic);
      const e = { id: str(x.id), collection: str(x.collection), title: str(x.title), text: String(x.text == null ? '' : x.text).replace(/\r/g, '').trim(), verses: strs(x.verses, 30).map((v) => (SC.parseVerse(v) || { str: v }).str), tags: strs(x.tags, 30),
        sources: arr(x.sources).slice(0, 30).map((s) => ({ book: str(s.book), author: str(s.author), edition: str(s.edition), volume: str(s.volume), page: str(s.page), number: str(s.number), url: str(s.url) })),
        isnads: strs(x.isnads, 30), variants: arr(x.variants).slice(0, 30).map((v) => ({ text: str(v.text), source: str(v.source) })), scholarRulings: arr(x.scholarRulings).slice(0, 30).map((r) => ({ scholar: str(r.scholar), ruling: str(r.ruling), source: str(r.source) })),
        positions: arr(x.positions).slice(0, 30).map((p) => ({ holder: str(p.holder), view: str(p.view), source: str(p.source) })), extra, status: 'documented', reviewed: null, demo: false, ts: ctx.createdMs - i, by: 'الناشر' };
      const er = []; if (!ID_RE.test(e.id)) er.push('معرّف مدخل غير صالح'); er.push.apply(er, SC.validateEntry(e)); return { rec: e, errs: er };
    },

    /* ---------------- التثبيت ---------------- */
    async apply(v) {
      if (!v || !v.ok) throw new Error('حزمة غير متحقَّق منها');
      const pl = v.payload, keyId = v.key.id, createdMs = Date.parse(pl.created), createdIso = new Date(createdMs).toISOString();
      const st = clone(state()); st.keys = st.keys || {}; st.history = st.history || []; st.withdrawn = st.withdrawn || {};
      const prev = st.keys[keyId];
      if (prev && (pl.seq < prev.seq || (pl.seq === prev.seq && pl.id !== prev.packId))) throw new Error('رقم الحزمة لا يسمح بالتثبيت');
      const have = {}; for (const k of Object.keys(STORE)) have[k] = new Map((await S.db.all(STORE[k])).map((r) => [r.id, r]));
      const mine = (k, id) => { const r = have[k].get(id); return r && r.pack && r.pack.key === keyId; };
      const ctx = { createdMs, createdIso, authorIds: new Set([...have.authors.keys()].concat(arr(pl.authors).map((a) => str(a && a.id)))) };
      const rejected = []; const out = { books: [], authors: [], duas: [], entries: [] }; const present = { books: new Set(), authors: new Set(), duas: new Set(), entries: new Set() };
      const stamp = { key: keyId, id: pl.id, seq: pl.seq };
      const take = (k, label, x, i, fn) => {
        const id = str(x && x.id); if (id) present[k].add(id);
        if (!x || typeof x !== 'object') { rejected.push(label + ' #' + (i + 1) + ': عنصر غير صالح'); return; }
        const { rec, errs } = fn(x, i);
        if (errs.length) { rejected.push(label + ' «' + (rec.title || rec.name || rec.id || '؟') + '»: ' + errs[0]); return; }
        const cur = have[k].get(rec.id);
        if (cur && !mine(k, rec.id)) { rejected.push(label + ' «' + (rec.title || rec.name) + '»: المعرّف مستعمل في محتوى مضمّن ولا يُستبدل'); return; }
        if (k === 'books' && cur) { rec.reads = cur.reads || 0; rec.downloads = cur.downloads || 0; }
        rec.pack = stamp; out[k].push(rec);
      };
      arr(pl.authors).forEach((x, i) => take('authors', 'مؤلف', x, i, (y) => T._author(y)));
      arr(pl.books).forEach((x, i) => take('books', 'كتاب', x, i, (y) => T._book(y, ctx)));
      arr(pl.duas).forEach((x, i) => take('duas', 'دعاء', x, i, (y, j) => T._dua(y, j)));
      arr(pl.entries).forEach((x, i) => take('entries', 'مدخل', x, i, (y, j) => T._entry(y, j, ctx)));
      /* لقطة كاملة: ما كان من هذا الناشر وغاب عن الحزمة الجديدة يُحذف (ما رُفض يُعدّ حاضراً فلا نخسر نسخته القديمة) */
      const stale = {}; let removed = 0;
      for (const k of Object.keys(STORE)) stale[k] = [...have[k].values()].filter((r) => r.pack && r.pack.key === keyId && !present[k].has(r.id));
      /* السحب: المحتوى المضمّن المُسحَب يُحذف ويُسجَّل حتى لا يعود عند الإقلاع */
      const wd = pl.withdraw || {}; const newW = { books: [...new Set(strs(wd.books, LIM.withdraw))], duas: [...new Set(strs(wd.duas, LIM.withdraw))], entries: [...new Set(strs(wd.entries, LIM.withdraw))] };
      const oldW = st.withdrawn[keyId] || { books: [], duas: [], entries: [] };
      if (out.books.length) await S.db.putMany('books', out.books); if (out.authors.length) await S.db.putMany('authors', out.authors);
      if (out.duas.length) await S.db.putMany('duas', out.duas); if (out.entries.length) await S.db.putMany('entries', out.entries);
      for (const k of Object.keys(STORE)) for (const r of stale[k]) { if (k === 'books') await S.library.remove(r.id); else await S.db.del(STORE[k], r.id); removed++; }
      for (const k of ['books', 'duas', 'entries']) for (const id of newW[k]) { if (have[k].has(id) && !mine(k, id) && !present[k].has(id)) { if (k === 'books') await S.library.remove(id); else await S.db.del(STORE[k], id); removed++; } }
      /* من رُفع سحبه يعود: الكتب والأدعية المضمّنة تُعاد من بيانات التطبيق، والمداخل بإعادة الاستيراد التلقائي عند الإقلاع */
      let restored = 0; const unW = (k) => oldW[k].filter((id) => !newW[k].includes(id));
      const bundledB = new Map((S.data.sample.books || []).map((b) => [b.id, b])), bundledD = new Map((S.data.duas.items || []).map((d) => [d.id, d]));
      for (const id of unW('books')) { const b = bundledB.get(id); if (b && !have.books.has(id)) { await S.db.put('books', Object.assign({}, b)); restored++; } }
      for (const id of unW('duas')) { const d = bundledD.get(id); if (d && !have.duas.has(id)) { await S.db.put('duas', Object.assign({}, d)); restored++; } }
      if (unW('entries').length && S.kv.get('thaqalaynImport') !== undefined) await S.kv.del('thaqalaynImport');
      st.withdrawn[keyId] = newW;
      /* إعلانات الناشر: تُضاف مرة واحدة لكل إعلان */
      let notices = 0;
      for (const n of arr(pl.notices).slice(0, LIM.notices)) {
        if (!n || !str(n.title)) continue; const nid = 'pk_' + keyId + '_' + str(n.id || str(n.title)).slice(0, 40);
        if (!(await S.db.get('notifications', nid))) { await S.db.put('notifications', { id: nid, ts: Date.now(), read: false, kind: 'info', title: str(n.title).slice(0, 120), body: str(n.body).slice(0, 600) }); notices++; }
      }
      /* صوت الأذان من الناشر (اختياري، ≤ 10 م.ب): يحلّ محل أي أذان سابق */
      let adhan = false;
      try {
        const a = pl.adhan; if (a && typeof a.data === 'string' && /^audio\//.test(str(a.mime)) && a.data.length <= 14000000 && /^[A-Za-z0-9+/=]+$/.test(a.data)) {
          const bin = atob(a.data); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          for (const o of (await S.db.all('audiolib')).filter((x) => x.kind === 'adhan')) await S.db.del('audiolib', o.id);
          await S.db.put('audiolib', { id: 'adhan_pack', kind: 'adhan', title: str(a.name).slice(0, 80) || 'أذان', blob: new Blob([u8], { type: str(a.mime) }), size: u8.length, source: 'الناشر (حزمة موقّعة)', ts: Date.now() }); adhan = true;
        }
      } catch (e) { /* ملف أذان تالف: يُتجاهل دون إفشال الحزمة */ }
      const written = { adhan, books: out.books.length, authors: out.authors.length, duas: out.duas.length, entries: out.entries.length };
      st.keys[keyId] = { seq: pl.seq, packId: pl.id, at: Date.now() };
      st.history.unshift({ at: Date.now(), packId: pl.id, seq: pl.seq, title: str(pl.title).slice(0, 120), key: keyId, written, removed, rejected: rejected.length, fingerprint: v.fingerprint });
      st.history = st.history.slice(0, 30);
      await S.kv.set('packs.state', st);
      await S.audit('pack.apply', pl.id, 'seq ' + pl.seq + ' ' + JSON.stringify(written) + ' removed ' + removed + ' rejected ' + rejected.length);
      if (S.library) await S.library.init();
      S.updateBell && S.updateBell();
      if (adhan && S.nativeNotify) S.nativeNotify.later(300); /* ملف الأذان الجديد يُنقل إلى منبّه النظام */
      return { written, removed, restored, rejected, notices };
    },
    async installedCounts() {
      const c = {}; for (const k of Object.keys(STORE)) c[k] = (await S.db.all(STORE[k])).filter((r) => r.pack).length; return c;
    }
  });

  /* ---------------- الواجهة ---------------- */
  let pending = null;
  const fmtCount = (c) => [c.books && S.n(c.books) + ' كتاب', c.authors && S.n(c.authors) + ' مؤلف', c.duas && S.n(c.duas) + ' دعاء/زيارة', c.entries && S.n(c.entries) + ' مدخل'].filter(Boolean).join(' • ') || 'لا شيء';
  S.router.add('/updates', async () => {
    const keys = await T.trusted(); const st = state(); const inst = await T.installedCounts();
    return {
      title: 'تحديثات المحتوى', nav: 'more', back: '/more',
      html: S.h`<div class="stack">
        ${S.ui.tip('info', 'كيف يصل المحتوى؟', 'الكتب والأدعية والمداخل الجديدة لا تُضاف من داخل التطبيق ولا من أي مستخدم. يصدر الناشر ملف تحديث موقّعاً رقمياً (.sirajpack) من تطبيق «سِراج — التحكم»، فتختاره هنا ويتحقق سِراج من التوقيع قبل أن يقبل منه شيئاً.')}
        <div class="card"><div class="card-t">${S.icon('shield')} الناشرون الموثوقون</div>
          ${keys.length ? keys.map((k) => S.h`<div class="kv"><span>${k.name}</span><b class="op-ltr">${k.id}</b></div>`) : S.ui.notice('warn', 'لا يوجد مفتاح ناشر في هذا الإصدار', 'لن يقبل التطبيق أي حزمة قبل أن يُضاف مفتاح الناشر العام إلى assets/data/publisher-keys.js ويُعاد البناء.')}
          <p class="tiny muted nm">هذه بصمات المفاتيح العامة المضمّنة في التطبيق. أي ملف لا يطابق توقيعه أحدها يُرفض.</p></div>
        <div class="card"><div class="card-t">${S.icon('download')} تثبيت تحديث</div>
          ${S.f.file('packfile', 'ملف التحديث (.sirajpack)', '')}
          <button class="btn primary block" data-act="packCheck">${S.icon('check-circle')} فحص الملف</button><div id="pack-res" class="mt"></div></div>
        <div class="card"><div class="card-t">${S.icon('database')} ما وصل من الناشر</div><div class="kv"><span>المحتوى المثبَّت من التحديثات</span><b>${fmtCount(inst)}</b></div>
          ${Object.entries(st.keys || {}).map(([id, k]) => S.h`<div class="kv"><span>آخر حزمة من ${id}</span><b>رقم ${S.n(k.seq)} — ${S.fmt.dt(k.at)}</b></div>`)}</div>
        ${(st.history || []).length ? S.h`<div class="card"><div class="card-t">${S.icon('list')} السجل</div>${st.history.slice(0, 10).map((h) => S.h`<div class="kv"><span>${h.title || h.packId}<span class="tiny muted"> • رقم ${S.n(h.seq)}</span></span><b class="tiny">${S.fmt.dt(h.at)}</b></div>`)}</div>` : ''}
      </div>`
    };
  });
  const box = () => S.$('#pack-res');
  S.act('packCheck', async () => {
    const f = S.$('[name=packfile]').files[0]; const out = box(); pending = null;
    if (!f) return S.toast('اختر ملف التحديث أولاً', 'err');
    out.innerHTML = '';
    let text; try { text = await S.readFile(f, 'text'); } catch (e) { return S.toast('تعذّرت قراءة الملف', 'err'); }
    const v = await T.verify(text);
    if (!v.ok) { S.mount(out, S.ui.notice('err', 'لم يُقبل الملف', v.reason)); return; }
    pending = v; const pl = v.payload;
    S.mount(out, S.h`${S.ui.notice('ok', 'التوقيع صحيح', S.h`<span>موقّع بمفتاح <b>${v.key.name}</b> <span class="op-ltr">(${v.key.id})</span>.</span>`)}
      <div class="card flat"><div class="kv"><span>العنوان</span><b>${pl.title || '—'}</b></div><div class="kv"><span>رقم الحزمة</span><b>${S.n(pl.seq)}</b></div><div class="kv"><span>تاريخ الإصدار</span><b>${S.fmt.dt(Date.parse(pl.created))}</b></div>
        <div class="kv"><span>المحتوى</span><b>${fmtCount(v.counts)}${v.counts.withdraw ? ' • سحب ' + S.n(v.counts.withdraw) : ''}</b></div><div class="kv"><span>البصمة</span><b class="op-ltr">${v.fingerprint}</b></div>
        ${pl.notes ? S.h`<p class="small nm">${pl.notes}</p>` : ''}</div>
      ${v.same ? S.ui.notice('info', 'مثبّتة من قبل', 'هذه الحزمة نفسها مثبّتة بالفعل؛ إعادة التثبيت آمنة وتعيد المحتوى إلى حالتها.') : ''}
      <button class="btn gold block mt" data-act="packApply">${S.icon('download')} تثبيت التحديث</button>`);
  });
  S.act('packApply', async () => {
    if (!pending) return S.toast('افحص ملفاً أولاً', 'err');
    if (!(await S.confirm('سيُثبَّت هذا التحديث. لا يمسّ مفضلتك ولا ملاحظاتك. متابعة؟', { yes: 'تثبيت' }))) return;
    const v = pending; pending = null; const out = box();
    try {
      const r = await T.apply(v);
      S.mount(out, S.h`${S.ui.notice(r.rejected.length ? 'warn' : 'ok', 'تم التثبيت', S.h`<span>أُضيف/حُدّث: ${fmtCount(r.written)}${r.removed ? ' • حُذف ' + S.n(r.removed) : ''}${r.notices ? ' • إعلانات ' + S.n(r.notices) : ''}.</span>`)}
        ${r.rejected.length ? S.ui.notice('warn', 'عناصر لم تُقبل (' + S.n(r.rejected.length) + ')', S.h`<ul class="list-b small">${r.rejected.slice(0, 10).map((x) => S.h`<li>${x}</li>`)}</ul>`) : ''}`);
      S.toast('تم تثبيت التحديث', 'ok');
    } catch (e) { S.mount(out, S.ui.notice('err', 'فشل التثبيت', e.message)); }
  });
})();

/* =====================================================================
   سِراج — التحكم : publish.js — إصدار حزمة محتوى موقّعة (.sirajpack)
   الحزمة لقطة كاملة بكل ما أعلنتَ «جاهزاً»؛ يأخذها سِراج بعد التحقق من توقيعك ومن قواعد التوثيق ذاتها.
   رقم الحزمة (seq) يتصاعد دائماً (يعتمد الدقائق منذ 1970 كحدّ أدنى) فلا يضيع التسلسل إن فُقدت بيانات الجهاز.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const SC = S.schema; const P = S.pcrypto; const esc = S.esc; const str = SC.str;
  const { list } = S.ctl;
  const META = () => S.kv.get('ctl.meta', { title: '', notes: '' });
  const HIST = () => S.kv.get('ctl.history', []);
  const nextSeq = () => Math.max((+S.kv.get('ctl.seq', 0) || 0) + 1, Math.floor(Date.now() / 60000));
  const stripBook = (b) => ({ id: b.id, title: b.title, author: b.author, authorId: b.authorId, authorDeath: b.authorDeath || null, section: b.section, subcat: b.subcat || '', desc: b.desc || '', tags: b.tags || [], publisher: b.publisher || '', year: b.year === '' ? null : b.year, edition: b.edition || '', pages: b.pages === '' ? null : b.pages, lang: b.lang || 'العربية', sourceName: b.sourceName || '', sourceUrl: b.sourceUrl || '', digitalUrl: b.digitalUrl || '', streamUrl: b.streamUrl || '', copyright: b.copyright || 'غير محدد' });
  const stripDua = (d) => ({ id: d.id, kind: d.kind, title: d.title, cat: d.cat, commonSource: d.commonSource || '', note: d.note || '', text: d.text || '', textSource: d.text ? d.textSource : null });
  const stripEntry = (e) => ({ id: e.id, collection: e.collection, title: e.title, text: e.text || '', verses: e.verses || [], tags: e.tags || [], sources: e.sources || [], isnads: e.isnads || [], variants: e.variants || [], scholarRulings: e.scholarRulings || [], positions: e.positions || [], extra: e.extra || {} });

  /* يفحص كل العناصر الجاهزة؛ أي خطأ يمنع الإصدار (لا نصدّر ما سيرفضه سِراج) */
  async function gather() {
    const [books, authors, duas, entries] = await Promise.all([list('books'), list('authors'), list('duas'), list('entries')]);
    const known = new Set((S.data.sample.authors || []).map((a) => a.id).concat(authors.map((a) => a.id)));
    const errs = []; const rb = books.filter((b) => b.ready), rd = duas.filter((d) => d.ready), re = entries.filter((e) => e.ready);
    rb.forEach((b) => { const e = SC.validateBook(b); if (!known.has(b.authorId)) e.push('مؤلف غير معرّف'); if (e.length) errs.push('كتاب «' + b.title + '»: ' + e[0]); });
    rd.forEach((d) => { const e = SC.validateDua(d); if (!(S.data.duas.categories || []).some((c) => c.id === d.cat)) e.push('تصنيف غير معروف'); if (e.length) errs.push('دعاء «' + d.title + '»: ' + e[0]); });
    re.forEach((x) => { const e = SC.validateEntry(x); if (e.length) errs.push('مدخل «' + x.title + '»: ' + e[0]); });
    /* ملفات PDF: وجود الملف، الحقوق، الحجم الكلي */
    let pdfTotal = 0;
    for (const b of rb.filter((x) => x.hasPdf)) {
      const f = await S.files.get('ctl.pdf.' + b.id);
      if (!f) { errs.push('كتاب «' + b.title + '»: ملف PDF مفقود — أعد إرفاقه'); continue; }
      if (!SC.copyOk(b.copyright)) errs.push('كتاب «' + b.title + '»: إرفاق PDF يتطلب حالة حقوق «ملك عام» أو «مرخّص» أو «بإذن خطي»');
      pdfTotal += f.size;
    }
    if (pdfTotal > 60 * 1048576) errs.push('مجموع ملفات PDF في الحزمة ' + Math.round(pdfTotal / 1048576) + ' م.ب ويتجاوز الحد (60 م.ب). اجعل بعض الكتب مسودات أو صغّر الملفات.');
    const used = new Set(rb.map((b) => b.authorId)); /* المؤلفون الذين تحتاجهم كتب الحزمة فقط */
    const repl = (arr, src) => { const ok = new Set(src.map((x) => x.id)); return [...new Set(arr.filter((x) => x.replaces && ok.has(x.replaces)).map((x) => x.replaces))]; };
    return { pdfTotal, replaced: { books: repl(rb, S.data.sample.books || []), duas: repl(rd, S.data.duas.items || []) }, books: rb, authors: authors.filter((a) => used.has(a.id)), duas: rd, entries: re, drafts: { books: books.length - rb.length, duas: duas.length - rd.length, entries: entries.length - re.length }, errs };
  }
  const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const sha256hex = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((x) => x.toString(16).padStart(2, '0')).join('');
  async function buildPayload(g, meta) {
    /* الـPDF خارج الحمولة الموقّعة: الحمولة تحمل بصمة SHA-256 لكل ملف، والملفات في blobs بالغلاف؛ فيبقى التوقيع صغيراً ولا يُقبل ملف تغيّرت بصمته */
    const pdfs = [], blobs = {};
    for (const b of g.books.filter((x) => x.hasPdf)) {
      const f = await S.files.get('ctl.pdf.' + b.id); if (!f) continue; const sha = await sha256hex(f.blob);
      if (!blobs[sha]) blobs[sha] = await b64(f.blob); pdfs.push({ id: b.id, sha, size: f.size, name: f.name || 'book.pdf', allow: !!b.allowDownload && SC.copyOk(b.copyright) });
    }
    const ad = await S.files.get('ctl.adhan'); const w = S.kv.get('ctl.withdraw', { books: [], duas: [], entries: [] });
    const pl = {
      v: 1, app: 'SIRAJ', id: 'pack_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), seq: nextSeq(), created: new Date().toISOString(), title: str(meta.title), notes: str(meta.notes),
      authors: g.authors.map((a) => ({ id: a.id, name: a.name, death: a.death || null, note: a.note || '' })), books: g.books.map(stripBook), duas: g.duas.map(stripDua), entries: g.entries.map(stripEntry),
      withdraw: { books: [...new Set((w.books || []).concat(g.replaced.books))], duas: [...new Set((w.duas || []).concat(g.replaced.duas))], entries: w.entries || [] }, notices: S.kv.get('ctl.notices', []).map((n) => ({ id: n.id, title: n.title, body: n.body })),
      adhan: ad ? { name: ad.name || 'أذان', mime: ad.blob.type, data: await b64(ad.blob) } : undefined, pdfs
    };
    Object.defineProperty(pl, '__blobs', { value: blobs, enumerable: false });
    return pl;
  }
  S.ctl.gather = gather; S.ctl.buildPayload = buildPayload;

  S.router.add('/publish', async () => {
    const g = await gather(); const meta = META(); const hist = HIST(); const w = S.kv.get('ctl.withdraw', { books: [], duas: [], entries: [] });
    const adhan = await S.files.get('ctl.adhan'); const total = g.books.length + g.duas.length + g.entries.length; const dr = g.drafts;
    return {
      title: 'إصدار حزمة', nav: 'publish', back: false,
      html: S.h`<div class="stack">
        ${!S.keys.exists() ? S.ui.notice('err', 'لا يوجد مفتاح نشر', S.h`<span>أنشئ المفتاح أولاً من تبويب <a href="#/key">المفتاح</a>.</span>`) : S.keys.isUnlocked() ? '' : S.ui.notice('warn', 'المفتاح مقفل', 'سيُطلب منك إدخال عبارة المرور عند الإصدار.')}
        <div class="card"><div class="card-t">${S.icon('list')} ما سيدخل الحزمة</div>
          <div class="kv"><span>كتب جاهزة</span><b>${S.n(g.books.length)}</b></div>${g.pdfTotal ? S.h`<div class="kv"><span>ملفات PDF مرفقة</span><b>${S.fmt.bytes(g.pdfTotal)}</b></div>` : ''}<div class="kv"><span>أدعية وزيارات جاهزة</span><b>${S.n(g.duas.length)}</b></div><div class="kv"><span>مداخل موسوعة جاهزة</span><b>${S.n(g.entries.length)}</b></div>
          <div class="kv"><span>سحب من المضمّن</span><b>${S.n(new Set(w.books.concat(g.replaced.books)).size + new Set(w.duas.concat(g.replaced.duas)).size + w.entries.length)}</b></div>${g.replaced.books.length + g.replaced.duas.length ? S.h`<p class="tiny muted nm">منها ${S.n(g.replaced.books.length)} كتاب و${S.n(g.replaced.duas.length)} دعاء حلّ محلها تعديلك.</p>` : ''}<div class="kv"><span>إعلانات</span><b>${S.n(S.kv.get('ctl.notices', []).length)}</b></div>
          ${dr.books + dr.duas + dr.entries ? S.h`<p class="small muted nm mt">مسودات خارج الحزمة: ${S.n(dr.books)} كتاب، ${S.n(dr.duas)} دعاء، ${S.n(dr.entries)} مدخل.</p>` : ''}</div>
        ${g.errs.length ? S.ui.notice('err', 'لا يمكن الإصدار — أصلح هذه العناصر أو أعدها مسودة', S.h`<ul class="err-list">${g.errs.slice(0, 12).map((x) => S.h`<li>${x}</li>`)}</ul>`) : ''}
        <div class="card"><div class="card-t">${S.icon('volume')} صوت الأذان (يصل المستخدمين مع الحزمة)</div><p class="small muted nm">${adhan ? 'الملف الحالي: ' + esc(adhan.name || 'أذان') + ' — ' + S.n(Math.round(adhan.size / 1024)) + ' ك.ب' : 'لم يُحدَّد ملف. ارفع تسجيلاً مرخّصاً لديك (حتى 10 م.ب).'}</p>${S.f.file('adhanFile', 'ملف صوتي للأذان', 'audio/*')}<div class="grid2"><button class="btn" data-act="adhanSave">${S.icon('upload')} حفظ الأذان</button>${adhan ? S.h`<button class="btn danger" data-act="adhanDel">إزالة</button>` : ''}</div></div>
        <div class="card">${S.f.text('ptitle', 'عنوان الحزمة', meta.title, { placeholder: 'مثال: إضافات شعبان' })}${S.f.area('pnotes', 'ملاحظات للمستخدمين — تظهر لهم قبل تثبيت الحزمة (اختياري)', meta.notes, { rows: 3 })}
          <button class="btn primary block" data-act="pkIssue" ${g.errs.length ? S.raw('disabled') : ''}>${S.icon('shield')} توقيع الحزمة وإصدارها</button>
          <p class="tiny muted nm mt">الحزمة لقطة كاملة: ما حذفتَه من الجاهز يُحذف من سِراج عند تثبيتها. الرقم القادم: <span class="fp">${S.n(nextSeq())}</span></p></div>
        <div id="pk-out"></div>
        <div class="card"><div class="card-t">${S.icon('eye')} فحص ملف حزمة</div>${S.f.file('vfile', 'ملف .sirajpack', '')}<button class="btn block" data-act="pkVerify">${S.icon('check-circle')} تحقق من التوقيع</button><div id="vf-out" class="mt"></div></div>
        ${hist.length ? S.h`<div class="card"><div class="card-t">${S.icon('clock')} الحزم الصادرة</div>${hist.slice(0, 12).map((h) => S.h`<div class="kv"><span>${h.title || h.id}<span class="tiny muted"> • ${S.n(h.books)} ك / ${S.n(h.duas)} د / ${S.n(h.entries)} م</span></span><b class="tiny fp">${S.n(h.seq)}</b></div>`)}</div>` : ''}</div>`
    };
  });
  const out = () => S.$('#pk-out');
  S.act('adhanSave', async (el) => {
    const f = S.$('[name=adhanFile]', el.closest('.card')).files[0]; if (!f) return S.toast('اختر ملفاً صوتياً', 'err');
    if (!/^audio\//.test(f.type)) return S.toast('الملف ليس صوتياً', 'err'); if (f.size > 10 * 1048576) return S.toast('الحد الأقصى 10 ميغابايت', 'err');
    await S.files.put('ctl.adhan', f, { name: f.name }); S.toast('حُفظ الأذان. لا يصل المستخدم إلا بعد «إصدار حزمة» جديدة وتثبيتها في تطبيقه', 'ok'); S.router.refresh();
  });
  S.act('adhanDel', async () => { await S.files.del('ctl.adhan'); S.toast('أُزيل الأذان من الحزمة القادمة'); S.router.refresh(); });
  S.act('pkIssue', async () => {
    const d = S.f.read(S.$('.view')); const meta = { title: str(d.ptitle), notes: str(d.pnotes) }; await S.kv.set('ctl.meta', meta);
    const g = await gather(); if (g.errs.length) return S.toast('أصلح الأخطاء أولاً', 'err');
    if (!(g.books.length + g.duas.length + g.entries.length) && !Object.values(S.kv.get('ctl.withdraw', {})).some((a) => (a || []).length) && !S.kv.get('ctl.notices', []).length) { if (!(await S.confirm('لا يوجد محتوى جاهز ولا سحب ولا إعلانات. ستُصدر حزمة فارغة تحذف ما نشرتَه سابقاً. متابعة؟', { danger: true, yes: 'إصدار' }))) return; }
    if (!(await S.keys.ensureUnlocked('أدخل عبارة المرور لتوقيع الحزمة'))) return;
    let env, blob, fp, payload;
    try {
      payload = await buildPayload(g, meta); const text = JSON.stringify(payload);
      env = await S.keys.sign(text); if (payload.__blobs && Object.keys(payload.__blobs).length) env.blobs = payload.__blobs;
      if (!(await P.verify(env, S.keys.pub()))) throw new Error('فشل التحقق الذاتي من التوقيع'); /* لا نسلّم ملفاً لا يتحقق */
      fp = (await P.sha(env.payload)).slice(0, 12); blob = new Blob([JSON.stringify(env)], { type: 'application/json' });
    } catch (e) { return S.toast('تعذّر التوقيع: ' + e.message, 'err'); }
    const name = 'siraj-pack-' + payload.seq + '.sirajpack';
    try { await S.saveBlob(blob, name, 'حزمة سِراج ' + (meta.title || payload.seq)); } catch (e) { return S.toast('تعذّر الحفظ: ' + e.message, 'err'); }
    await S.kv.set('ctl.seq', payload.seq);
    const h = HIST().slice(); h.unshift({ id: payload.id, seq: payload.seq, title: payload.title, at: Date.now(), books: payload.books.length, duas: payload.duas.length, entries: payload.entries.length, fp, size: blob.size }); await S.kv.set('ctl.history', h.slice(0, 50));
    await S.audit('pack.issue', payload.id, 'seq ' + payload.seq + ' fp ' + fp);
    S.mount(out(), S.ui.notice('ok', 'صدرت الحزمة', S.h`<span>ملف <b class="fp">${name}</b> (${S.fmt.bytes(blob.size)}) • البصمة <b class="fp">${fp}</b>.<br>أرسله إلى هاتفك أو إلى المستخدمين، ثم في سِراج: المزيد ← تحديثات المحتوى ← اختر الملف.</span>`));
    S.toast('صدرت الحزمة', 'ok');
  });
  S.act('pkVerify', async () => {
    const f = S.$('[name=vfile]').files[0]; const o = S.$('#vf-out'); if (!f) return S.toast('اختر ملفاً', 'err');
    let env; try { env = JSON.parse(await S.readFile(f, 'text')); } catch (e) { return S.mount(o, S.ui.notice('err', 'ليس ملف حزمة', 'الملف ليس JSON صالحاً.')); }
    if (!env || env.format !== P.FORMAT || typeof env.payload !== 'string') return S.mount(o, S.ui.notice('err', 'ليس ملف حزمة', 'الصيغة غير معروفة.'));
    const ok = S.keys.exists() && env.keyId === S.keys.id() && (await P.verify(env, S.keys.pub()));
    let pl = null; try { pl = JSON.parse(env.payload); } catch (e) { /* */ }
    S.mount(o, S.h`${ok ? S.ui.notice('ok', 'التوقيع صحيح — بمفتاحك', S.h`<span>البصمة <b class="fp">${(await P.sha(env.payload)).slice(0, 12)}</b></span>`) : S.ui.notice('err', 'التوقيع غير مطابق لمفتاحك', 'إما أنها حزمة بمفتاح آخر أو أنها عُدّلت بعد توقيعها.')}
      ${pl ? S.h`<div class="card flat"><div class="kv"><span>العنوان</span><b>${pl.title || '—'}</b></div><div class="kv"><span>الرقم</span><b>${S.n(pl.seq)}</b></div><div class="kv"><span>المحتوى</span><b>${S.n((pl.books || []).length)} كتاب • ${S.n((pl.duas || []).length)} دعاء • ${S.n((pl.entries || []).length)} مدخل</b></div></div>` : ''}`);
  });
})();

/* =====================================================================
   سِراج — admin.js : «إدارة سِراج – SIRAJ ADMIN»
   ⚠ الدخول هنا تجريبي محلي: لا يوفّر أماناً حقيقياً، فالبيانات في متصفح الجهاز ويستطيع صاحب الجهاز تجاوزه.
     الأمان الفعلي (مستخدمون حقيقيون، RLS، سجل غير قابل للعبث) يتطلب خادماً — انظر docs/schema.sql.
   قواعد المحتوى: لا نشر تلقائي • موافقة المالك افتراضياً • لا نشر ملف دون حالة حقوق موثقة • كل عملية تُسجَّل.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const esc = S.esc; const L = () => S.library;
  const CAPS = { 'books.view': 'عرض الكتب غير المنشورة', 'books.add': 'إضافة كتب', 'books.edit': 'تعديل الكتب', 'books.review': 'مراجعة الكتب (توصية/قبول/رفض)', 'content.edit': 'إدارة الأدعية والمحتوى', 'audio.manage': 'إدارة الصوتيات', 'notifications.manage': 'إرسال الإشعارات', 'stats.view': 'عرض الإحصاءات', 'audit.view': 'عرض سجل العمليات', 'users.manage': 'إدارة المستخدمين', 'settings.manage': 'إعدادات المالك', 'backup.manage': 'النسخ الاحتياطي والاستيراد', 'books.delete': 'حذف الكتب' };
  const ROLE_T = () => Object.fromEntries(Object.entries(S.data.sample.roles).map(([k, v]) => [k, v.title]));
  const COPY = [
    { v: 'غير محدد', ok: false, note: 'لا يُنشر أي ملف' }, { v: 'ملك عام (انتهت مدة الحماية)', ok: true }, { v: 'مرخّص — Creative Commons', ok: true }, { v: 'بإذن خطي من الناشر أو المؤلف', ok: true },
    { v: 'متاح للتصفح من مصدره فقط (لا إعادة نشر)', ok: false, note: 'رابط خارجي فقط' }, { v: 'محمي — لا يُنشر', ok: false }
  ];
  const copyOk = (v) => { const c = COPY.find((x) => x.v === v); return !!(c && c.ok); };
  const ownerCfg = () => S.kv.get('settings.owner', { requireOwnerApproval: true, maxCoverMB: 5 });

  /* ---------------- المصادقة المحلية ---------------- */
  let cur = null; let fails = 0, lockUntil = 0;
  const Auth = (S.auth = {
    user: () => cur,
    isOwner: () => !!cur && cur.role === 'owner',
    async restore() { const s = S.kv.get('auth.session'); if (!s) return; const u = await S.db.get('users', s.id); if (u && u.active !== false) cur = u; else await S.kv.del('auth.session'); },
    can(cap) { if (!cur) return false; const r = S.data.sample.roles[cur.role]; if (!r) return false; return r.caps.includes('*') || r.caps.includes(cap) || (cur.grants || []).includes(cap); },
    canPublish() { return Auth.isOwner() || (!ownerCfg().requireOwnerApproval && Auth.can('books.review')); },
    async login(username, pin) {
      if (Date.now() < lockUntil) throw new Error('محاولات كثيرة. انتظر ' + S.n(Math.ceil((lockUntil - Date.now()) / 1000)) + ' ثانية');
      const u = (await S.db.all('users')).find((x) => x.username === String(username).trim().toLowerCase());
      const ok = u && u.active !== false && (await S.sha256(u.salt + ':' + pin)) === u.hash;
      if (!ok) { fails++; if (fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; } await S.audit('auth.fail', username); throw new Error('اسم المستخدم أو الرمز غير صحيح'); }
      fails = 0; cur = u; await S.kv.set('auth.session', { id: u.id, ts: Date.now() }); await S.audit('auth.login', u.username); return u;
    },
    async logout() { await S.audit('auth.logout', cur ? cur.username : ''); cur = null; await S.kv.del('auth.session'); }
  });
  const need = (cap, title, back) => {
    if (!cur) return { title: 'دخول الإدارة', nav: 'more', back: back || '/more', html: loginView() };
    if (cap && !Auth.can(cap)) return { title, nav: 'more', back: back || '/admin', html: S.ui.notice('err', 'لا تملك الصلاحية', 'هذه الصفحة تتطلب صلاحية «' + (CAPS[cap] || cap) + '». دورك الحالي: ' + ROLE_T()[cur.role]) };
    return null;
  };
  const loginView = () => S.h`<div class="stack"><div class="card"><div class="card-t">${S.icon('lock')} دخول إدارة سِراج</div>
    ${S.ui.notice('warn', 'دخول تجريبي — ليس أماناً حقيقياً', 'يعمل هذا الدخول داخل متصفحك فقط لتجربة الصلاحيات وسير العمل. لا تُدخل أي بيانات حساسة. الحماية الفعلية تتطلب خادماً (Supabase Auth + RLS).')}
    ${S.f.text('lu', 'اسم المستخدم', '', { ltr: true, placeholder: 'owner' })}${S.f.text('lp', 'الرمز (PIN)', '', { type: 'password', ltr: true, inputmode: 'numeric' })}
    <button class="btn primary block" data-act="admLogin">${S.icon('key')} دخول</button>
    <details class="acc mt"><summary>الحسابات التجريبية</summary><div class="acc-b small">${S.data.sample.users.map((u) => S.h`<div class="kv"><span>${u.name}</span><b class="op-ltr">${u.username} / ${u.pin}</b></div>`)}<p class="tiny muted nm">تُهيَّأ عند أول تشغيل. يمكن للمالك تغيير الرموز من «المستخدمون».</p></div></details></div></div>`;
  S.act('admLogin', async () => { try { await Auth.login(S.$('#f_lu').value, S.$('#f_lp').value); S.toast('أهلاً ' + cur.name, 'ok'); S.router.refresh(); } catch (e) { S.toast(e.message, 'err'); } });
  S.act('admLogout', async () => { await Auth.logout(); S.toast('تم تسجيل الخروج'); S.router.go('/more'); });

  /* ---------------- لوحة القيادة ---------------- */
  S.router.add('/admin', async () => {
    const g = need(null, 'الإدارة'); if (g) return g;
    const books = L().books; const cnt = (st) => books.filter((b) => b.status === st).length; const pend = L().pending().length; const files = await S.db.count('files');
    const tile = (ic, t, href, cap, badge) => (cap && !Auth.can(cap) ? '' : S.h`<a class="card tap" href="#${href}" style="position:relative">${S.icon(ic)}<div><b>${t}</b></div>${badge ? S.h`<span class="badge warn" style="position:absolute;top:8px;inset-inline-start:8px">${S.n(badge)}</span>` : ''}</a>`);
    return {
      title: 'إدارة سِراج', nav: 'more', back: '/more', actions: [{ icon: 'logout', label: 'خروج', act: 'admLogout' }],
      html: S.h`<div class="stack"><div class="card"><div class="row between"><div><b>${cur.name}</b><div class="small muted">الدور: ${ROLE_T()[cur.role]}</div></div>${S.ui.badge(ownerCfg().requireOwnerApproval ? 'موافقة المالك مطلوبة' : 'موافقة المالك معطّلة', ownerCfg().requireOwnerApproval ? 'ok' : 'warn')}</div></div>
        <div class="grid2"><div class="stat"><b>${S.n(books.length)}</b><span>إجمالي الكتب</span></div><div class="stat"><b>${S.n(cnt('published'))}</b><span>منشور</span></div><div class="stat"><b>${S.n(pend)}</b><span>بانتظار الموافقة</span></div><div class="stat"><b>${S.n(files)}</b><span>ملفات مرفوعة</span></div></div>
        <div class="grid2">
          ${tile('shield', 'الكتب بانتظار الموافقة', '/admin/pending', 'books.review', pend)}${tile('library', 'إدارة الكتب', '/admin/books', 'books.view')}${tile('plus', 'إضافة كتاب', '/admin/book/new', 'books.add')}${tile('search', 'سِراج AI LIBRARY', '/ailibrary', 'books.add')}
          ${tile('upload', 'استيراد كتب (JSON)', '/admin/import', 'backup.manage')}${tile('user', 'المؤلفون', '/admin/authors', 'books.edit')}${tile('database', 'الناشرون', '/admin/publishers', 'books.edit')}${tile('link', 'المصادر', '/admin/sources', 'books.edit')}
          ${tile('heart-handshake', 'الأدعية والزيارات', '/admin/duas', 'content.edit')}${tile('network', 'الموسوعات والروايات', '/research', 'content.edit')}${tile('book-open', 'القرآن والتلاوات', '/admin/quran', 'content.edit')}${tile('volume', 'الصوتيات', '/admin/audio', 'audio.manage')}
          ${tile('bell', 'الإشعارات', '/admin/notify', 'notifications.manage')}${tile('chart', 'الإحصاءات', '/admin/stats', 'stats.view')}${tile('users', 'المستخدمون والصلاحيات', '/admin/users', 'users.manage')}${tile('list', 'سجل العمليات', '/admin/audit', 'audit.view')}
          ${tile('database', 'النسخ الاحتياطي', '/admin/backup', 'backup.manage')}${tile('settings', 'إعدادات المالك', '/admin/settings', 'settings.manage')}
        </div></div>`
    };
  });

  /* ---------------- قائمة الكتب ---------------- */
  const stBadge = (b) => ({ published: S.ui.badge('منشور', 'ok'), pending: S.ui.badge('بانتظار الموافقة', 'warn'), needs_review: S.ui.badge('يحتاج مراجعة إضافية', 'warn'), rejected: S.ui.badge('مرفوض', 'bad'), draft: S.ui.badge('مسودة', 'info') }[b.status] || S.ui.badge(b.status));
  S.router.add('/admin/books', (p, q) => {
    const g = need('books.view', 'الكتب'); if (g) return g;
    const st = q.st || ''; const sec = q.sec || ''; const term = (q.q || '').trim(); let rows = L().books.slice();
    if (st) rows = rows.filter((b) => b.status === st); if (sec) rows = rows.filter((b) => b.section === sec); if (term) { const t = S.norm(term); rows = rows.filter((b) => b._n.includes(t)); }
    rows.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')); const lim = +(q.n || 40);
    return {
      title: 'إدارة الكتب', nav: 'more', back: '/admin', actions: Auth.can('books.add') ? [{ icon: 'plus', label: 'إضافة كتاب', href: '#/admin/book/new' }] : [],
      html: S.h`<div class="stack"><div class="searchbox">${S.icon('search')}<input class="input" id="abq" value="${term}" placeholder="بحث في الكتب (للإدارة)"></div>
        <div class="chips"><a class="chip ${!st ? 'active' : ''}" href="#/admin/books">الكل (${S.n(L().books.length)})</a>${['published', 'pending', 'needs_review', 'rejected', 'draft'].map((s) => S.h`<a class="chip ${st === s ? 'active' : ''}" href="#/admin/books?st=${s}">${({ published: 'منشور', pending: 'بانتظار الموافقة', needs_review: 'مراجعة إضافية', rejected: 'مرفوض', draft: 'مسودة' })[s]} (${S.n(L().books.filter((b) => b.status === s).length)})</a>`)}</div>
        <div class="small muted">${S.n(rows.length)} كتاب</div><div class="list">${rows.slice(0, lim).map((b) => S.h`<a class="li" href="#/admin/book/${b.id}"><span class="li-body"><span class="li-t">${b.title}</span><span class="li-s">${b.author} • ${(S.sectionById[b.section] || {}).title || ''}</span></span><span class="li-end">${stBadge(b)}</span></a>`)}</div>
        ${rows.length > lim ? S.h`<a class="btn block" href="#/admin/books?st=${st}&n=${lim + 40}&keep=1">عرض المزيد</a>` : ''}</div>`,
      mount() { const f = S.$('#abq'); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/admin/books?q=' + encodeURIComponent(f.value) + (st ? '&st=' + st : '')); }); }
    };
  });

  /* ---------------- نموذج الكتاب ---------------- */
  const subOptions = (sec, cur) => { const s = S.sectionById[sec]; return ['<option value="">— بلا —</option>'].concat((s ? s.subcats : []).map((x) => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`)).join(''); };
  S.router.add('/admin/book/:id', async (p) => {
    const isNew = p.id === 'new'; const g = need(isNew ? 'books.add' : 'books.edit', 'كتاب'); if (g) return g;
    const b = isNew ? { id: '', title: '', author: '', section: S.sections[0].id, subcat: '', desc: '', tags: [], publisher: '', year: null, edition: '', pages: null, lang: 'العربية', sourceName: '', sourceUrl: '', copyright: 'غير محدد', digitalUrl: '', status: 'draft', allowDownload: false } : L().byId.get(p.id);
    if (!b) return { title: 'كتاب', back: '/admin/books', html: S.ui.empty('alert', 'الكتاب غير موجود') };
    const pubs = await S.db.all('publishers'); const authors = Array.from(L().authors.values());
    return {
      title: isNew ? 'إضافة كتاب' : 'تعديل كتاب', nav: 'more', back: isNew ? '/admin/books' : '/library/book/' + b.id,
      html: S.h`<div class="stack" id="bkform" data-id="${b.id}">
        ${!isNew ? S.h`<div class="row between">${stBadge(b)}<span class="small muted">المعرّف: <span class="op-ltr">${b.id}</span></span></div>` : ''}
        ${b.review && b.review.note ? S.ui.notice(b.status === 'rejected' ? 'err' : 'info', 'ملاحظة المراجعة (' + b.review.decision + ')', b.review.note) : ''}
        <div class="card">
          ${S.f.text('title', 'عنوان الكتاب', b.title, { required: true })}
          <div class="field"><label>المؤلف <span class="bad">*</span></label><input class="input" name="author" list="authlist" value="${b.author}" autocomplete="off"><datalist id="authlist">${authors.map((a) => S.h`<option value="${a.name}"></option>`)}</datalist><span class="hint">اختر من القائمة أو اكتب اسماً جديداً (يُنشأ سجل مؤلف).</span></div>
          ${S.f.text('authorDeath', 'سنة وفاة المؤلف (هجري، اختياري)', b.authorDeath || '', { type: 'number', ltr: true })}
          ${S.f.select('section', 'القسم', S.sections.map((s) => ({ v: s.id, t: s.title })), b.section, { chg: 'admSection' })}
          <div class="field"><label>التصنيف الفرعي</label><select class="select" name="subcat" id="f_subcat">${S.raw(subOptions(b.section, b.subcat))}</select></div>
          ${S.f.area('desc', 'نبذة تعريفية', b.desc, { rows: 3 })}${S.f.text('tags', 'وسوم (مفصولة بفاصلة)', (b.tags || []).join('، '))}
        </div>
        <div class="card"><div class="card-t">${S.icon('list')} الببليوغرافيا</div>
          <div class="field"><label>دار النشر</label><input class="input" name="publisher" list="publist" value="${b.publisher || ''}"><datalist id="publist">${pubs.map((x) => S.h`<option value="${x.name}"></option>`)}</datalist></div>
          <div class="grid3">${S.f.text('year', 'سنة النشر', b.year || '', { type: 'number', ltr: true })}${S.f.text('edition', 'الطبعة', b.edition)}${S.f.text('pages', 'الصفحات', b.pages || '', { type: 'number', ltr: true })}</div>
          ${S.f.text('lang', 'اللغة', b.lang)}</div>
        <div class="card"><div class="card-t">${S.icon('link')} المصدر والحقوق</div>
          ${S.f.text('sourceName', 'اسم المصدر', b.sourceName)}${S.f.text('sourceUrl', 'رابط المصدر', b.sourceUrl, { ltr: true, placeholder: 'https://' })}${S.f.text('digitalUrl', 'رابط النسخة الرقمية', b.digitalUrl, { ltr: true })}
          ${S.f.select('copyright', 'حالة حقوق النشر', COPY.map((c) => ({ v: c.v, t: c.v + (c.ok ? '' : ' — لا يُنشر ملف') })), b.copyright)}
          ${S.f.check('allowDownload', 'السماح للمستخدمين بتنزيل الملف (يتطلب ترخيصاً يسمح بذلك)', b.allowDownload)}
          ${S.f.text('reviewStatus', 'حالة مراجعة المسؤول (نص)', b.reviewStatus || '')}</div>
        <div class="card"><div class="card-t">${S.icon('upload')} الملفات</div>
          ${S.f.file('cover', 'غلاف الكتاب (PNG/JPG/WebP)', 'image/png,image/jpeg,image/webp', b.hasCover ? 'يوجد غلاف محفوظ؛ اختر ملفاً لاستبداله' : 'بدون غلاف يُولَّد غلاف تلقائي مؤقت')}
          ${S.f.file('pdf', 'ملف PDF', 'application/pdf', b.hasPdf ? 'يوجد ملف محفوظ؛ اختر ملفاً لاستبداله' : 'لا يُقبل إلا PDF حقيقي. يُحفظ في متصفحك فقط.')}
          ${b.hasCover ? S.f.check('rmCover', 'حذف الغلاف الحالي', false) : ''}${b.hasPdf ? S.f.check('rmPdf', 'حذف ملف PDF الحالي', false) : ''}</div>
        <div class="stack s">
          <button class="btn" data-act="admSaveBook" data-mode="draft">${S.icon('check')} حفظ كمسودة</button>
          <button class="btn gold" data-act="admSaveBook" data-mode="submit">${S.icon('shield')} إرسال إلى طابور الموافقة</button>
          ${Auth.canPublish() ? S.h`<button class="btn primary" data-act="admSaveBook" data-mode="publish">${S.icon('check-circle')} حفظ ونشر</button>` : S.ui.notice('info', 'النشر النهائي', ownerCfg().requireOwnerApproval ? 'النشر النهائي من صلاحية مالك التطبيق. أرسل الكتاب إلى الطابور.' : 'ليس لديك صلاحية النشر.')}
          ${!isNew && Auth.can('books.delete') ? S.h`<button class="btn danger" data-act="admDelBook" data-id="${b.id}">${S.icon('trash')} حذف الكتاب نهائياً</button>` : ''}
        </div></div>`
    };
  });
  S.onChange('admSection', (el) => { S.$('#f_subcat').innerHTML = subOptions(el.value, ''); });

  async function resizeImage(file, max) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('تعذّر قراءة الصورة')); i.src = url; });
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    } finally { URL.revokeObjectURL(url); }
  }
  async function checkPdf(file) {
    const max = (S.settings.maxPdfMB || 80) * 1048576; if (file.size > max) throw new Error('حجم الملف يتجاوز الحد (' + S.n(S.settings.maxPdfMB) + ' ميغابايت)'); if (file.size < 100) throw new Error('الملف فارغ');
    const head = new TextDecoder().decode(new Uint8Array(await file.slice(0, 5).arrayBuffer())); if (head !== '%PDF-') throw new Error('الملف ليس PDF صالحاً (لا يبدأ بتوقيع PDF)');
  }
  async function storePdf(b, file) {
    await checkPdf(file); await S.files.put('pdf:' + b.id, file, { kind: 'pdf', name: file.name }); b.hasPdf = true; b.pdfSize = file.size; b.pdfName = file.name;
    if (!b.pages && S.reader && S.reader.pageCount) { const n = await S.reader.pageCount(file); if (n) b.pages = n; }
  }
  async function storeCover(b, file) {
    const max = (ownerCfg().maxCoverMB || 5) * 1048576; if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('الغلاف يجب أن يكون PNG أو JPG أو WebP'); if (file.size > max) throw new Error('حجم الغلاف يتجاوز ' + S.n(ownerCfg().maxCoverMB) + ' ميغابايت');
    const blob = await resizeImage(file, 640); await S.files.put('cover:' + b.id, blob); b.hasCover = true; S.dropCoverUrl(b.id);
  }
  async function authorFor(name, death) {
    const n = S.norm(name); let a = Array.from(L().authors.values()).find((x) => S.norm(x.name) === n);
    if (!a) { a = { id: S.uid('a'), name: name.trim(), death: death || null, note: '' }; await S.db.put('authors', a); L().authors.set(a.id, a); await S.audit('author.add', a.name); }
    return a;
  }
  S.act('admSaveBook', async (el) => {
    const root = S.$('#bkform'); const d = S.f.read(root); const mode = el.dataset.mode; const id = root.dataset.id; const isNew = !id;
    if (!d.title.trim() || !d.author.trim()) return S.toast('العنوان والمؤلف مطلوبان', 'err');
    if (d.sourceUrl && !/^https?:\/\//i.test(d.sourceUrl.trim())) return S.toast('رابط المصدر يجب أن يبدأ بـ http أو https', 'err');
    if (d.digitalUrl && !/^https?:\/\//i.test(d.digitalUrl.trim())) return S.toast('رابط النسخة الرقمية يجب أن يبدأ بـ http أو https', 'err');
    const old = isNew ? null : L().byId.get(id); const b = old ? Object.assign({}, old) : { id: S.uid('b'), addedAt: new Date().toISOString(), reads: 0, downloads: 0, hasPdf: false, hasCover: false, demo: false };
    if (isNew) { const dup = L().findDuplicates(d.title, d.author); if (dup.length && !(await S.confirm('يوجد كتاب مشابه: «' + dup[0].book.title + '» — ' + dup[0].book.author + '. هل تريد المتابعة رغم احتمال التكرار؟', { yes: 'متابعة' }))) return; }
    const a = await authorFor(d.author, d.authorDeath);
    Object.assign(b, { title: d.title.trim(), author: a.name, authorId: a.id, authorDeath: a.death || d.authorDeath || null, section: d.section, subcat: d.subcat, desc: d.desc.trim(), tags: d.tags.split(/[,،]/).map((x) => x.trim()).filter(Boolean), publisher: d.publisher.trim(), year: d.year, edition: d.edition.trim(), pages: d.pages, lang: d.lang.trim() || 'العربية', sourceName: d.sourceName.trim(), sourceUrl: d.sourceUrl.trim(), digitalUrl: d.digitalUrl.trim(), copyright: d.copyright, allowDownload: !!d.allowDownload, reviewStatus: d.reviewStatus || b.reviewStatus || '' });
    if (d.publisher.trim()) { const pn = S.norm(d.publisher); if (!(await S.db.all('publishers')).some((x) => S.norm(x.name) === pn)) await S.db.put('publishers', { id: S.uid('p'), name: d.publisher.trim(), country: '', note: '' }); }
    try {
      if (d.rmPdf) { await S.files.del('pdf:' + b.id); b.hasPdf = false; }
      if (d.rmCover) { await S.files.del('cover:' + b.id); b.hasCover = false; S.dropCoverUrl(b.id); }
      if (d.pdf) await storePdf(b, d.pdf); if (d.cover) await storeCover(b, d.cover);
    } catch (e) { return S.toast(e.message, 'err'); }
    if (b.allowDownload && !copyOk(b.copyright)) { b.allowDownload = false; S.toast('أُلغي السماح بالتنزيل: حالة الحقوق لا تسمح', 'err'); }
    let status = mode === 'draft' ? 'draft' : 'pending';
    if (mode === 'publish') {
      if (!Auth.canPublish()) return S.toast('النشر النهائي للمالك', 'err');
      if (b.hasPdf && !copyOk(b.copyright)) return S.toast('لا يمكن نشر ملف دون حالة حقوق موثقة تسمح بذلك (ملك عام/مرخّص/بإذن). غيّر حالة الحقوق أو احذف الملف أو أرسل الكتاب كبيانات فقط.', 'err');
      status = 'published';
    }
    if (old && old.status === 'published' && mode !== 'publish') { status = Auth.canPublish() ? 'published' : 'pending'; }
    b.status = status; b.review = Object.assign({}, b.review || {}, { by: cur.name, at: Date.now(), decision: status === 'published' ? 'نشر' : status === 'pending' ? 'إرسال للمراجعة' : 'مسودة', note: b.review && status === 'published' ? '' : (b.review || {}).note || '' });
    if (b.demo && !old) b.demo = false; await L().save(b); await S.audit(isNew ? 'book.add' : 'book.edit', b.title, 'status=' + status);
    S.toast(status === 'published' ? 'نُشر الكتاب' : status === 'pending' ? 'أُرسل إلى طابور الموافقة' : 'حُفظت المسودة', 'ok'); S.router.go(status === 'pending' ? '/admin/pending' : '/admin/books');
  });
  S.act('admDelBook', async (el) => { const b = L().byId.get(el.dataset.id); if (!(await S.confirm('حذف «' + b.title + '» نهائياً مع ملفاته وتقدّمه؟ لا يمكن التراجع.', { danger: true, yes: 'حذف' }))) return; await L().remove(b.id); await S.audit('book.delete', b.title); S.toast('حُذف الكتاب', 'ok'); S.router.go('/admin/books'); });

  /* إرفاق PDF سريع من صفحة الكتاب */
  S.admin = {
    attachPdf(id) {
      if (!Auth.can('books.edit')) return S.toast('تحتاج صلاحية التعديل. ادخل من «إدارة سِراج».', 'err');
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf'; inp.style.display = 'none'; document.body.appendChild(inp);
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; inp.remove(); if (!f) return; const b = L().byId.get(id);
        try { await storePdf(b, f); if (b.status === 'published' && !copyOk(b.copyright)) { b.status = 'pending'; S.toast('أُعيد الكتاب إلى الطابور: لا يُنشر ملف دون حالة حقوق موثقة', 'err'); } await L().save(b); await S.audit('book.pdf', b.title, f.name + ' ' + f.size); S.toast('أُرفق الملف (' + S.fmt.bytes(f.size) + ')', 'ok'); S.router.refresh(); } catch (e) { S.toast(e.message, 'err'); }
      }); inp.click();
    },
    copyOk, COPY, authorFor, can: (c) => Auth.can(c)
  };

  /* ---------------- «الكتب بانتظار الموافقة» ---------------- */
  S.router.add('/admin/pending', (p, q) => {
    const g = need('books.review', 'الكتب بانتظار الموافقة'); if (g) return g;
    const rows = L().pending().sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || '')); const cfg = ownerCfg();
    return {
      title: 'الكتب بانتظار الموافقة', nav: 'more', back: '/admin',
      html: S.h`<div class="stack">${S.ui.notice('info', 'قاعدة النشر', cfg.requireOwnerApproval ? 'القرار النهائي للمالك. غير المالك يسجّل «توصية» تُعرض للمالك.' : 'موافقة المالك معطّلة: يمكن لمن يملك صلاحية المراجعة النشر.')}
        ${rows.length ? rows.map((b) => reviewCard(b)) : S.ui.empty('check-circle', 'لا كتب بانتظار الموافقة', 'تصل هنا الكتب المرسلة من المحررين ومن سِراج AI LIBRARY.')}</div>`
    };
  });
  function reviewCard(b) {
    const dups = L().findDuplicates(b.title, b.author, b.id); const sec = S.sectionById[b.section] || {}; const prop = b.proposedSection && b.proposedSection !== b.section ? S.sectionById[b.proposedSection] : null;
    return S.h`<div class="card rev-card"><div class="rv-top"><div class="grow"><b>${b.title}</b><div class="small muted">${b.author}</div></div>${stBadge(b)}</div>
      <div class="row wrap">${S.ui.badge(sec.title || 'بلا قسم', 'gold')}${b.subcat ? S.ui.badge(b.subcat) : ''}${b.hasPdf ? S.ui.badge('ملف PDF مرفوع', 'info') : S.ui.badge('بيانات فقط')}${S.ui.badge('الحقوق: ' + b.copyright, copyOk(b.copyright) ? 'ok' : 'warn')}</div>
      ${b.desc ? S.h`<p class="small nm">${b.desc}</p>` : ''}
      ${prop ? S.h`<div class="notice info">${S.icon('sparkle')}<div><b>قسم مقترح من النظام:</b> ${prop.title}<div class="tiny">اقتراح آلي لا يُعتمد دون مراجعتك.</div></div></div>` : ''}
      ${b.aiNote ? S.h`<div class="small"><b>ملاحظة سِراج AI:</b> ${b.aiNote}</div>` : ''}
      ${b.toc && b.toc.length ? S.h`<details class="acc"><summary>الفهرس المستخرج (${S.n(b.toc.length)})</summary><div class="acc-b small">${b.toc.map((x) => S.h`<div>${x}</div>`)}</div></details>` : ''}
      <div class="small">${b.sourceUrl ? S.h`المصدر: <a href="${S.url(b.sourceUrl)}" target="_blank" rel="noopener noreferrer">${b.sourceName || b.sourceUrl}</a>` : S.h`<span class="bad">لا رابط مصدر موثّق</span>`}</div>
      ${dups.length ? S.h`<div class="notice warn">${S.icon('alert')}<div><b>احتمال تكرار:</b> ${dups.slice(0, 2).map((d) => d.book.title).join('، ')}</div></div>` : ''}
      ${b.review && b.review.note ? S.h`<div class="small gold">آخر ملاحظة (${b.review.by || ''}): ${b.review.note}</div>` : ''}${b.reviewerRec ? S.h`<div class="small ${b.reviewerRec.decision === 'قبول' ? 'ok' : 'bad'}">توصية ${b.reviewerRec.by}: ${b.reviewerRec.decision}${b.reviewerRec.note ? ' — ' + b.reviewerRec.note : ''}</div>` : ''}
      <div class="rev-actions"><button class="btn sm primary" data-act="admApprove" data-id="${b.id}">${S.icon('check')} ${Auth.canPublish() ? 'موافقة ونشر' : 'توصية بالقبول'}</button><button class="btn sm danger" data-act="admReject" data-id="${b.id}">${S.icon('close')} رفض</button><button class="btn sm" data-act="admSec" data-id="${b.id}">${S.icon('layers')} تعديل القسم</button><a class="btn sm" href="#/admin/book/${b.id}">${S.icon('edit')} تعديل البيانات</a><button class="btn sm ghost" data-act="admMore" data-id="${b.id}">${S.icon('eye')} طلب مراجعة إضافية</button></div></div>`;
  }
  async function decide(b, status, decision, note) { b.status = status; b.review = { by: cur.name, at: Date.now(), decision, note: note || '' }; await L().save(b); await S.audit('book.' + status, b.title, note || ''); await S.notify.add({ title: 'قرار مراجعة: ' + decision, body: b.title + (note ? ' — ' + note : ''), kind: 'review' }); }
  S.act('admApprove', async (el) => {
    const b = L().byId.get(el.dataset.id);
    if (!Auth.canPublish()) { const note = await S.prompt('توصيتك', { multiline: true, label: 'ملاحظتك للمالك (اختياري)', ok: 'تسجيل التوصية' }); if (note === null) return; b.reviewerRec = { decision: 'قبول', by: cur.name, at: Date.now(), note: note.trim() }; await L().save(b); await S.audit('book.recommend', b.title, 'قبول'); S.toast('سُجّلت توصيتك. القرار النهائي للمالك.', 'ok'); return S.router.refresh(); }
    if (!b.author || /^غير محدد/.test(b.author)) return S.alert('المؤلف غير محدد', S.h`<p>حدّد المؤلف الحقيقي من «تعديل البيانات» قبل النشر. لا يُنشر كتاب بلا مؤلف موثّق.</p>`);
    if (b.hasPdf && !copyOk(b.copyright)) return S.alert('لا يمكن النشر', S.h`<p>للكتاب ملف PDF لكن حالة الحقوق «${b.copyright}» لا تسمح بإعادة النشر. عدّل حالة الحقوق بعد التحقق من ترخيص حقيقي، أو احذف الملف وانشر البيانات فقط.</p>`);
    if (!(await S.confirm('نشر «' + b.title + '» في المكتبة العامة؟' + (b.hasPdf ? '' : ' (بيانات ببليوغرافية بدون ملف)'), { yes: 'نشر' }))) return;
    if (b.proposedSection && b.proposedSection !== b.section && (await S.confirm('اعتماد القسم المقترح «' + S.sectionById[b.proposedSection].title + '»؟', { yes: 'اعتماد', no: 'إبقاء القسم الحالي' }))) { b.section = b.proposedSection; b.subcat = ''; }
    if (!b.authorId) { const a = await authorFor(b.author, b.authorDeath); b.authorId = a.id; b.author = a.name; }
    b.proposedSection = null; await decide(b, 'published', 'قبول ونشر'); b.publishedAt = new Date().toISOString(); await L().save(b); S.toast('نُشر الكتاب', 'ok'); S.router.refresh();
  });
  S.act('admReject', async (el) => { const b = L().byId.get(el.dataset.id); const why = await S.prompt('سبب الرفض', { multiline: true, label: 'مطلوب — يظهر للمحرر', ok: 'رفض' }); if (why === null) return; if (!why.trim()) return S.toast('اكتب سبب الرفض', 'err'); if (!Auth.canPublish()) { b.reviewerRec = { decision: 'رفض', by: cur.name, at: Date.now(), note: why.trim() }; await L().save(b); await S.audit('book.recommend', b.title, 'رفض'); S.toast('سُجّلت توصيتك بالرفض. القرار النهائي للمالك.', 'ok'); return S.router.refresh(); } await decide(b, 'rejected', 'رفض', why.trim()); S.toast('رُفض الكتاب', 'ok'); S.router.refresh(); });
  S.act('admMore', async (el) => { const b = L().byId.get(el.dataset.id); const n = await S.prompt('ما المطلوب مراجعته؟', { multiline: true, label: 'مثال: تحقق من الطبعة وحقوق النشر', ok: 'إرسال الطلب' }); if (n === null) return; if (!n.trim()) return S.toast('اكتب المطلوب', 'err'); await decide(b, 'needs_review', 'طلب مراجعة إضافية', n.trim()); S.toast('سُجّل الطلب', 'ok'); S.router.refresh(); });
  S.act('admSec', (el) => {
    const b = L().byId.get(el.dataset.id);
    S.modal({ title: 'تعديل القسم', body: S.h`${S.f.select('section', 'القسم', S.sections.map((s) => ({ v: s.id, t: s.title })), b.section, { chg: 'admSection' })}<div class="field"><label>التصنيف الفرعي</label><select class="select" name="subcat" id="f_subcat">${S.raw(subOptions(b.section, b.subcat))}</select></div>`, actions: [{ label: 'إلغاء', cls: 'ghost' }, { label: 'حفظ', cls: 'primary', onClick: async (box) => { const d = S.f.read(box); b.section = d.section; b.subcat = d.subcat; b.proposedSection = null; await L().save(b); await S.audit('book.section', b.title, d.section + '/' + d.subcat); S.router.refresh(); } }] });
  });

  /* ---------------- كيانات بسيطة: مؤلفون / ناشرون / مصادر ---------------- */
  const ENT = {
    authors: { title: 'المؤلفون', fields: [['name', 'الاسم', 'text', true], ['death', 'سنة الوفاة (هـ)', 'number'], ['note', 'ملاحظة', 'area']], usedBy: (a) => L().books.filter((b) => b.authorId === a.id).length, sub: (a) => (a.death ? 'ت ' + S.n(a.death) + ' هـ' : '') },
    publishers: { title: 'الناشرون', fields: [['name', 'الاسم', 'text', true], ['country', 'البلد', 'text'], ['note', 'ملاحظة', 'area']], usedBy: (a) => L().books.filter((b) => S.norm(b.publisher) === S.norm(a.name)).length, sub: (a) => a.country || '' },
    sources: { title: 'المصادر والمكتبات الرقمية', fields: [['name', 'الاسم', 'text', true], ['url', 'الرابط', 'text'], ['kind', 'النوع', 'text'], ['note', 'ملاحظة', 'area']], usedBy: (a) => L().books.filter((b) => b.sourceName === a.name).length, sub: (a) => a.url || '' }
  };
  Object.keys(ENT).forEach((k) => {
    S.router.add('/admin/' + k, async () => {
      const g = need('books.edit', ENT[k].title); if (g) return g; const rows = (await S.db.all(k)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      return { title: ENT[k].title, nav: 'more', back: '/admin', actions: [{ icon: 'plus', label: 'إضافة', act: 'entEdit', attrs: `data-k="${k}"` }], html: S.h`<div class="stack"><div class="small muted">${S.n(rows.length)} سجل</div><div class="list">${rows.map((r) => S.h`<button class="li" data-act="entEdit" data-k="${k}" data-id="${r.id}"><span class="li-body"><span class="li-t">${r.name}</span><span class="li-s">${ENT[k].sub(r)} ${ENT[k].usedBy(r) ? '• ' + S.n(ENT[k].usedBy(r)) + ' كتاب' : ''}</span></span>${S.icon('edit')}</button>`)}</div></div>` };
    });
  });
  S.act('entEdit', async (el) => {
    const k = el.dataset.k; const E = ENT[k]; const rec = el.dataset.id ? await S.db.get(k, el.dataset.id) : { id: '' };
    S.modal({
      title: rec.id ? 'تعديل' : 'إضافة', body: S.h`${E.fields.map(([n, l, t, req]) => (t === 'area' ? S.f.area(n, l, rec[n] || '', { rows: 3 }) : S.f.text(n, l, rec[n] == null ? '' : rec[n], { type: t, required: req })))}`,
      actions: [{ label: 'إلغاء', cls: 'ghost' }].concat(rec.id ? [{ label: 'حذف', cls: 'danger', onClick: async () => { if (E.usedBy(rec)) { S.toast('مرتبط بكتب (' + S.n(E.usedBy(rec)) + ') — لا يمكن الحذف', 'err'); return false; } await S.db.del(k, rec.id); if (k === 'authors') L().authors.delete(rec.id); await S.audit(k + '.delete', rec.name); S.router.refresh(); } }] : []).concat([{ label: 'حفظ', cls: 'primary', onClick: async (box) => {
        const d = S.f.read(box); if (!String(d.name || '').trim()) { S.toast('الاسم مطلوب', 'err'); return false; } if (k === 'sources' && d.url && !/^https?:\/\//i.test(d.url)) { S.toast('الرابط يجب أن يبدأ بـ http(s)', 'err'); return false; }
        const nr = Object.assign({}, rec, d, { id: rec.id || S.uid(k[0]) }); await S.db.put(k, nr); if (k === 'authors') { L().authors.set(nr.id, nr); L().books.forEach((b) => { if (b.authorId === nr.id) { b.author = nr.name; b.authorDeath = nr.death; S.db.put('books', b); } }); L().reindex(); } await S.audit(k + (rec.id ? '.edit' : '.add'), nr.name); S.router.refresh();
      } }])
    });
  });

  /* ---------------- الأدعية والزيارات ---------------- */
  const KIND_OPT = [{ v: 'dua', t: 'دعاء' }, { v: 'ziyarah', t: 'زيارة' }, { v: 'collection', t: 'مجموعة/كتاب' }];
  S.router.add('/admin/duas', async () => {
    const g = need('content.edit', 'الأدعية'); if (g) return g; const rows = await S.duas.all();
    return { title: 'إدارة الأدعية والزيارات', nav: 'more', back: '/admin', actions: [{ icon: 'plus', label: 'إضافة', href: '#/admin/dua/new' }, { icon: 'upload', label: 'استيراد', href: '#/admin/duas/import' }], html: S.h`<div class="stack"><div class="small muted">${S.n(rows.filter((r) => r.textStatus === 'documented').length)} نص موثق من ${S.n(rows.length)}</div><div class="list">${rows.map((d) => S.h`<a class="li" href="#/admin/dua/${d.id}"><span class="li-body"><span class="li-t">${d.title}</span><span class="li-s">${(S.duas.cats().find((c) => c.id === d.cat) || {}).title || ''}</span></span><span class="li-end">${d.textStatus === 'documented' ? S.ui.badge('موثق', 'ok') : d.textStatus === 'demo' ? S.ui.badge('اختبار', 'info') : S.ui.badge('عنوان فقط', 'warn')}</span></a>`)}</div></div>` };
  });
  S.router.add('/admin/dua/:id', async (p) => {
    const g = need('content.edit', 'دعاء'); if (g) return g; const isNew = p.id === 'new'; const d = isNew ? { id: '', title: '', kind: 'dua', cat: 'daily', text: '', textSource: {}, commonSource: '', note: '' } : await S.db.get('duas', p.id);
    if (!d) return { title: 'دعاء', back: '/admin/duas', html: S.ui.empty('alert', 'غير موجود') }; const ts = d.textSource || {};
    return {
      title: isNew ? 'إضافة دعاء/زيارة' : 'تحرير: ' + d.title, nav: 'more', back: '/admin/duas',
      html: S.h`<div class="stack" id="duaform" data-id="${d.id}">${S.ui.notice('warn', 'قاعدة التوثيق', 'لا يُقبل نص دعاء أو زيارة بلا اسم الكتاب المصدر ورقم الصفحة أو الجزء أو رابط. انسخ النص من طبعة معتمدة ولا تعتمد على الذاكرة.')}
        <div class="card">${S.f.text('title', 'العنوان', d.title, { required: true })}${S.f.select('kind', 'النوع', KIND_OPT, d.kind)}${S.f.select('cat', 'التصنيف', S.duas.cats().map((c) => ({ v: c.id, t: c.title })), d.cat)}${S.f.text('commonSource', 'المصدر الشائع (وصف)', d.commonSource)}${S.f.area('text', 'النص (سطر لكل مقطع)', d.textStatus === 'demo' ? '' : d.text, { rows: 10 })}</div>
        <div class="card"><div class="card-t">${S.icon('link')} مصدر النص</div>${S.f.text('book', 'الكتاب', ts.book)}${S.f.text('author', 'المؤلف/المحقق', ts.author)}${S.f.text('edition', 'الطبعة', ts.edition)}<div class="grid3">${S.f.text('part', 'الجزء', ts.part)}${S.f.text('page', 'الصفحة', ts.page)}${S.f.text('url', 'رابط', ts.url, { ltr: true })}</div></div>
        <div class="card"><div class="card-t">${S.icon('volume')} تسجيل صوتي (اختياري)</div>${S.f.file('audio', 'ملف صوتي', 'audio/*', d.audio ? 'يوجد ملف محفوظ؛ اختر ملفاً لاستبداله' : 'لا تُرفع تسجيلات دون إذن صاحبها')}${S.f.text('audioNote', 'مصدر/ترخيص التسجيل', d.audioNote || '')}</div>
        ${S.f.text('note', 'ملاحظة', d.note)}
        <button class="btn primary block" data-act="admSaveDua">${S.icon('check')} حفظ</button>${!isNew && Auth.isOwner() ? S.h`<button class="btn danger block" data-act="admDelDua" data-id="${d.id}">حذف</button>` : ''}</div>`
    };
  });
  S.act('admSaveDua', async () => {
    const root = S.$('#duaform'); const x = S.f.read(root); const id = root.dataset.id; const old = id ? await S.db.get('duas', id) : null;
    const rec = Object.assign({}, old || {}, { id: id || S.uid('d'), title: x.title.trim(), kind: x.kind, cat: x.cat, commonSource: x.commonSource, text: x.text.trim(), note: x.note, textSource: { book: x.book.trim(), author: x.author.trim(), edition: x.edition.trim(), part: x.part.trim(), page: x.page.trim(), url: x.url.trim() }, audioNote: x.audioNote, demo: false });
    const errs = S.duas.validate(rec); if (errs.length) return S.toast(errs[0], 'err'); if (rec.textSource.url && !/^https?:\/\//i.test(rec.textSource.url)) return S.toast('الرابط يجب أن يبدأ بـ http(s)', 'err');
    rec.textStatus = rec.text ? 'documented' : 'missing'; if (!rec.text) rec.textSource = old && old.textSource && !old.text ? old.textSource : null;
    if (x.audio) { if (!/^audio\//.test(x.audio.type)) return S.toast('الملف ليس صوتياً', 'err'); if (x.audio.size > 25 * 1048576) return S.toast('الحد 25 ميغابايت', 'err'); await S.files.put('dua-audio:' + rec.id, x.audio); rec.audio = 'dua-audio:' + rec.id; }
    await S.db.put('duas', rec); await S.audit(old ? 'dua.edit' : 'dua.add', rec.title, rec.textStatus); S.toast('حُفظ', 'ok'); S.router.go('/admin/duas');
  });
  S.act('admDelDua', async (el) => { if (await S.confirm('حذف هذا العنصر؟', { danger: true })) { await S.db.del('duas', el.dataset.id); await S.audit('dua.delete', el.dataset.id); S.router.go('/admin/duas'); } });
  const DUA_TPL = [{ title: 'عنوان الدعاء', kind: 'dua', cat: 'daily', text: 'السطر الأول\nالسطر الثاني', textSource: { book: 'اسم الكتاب', author: 'المؤلف', edition: 'الطبعة', part: '', page: '123', url: '' } }];
  S.router.add('/admin/duas/import', () => {
    const g = need('content.edit', 'استيراد'); if (g) return g;
    return { title: 'استيراد أدعية', nav: 'more', back: '/admin/duas', html: S.h`<div class="stack">${S.ui.notice('info', 'الصيغة', 'ملف JSON مصفوفة عناصر: title وkind وcat وtext وtextSource{book,page|part|url}. العناصر بلا مصدر تُرفض ولا تُحفظ.')}<button class="btn" data-act="tplDownload" data-k="dua">${S.icon('download')} تنزيل قالب</button>${S.f.file('jf', 'ملف JSON', 'application/json,.json')}<button class="btn primary block" data-act="admImportDuas">${S.icon('upload')} استيراد</button><div id="imp-out"></div></div>` };
  });
  S.act('tplDownload', (el) => { const t = el.dataset.k === 'dua' ? DUA_TPL : BOOK_TPL; S.download(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' }), 'siraj-' + el.dataset.k + '-template.json'); });
  S.act('admImportDuas', async (el) => {
    const f = S.$('[name=jf]').files[0]; if (!f) return S.toast('اختر ملفاً', 'err'); let arr; try { arr = JSON.parse(await S.readFile(f, 'text')); } catch (e) { return S.toast('JSON غير صالح', 'err'); } if (!Array.isArray(arr)) return S.toast('يجب أن يكون الملف مصفوفة', 'err');
    let ok = 0; const bad = []; for (const [i, x] of arr.entries()) { const rec = { id: S.uid('d'), title: String(x.title || '').trim(), kind: x.kind || 'dua', cat: x.cat || 'daily', text: String(x.text || '').trim(), textSource: x.textSource || {}, commonSource: x.commonSource || '', note: x.note || '', demo: false }; const e = S.duas.validate(rec); if (e.length || !rec.text) { bad.push('#' + (i + 1) + ' ' + (rec.title || '؟') + ': ' + (e[0] || 'لا نص')); continue; } rec.textStatus = 'documented'; await S.db.put('duas', rec); ok++; }
    await S.audit('dua.import', f.name, ok + ' ok, ' + bad.length + ' rejected'); S.$('#imp-out').innerHTML = `<div class="notice ${bad.length ? 'warn' : 'ok'}"><div><b>أُضيف ${ok}</b>${bad.length ? '<br>رُفض ' + bad.length + ':<br>' + bad.slice(0, 15).map(esc).join('<br>') : ''}</div></div>`;
  });

  /* ---------------- استيراد كتب ---------------- */
  const BOOK_TPL = [{ title: 'عنوان الكتاب', author: 'اسم المؤلف', section: 'fiqh', subcat: 'الصلاة', desc: 'نبذة', publisher: '', year: null, edition: '', pages: null, sourceName: 'اسم المصدر', sourceUrl: 'https://example.org/book', copyright: 'غير محدد' }];
  S.router.add('/admin/import', () => {
    const g = need('backup.manage', 'استيراد الكتب'); if (g) return g;
    return { title: 'استيراد كتب', nav: 'more', back: '/admin', html: S.h`<div class="stack">${S.ui.notice('warn', 'لا نشر تلقائي', 'الكتب المستوردة تدخل طابور الموافقة بحالة «بانتظار الموافقة» ولا تُنشر مباشرة. تُفحص التكرارات والأقسام قبل الإدخال.')}<button class="btn" data-act="tplDownload" data-k="book">${S.icon('download')} تنزيل قالب</button>${S.f.file('jf', 'ملف JSON', 'application/json,.json')}<button class="btn primary block" data-act="admImportBooks">${S.icon('upload')} استيراد</button><div id="imp-out"></div></div>` };
  });
  S.act('admImportBooks', async () => {
    const f = S.$('[name=jf]').files[0]; if (!f) return S.toast('اختر ملفاً', 'err'); let arr; try { arr = JSON.parse(await S.readFile(f, 'text')); } catch (e) { return S.toast('JSON غير صالح', 'err'); } if (!Array.isArray(arr)) return S.toast('يجب أن يكون الملف مصفوفة', 'err');
    let ok = 0; const skipped = []; for (const [i, x] of arr.entries()) {
      const t = String(x.title || '').trim(), au = String(x.author || '').trim(); if (!t || !au || !S.sectionById[x.section]) { skipped.push('#' + (i + 1) + ' بيانات ناقصة أو قسم غير معروف'); continue; }
      if (L().findDuplicates(t, au).length) { skipped.push('#' + (i + 1) + ' «' + t + '» مكرر'); continue; }
      const a = await authorFor(au, x.authorDeath); const b = { id: S.uid('b'), title: t, author: a.name, authorId: a.id, authorDeath: a.death, section: x.section, subcat: x.subcat || '', desc: x.desc || '', tags: x.tags || [], publisher: x.publisher || '', year: x.year || null, edition: x.edition || '', pages: x.pages || null, lang: x.lang || 'العربية', sourceName: x.sourceName || '', sourceUrl: /^https?:\/\//i.test(x.sourceUrl || '') ? x.sourceUrl : '', copyright: COPY.some((c) => c.v === x.copyright) ? x.copyright : 'غير محدد', digitalUrl: '', reviewStatus: 'مستورد من ملف — بانتظار المراجعة', addedAt: new Date().toISOString(), status: 'pending', demo: false, hasPdf: false, hasCover: false, allowDownload: false, reads: 0, downloads: 0, aiNote: 'مستورد يدوياً من ملف JSON: ' + f.name };
      await L().save(b); ok++;
    }
    await S.audit('book.import', f.name, ok + ' ok, ' + skipped.length + ' skipped'); S.$('#imp-out').innerHTML = `<div class="notice ${skipped.length ? 'warn' : 'ok'}"><div><b>أُدخل ${ok} كتاباً إلى طابور الموافقة</b>${skipped.length ? '<br>تخطّي ' + skipped.length + ':<br>' + skipped.slice(0, 15).map(esc).join('<br>') : ''}</div></div>`;
  });

  /* ---------------- القرآن والصوتيات والإشعارات ---------------- */
  S.router.add('/admin/quran', async () => {
    const g = need('content.edit', 'القرآن'); if (g) return g; const au = await S.db.all('audio');
    return { title: 'إدارة القرآن والتلاوات', nav: 'more', back: '/admin', html: S.h`<div class="stack"><div class="card"><div class="card-t">${S.icon('book-open')} نص المصحف</div><div class="kv"><span>الحالة</span><b>${S.quran.hasText() ? 'محمّل ومتحقَّق' : 'غير محمّل'}</b></div><p class="small muted nm">لا يُحرَّر نص القرآن يدوياً في سِراج؛ يُجلب من مصدر موثق ويُتحقق منه. لا يوجد حقل لتعديل الآيات عمداً.</p><a class="btn block mt" href="#/quran/download">إدارة التنزيل والتحقق</a></div>
      <div class="card"><div class="card-t">${S.icon('volume')} التلاوات</div><div class="kv"><span>ملفات مخزّنة على هذا الجهاز</span><b>${S.n(au.length)}</b></div><div class="kv"><span>القرّاء المتاحون</span><b>${S.n(S.quran.reciters().length)}</b></div><p class="small muted nm">المصدر: cdn.islamic.network (بثّ). يمكن لكل مستخدم تنزيل السور على جهازه. رفع تلاوات مرخّصة خاصة بك: من «الصوتيات».</p></div></div>` };
  });
  S.router.add('/admin/audio', async () => {
    const g = need('audio.manage', 'الصوتيات'); if (g) return g; const rows = (await S.db.all('audiolib')).sort((a, b) => b.ts - a.ts);
    const urls = rows.map((r) => (r.blob ? URL.createObjectURL(r.blob) : null));
    return { title: 'مكتبة الصوتيات', nav: 'more', back: '/admin', html: S.h`<div class="stack"><div class="card"><div class="card-t">${S.icon('upload')} إضافة تسجيل</div>${S.f.text('atitle', 'العنوان', '', { required: true })}${S.f.select('akind', 'النوع', [{ v: 'recitation', t: 'تلاوة' }, { v: 'dua', t: 'دعاء/زيارة' }, { v: 'lecture', t: 'محاضرة' }, { v: 'adhan', t: 'أذان' }], 'recitation')}${S.f.text('aby', 'القارئ/المتحدث', '')}${S.f.text('alic', 'المصدر والترخيص (مطلوب)', '', { required: true })}${S.f.file('afile', 'ملف صوتي', 'audio/*')}<button class="btn primary block" data-act="admAddAudio">${S.icon('check')} إضافة</button></div>
      ${rows.length ? rows.map((r, i) => S.h`<div class="card"><div class="row between"><b>${r.title}</b><button class="btn xs danger" data-act="admDelAudio" data-id="${r.id}">حذف</button></div><div class="small muted">${r.by || ''} • ${r.kind} • ${S.fmt.bytes(r.size)}</div>${urls[i] ? S.h`<audio controls preload="none" src="${urls[i]}" style="width:100%"></audio>` : ''}<div class="tiny muted">الترخيص: ${r.license}</div></div>`) : S.ui.empty('volume', 'لا تسجيلات', 'أضف تسجيلات مرخّصة لتظهر في «المكتبة الصوتية».')}</div>` };
  });
  S.act('admAddAudio', async () => {
    const root = S.$('.view'); const d = S.f.read(root); if (!d.atitle.trim() || !d.alic.trim()) return S.toast('العنوان والمصدر/الترخيص مطلوبان', 'err'); if (!d.afile || !/^audio\//.test(d.afile.type)) return S.toast('اختر ملفاً صوتياً', 'err'); if (d.afile.size > 40 * 1048576) return S.toast('الحد 40 ميغابايت', 'err');
    await S.db.put('audiolib', { id: S.uid('au'), title: d.atitle.trim(), kind: d.akind, by: d.aby.trim(), license: d.alic.trim(), blob: d.afile, size: d.afile.size, ts: Date.now() }); await S.audit('audio.add', d.atitle); S.toast('أُضيف', 'ok'); S.router.refresh();
  });
  S.act('admDelAudio', async (el) => { if (await S.confirm('حذف التسجيل؟', { danger: true })) { await S.db.del('audiolib', el.dataset.id); await S.audit('audio.delete', el.dataset.id); S.router.refresh(); } });
  S.router.add('/admin/notify', async () => {
    const g = need('notifications.manage', 'الإشعارات'); if (g) return g; const rows = (await S.notify.list()).slice(0, 20);
    return { title: 'الإشعارات', nav: 'more', back: '/admin', html: S.h`<div class="stack">${S.ui.notice('warn', 'غير مربوط بخادم', 'الإشعار هنا يُحفظ في هذا الجهاز فقط. إرسال إشعارات لمستخدمين آخرين يتطلب خادماً (Supabase + Push) وهو غير موصول في هذه النسخة.')}<div class="card">${S.f.text('ntitle', 'العنوان', '')}${S.f.area('nbody', 'النص', '', { rows: 3 })}<button class="btn primary block" data-act="admNotify">${S.icon('bell')} إضافة إشعار محلي</button></div><div class="list">${rows.map((n) => S.h`<div class="li"><span class="li-body"><span class="li-t">${n.title}</span><span class="li-s">${n.body || ''}</span></span><span class="li-end tiny">${S.fmt.dt(n.ts)}</span></div>`)}</div></div>` };
  });
  S.act('admNotify', async () => { const d = S.f.read(S.$('.view')); if (!d.ntitle.trim()) return S.toast('اكتب العنوان', 'err'); await S.notify.add({ title: d.ntitle.trim(), body: d.nbody.trim(), kind: 'info' }); await S.audit('notify.add', d.ntitle); S.toast('أُضيف', 'ok'); S.router.refresh(); });

  /* ---------------- الإحصاءات ---------------- */
  S.router.add('/admin/stats', async () => {
    const g = need('stats.view', 'الإحصاءات'); if (g) return g; const bs = L().books; const by = {}; S.sections.forEach((s) => (by[s.id] = 0)); bs.filter((b) => b.status === 'published').forEach((b) => (by[b.section] = (by[b.section] || 0) + 1));
    const top = bs.slice().sort((a, b) => (b.reads || 0) - (a.reads || 0)).filter((b) => b.reads).slice(0, 8); const dl = bs.slice().sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).filter((b) => b.downloads).slice(0, 5);
    const favs = await S.db.where('favorites', 'type', 'book'); const fc = {}; favs.forEach((f) => (fc[f.ref] = (fc[f.ref] || 0) + 1)); const topFav = Object.entries(fc).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const info = await S.storageInfo(); const mx = Math.max(1, ...Object.values(by));
    return { title: 'الإحصاءات', nav: 'more', back: '/admin', html: S.h`<div class="stack"><div class="small muted">إحصاءات هذا الجهاز فقط (لا خادم لجمع إحصاءات المستخدمين).</div><div class="grid2"><div class="stat"><b>${S.n(bs.length)}</b><span>الكتب</span></div><div class="stat"><b>${S.n(bs.filter((b) => b.hasPdf).length)}</b><span>كتب بملف PDF</span></div><div class="stat"><b>${S.n(L().authors.size)}</b><span>المؤلفون</span></div><div class="stat"><b>${S.n(favs.length)}</b><span>مفضلة كتب</span></div></div>
      <div class="card"><div class="card-t">${S.icon('chart')} المنشور حسب القسم</div>${S.sections.map((s) => S.h`<div class="kv"><span>${s.title}</span><b>${S.n(by[s.id] || 0)}</b></div><div class="bar"><i style="width:${(by[s.id] || 0) / mx * 100}%"></i></div>`)}</div>
      <div class="card"><div class="card-t">${S.icon('eye')} الأكثر قراءة</div>${top.length ? top.map((b) => S.h`<div class="kv"><a href="#/library/book/${b.id}">${b.title}</a><b>${S.n(b.reads)}</b></div>`) : S.h`<p class="small muted nm">لا قراءات بعد.</p>`}</div>
      <div class="card"><div class="card-t">${S.icon('download')} الأكثر تنزيلاً</div>${dl.length ? dl.map((b) => S.h`<div class="kv"><span>${b.title}</span><b>${S.n(b.downloads)}</b></div>`) : S.h`<p class="small muted nm">لا تنزيلات.</p>`}</div>
      <div class="card"><div class="card-t">${S.icon('heart')} الأكثر تفضيلاً</div>${topFav.length ? topFav.map(([id, n]) => S.h`<div class="kv"><span>${(L().byId.get(id) || { title: id }).title}</span><b>${S.n(n)}</b></div>`) : S.h`<p class="small muted nm">لا مفضلة.</p>`}</div>
      <div class="card"><div class="card-t">${S.icon('database')} التخزين</div><div class="kv"><span>المستخدم</span><b class="op-ltr">${S.fmt.bytes(info.usage)}</b></div><div class="kv"><span>الحصة</span><b class="op-ltr">${S.fmt.bytes(info.quota)}</b></div></div></div>` };
  });

  /* ---------------- المستخدمون والصلاحيات ---------------- */
  S.router.add('/admin/users', async () => {
    const g = need('users.manage', 'المستخدمون'); if (g) return g; const users = await S.db.all('users'); const roles = S.data.sample.roles;
    return { title: 'المستخدمون والصلاحيات', nav: 'more', back: '/admin', actions: [{ icon: 'plus', label: 'مستخدم جديد', act: 'userEdit' }], html: S.h`<div class="stack">${S.ui.notice('warn', 'نظام تجريبي محلي', 'هذه الحسابات موجودة في متصفحك فقط. لا تُستخدم لحماية بيانات حقيقية.')}<div class="list">${users.map((u) => S.h`<button class="li" data-act="userEdit" data-id="${u.id}"><span class="li-body"><span class="li-t">${u.name}</span><span class="li-s op-ltr">${u.username}</span></span><span class="li-end">${S.ui.badge(roles[u.role].title, u.role === 'owner' ? 'gold' : '')} ${u.active === false ? S.ui.badge('معطّل', 'bad') : ''}</span></button>`)}</div>
      <div class="card"><div class="card-t">${S.icon('shield')} مصفوفة الصلاحيات</div><div class="table-wrap"><table class="tbl"><tr><th>الصلاحية</th>${Object.entries(roles).filter(([k]) => k !== 'user').map(([, r]) => S.h`<th>${r.title}</th>`)}</tr>${Object.keys(CAPS).map((c) => S.h`<tr><td>${CAPS[c]}</td>${Object.entries(roles).filter(([k]) => k !== 'user').map(([, r]) => S.h`<td>${r.caps.includes('*') || r.caps.includes(c) ? '✓' : '—'}</td>`)}</tr>`)}</table></div></div></div>` };
  });
  S.act('userEdit', async (el) => {
    const u = el.dataset.id ? await S.db.get('users', el.dataset.id) : null; const roles = S.data.sample.roles;
    S.modal({
      title: u ? 'تعديل مستخدم' : 'مستخدم جديد',
      body: S.h`${S.f.text('name', 'الاسم', u ? u.name : '', { required: true })}${S.f.text('username', 'اسم الدخول', u ? u.username : '', { ltr: true })}${S.f.select('role', 'الدور', Object.entries(roles).map(([k, v]) => ({ v: k, t: v.title })), u ? u.role : 'editor')}${S.f.text('pin', u ? 'رمز جديد (اتركه فارغاً للإبقاء)' : 'الرمز (4 أرقام فأكثر)', '', { type: 'password', ltr: true, inputmode: 'numeric' })}<div class="field"><label>صلاحيات إضافية لهذا المستخدم</label>${Object.keys(CAPS).map((c) => S.f.check('cap_' + c, CAPS[c], u && (u.grants || []).includes(c)))}</div>${S.f.check('active', 'الحساب مفعّل', u ? u.active !== false : true)}`,
      actions: [{ label: 'إلغاء', cls: 'ghost' }].concat(u && u.id !== cur.id && u.role !== 'owner' ? [{ label: 'حذف', cls: 'danger', onClick: async () => { await S.db.del('users', u.id); await S.audit('user.delete', u.username); S.router.refresh(); } }] : []).concat([{ label: 'حفظ', cls: 'primary', onClick: async (box) => {
        const d = S.f.read(box); const uname = d.username.trim().toLowerCase(); if (!d.name.trim() || !/^[a-z0-9_.-]{3,}$/.test(uname)) { S.toast('الاسم مطلوب واسم الدخول 3 أحرف لاتينية/أرقام فأكثر', 'err'); return false; }
        const all = await S.db.all('users'); if (all.some((x) => x.username === uname && (!u || x.id !== u.id))) { S.toast('اسم الدخول مستخدم', 'err'); return false; } if (!u && !/^\d{4,}$/.test(d.pin)) { S.toast('الرمز أرقام فقط (4 فأكثر)', 'err'); return false; } if (d.pin && !/^\d{4,}$/.test(d.pin)) { S.toast('الرمز أرقام فقط (4 فأكثر)', 'err'); return false; }
        const owners = all.filter((x) => x.role === 'owner' && x.active !== false); if (u && u.role === 'owner' && (d.role !== 'owner' || !d.active) && owners.length <= 1) { S.toast('لا بد من مالك فعّال واحد على الأقل', 'err'); return false; }
        const rec = Object.assign({}, u || { id: S.uid('u'), salt: S.uid('s') }, { name: d.name.trim(), username: uname, role: d.role, active: !!d.active, grants: Object.keys(CAPS).filter((c) => d['cap_' + c]) });
        if (d.pin) { rec.salt = S.uid('s'); rec.hash = await S.sha256(rec.salt + ':' + d.pin); } await S.db.put('users', rec); await S.audit(u ? 'user.edit' : 'user.add', uname, d.role); if (cur && rec.id === cur.id) cur = rec; S.router.refresh();
      } }])
    });
  });

  /* ---------------- سجل العمليات ---------------- */
  S.router.add('/admin/audit', async (p, q) => {
    const g = need('audit.view', 'سجل العمليات'); if (g) return g; const f = (q.f || '').trim(); let rows = (await S.db.all('audit')).sort((a, b) => b.ts - a.ts); if (f) rows = rows.filter((r) => (r.action + ' ' + r.target + ' ' + r.user).includes(f));
    return { title: 'سجل العمليات', nav: 'more', back: '/admin', actions: [{ icon: 'download', label: 'تصدير CSV', act: 'auditCsv' }], html: S.h`<div class="stack"><div class="searchbox">${S.icon('filter')}<input class="input" id="auf" value="${f}" placeholder="تصفية (مثال: book أو اسم مستخدم)"></div><div class="small muted">${S.n(rows.length)} عملية</div><div class="list">${rows.slice(0, 150).map((r) => S.h`<div class="li"><span class="li-body"><span class="li-t op-ltr" style="text-align:end">${r.action}</span><span class="li-s">${r.user} (${r.role}) — ${r.target} ${r.details || ''}</span></span><span class="li-end tiny">${S.fmt.dt(r.ts)}</span></div>`)}</div></div>`, mount() { const i = S.$('#auf'); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/admin/audit?f=' + encodeURIComponent(i.value)); }); } };
  });
  S.act('auditCsv', async () => { const rows = (await S.db.all('audit')).sort((a, b) => b.ts - a.ts); const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; const csv = '﻿time,user,role,action,target,details\n' + rows.map((r) => [new Date(r.ts).toISOString(), r.user, r.role, r.action, r.target, r.details].map(q).join(',')).join('\n'); S.download(new Blob([csv], { type: 'text/csv' }), 'siraj-audit.csv'); });

  /* ---------------- النسخ الاحتياطي والإعدادات ---------------- */
  S.router.add('/admin/backup', () => {
    const g = need('backup.manage', 'النسخ الاحتياطي'); if (g) return g;
    return { title: 'النسخ الاحتياطي', nav: 'more', back: '/admin', html: S.h`<div class="stack">${S.ui.notice('info', 'ماذا يحتوي؟', 'بيانات الكتب والمؤلفين والأدعية والموسوعات والمفضلة والملاحظات والإعدادات. النسخة الكاملة تتضمن ملفات PDF والأغلفة (قد تكون كبيرة). حسابات المستخدمين لا تُصدَّر افتراضياً.')}<div class="grid2"><button class="btn" data-act="backupExport" data-files="0">${S.icon('download')} نسخة بدون ملفات</button><button class="btn" data-act="backupExport" data-files="1">${S.icon('download')} نسخة كاملة</button></div>${S.f.file('bkfile', 'استعادة نسخة', 'application/json,.json')}<button class="btn block" data-act="backupImport">${S.icon('upload')} استعادة</button></div>` };
  });
  S.router.add('/admin/settings', () => {
    const g = need('settings.manage', 'إعدادات المالك'); if (g) return g; const c = ownerCfg();
    return { title: 'إعدادات المالك', nav: 'more', back: '/admin', html: S.h`<div class="stack"><div class="card"><div class="setting"><div class="sd">اشتراط موافقة المالك على النشر<small>موصى به: يبقى مفعّلاً. عند تعطيله يستطيع من يملك صلاحية المراجعة نشر الكتب.</small></div><label class="switch"><input type="checkbox" ${c.requireOwnerApproval ? S.raw('checked') : ''} data-chg="ownerApproval"><i></i></label></div>
      ${S.f.text('maxPdf', 'الحد الأقصى لحجم PDF (ميغابايت)', S.settings.maxPdfMB, { type: 'number', ltr: true })}${S.f.text('maxCover', 'الحد الأقصى لحجم الغلاف (ميغابايت)', c.maxCoverMB, { type: 'number', ltr: true })}<button class="btn primary block" data-act="admSaveSettings">حفظ</button></div></div>` };
  });
  S.onChange('ownerApproval', async (el) => { if (!el.checked && !(await S.confirm('تعطيل موافقة المالك يسمح لغيره بالنشر. هل أنت متأكد؟', { danger: true, yes: 'تعطيل' }))) { el.checked = true; return; } await S.kv.set('settings.owner', Object.assign({}, ownerCfg(), { requireOwnerApproval: el.checked })); await S.audit('settings.ownerApproval', String(el.checked)); S.toast('حُفظ', 'ok'); });
  S.act('admSaveSettings', async () => { const d = S.f.read(S.$('.view')); S.set('maxPdfMB', S.clamp(+d.maxPdf || 80, 1, 500)); await S.kv.set('settings.owner', Object.assign({}, ownerCfg(), { maxCoverMB: S.clamp(+d.maxCover || 5, 1, 20) })); await S.audit('settings.limits', d.maxPdf + '/' + d.maxCover); S.toast('حُفظ', 'ok'); });
})();

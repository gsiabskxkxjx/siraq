/* =====================================================================
   سِراج — التحكم : content.js — إدارة الكتب والمؤلفين والأدعية والسحب والإعلانات والاستيراد والنسخ الاحتياطي
   قاعدة المحتوى (من schema.js المشتركة مع سِراج): لا كتاب بلا مصدر • لا نص دعاء بلا كتاب وموضع • لا نشر تلقائي:
   كل عنصر يبدأ «مسودة» ولا يدخل الحزمة إلا إذا علّمته أنت «جاهز للنشر» بعد اجتيازه الفحص.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const SC = S.schema; const esc = S.esc; const str = SC.str;
  const tid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const D = () => S.data;
  const bundledBooks = () => D().sample.books || [], bundledAuthors = () => D().sample.authors || [], bundledDuas = () => D().duas.items || [];
  const list = (s) => S.db.all(s);
  const badge = (it) => (it.ready ? S.ui.badge('جاهز للنشر', 'ok') : S.ui.badge('مسودة', 'warn'));
  const secTitle = (id) => (S.sectionById[id] || {}).title || '';
  S.ctl = { tid, list, badge };

  /* ---------------- المؤلفون ---------------- */
  async function allAuthors() {
    const mine = (await list('authors')).map((a) => Object.assign({ mine: true }, a));
    return mine.concat(bundledAuthors().map((a) => ({ id: a.id, name: a.name, death: a.death, note: a.note, mine: false })));
  }
  /* persist=false: لا يُكتب المؤلف الجديد (يُوسم isNew) حتى يجتاز الكتاب الفحص — فلا يبقى مؤلف يتيم من كتاب مرفوض */
  async function authorFor(name, death, persist) {
    const n = S.norm(name); let a = (await allAuthors()).find((x) => S.norm(x.name) === n);
    if (!a) { a = { id: tid('pa'), name: str(name), death: death == null || death === '' ? null : +death, note: '' }; if (persist === false) a.isNew = true; else await S.db.put('authors', a); }
    return a;
  }
  S.router.add('/authors', async () => {
    const rows = (await list('authors')).sort((a, b) => a.name.localeCompare(b.name, 'ar')); const books = await list('books');
    return {
      title: 'مؤلفوك', nav: 'content', back: '/content', actions: [{ icon: 'plus', label: 'إضافة', act: 'auEdit' }],
      html: S.h`<div class="stack">${S.ui.notice('info', 'مؤلفو الحزمة', 'هنا المؤلفون الذين أضفتهم أنت. مؤلفو الكتالوج المضمّن في سِراج (' + S.n(bundledAuthors().length) + ') متاحون دون إضافة عند اختيار مؤلف الكتاب.')}
        <div class="list">${rows.length ? rows.map((a) => S.h`<button class="li" data-act="auEdit" data-id="${a.id}"><span class="li-body"><span class="li-t">${a.name}</span><span class="li-s">${a.death ? 'ت ' + S.n(a.death) + ' هـ' : ''} ${books.filter((b) => b.authorId === a.id).length ? '• ' + S.n(books.filter((b) => b.authorId === a.id).length) + ' كتاب' : ''}</span></span>${S.icon('edit')}</button>`) : S.ui.empty('users', 'لا مؤلفين مضافين بعد')}</div></div>`
    };
  });
  S.act('auEdit', async (el) => {
    const rec = el.dataset.id ? await S.db.get('authors', el.dataset.id) : { id: '', name: '', death: '', note: '' };
    S.modal({
      title: rec.id ? 'تعديل مؤلف' : 'إضافة مؤلف', body: S.h`${S.f.text('name', 'الاسم', rec.name, { required: true })}${S.f.text('death', 'سنة الوفاة (هجري، اختياري)', rec.death || '', { type: 'number', ltr: true })}${S.f.area('note', 'نبذة (اختياري، من مصدر موثوق)', rec.note || '', { rows: 3 })}`,
      actions: [{ label: 'إلغاء', cls: 'ghost' }].concat(rec.id ? [{ label: 'حذف', cls: 'danger', onClick: async () => { if ((await list('books')).some((b) => b.authorId === rec.id)) { S.toast('مرتبط بكتب — لا يمكن حذفه', 'err'); return false; } await S.db.del('authors', rec.id); S.router.refresh(); } }] : []).concat([{
        label: 'حفظ', cls: 'primary', onClick: async (box) => {
          const d = S.f.read(box); const nr = { id: rec.id || tid('pa'), name: str(d.name), death: d.death == null || d.death === '' ? null : +d.death, note: str(d.note) };
          const er = SC.validateAuthor(nr); if (er.length) { S.toast(er[0], 'err'); return false; }
          await S.db.put('authors', nr); if (rec.id) for (const b of await list('books')) if (b.authorId === nr.id) { b.author = nr.name; b.authorDeath = nr.death; await S.db.put('books', b); }
          S.router.refresh();
        }
      }])
    });
  });

  /* ---------------- الكتب ---------------- */
  const subOptions = (sec, cur) => { const s = S.sectionById[sec]; return ['<option value="">— بلا —</option>'].concat((s ? s.subcats : []).map((x) => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`)).join(''); };
  /* نسخة قابلة للتعديل من كتاب مضمّن: معرّف جديد + replaces؛ عند نشرها «جاهزة» يُسحب الأصل من سِراج تلقائياً فتحلّ محله */
  const cloneOfBook = (b, now) => ({ id: tid('pk'), title: b.title, author: b.author, authorId: b.authorId, authorDeath: b.authorDeath || null, section: b.section, subcat: b.subcat || '', desc: b.desc || '', tags: (b.tags || []).slice(), publisher: b.publisher || '', year: b.year == null ? '' : b.year, edition: b.edition || '', pages: b.pages == null ? '' : b.pages, lang: b.lang || 'العربية', sourceName: b.sourceName || '', sourceUrl: b.sourceUrl || '', digitalUrl: b.digitalUrl || '', copyright: b.copyright || 'غير محدد', ready: false, replaces: b.id, updated: now });
  S.router.add('/books', async (p, q) => {
    const term = S.norm(q.q || ''); const st = q.st || ''; const sec = q.sec || ''; const all = await list('books'); let rows = all.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const clones = new Map(all.filter((b) => b.replaces).map((b) => [b.replaces, b]));
    const url = (o) => '#/books?' + Object.entries(Object.assign({ st: st, q: q.q, sec: sec }, o)).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    const tabs = S.h`<div class="chips"><a class="chip ${!st ? 'active' : ''}" href="#/books">الكل</a><a class="chip ${st === 'ready' ? 'active' : ''}" href="#/books?st=ready">جاهز</a><a class="chip ${st === 'draft' ? 'active' : ''}" href="#/books?st=draft">مسودات</a><a class="chip ${st === 'bundled' ? 'active' : ''}" href="#/books?st=bundled">كتب سِراج المضمّنة (${S.n(bundledBooks().length)})</a></div>`;
    if (st === 'bundled') {
      let src = bundledBooks(); if (sec) src = src.filter((b) => b.section === sec); if (term) src = src.filter((b) => S.norm(b.title + ' ' + b.author).includes(term));
      const lim = Math.max(60, +q.n || 60); const todo = src.filter((b) => !clones.has(b.id)).length;
      return {
        title: 'كتب سِراج المضمّنة', nav: 'content', back: '/books',
        html: S.h`<div class="stack">${tabs}
          ${S.ui.notice('info', 'كيف أعدّل كتاباً مضمّناً؟', 'اضغط «تعديل» فيُنسخ الكتاب إلى كتبك كمسودة. عدّل بياناته وأضف مصدره، ثم علّمه «جاهز للنشر»: عند إصدار الحزمة يُسحب الأصل من سِراج ويحلّ محله تعديلك. الكتب المضمّنة بلا مصدر موثَّق، لذا لن تُقبل «جاهزة» قبل إدخال المصدر.')}
          <div class="searchbox">${S.icon('search')}<input class="input" id="bq" value="${q.q || ''}" placeholder="بحث في الكتب المضمّنة"></div>
          <div class="chips"><a class="chip ${!sec ? 'active' : ''}" href="${url({ sec: '', n: '' })}">كل الأقسام</a>${S.sections.map((x) => S.h`<a class="chip ${sec === x.id ? 'active' : ''}" href="${url({ sec: x.id, n: '' })}">${x.title}</a>`)}</div>
          <div class="row between"><span class="small muted">${S.n(src.length)} كتاب • ${S.n(src.length - todo)} منسوخ للتعديل</span>${todo ? S.h`<button class="btn xs" data-act="bkCloneAll" data-sec="${sec}" data-q="${q.q || ''}">نسخ الكل للتعديل (${S.n(todo)})</button>` : ''}</div>
          <div class="list">${src.slice(0, lim).map((b) => { const c = clones.get(b.id); return c ? S.h`<a class="li" href="#/book/${c.id}"><span class="li-body"><span class="li-t">${b.title}</span><span class="li-s">${b.author || ''} • ${secTitle(b.section)}</span></span><span class="li-end">${S.ui.badge('عندك نسخة', 'ok')}</span></a>` : S.h`<div class="li"><span class="li-body"><span class="li-t">${b.title}</span><span class="li-s">${b.author || ''} • ${secTitle(b.section)}</span></span><button class="btn xs" data-act="bkClone" data-id="${b.id}">تعديل</button></div>`; })}</div>
          ${src.length > lim ? S.h`<a class="btn block" href="${url({ n: lim + 60 })}">عرض المزيد (${S.n(src.length - lim)})</a>` : ''}</div>`,
        mount() { const f = S.$('#bq'); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/books?st=bundled&q=' + encodeURIComponent(f.value) + (sec ? '&sec=' + sec : '')); }); }
      };
    }
    if (st) rows = rows.filter((b) => (st === 'ready') === !!b.ready); if (term) rows = rows.filter((b) => S.norm(b.title + ' ' + b.author).includes(term));
    return {
      title: 'كتبك', nav: 'content', back: '/content', actions: [{ icon: 'plus', label: 'إضافة كتاب', href: '#/book/new' }],
      html: S.h`<div class="stack"><div class="searchbox">${S.icon('search')}<input class="input" id="bq" value="${q.q || ''}" placeholder="بحث في كتبك"></div>
        ${tabs}
        <div class="small muted">${S.n(rows.length)} كتاب</div>
        <div class="list">${rows.length ? rows.map((b) => S.h`<a class="li" href="#/book/${b.id}"><span class="li-body"><span class="li-t">${b.title || '(بلا عنوان)'}</span><span class="li-s">${b.author || ''} • ${secTitle(b.section)}${b.replaces ? ' • نسخة معدّلة من المضمّن' : ''}</span></span><span class="li-end">${badge(b)}</span></a>`) : S.ui.empty('library', 'لا كتب مضافة بعد', 'أضف كتاباً ببياناته ومصدره، أو عدّل كتاباً من كتب سِراج المضمّنة، أو استورد ملف JSON.', S.h`<a class="btn primary" href="#/book/new">إضافة كتاب</a> <a class="btn" href="#/books?st=bundled">كتب سِراج المضمّنة</a>`)}</div></div>`,
      mount() { const f = S.$('#bq'); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/books?q=' + encodeURIComponent(f.value) + (st ? '&st=' + st : '')); }); }
    };
  });
  S.act('bkClone', async (el) => {
    const src = bundledBooks().find((x) => x.id === el.dataset.id); if (!src) return S.toast('الكتاب غير موجود', 'err');
    const have = (await list('books')).find((x) => x.replaces === src.id); if (have) return S.router.go('/book/' + have.id);
    const rec = cloneOfBook(src, Date.now()); await S.db.put('books', rec); await S.audit('book.clone', rec.title, src.id); S.router.go('/book/' + rec.id);
  });
  S.act('bkCloneAll', async (el) => {
    const sec = el.dataset.sec || '', term = S.norm(el.dataset.q || ''); const have = new Set((await list('books')).filter((x) => x.replaces).map((x) => x.replaces));
    let src = bundledBooks().filter((b) => !have.has(b.id)); if (sec) src = src.filter((b) => b.section === sec); if (term) src = src.filter((b) => S.norm(b.title + ' ' + b.author).includes(term));
    if (!src.length) return;
    if (!(await S.confirm('سيُنسخ ' + S.n(src.length) + ' كتاب إلى كتبك كمسودات للتعديل. لا يتغير شيء في سِراج حتى تعلّم كتاباً «جاهز» وتصدر حزمة. متابعة؟', { yes: 'نسخ' }))) return;
    const now = Date.now(); await S.db.putMany('books', src.map((b, i) => cloneOfBook(b, now - i))); await S.audit('book.cloneAll', sec || 'all', String(src.length));
    S.toast('نُسخ ' + S.n(src.length) + ' كتاب', 'ok'); S.router.refresh();
  });
  S.router.add('/book/:id', async (p) => {
    const isNew = p.id === 'new'; const b = isNew ? { id: '', title: '', author: '', authorDeath: '', section: S.sections[0].id, subcat: '', desc: '', tags: [], publisher: '', year: '', edition: '', pages: '', lang: 'العربية', sourceName: '', sourceUrl: '', digitalUrl: '', copyright: 'غير محدد', ready: false } : await S.db.get('books', p.id);
    if (!b) return { title: 'كتاب', back: '/books', html: S.ui.empty('alert', 'الكتاب غير موجود') };
    const authors = await allAuthors();
    return {
      title: isNew ? 'إضافة كتاب' : 'تعديل كتاب', nav: 'content', back: '/books',
      html: S.h`<div class="stack" id="bkform" data-id="${b.id}"><div id="bk-errs"></div>
        ${b.replaces ? S.ui.notice('info', 'نسخة معدّلة من كتاب مضمّن في سِراج', 'عند نشرها «جاهزة» تحلّ محل الكتاب الأصلي في سِراج، ويُسحب الأصل تلقائياً. أضف المصدر الذي أخذت منه البيانات.') : ''}
        ${S.ui.notice('warn', 'قاعدة التوثيق', 'بيانات ببليوغرافية فقط (لا ملفات كتب). المصدر مطلوب: من أين أخذت بيانات هذا الكتاب؟ لا تكتب معلومة لا تستطيع نسبتها لمصدر.')}
        <div class="card">${S.f.text('title', 'عنوان الكتاب', b.title, { required: true })}
          <div class="field"><label>المؤلف <span class="bad">*</span></label><input class="input" name="author" list="authlist" value="${b.author}" autocomplete="off"><datalist id="authlist">${authors.map((a) => S.h`<option value="${a.name}"></option>`)}</datalist><span class="hint">اختر من القائمة (مؤلفو الكتالوج ومؤلفوك) أو اكتب اسماً جديداً فيُنشأ.</span></div>
          ${S.f.text('authorDeath', 'سنة وفاة المؤلف (هجري، لمؤلف جديد فقط)', b.authorDeath || '', { type: 'number', ltr: true })}
          ${S.f.select('section', 'القسم', S.sections.map((s) => ({ v: s.id, t: s.title })), b.section, { chg: 'bkSection' })}
          <div class="field"><label>التصنيف الفرعي</label><select class="select" name="subcat" id="f_subcat">${S.raw(subOptions(b.section, b.subcat))}</select></div>
          ${S.f.area('desc', 'نبذة تعريفية', b.desc, { rows: 3 })}${S.f.text('tags', 'وسوم (مفصولة بفاصلة)', (b.tags || []).join('، '))}</div>
        <div class="card"><div class="card-t">${S.icon('list')} الببليوغرافيا</div>${S.f.text('publisher', 'دار النشر', b.publisher)}
          <div class="grid3">${S.f.text('year', 'سنة النشر', b.year || '', { type: 'number', ltr: true })}${S.f.text('edition', 'الطبعة', b.edition)}${S.f.text('pages', 'الصفحات', b.pages || '', { type: 'number', ltr: true })}</div>${S.f.text('lang', 'اللغة', b.lang)}</div>
        <div class="card"><div class="card-t">${S.icon('link')} المصدر والحقوق <span class="bad">*</span></div>
          ${S.f.text('sourceName', 'اسم المصدر (فهرس/موقع/طبعة)', b.sourceName)}${S.f.text('sourceUrl', 'رابط المصدر', b.sourceUrl, { ltr: true, placeholder: 'https://' })}${S.f.text('digitalUrl', 'رابط نسخة رقمية قانونية (اختياري)', b.digitalUrl, { ltr: true })}
          ${S.f.select('copyright', 'حالة حقوق النشر', SC.COPY.map((c) => ({ v: c.v, t: c.v })), b.copyright)}
          <p class="tiny muted nm">لا تُنشر ملفات كتب عبر الحزم؛ الرابط الخارجي فقط.</p></div>
        <div class="card">${S.f.check('ready', 'جاهز للنشر (يدخل الحزمة القادمة)', b.ready)}<p class="tiny muted nm">يُفحص الكتاب عند الحفظ؛ إن لم يجتز الفحص يُحفظ مسودة.</p></div>
        <button class="btn primary block" data-act="bkSave">${S.icon('check')} حفظ</button>
        ${!isNew ? S.h`<button class="btn danger block" data-act="bkDel" data-id="${b.id}">${S.icon('trash')} حذف الكتاب</button>` : ''}</div>`
    };
  });
  S.onChange('bkSection', (el) => { S.$('#f_subcat').innerHTML = subOptions(el.value, ''); });
  function showErrs(id, title, errs) { const box = S.$(id); if (!box) return; box.innerHTML = '<div class="notice err"><div><b>' + esc(title) + '</b><ul class="err-list">' + errs.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>'; box.scrollIntoView({ block: 'center' }); }
  S.act('bkSave', async () => {
    const root = S.$('#bkform'); const d = S.f.read(root); const id = root.dataset.id; const old = id ? await S.db.get('books', id) : null;
    if (!str(d.title)) return S.toast('العنوان مطلوب', 'err');
    let a = { id: '', name: str(d.author), death: null };
    if (str(d.author)) a = await authorFor(d.author, d.authorDeath);
    const rec = { id: id || tid('pk'), title: str(d.title), author: a.name, authorId: a.id, authorDeath: a.death || null, section: d.section, subcat: d.subcat, desc: str(d.desc), tags: d.tags.split(/[,،]/).map((x) => x.trim()).filter(Boolean), publisher: str(d.publisher), year: d.year, edition: str(d.edition), pages: d.pages, lang: str(d.lang) || 'العربية', sourceName: str(d.sourceName), sourceUrl: str(d.sourceUrl), digitalUrl: str(d.digitalUrl), copyright: d.copyright, ready: !!d.ready, updated: Date.now() };
    const errs = SC.validateBook(rec); if (!rec.authorId) errs.push('المؤلف مطلوب');
    if (!old) { const k = S.norm(rec.title) + '|' + S.norm(rec.author); const dup = bundledBooks().find((x) => S.norm(x.title) + '|' + S.norm(x.author) === k) || (await list('books')).find((x) => S.norm(x.title) + '|' + S.norm(x.author) === k); if (dup && !(await S.confirm('يوجد كتاب مطابق: «' + dup.title + '». هل تريد المتابعة رغم التكرار؟', { yes: 'متابعة' }))) return; }
    if (errs.length) { if (rec.ready) { rec.ready = false; showErrs('#bk-errs', 'لا يمكن وسمه «جاهز» — يُحفظ مسودة حتى تُصلح:', errs); } else showErrs('#bk-errs', 'ملاحظات للإكمال قبل النشر:', errs); }
    await S.db.put('books', Object.assign({}, old || {}, rec)); root.dataset.id = rec.id; /* بقاء المستخدم في النموذج: الحفظ التالي تعديل لا نسخة جديدة */ await S.audit(old ? 'book.edit' : 'book.add', rec.title, rec.ready ? 'ready' : 'draft');
    S.toast(rec.ready ? 'حُفظ وهو جاهز للنشر' : 'حُفظ كمسودة', 'ok'); if (!errs.length) S.router.go('/books');
  });
  S.act('bkDel', async (el) => { if (!(await S.confirm('حذف هذا الكتاب من مسودات الناشر؟ (لا يسحبه من سِراج إن كان منشوراً؛ سيُحذف هناك في الحزمة القادمة)', { danger: true, yes: 'حذف' }))) return; await S.db.del('books', el.dataset.id); S.router.go('/books'); });

  /* ---------------- الأدعية والزيارات ---------------- */
  const KIND_OPT = [{ v: 'dua', t: 'دعاء' }, { v: 'ziyarah', t: 'زيارة' }, { v: 'collection', t: 'مجموعة/كتاب' }];
  const cats = () => D().duas.categories;
  S.router.add('/duas', async () => {
    const rows = (await list('duas')).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return {
      title: 'أدعيتك وزياراتك', nav: 'content', back: '/content', actions: [{ icon: 'plus', label: 'إضافة', href: '#/dua/new' }],
      html: S.h`<div class="stack">${S.ui.notice('warn', 'من كتاب لا من الذاكرة', 'لا يُقبل نص دعاء أو زيارة بلا اسم الكتاب ورقم الصفحة أو الجزء أو رابط. انسخ النص من طبعة معتمدة بحروفه.')}<div class="small muted">${S.n(rows.length)} عنصر</div>
        <div class="list">${rows.length ? rows.map((d) => S.h`<a class="li" href="#/dua/${d.id}"><span class="li-body"><span class="li-t">${d.title || '(بلا عنوان)'}</span><span class="li-s">${(cats().find((c) => c.id === d.cat) || {}).title || ''}${d.replaces ? ' • نسخة معدّلة من المضمّن' : ''}</span></span><span class="li-end">${badge(d)}</span></a>`) : S.ui.empty('heart-handshake', 'لا أدعية مضافة بعد', '', S.h`<a class="btn primary" href="#/dua/new">إضافة دعاء</a>`)}</div>
        <div class="card"><div class="card-t">${S.icon('library')} أدعية سِراج المضمّنة (${S.n(bundledDuas().length)})</div><p class="small muted nm">اضغط «تعديل» لنسخ العنصر إلى أدعيتك ثم أضف النص من طبعة معتمدة مع مصدره. عند نشره «جاهزاً» يحلّ محل الأصل.</p>
          <div class="list">${bundledDuas().map((d) => { const c = rows.find((x) => x.replaces === d.id); return c ? S.h`<a class="li" href="#/dua/${c.id}"><span class="li-body"><span class="li-t">${d.title}</span></span><span class="li-end">${S.ui.badge('عندك نسخة', 'ok')}</span></a>` : S.h`<div class="li"><span class="li-body"><span class="li-t">${d.title}</span><span class="li-s">${(cats().find((x) => x.id === d.cat) || {}).title || ''}</span></span><button class="btn xs" data-act="duaClone" data-id="${d.id}">تعديل</button></div>`; })}</div></div></div>`
    };
  });
  S.router.add('/dua/:id', async (p) => {
    const isNew = p.id === 'new'; const d = isNew ? { id: '', title: '', kind: 'dua', cat: 'daily', text: '', textSource: {}, commonSource: '', note: '', ready: false } : await S.db.get('duas', p.id);
    if (!d) return { title: 'دعاء', back: '/duas', html: S.ui.empty('alert', 'غير موجود') }; const ts = d.textSource || {};
    return {
      title: isNew ? 'إضافة دعاء/زيارة' : 'تحرير: ' + d.title, nav: 'content', back: '/duas',
      html: S.h`<div class="stack" id="duaform" data-id="${d.id}"><div id="dua-errs"></div>${d.replaces ? S.ui.notice('info', 'نسخة معدّلة من عنصر مضمّن', 'عند نشرها «جاهزة» تحلّ محل الأصل في سِراج.') : ''}${S.ui.notice('warn', 'قاعدة التوثيق', 'انسخ النص من طبعة معتمدة، ولا تكتبه من الذاكرة ولا تُعدّله. بلا نص يُنشر العنوان فقط بحالة «العنوان فقط».')}
        <div class="card">${S.f.text('title', 'العنوان', d.title, { required: true })}${S.f.select('kind', 'النوع', KIND_OPT, d.kind)}${S.f.select('cat', 'التصنيف', cats().map((c) => ({ v: c.id, t: c.title })), d.cat)}${S.f.text('commonSource', 'المصدر الشائع (وصف)', d.commonSource)}${S.f.area('text', 'النص (سطر لكل مقطع)', d.text, { rows: 10 })}</div>
        <div class="card"><div class="card-t">${S.icon('link')} مصدر النص</div>${S.f.text('book', 'الكتاب', ts.book)}${S.f.text('author', 'المؤلف/المحقق', ts.author)}${S.f.text('edition', 'الطبعة', ts.edition)}<div class="grid3">${S.f.text('part', 'الجزء', ts.part)}${S.f.text('page', 'الصفحة', ts.page)}${S.f.text('url', 'رابط', ts.url, { ltr: true })}</div></div>
        ${S.f.text('note', 'ملاحظة', d.note)}<div class="card">${S.f.check('ready', 'جاهز للنشر (يدخل الحزمة القادمة)', d.ready)}</div>
        <button class="btn primary block" data-act="duaSave">${S.icon('check')} حفظ</button>${!isNew ? S.h`<button class="btn danger block" data-act="duaDel" data-id="${d.id}">حذف</button>` : ''}</div>`
    };
  });
  S.act('duaSave', async () => {
    const root = S.$('#duaform'); const x = S.f.read(root); const id = root.dataset.id; const old = id ? await S.db.get('duas', id) : null;
    const rec = { id: id || tid('pd'), title: str(x.title), kind: x.kind, cat: x.cat, commonSource: str(x.commonSource), note: str(x.note), text: String(x.text || '').replace(/\r/g, '').trim(), textSource: { book: str(x.book), author: str(x.author), edition: str(x.edition), part: str(x.part), page: str(x.page), url: str(x.url) }, ready: !!x.ready, updated: Date.now() };
    if (!rec.title) return S.toast('العنوان مطلوب', 'err');
    const errs = SC.validateDua(rec);
    if (errs.length) { if (rec.ready) rec.ready = false; showErrs('#dua-errs', rec.text ? 'لم يُحفظ كجاهز — أصلح:' : 'ملاحظات:', errs); if (rec.text) { /* نص بلا مصدر: يُحفظ مسودة لكن لا يُنشر */ } }
    await S.db.put('duas', Object.assign({}, old || {}, rec)); root.dataset.id = rec.id; await S.audit(old ? 'dua.edit' : 'dua.add', rec.title, rec.ready ? 'ready' : 'draft');
    S.toast(rec.ready ? 'حُفظ وهو جاهز للنشر' : 'حُفظ كمسودة', 'ok'); if (!errs.length) S.router.go('/duas');
  });
  S.act('duaClone', async (el) => {
    const d = bundledDuas().find((x) => x.id === el.dataset.id); if (!d) return S.toast('غير موجود', 'err');
    const have = (await list('duas')).find((x) => x.replaces === d.id); if (have) return S.router.go('/dua/' + have.id);
    const rec = { id: tid('pd'), title: d.title, kind: d.kind || 'dua', cat: d.cat, commonSource: d.commonSource || '', note: d.note || '', text: d.text || '', textSource: d.textSource ? Object.assign({}, d.textSource) : {}, ready: false, replaces: d.id, updated: Date.now() };
    await S.db.put('duas', rec); await S.audit('dua.clone', rec.title, d.id); S.router.go('/dua/' + rec.id);
  });
  S.act('duaDel', async (el) => { if (await S.confirm('حذف هذا العنصر من مسودات الناشر؟', { danger: true })) { await S.db.del('duas', el.dataset.id); S.router.go('/duas'); } });

  /* ---------------- سحب محتوى مضمّن ---------------- */
  const WD = () => S.kv.get('ctl.withdraw', { books: [], duas: [], entries: [] });
  const setW = (w) => S.kv.set('ctl.withdraw', w);
  S.router.add('/withdraw', (p, q) => {
    const w = WD(); const term = S.norm(q.q || ''); const kind = q.k === 'duas' ? 'duas' : 'books';
    const src = kind === 'books' ? bundledBooks() : bundledDuas(); const byId = new Map(src.map((x) => [x.id, x]));
    const rows = term ? src.filter((x) => S.norm(x.title + ' ' + (x.author || '')).includes(term)).slice(0, 40) : [];
    return {
      title: 'سحب محتوى مضمّن', nav: 'content', back: '/content',
      html: S.h`<div class="stack">${S.ui.notice('info', 'ما معنى السحب؟', 'يُخفي سِراج الكتاب أو الدعاء المضمّن في التطبيق عند تثبيت حزمتك التالية (مثلاً إن وجدت فيه خطأً). لا يُحذف شيء قبل أن تُصدر حزمة وتثبّتها.')}
        <div class="chips"><a class="chip ${kind === 'books' ? 'active' : ''}" href="#/withdraw?k=books">كتب</a><a class="chip ${kind === 'duas' ? 'active' : ''}" href="#/withdraw?k=duas">أدعية</a></div>
        <div class="searchbox">${S.icon('search')}<input class="input" id="wq" value="${q.q || ''}" placeholder="ابحث في المحتوى المضمّن لسحبه"></div>
        ${rows.length ? S.h`<div class="list">${rows.map((x) => S.h`<div class="li"><span class="li-body"><span class="li-t">${x.title}</span><span class="li-s">${x.author || ''}</span></span><button class="btn xs ${w[kind].includes(x.id) ? '' : 'danger'}" data-act="wdToggle" data-k="${kind}" data-id="${x.id}">${w[kind].includes(x.id) ? 'إلغاء السحب' : 'سحب'}</button></div>`)}</div>` : ''}
        <div class="card"><div class="card-t">${S.icon('eye')} المسحوب حالياً (${S.n(w.books.length + w.duas.length + w.entries.length)})</div>
          ${['books', 'duas'].map((k) => w[k].map((id) => S.h`<div class="kv"><span>${(byIdOf(k).get(id) || {}).title || id}<span class="tiny muted"> • ${k === 'books' ? 'كتاب' : 'دعاء'}</span></span><button class="btn xs" data-act="wdToggle" data-k="${k}" data-id="${id}">إلغاء</button></div>`))}
          ${w.entries.map((id) => S.h`<div class="kv"><span class="fp">${id}</span><button class="btn xs" data-act="wdToggle" data-k="entries" data-id="${id}">إلغاء</button></div>`)}
          ${w.books.length + w.duas.length + w.entries.length ? '' : S.h`<p class="small muted nm">لا شيء مسحوب.</p>`}</div>
        <details class="acc"><summary>سحب مدخل بمعرّفه (متقدم)</summary><div class="acc-b">${S.f.text('wdid', 'معرّف المدخل', '', { ltr: true, placeholder: 'nth_...' })}<button class="btn block" data-act="wdAddEntry">إضافة للسحب</button></div></details></div>`,
      mount() { const f = S.$('#wq'); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/withdraw?k=' + kind + '&q=' + encodeURIComponent(f.value)); }); }
    };
  });
  const byIdOf = (k) => new Map((k === 'books' ? bundledBooks() : bundledDuas()).map((x) => [x.id, x]));
  S.act('wdToggle', async (el) => { const w = JSON.parse(JSON.stringify(WD())); const k = el.dataset.k, id = el.dataset.id; const i = w[k].indexOf(id); if (i >= 0) w[k].splice(i, 1); else w[k].push(id); await setW(w); S.router.refresh(); });
  S.act('wdAddEntry', async () => { const id = str(S.$('#f_wdid').value); if (!/^[A-Za-z0-9_.:-]{3,64}$/.test(id)) return S.toast('معرّف غير صالح', 'err'); const w = JSON.parse(JSON.stringify(WD())); if (!w.entries.includes(id)) w.entries.push(id); await setW(w); S.router.refresh(); });

  /* ---------------- الإعلانات ---------------- */
  const NT = () => S.kv.get('ctl.notices', []);
  S.router.add('/notices', () => {
    const rows = NT();
    return {
      title: 'إعلانات للمستخدمين', nav: 'content', back: '/content',
      html: S.h`<div class="stack">${S.ui.notice('info', 'كيف تصل؟', 'تُضمَّن الإعلانات في كل حزمة تصدرها، ويظهر كل إعلان مرة واحدة في إشعارات سِراج عند تثبيت الحزمة.')}
        <div class="card">${S.f.text('ntitle', 'العنوان', '')}${S.f.area('nbody', 'النص', '', { rows: 3 })}<button class="btn primary block" data-act="ntAdd">${S.icon('bell')} إضافة إعلان</button></div>
        ${rows.map((n) => S.h`<div class="card"><div class="row between"><b>${n.title}</b><button class="btn xs danger" data-act="ntDel" data-id="${n.id}">حذف</button></div><p class="small nm">${n.body}</p></div>`)}</div>`
    };
  });
  S.act('ntAdd', async () => { const d = S.f.read(S.$('.view')); if (!str(d.ntitle)) return S.toast('اكتب العنوان', 'err'); const a = NT().slice(); a.unshift({ id: tid('n'), title: str(d.ntitle).slice(0, 120), body: str(d.nbody).slice(0, 600), at: Date.now() }); await S.kv.set('ctl.notices', a.slice(0, 30)); S.router.refresh(); });
  S.act('ntDel', async (el) => { await S.kv.set('ctl.notices', NT().filter((n) => n.id !== el.dataset.id)); S.router.refresh(); });

  /* ---------------- استيراد JSON (يدخل كمسودات) ---------------- */
  const TPL = {
    books: [{ title: 'عنوان الكتاب', author: 'اسم المؤلف', section: 'fiqh', subcat: 'الصلاة', desc: 'نبذة', publisher: '', year: null, edition: '', pages: null, sourceName: 'اسم المصدر', sourceUrl: 'https://example.org/book', copyright: 'غير محدد' }],
    duas: [{ title: 'عنوان الدعاء', kind: 'dua', cat: 'daily', text: 'السطر الأول\nالسطر الثاني', textSource: { book: 'اسم الكتاب', author: 'المؤلف', edition: 'الطبعة', part: '', page: '123', url: '' } }],
    entries: [{ collection: 'narrations', title: 'عنوان', text: 'النص كما في المصدر', verses: [], tags: [], sources: [{ book: 'اسم الكتاب', author: '', edition: '', volume: '', page: '12', number: '', url: '' }], extra: {} }]
  };
  S.router.add('/import', () => ({
    title: 'استيراد من ملف', nav: 'content', back: '/content',
    html: S.h`<div class="stack">${S.ui.notice('warn', 'لا نشر تلقائي', 'العناصر المستوردة تدخل «مسودات» بعد فحصها بقواعد التوثيق؛ تراجعها وتعلّمها «جاهز» بنفسك. المرفوض يُعرض سببه ولا يُحفظ.')}
      ${S.f.select('imptype', 'نوع الملف', [{ v: 'books', t: 'كتب' }, { v: 'duas', t: 'أدعية وزيارات' }, { v: 'entries', t: 'مداخل موسوعة' }], 'books')}
      ${S.f.select('impcol', 'مجموعة المداخل (لنوع «مداخل موسوعة» إن لم يحمل العنصر حقل collection)', Object.keys(SC.COLS).map((c) => ({ v: c, t: SC.COLS[c].title })), 'narrations')}
      <div class="grid3"><button class="btn sm" data-act="tplDl" data-k="books">قالب كتب</button><button class="btn sm" data-act="tplDl" data-k="duas">قالب أدعية</button><button class="btn sm" data-act="tplDl" data-k="entries">قالب مداخل</button></div>
      ${S.f.file('jf', 'ملف JSON (مصفوفة عناصر)', 'application/json,.json')}<button class="btn primary block" data-act="impRun">${S.icon('upload')} استيراد كمسودات</button><div id="imp-out"></div></div>`
  }));
  S.act('tplDl', (el) => S.download(new Blob([JSON.stringify(TPL[el.dataset.k], null, 2)], { type: 'application/json' }), 'siraj-' + el.dataset.k + '-template.json'));
  S.act('impRun', async () => {
    const kind = S.$('#f_imptype').value; const col = S.$('#f_impcol').value; const f = S.$('[name=jf]').files[0]; if (!f) return S.toast('اختر ملفاً', 'err'); let arr;
    try { arr = JSON.parse(await S.readFile(f, 'text')); } catch (e) { return S.toast('JSON غير صالح', 'err'); } if (!Array.isArray(arr)) arr = arr && Array.isArray(arr.items) ? arr.items : null; if (!arr) return S.toast('يجب أن يكون الملف مصفوفة', 'err');
    let ok = 0; const bad = []; const now = Date.now();
    for (const [i, x] of arr.entries()) {
      try {
        if (kind === 'books') {
          const a = str(x.author) ? await authorFor(x.author, x.authorDeath, false) : { id: '', name: '' };
          const rec = { id: tid('pk'), title: str(x.title), author: a.name, authorId: a.id, authorDeath: a.death || null, section: x.section, subcat: str(x.subcat), desc: str(x.desc), tags: Array.isArray(x.tags) ? x.tags.map(str).filter(Boolean) : [], publisher: str(x.publisher), year: x.year == null ? '' : x.year, edition: str(x.edition), pages: x.pages == null ? '' : x.pages, lang: str(x.lang) || 'العربية', sourceName: str(x.sourceName), sourceUrl: str(x.sourceUrl), digitalUrl: str(x.digitalUrl), copyright: str(x.copyright) || 'غير محدد', ready: false, imported: true, updated: now };
          const er = SC.validateBook(rec); if (!rec.authorId) er.push('المؤلف مطلوب'); const dk = S.norm(rec.title) + '|' + S.norm(rec.author); if (!er.length && (bundledBooks().some((y) => S.norm(y.title) + '|' + S.norm(y.author) === dk) || (await list('books')).some((y) => S.norm(y.title) + '|' + S.norm(y.author) === dk))) er.push('مكرر: الكتاب موجود (في سِراج أو في مسوداتك)'); if (er.length) { bad.push('#' + (i + 1) + ' ' + (rec.title || '؟') + ': ' + er[0]); continue; } if (a.isNew) { delete a.isNew; await S.db.put('authors', a); } await S.db.put('books', rec);
        } else if (kind === 'duas') {
          const rec = { id: tid('pd'), title: str(x.title), kind: x.kind || 'dua', cat: x.cat || 'daily', commonSource: str(x.commonSource), note: str(x.note), text: String(x.text || '').trim(), textSource: x.textSource || {}, ready: false, imported: true, updated: now };
          const er = SC.validateDua(rec); if (!(cats().some((c) => c.id === rec.cat))) er.push('تصنيف غير معروف: ' + rec.cat); if (er.length) { bad.push('#' + (i + 1) + ' ' + (rec.title || '؟') + ': ' + er[0]); continue; } await S.db.put('duas', rec);
        } else {
          const rec = S.ctl.entryFromTemplate(x, col); rec.id = tid('pe'); rec.ready = false; rec.imported = true; rec.updated = now;
          const er = SC.validateEntry(rec); if (er.length) { bad.push('#' + (i + 1) + ' ' + (rec.title || '؟') + ': ' + er[0]); continue; } await S.db.put('entries', rec);
        }
        ok++;
      } catch (e) { bad.push('#' + (i + 1) + ': ' + e.message); }
    }
    await S.audit('import.' + kind, f.name, ok + ' ok, ' + bad.length + ' rejected');
    S.$('#imp-out').innerHTML = '<div class="notice ' + (bad.length ? 'warn' : 'ok') + '"><div><b>أُضيف ' + ok + ' مسودة</b>' + (bad.length ? '<br>رُفض ' + bad.length + ':<br>' + bad.slice(0, 15).map(esc).join('<br>') : '') + '</div></div>';
  });

  /* ---------------- نسخة احتياطية لمحتوى الناشر (المفتاح له نسخته المشفّرة المنفصلة) ---------------- */
  const BK_KV = ['ctl.withdraw', 'ctl.notices', 'ctl.seq', 'ctl.history', 'ctl.meta'];
  S.router.add('/backup', () => ({
    title: 'نسخة احتياطية للمحتوى', nav: 'content', back: '/content',
    html: S.h`<div class="stack">${S.ui.notice('info', 'ماذا تحفظ؟', 'مسوداتك وعناصرك الجاهزة وقائمة السحب والإعلانات وسجل الإصدارات ورقم آخر حزمة. مفتاح النشر له نسخته المنفصلة المشفّرة من تبويب «المفتاح».')}
      <button class="btn primary block" data-act="bkpExport">${S.icon('download')} تصدير نسخة</button>
      <div class="card">${S.f.file('bfile', 'استعادة من نسخة', 'application/json,.json')}<button class="btn block" data-act="bkpImport">${S.icon('upload')} استعادة (دمج)</button></div></div>`
  }));
  S.act('bkpExport', async () => {
    const out = { app: 'siraj-control-backup', v: 1, at: new Date().toISOString(), stores: {}, kv: {} };
    for (const s of ['books', 'authors', 'duas', 'entries']) out.stores[s] = await list(s);
    for (const k of BK_KV) if (S.kv.get(k) !== undefined) out.kv[k] = S.kv.get(k);
    try { await S.saveBlob(new Blob([JSON.stringify(out)], { type: 'application/json' }), 'siraj-control-backup-' + S.today() + '.json', 'نسخة احتياطية لمحتوى الناشر'); S.toast('تم', 'ok'); } catch (e) { S.toast(e.message, 'err'); }
  });
  S.act('bkpImport', async () => {
    const f = S.$('[name=bfile]').files[0]; if (!f) return S.toast('اختر ملف النسخة', 'err'); let j; try { j = JSON.parse(await S.readFile(f, 'text')); } catch (e) { return S.toast('الملف ليس JSON صالحاً', 'err'); }
    if (!j || j.app !== 'siraj-control-backup' || !j.stores) return S.toast('ليس نسخة من تطبيق التحكم', 'err'); let n = 0;
    for (const s of ['books', 'authors', 'duas', 'entries']) if (Array.isArray(j.stores[s])) { await S.db.putMany(s, j.stores[s].filter((r) => r && typeof r.id === 'string')); n += j.stores[s].length; }
    for (const k of BK_KV) if (j.kv && j.kv[k] !== undefined) { if (k === 'ctl.seq') await S.kv.set(k, Math.max(+S.kv.get(k, 0) || 0, +j.kv[k] || 0)); else if (k === 'ctl.withdraw') await S.kv.set(k, j.kv[k]); else if (k === 'ctl.notices' || k === 'ctl.history') await S.kv.set(k, j.kv[k]); else await S.kv.set(k, j.kv[k]); }
    S.toast('استُعيد ' + S.n(n) + ' عنصراً', 'ok');
  });

  /* ---------------- مركز المحتوى ---------------- */
  S.router.add('/content', async () => {
    const [b, d, e, a] = await Promise.all([list('books'), list('duas'), list('entries'), list('authors')]); const r = (x) => x.filter((i) => i.ready).length;
    const tile = (ic, t, href, n, sub) => S.h`<a class="card tap" href="#${href}">${S.icon(ic)}<div><b>${t}</b></div>${n != null ? S.h`<div class="tiny muted">${sub}</div>` : ''}</a>`;
    return {
      title: 'المحتوى', nav: 'content', back: false,
      html: S.h`<div class="stack"><div class="grid2">
        ${tile('library', 'الكتب', '/books', b.length, S.n(r(b)) + ' جاهز من ' + S.n(b.length))}${tile('heart-handshake', 'الأدعية والزيارات', '/duas', d.length, S.n(r(d)) + ' جاهز من ' + S.n(d.length))}
        ${tile('scroll', 'مداخل الموسوعة', '/entries', e.length, S.n(r(e)) + ' جاهز من ' + S.n(e.length))}${tile('users', 'المؤلفون', '/authors', a.length, S.n(a.length) + ' مؤلف')}
        ${tile('eye', 'سحب محتوى مضمّن', '/withdraw', null)}${tile('bell', 'إعلانات', '/notices', null)}
        ${tile('upload', 'استيراد من ملف', '/import', null)}${tile('database', 'نسخة احتياطية', '/backup', null)}</div></div>`
    };
  });
})();

/* =====================================================================
   سِراج — التحكم : entries.js — مداخل الموسوعة (روايات، رواة، تفاسير، أحكام…)
   لا يُقبل مدخل بلا مصدر (كتاب + جزء/صفحة/رقم/رابط). النصوص تُنسخ من طبعة معتمدة ولا تُكتب من الذاكرة.
   أحكام العلماء تُنسب لقائليها، والخلاف يُدخل أقوالاً منسوبة لا حقيقة واحدة. (القواعد في schema.js المشتركة مع سِراج.)
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const SC = S.schema; const COLS = SC.COLS; const esc = S.esc; const str = SC.str;
  const { tid, list, badge } = S.ctl;
  const IMAM_OPT = () => S.data.sample.imams.map((i) => ({ v: i.n, t: i.n + '. ' + i.short }));

  /* col: المجموعة الافتراضية للعناصر التي لا تحمل حقل collection (القوالب القديمة في docs/import-templates) */
  S.ctl.entryFromTemplate = (x, col) => { const e = fromTpl(x, col); if (e.collection === 'tafsir') { if (!e.title) e.title = (str(x.book) || 'تفسير') + ' — ' + (e.verses[0] || ''); if (!e.extra.mufassir) e.extra.mufassir = str(x.book); } return e; };
  const fromTpl = (x, col) => ({
    collection: str(x.collection) || str(col), title: str(x.title), text: String(x.text || '').trim(), verses: [].concat(x.verses || (x.verse ? [x.verse] : [])), tags: x.tags || [],
    sources: (x.sources || []).map((s) => ({ book: s.book || '', author: s.author || '', edition: s.edition || '', volume: s.volume || '', page: s.page || '', number: s.number || '', url: s.url || '' })),
    isnads: x.isnads || [], variants: (x.variants || []).map((v) => (typeof v === 'string' ? { text: v, source: '' } : v)), scholarRulings: x.scholarRulings || [], positions: x.positions || [], extra: x.extra || {}
  });

  /* ---------------- القوائم ---------------- */
  S.router.add('/entries', async () => {
    const es = await list('entries');
    return {
      title: 'مداخل الموسوعة', nav: 'content', back: '/content',
      html: S.h`<div class="stack">${S.ui.notice('warn', 'لا مدخل بلا مصدر', 'كل مدخل بكتابه وموضعه. لا تكتب نصاً دينياً من الذاكرة.')}
        <div class="list">${Object.keys(COLS).map((c) => { const n = es.filter((e) => e.collection === c); return S.h`<a class="li" href="#/entries/${c}"><span class="li-ico">${S.icon(COLS[c].icon)}</span><span class="li-body"><span class="li-t">${COLS[c].title}</span><span class="li-s">${S.n(n.filter((e) => e.ready).length)} جاهز • ${S.n(n.length)} إجمالاً</span></span>${S.icon('chevron-left')}</a>`; })}</div></div>`
    };
  });
  S.router.add('/entries/:col', async (p) => {
    const c = COLS[p.col]; if (!c) return { title: 'غير موجود', back: '/entries', html: S.ui.empty('alert', 'مجموعة غير معروفة') };
    const rows = (await list('entries')).filter((e) => e.collection === p.col).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return {
      title: c.title, nav: 'content', back: '/entries', actions: [{ icon: 'plus', label: 'إضافة', href: '#/entry/' + p.col + '/new' }],
      html: S.h`<div class="stack"><div class="small muted">${S.n(rows.length)} مدخلاً</div><div class="list">${rows.length ? rows.map((e) => S.h`<a class="li" href="#/entry/${p.col}/${e.id}"><span class="li-body"><span class="li-t">${e.title || '(بلا عنوان)'}</span><span class="li-s">${((e.sources || [])[0] || {}).book || ''}</span></span><span class="li-end">${badge(e)}</span></a>`) : S.ui.empty(c.icon, 'لا مداخل بعد', c.hint || '', S.h`<a class="btn primary" href="#/entry/${p.col}/new">إضافة ${c.one}</a>`)}</div></div>`
    };
  });

  /* ---------------- النموذج ---------------- */
  const SRC_F = [['book', 'الكتاب'], ['author', 'المؤلف'], ['edition', 'الطبعة'], ['volume', 'الجزء'], ['page', 'الصفحة'], ['number', 'رقم الحديث/الموضع'], ['url', 'رابط']];
  const rowIn = (k, l, v, o) => S.h`<div class="rw-f ${o || ''}"><label class="tiny">${l}</label><input class="input ${k === 'url' ? 'ltr' : ''}" data-k="${k}" value="${v == null ? '' : v}"></div>`;
  const srcRow = (s) => S.h`<div class="rw card flat" data-row><div class="rw-g">${SRC_F.map(([k, l]) => rowIn(k, l, (s || {})[k], k === 'book' ? 'w2' : ''))}</div><button type="button" class="btn xs danger" data-act="rowDel">حذف المصدر</button></div>`;
  const simpleRow = (def, v) => S.h`<div class="rw card flat" data-row>${def.map(([k, l, big]) => (big ? S.h`<div class="rw-f"><label class="tiny">${l}</label><textarea class="textarea" rows="2" data-k="${k}">${(v || {})[k] || ''}</textarea></div>` : rowIn(k, l, (v || {})[k])))}<button type="button" class="btn xs danger" data-act="rowDel">حذف</button></div>`;
  const isnadRow = (v) => S.h`<div class="rw card flat" data-row><div class="rw-f"><textarea class="textarea" rows="2" data-k="line">${(v || {}).line || ''}</textarea></div><button type="button" class="btn xs danger" data-act="rowDel">حذف</button></div>`;
  const RDEF = { variants: [['text', 'اللفظ كما في المصدر', 1], ['source', 'مصدر هذا اللفظ (كتاب/جزء/صفحة)']], rulings: [['scholar', 'اسم العالِم القائل'], ['ruling', 'قوله كما ورد', 1], ['source', 'مصدر القول (كتاب/جزء/صفحة)']], positions: [['holder', 'القائل (عالم/مدرسة)'], ['view', 'القول', 1], ['source', 'مصدر القول']] };
  const rowsBlock = (name, label, items, add, maker) => S.h`<div class="field rows-ed" data-rows="${name}"><label>${label}</label><div class="rows">${items.map(maker)}</div><button type="button" class="btn sm" data-act="rowAdd" data-name="${name}">${S.icon('plus')} ${add}</button></div>`;
  S.act('rowDel', (el) => { el.closest('[data-row]').remove(); });
  S.act('rowAdd', (el) => {
    const n = el.dataset.name; const wrap = el.closest('.rows-ed').querySelector('.rows'); const h = n === 'sources' ? srcRow() : n === 'isnads' ? isnadRow() : simpleRow(RDEF[n]);
    wrap.insertAdjacentHTML('beforeend', h.s);
  });
  const readRows = (root, name) => S.$$('[data-rows="' + name + '"] [data-row]', root).map((r) => { const o = {}; S.$$('[data-k]', r).forEach((i) => (o[i.dataset.k] = i.value.trim())); return o; }).filter((o) => Object.values(o).some(Boolean));

  S.router.add('/entry/:col/:id', async (p) => {
    const col = p.col; const c = COLS[col]; if (!c) return { title: 'غير موجود', back: '/entries', html: S.ui.empty('alert', 'مجموعة غير معروفة') };
    const isNew = p.id === 'new'; const e = isNew ? null : await S.db.get('entries', p.id); if (!isNew && !e) return { title: 'غير موجود', back: '/entries/' + col, html: S.ui.empty('alert', 'غير موجود') };
    const x = e || { title: '', text: '', verses: [], tags: [], sources: [{}], isnads: [], variants: [], scholarRulings: [], positions: [], extra: {}, ready: false };
    const exF = (c.extra || []).map(([k, l, t, req, opts]) => (t === 'select' ? S.f.select('x_' + k, l, [{ v: '', t: '— اختر —' }].concat(opts.map(([v, tt]) => ({ v, t: tt }))), x.extra[k] || '') : t === 'imam' ? S.f.select('x_' + k, l, IMAM_OPT(), x.extra[k] || 1) : t === 'aspect' ? S.f.select('x_' + k, l, [{ v: '', t: '— بلا —' }].concat(S.data.sample.aspects.map((a) => ({ v: a.id, t: a.title }))), x.extra[k] || '') : S.f.text('x_' + k, l, x.extra[k], { type: t, required: req, ltr: t === 'number' })));
    return {
      title: (isNew ? 'إضافة: ' : 'تعديل: ') + c.one, nav: 'content', back: '/entries/' + col,
      html: S.h`<div class="stack" id="entform" data-col="${col}" data-id="${e ? e.id : ''}"><div id="ent-errs"></div>${c.hint ? S.ui.notice('warn', 'قاعدة التوثيق', c.hint) : ''}
        <div class="card">${S.f.text('title', 'العنوان', x.title, { required: true })}${S.f.area('text', c.textLabel + (c.textReq ? '' : ' (اختياري)'), x.text, { rows: 7 })}${S.f.text('verses', 'الآيات المرتبطة' + (c.verseReq ? '' : ' (اختياري)') + ' — مفصولة بفاصلة، مثل 33:33، 2:255، 3:61-63', (x.verses || []).join('، '), { ltr: true, required: !!c.verseReq })}${exF}${S.f.text('tags', 'وسوم (مفصولة بفاصلة)', (x.tags || []).join('، '))}</div>
        <div class="card"><div class="card-t">${S.icon('link')} المصادر <span class="bad">*</span></div>${rowsBlock('sources', '', x.sources.length ? x.sources : [{}], 'إضافة مصدر', srcRow)}</div>
        ${c.narr ? S.h`<div class="card"><div class="card-t">${S.icon('network')} الأسانيد المتاحة</div>${rowsBlock('isnads', '', (x.isnads || []).map((l) => ({ line: l })), 'إضافة سند', isnadRow)}<p class="tiny muted nm">اكتب السند كما في المصدر (سلسلة الرواة بأسمائهم).</p></div>
          <div class="card"><div class="card-t">${S.icon('repeat')} اختلاف الألفاظ</div>${rowsBlock('variants', '', x.variants || [], 'إضافة لفظ آخر', (v) => simpleRow(RDEF.variants, v))}</div>` : ''}
        ${c.narr || c.judg ? S.h`<div class="card"><div class="card-t">${S.icon('gavel')} أحكام العلماء (منسوبة لقائليها)</div>${S.ui.notice('warn', 'لا حكم من التطبيق', 'أدخل قول العالِم كما ورد مع مصدره. لا يجمع سِراج الأقوال في «حكم نهائي».')}${rowsBlock('rulings', '', x.scholarRulings || [], 'إضافة قول عالِم', (v) => simpleRow(RDEF.rulings, v))}</div>` : ''}
        ${c.positions ? S.h`<div class="card"><div class="card-t">${S.icon('scale')} الأقوال في المسألة</div>${rowsBlock('positions', '', x.positions || [], 'إضافة قول', (v) => simpleRow(RDEF.positions, v))}</div>` : ''}
        <div class="card">${S.f.check('ready', 'جاهز للنشر (يدخل الحزمة القادمة)', x.ready)}</div>
        <button class="btn primary block" data-act="entSave">${S.icon('check')} حفظ</button>${e ? S.h`<button class="btn danger block" data-act="entDel" data-id="${e.id}">${S.icon('trash')} حذف</button>` : ''}</div>`
    };
  });
  S.act('entSave', async () => {
    const root = S.$('#entform'); const col = root.dataset.col; const id = root.dataset.id; const c = COLS[col]; const d = S.f.read(root); const old = id ? await S.db.get('entries', id) : null;
    const extra = {}; (c.extra || []).forEach(([k]) => { extra[k] = d['x_' + k] == null ? '' : d['x_' + k]; });
    const e = { collection: col, title: str(d.title), text: String(d.text || '').trim(), verses: d.verses.split(/[,،;\n]/).map((v) => v.trim()).filter(Boolean).map((v) => (SC.parseVerse(v) || { str: v }).str), tags: d.tags.split(/[,،]/).map((x) => x.trim()).filter(Boolean), sources: readRows(root, 'sources'), extra };
    if (c.narr) { e.isnads = readRows(root, 'isnads').map((o) => o.line).filter(Boolean); e.variants = readRows(root, 'variants'); }
    if (c.narr || c.judg) e.scholarRulings = readRows(root, 'rulings'); if (c.positions) e.positions = readRows(root, 'positions');
    if (!e.title) return S.toast('العنوان مطلوب', 'err');
    const errs = SC.validateEntry(e); e.ready = !!d.ready && !errs.length; const box = S.$('#ent-errs');
    box.innerHTML = errs.length ? '<div class="notice err"><div><b>' + (d.ready ? 'لا يمكن وسمه «جاهز» — يُحفظ مسودة حتى تُصلح:' : 'ملاحظات للإكمال قبل النشر:') + '</b><ul class="err-list">' + errs.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' : '';
    const rec = Object.assign({}, old || {}, e, { id: id || tid('pe'), updated: Date.now() });
    await S.db.put('entries', rec); root.dataset.id = rec.id; await S.audit(old ? 'entry.edit' : 'entry.add', col + ': ' + rec.title, rec.ready ? 'ready' : 'draft');
    S.toast(rec.ready ? 'حُفظ وهو جاهز للنشر' : 'حُفظ كمسودة', 'ok');
    if (!errs.length) S.router.go('/entries/' + col); else box.scrollIntoView({ block: 'center' });
  });
  S.act('entDel', async (el) => { const e = await S.db.get('entries', el.dataset.id); if (!(await S.confirm('حذف «' + e.title + '» من مسودات الناشر؟', { danger: true, yes: 'حذف' }))) return; await S.db.del('entries', e.id); S.router.go('/entries/' + e.collection); });
})();

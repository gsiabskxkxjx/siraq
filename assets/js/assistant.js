/* =====================================================================
   سِراج — assistant.js : SIRAJ AI – المساعد العلمي
   ما يفعله هذا الإصدار فعلاً: «استرجاع محلي» من محتوى سِراج نفسه (الموسوعة الموثقة، الأحكام المنسوبة لمراجعها،
   أدعية موثقة، الأئمة، المحاور العقدية، بيانات الكتب) ثم عرض ما وُجد بنصه ومصدره. لا يولّد نصاً من نموذج لغوي.
   ما لا يفعله: لا يختلق حديثاً ولا مصدراً ولا حكماً، ولا يُصدر فتوى، ولا يقرأ نصوص الكتب الكاملة (غير مخزّنة).
   لا اتصال بأي خدمة خارجية ولا مفاتيح: كل شيء يُحسب على الجهاز.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const esc = S.esc; const L = () => S.library;
  const STOP = new Set('ما من هو هي هل عن في على الى كم اين متى كيف لماذا اشرح لي اريد اذكر ذكر هذا هذه ذلك التي الذي ان او و ثم قل بين مع لا لم عليه عليها كان تكون يكون هم نحن انا انت ايها رجاء لو اذا ما هي ماهو ماهي'.split(' ').map((w) => S.norm(w)));
  const FATWA = /(حكم |ما حكم|يجوز|هل يجوز|هل يصح|يصح |فتوى|افتني|مسأله شرعيه|مسالة شرعية|واجب|حرام|مكروه|يبطل|تبطل|يفطر|تجب)/;
  const HIST = 'assistant.history';
  const toks = (q) => S.norm(q).replace(/[؟?!.,،:؛()«»"']/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  const strip = (w) => w.replace(/^(ال|وال|بال|لل|و)/, '');
  const cite = (x) => [x.book, x.author ? '— ' + x.author : '', x.volume ? '، ج ' + x.volume : '', x.page ? '، ص ' + x.page : '', x.number ? '، رقم ' + x.number : ''].join('');
  const hasAll = (hay, ts) => ts.filter((t) => hay.includes(t) || hay.includes(strip(t))).length;

  /* ---------------- الاسترجاع ---------------- */
  async function retrieve(q) {
    const T = toks(q); const nq = S.norm(q); const out = { entries: [], books: [], imams: [], aspects: [], verses: [], duas: [], rulings: [], T };
    if (!T.length) return out; const need = Math.max(1, Math.ceil(T.length * (T.length <= 2 ? 1 : 0.6)));
    const ents = await S.db.all('entries'); const D = S.data.sample;
    ents.forEach((e) => {
      const hay = S.norm([e.title, e.text, (e.tags || []).join(' '), Object.values(e.extra || {}).join(' '), (e.variants || []).map((v) => v.text).join(' ')].join(' ')); const m = hasAll(hay, T);
      if (m >= need) { const sc = m + (hasAll(S.norm(e.title), T) ? 2 : 0); (e.collection === 'rulings' ? out.rulings : out.entries).push({ e, sc }); }
    });
    out.entries.sort((a, b) => b.sc - a.sc); out.rulings.sort((a, b) => b.sc - a.sc);
    L().published().forEach((b) => { const m = hasAll(b._n, T); if (m >= need) out.books.push({ b, sc: m + (hasAll(b._nt, T) ? 2 : 0) + (hasAll(b._na, T) ? 1 : 0) }); }); out.books.sort((a, b) => b.sc - a.sc);
    const tc = {}; D.imams.forEach((i) => i.titles.forEach((t) => { const k = S.norm(t); tc[k] = (tc[k] || 0) + 1; }));
    D.imams.forEach((i) => { const names = [i.short, i.name.replace(/\(.*?\)/g, '').replace(/^الإمام\s+/, '')].concat(i.titles.filter((t) => tc[S.norm(t)] === 1 && !/\(/.test(t))).map((x) => S.norm(x)); if (names.some((n) => n.length > 3 && nq.includes(n))) out.imams.push(i); });
    D.aspects.forEach((a) => { if (nq.includes(S.norm(a.title)) || hasAll(S.norm(a.title + ' ' + a.brief), T) >= Math.max(2, need)) out.aspects.push(a); });
    D.ahlVerses.forEach((v) => { if (nq.includes(S.norm(v.name))) out.verses.push(v); }); const m = /(\d{1,3})\s*[:：]\s*(\d{1,3})/.exec(q.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (m) { const s = +m[1], a = +m[2]; const su = S.data.quran.surahs[s - 1]; if (su && a >= 1 && a <= su.ayahs) { const v = D.ahlVerses.find((x) => x.s === s && x.a === a); out.verseRef = { s, a, name: v ? v.name : '' }; if (v && !out.verses.includes(v)) out.verses.push(v); } }
    (await S.db.all('duas')).filter((d) => d.textStatus === 'documented' && d.text).forEach((d) => { const m2 = hasAll(S.norm(d.title + ' ' + d.text), T); if (m2 >= need) out.duas.push({ d, sc: m2 }); }); out.duas.sort((a, b) => b.sc - a.sc);
    return out;
  }

  /* ---------------- اقتراحات عند عدم الفهم ---------------- */
  /* مفردات حقيقية من بيانات التطبيق، كل منها بصيغة سؤال يفهمها المساعد */
  function vocab() {
    const D = S.data.sample, v = [];
    D.imams.forEach((i) => v.push({ k: i.short, q: 'من هو الإمام ' + i.short + '؟', t: 'imam' }));
    D.aspects.forEach((a) => v.push({ k: a.title, q: 'ما هو ' + a.title + '؟', t: 'aspect' }));
    D.ahlVerses.forEach((a) => v.push({ k: a.name, q: 'ما ' + a.name + '؟', t: 'verse' }));
    S.sections.forEach((x) => v.push({ k: x.title, q: 'ما كتب ' + x.title + ' في المكتبة؟', t: 'section' }));
    return v;
  }
  const grams = (w) => { const g = new Set(); for (let i = 0; i + 2 <= w.length; i++) g.add(w.slice(i, i + 2)); return g; };
  function suggest(q, T) {
    const qs = (T || []).map(strip).filter((w) => w.length > 1); const vs = vocab(); const scored = [];
    vs.forEach((x) => {
      const nk = S.norm(x.k); const ng = grams(strip(nk)); let sc = 0;
      qs.forEach((w) => { if (nk.includes(w) || (w.length > 3 && w.includes(strip(nk)))) sc += 3; else { const wg = grams(w); let c = 0; wg.forEach((g) => { if (ng.has(g)) c++; }); if (wg.size && c / wg.size >= 0.5) sc += 1; } });
      if (sc) scored.push({ x, sc });
    });
    scored.sort((a, b) => b.sc - a.sc); const out = []; const seen = new Set();
    scored.forEach(({ x }) => { if (out.length < 4 && !seen.has(x.q)) { seen.add(x.q); out.push(x); } });
    ['verse', 'imam', 'aspect', 'section'].forEach((t) => { const x = vs.find((y) => y.t === t); if (x && out.length < 4 && !seen.has(x.q)) { seen.add(x.q); out.push(x); } });
    return { words: out.map((x) => x.k), forms: out.map((x) => x.q) };
  }

  function compose(q, r) {
    const blocks = []; const notes = []; const fatwa = FATWA.test(' ' + S.norm(q) + ' ') || FATWA.test(q);
    r.imams.slice(0, 1).forEach((i) => blocks.push({ t: 'imam', title: i.name, lines: ['الكنية: ' + i.kunya, 'الألقاب: ' + i.titles.join('، '), 'الولادة: ' + (i.birth.date || '') + ' ' + i.birth.hijriYear + ' هـ — ' + (i.birth.place || ''), i.death.hijriYear != null ? 'الوفاة/الشهادة: ' + (i.death.date || '') + ' ' + i.death.hijriYear + ' هـ — ' + (i.death.cause || '') : 'الوفاة: لا ينطبق (الإمام الحجة المنتظَر عند الإمامية)', 'المرقد: ' + (i.burial || '—')], note: (i.variance ? i.variance + ' ' : '') + 'هذه بيانات تمهيدية مشهورة عند الإمامية؛ راجع المصادر: ' + (i.sourcesHint || []).join('؛ '), href: '/imams/' + i.n }));
    r.aspects.slice(0, 1).forEach((a) => blocks.push({ t: 'aspect', title: a.title, lines: [a.brief], note: a.status + (a.disputed ? ' • موضع خلاف بحثي: تُعرض الأقوال بمصادرها.' : ''), href: '/aqeedah/' + a.id }));
    r.verses.slice(0, 2).forEach((v) => blocks.push({ t: 'verse', title: v.name + ' (' + S.data.quran.surahs[v.s - 1].name + ' ' + v.a + ')', lines: [v.agreement], href: '/research/verse-links?verse=' + v.s + ':' + v.a }));
    if (r.verseRef && !r.verses.length) blocks.push({ t: 'verse', title: 'الآية ' + r.verseRef.s + ':' + r.verseRef.a, lines: [], href: '/research/verse-links?verse=' + r.verseRef.s + ':' + r.verseRef.a });
    r.rulings.slice(0, 4).forEach(({ e }) => blocks.push({ t: 'ruling', title: e.title, text: e.text, who: 'المرجع: ' + (e.extra.marja || '—'), cites: e.sources.map(cite), href: '/research/rulings/' + e.id }));
    r.entries.slice(0, 5).forEach(({ e }) => blocks.push({ t: 'entry', title: e.title, kind: S.enc.COLS[e.collection].title, text: e.text.length > 420 ? e.text.slice(0, 420) + ' …' : e.text, cites: e.sources.map(cite), judg: (e.scholarRulings || []).map((x) => x.scholar + ': ' + x.ruling + ' [' + x.source + ']'), href: '/research/' + e.collection + '/' + e.id, reviewed: e.status === 'reviewed' }));
    r.duas.slice(0, 2).forEach(({ d }) => blocks.push({ t: 'dua', title: d.title, text: d.text.length > 300 ? d.text.slice(0, 300) + ' …' : d.text, cites: [cite(d.textSource || {})], href: '/duas/item/' + d.id }));
    r.books.slice(0, 5).forEach(({ b }) => blocks.push({ t: 'book', title: b.title, lines: [b.author + ' • ' + ((S.sectionById[b.section] || {}).title || '') + (b.subcat ? ' / ' + b.subcat : '')], href: '/library/book/' + b.id }));
    if (fatwa) notes.unshift('لا أُصدر فتاوى. الأحكام الشرعية تُؤخذ من الرسالة العملية لمرجعك' + (S.settings.marja ? ' (' + S.settings.marja + ')' : '') + ' أو بالاستفتاء من مكتبه.' + (r.rulings.length ? ' ما ظهر أعلاه أحكام مُدخلة من مصادرها ومنسوبة لمراجعها، لا من إنشاء المساعد.' : ' ولم أجد في الموسوعة حكماً موثقاً مطابقاً لسؤالك.'));
    const found = blocks.length > 0;
    const rec = { q, ts: Date.now(), blocks, notes, fatwa, found };
    if (!found) { rec.unclear = true; rec.sug = suggest(q, r.T); }
    return rec;
  }

  const kv = () => S.kv.get(HIST, []);
  async function pushHist(rec) { const a = kv().concat([rec]).slice(-30); await S.kv.set(HIST, a); return a; }
  /* ---------------- العرض ---------------- */
  const BL = { imam: ['user', 'بيانات الإمام'], aspect: ['network', 'محور عقدي'], verse: ['book-open', 'آية'], ruling: ['gavel', 'حكم منسوب لمرجعه'], entry: ['scroll', 'من الموسوعة الموثقة'], dua: ['heart-handshake', 'دعاء موثق'], book: ['library', 'كتاب في المكتبة'] };
  const blockHtml = (b) => S.h`<div class="as-b ${b.t}"><div class="row between"><b>${b.title}</b><span class="tiny gold">${BL[b.t][1]}${b.kind ? ' — ' + b.kind : ''}</span></div>${(b.lines || []).map((l) => S.h`<div class="small">${l}</div>`)}${b.who ? S.h`<div class="small gold">${b.who}</div>` : ''}${b.text ? S.h`<p class="quote">${b.text}</p><div class="tiny muted">نص أصلي كما أُدخل من المصدر — لا شرح من المساعد</div>` : ''}${(b.cites || []).filter(Boolean).map((c) => S.h`<div class="tiny muted">المصدر: ${c}</div>`)}${(b.judg || []).length ? S.h`<div class="tiny"><b>أقوال العلماء (منسوبة):</b>${b.judg.map((j) => S.h`<div>• ${j}</div>`)}</div>` : ''}${b.note ? S.h`<div class="tiny muted">${b.note}</div>` : ''}${b.reviewed ? S.h`<span class="badge ok">راجعه مراجع</span>` : ''}${b.href ? S.h`<a class="btn xs mt-s" href="#${b.href}">فتح</a>` : ''}</div>`;
  const msgHtml = (m) => S.h`<div class="as-q">${m.q}</div><div class="as-a">${m.blocks.map(blockHtml)}${m.notes.map((n) => S.h`<div class="as-n">${n}</div>`)}${m.unclear ? S.h`<div class="as-b unclear"><b>إدخال السؤال غير مفهوم</b><div class="small">ما لقيت له جواباً في محتوى سِراج. اكتب اسم الشيء الذي تبحث عنه بوضوح (إمام، آية، كتاب، مصطلح).</div>${m.sug && m.sug.words.length ? S.h`<div class="small gold">كلمات بحث مقترحة:</div><div class="chips">${m.sug.words.map((w) => S.h`<button class="chip" data-act="asSug" data-q="${w}">${w}</button>`)}</div>` : ''}${m.sug && m.sug.forms.length ? S.h`<div class="small gold">جرّب سؤالك بهذه الصيغة:</div><div class="chips">${m.sug.forms.map((w) => S.h`<button class="chip" data-act="asSug" data-q="${w}">${w}</button>`)}</div>` : ''}</div>` : ''}</div>`;

  S.router.add('/assistant', async () => {
    const h = kv(); const D = S.data.sample;
    const sug = ['ما ' + D.ahlVerses[0].name + '؟', 'ما هو ' + D.aspects[0].title + '؟', 'من هو الإمام ' + D.imams[5].short + '؟', 'ما كتب التفسير في المكتبة؟'];
    return {
      title: 'المساعد العلمي', nav: 'more', back: '/more', actions: h.length ? [{ icon: 'trash', label: 'مسح المحادثة', act: 'asClear' }] : [], noNav: false,
      html: S.h`<div class="stack"><div class="card hero-mini"><b>المساعد العلمي</b><p class="small nm">اسأل عن إمام أو آية أو مصطلح أو كتاب، فيجيبك من محتوى سِراج بنصه ومصدره.</p></div>
        <div class="chips as-wrap">${sug.map((x) => S.h`<button class="chip" data-act="asSug" data-q="${x}">${x}</button>`)}</div>
        <div id="as-chat" class="as-chat">${h.length ? h.map(msgHtml) : S.h`<p class="small muted center">اكتب سؤالك في الأسفل. مثال: «ما آية التطهير؟» أو «من هو الإمام الصادق؟».</p>`}</div>
        <div class="as-input"><textarea class="textarea" id="as-in" rows="2" placeholder="اسأل عن آية، إمام، مصطلح، كتاب…" enterkeyhint="send"></textarea><button class="btn primary" data-act="asSend">${S.icon('arrow-left')} إرسال</button></div></div>`,
      mount() { const c = S.$('#as-chat'); if (c) c.scrollTop = c.scrollHeight; const i = S.$('#as-in'); i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); S.$('[data-act=asSend]').click(); } }); }
    };
  });
  async function ask(q) {
    q = String(q || '').trim(); if (!q) return S.toast('اكتب سؤالاً', 'err'); const btn = S.$('[data-act=asSend]'); if (btn) btn.disabled = true;
    try {
      const r = await retrieve(q); const rec = compose(q, r);
      await pushHist(rec); await S.stat.inc('assistant:q'); S.router.refresh(); setTimeout(() => { const c = S.$('#as-chat'); if (c) c.scrollTop = c.scrollHeight; const v = S.$('#view'); if (v) v.scrollTop = v.scrollHeight; }, 80);
    } catch (e) { S.fail(e); } finally { if (btn) btn.disabled = false; }
  }
  S.act('asSend', () => ask(S.$('#as-in').value)); S.act('asSug', (el) => ask(el.dataset.q));
  S.act('asClear', async () => { if (await S.confirm('مسح المحادثة؟', { danger: true, yes: 'مسح' })) { await S.kv.set(HIST, []); S.router.refresh(); } });
  S.assistant = { retrieve, compose, toks, ask };
})();

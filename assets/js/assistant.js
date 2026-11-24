/* =====================================================================
   سِراج — assistant.js : SIRAJ AI – المساعد العلمي
   ما يفعله هذا الإصدار فعلاً: «استرجاع محلي» من محتوى سِراج نفسه (الموسوعة الموثقة، الأحكام المنسوبة لمراجعها،
   أدعية موثقة، الأئمة، المحاور العقدية، بيانات الكتب) ثم عرض ما وُجد بنصه ومصدره. لا يولّد نصاً من نموذج لغوي.
   ما لا يفعله: لا يختلق حديثاً ولا مصدراً ولا حكماً، ولا يُصدر فتوى، ولا يقرأ نصوص الكتب الكاملة (غير مخزّنة).
   جاهزية الربط: مزوّد خارجي اختياري عبر عنوان تضبطه أنت (نقطة نهاية على خادمك)؛ يُرسل إليه السؤال مع السياق المسترجع،
   وتُوسَم إجابته «غير موثقة» وتُعرض بجانب المصادر المسترجعة. لا مفاتيح API في التطبيق.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const esc = S.esc; const L = () => S.library;
  const STOP = new Set('ما من هو هي هل عن في على الى كم اين متى كيف لماذا اشرح لي اريد اذكر ذكر هذا هذه ذلك التي الذي ان او و ثم قل بين مع لا لم عليه عليها كان تكون يكون هم نحن انا انت ايها رجاء لو اذا ما هي ماهو ماهي'.split(' ').map((w) => S.norm(w)));
  const FATWA = /(حكم |ما حكم|يجوز|هل يجوز|هل يصح|يصح |فتوى|افتني|مسأله شرعيه|مسالة شرعية|واجب|حرام|مكروه|يبطل|تبطل|يفطر|تجب)/;
  const HIST = 'assistant.history'; const REMOTE = 'assistant.remote';
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

  function compose(q, r) {
    const blocks = []; const notes = []; const fatwa = FATWA.test(' ' + S.norm(q) + ' ') || FATWA.test(q);
    r.imams.slice(0, 1).forEach((i) => blocks.push({ t: 'imam', title: i.name, lines: ['الكنية: ' + i.kunya, 'الألقاب: ' + i.titles.join('، '), 'الولادة: ' + (i.birth.date || '') + ' ' + i.birth.hijriYear + ' هـ — ' + (i.birth.place || ''), i.death.hijriYear != null ? 'الوفاة/الشهادة: ' + (i.death.date || '') + ' ' + i.death.hijriYear + ' هـ — ' + (i.death.cause || '') : 'الوفاة: لا ينطبق (الإمام الحجة المنتظَر عند الإمامية)', 'المرقد: ' + (i.burial || '—')], note: (i.variance ? i.variance + ' ' : '') + 'هذه بيانات تمهيدية مشهورة عند الإمامية؛ راجع المصادر: ' + (i.sourcesHint || []).join('؛ '), href: '/imams/' + i.n }));
    r.aspects.slice(0, 1).forEach((a) => blocks.push({ t: 'aspect', title: a.title, lines: [a.brief], note: a.status + (a.disputed ? ' • موضع خلاف بحثي: تُعرض الأقوال بمصادرها.' : ''), href: '/aqeedah/' + a.id }));
    r.verses.slice(0, 2).forEach((v) => blocks.push({ t: 'verse', title: v.name + ' (' + S.data.quran.surahs[v.s - 1].name + ' ' + v.a + ')', lines: [v.agreement], note: 'لا يعرض سِراج نص تفسير ما لم يكن موثقاً بمصدره؛ انظر مقارنة التفاسير.', href: '/research/verse-links?verse=' + v.s + ':' + v.a }));
    if (r.verseRef && !r.verses.length) blocks.push({ t: 'verse', title: 'الآية ' + r.verseRef.s + ':' + r.verseRef.a, lines: [], note: 'أدناه ما أُضيف من مداخل موثقة مرتبطة بها إن وُجدت.', href: '/research/verse-links?verse=' + r.verseRef.s + ':' + r.verseRef.a });
    r.rulings.slice(0, 4).forEach(({ e }) => blocks.push({ t: 'ruling', title: e.title, text: e.text, who: 'المرجع: ' + (e.extra.marja || '—'), cites: e.sources.map(cite), href: '/research/rulings/' + e.id }));
    r.entries.slice(0, 5).forEach(({ e }) => blocks.push({ t: 'entry', title: e.title, kind: S.enc.COLS[e.collection].title, text: e.text.length > 420 ? e.text.slice(0, 420) + ' …' : e.text, cites: e.sources.map(cite), judg: (e.scholarRulings || []).map((x) => x.scholar + ': ' + x.ruling + ' [' + x.source + ']'), href: '/research/' + e.collection + '/' + e.id, reviewed: e.status === 'reviewed' }));
    const tafs = r.entries.filter((x) => x.e.collection === 'tafsir').length; if (tafs > 1) notes.push('وُجد أكثر من مدخل تفسير؛ تُعرض الأقوال كما أُدخلت دون ترجيح (انظر «مقارنة التفاسير»).');
    r.duas.slice(0, 2).forEach(({ d }) => blocks.push({ t: 'dua', title: d.title, text: d.text.length > 300 ? d.text.slice(0, 300) + ' …' : d.text, cites: [cite(d.textSource || {})], href: '/duas/item/' + d.id }));
    r.books.slice(0, 5).forEach(({ b }) => blocks.push({ t: 'book', title: b.title, lines: [b.author + ' • ' + ((S.sectionById[b.section] || {}).title || '') + (b.subcat ? ' / ' + b.subcat : '')], note: 'بيانات ببليوغرافية من مكتبة سِراج. لم أقرأ نص الكتاب (لا تُخزَّن نصوص الكتب الكاملة هنا)، فلا أنقل منه معلومة.', href: '/library/book/' + b.id }));
    if (fatwa) notes.unshift('لا أُصدر فتاوى. الأحكام الشرعية تُؤخذ من الرسالة العملية لمرجعك' + (S.settings.marja ? ' (' + S.settings.marja + ')' : '') + ' أو بالاستفتاء من مكتبه.' + (r.rulings.length ? ' ما ظهر أعلاه أحكام مُدخلة من مصادرها ومنسوبة لمراجعها، لا من إنشاء المساعد.' : ' ولم أجد في الموسوعة حكماً موثقاً مطابقاً لسؤالك.'));
    const found = blocks.length > 0;
    if (!found) notes.push('لا تتوفر في مكتبة سِراج معلومات كافية للإجابة عن هذا السؤال. لن أخمّن ولن أختلق مصدراً. يمكنك إضافة مداخل موثقة من «الموسوعة البحثية» أو مراجعة الكتب المتخصصة.');
    return { q, ts: Date.now(), blocks, notes, fatwa, found };
  }

  const kv = () => S.kv.get(HIST, []);
  async function pushHist(rec) { const a = kv().concat([rec]).slice(-30); await S.kv.set(HIST, a); return a; }
  const remoteCfg = () => S.kv.get(REMOTE, { enabled: false, url: '' });

  async function remoteAsk(q, ctx, cfg) {
    const c = cfg || remoteCfg(); if (!c.enabled || !c.url) return null; if (!/^https:\/\/|^http:\/\/localhost|^http:\/\/127\./i.test(c.url)) throw new Error('عنوان المزوّد يجب أن يكون https (أو localhost للتجربة)');
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000);
    try { const r = await fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, lang: 'ar', context: ctx, rules: ['اعتمد على السياق فقط', 'اذكر الكتاب والمؤلف والجزء والصفحة', 'لا تختلق أحاديث أو مصادر', 'اعترف بعدم توفر المعلومات', 'لا تُصدر فتوى'] }), signal: ctl.signal }); if (!r.ok) throw new Error('رد المزوّد: ' + r.status); const j = await r.json(); return String(j.answer || '').slice(0, 4000); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'انتهت مهلة المزوّد' : e.message === 'Failed to fetch' ? 'تعذّر الاتصال بالمزوّد (شبكة أو CORS)' : e.message); } finally { clearTimeout(to); }
  }

  /* ---------------- العرض ---------------- */
  const BL = { imam: ['user', 'بيانات الإمام'], aspect: ['network', 'محور عقدي'], verse: ['book-open', 'آية'], ruling: ['gavel', 'حكم منسوب لمرجعه'], entry: ['scroll', 'من الموسوعة الموثقة'], dua: ['heart-handshake', 'دعاء موثق'], book: ['library', 'كتاب في المكتبة'] };
  const blockHtml = (b) => S.h`<div class="as-b ${b.t}"><div class="row between"><b>${b.title}</b><span class="tiny gold">${BL[b.t][1]}${b.kind ? ' — ' + b.kind : ''}</span></div>${(b.lines || []).map((l) => S.h`<div class="small">${l}</div>`)}${b.who ? S.h`<div class="small gold">${b.who}</div>` : ''}${b.text ? S.h`<p class="quote">${b.text}</p><div class="tiny muted">نص أصلي كما أُدخل من المصدر — لا شرح من المساعد</div>` : ''}${(b.cites || []).filter(Boolean).map((c) => S.h`<div class="tiny muted">المصدر: ${c}</div>`)}${(b.judg || []).length ? S.h`<div class="tiny"><b>أقوال العلماء (منسوبة):</b>${b.judg.map((j) => S.h`<div>• ${j}</div>`)}</div>` : ''}${b.note ? S.h`<div class="tiny muted">${b.note}</div>` : ''}${b.reviewed ? S.h`<span class="badge ok">راجعه مراجع</span>` : ''}${b.href ? S.h`<a class="btn xs mt-s" href="#${b.href}">فتح</a>` : ''}</div>`;
  const msgHtml = (m) => S.h`<div class="as-q">${m.q}</div><div class="as-a"><div class="as-tag">${S.icon('sparkle')} إجابة من محتوى التطبيق — استرجاع محلي من محتوى سِراج، وليست ذكاءً اصطناعياً توليدياً</div>${m.blocks.map(blockHtml)}${m.notes.map((n) => S.h`<div class="notice ${m.found ? 'info' : 'warn'}">${S.icon(m.found ? 'info' : 'alert')}<div>${n}</div></div>`)}${m.remote ? S.h`<div class="as-b remote"><div class="tiny bad"><b>إجابة مزوّد خارجي — غير موثقة، لم يتحقق منها سِراج. راجع المصادر أعلاه:</b></div><p class="nm">${m.remote}</p></div>` : ''}${m.remoteErr ? S.h`<div class="notice err">${S.icon('alert')}<div>تعذّر المزوّد الخارجي: ${m.remoteErr}</div></div>` : ''}</div>`;

  S.router.add('/assistant', async () => {
    const h = kv(); const D = S.data.sample; const rc = remoteCfg();
    const sug = ['ما ' + D.ahlVerses[0].name + '؟', 'ما هو ' + D.aspects[0].title + '؟', 'من هو الإمام ' + D.imams[5].short + '؟', 'ما كتب التفسير في المكتبة؟', 'ما حكم الصلاة في السفر؟'];
    return {
      title: 'المساعد العلمي', nav: 'more', back: '/more', actions: h.length ? [{ icon: 'trash', label: 'مسح المحادثة', act: 'asClear' }] : [], noNav: false,
      html: S.h`<div class="stack"><div class="card hero-mini"><b>المساعد العلمي <bdi dir="ltr">(SIRAJ AI)</bdi></b><p class="small nm">يجيب من محتوى سِراج الموثق فقط، ويعرض النص ومصدره. يعترف بعدم توفر المعلومات، ولا يختلق حديثاً أو مصدراً، ولا يُصدر فتوى.</p></div>
        <div class="notice warn">${S.icon('alert')}<div><b>حدود هذا المساعد</b><div class="small">هذه النسخة لا تستخدم نموذجاً لغوياً؛ هي بحث ذكي في بيانات التطبيق. ربط خدمة ذكاء اصطناعي حقيقية جاهز من الإعدادات أدناه لكنه <b>غير مربوط</b> افتراضياً.</div></div></div>
        <div class="chips">${sug.map((x) => S.h`<button class="chip" data-act="asSug" data-q="${x}">${x}</button>`)}</div>
        <div id="as-chat" class="as-chat">${h.length ? h.map(msgHtml) : S.h`<p class="small muted center">اكتب سؤالك في الأسفل. مثال: «ما آية التطهير؟» أو «من هو الإمام الصادق؟».</p>`}</div>
        <div class="as-input"><textarea class="textarea" id="as-in" rows="2" placeholder="اسأل عن آية، رواية، إمام، مصطلح، كتاب…" enterkeyhint="send"></textarea><button class="btn primary" data-act="asSend">${S.icon('arrow-left')} إرسال</button></div>
        <details class="acc"><summary>${S.icon('settings')} ربط مزوّد ذكاء اصطناعي خارجي (اختياري) — ${rc.enabled && rc.url ? 'مفعّل' : 'غير مربوط'}</summary><div class="acc-b">
          <p class="small muted nm">أدخل عنوان خادمك الذي يستقبل السؤال ويرجع الجواب (<bdi dir="ltr">POST</bdi> بصيغة <bdi dir="ltr">JSON</bdi>: الحقول <bdi dir="ltr">question</bdi> و<bdi dir="ltr">context</bdi> و<bdi dir="ltr">rules</bdi>، والرد في حقل <bdi dir="ltr">answer</bdi>). لا تُحفظ مفاتيح في التطبيق؛ ضع المفتاح على الخادم. الإجابة الخارجية تظهر موسومة «غير موثقة».</p>
          ${S.f.text('rurl', 'عنوان الخادم (https)', rc.url, { ltr: true, placeholder: 'https://your-server.example/siraj-ai' })}${S.f.check('ren', 'تفعيل المزوّد الخارجي', rc.enabled)}<div class="grid2"><button class="btn" data-act="asRemoteSave">حفظ</button><button class="btn" data-act="asRemoteTest">اختبار الاتصال</button></div></div></details></div>`,
      mount() { const c = S.$('#as-chat'); if (c) c.scrollTop = c.scrollHeight; const i = S.$('#as-in'); i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); S.$('[data-act=asSend]').click(); } }); }
    };
  });
  async function ask(q) {
    q = String(q || '').trim(); if (q.length < 2) return S.toast('اكتب سؤالاً', 'err'); const btn = S.$('[data-act=asSend]'); if (btn) btn.disabled = true;
    try {
      const r = await retrieve(q); const rec = compose(q, r);
      if (remoteCfg().enabled) { const ctx = rec.blocks.filter((b) => b.text || b.lines).map((b) => ({ title: b.title, text: b.text || (b.lines || []).join(' '), source: (b.cites || []).join(' ؛ ') })); try { const a = await remoteAsk(q, ctx); if (a) rec.remote = a; } catch (e) { rec.remoteErr = e.message; } }
      await pushHist(rec); await S.stat.inc('assistant:q'); S.router.refresh(); setTimeout(() => { const c = S.$('#as-chat'); if (c) c.scrollTop = c.scrollHeight; const v = S.$('#view'); if (v) v.scrollTop = v.scrollHeight; }, 80);
    } catch (e) { S.fail(e); } finally { if (btn) btn.disabled = false; }
  }
  S.act('asSend', () => ask(S.$('#as-in').value)); S.act('asSug', (el) => ask(el.dataset.q));
  S.act('asClear', async () => { if (await S.confirm('مسح المحادثة؟', { danger: true, yes: 'مسح' })) { await S.kv.set(HIST, []); S.router.refresh(); } });
  S.act('asRemoteSave', async () => { const url = S.$('#f_rurl').value.trim(); const en = S.$('[name=ren]').checked; if (en && !/^https:\/\/|^http:\/\/localhost|^http:\/\/127\./i.test(url)) return S.toast('عنوان https مطلوب', 'err'); await S.kv.set(REMOTE, { enabled: en && !!url, url }); await S.audit('assistant.remote', en ? 'on' : 'off'); S.toast('حُفظ', 'ok'); S.router.refresh(); });
  S.act('asRemoteTest', async () => { const url = S.$('#f_rurl').value.trim(); try { const a = await remoteAsk('اختبار اتصال', [], { enabled: true, url }); S.toast(a ? 'المزوّد يستجيب' : 'لا رد', a ? 'ok' : 'err'); } catch (e) { S.toast(e.message, 'err'); } });
  S.assistant = { retrieve, compose, toks, ask };
})();

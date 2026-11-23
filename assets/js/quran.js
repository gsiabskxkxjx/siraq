/* =====================================================================
   سِراج — quran.js : المصحف الشريف
   • لا يحتوي التطبيق أي نص قرآني مكتوب يدوياً: النص يُحمَّل مرة واحدة من مصدر موثق (مشروع Tanzil عبر AlQuran.cloud، CC-BY 3.0)
     ثم يُتحقق منه (114 سورة، 6236 آية، تطابق عدد آيات كل سورة) ويُحفظ كما هو في IndexedDB للعمل دون إنترنت.
   • العرض فقط يخفي «بسم الله» من أول آية السور (عدا الفاتحة) ليعرضها كترويسة، دون تعديل النص المحفوظ.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const D = () => S.data.quran;
  let cum = [];
  const cumul = () => { if (!cum.length) { let c = 0; D().surahs.forEach((s) => { cum.push(c); c += s.ayahs; }); } return cum; };
  const BASM = () => S.norm('بسم الله الرحمن الرحيم');
  const esc = S.esc;
  let searchIdx = null, trSearchIdx = null;

  const Q = (S.quran = {
    text: null, pages: null, juzOf: null, edition: null, fp: '', fetchedAt: 0, tr: null, trInfo: null,
    hasText() { return !!Q.text; },
    surah: (n) => D().surahs[n - 1],
    surahName: (n) => (D().surahs[n - 1] || {}).name || '',
    gid(s, a) { return cumul()[s - 1] + a; },
    ref(g) { const c = cumul(); let lo = 0, hi = c.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m] < g) lo = m; else hi = m - 1; } return { s: lo + 1, a: g - c[lo] }; },
    ayah(s, a) { return Q.text && Q.text[s - 1] ? Q.text[s - 1][a - 1] : null; },
    /* نص العرض: بإخفاء البسملة من مطلع السورة (ما عدا الفاتحة والتوبة) */
    display(s, a) {
      const t = Q.ayah(s, a); if (t == null) return '';
      if (a !== 1 || s === 1 || s === 9) return t;
      const w = t.split(' '); if (w.length > 4 && S.norm(w.slice(0, 4).join(' ')) === BASM()) return w.slice(4).join(' ').trim();
      return t;
    },
    translationAyah(s, a) { return Q.tr && Q.tr[s - 1] ? Q.tr[s - 1][a - 1] : ''; },
    /* القراءة من التخزين سريعة فتُنتظر؛ أما استيراد النص المضمَّن (أول تشغيل فقط) فيجري في الخلفية كي لا تتأخر شاشة البدء */
    async init() {
      try { await Q.loadLocal(); } catch (e) { S.log('warn', 'quran init: ' + e.message); }
      Q.ready = (!Q.text && S.isNative)
        ? Q.importBundled().then((ok) => { if (ok) Q.afterImport(); return ok; }).catch((e) => { S.log('warn', 'quran bundled: ' + e.message); return false; })
        : Promise.resolve(false);
    },
    ready: Promise.resolve(false),
    afterImport() { const p = (S.router && S.router.cur && S.router.cur.path) || ''; if (/^\/(home|quran|daily)/.test(p)) { try { S.router.refresh(); } catch (e) { /* */ } } },
    async loadLocal() {
      const rec = await S.db.get('quran', 'text');
      if (rec && rec.ayahs && rec.ayahs.length === 114) { Q.text = rec.ayahs; Q.pages = rec.pages || null; Q.edition = rec.edition; Q.fp = rec.fp || ''; Q.fetchedAt = rec.fetchedAt || 0; }
      const tid = S.settings.translation;
      if (tid) { const t = await S.db.get('quran', 'tr:' + tid); if (t) { Q.tr = t.ayahs; Q.trInfo = t; } }
    },
    pageOf(s, a) { return Q.pages && Q.pages[s - 1] ? Q.pages[s - 1][a - 1] : null; },

    /* ---------- التنزيل والتحقق ---------- */
    async fetchEdition(id) {
      const r = await fetch(D().api.base + '/quran/' + encodeURIComponent(id), { cache: 'no-store' });
      if (!r.ok) throw new Error('أعاد الخادم الرمز ' + r.status);
      let j; try { j = await r.json(); } catch (e) { throw new Error('استجابة غير صالحة من الخادم'); }
      if (!j || j.code !== 200 || !j.data || !Array.isArray(j.data.surahs)) throw new Error('بنية الاستجابة غير متوقعة');
      return j.data;
    },
    validate(data) {
      const sur = data.surahs; if (sur.length !== 114) throw new Error('عدد السور ' + sur.length + ' وليس 114');
      let total = 0; const ayahs = [], pages = [];
      sur.forEach((sx, i) => {
        const exp = D().surahs[i]; if (sx.number !== i + 1) throw new Error('ترتيب السور غير متوقع عند ' + (i + 1));
        if (!Array.isArray(sx.ayahs) || sx.ayahs.length !== exp.ayahs) throw new Error('عدد آيات سورة ' + exp.name + ' (' + (sx.ayahs || []).length + ') لا يطابق المعتمد (' + exp.ayahs + ')');
        const t = [], p = []; sx.ayahs.forEach((ay, k) => { if (typeof ay.text !== 'string' || !ay.text.trim()) throw new Error('آية فارغة في ' + exp.name + ':' + (k + 1)); if (ay.numberInSurah !== k + 1) throw new Error('ترقيم الآيات مضطرب في ' + exp.name); t.push(ay.text); p.push(ay.page || 0); }); total += t.length; ayahs.push(t); pages.push(p);
      });
      if (total !== D().totalAyahs) throw new Error('مجموع الآيات ' + total + ' وليس ' + D().totalAyahs);
      return { ayahs, pages, total };
    },
    /* يحفظ نسخة تم التحقق منها (نفس مسار التنزيل والنسخة المضمّنة وقت البناء) */
    async storeVerified(data, source) {
      const v = Q.validate(data);
      const fp = (await S.sha256(v.ayahs.map((x) => x.join('|')).join('\n'))).slice(0, 16);
      const rec = { id: 'text', edition: (data.edition && data.edition.identifier) || D().api.textEdition, ayahs: v.ayahs, pages: v.pages, fp, fetchedAt: Date.now(), total: v.total, source: source || 'download' };
      await S.db.put('quran', rec); Q.text = rec.ayahs; Q.pages = rec.pages; Q.edition = rec.edition; Q.fp = fp; Q.fetchedAt = rec.fetchedAt; searchIdx = null;
      await S.audit('quran.' + (source || 'download'), rec.edition, 'verified ' + v.total); return rec;
    },
    async download(edId) { return Q.storeVerified(await Q.fetchEdition(edId || D().api.textEdition), 'download'); },
    /* التطبيق الأصلي يحمل نسخة جُلبت وقت البناء من Tanzil/AlQuran.cloud؛ تُتحقق بالكامل قبل الحفظ، وإن غابت أو فسدت يبقى التنزيل اليدوي */
    async importBundled() {
      if (!S.isNative || Q.text) return false;
      try {
        const r = await fetch('assets/data/quran-uthmani.json', { cache: 'no-store' }); if (!r.ok) return false;
        const j = await r.json(); if (!j || !j.data) return false;
        await Q.storeVerified(j.data, 'bundled'); return true;
      } catch (e) { S.log('warn', 'quran bundled: ' + e.message); return false; }
    },
    async removeText() { await S.db.del('quran', 'text'); Q.text = null; Q.pages = null; searchIdx = null; },
    async downloadTranslation(id) {
      const data = await Q.fetchEdition(id); const v = Q.validate(data);
      const ed = data.edition || {}; const rec = { id: 'tr:' + id, ayahs: v.ayahs, name: ed.name || ed.englishName || id, author: ed.englishName || '', lang: ed.language || '', dir: ed.direction || 'ltr', fetchedAt: Date.now() };
      await S.db.put('quran', rec); S.set({ translation: id, showTranslation: true }); Q.tr = rec.ayahs; Q.trInfo = rec; trSearchIdx = null; return rec;
    },
    async removeTranslation(id) { await S.db.del('quran', 'tr:' + id); if (S.settings.translation === id) { S.set({ translation: '', showTranslation: false }); Q.tr = null; Q.trInfo = null; } },
    async translationList() { return (await S.db.all('quran')).filter((r) => r.id.startsWith('tr:')); },
    reciters() { const live = S.kv.get('quran.reciters'); return (live && live.length ? live : D().api.defaultAudio.map(([id, name]) => ({ id, name }))); },
    async refreshReciters() {
      const r = await fetch(D().api.base + '/edition/format/audio', { cache: 'no-store' }); if (!r.ok) throw new Error('الرمز ' + r.status); const j = await r.json();
      const list = (j.data || []).filter((e) => e.language === 'ar' && e.type !== 'translation').map((e) => ({ id: e.identifier, name: e.name || e.englishName }));
      if (!list.length) throw new Error('لم تصل قائمة قرّاء'); await S.kv.set('quran.reciters', list); return list;
    },

    /* ---------- البحث ---------- */
    buildIndex() { if (!searchIdx && Q.text) searchIdx = Q.text.map((su) => su.map((t) => S.norm(t))); return searchIdx; },
    search(q, o) {
      o = o || {}; const toks = S.norm(q).split(' ').filter(Boolean); if (!toks.length || !Q.text) return [];
      const idx = Q.buildIndex(); const out = [];
      for (let s = 0; s < idx.length; s++) { if (o.s && o.s !== s + 1) continue; for (let a = 0; a < idx[s].length; a++) { const t = idx[s][a]; if (toks.every((k) => t.includes(k))) out.push({ s: s + 1, a: a + 1 }); } }
      if (o.inTranslation && Q.tr) { const tk = q.toLowerCase().split(/\s+/).filter(Boolean); Q.tr.forEach((su, s) => su.forEach((t, a) => { const l = t.toLowerCase(); if (tk.every((k) => l.includes(k)) && !out.find((x) => x.s === s + 1 && x.a === a + 1)) out.push({ s: s + 1, a: a + 1, tr: true }); })); }
      return out;
    },
    highlight(text, q) {
      const toks = S.norm(q).split(' ').filter(Boolean); if (!toks.length) return esc(text);
      return text.split(' ').map((w) => { const n = S.norm(w); return toks.some((k) => n.includes(k)) ? '<mark>' + esc(w) + '</mark>' : esc(w); }).join(' ');
    },

    /* ---------- الختمة ---------- */
    portions(plan) {
      const J = D().juzStarts, M = D().manazil; const starts = (plan === 30 ? J : M.map((s) => [s, 1])).map(([s, a]) => Q.gid(s, a));
      return starts.map((st, i) => { const en = i + 1 < starts.length ? starts[i + 1] - 1 : D().totalAyahs; return { i: i + 1, st, en, n: en - st + 1, from: Q.ref(st), to: Q.ref(en) }; });
    },
    khatmaState() { return S.kv.get('khatma', null); },
    khatma() {
      const k = Q.khatmaState(); if (!k || !k.plan) return null; const ps = Q.portions(k.plan);
      const days = Math.floor((new Date(S.today() + 'T12:00:00') - new Date(k.start + 'T12:00:00')) / 86400000) + 1; const dayNo = S.clamp(days, 1, k.plan);
      const done = k.done || {}; const readAyahs = ps.filter((p) => done[p.i]).reduce((a, p) => a + p.n, 0); const next = ps.find((p) => !done[p.i] && p.i <= dayNo) || ps.find((p) => !done[p.i]);
      const lbl = (p) => 'سورة ' + Q.surahName(p.from.s) + ' ' + S.n(p.from.a) + ' ← ' + Q.surahName(p.to.s) + ' ' + S.n(p.to.a);
      return { plan: k.plan, start: k.start, dayNo, readAyahs, pct: readAyahs / D().totalAyahs * 100, ps, done, next, todayLabel: next ? (next.i <= dayNo ? 'وردك: ' : 'التالي: ') + lbl(next) : 'أتممتَ الختمة 🌙', late: ps.filter((p) => p.i < dayNo && !done[p.i]).length, lbl, count: k.count || 1 };
    },
    async markDone(i, val) {
      const k = Q.khatmaState(); if (!k) return; k.done = k.done || {}; if (val) k.done[i] = true; else delete k.done[i]; await S.kv.set('khatma', k);
      const st = Q.khatma(); if (val && st && st.ps.every((p) => st.done[p.i])) { S.toast('تقبّل الله ختمتك — مبارك!', 'ok'); S.notify.add({ title: 'أتممتَ ختمة القرآن', body: 'خطة ' + st.plan + ' يوماً', kind: 'info' }); const h = S.kv.get('khatma.history', []); h.push({ ts: Date.now(), plan: k.plan }); S.kv.set('khatma.history', h); }
    },
    /* تحديث تلقائي أثناء القراءة المتصلة */
    autoMark(prev, cur) {
      const st = Q.khatma(); if (!st || !prev) return; const g0 = Q.gid(prev.s, prev.a), g1 = Q.gid(cur.s, cur.a);
      st.ps.forEach((p) => { if (!st.done[p.i] && g0 >= p.st && g0 <= p.en && g1 >= p.en && g1 - g0 < 120) { Q.markDone(p.i, true); S.toast('سُجّل إتمام ورد اليوم ' + S.n(p.i), 'ok'); } });
    }
  });

  /* ---------- عناصر العرض المشتركة ---------- */
  const noText = () => S.h`<div class="stack">${S.ui.empty('book-open', 'نص المصحف غير محمّل بعد', 'لا يتضمن سِراج نصاً قرآنياً مكتوباً داخل شيفرته. يُحمَّل مرة واحدة من مصدر موثق (Tanzil) ثم يعمل التطبيق دون إنترنت.', S.h`<a class="btn gold" href="#/quran/download">${S.icon('download')} تحميل المصحف الشريف</a>`)}</div>`;

  /* ---------- الصفحة الرئيسية للقرآن ---------- */
  const addQ = (pat, h) => S.router.add(pat, async (p, q) => { await Q.ready; return h(p, q); });
  addQ('/quran', (p, q) => {
    const tab = q.tab || 'surahs'; const last = S.progress.last('quran'); const k = Q.khatma(); const J = D().juzStarts;
    const surahs = D().surahs;
    const body = tab === 'juz'
      ? S.h`<div class="list">${J.map(([s, a], i) => S.ui.li({ icon: 'book-open', t: 'الجزء ' + S.n(i + 1), s: 'يبدأ من سورة ' + Q.surahName(s) + ' آية ' + S.n(a), href: '#/quran/juz/' + (i + 1) }))}</div>`
      : tab === 'marks' ? S.h`<div class="list">${S.ui.li({ icon: 'bookmark', t: 'الإشارات المرجعية', href: '#/quran/bookmarks?tab=marks' })}${S.ui.li({ icon: 'heart', t: 'الآيات المفضلة', href: '#/quran/bookmarks?tab=favs' })}${S.ui.li({ icon: 'notebook', t: 'ملاحظاتي على الآيات', href: '#/quran/bookmarks?tab=notes' })}${S.ui.li({ icon: 'target', t: 'الختمة', href: '#/quran/khatma' })}${S.ui.li({ icon: 'download', t: 'التنزيلات: النص والترجمة والتلاوة', href: '#/quran/download' })}</div>`
        : S.h`<div class="searchbox">${S.icon('search')}<input class="input" id="sfilter" data-inp="qFilter" placeholder="ابحث باسم السورة أو رقمها" autocomplete="off"></div><div class="list" id="slist">${surahs.map((s) => S.h`<a class="li" href="#/quran/surah/${s.n}" data-n="${S.norm(s.name + ' ' + s.en + ' ' + s.n)}"><span class="surah-num"><span>${S.n(s.n)}</span></span><span class="li-body"><span class="li-t q-name">${s.name}</span><span class="li-s">${s.type} • ${S.n(s.ayahs)} آية • الجزء ${S.n(s.juz)} • <span class="op-ltr">${s.en}</span></span></span>${S.icon('chevron-left')}</a>`)}</div>`;
    return {
      title: 'القرآن الكريم', nav: 'quran', back: false,
      actions: [{ icon: 'search', label: 'بحث في القرآن', href: '#/quran/search' }, { icon: 'settings', label: 'التنزيلات', href: '#/quran/download' }],
      html: S.h`<div class="stack">
        ${!Q.hasText() ? S.h`<div class="notice warn">${S.icon('download')}<div><b>نص المصحف غير محمّل</b><div class="small">لعرض الآيات حمّل المصحف الشريف مرة واحدة (حجمه نحو 1 ميغابايت).</div><a class="btn sm gold mt" href="#/quran/download">تحميل المصحف</a></div></div>` : ''}
        ${last ? S.h`<a class="card tap gold-edge" href="#/quran/surah/${last.pos.s}?a=${last.pos.a}"><div class="small muted">تابع القراءة</div><b class="q-name">سورة ${Q.surahName(last.pos.s)}</b><div class="small">آية ${S.n(last.pos.a)} • ${S.fmt.dt(last.ts)}</div></a>` : ''}
        ${k ? S.h`<a class="card tap" href="#/quran/khatma"><div class="row"><div>${S.ui.ring(k.pct)}</div><div class="grow"><b>ختمتك</b><div class="small muted">${k.todayLabel}</div></div></div></a>` : ''}
        <div class="tabs"><a class="tab ${tab === 'surahs' ? 'active' : ''}" href="#/quran?tab=surahs">السور</a><a class="tab ${tab === 'juz' ? 'active' : ''}" href="#/quran?tab=juz">الأجزاء</a><a class="tab ${tab === 'marks' ? 'active' : ''}" href="#/quran?tab=marks">محفوظاتي</a></div>
        ${body}
      </div>`
    };
  });
  S.onInput('qFilter', (el) => { const q = S.norm(el.value); S.$$('#slist .li').forEach((b) => (b.hidden = !!q && !b.dataset.n.includes(q))); });

  /* ---------- محرّك العرض ---------- */
  async function marksSet() { const m = await S.bm.list('quran'); return new Set(m.map((x) => x.ref)); }
  function banner(s) { const su = Q.surah(s); return `<div class="surah-banner">سورة ${esc(su.name)}<div class="small" style="font-family:var(--font-ui)">${esc(su.type)} • ${S.n(su.ayahs)} آية • الجزء ${S.n(su.juz)}</div></div>${s !== 1 && s !== 9 ? '<div class="basmala">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>' : ''}`; }
  const WAJIB = () => new Set(D().sajdaWajib.map(([s, a]) => s + ':' + a));
  function ayahHtml(s, a, marks, wj) {
    const t = Q.display(s, a); const sj = wj.has(s + ':' + a);
    return `<span class="ayah${marks.has(s + ':' + a) ? ' marked' : ''}" id="ay-${s}-${a}" data-act="qAyah" data-s="${s}" data-a="${a}">${esc(t)} <span class="ayah-end">${S.arNum(a)}</span>${sj ? '<span class="sajda">۩ سجدة واجبة</span>' : ''}</span> `;
  }
  /* segments: [{s, from, to}] */
  function renderSegments(segs, marks, mode) {
    const wj = WAJIB(); const showTr = S.settings.showTranslation && Q.tr; const rtlTr = Q.trInfo && Q.trInfo.dir === 'rtl';
    return segs.map((g) => {
      let h = g.from === 1 ? banner(g.s) : `<div class="small muted center">— سورة ${esc(Q.surahName(g.s))} —</div>`;
      if (mode === 'list') {
        h += '<div class="verse-list">';
        for (let a = g.from; a <= g.to; a++) h += `<div class="vrow"><div class="quran-flow">${ayahHtml(g.s, a, marks, wj)}</div>${showTr ? `<div class="tr" ${rtlTr ? 'style="direction:rtl;text-align:right"' : ''}>${esc(Q.translationAyah(g.s, a))}</div>` : ''}</div>`;
        h += '</div>';
      } else {
        h += '<div class="quran-flow">'; for (let a = g.from; a <= g.to; a++) h += ayahHtml(g.s, a, marks, wj); h += '</div>';
        if (showTr) h += '<details class="acc"><summary>الترجمة</summary><div class="acc-b verse-list">' + Array.from({ length: g.to - g.from + 1 }, (_, i) => `<div class="tr" ${rtlTr ? 'style="direction:rtl;text-align:right"' : ''}><b>${S.n(g.from + i)}.</b> ${esc(Q.translationAyah(g.s, g.from + i))}</div>`).join('') + '</div></details>';
      }
      return h;
    }).join('');
  }
  function barHtml(ctx) {
    const mode = S.settings.quranMode; const tr = S.settings.showTranslation && Q.tr;
    return `<div class="q-bar" id="qbar">
      <button class="btn sm primary" data-act="qPlayFrom" data-s="${ctx.s || ''}" data-a="${ctx.a || 1}">${S.icon('play').s} استماع</button>
      <button class="btn sm" data-act="qMode">${mode === 'list' ? 'عرض متصل' : 'آية بآية'}</button>
      <button class="btn sm ${tr ? 'gold' : ''}" data-act="qTrans">${S.icon('globe').s} ترجمة</button>
      <button class="iconbtn" data-act="qFont" data-d="-0.1" aria-label="تصغير الخط">${S.icon('minus').s}</button><button class="iconbtn" data-act="qFont" data-d="0.1" aria-label="تكبير الخط">${S.icon('plus').s}</button>
      <button class="btn sm" data-act="qJump">${S.icon('target').s} انتقال</button></div>`;
  }
  /* تتبّع آخر موضع قراءة وتحديث الختمة */
  let scrollHandler = null, lastPos = null;
  function trackPosition(view) {
    stopTrack();
    const save = S.debounce(() => {
      const top = view.getBoundingClientRect().top + 90; const els = S.$$('.ayah', view); let found = null;
      for (const e of els) { if (e.getBoundingClientRect().bottom > top) { found = e; break; } }
      if (!found) return; const pos = { s: +found.dataset.s, a: +found.dataset.a };
      if (lastPos && lastPos.s === pos.s && lastPos.a === pos.a) return;
      Q.autoMark(lastPos, pos); lastPos = pos; S.progress.set('quran', 'last', pos);
    }, 450);
    scrollHandler = { view, fn: save }; view.addEventListener('scroll', save, { passive: true });
  }
  function stopTrack() { if (scrollHandler) { scrollHandler.view.removeEventListener('scroll', scrollHandler.fn); scrollHandler = null; } }
  function flash(el) { if (!el) return; el.classList.add('active'); setTimeout(() => el.classList.remove('active'), 2600); }
  const scrollToAyah = (s, a) => { const el = document.getElementById(`ay-${s}-${a}`); if (el) { el.scrollIntoView({ block: 'center' }); flash(el); } return el; };
  Q.currentCtx = null;

  addQ('/quran/surah/:n', async (p, q) => {
    const n = +p.n; if (!(n >= 1 && n <= 114)) return { title: 'سورة', back: '/quran', html: S.ui.empty('alert', 'رقم سورة غير صحيح') };
    const su = Q.surah(n);
    if (!Q.hasText()) return { title: 'سورة ' + su.name, nav: 'quran', back: '/quran', html: noText() };
    const marks = await marksSet(); const startA = +(q.a || 0); Q.currentCtx = { type: 'surah', s: n };
    const nav = S.h`<div class="grid2 mt">${n < 114 ? S.h`<a class="btn" href="#/quran/surah/${n + 1}">سورة ${Q.surahName(n + 1)} ${S.icon('chevron-left')}</a>` : '<span></span>'}${n > 1 ? S.h`<a class="btn" href="#/quran/surah/${n - 1}">${S.icon('chevron-right')} سورة ${Q.surahName(n - 1)}</a>` : '<span></span>'}</div>`;
    return {
      title: 'سورة ' + su.name, nav: 'quran', back: '/quran',
      actions: [{ icon: 'search', label: 'بحث', href: '#/quran/search?s=' + n }],
      html: S.h`<div class="quran-page">${S.raw(barHtml({ s: n }))}${S.raw(renderSegments([{ s: n, from: 1, to: su.ayahs }], marks, S.settings.quranMode))}${nav}</div>`,
      mount(view) {
        lastPos = null; if (startA) { setTimeout(() => scrollToAyah(n, startA), 60); lastPos = { s: n, a: startA }; } else { const lp = S.progress.get('quran', 'last'); if (lp && lp.pos.s === n) lastPos = lp.pos; }
        trackPosition(view); if (Q.audio && Q.audio.attach) Q.audio.attach();
      },
      unmount() { stopTrack(); }
    };
  });
  addQ('/quran/juz/:n', async (p) => {
    const n = +p.n; const J = D().juzStarts; if (!(n >= 1 && n <= 30)) return { title: 'جزء', back: '/quran', html: S.ui.empty('alert', 'رقم جزء غير صحيح') };
    if (!Q.hasText()) return { title: 'الجزء ' + S.n(n), nav: 'quran', back: '/quran', html: noText() };
    const st = Q.gid(J[n - 1][0], J[n - 1][1]); const en = n < 30 ? Q.gid(J[n][0], J[n][1]) - 1 : D().totalAyahs;
    const a = Q.ref(st), b = Q.ref(en); const segs = [];
    for (let s = a.s; s <= b.s; s++) segs.push({ s, from: s === a.s ? a.a : 1, to: s === b.s ? b.a : Q.surah(s).ayahs });
    const marks = await marksSet(); Q.currentCtx = { type: 'juz', s: a.s, a: a.a };
    return {
      title: 'الجزء ' + S.n(n), nav: 'quran', back: '/quran?tab=juz',
      html: S.h`<div class="quran-page">${S.raw(barHtml({ s: a.s, a: a.a }))}${S.raw(renderSegments(segs, marks, S.settings.quranMode))}<div class="grid2 mt">${n < 30 ? S.h`<a class="btn" href="#/quran/juz/${n + 1}">الجزء التالي ${S.icon('chevron-left')}</a>` : '<span></span>'}${n > 1 ? S.h`<a class="btn" href="#/quran/juz/${n - 1}">${S.icon('chevron-right')} الجزء السابق</a>` : '<span></span>'}</div></div>`,
      mount(view) { lastPos = null; trackPosition(view); if (Q.audio && Q.audio.attach) Q.audio.attach(); }, unmount() { stopTrack(); }
    };
  });
  addQ('/quran/page/:n', async (p) => {
    const n = +p.n; if (!Q.hasText()) return { title: 'صفحة', nav: 'quran', back: '/quran', html: noText() };
    if (!Q.pages) return { title: 'صفحة', back: '/quran', html: S.ui.empty('info', 'بيانات الصفحات غير متوفرة', 'أعد تحميل المصحف من صفحة التنزيلات.') };
    if (!(n >= 1 && n <= 604)) return { title: 'صفحة', back: '/quran', html: S.ui.empty('alert', 'رقم صفحة غير صحيح (1 - 604)') };
    const segs = []; Q.pages.forEach((arr, si) => { let from = 0, to = 0; arr.forEach((pg, ai) => { if (pg === n) { if (!from) from = ai + 1; to = ai + 1; } }); if (from) segs.push({ s: si + 1, from, to }); });
    const marks = await marksSet(); Q.currentCtx = { type: 'page', s: segs[0].s, a: segs[0].from };
    return { title: 'صفحة ' + S.n(n), nav: 'quran', back: '/quran', html: S.h`<div class="quran-page">${S.raw(barHtml({ s: segs[0].s, a: segs[0].from }))}${S.raw(renderSegments(segs, marks, 'flow'))}<div class="grid2 mt">${n < 604 ? S.h`<a class="btn" href="#/quran/page/${n + 1}">الصفحة التالية ${S.icon('chevron-left')}</a>` : '<span></span>'}${n > 1 ? S.h`<a class="btn" href="#/quran/page/${n - 1}">${S.icon('chevron-right')} السابقة</a>` : '<span></span>'}</div></div>`, mount(v) { lastPos = null; trackPosition(v); if (Q.audio && Q.audio.attach) Q.audio.attach(); }, unmount() { stopTrack(); } };
  });

  /* أزرار الشريط */
  S.act('qMode', () => { S.set('quranMode', S.settings.quranMode === 'list' ? 'flow' : 'list'); S.router.refresh(); });
  S.act('qTrans', async () => { if (!Q.tr) { S.toast('لم تُحمَّل ترجمة بعد — اختر واحدة من التنزيلات'); return S.router.go('/quran/download'); } S.set('showTranslation', !S.settings.showTranslation); S.router.refresh(); });
  S.act('qFont', (el) => { S.set('quranScale', S.clamp(Math.round((S.settings.quranScale + +el.dataset.d) * 10) / 10, 0.8, 2.2)); });
  S.act('qJump', async () => {
    const c = Q.currentCtx; if (!c) return; const su = Q.surah(c.s);
    const v = await S.prompt('الانتقال إلى آية', { label: c.type === 'surah' ? 'رقم الآية (1 - ' + su.ayahs + ')' : 'مثال: ' + c.s + ':' + (c.a || 1) + ' أو رقم السورة فقط', type: c.type === 'surah' ? 'number' : 'text', ok: 'انتقل' }); if (!v) return;
    let s = c.s, a; const m = String(v).match(/^\s*(\d+)\s*[:：\/]\s*(\d+)\s*$/); if (m) { s = +m[1]; a = +m[2]; } else a = +v;
    if (c.type !== 'surah' && !m) { s = +v; a = 1; }
    if (!(s >= 1 && s <= 114) || !(a >= 1 && a <= Q.surah(s).ayahs)) return S.toast('رقم غير صحيح', 'err');
    if (s === c.s && document.getElementById(`ay-${s}-${a}`)) scrollToAyah(s, a); else S.router.go(`/quran/surah/${s}?a=${a}`);
  });

  /* ---------- قائمة الآية ---------- */
  const refStr = (s, a) => 'سورة ' + Q.surahName(s) + ' • آية ' + S.n(a);
  S.act('qAyah', async (el) => {
    const s = +el.dataset.s, a = +el.dataset.a; const bm = await S.bm.has('quran', s + ':' + a); const fv = S.fav.has('ayah', s + ':' + a);
    const tr = S.settings.showTranslation && Q.tr ? Q.translationAyah(s, a) : '';
    const btn = (act, ic, t) => S.h`<button class="btn" data-act="${act}" data-s="${s}" data-a="${a}">${S.icon(ic)} ${t}</button>`;
    S.modal({
      title: refStr(s, a),
      body: S.h`<div class="q-inline" style="font-size:1.35rem">${Q.display(s, a)}</div>${tr ? S.h`<p class="small muted center nm" dir="ltr">${tr}</p>` : ''}
        <div class="grid2 mt">${btn('qPlayFrom', 'play', 'استماع من هنا')}${btn('qCopy', 'copy', 'نسخ')}${btn('qShareT', 'share', 'مشاركة نص')}${btn('qShareI', 'image', 'مشاركة صورة')}${btn('qBm', 'bookmark', bm ? 'إزالة الإشارة' : 'إشارة مرجعية')}${btn('qFav', 'heart', fv ? 'إزالة من المفضلة' : 'إضافة للمفضلة')}${btn('qNote', 'notebook', 'ملاحظة')}${btn('qSetLast', 'flag', 'هنا توقفت')}</div>
        <a class="btn gold block mt" href="#/quran/ayah/${s}/${a}" data-act="closeM">${S.icon('scroll')} التفسير وأسباب النزول والروايات</a>`,
      actions: [{ label: 'إغلاق', cls: 'ghost' }]
    });
  });
  S.act('closeM', () => S.closeAllModals());
  const xy = (el) => ({ s: +el.dataset.s, a: +el.dataset.a });
  S.act('qCopy', (el) => { const { s, a } = xy(el); S.copy('﴿' + Q.display(s, a) + '﴾\n[' + refStr(s, a) + ']'); });
  S.act('qShareT', (el) => { const { s, a } = xy(el); S.share({ title: refStr(s, a), text: '﴿' + Q.display(s, a) + '﴾\n[' + refStr(s, a) + ']\n— سِراج' }); });
  S.act('qShareI', (el) => { const { s, a } = xy(el); return Q.shareImage(s, a); });
  S.act('qBm', async (el) => { const { s, a } = xy(el); const id = s + ':' + a; if (await S.bm.has('quran', id)) { await S.bm.remove('quran', id); S.toast('أُزيلت الإشارة', 'ok'); } else { await S.bm.add('quran', id, refStr(s, a), { s, a }); S.toast('أُضيفت إشارة مرجعية', 'ok'); } S.closeAllModals(); const e = document.getElementById(`ay-${s}-${a}`); if (e) e.classList.toggle('marked'); });
  S.act('qFav', async (el) => { const { s, a } = xy(el); const on = await S.fav.toggle('ayah', s + ':' + a, { s, a, label: refStr(s, a) }); S.toast(on ? 'أُضيفت إلى المفضلة' : 'أُزيلت من المفضلة', 'ok'); S.closeAllModals(); });
  S.act('qSetLast', async (el) => { const { s, a } = xy(el); lastPos = { s, a }; await S.progress.set('quran', 'last', { s, a }); S.toast('سُجّل موضع قراءتك', 'ok'); S.closeAllModals(); });
  S.act('qNote', async (el) => {
    const { s, a } = xy(el); S.closeAllModals(); const v = await S.prompt('ملاحظة على ' + refStr(s, a), { multiline: true, label: 'ملاحظتك (تُحفظ في جهازك)', ok: 'حفظ' }); if (!v || !v.trim()) return;
    await S.db.put('notes', { id: S.uid('nt'), type: 'quran', ref: s + ':' + a, text: v.trim(), ts: Date.now() }); S.toast('حُفظت الملاحظة', 'ok');
  });
  S.act('qPlayFrom', (el) => { let s = +el.dataset.s, a = +el.dataset.a; if (!s) { const c = Q.currentCtx; s = c ? c.s : 1; a = 1; } S.closeAllModals(); if (!Q.audio) return S.toast('وحدة الصوت غير محمّلة', 'err'); return Q.audio.play(s, a || 1); });

  /* ---------- مشاركة آية كصورة ---------- */
  Q.shareImage = async function (s, a) {
    if (!Q.hasText()) return S.toast('نص المصحف غير محمّل', 'err');
    try { await document.fonts.load('48px "Amiri Quran"'); } catch (e) { /* خط احتياطي */ }
    const W = 1080, H = 1350; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#103B2F'); g.addColorStop(1, '#082820'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#D6B15E'; x.lineWidth = 6; x.strokeRect(36, 36, W - 72, H - 72); x.lineWidth = 2; x.globalAlpha = .5; x.strokeRect(54, 54, W - 108, H - 108); x.globalAlpha = 1;
    x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = '#EAD59A'; x.font = '700 44px "Amiri Quran","Amiri","Noto Naskh Arabic",serif'; x.fillText('سِراج', W / 2, 150);
    const txt = '﴿ ' + Q.display(s, a) + ' ﴾'; let size = 64; let lines;
    const wrap = (sz) => { x.font = `${sz}px "Amiri Quran","Amiri","Noto Naskh Arabic",serif`; const words = txt.split(' '); const out = []; let cur = ''; words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > W - 220 && cur) { out.push(cur); cur = w; } else cur = t; }); if (cur) out.push(cur); return out; };
    lines = wrap(size); while (lines.length * size * 1.9 > 780 && size > 26) { size -= 4; lines = wrap(size); }
    x.fillStyle = '#F6F1E5'; const total = lines.length * size * 1.9; let y = 640 - total / 2 + size * 1.2; lines.forEach((l) => { x.fillText(l, W / 2, y); y += size * 1.9; });
    x.fillStyle = '#D6B15E'; x.font = '600 42px Cairo,"Noto Sans Arabic",system-ui,sans-serif'; x.fillText(refStr(s, a).replace(/\d+/g, (d) => S.arNum(d)), W / 2, H - 170);
    x.fillStyle = 'rgba(246,241,229,.7)'; x.font = '400 28px Cairo,system-ui,sans-serif'; x.fillText('نص القرآن: مشروع Tanzil', W / 2, H - 110);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); if (!blob) return S.toast('تعذّر إنشاء الصورة', 'err');
    const file = new File([blob], `siraj-${s}-${a}.png`, { type: 'image/png' }); S.closeAllModals(); await S.share({ title: refStr(s, a), files: [file] });
  };

  /* ---------- صفحة الآية: تفسير وأسباب نزول وروايات (من مصادر مضافة فقط) ---------- */
  function matchVerse(v, s, a) { const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(String(v).trim()); if (!m) return false; return +m[1] === s && a >= +m[2] && a <= +(m[3] || m[2]); }
  Q.entriesFor = async (s, a) => (await S.db.all('entries')).filter((e) => (e.verses || []).some((v) => matchVerse(v, s, a)));
  addQ('/quran/ayah/:s/:a', async (p) => {
    const s = +p.s, a = +p.a; const su = Q.surah(s); if (!su || !(a >= 1 && a <= su.ayahs)) return { title: 'آية', back: '/quran', html: S.ui.empty('alert', 'آية غير موجودة') };
    const ents = await Q.entriesFor(s, a); const notes = (await S.db.where('notes', 'type', 'quran')).filter((n) => n.ref === s + ':' + a);
    const ahl = S.data.sample.ahlVerses.filter((v) => v.s === s && v.a === a); const L = S.library;
    const rel = ahl.flatMap((v) => v.relatedBooks).map((id) => L.byId.get(id)).filter((b) => b && L.visible(b));
    const tafsirBooks = L.published().filter((b) => b.section === 'tafsir').slice(0, 6);
    const cols = { tafsir: 'التفسير', asbab: 'أسباب النزول', narrations: 'روايات متصلة بالآية' };
    return {
      title: refStr(s, a), nav: 'quran', back: '/quran/surah/' + s + '?a=' + a,
      html: S.h`<div class="stack">
        ${Q.hasText() ? S.h`<div class="card verse-card"><div class="q-inline">${Q.display(s, a)} <span class="ayah-end">${S.arNum(a)}</span></div>${S.settings.showTranslation && Q.tr ? S.h`<p class="small muted center" dir="ltr">${Q.translationAyah(s, a)}</p>` : ''}<div class="row between"><a class="btn sm" href="#/quran/surah/${s}?a=${a}">القراءة في السياق</a><button class="btn sm" data-act="qPlayFrom" data-s="${s}" data-a="${a}">${S.icon('play')} استماع</button></div></div>` : noText()}
        ${ahl.map((v) => S.h`<div class="notice gold">${S.icon('star')}<div><b>${v.name}</b><div class="small">${v.agreement}</div></div></div>`)}
        ${Object.entries(cols).map(([c, title]) => { const list = ents.filter((e) => e.collection === c); return S.h`<div class="card"><div class="card-t">${S.icon('scroll')} ${title}</div>${list.length ? list.map((e) => S.h`<a class="li" href="#/research/${c}/${e.id}"><span class="li-body"><span class="li-t">${e.title}</span><span class="li-s">${(e.sources[0] || {}).book || ''}</span></span>${S.icon('chevron-left')}</a>`) : S.h`<p class="small muted nm">لا يوجد في بيانات التطبيق ${title} موثق لهذه الآية بعد. لا يولّد سِراج تفسيراً من عنده؛ يُضاف نص موثق مع مصدره من المحرّر.</p>`}<a class="btn sm mt" href="#/research/${c}/new?verse=${s}:${a}">${S.icon('plus')} إضافة ${title} موثّق</a></div>`; })}
        ${rel.length ? S.h`${S.ui.sectionTitle('كتب ذات صلة من المكتبة')}<div class="stack s">${rel.map(L.row)}</div>` : ''}
        ${tafsirBooks.length ? S.h`${S.ui.sectionTitle('كتب التفسير في المكتبة', '#/library/sec/tafsir')}<div class="hscroll">${tafsirBooks.map(L.card)}</div>` : ''}
        ${notes.length ? S.h`<div class="card"><div class="card-t">${S.icon('notebook')} ملاحظاتي</div>${notes.map((n) => S.h`<p class="nm">${n.text}</p>`)}</div>` : ''}
      </div>`
    };
  });

  /* ---------- البحث ---------- */
  addQ('/quran/search', (p, q) => {
    const term = (q.q || '').trim(); const lim = +(q.n || 30); const sf = +(q.s || 0);
    const res = term && Q.hasText() ? Q.search(term, { s: sf || undefined, inTranslation: !!(Q.tr && S.settings.showTranslation) }) : [];
    return {
      title: 'بحث في القرآن', nav: 'quran', back: '/quran',
      html: S.h`<div class="stack"><div class="searchbox">${S.icon('search')}<input class="input" id="qq" type="search" value="${term}" placeholder="كلمة أو أكثر (بدون تشكيل)" enterkeyhint="search" autocomplete="off"></div>
        <div class="field"><select class="select" id="qs"><option value="0">كل السور</option>${D().surahs.map((x) => S.h`<option value="${x.n}" ${x.n === sf ? S.raw('selected') : ''}>${S.n(x.n)}. ${x.name}</option>`)}</select></div>
        ${!Q.hasText() ? noText() : !term ? S.h`<p class="small muted nm">يتجاهل البحث التشكيل وأشكال الألف والهاء/التاء المربوطة. اكتب كلمة أو أكثر؛ تظهر الآيات التي تحتويها جميعاً.</p>` : res.length ? S.h`<div class="small muted">${S.n(res.length)} نتيجة</div><div class="list">${res.slice(0, lim).map((r) => S.h`<a class="li" href="#/quran/surah/${r.s}?a=${r.a}"><span class="li-body"><span class="li-t" style="font-family:var(--font-quran);font-weight:400;font-size:1.15rem;white-space:normal;line-height:2">${S.raw(r.tr ? esc(Q.translationAyah(r.s, r.a)) : Q.highlight(Q.display(r.s, r.a), term))}</span><span class="li-s">${refStr(r.s, r.a)}</span></span></a>`)}</div>${res.length > lim ? S.h`<a class="btn block" href="#/quran/search?q=${encodeURIComponent(term)}&s=${sf}&n=${lim + 30}&keep=1">عرض المزيد</a>` : ''}` : S.ui.empty('search', 'لا نتائج', 'جرّب كلمة أقصر أو بدون أل التعريف.')}
      </div>`,
      mount(root) { const go = () => S.router.go('/quran/search?q=' + encodeURIComponent(S.$('#qq').value) + '&s=' + S.$('#qs').value); S.$('#qq').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); S.$('#qs').addEventListener('change', go); }
    };
  });

  /* ---------- الإشارات والمفضلة والملاحظات ---------- */
  addQ('/quran/bookmarks', async (p, q) => {
    const tab = q.tab || 'marks'; const marks = await S.bm.list('quran'); const favs = await S.fav.list('ayah'); const notes = (await S.db.where('notes', 'type', 'quran')).sort((a, b) => b.ts - a.ts);
    const item = (s, a, sub, extra) => S.h`<a class="li" href="#/quran/surah/${s}?a=${a}"><span class="li-ico">${S.icon(tab === 'favs' ? 'heart' : tab === 'notes' ? 'notebook' : 'bookmark')}</span><span class="li-body"><span class="li-t">${refStr(s, a)}</span>${sub ? S.h`<span class="li-s">${sub}</span>` : ''}</span>${extra || ''}</a>`;
    const list = tab === 'favs' ? favs.map((f) => { const [s, a] = f.ref.split(':').map(Number); return item(s, a, Q.hasText() ? Q.display(s, a).slice(0, 70) + '…' : ''); }) : tab === 'notes' ? notes.map((n) => { const [s, a] = n.ref.split(':').map(Number); return item(s, a, n.text); }) : marks.map((m) => { const [s, a] = m.ref.split(':').map(Number); return item(s, a, S.fmt.dt(m.ts)); });
    return { title: 'محفوظاتي', nav: 'quran', back: '/quran?tab=marks', html: S.h`<div class="stack"><div class="tabs"><a class="tab ${tab === 'marks' ? 'active' : ''}" href="#/quran/bookmarks?tab=marks">إشارات (${S.n(marks.length)})</a><a class="tab ${tab === 'favs' ? 'active' : ''}" href="#/quran/bookmarks?tab=favs">مفضلة (${S.n(favs.length)})</a><a class="tab ${tab === 'notes' ? 'active' : ''}" href="#/quran/bookmarks?tab=notes">ملاحظات (${S.n(notes.length)})</a></div>${list.length ? S.h`<div class="list">${list}</div>` : S.ui.empty('bookmark', 'لا شيء هنا بعد', 'اضغط على أي آية في المصحف لإضافتها.')}</div>` };
  });

  /* ---------- الختمة ---------- */
  addQ('/quran/khatma', () => {
    const k = Q.khatma(); const hist = S.kv.get('khatma.history', []);
    if (!k) return { title: 'ختمة القرآن', nav: 'quran', back: '/quran', html: S.h`<div class="stack"><div class="card"><div class="card-t">${S.icon('target')} ابدأ ختمة</div><p class="small muted nm">اختر الخطة. يُوزَّع القرآن على أجزاء الأيام بحسب تقسيم الأجزاء (30 يوماً) أو المنازل السبعة (7 أيام)، ويُحتسب تقدمك تلقائياً عند قراءة الورد في المصحف، أو يدوياً.</p><div class="grid2 mt"><button class="btn primary" data-act="khStart" data-plan="30">ختمة في 30 يوماً<br><small>جزء يومياً</small></button><button class="btn gold" data-act="khStart" data-plan="7">ختمة في 7 أيام<br><small>منزل يومياً</small></button></div></div>${hist.length ? S.h`<div class="notice ok">${S.icon('trophy')}<div>أتممتَ ${S.n(hist.length)} ختمة سابقة.</div></div>` : ''}</div>` };
    return {
      title: 'ختمة القرآن', nav: 'quran', back: '/quran',
      html: S.h`<div class="stack"><div class="card center">${S.ui.ring(k.pct)}<div class="mt">اليوم <b>${S.n(k.dayNo)}</b> من ${S.n(k.plan)} • ${S.n(k.readAyahs)} آية من ${S.n(6236)}</div><div class="small ${k.late ? 'bad' : 'muted'}">${k.late ? 'متأخر عن ' + S.n(k.late) + ' ورد' : 'على الجدول'}</div>
        ${k.next ? S.h`<a class="btn primary block mt" href="#/quran/surah/${k.next.from.s}?a=${k.next.from.a}">${S.icon('book-open')} اقرأ الآن: ${k.lbl(k.next)}</a>` : ''}</div>
        <div class="card"><div class="card-t">${S.icon('list')} الأوراد</div>${k.ps.map((p) => S.h`<div class="kv"><span><a href="#/quran/surah/${p.from.s}?a=${p.from.a}">${k.plan === 30 ? 'الجزء ' : 'اليوم '}${S.n(p.i)}</a><small class="muted" style="display:block">${k.lbl(p)} • ${S.n(p.n)} آية</small></span><label class="switch"><input type="checkbox" ${k.done[p.i] ? S.raw('checked') : ''} data-chg="khToggle" data-i="${p.i}" aria-label="تم"><i></i></label></div>`)}</div>
        <button class="btn danger block" data-act="khReset">إنهاء الخطة الحالية</button></div>`
    };
  });
  S.act('khStart', async (el) => { await S.kv.set('khatma', { plan: +el.dataset.plan, start: S.today(), done: {} }); S.toast('بدأت الختمة. بارك الله لك', 'ok'); S.router.refresh(); });
  S.onChange('khToggle', async (el) => { await Q.markDone(+el.dataset.i, el.checked); S.router.refresh(); });
  S.act('khReset', async () => { if (await S.confirm('إنهاء خطة الختمة الحالية وحذف تقدّمها؟', { danger: true })) { await S.kv.del('khatma'); S.router.refresh(); } });

  /* ---------- التنزيلات ---------- */
  addQ('/quran/download', async () => {
    const trs = await Q.translationList(); const rec = Q.hasText(); const au = await S.db.all('audio'); const size = au.reduce((a, r) => a + (r.size || 0), 0);
    const groups = {}; au.forEach((r) => { const [rc, g] = r.id.split(':'); const ref = Q.ref(+g); const k = rc + '|' + ref.s; groups[k] = (groups[k] || 0) + 1; });
    return {
      title: 'التنزيلات', nav: 'quran', back: '/quran',
      html: S.h`<div class="stack">
        <div class="card"><div class="card-t">${S.icon('book-open')} نص المصحف (عثماني)</div>
          <div class="kv"><span>الحالة</span><b class="${rec ? 'ok' : ''}">${rec ? 'محمّل ومتحقَّق منه' : 'غير محمّل'}</b></div>
          ${rec ? S.h`<div class="kv"><span>التحقق</span><b>114 سورة • 6236 آية • أعداد الآيات مطابقة</b></div><div class="kv"><span>البصمة</span><b class="op-ltr">${Q.fp}</b></div><div class="kv"><span>تاريخ التحميل</span><b>${S.fmt.dt(Q.fetchedAt)}</b></div>` : ''}
          <p class="small muted nm mt">${D().attribution.text}</p>
          <div class="row wrap">${D().attribution.links.map(([t, u]) => S.h`<a class="chip" target="_blank" rel="noopener noreferrer" href="${u}">${t}</a>`)}</div>
          <div class="mt" id="dlstate"></div>
          <button class="btn gold block mt" data-act="qDownload">${S.icon('download')} ${rec ? 'إعادة التحميل والتحقق' : 'تحميل المصحف الشريف (≈ 1 ميغابايت)'}</button>
          ${rec ? S.h`<button class="btn danger block mt" data-act="qRemoveText">حذف النص من الجهاز</button>` : ''}
          <p class="tiny muted nm mt">يحتاج التحميل إلى اتصال بالإنترنت مرة واحدة. لا يُعدَّل النص بعد وصوله؛ وإذا لم يتطابق مع عدّ الآيات المعتمد يُرفض ولا يُحفظ.</p></div>
        <div class="card"><div class="card-t">${S.icon('globe')} الترجمة</div>
          ${trs.length ? trs.map((t) => S.h`<div class="kv"><span>${t.name}<small class="muted" style="display:block">${t.author}</small></span><span><button class="btn xs ${S.settings.translation === t.id.slice(3) ? 'gold' : ''}" data-act="qTrUse" data-id="${t.id.slice(3)}">استخدام</button> <button class="btn xs danger" data-act="qTrDel" data-id="${t.id.slice(3)}">حذف</button></span></div>`) : S.h`<p class="small muted nm">لا ترجمة محمّلة.</p>`}
          <div class="field mt"><label>تحميل ترجمة</label><select class="select" id="trsel">${D().api.defaultTranslations.map(([id, n]) => S.h`<option value="${id}">${n}</option>`)}</select></div>
          <button class="btn block" data-act="qTrDownload">${S.icon('download')} تحميل الترجمة المختارة</button><button class="btn block mt" data-act="qTrMore">قائمة كل الترجمات المتاحة (يتطلب إنترنت)</button></div>
        <div class="card"><div class="card-t">${S.icon('volume')} التلاوة دون إنترنت</div>
          <p class="small muted nm">تُبثّ التلاوة من شبكة cdn.islamic.network عند الاستماع، ويمكنك تنزيل سورة كاملة لقارئ معيّن لسماعها دون اتصال. المساحة المستخدمة حالياً: <b>${S.fmt.bytes(size)}</b>.</p>
          ${Object.keys(groups).length ? Object.entries(groups).slice(0, 40).map(([k, n]) => { const [rc, s] = k.split('|'); return S.h`<div class="kv"><span>${(Q.reciters().find((r) => r.id === rc) || { name: rc }).name} — سورة ${Q.surahName(+s)}</span><span>${S.n(n)}/${S.n(Q.surah(+s).ayahs)} <button class="btn xs danger" data-act="qAudioDel" data-rc="${rc}" data-s="${s}">حذف</button></span></div>`; }) : S.h`<p class="small muted nm">لا تلاوات منزَّلة. افتح أي سورة واضغط «استماع» ثم زر التنزيل في المشغّل.</p>`}
          <button class="btn block mt" data-act="qRecRefresh">تحديث قائمة القرّاء (يتطلب إنترنت)</button></div>
      </div>`
    };
  });
  S.act('qDownload', async (el) => {
    const out = S.$('#dlstate'); el.disabled = true; out.innerHTML = '<div class="notice info">' + S.icon('refresh').s + '<div>جارٍ التحميل والتحقق…</div></div>';
    try { const r = await Q.download(); S.toast('تم تحميل المصحف والتحقق من ' + S.n(r.total) + ' آية', 'ok'); S.router.refresh(); }
    catch (e) { el.disabled = false; out.innerHTML = ''; out.appendChild(Object.assign(document.createElement('div'), { className: 'notice err', innerHTML: S.icon('alert').s + '<div><b>تعذّر التحميل</b><div class="small">' + esc(e.message) + '</div><div class="small muted">' + (navigator.onLine ? 'تحقق من الاتصال وأعد المحاولة.' : 'أنت دون اتصال.') + ' لم يُحفظ شيء.</div></div>' })); }
  });
  S.act('qRemoveText', async () => { if (await S.confirm('حذف نص المصحف من الجهاز؟ يمكن إعادة تحميله لاحقاً.', { danger: true })) { await Q.removeText(); S.router.refresh(); } });
  S.act('qTrDownload', async (el) => { const id = S.$('#trsel').value; el.disabled = true; try { const r = await Q.downloadTranslation(id); S.toast('تم تحميل الترجمة: ' + r.name, 'ok'); S.router.refresh(); } catch (e) { el.disabled = false; S.toast('تعذّر تحميل الترجمة: ' + e.message, 'err'); } });
  S.act('qTrUse', async (el) => { S.set({ translation: el.dataset.id, showTranslation: true }); await Q.loadLocal(); S.router.refresh(); });
  S.act('qTrDel', async (el) => { if (await S.confirm('حذف هذه الترجمة من الجهاز؟')) { await Q.removeTranslation(el.dataset.id); S.router.refresh(); } });
  S.act('qTrMore', async () => {
    try { const r = await fetch(D().api.base + '/edition/type/translation', { cache: 'no-store' }); if (!r.ok) throw new Error('الرمز ' + r.status); const j = await r.json(); const list = (j.data || []).slice(0, 200); const sel = S.$('#trsel'); sel.innerHTML = list.map((e) => `<option value="${esc(e.identifier)}">${esc((e.language || '').toUpperCase() + ' — ' + (e.englishName || e.name))}</option>`).join(''); S.toast('حُدّثت القائمة (' + S.n(list.length) + ')', 'ok'); }
    catch (e) { S.toast('تعذّر جلب القائمة: ' + e.message, 'err'); }
  });
  S.act('qRecRefresh', async () => { try { const l = await Q.refreshReciters(); S.toast('وصل ' + S.n(l.length) + ' قارئاً', 'ok'); } catch (e) { S.toast('تعذّر التحديث: ' + e.message, 'err'); } });
  S.act('qAudioDel', async (el) => { const rc = el.dataset.rc, s = +el.dataset.s; for (let a = 1; a <= Q.surah(s).ayahs; a++) await S.db.del('audio', rc + ':' + Q.gid(s, a)); S.router.refresh(); });
})();

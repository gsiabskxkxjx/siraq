/* =====================================================================
   سِراج — quran-audio.js : مشغّل التلاوة (آية بآية)
   • البثّ من cdn.islamic.network بإذن المستخدم، أو من نسخة منزَّلة في IndexedDB للعمل دون إنترنت.
   • قرّاء متعددون، سرعات، تكرار آية/سورة، تمييز الآية الجارية، أزرار شاشة القفل (Media Session).
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const Q = S.quran; const esc = S.esc;
  const D = () => S.data.quran;
  const RATES = [0.75, 1, 1.25, 1.5, 1.75];
  let el = null, blobUrl = null, token = 0;

  const A = (Q.audio = {
    cur: null, state: 'idle', rate: 1, repeat: 'off',
    reciter: () => S.settings.reciter,
    reciterName() { const r = Q.reciters().find((x) => x.id === A.reciter()); return r ? r.name : A.reciter(); },
    /* بعض الإصدارات (مثل المنشاوي المجوّد) لا تتوفر إلا بـ64 كيلوبت على الشبكة */
    bitrate(r) { return ({ 'ar.minshawimujawwad': 64 })[r] || D().api.audioBitrate; },
    /* جودات الشبكة تختلف بين القرّاء: نجرّب المفضّلة ثم البقية، ونحفظ ما نجح لهذا القارئ */
    good: {},
    rates(r) { const f = A.good[r] || A.bitrate(r); return [f].concat([128, 64, 192, 48, 32].filter((x) => x !== f)); },
    urlAt(s, a, i) { const api = D().api; const r = A.reciter(); return api.audioCdn + '/' + A.rates(r)[i] + '/' + r + '/' + Q.gid(s, a) + '.mp3'; },
    url(s, a) { return A.urlAt(s, a, 0); },
    audioEl() {
      if (el) return el; el = new Audio(); el.preload = 'auto';
      el.addEventListener('ended', onEnded); el.addEventListener('timeupdate', onTime);
      el.addEventListener('error', () => { if (A.state === 'idle') return; const off = !navigator.onLine;
        if (!off && A.cur && /^https?:/.test(el.src || '') && (A.tryI || 0) < A.rates(A.reciter()).length - 1) { A.tryI = (A.tryI || 0) + 1; el.src = A.urlAt(A.cur.s, A.cur.a, A.tryI); el.play().catch(() => {}); return; } S.toast(off ? 'أنت دون اتصال، ولم تُنزَّل هذه التلاوة. نزّل السورة للاستماع دون إنترنت.' : 'تعذّر تشغيل التلاوة (تحقق من الاتصال أو اختر قارئاً آخر).', 'err'); A.setState('paused'); });
      el.addEventListener('play', () => { A.setState('playing'); if (A.tryI && A.cur && /^https?:/.test(el.src || '')) { A.good[A.reciter()] = A.rates(A.reciter())[A.tryI]; A.tryI = 0; } }); el.addEventListener('pause', () => { if (A.state !== 'idle' && !el.ended) A.setState('paused'); });
      return el;
    },
    setState(st) { A.state = st; const b = S.$('#pl-pp'); if (b) { b.innerHTML = S.icon(st === 'playing' ? 'pause' : 'play').s; b.setAttribute('aria-label', st === 'playing' ? 'إيقاف مؤقت' : 'تشغيل'); } if ('mediaSession' in navigator) navigator.mediaSession.playbackState = st === 'playing' ? 'playing' : 'paused'; },
    async play(s, a) {
      if (!Q.hasText()) return S.toast('حمّل نص المصحف أولاً', 'err');
      A.bar(); const my = ++token; A.cur = { s, a }; const gid = Q.gid(s, a); const e = A.audioEl();
      A.tryI = 0; let src = A.url(s, a);
      try { const rec = await S.db.get('audio', A.reciter() + ':' + gid); if (rec && rec.blob) { if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = URL.createObjectURL(rec.blob); src = blobUrl; } } catch (x) { /* بثّ مباشر */ }
      if (my !== token) return;
      e.src = src; e.playbackRate = A.rate; A.paint(); A.mark();
      try { await e.play(); } catch (x) { if (x && x.name !== 'AbortError') { S.toast('تعذّر التشغيل: ' + (x.message || x), 'err'); A.setState('paused'); } }
      A.session();
    },
    toggle() { const e = A.audioEl(); if (!A.cur) return; if (e.paused) e.play().catch(() => {}); else e.pause(); },
    next() { if (!A.cur) return; const n = Q.surah(A.cur.s).ayahs; if (A.cur.a < n) A.play(A.cur.s, A.cur.a + 1); else if (A.cur.s < 114) A.play(A.cur.s + 1, 1); },
    prev() { if (!A.cur) return; if (A.cur.a > 1) A.play(A.cur.s, A.cur.a - 1); else if (A.cur.s > 1) A.play(A.cur.s - 1, Q.surah(A.cur.s - 1).ayahs); },
    stop() { token++; if (el) { el.pause(); el.removeAttribute('src'); el.load(); } if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; } A.state = 'idle'; A.cur = null; A.mark(); const b = S.$('#qplayer'); if (b) b.remove(); document.body.classList.remove('has-player'); },
    /* تمييز الآية الجارية في الصفحة المفتوحة */
    mark() { S.$$('.ayah.playing').forEach((x) => x.classList.remove('playing', 'active')); if (!A.cur) return; const x = document.getElementById(`ay-${A.cur.s}-${A.cur.a}`); if (x) { x.classList.add('playing', 'active'); const v = document.getElementById('view'); const r = x.getBoundingClientRect(), vr = v.getBoundingClientRect(); if (r.top < vr.top + 90 || r.bottom > vr.bottom - 190) x.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
    attach() { A.mark(); },
    paint() { const t = S.$('#pl-title'); if (t && A.cur) t.textContent = 'سورة ' + Q.surahName(A.cur.s) + ' • آية ' + S.n(A.cur.a) + ' — ' + A.reciterName(); },
    session() {
      if (!('mediaSession' in navigator) || !A.cur) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'سورة ' + Q.surahName(A.cur.s) + ' — آية ' + A.cur.a, artist: A.reciterName(), album: 'سِراج', artwork: [{ src: 'assets/images/icon-512.png', sizes: '512x512', type: 'image/png' }] });
        navigator.mediaSession.setActionHandler('play', () => A.toggle()); navigator.mediaSession.setActionHandler('pause', () => A.toggle());
        navigator.mediaSession.setActionHandler('nexttrack', () => A.next()); navigator.mediaSession.setActionHandler('previoustrack', () => A.prev());
      } catch (e) { /* غير مدعوم */ }
    },
    bar() {
      if (S.$('#qplayer')) return; document.body.classList.add('has-player');
      const d = document.createElement('div'); d.className = 'player'; d.id = 'qplayer'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'مشغّل التلاوة');
      d.innerHTML = `<div class="row between"><div class="pl-t" id="pl-title"></div><button class="iconbtn" data-act="plClose" aria-label="إغلاق المشغّل">${S.icon('close').s}</button></div>
        <div class="row between" style="margin-top:2px"><button class="iconbtn" data-act="plPrev" aria-label="الآية السابقة">${S.icon('skip-prev').s}</button><button class="iconbtn" id="pl-pp" data-act="plToggle" aria-label="تشغيل">${S.icon('pause').s}</button><button class="iconbtn" data-act="plNext" aria-label="الآية التالية">${S.icon('skip-next').s}</button>
        <button class="iconbtn" id="pl-rep" data-act="plRepeat" aria-label="التكرار">${S.icon('repeat').s}<small id="pl-rept" style="font-size:.6rem"></small></button>
        <button class="iconbtn" data-act="plDownload" aria-label="تنزيل السورة للاستماع دون إنترنت">${S.icon('download').s}</button></div>
        <div class="row" style="margin-top:4px;gap:8px"><select id="pl-rate" data-chg="plRate" aria-label="السرعة" style="width:84px">${RATES.map((r) => `<option value="${r}" ${r === A.rate ? 'selected' : ''}>${S.n(r)}×</option>`).join('')}</select>
        <select id="pl-rec" data-chg="plRec" aria-label="القارئ" style="flex:1;min-width:0">${Q.reciters().map((r) => `<option value="${esc(r.id)}" ${r.id === A.reciter() ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="bar" style="margin-top:6px"><i id="pl-prog" style="width:0"></i></div>`;
      document.getElementById('app').appendChild(d); A.repPaint();
    },
    repPaint() { const t = S.$('#pl-rept'); if (t) t.textContent = A.repeat === 'ayah' ? '١' : A.repeat === 'surah' ? '∞' : ''; const b = S.$('#pl-rep'); if (b) b.style.opacity = A.repeat === 'off' ? '.6' : '1'; },
    async downloadSurah(s, onProg, cancelRef) {
      const n = Q.surah(s).ayahs; let done = 0, fail = 0; const rc = A.reciter(); const ids = Array.from({ length: n }, (_, i) => i + 1);
      const worker = async () => {
        while (ids.length && !cancelRef.stop) {
          const a = ids.shift(); const gid = Q.gid(s, a); const key = rc + ':' + gid;
          try {
            if (await S.db.get('audio', key)) { done++; onProg(done, fail, n); continue; }
            let r; for (let i = 0; i < A.rates(rc).length; i++) { r = await fetch(A.urlAt(s, a, i)); if (r.ok) { if (i) A.good[rc] = A.rates(rc)[i]; break; } } if (!r.ok) throw new Error('HTTP ' + r.status); const blob = await r.blob(); if (blob.size < 500) throw new Error('ملف صوتي غير صالح');
            await S.db.put('audio', { id: key, blob, size: blob.size, ts: Date.now(), reciter: rc, s, a }); done++;
          } catch (e) { fail++; if (e && /Quota|ممتلئة/.test(e.message || '')) { cancelRef.stop = true; cancelRef.quota = true; } }
          onProg(done, fail, n);
        }
      };
      await Promise.all([worker(), worker(), worker()]); return { done, fail, n };
    }
  });
  function onEnded() {
    if (!A.cur) return; const { s, a } = A.cur; const n = Q.surah(s).ayahs;
    if (A.repeat === 'ayah') return A.play(s, a);
    if (a < n) return A.play(s, a + 1);
    if (A.repeat === 'surah') return A.play(s, 1);
    A.setState('paused'); S.toast('انتهت السورة', 'ok');
  }
  function onTime() { const e = el; const p = S.$('#pl-prog'); if (p && e && e.duration) p.style.width = (e.currentTime / e.duration * 100) + '%'; }

  S.act('plToggle', () => A.toggle()); S.act('plNext', () => A.next()); S.act('plPrev', () => A.prev()); S.act('plClose', () => A.stop());
  S.act('plRepeat', () => { A.repeat = A.repeat === 'off' ? 'ayah' : A.repeat === 'ayah' ? 'surah' : 'off'; A.repPaint(); S.toast(A.repeat === 'off' ? 'التكرار متوقف' : A.repeat === 'ayah' ? 'تكرار الآية' : 'تكرار السورة'); });
  S.onChange('plRate', (e) => { A.rate = +e.value; if (el) el.playbackRate = A.rate; });
  S.onChange('plRec', (e) => { S.set('reciter', e.value); if (A.cur) A.play(A.cur.s, A.cur.a); });
  S.act('plDownload', () => {
    if (!A.cur) return; const s = A.cur.s; const ref = { stop: false };
    S.modal({
      title: 'تنزيل سورة ' + Q.surahName(s), persistent: true,
      body: S.h`<p class="small nm">القارئ: <b>${A.reciterName()}</b> • ${S.n(Q.surah(s).ayahs)} آية. حجم السورة قد يبلغ عدة ميغابايتات؛ يُنصح بالتحميل عبر الواي فاي.</p><div class="bar"><i id="dlbar" style="width:0"></i></div><p class="small" id="dltxt">جارٍ البدء…</p>`,
      actions: [{ label: 'إلغاء', cls: 'ghost', onClick: () => { ref.stop = true; } }],
      onMount: async () => {
        const r = await A.downloadSurah(s, (d, f, n) => { const b = S.$('#dlbar'), t = S.$('#dltxt'); if (b) b.style.width = (d / n * 100) + '%'; if (t) t.textContent = 'نُزّل ' + S.n(d) + ' من ' + S.n(n) + (f ? ' • أخفق ' + S.n(f) : ''); }, ref);
        const bt = S.$('.modal-ft .btn'); if (bt) bt.textContent = 'إغلاق';
        const t = S.$('#dltxt'); if (t) t.textContent = ref.quota ? 'توقف التنزيل: مساحة التخزين ممتلئة.' : ref.stop ? 'أُلغي التنزيل.' : r.fail ? 'اكتمل جزئياً: أخفق ' + S.n(r.fail) + ' (أعد المحاولة بعد الاتصال).' : 'اكتمل التنزيل. السورة متاحة دون إنترنت.';
        if (!r.fail && !ref.stop) S.toast('اكتمل تنزيل السورة', 'ok');
      }
    });
  });
})();

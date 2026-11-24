/* =====================================================================
   سِراج — native-notify.js : إشعارات النظام الحقيقية في تطبيق أندرويد
   تُجدول عبر @capacitor/local-notifications (AlarmManager) فتصل والتطبيق مغلق:
     • الأذان عند دخول وقت كل صلاة + تنبيه مسبق (إن فُعّل)   • تذكيرات الأدعية الأسبوعية
     • المناسبات (صباح اليوم وصباح اليوم السابق)
   لا يوجد خادم دفع، فكل ما يصل هنا مُحسَب على الجهاز نفسه من موقعك وإعداداتك.
   في المتصفح (PWA) لا يوجد هذا المسار، وتبقى التنبيهات داخل التطبيق فقط.
   حدود لا يمكن للتطبيق تجاوزها: بعض الهواتف (شاومي/هواوي/سامسونغ…) تُقيّد تطبيقات الخلفية بإعدادات البطارية.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const DAYS = 10; /* عدد الأيام القادمة المجدولة؛ تُجدَّد عند كل فتح للتطبيق */
  const ID_REM = 1000000000, ID_OCC = 1850000000; /* مجالات المعرّفات (أعداد صحيحة 32 بت): تذكيرات | مناسبات | الصلوات ≥ 2×10⁹ */
  const CH = { adhan: 'siraj_adhan', pre: 'siraj_pre', remind: 'siraj_remind' };
  const plug = () => { try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; } catch (e) { return null; } };
  const TEST_ID = 424242; /* إشعار «التجربة» لا يُلغى بإعادة الجدولة */
  const hashStr = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const round1m = (d) => new Date(Math.round(d.getTime() / 60000) * 60000); /* كما يُعرض في جدول المواقيت */

  let flags = { adhanSound: '' }; /* من assets/native-flags.json الذي يكتبه scripts/prepare-www.mjs وقت البناء */
  let perm = 'unknown'; /* granted | denied | prompt | unknown */
  let exact = 'unknown'; /* granted | denied | unknown */
  let busy = false, again = false, timer = 0, lastCount = 0, lastError = '';

  /* منبّه الأذان الأصلي (جافا، يُضاف وقت البناء): يشغّل الأذان على قناة صوت المنبّه فيُسمع في الصامت وعدم الإزعاج */
  const adh = () => { try { const P = window.Capacitor && window.Capacitor.Plugins; return (P && P.SirajAdhan) || null; } catch (e) { return null; } };
  let alarm = { on: false, hasAudio: false, exact: null, count: 0 };
  const b64Slice = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  /* ينقل ملف الأذان (القادم من حزمة الناشر) إلى التخزين الأصلي على دفعات 384 ك.ب (مضاعف 3 ليبقى base64 سليماً) */
  async function pushAudio(A) {
    const rec = await S.db.get('audiolib', 'adhan_pack').catch(() => null);
    const want = rec && rec.blob ? 'p:' + (rec.ts || 0) + ':' + rec.blob.size : '';
    if (want === (S.kv.get('nn.audioSig') || '')) return;
    if (!want) { await A.clearAdhan(); await S.kv.set('nn.audioSig', ''); return; }
    const CH_SZ = 384 * 1024; let first = true;
    for (let off = 0; off < rec.blob.size; off += CH_SZ) { await A.appendAdhan({ data: await b64Slice(rec.blob.slice(off, off + CH_SZ)), first }); first = false; }
    await S.kv.set('nn.audioSig', want);
  }
  const available = () => !!(S.isNative && plug());

  async function loadFlags() {
    try { const r = await fetch('assets/native-flags.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && typeof j.adhanSound === 'string' && /^[a-z0-9_]+\.(mp3|ogg|wav)$/.test(j.adhanSound)) flags.adhanSound = j.adhanSound; } } catch (e) { /* لا ملف أعلام: يُستعمل صوت النظام الافتراضي */ }
  }

  async function refreshPerm() {
    const LN = plug(); if (!LN) { perm = 'unknown'; return perm; }
    try { const r = await LN.checkPermissions(); perm = r && r.display ? (/^prompt/.test(r.display) ? 'prompt' : r.display) : 'unknown'; } catch (e) { perm = 'unknown'; }
    try { if (LN.checkExactNotificationSetting) { const r = await LN.checkExactNotificationSetting(); exact = r && r.exact_alarm ? r.exact_alarm : 'unknown'; } } catch (e) { exact = 'unknown'; }
    return perm;
  }

  /* ---------- بناء الخطة (دالة خالصة نسبياً: تُقرأ الإعدادات ولا تُلمس المنصة) ---------- */
  function plan(now) {
    now = now || new Date(); const min = now.getTime() + 4000; const out = [];
    const st = S.settings; const P = S.prayer;
    /* 1) الأذان والتنبيه المسبق */
    if (st.adhanOn && P && P.loc()) {
      const t0 = P.times(); let day = t0.day; const loc = t0.loc;
      for (let i = 0; i < DAYS; i++) {
        const t = i === 0 ? t0 : P.times(day); const ymd = day.y * 10000 + day.m * 100 + day.d;
        P.FIVE.forEach(([k, n], idx) => {
          const raw = t && t.at && t.at[k]; if (!raw) return; const at = round1m(raw);
          if (at.getTime() > min) out.push({ id: ymd * 100 + idx, title: 'حان وقت صلاة ' + n, body: loc.name, at, ch: CH.adhan, extra: { route: '/prayer', kind: 'prayer' } });
          if (st.preMin > 0) { const pre = new Date(at.getTime() - st.preMin * 60000); if (pre.getTime() > min) out.push({ id: ymd * 100 + 10 + idx, title: 'اقترب وقت صلاة ' + n, body: 'متبقٍّ ' + S.n(st.preMin) + ' دقيقة — ' + loc.name, at: pre, ch: CH.pre, extra: { route: '/prayer', kind: 'prayer-pre' } }); }
        });
        const nd = new Date(Date.UTC(day.y, day.m - 1, day.d + 1, 12)); day = { y: nd.getUTCFullYear(), m: nd.getUTCMonth() + 1, d: nd.getUTCDate() };
      }
    }
    /* 2) تذكيرات الأدعية: أسبوعية متكررة (weekday: الأحد=1 … السبت=7) */
    (S.kv.get('daily.reminders', []) || []).forEach((r) => {
      if (!r || !r.enabled || !/^\d{2}:\d{2}$/.test(r.time || '')) return;
      const [hh, mm] = r.time.split(':').map(Number); if (hh > 23 || mm > 59) return;
      const base = ID_REM + (hashStr(String(r.id)) % 80000000) * 10;
      (r.days || []).forEach((d) => { if (d >= 0 && d <= 6) out.push({ id: base + d, title: r.title, body: r.dua ? 'حان وقت قراءة الدعاء' : 'حان وقت تنبيهك', on: { weekday: d + 1, hour: hh, minute: mm }, ch: CH.remind, extra: { route: r.dua ? '/duas/item/' + r.dua : '/daily/reminders', kind: 'reminder' } });
      });
    });
    /* 3) المناسبات: صباح اليوم السابق وصباح اليوم نفسه (8:00) */
    if (st.notifyOcc && S.calendar && S.data && S.data.sample) {
      const months = S.data.sample.hijriMonths || []; let i = 0;
      S.calendar.upcoming(40).forEach((x) => {
        if (x.days > 45) return; const body = S.n(x.occ.d) + ' ' + (months[x.occ.m - 1] || '') + ' — تاريخ مشهور؛ راجع التقويم المعتمد لدى مرجعك.';
        [[0, 'اليوم: '], [1, 'غداً: ']].forEach(([back, pfx], j) => {
          const at = new Date(x.date.getFullYear(), x.date.getMonth(), x.date.getDate() - back, 8, 0, 0);
          if (at.getTime() > min) out.push({ id: ID_OCC + i * 2 + j, title: pfx + x.occ.title, body, at, ch: CH.remind, extra: { route: '/calendar', kind: 'occasion' } });
        });
        i++;
      });
    }
    return out;
  }

  const toNative = (n) => {
    const o = { id: n.id, title: n.title, body: n.body, channelId: n.ch, extra: n.extra, smallIcon: 'ic_stat_siraj', iconColor: '#C9A24B' };
    o.schedule = n.on ? { on: n.on, allowWhileIdle: true } : { at: n.at, allowWhileIdle: true };
    if (n.ch === CH.adhan && flags.adhanSound) o.sound = flags.adhanSound;
    return o;
  };

  async function ensureChannels(LN) {
    const defs = [
      { id: CH.adhan, name: 'الأذان وأوقات الصلاة', description: 'إشعار عند دخول وقت الصلاة', importance: 5, visibility: 1, vibration: true, lights: true },
      { id: CH.pre, name: 'التنبيه المسبق للصلاة', description: 'تنبيه قبل دخول الوقت بالدقائق التي تحددها', importance: 4, visibility: 1, vibration: true },
      { id: CH.remind, name: 'تذكيرات القراءة والمناسبات', description: 'تذكير بقراءة الأدعية وبالمناسبات القادمة', importance: 4, visibility: 1, vibration: true }
    ];
    if (flags.adhanSound) defs[0].sound = flags.adhanSound;
    for (const c of defs) { try { await LN.createChannel(c); } catch (e) { S.log('warn', 'createChannel ' + c.id + ': ' + (e && e.message)); } }
  }

  async function cancelAllPending(LN) {
    try { const p = await LN.getPending(); const list = ((p && p.notifications) || []).filter((n) => n.id !== TEST_ID); if (list.length) await LN.cancel({ notifications: list.map((n) => ({ id: n.id })) }); } catch (e) { S.log('warn', 'cancel: ' + (e && e.message)); }
  }

  /* يُعيد الجدولة كاملة. force=true يتجاهل البصمة المخزنة. */
  async function sync(force) {
    if (!available()) return { ok: false, reason: 'unavailable' };
    if (busy) { again = true; return { ok: false, reason: 'busy' }; }
    busy = true; lastError = '';
    try {
      const LN = plug(); await refreshPerm();
      if (perm !== 'granted') { await cancelAllPending(LN); try { const A0 = adh(); if (A0) await A0.cancelAll(); } catch (e) { /* */ } lastCount = 0; await S.kv.set('nn.sig', ''); return { ok: false, reason: perm }; }
      const items = plan();
      /* الأذان نفسه عبر المنبّه الأصلي إن وُجد؛ والباقي (تنبيه مسبق، تذكيرات، مناسبات) عبر الإشعارات */
      const A = adh(); alarm.on = false;
      if (A) {
        try {
          await pushAudio(A);
          const ad = items.filter((n) => n.ch === CH.adhan && n.at);
          const r = await A.schedule({ items: ad.map((n) => ({ id: n.id, at: n.at.getTime(), title: n.title, body: n.body })) });
          const st = await A.status(); alarm = { on: true, hasAudio: !!(st && st.hasAudio), exact: st ? st.exact : null, count: (r && r.count) || 0 };
        } catch (e) { S.log('warn', 'adhan alarm: ' + ((e && e.message) || e)); alarm.on = false; }
      }
      const lnItems = alarm.on ? items.filter((n) => !(n.ch === CH.adhan && n.at)) : items;
      const sig = hashStr(JSON.stringify(items.map((n) => [n.id, n.at ? n.at.getTime() : n.on, n.title, n.body, n.ch]))) + ':' + items.length + ':' + (flags.adhanSound || '-');
      let pend = []; try { const p = await LN.getPending(); pend = ((p && p.notifications) || []).filter((n) => n.id !== TEST_ID); } catch (e) { /* */ }
      const have = new Set(pend.map((n) => n.id));
      if (!force && sig === S.kv.get('nn.sig') && lnItems.every((n) => have.has(n.id)) && pend.length === lnItems.length) { lastCount = items.length; return { ok: true, scheduled: items.length, skipped: true }; }
      await ensureChannels(LN); await cancelAllPending(LN);
      for (let i = 0; i < lnItems.length; i += 40) await LN.schedule({ notifications: lnItems.slice(i, i + 40).map(toNative) });
      lastCount = items.length; await S.kv.set('nn.sig', sig);
      return { ok: true, scheduled: items.length, exact };
    } catch (e) { lastError = (e && e.message) || String(e); S.log('warn', 'nativeNotify.sync: ' + lastError); return { ok: false, reason: 'error', error: lastError }; }
    finally { busy = false; if (again) { again = false; setTimeout(() => sync(false), 400); } }
  }
  const later = (ms) => { clearTimeout(timer); timer = setTimeout(() => sync(false), ms == null ? 1500 : ms); };

  const N = (S.nativeNotify = {
    available,
    /* هل الإشعارات الأصلية تعمل فعلاً (متوفرة + مسموحة)؟ تُستعمل لتفادي التكرار مع تنبيهات الصفحة المفتوحة */
    active() { return available() && perm === 'granted'; },
    plan, sync, later,
    state() { return { available: available(), perm, exact, scheduled: lastCount, error: lastError, sound: flags.adhanSound, alarm: alarm.on, alarmAudio: alarm.hasAudio, alarmExact: alarm.exact }; },
    async status() { await refreshPerm(); return N.state(); },
    /* يطلب إذن الإشعارات ثم يُجدول. إن كان التنبيه الدقيق مغلقاً يُرجع needExact لتعرض الواجهة زر فتح الإعداد. */
    async enable() {
      if (!available()) return { ok: false, reason: 'unavailable' };
      const LN = plug(); await refreshPerm();
      if (perm !== 'granted') { try { const r = await LN.requestPermissions(); perm = r && r.display ? (/^prompt/.test(r.display) ? 'prompt' : r.display) : perm; } catch (e) { /* */ } }
      await refreshPerm();
      const res = await sync(true);
      return Object.assign({ perm, exact, needExact: perm === 'granted' && exact === 'denied' }, res);
    },
    async openExactSettings() { const LN = plug(); if (!LN || !LN.changeExactNotificationSetting) return { ok: false }; try { const r = await LN.changeExactNotificationSetting(); exact = (r && r.exact_alarm) || exact; return { ok: true, exact }; } catch (e) { return { ok: false, error: e && e.message }; } },
    /* إشعار تجريبي بعد sec ثانية لتتأكد أنه يصل والتطبيق في الخلفية */
    async test(sec) {
      if (!available()) return { ok: false, reason: 'unavailable' };
      const A = adh();
      if (A && A.test) { /* اختبار المنبّه الحقيقي الذي يشغّل صوت الأذان (قناة المنبّه) */
        try { await pushAudio(A); const r = await A.test({ sec: Math.max(5, sec || 10) }); return { ok: !!(r && r.ok), alarm: true, hasAudio: !!(r && r.hasAudio), sec: Math.max(5, sec || 10) }; }
        catch (e) { /* يرجع إلى الإشعار العادي */ }
      }
      const LN = plug(); await refreshPerm(); if (perm !== 'granted') return { ok: false, reason: perm };
      try { await ensureChannels(LN); await LN.schedule({ notifications: [toNative({ id: TEST_ID, title: 'تجربة إشعار سِراج', body: 'إن ظهر هذا الإشعار فالأذان والتذكيرات ستصلك والتطبيق مغلق.', at: new Date(Date.now() + Math.max(5, sec || 10) * 1000), ch: CH.adhan, extra: { route: '/prayer/settings', kind: 'test' } })] }); return { ok: true, seconds: Math.max(5, sec || 10) }; }
      catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
    },
    async init() {
      if (!available()) return;
      await loadFlags();
      const LN = plug();
      try { LN.addListener('localNotificationActionPerformed', (ev) => { const r = ev && ev.notification && ev.notification.extra && ev.notification.extra.route; if (r && typeof r === 'string' && r[0] === '/') { try { S.router.go(r); } catch (e) { /* */ } } }); } catch (e) { /* */ }
      /* أي تغيير في الإعدادات (الموقع، طريقة الحساب، التنبيه…) أو عودة للتطبيق → إعادة جدولة مؤجّلة */
      document.addEventListener('siraj:settings', () => later(1500));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(800); });
      try { const App = window.Capacitor.Plugins.App; if (App && App.addListener) App.addListener('resume', () => later(800)); } catch (e) { /* */ }
      await refreshPerm(); await sync(false);
    }
  });
})();

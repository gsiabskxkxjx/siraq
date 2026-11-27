/* =====================================================================
   سِراج — prayer.js : مواقيت الصلاة (حساب فلكي حقيقي محلي)، القبلة، التنبيهات
   لا توجد مواقيت أو اتجاه قبلة وهميان: كل شيء يُحسب من إحداثيات الموقع المختار وتاريخ اليوم.
   الخوارزمية مبنية على معادلات PrayTimes.org (موضع الشمس، زوايا الفجر والعشاء).
   طرق الحساب الجعفرية: ليفا/قم (فجر 16°، مغرب 4°، عشاء 14°) ومعهد الجيوفيزياء طهران (17.7° / 4.5° / 14°).
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const DR = Math.PI / 180;
  const sin = (d) => Math.sin(d * DR), cos = (d) => Math.cos(d * DR), tan = (d) => Math.tan(d * DR);
  const asin = (x) => Math.asin(x) / DR, acos = (x) => Math.acos(x) / DR, atan2 = (y, x) => Math.atan2(y, x) / DR, acot = (x) => Math.atan(1 / x) / DR;
  const fix = (a, b) => a - b * Math.floor(a / b); const fixA = (a) => fix(a, 360), fixH = (a) => fix(a, 24);

  const METHODS = {
    Jafari: { name: 'الجعفري — معهد ليفا، قم (فجر 16°، مغرب 4°، عشاء 14°)', fajr: 16, isha: 14, maghrib: 4, midnight: 'Jafari' },
    Tehran: { name: 'معهد الجيوفيزياء — جامعة طهران (فجر 17.7°، مغرب 4.5°، عشاء 14°)', fajr: 17.7, isha: 14, maghrib: 4.5, midnight: 'Jafari' },
    MWL: { name: 'رابطة العالم الإسلامي (فجر 18°، عشاء 17°)', fajr: 18, isha: 17, maghrib: '0 min', midnight: 'Standard' },
    Makkah: { name: 'أم القرى — مكة (فجر 18.5°، عشاء 90 دقيقة)', fajr: 18.5, isha: '90 min', maghrib: '0 min', midnight: 'Standard' },
    ISNA: { name: 'أمريكا الشمالية ISNA (15° / 15°)', fajr: 15, isha: 15, maghrib: '0 min', midnight: 'Standard' },
    Egypt: { name: 'الهيئة المصرية (19.5° / 17.5°)', fajr: 19.5, isha: 17.5, maghrib: '0 min', midnight: 'Standard' },
    Karachi: { name: 'جامعة العلوم الإسلامية — كراتشي (18° / 18°)', fajr: 18, isha: 18, maghrib: '0 min', midnight: 'Standard' }
  };
  const KAABA = { lat: 21.4225, lng: 39.8262 };

  function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100); const B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
  function sunPos(jd) {
    const D = jd - 2451545.0; const g = fixA(357.529 + 0.98560028 * D); const q = fixA(280.459 + 0.98564736 * D);
    const L = fixA(q + 1.915 * sin(g) + 0.020 * sin(2 * g)); const e = 23.439 - 0.00000036 * D;
    const RA = atan2(cos(e) * sin(L), cos(L)) / 15; return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fixH(RA) };
  }
  const isMin = (v) => typeof v === 'string' && /min/.test(v); const num = (v) => parseFloat(v);

  /* يحسب أوقات يوم معيّن بالساعات العشرية بالتوقيت المحلي للمدينة (tz بالساعات) */
  function compute(y, m, d, lat, lng, tz, o) {
    o = o || {}; const p = METHODS[o.method] || METHODS.Jafari; const elev = o.elevation || 0;
    const jd = julian(y, m, d) - lng / (15 * 24);
    const midDay = (t) => fixH(12 - sunPos(jd + t).eqt);
    const angleTime = (angle, t, ccw) => {
      const decl = sunPos(jd + t).decl; const v = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (v > 1 || v < -1) return NaN; const tt = acos(v) / 15; return midDay(t) + (ccw ? -tt : tt);
    };
    const asrTime = (f, t) => { const decl = sunPos(jd + t).decl; return angleTime(-acot(f + tan(Math.abs(lat - decl))), t); };
    const riseSet = 0.0347 * Math.sqrt(elev) + 0.833;
    let T = { imsak: 5, fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
    const dp = (t) => { const r = {}; Object.keys(t).forEach((k) => (r[k] = t[k] / 24)); return r; };
    const P = dp(T);
    const imsakMin = 10;
    T = {
      imsak: angleTime(num(p.fajr) + 0, P.imsak, true), fajr: angleTime(p.fajr, P.fajr, true), sunrise: angleTime(riseSet, P.sunrise, true),
      dhuhr: midDay(P.dhuhr), asr: asrTime(o.asr === 'Hanafi' ? 2 : 1, P.asr), sunset: angleTime(riseSet, P.sunset),
      maghrib: isMin(p.maghrib) ? NaN : angleTime(num(p.maghrib), P.maghrib), isha: isMin(p.isha) ? NaN : angleTime(num(p.isha), P.isha)
    };
    const off = tz - lng / 15; Object.keys(T).forEach((k) => (T[k] += off));
    // خطوط العرض العالية: منتصف الليل
    const diff = (a, b) => fixH(b - a); const night = diff(T.sunset, T.sunrise);
    const hl = (time, base, angle, ccw) => { const portion = night / 2; const df = ccw ? diff(time, base) : diff(base, time); if (isNaN(time) || df > portion) return base + (ccw ? -portion : portion); return time; };
    T.fajr = hl(T.fajr, T.sunrise, p.fajr, true);
    T.imsak = T.fajr - imsakMin / 60;
    if (isMin(p.maghrib)) T.maghrib = T.sunset + num(p.maghrib) / 60; else T.maghrib = hl(T.maghrib, T.sunset, p.maghrib, false);
    if (isMin(p.isha)) T.isha = T.maghrib + num(p.isha) / 60; else T.isha = hl(T.isha, T.sunset, p.isha, false);
    T.midnight = p.midnight === 'Jafari' ? T.sunset + diff(T.sunset, T.fajr) / 2 : T.sunset + diff(T.sunset, T.sunrise) / 2;
    // ضبط المستخدم بالدقائق
    const tune = o.tune || {}; Object.keys(T).forEach((k) => { if (tune[k]) T[k] += tune[k] / 60; T[k] = fixH(T[k]); });
    return T;
  }

  function tzOffsetHours(instant, tz) {
    try {
      const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
      const pr = f.formatToParts(instant); const g = (t) => +pr.find((x) => x.type === t).value;
      const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
      return (asUTC - Math.floor(instant.getTime() / 1000) * 1000) / 3600000;
    } catch (e) { return -instant.getTimezoneOffset() / 60; }
  }
  function cityToday(tz, now) {
    try {
      const pr = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now || new Date());
      const g = (t) => +pr.find((x) => x.type === t).value; return { y: g('year'), m: g('month'), d: g('day') };
    } catch (e) { const n = now || new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; }
  }
  const NAMES = [['fajr', 'الفجر'], ['sunrise', 'الشروق'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];
  const FIVE = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];

  const P = (S.prayer = {
    METHODS, KAABA, FIVE, NAMES,
    loc() { const st = S.settings; if (st.lat == null || st.lng == null) return null; return { lat: +st.lat, lng: +st.lng, tz: st.tz || Intl.DateTimeFormat().resolvedOptions().timeZone, name: st.cityName || 'موقعي' }; },
    /* يعيد الأوقات ليوم (y,m,d) في موقع المستخدم، مع لحظات UTC لكل وقت */
    times(ymd) {
      const loc = P.loc(); if (!loc) return null; const st = S.settings;
      const day = ymd || cityToday(loc.tz);
      const noon = new Date(Date.UTC(day.y, day.m - 1, day.d, 12)); const tz = tzOffsetHours(noon, loc.tz);
      const T = compute(day.y, day.m, day.d, loc.lat, loc.lng, tz, { method: st.calcMethod, asr: st.asr, tune: st.tune });
      const inst = {}; Object.keys(T).forEach((k) => { inst[k] = isNaN(T[k]) ? null : new Date(Date.UTC(day.y, day.m - 1, day.d) + (T[k] - tz) * 3600000); });
      // منتصف الليل قد يقع بعد منتصف الليل التقويمي
      if (inst.midnight && inst.maghrib && inst.midnight < inst.maghrib) inst.midnight = new Date(inst.midnight.getTime() + 86400000);
      return { day, tz, loc, hours: T, at: inst };
    },
    fmtHours(h) { if (h == null || isNaN(h)) return '—'; let mins = Math.round(h * 60); mins = ((mins % 1440) + 1440) % 1440; return S.n(S.fmt.pad(Math.floor(mins / 60)) + ':' + S.fmt.pad(mins % 60)); },
    /* يعرض لحظة مطلقة بتوقيت المدينة المختارة (مقرّبة لأقرب دقيقة، كما في جدول المواقيت) */
    fmtAt(at, tz) { try { return S.n(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Math.round(at.getTime() / 60000) * 60000))); } catch (e) { return S.fmt.time(at); } },
    next(now) {
      now = now || new Date(); const t0 = P.times(); if (!t0) return null;
      const list = []; const add = (t) => FIVE.forEach(([k, n]) => { if (t.at[k]) list.push({ key: k, name: n, at: t.at[k] }); });
      add(t0);
      const loc = t0.loc; const tmr = new Date(Date.UTC(t0.day.y, t0.day.m - 1, t0.day.d + 1, 12)); const t1 = P.times({ y: tmr.getUTCFullYear(), m: tmr.getUTCMonth() + 1, d: tmr.getUTCDate() }); add(t1);
      const nx = list.filter((x) => x.at > now).sort((a, b) => a.at - b.at)[0]; return nx ? Object.assign(nx, { today: t0, loc, time: P.fmtAt(nx.at, loc.tz) }) : null;
    },
    qibla(lat, lng) {
      const φ1 = lat * DR, φ2 = KAABA.lat * DR, Δ = (KAABA.lng - lng) * DR;
      const y = Math.sin(Δ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δ);
      return (atan2(y, x) + 360) % 360;
    },
    distKm(lat, lng) {
      const φ1 = lat * DR, φ2 = KAABA.lat * DR, Δφ = φ2 - φ1, Δλ = (KAABA.lng - lng) * DR;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },
    _compute: compute, _tzOffsetHours: tzOffsetHours, _cityToday: cityToday,
    init() {
      let fired = {};
      S.onTick((now) => {
        // العدّ التنازلي في الواجهة
        const nx = P.next(now); S.$$('[data-countdown]').forEach((el) => { el.textContent = nx ? S.fmt.hm(nx.at - now) : '—'; });
        if (!nx) return;
        const st = S.settings; const left = nx.at - now;
        const key = nx.key + nx.at.getTime();
        if (st.preMin > 0 && left <= st.preMin * 60000 && left > (st.preMin * 60000 - 1500) && !fired['pre' + key]) { fired['pre' + key] = 1; P.alert('اقترب وقت صلاة ' + nx.name, 'متبقٍّ ' + S.n(st.preMin) + ' دقيقة', false); }
        if (left <= 1000 && left > -1500 && !fired['at' + key]) { fired['at' + key] = 1; P.alert('حان وقت صلاة ' + nx.name, nx.loc.name, true); }
        if (Object.keys(fired).length > 50) fired = {};
      });
    },
    async alert(title, body, isAdhan) {
      if (!S.settings.adhanOn) return;
      S.toast(title + ' — ' + body, 'ok'); S.vibrate([200, 100, 200]);
      let played = false;
            const nat = S.nativeNotify && S.nativeNotify.active(); /* إشعار النظام وصل بنفسه: لا نكرره بإشعار الصفحة ولا بصوت إضافي */
      if (!played && !nat) { S.beep(523, 220, 0.2); setTimeout(() => S.beep(659, 220, 0.2), 260); setTimeout(() => S.beep(784, 380, 0.2), 520); }
      try { if (!nat && window.Notification && Notification.permission === 'granted') { const reg = S.sw || (navigator.serviceWorker && (await navigator.serviceWorker.getRegistration())); if (reg && reg.showNotification) reg.showNotification(title, { body, icon: 'assets/images/icon-192.png', tag: 'siraj-prayer' }); else new Notification(title, { body }); } } catch (e) { /* */ }
      S.notify.add({ title, body, kind: 'prayer' });
    }
  });

  /* ---------- صفحة المواقيت ---------- */
  function ymdAdd(day, n) { const d = new Date(Date.UTC(day.y, day.m - 1, day.d + n, 12)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
  S.router.add('/prayer', async (p, q) => {
    const loc = P.loc();
    if (!loc) return { title: 'مواقيت الصلاة', nav: 'more', back: '/more', html: S.h`<div class="stack">${S.ui.empty('map-pin', 'حدّد موقعك لحساب المواقيت', 'لا يعرض سِراج مواقيت افتراضية؛ تُحسب فلكياً من إحداثيات مدينتك.', S.h`<a class="btn primary" href="#/prayer/location">${S.icon('map-pin')} اختيار الموقع</a>`)}</div>` };
    const today = P.times(); let day = today.day; if (q.off) day = ymdAdd(day, +q.off);
    const T = P.times(day); const off = +(q.off || 0); const nx = P.next();
    const gd = new Date(day.y, day.m - 1, day.d, 12);
    const log = await S.db.where('prayerlog', 'date', `${day.y}-${S.fmt.pad(day.m)}-${S.fmt.pad(day.d)}`); const done = new Set(log.filter((l) => l.done).map((l) => l.prayer));
    const rows = [['imsak', 'الإمساك'], ['fajr', 'الفجر'], ['sunrise', 'الشروق'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['sunset', 'الغروب'], ['maghrib', 'المغرب'], ['isha', 'العشاء'], ['midnight', 'نصف الليل الشرعي']];
    return {
      title: 'مواقيت الصلاة', nav: 'more', back: '/more',
      actions: [{ icon: 'settings', label: 'إعدادات الصلاة', href: '#/prayer/settings' }, { icon: 'map-pin', label: 'الموقع', href: '#/prayer/location' }],
      html: S.h`<div class="stack">
        <div class="card center"><div class="muted small">${loc.name}</div><div class="h2 nm">${S.fmt.gdate(gd)}</div><div class="gold">${S.hijriStr(gd)}</div>
          <div class="row between mt"><a class="btn sm" href="#/prayer?off=${off - 1}">${S.icon('chevron-right')} أمس</a>${off ? S.h`<a class="btn sm ghost" href="#/prayer">اليوم</a>` : ''}<a class="btn sm" href="#/prayer?off=${off + 1}">غداً ${S.icon('chevron-left')}</a></div></div>
        ${!off && nx ? S.h`<div class="next-prayer" style="margin-top:0"><div class="np-l">الصلاة القادمة · ${loc.name}</div><span class="np-n">${nx.name}</span><div class="np-r"><span class="np-c" data-countdown>—</span></div></div>` : ''}
        ${S.nativeNotify && S.nativeNotify.available() && !S.settings.adhanOn ? S.h`<div class="card gold-edge"><div class="card-t">${S.icon('bell')} فعّل تنبيه الأذان</div><p class="small muted nm">يصلك إشعار عند دخول وقت كل صلاة (وتنبيه مسبق اختياري) حتى والتطبيق مغلق. سيطلب أندرويد إذن الإشعارات مرة واحدة.</p><button class="btn primary block mt-s" data-act="nnQuick">${S.icon('bell')} تفعيل الآن</button></div>` : ''}
        <div class="card">${rows.map(([k, n]) => S.h`<div class="prow ${!off && nx && nx.key === k ? 'next' : ''}"><span class="pn">${n}</span><span class="ld"></span><span class="pv">${T.at[k] ? P.fmtHours(T.hours[k]) : '—'}</span></div>`)}</div>
        <div class="card"><div class="card-t">${S.icon('check-circle')} متابعة الصلاة اليومية</div><div class="chips" style="flex-wrap:wrap;overflow:visible;margin:0;padding:0">${FIVE.map(([k, n]) => S.h`<button class="chip ${done.has(k) ? 'active' : ''}" data-act="prayerDone" data-p="${k}" data-date="${day.y}-${S.fmt.pad(day.m)}-${S.fmt.pad(day.d)}">${done.has(k) ? S.icon('check') : ''}${n}</button>`)}</div><a class="small" href="#/qada">جدول قضاء الصلاة</a> • <a class="small" href="#/prayer/stats">سجل الصلوات</a></div>
        ${S.ui.tip('info', 'عن هذه المواقيت', S.h`<span>حساب فلكي تقريبي بطريقة «${METHODS[S.settings.calcMethod].name}». للاحتياط في الصلاة والصيام راجع التقويم المعتمد لدى مرجعك أو مكتبه، ويمكنك ضبط الدقائق من <a href="#/prayer/settings">إعدادات الصلاة</a>.</span>`)}
      </div>`
    };
  });
  S.act('prayerDone', async (el) => {
    const id = el.dataset.date + ':' + el.dataset.p; const cur = await S.db.get('prayerlog', id);
    const done = !(cur && cur.done); await S.db.put('prayerlog', { id, date: el.dataset.date, prayer: el.dataset.p, done, ts: Date.now() });
    S.router.refresh();
  });
  S.router.add('/prayer/stats', async () => {
    const all = (await S.db.all('prayerlog')).filter((l) => l.done); const byDate = {}; all.forEach((l) => (byDate[l.date] = (byDate[l.date] || 0) + 1));
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = S.fmt.day(d); days.push({ k, n: byDate[k] || 0, l: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'][d.getDay()] }); }
    const total = all.length;
    return { title: 'سجل الصلوات', nav: 'more', back: '/prayer', html: S.h`<div class="stack"><div class="grid2"><div class="stat"><b>${S.n(total)}</b><span>صلوات مسجّلة (الإجمالي)</span></div><div class="stat"><b>${S.n(days.reduce((a, d) => a + d.n, 0))}</b><span>آخر 7 أيام (من 35)</span></div></div><div class="card"><div class="card-t">${S.icon('chart')} آخر 7 أيام</div><div class="barchart">${days.map((d) => S.h`<div class="bc"><em>${S.n(d.n)}</em><i style="height:${Math.max(3, d.n * 16)}px"></i><span>${d.l}</span></div>`)}</div></div></div>` };
  });

  /* ---------- الموقع ---------- */
  S.router.add('/prayer/location', (p, q) => {
    const cities = S.data.sample.cities; const cur = S.settings.cityId;
    return {
      title: 'اختيار الموقع', nav: 'more', back: '/prayer',
      html: S.h`<div class="stack">
        <button class="btn gold block" data-act="useGPS">${S.icon('map-pin')} استخدم موقعي الحالي (GPS)</button>
        <p class="tiny muted nm">يطلب المتصفح إذنك. يعمل GPS عبر HTTPS فقط. الإحداثيات تُحفظ في هذا الجهاز ولا تُرسل لأي جهة.</p>
        <div class="searchbox">${S.icon('search')}<input class="input" id="cityq" data-inp="cityFilter" placeholder="ابحث عن مدينة" autocomplete="off"></div>
        <div class="list" id="citylist">${cities.map((c) => cityItem(c, cur)).join('')}</div>
        <details class="acc"><summary>إدخال إحداثيات يدوياً</summary><div class="acc-b" id="manual">${S.f.text('mname', 'اسم الموقع', S.settings.cityId ? '' : S.settings.cityName, {})}${S.f.text('mlat', 'خط العرض (مثال 32.0)', S.settings.cityId ? '' : S.settings.lat, { type: 'number', step: 'any', ltr: true })}${S.f.text('mlng', 'خط الطول (مثال 44.33)', S.settings.cityId ? '' : S.settings.lng, { type: 'number', step: 'any', ltr: true })}${S.f.text('mtz', 'المنطقة الزمنية IANA (مثال Asia/Baghdad)', S.settings.tz || Intl.DateTimeFormat().resolvedOptions().timeZone, { ltr: true })}<button class="btn primary block" data-act="saveManualLoc">حفظ</button></div></details>
      </div>`
    };
  });
  function cityItem(c, cur) { return `<button class="li" data-act="pickCity" data-id="${S.esc(c.id)}" data-n="${S.esc(S.norm(c.name + ' ' + c.country))}"><span class="li-ico">${S.icon('map-pin')}</span><span class="li-body"><span class="li-t">${S.esc(c.name)}</span><span class="li-s">${S.esc(c.country)}</span></span>${cur === c.id ? '<span class="li-end">' + S.icon('check') + '</span>' : ''}</button>`; }
  S.onInput('cityFilter', (el) => { const q = S.norm(el.value); S.$$('#citylist .li').forEach((b) => (b.hidden = q && !b.dataset.n.includes(q))); });
  S.act('pickCity', (el) => { const c = S.data.sample.cities.find((x) => x.id === el.dataset.id); S.set({ cityId: c.id, cityName: c.name, lat: c.lat, lng: c.lng, tz: c.tz }); S.toast('تم اختيار ' + c.name, 'ok'); S.router.go('/prayer'); });
  S.act('saveManualLoc', (el) => {
    const d = S.f.read(el.closest('#manual')); const lat = +d.mlat, lng = +d.mlng;
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || d.mlat === '' || d.mlng === '') return S.toast('أدخل إحداثيات صحيحة', 'err');
    try { new Intl.DateTimeFormat('en', { timeZone: d.mtz }); } catch (e) { return S.toast('المنطقة الزمنية غير صحيحة', 'err'); }
    S.set({ cityId: '', cityName: d.mname || 'موقعي', lat, lng, tz: d.mtz }); S.toast('تم حفظ الموقع', 'ok'); S.router.go('/prayer');
  });
  S.act('useGPS', () => new Promise((resolve) => {
    if (!navigator.geolocation) { S.toast('المتصفح لا يدعم تحديد الموقع', 'err'); return resolve(); }
    S.toast('جارٍ تحديد موقعك…');
    navigator.geolocation.getCurrentPosition((pos) => {
      S.set({ cityId: '', cityName: 'موقعي الحالي', lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      S.toast('تم تحديد موقعك', 'ok'); S.router.go('/prayer'); resolve();
    }, (err) => { S.toast(err.code === 1 ? 'رُفض إذن الموقع. اختر مدينتك يدوياً.' : 'تعذّر تحديد الموقع (يتطلب HTTPS وإشارة GPS).', 'err'); resolve(); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }));

  /* ---------- إعدادات الصلاة ---------- */
  S.router.add('/prayer/settings', () => {
    const st = S.settings;
    return {
      title: 'إعدادات الصلاة', nav: 'more', back: '/prayer',
      html: S.h`<div class="stack"><div class="card" id="ps">
        ${S.f.select('calcMethod', 'طريقة الحساب', Object.keys(METHODS).map((k) => ({ v: k, t: METHODS[k].name })), st.calcMethod, { chg: 'psChange' })}
        ${S.f.select('madhab', 'المذهب', [{ v: 'jafari', t: 'اثنا عشري (جعفري)' }, { v: 'other', t: 'مذهب آخر' }], st.madhab, { chg: 'psChange' })}
        ${S.f.select('asr', 'وقت العصر', [{ v: 'Standard', t: 'ظل المثل (الجمهور والجعفري)' }, { v: 'Hanafi', t: 'ظل المثلين (الحنفي)' }], st.asr, { chg: 'psChange' })}
        <div class="field"><label>ضبط الدقائق لكل وقت (احتياط)</label><div class="grid3">${['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => S.h`<div class="field nm"><label class="tiny">${({ fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' })[k]}</label><input class="input ltr" type="number" step="1" min="-30" max="30" value="${st.tune[k] || 0}" data-chg="psTune" data-k="${k}"></div>`)}</div><span class="hint">تُضاف الدقائق إلى الوقت المحسوب (مثلاً +3 للمغرب احتياطاً عند من يرى ذلك).</span></div>
        <div class="setting"><div class="sd">التنبيه عند دخول الوقت<small>${S.isNative ? 'يصل كإشعار نظام عند كل صلاة حتى والتطبيق مغلق' : 'يعمل أثناء فتح التطبيق فقط (قيد من المتصفح)؛ ثبّت تطبيق أندرويد ليصلك والتطبيق مغلق'}</small></div><label class="switch"><input type="checkbox" ${st.adhanOn ? S.raw('checked') : ''} data-chg="psAdhan"><i></i></label></div>
        <div class="field"><label>التنبيه المسبق (بالدقائق، 0 للإيقاف)</label><input class="input ltr" type="number" min="0" max="60" value="${st.preMin}" data-chg="psPre"></div>
        ${S.isNative ? S.h`<div id="nnBox" class="card tint"><div class="card-t">${S.icon('bell')} حالة إشعارات النظام</div><div id="nnStatus" class="small muted">جارٍ الفحص…</div><button class="btn primary block mt-s" data-act="nnEnable">${S.icon('bell')} تفعيل الإشعارات</button><button class="btn block mt-s" data-act="nnTest">${S.icon('volume')} تجربة الأذان بعد 10 ثوانٍ</button><button class="btn block mt-s" data-act="nnExact" id="nnExact" hidden>${S.icon('clock')} فتح إعداد «المنبّهات والتذكيرات»</button><p class="tiny muted nm mt-s">للوصول في الوقت بالضبط على أندرويد 12 فما فوق يلزم السماح بـ«المنبّهات والتذكيرات». وإن أخّرت بعض الهواتف (شاومي، هواوي، سامسونغ…) الإشعارات فاستثنِ سِراج من «توفير البطارية/تحسين البطارية» في إعدادات الهاتف.</p></div>` : ''}
        ${S.isNative ? '' : S.h`<div class="stack-s"><button class="btn block" data-act="notifPerm">${S.icon('bell')} السماح بإشعارات النظام</button></div>`}
        <p class="tiny muted nm">صوت الأذان يحدّده الناشر ويصلك ضمن تحديثات المحتوى الموقّعة.</p>
      </div></div>`,
      mount: () => { nnRender(); }
    };
  });
  const NN_PERM = { granted: 'مسموحة ✓', denied: 'محظورة — فعّلها من إعدادات الهاتف ← التطبيقات ← سِراج ← الإشعارات', prompt: 'لم تُطلب بعد', unknown: 'غير معروفة' };
  async function nnRender() {
    const box = S.$('#nnStatus'); if (!box || !S.nativeNotify) return; const s = await S.nativeNotify.status();
    if (!S.$('#nnStatus')) return; const ex = s.exact === 'denied';
    S.mount(S.$('#nnStatus'), S.h`<div class="kv"><span>إذن الإشعارات</span><b class="${s.perm === 'granted' ? 'ok' : 'bad'}">${NN_PERM[s.perm] || NN_PERM.unknown}</b></div>
      <div class="kv"><span>الدقة في الوقت</span><b class="${ex ? 'bad' : 'ok'}">${s.exact === 'granted' ? 'دقيقة ✓' : ex ? 'تقريبية — فعّل «المنبّهات والتذكيرات»' : 'غير معروفة'}</b></div>
      <div class="kv"><span>إشعارات مجدولة الآن</span><b>${S.n(s.scheduled)}</b></div>
      <div class="kv"><span>صوت الأذان</span><b class="${s.alarm && s.alarmAudio ? 'ok' : ''}">${s.alarm ? (s.alarmAudio ? 'أذان التطبيق — يُسمع حتى في الصامت وعدم الإزعاج' : 'ملف الأذان غير مضمَّن في هذه النسخة (صوت الهاتف الافتراضي)') : s.sound ? 'ملف مرفق مع التطبيق' : 'صوت إشعارات الهاتف الافتراضي'}</b></div>
      ${S.settings.adhanOn ? '' : S.h`<div class="tiny bad">مفتاح «التنبيه عند دخول الوقت» أعلاه مطفأ، فلن يُجدول الأذان.</div>`}
      ${s.error ? S.h`<div class="tiny bad">${s.error}</div>` : ''}`);
    const b = S.$('#nnExact'); if (b) b.hidden = !(s.perm === 'granted' && ex);
  }
  S.onChange('psChange', (el) => { S.set(el.name, el.value); S.toast('تم الحفظ', 'ok'); });
  S.onChange('psTune', (el) => { const t = Object.assign({}, S.settings.tune); t[el.dataset.k] = Math.round(+el.value || 0); S.set('tune', t); });
  S.onChange('psAdhan', async (el) => {
    S.set('adhanOn', el.checked);
    if (el.checked && S.nativeNotify && S.nativeNotify.available()) { const r = await S.nativeNotify.enable(); if (r.perm !== 'granted') S.toast('لن يصل الأذان والتطبيق مغلق قبل السماح بالإشعارات', 'err'); else if (r.needExact) S.toast('اسمح بـ«المنبّهات والتذكيرات» ليصل في الوقت بالضبط', 'ok'); else S.toast('فُعّل: سيصلك الأذان كإشعار نظام', 'ok'); nnRender(); }
    else if (S.nativeNotify) { await S.nativeNotify.sync(true); nnRender(); }
  });
  S.onChange('psPre', (el) => { S.set('preMin', S.clamp(Math.round(+el.value || 0), 0, 60)); if (S.nativeNotify) S.nativeNotify.later(300); });
  S.act('nnQuick', async () => { S.set('adhanOn', true); const r = await S.nativeNotify.enable(); S.toast(r.perm === 'granted' ? (r.needExact ? 'فُعّل — اسمح بـ«المنبّهات والتذكيرات» من إعدادات الصلاة ليصل بالضبط' : 'فُعّل: سيصلك الأذان كإشعار نظام') : 'لم يُسمح بالإشعارات؛ يمكنك السماح بها من إعدادات الهاتف', r.perm === 'granted' ? 'ok' : 'err'); S.router.refresh(); });
  S.act('nnEnable', async () => { const r = await S.nativeNotify.enable(); S.toast(r.perm === 'granted' ? 'تم السماح بالإشعارات' + (S.settings.adhanOn ? '' : ' — فعّل مفتاح التنبيه ليُجدول الأذان') : 'لم يُسمح بالإشعارات', r.perm === 'granted' ? 'ok' : 'err'); nnRender(); });
  S.act('nnTest', async () => {
    const r = await S.nativeNotify.test(10);
    if (r.ok && r.alarm) S.toast(r.hasAudio ? 'بعد 10 ثوانٍ يشتغل الأذان — اقفل الشاشة وجرّب' : 'لا يوجد ملف أذان في التطبيق: سيصلك إشعار فقط. ثبّت حزمة فيها صوت الأذان أولاً', r.hasAudio ? 'ok' : 'err');
    else if (r.ok) S.toast('إشعار تجريبي بعد 10 ثوانٍ (بدون صوت أذان: هذه النسخة بلا منبّه الأذان)', 'ok');
    else S.toast(r.reason === 'denied' ? 'الإشعارات غير مسموحة' : 'تعذّرت التجربة', 'err');
  });
  S.act('nnExact', async () => { await S.nativeNotify.openExactSettings(); setTimeout(() => { S.nativeNotify.sync(true).then(nnRender); }, 600); });
  S.act('notifPerm', async () => { if (S.nativeNotify && S.nativeNotify.available()) { const r = await S.nativeNotify.enable(); S.toast(r.perm === 'granted' ? 'تم السماح بالإشعارات' : 'لم يُسمح بالإشعارات', r.perm === 'granted' ? 'ok' : 'err'); return S.router.refresh(); } if (!window.Notification) return S.toast('المتصفح لا يدعم الإشعارات', 'err'); const r = await Notification.requestPermission(); S.toast(r === 'granted' ? 'تم السماح بالإشعارات' : 'لم يُسمح بالإشعارات', r === 'granted' ? 'ok' : 'err'); });

  /* ---------- القبلة ---------- */
  S.router.add('/qibla', () => {
    const loc = P.loc();
    if (!loc) return { title: 'اتجاه القبلة', nav: 'more', back: '/more', html: S.ui.empty('compass', 'حدّد موقعك أولاً', 'تُحسب القبلة من إحداثياتك إلى الكعبة المشرفة.', S.h`<a class="btn primary" href="#/prayer/location">اختيار الموقع</a>`) };
    const b = P.qibla(loc.lat, loc.lng); const km = P.distKm(loc.lat, loc.lng);
    return {
      title: 'اتجاه القبلة', nav: 'more', back: '/more',
      html: S.h`<div class="stack center"><div class="muted small">${loc.name}</div><div class="h1 nm gold">${S.n(b.toFixed(1))}°</div><div class="small muted">من الشمال باتجاه عقارب الساعة • المسافة ≈ ${S.n(Math.round(km).toLocaleString('en'))} كم</div>
        <div class="compass" id="compass"><span class="cpoint"></span><div class="face" id="cface"><svg class="dial" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="96" class="ring"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(0)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(5)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(10)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(15)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(20)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(25)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(30)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(35)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(40)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(45)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(50)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(55)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(60)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(65)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(70)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(75)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(80)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(85)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(90)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(95)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(100)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(105)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(110)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(115)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(120)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(125)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(130)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(135)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(140)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(145)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(150)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(155)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(160)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(165)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(170)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(175)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(180)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(185)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(190)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(195)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(200)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(205)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(210)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(215)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(220)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(225)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(230)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(235)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(240)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(245)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(250)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(255)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(260)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(265)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(270)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(275)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(280)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(285)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(290)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(295)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(300)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(305)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(310)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(315)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(320)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(325)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-78" transform="rotate(330)" class="tk major"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(335)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(340)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(345)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(350)" class="tk"/><line x1="0" y1="-92" x2="0" y2="-84" transform="rotate(355)" class="tk"/><text x="0" y="-62" transform="rotate(0)" class="dl n" text-anchor="middle">ش</text><text x="0" y="-62" transform="rotate(90)" class="dl" text-anchor="middle">ق</text><text x="0" y="-62" transform="rotate(180)" class="dl" text-anchor="middle">ج</text><text x="0" y="-62" transform="rotate(270)" class="dl" text-anchor="middle">غ</text></svg><div class="needle" id="needle" style="transform:rotate(${b}deg)"><svg viewBox="-100 -100 200 200" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="-62" class="qline"/><polygon points="0,-76 -9,-58 9,-58" class="qhead"/><rect x="-10" y="-96" width="20" height="20" rx="2" class="kb"/><line x1="-10" y1="-90" x2="10" y2="-90" class="kbd"/><circle r="5" class="hub"/></svg></div></div></div>
        <div id="hdg" class="small muted">البوصلة غير مفعّلة — الاتجاه الثابت أعلاه (زاوية ${S.n(b.toFixed(1))}°) محسوب بدقة.</div>
        <button class="btn primary" data-act="startCompass">${S.icon('compass')} تفعيل بوصلة الجهاز</button>
        ${S.ui.tip('warn', 'ملاحظة', 'المستشعرات تتأثر بالمعادن والمغناطيس القريب. اضبط الهاتف أفقياً وحرّكه على شكل 8 لمعايرته، وتأكد باستخدام علامة المحراب في المسجد. الكعبة الصغيرة على الدائرة تدلّك على القبلة: أدر الهاتف حتى تصير أعلى الدائرة تحت المؤشر.')}</div>`,
      unmount() { stopCompass(); }
    };
  });
  let compassHandler = null;
  let nativeCompass = null;
  function stopCompass() { if (nativeCompass) { try { nativeCompass.remove(); window.Capacitor.Plugins.CapgoCompass.stopListening(); } catch (e) { /* */ } nativeCompass = null; } if (compassHandler) { window.removeEventListener('deviceorientationabsolute', compassHandler, true); window.removeEventListener('deviceorientation', compassHandler, true); compassHandler = null; } }
  S.act('startCompass', async () => {
    const loc = P.loc(); const b = P.qibla(loc.lat, loc.lng);
    try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return S.toast('لم يُسمح بالوصول للمستشعر', 'err'); } } catch (e) { return S.toast('تعذّر طلب الإذن', 'err'); }
    stopCompass(); let got = false;
    const show = (hd) => {
      got = true; const face = S.$('#cface'), needle = S.$('#needle'), lbl = S.$('#hdg'); if (!face) return;
      face.style.transform = `rotate(${-hd}deg)`; needle.style.transform = `rotate(${b}deg)`;
      const diff = Math.abs(((b - hd + 540) % 360) - 180); lbl.innerHTML = `اتجاه الهاتف ${S.n(Math.round(hd))}° — ${diff < 5 ? '<b class="ok">أنت متجه نحو القبلة</b>' : 'أدر الهاتف حتى تصير علامة الكعبة تحت المؤشر في الأعلى'}`;
      if (diff < 3) S.vibrate(30);
    };
    /* أندرويد: مستشعر البوصلة الأصلي (WebView لا يرسل أحداث الاتجاه المطلق بموثوقية) */
    const NC = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapgoCompass;
    if (S.isNative && NC) {
      try {
        nativeCompass = await NC.addListener('headingChange', (e) => { if (e && typeof e.value === 'number') show((e.value + 360) % 360); });
        await NC.startListening(); S.toast('البوصلة تعمل — حرّك الهاتف على شكل 8 للمعايرة');
        setTimeout(() => { if (!got) S.toast('لم تصل قراءات من مستشعر البوصلة؛ قد يكون معطّلاً في هاتفك. اعتمد الزاوية الثابتة أعلاه.', 'err'); }, 4000); return;
      } catch (e) { /* نرجع إلى مستشعر المتصفح */ }
    }
    if (!('DeviceOrientationEvent' in window)) return S.toast('الجهاز لا يدعم مستشعر الاتجاه', 'err');
    compassHandler = (ev) => {
      let hd = null; if (typeof ev.webkitCompassHeading === 'number') hd = ev.webkitCompassHeading;
      else if ((ev.absolute || ev.type === 'deviceorientationabsolute') && ev.alpha != null) {
        /* اتجاه مصحَّح بميل الهاتف (W3C): يعمل والهاتف مائل قليلاً لا مسطّحاً فقط */
        const r = Math.PI / 180, a = ev.alpha * r, bt = (ev.beta || 0) * r, g = (ev.gamma || 0) * r;
        const rA = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(bt) * Math.cos(g), rB = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(bt) * Math.cos(g);
        hd = (Math.atan2(rA, rB) / r + 360) % 360;
      }
      if (hd == null) return; show(hd);
    };
    window.addEventListener('deviceorientationabsolute', compassHandler, true); window.addEventListener('deviceorientation', compassHandler, true);
    setTimeout(() => { if (!got) S.toast('جهازك لا يرسل قراءات البوصلة (أو مستشعرها معطّل). اعتمد الزاوية الثابتة أعلاه.', 'err'); }, 3500);
  });
})();

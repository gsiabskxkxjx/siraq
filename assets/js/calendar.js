/* =====================================================================
   سِراج — calendar.js : التقويم الهجري، المناسبات، محوّل التاريخ
   التواريخ الهجرية محسوبة (Intl أم القرى/مدني + إزاحة يدوية). المناسبات مشهورة وقد تختلف بحسب المصدر والرؤية.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const DAY = 86400000;
  const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() + n); return x; };
  const midday = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const monthNames = () => S.data.sample.hijriMonths;

  const C = (S.calendar = {
    occasionsOn(h) { return S.data.sample.occasions.filter((o) => o.m === h.m && o.d === h.d); },
    /* أقرب n مناسبات قادمة (تبدأ من اليوم). تمسح 400 يوماً كحدّ أقصى. */
    upcoming(n, from) {
      const start = midday(from || new Date()); const out = []; const occ = S.data.sample.occasions;
      for (let i = 0; i < 400 && out.length < n; i++) {
        const d = addDays(start, i); const h = S.hijri(d);
        occ.forEach((o) => { if (o.m === h.m && o.d === h.d && out.length < n) out.push({ occ: o, date: d, days: i, h }); });
      }
      return out;
    },
    monthStart(offset) {
      let d = midday(new Date());
      // رجوع إلى أول الشهر الحالي
      let h = S.hijri(d); d = addDays(d, -(h.d - 1));
      for (let k = 0; k < Math.abs(offset); k++) {
        if (offset > 0) { d = addDays(d, 27); h = S.hijri(d); while (h.d !== 1) { d = addDays(d, 1); h = S.hijri(d); } }
        else { d = addDays(d, -1); h = S.hijri(d); d = addDays(d, -(h.d - 1)); }
      }
      return d;
    },
    hijriToGreg(y, m, dd) {
      const approx = Date.UTC(622, 6, 16) + ((y - 1) * 354.367 + (m - 1) * 29.53 + (dd - 1)) * DAY;
      const base = midday(new Date(approx));
      for (let i = -45; i <= 45; i++) { const d = addDays(base, i); const h = S.hijri(d); if (h.y === y && h.m === m && h.d === dd) return d; }
      return null;
    },
    init() {
      if (!S.settings.notifyOcc) return;
      const key = 'occ.notified'; const today = S.today(); if (S.kv.get(key) === today) return;
      const near = C.upcoming(40).filter((x) => x.days <= 1);
      S.kv.set(key, today);
      near.forEach((x) => S.notify.add({ title: (x.days === 0 ? 'اليوم: ' : 'غداً: ') + x.occ.title, body: S.n(x.occ.d) + ' ' + monthNames()[x.occ.m - 1] + ' — تاريخ مشهور؛ راجع التقويم المعتمد لدى مرجعك.', kind: 'occasion' }));
    }
  });

  /* ملاحظات الصيام المرتبطة بتاريخ هجري (معروفة، وتُراجع عند المرجع) */
  function fastNote(h) {
    const n = [];
    if (h.m === 10 && h.d === 1) n.push('يوم عيد الفطر: يحرم صومه.');
    if (h.m === 12 && h.d === 10) n.push('يوم عيد الأضحى: يحرم صومه.');
    if (h.m === 9) n.push('شهر رمضان: صيامه واجب على المكلف.');
    if ([13, 14, 15].includes(h.d) && h.m !== 9 && !(h.m === 12 && h.d === 13)) n.push('من الأيام البيض (13 و14 و15): يُستحب صيامها عند الفقهاء.');
    return n;
  }

  S.router.add('/calendar', (p, q) => {
    const off = +(q.off || 0); const first = C.monthStart(off); const h0 = S.hijri(first); const today = midday(new Date()); const th = S.hijri(today);
    const cells = []; const lead = (first.getDay() + 1) % 7; // السبت أول الأسبوع
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let i = 0; i < 31; i++) { const d = addDays(first, i); const h = S.hijri(d); if (h.m !== h0.m || h.y !== h0.y) break; cells.push({ d, h, occ: C.occasionsOn(h) }); }
    const gregSpan = cells.filter(Boolean); const gA = gregSpan[0].d, gB = gregSpan[gregSpan.length - 1].d;
    return {
      title: 'التقويم الهجري', nav: 'more', back: '/more',
      actions: [{ icon: 'list', label: 'المناسبات', href: '#/calendar/occasions' }],
      html: S.h`<div class="stack">
        <div class="card"><div class="row between"><a class="iconbtn" href="#/calendar?off=${off - 1}" aria-label="الشهر السابق">${S.icon('chevron-right')}</a><div class="center"><div class="h2">${monthNames()[h0.m - 1]} ${S.n(h0.y)} هـ</div><div class="small muted">${S.fmt.gdate(gA, { month: 'long', year: 'numeric' })}${gA.getMonth() !== gB.getMonth() ? ' – ' + S.fmt.gdate(gB, { month: 'long', year: 'numeric' }) : ''}</div></div><a class="iconbtn" href="#/calendar?off=${off + 1}" aria-label="الشهر التالي">${S.icon('chevron-left')}</a></div>
          <div class="cal mt">${['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'].map((w) => S.h`<div class="dh">${w}</div>`)}${cells.map((c) => c ? S.h`<button class="cc ${c.h.m === th.m && c.h.d === th.d && c.h.y === th.y ? 'today' : ''} ${c.occ.length ? 'occ' : ''}" data-act="calDay" data-t="${c.d.getTime()}">${S.n(c.h.d)}<small>${S.n(c.d.getDate())}</small></button>` : S.h`<div></div>`)}</div>
          ${off ? S.h`<a class="btn sm block mt" href="#/calendar">العودة إلى الشهر الحالي</a>` : ''}
          <p class="tiny muted nm mt">${S.settings.hijriCal === 'civil' ? 'تقويم الجدول المدني (حسابي).' : 'تقويم أم القرى.'} الرقم الكبير: اليوم الهجري، الصغير: الميلادي. يمكن ضبط يوم الإزاحة من <a href="#/settings">الإعدادات</a> لمطابقة الرؤية.</p></div>
        <div class="card"><div class="card-t">${S.icon('refresh')} محوّل التاريخ</div>
          <div class="grid2">${S.f.text('gdate', 'ميلادي → هجري', S.fmt.day(today), { type: 'date' })}<div class="field"><label>&nbsp;</label><button class="btn block" data-act="convG2H">حوّل</button></div></div><div id="cv1" class="small gold"></div>
          <div class="grid3 mt">${S.f.text('hy', 'سنة', S.n(th.y), { type: 'number', ltr: true })}${S.f.select('hm', 'شهر', monthNames().map((m, i) => ({ v: i + 1, t: m })), th.m)}${S.f.text('hd', 'يوم', th.d, { type: 'number', min: 1, max: 30, ltr: true })}</div><button class="btn block" data-act="convH2G">${S.icon('arrow-left')} حوّل إلى الميلادي</button><div id="cv2" class="small gold mt"></div></div>
      </div>`
    };
  });
  S.act('calDay', (el) => {
    const d = new Date(+el.dataset.t); const h = S.hijri(d); const occ = C.occasionsOn(h); const fn = fastNote(h);
    S.modal({ title: S.n(h.d) + ' ' + monthNames()[h.m - 1] + ' ' + S.n(h.y) + ' هـ', body: S.h`<p class="gold">${WD[d.getDay()]} ${S.fmt.gdate(d, { day: 'numeric', month: 'long', year: 'numeric' })}</p>${occ.length ? occ.map((o) => S.h`<div class="card flat"><b>${o.title}</b> ${S.ui.badge(o.kind)}<div class="small muted">${o.note || ''}</div></div>`) : S.h`<p class="small muted">لا مناسبة مسجّلة في هذا اليوم ضمن بيانات التطبيق.</p>`}${fn.length ? S.h`<div class="notice info">${S.icon('info')}<div>${fn.map((x) => S.h`<div>${x}</div>`)}<div class="tiny muted">${S.settings.marja ? 'راجع رسالة ' + S.settings.marja : 'راجع رسالة مرجعك'} للتفاصيل.</div></div></div>` : ''}`, actions: [{ label: 'إغلاق', cls: 'primary' }] });
  });
  S.act('convG2H', () => {
    const v = S.$('#f_gdate').value; if (!v) return S.toast('اختر تاريخاً', 'err'); const [y, m, d] = v.split('-').map(Number);
    S.$('#cv1').textContent = S.hijriStr(new Date(y, m - 1, d));
  });
  S.act('convH2G', () => {
    const y = +S.$('#f_hy').value, m = +S.$('#f_hm').value, d = +S.$('#f_hd').value;
    if (!(y > 1) || !(d >= 1 && d <= 30)) return S.toast('أدخل تاريخاً هجرياً صحيحاً', 'err');
    const g = C.hijriToGreg(y, m, d); S.$('#cv2').textContent = g ? S.fmt.gdate(g) : 'هذا التاريخ غير موجود في التقويم المختار (قد يكون الشهر 29 يوماً).';
  });

  S.router.add('/calendar/occasions', (p, q) => {
    const kind = q.kind || ''; const occ = S.data.sample.occasions; const kinds = Array.from(new Set(occ.map((o) => o.kind)));
    const up = C.upcoming(occ.length); const rows = occ.filter((o) => !kind || o.kind === kind).map((o) => ({ o, u: up.find((x) => x.occ === o) }));
    rows.sort((a, b) => (a.u ? a.u.days : 999) - (b.u ? b.u.days : 999));
    return {
      title: 'المناسبات', nav: 'more', back: '/calendar',
      html: S.h`<div class="stack"><div class="chips"><a class="chip ${!kind ? 'active' : ''}" href="#/calendar/occasions">الكل</a>${kinds.map((k) => S.h`<a class="chip ${kind === k ? 'active' : ''}" href="#/calendar/occasions?kind=${encodeURIComponent(k)}">${k}</a>`)}</div>
        <div class="list">${rows.map(({ o, u }) => S.h`<div class="li"><span class="li-body"><span class="li-t">${o.title}</span><span class="li-s">${S.n(o.d)} ${monthNames()[o.m - 1]}${u ? ' • ' + S.fmt.gdate(u.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span></span><span class="li-end small">${u ? (u.days === 0 ? 'اليوم' : u.days === 1 ? 'غداً' : S.n(u.days) + ' يوماً') : ''}</span></div>`)}</div>
        ${S.ui.tip('info', 'تنبيه', 'تواريخ المناسبات مشهورة ويقع خلاف في بعضها بين المصادر؛ والتواريخ الميلادية تقريبية بحسب التقويم المختار.')}
        ${S.h`<div class="setting"><div class="sd">تنبيه المناسبات<small>يظهر في الإشعارات صباح المناسبة أو قبلها بيوم (إشعار نظام في تطبيق أندرويد)</small></div><label class="switch"><input type="checkbox" ${S.settings.notifyOcc ? S.raw('checked') : ''} data-chg="pref" data-k="notifyOcc"><i></i></label></div>`}</div>`
    };
  });
})();

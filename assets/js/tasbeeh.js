/* =====================================================================
   سِراج — tasbeeh.js : المسبحة الإلكترونية
   عدّاد كبير، أذكار جاهزة ومخصصة (متعددة المراحل مثل تسبيح الزهراء ع)، هدف، جلسات، إحصاءات يومية/أسبوعية، إنجازات.
   كل شيء محلي في جهازك. اهتزاز/صوت اختياريان من الإعدادات.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const CIRC = 2 * Math.PI * 46;
  const FREE = { id: 'free', title: 'عدّاد حر', phases: [{ t: 'سبّح', n: 0 }], note: 'عدّاد بلا حدّ' };
  let st = null; let pendDay = 0; let saveT = null;

  const presets = () => [FREE].concat(S.data.sample.dhikr, S.kv.get('tasbeeh.custom', []));
  const presetById = (id) => presets().find((p) => p.id === id) || FREE;
  function fresh(p) { return { pid: p.id, title: p.title, phases: p.phases, pi: 0, c: 0, total: 0, rounds: 0, goal: 0, goalHit: false, startedAt: Date.now() }; }
  function load() { if (st) return st; const v = S.kv.get('tasbeeh.cur'); st = v && v.phases ? v : fresh(S.data.sample.dhikr[0]); return st; }
  const dayKey = (d) => 'tsb:day:' + S.fmt.day(d || Date.now());

  function persist(now) {
    const go = () => { saveT = null; S.kv.set('tasbeeh.cur', st); if (pendDay) { const n = pendDay; pendDay = 0; S.stat.inc(dayKey(), n).then(checkAch); } };
    if (now) { clearTimeout(saveT); go(); } else if (!saveT) saveT = setTimeout(go, 350);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && st) persist(true); });
  window.addEventListener('pagehide', () => { if (st) persist(true); });

  /* ---------- الإنجازات ---------- */
  const ACH = [
    { id: 'a100', t: 'أول مئة', d: 'سبّح 100 تسبيحة في المجموع', ok: (s) => s.all >= 100 },
    { id: 'a1k', t: 'ألف تسبيحة', d: '1000 تسبيحة في المجموع', ok: (s) => s.all >= 1000 },
    { id: 'a10k', t: 'عشرة آلاف', d: '10000 تسبيحة في المجموع', ok: (s) => s.all >= 10000 },
    { id: 'd3', t: 'ثلاثة أيام متتالية', d: 'واظب 3 أيام متتالية', ok: (s) => s.streak >= 3 },
    { id: 'd7', t: 'أسبوع كامل', d: 'واظب 7 أيام متتالية', ok: (s) => s.streak >= 7 },
    { id: 'd30', t: 'شهر من المواظبة', d: 'واظب 30 يوماً متتالية', ok: (s) => s.streak >= 30 },
    { id: 'z1', t: 'تسبيح الزهراء (ع)', d: 'أكمل جولة كاملة من تسبيح الزهراء', ok: (s) => s.zahra >= 1 },
    { id: 'z10', t: 'عشر جولات للزهراء (ع)', d: 'أكمل 10 جولات', ok: (s) => s.zahra >= 10 }
  ];
  async function summary() {
    const all = await S.stat.all(); const days = {}; let total = 0; let zahra = 0;
    all.forEach((r) => { if (r.id.startsWith('tsb:day:')) { days[r.id.slice(8)] = r.n; total += r.n; } else if (r.id === 'tsb:rounds:zahra') zahra = r.n; });
    let streak = 0; const d = new Date(); if (!(days[S.fmt.day(d)] > 0)) d.setDate(d.getDate() - 1);
    while (days[S.fmt.day(d)] > 0) { streak++; d.setDate(d.getDate() - 1); }
    const week = []; for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); week.push({ k: S.fmt.day(x), n: Math.max(0, days[S.fmt.day(x)] || 0), l: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'][x.getDay()] }); }
    let month = 0; for (let i = 0; i < 30; i++) { const x = new Date(); x.setDate(x.getDate() - i); month += Math.max(0, days[S.fmt.day(x)] || 0); }
    return { days, all: Math.max(0, total), streak, zahra, week, month, today: Math.max(0, days[S.today()] || 0) };
  }
  async function checkAch() {
    try {
      const s = await summary(); const got = S.kv.get('tasbeeh.ach', {}); let ch = false;
      ACH.forEach((a) => { if (!got[a.id] && a.ok(s)) { got[a.id] = Date.now(); ch = true; S.toast('إنجاز جديد: ' + a.t, 'ok'); S.notify.add({ title: 'إنجاز جديد: ' + a.t, body: a.d, kind: 'info' }); } });
      if (ch) S.kv.set('tasbeeh.ach', got);
    } catch (e) { /* */ }
  }

  /* ---------- العدّ ---------- */
  function tap() {
    load(); const ph = st.phases[st.pi] || st.phases[0]; st.c++; st.total++; pendDay++;
    let msg = null;
    if (ph.n > 0 && st.c >= ph.n) {
      st.c = 0; msg = 'phase';
      if (st.pi < st.phases.length - 1) st.pi++; else { st.pi = 0; st.rounds++; msg = 'round'; if (st.pid === 'zahra') S.stat.inc('tsb:rounds:zahra'); }
    }
    if (st.goal && st.total >= st.goal && !st.goalHit) { st.goalHit = true; msg = 'goal'; }
    if (msg === 'goal') { S.vibrate([120, 60, 120, 60, 200]); S.beep(784, 300, 0.2); S.toast('بارك الله فيك — بلغت هدفك (' + S.n(st.goal) + ')', 'ok'); S.notify.add({ title: 'تحقق هدف التسبيح', body: st.title + ' — ' + S.n(st.goal), kind: 'info' }); }
    else if (msg === 'round') { S.vibrate([80, 40, 80]); S.beep(660, 200, 0.18); S.toast('أُكملت الجولة ' + S.n(st.rounds), 'ok'); }
    else if (msg === 'phase') { S.vibrate(60); S.beep(520, 120, 0.15); } else S.vibrate(12);
    paint(); persist();
  }
  function paint() {
    load(); const ph = st.phases[st.pi] || st.phases[0];
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('t-count', S.n(st.c)); set('t-phase', ph.t);
    const pr = document.getElementById('t-prg'); if (pr) { const f = ph.n > 0 ? st.c / ph.n : (st.total % 100) / 100; pr.style.strokeDashoffset = String(CIRC * (1 - f)); }
    const b = document.getElementById('t-beads'); if (b) { if (ph.n > 0 && ph.n <= 100) { if (b.children.length !== ph.n) b.innerHTML = '<i></i>'.repeat(ph.n); Array.from(b.children).forEach((x, i) => x.classList.toggle('on', i < st.c)); } else b.innerHTML = ''; }
    set('t-sub', (ph.n > 0 ? S.n(st.c) + ' / ' + S.n(ph.n) + ' • ' : '') + 'المجموع ' + S.n(st.total) + (st.rounds ? ' • الجولات ' + S.n(st.rounds) : '') + (st.goal ? ' • الهدف ' + S.n(st.goal) : ''));
    const nx = document.getElementById('t-next'); if (nx) nx.textContent = st.phases.length > 1 ? 'المراحل: ' + st.phases.map((p, i) => (i === st.pi ? '◀ ' : '') + p.t + ' (' + S.n(p.n) + ')').join('  ') : '';
  }
  async function saveSession(auto) {
    load(); if (st.total <= 0) return false;
    await S.db.put('tasbeeh', { id: S.uid('ts'), date: S.today(), ts: Date.now(), pid: st.pid, title: st.title, total: st.total, rounds: st.rounds, goal: st.goal, durationMs: Date.now() - st.startedAt });
    persist(true); if (auto) S.toast('حُفظت الجلسة السابقة في السجل', 'ok'); return true;
  }

  S.router.add('/tasbeeh', async (p, q) => {
    load();
    if (q.preset && q.preset !== st.pid) { const pr = presetById(q.preset); if (st.total > 0) await saveSession(true); st = fresh(pr); persist(true); }
    const ph = st.phases[st.pi] || st.phases[0]; const all = presets();
    return {
      title: 'المسبحة', nav: 'tasbeeh', back: false,
      actions: [{ icon: 'chart', label: 'الإحصاءات والجلسات', href: '#/tasbeeh/stats' }],
      html: S.h`<div class="tasbeeh">
        <div class="chips" style="align-self:stretch">${all.map((x) => S.h`<button class="chip ${x.id === st.pid ? 'active' : ''}" data-act="tPreset" data-id="${x.id}">${x.title}</button>`)}<button class="chip" data-act="tCustom">${S.icon('plus')} مخصص</button></div>
        <div class="t-phase" id="t-phase">${ph.t}</div>
        <div class="t-count" id="t-count">${S.n(st.c)}</div>
        <div class="t-ring"><svg class="ringsvg" viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="46"/><circle class="prg" id="t-prg" cx="50" cy="50" r="46" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/></svg><button class="t-btn" data-act="tCount" aria-label="سبّح (اضغط للعد)">${S.icon('beads')}</button></div>
        <div class="beads" id="t-beads"></div>
        <div class="small muted center" id="t-sub"></div><div class="tiny muted center" id="t-next"></div>
        <div class="grid3" style="align-self:stretch"><button class="btn" data-act="tUndo">${S.icon('minus')} تراجع</button><button class="btn" data-act="tGoal">${S.icon('target')} هدف</button><button class="btn danger" data-act="tReset">${S.icon('refresh')} تصفير</button></div>
        <button class="btn gold block" data-act="tSave" style="align-self:stretch">${S.icon('check-circle')} إنهاء وحفظ الجلسة</button>
        <p class="tiny muted center nm">${(presetById(st.pid).note) || ''}</p>
      </div>`,
      mount() { paint(); const b = S.$('.t-btn'); if (b) b.focus({ preventScroll: true }); }
    };
  });
  S.act('tCount', () => tap());
  S.act('tUndo', () => { load(); if (st.total <= 0) return; st.total--; pendDay--; if (st.c > 0) st.c--; else if (st.pi > 0) { st.pi--; st.c = Math.max(0, (st.phases[st.pi].n || 1) - 1); } else if (st.rounds > 0) { st.rounds--; st.pi = st.phases.length - 1; st.c = Math.max(0, (st.phases[st.pi].n || 1) - 1); } paint(); persist(); });
  S.act('tReset', async () => { load(); if (st.total > 0 && !(await S.confirm('تصفير العدّاد الحالي دون حفظ الجلسة؟', { danger: true, yes: 'تصفير' }))) return; const p = presetById(st.pid); const g = st.goal; st = fresh(p); st.goal = g; persist(true); S.router.refresh(); });
  S.act('tSave', async () => { load(); if (st.total <= 0) return S.toast('لا توجد تسبيحات لحفظها', 'err'); const t = st.total; await saveSession(false); const p = presetById(st.pid); st = fresh(p); persist(true); S.toast('حُفظت الجلسة: ' + S.n(t) + ' تسبيحة', 'ok'); S.router.refresh(); });
  S.act('tPreset', async (el) => { load(); if (el.dataset.id === st.pid) return; if (st.total > 0) await saveSession(true); st = fresh(presetById(el.dataset.id)); persist(true); S.router.refresh(); });
  S.act('tGoal', async () => { load(); const v = await S.prompt('هدف التسبيح', { label: 'عدد التسبيحات المستهدف (0 لإلغاء الهدف)', type: 'number', value: st.goal || '' }); if (v == null) return; const n = Math.max(0, Math.floor(+v || 0)); st.goal = n; st.goalHit = n > 0 && st.total >= n; persist(true); paint(); S.toast(n ? 'تم تعيين الهدف' : 'أُلغي الهدف', 'ok'); });

  S.act('tCustom', () => {
    const cus = S.kv.get('tasbeeh.custom', []);
    S.modal({
      title: 'ذكر مخصص',
      body: S.h`${S.f.text('ctitle', 'اسم الذكر', '', { placeholder: 'مثال: الاستغفار' })}${S.f.area('cphases', 'المراحل (سطر لكل مرحلة: النص | العدد)', 'أستغفر الله | 100', { rows: 4, hint: 'يمكن عدة أسطر ليتنقل العدّاد بينها تلقائياً. العدد 0 = بلا حد.' })}
        ${cus.length ? S.h`<div class="sec-title"><span>الأذكار المخصصة الحالية</span></div>${cus.map((c) => S.h`<div class="row between"><span>${c.title}</span><button class="btn xs danger" data-act="tCustomDel" data-id="${c.id}">حذف</button></div>`)}` : ''}`,
      actions: [{ label: 'إغلاق', cls: 'ghost' }, { label: 'إضافة', cls: 'primary', onClick: async (box) => {
        const d = S.f.read(box); const title = (d.ctitle || '').trim(); const phases = [];
        (d.cphases || '').split('\n').forEach((ln) => { const [t, n] = ln.split('|'); if (t && t.trim()) phases.push({ t: t.trim(), n: Math.max(0, Math.floor(+(n || 0)) || 0) }); });
        if (!title || !phases.length) { S.toast('أدخل الاسم ومرحلة واحدة على الأقل', 'err'); return false; }
        const list = S.kv.get('tasbeeh.custom', []).concat([{ id: S.uid('c'), title, phases, note: 'ذكر مخصص أضفتَه بنفسك', custom: true }]); await S.kv.set('tasbeeh.custom', list); S.router.refresh();
      } }]
    });
  });
  S.act('tCustomDel', async (el) => { const list = S.kv.get('tasbeeh.custom', []).filter((c) => c.id !== el.dataset.id); await S.kv.set('tasbeeh.custom', list); load(); if (st.pid === el.dataset.id) { st = fresh(S.data.sample.dhikr[0]); persist(true); } S.closeAllModals(); S.router.refresh(); });

  /* ---------- الإحصاءات ---------- */
  S.router.add('/tasbeeh/stats', async () => {
    const s = await summary(); const sess = (await S.db.all('tasbeeh')).sort((a, b) => b.ts - a.ts).slice(0, 25); const got = S.kv.get('tasbeeh.ach', {}); const dg = S.kv.get('tasbeeh.dailyGoal', 0);
    const mx = Math.max(10, ...s.week.map((d) => d.n));
    return {
      title: 'إحصاءات المسبحة', nav: 'tasbeeh', back: '/tasbeeh',
      html: S.h`<div class="stack">
        <div class="grid2"><div class="stat"><b>${S.n(s.today)}</b><span>اليوم</span></div><div class="stat"><b>${S.n(s.week.reduce((a, d) => a + d.n, 0))}</b><span>آخر 7 أيام</span></div><div class="stat"><b>${S.n(s.month)}</b><span>آخر 30 يوماً</span></div><div class="stat"><b>${S.n(s.all)}</b><span>الإجمالي</span></div></div>
        <div class="card"><div class="card-t">${S.icon('chart')} الأسبوع</div><div class="barchart">${s.week.map((d) => S.h`<div class="bc"><em>${S.n(d.n)}</em><i style="height:${Math.max(3, Math.round(d.n / mx * 84))}px"></i><span>${d.l}</span></div>`)}</div><div class="small muted mt">المواظبة المتتالية: <b>${S.n(s.streak)}</b> يوم</div></div>
        <div class="card"><div class="card-t">${S.icon('target')} الهدف اليومي</div>${dg ? S.h`<div class="bar"><i style="width:${Math.min(100, s.today / dg * 100)}%"></i></div><div class="small muted mt">${S.n(s.today)} من ${S.n(dg)}</div>` : S.h`<p class="small muted nm">لم تحدد هدفاً يومياً.</p>`}<button class="btn sm mt" data-act="tDailyGoal">${dg ? 'تعديل الهدف' : 'تحديد هدف يومي'}</button></div>
        <div class="card"><div class="card-t">${S.icon('trophy')} الإنجازات</div>${ACH.map((a) => S.h`<div class="kv" style="${got[a.id] ? '' : 'opacity:.55'}"><span>${S.icon(got[a.id] ? 'check-circle' : 'lock')} ${a.t}<small class="muted" style="display:block">${a.d}</small></span><b>${got[a.id] ? S.fmt.dt(got[a.id]).slice(0, 10) : '—'}</b></div>`)}</div>
        <div class="card"><div class="card-t">${S.icon('list')} الجلسات المحفوظة</div>${sess.length ? sess.map((x) => S.h`<div class="kv"><span>${x.title}<small class="muted" style="display:block">${S.fmt.dt(x.ts)}</small></span><b>${S.n(x.total)}</b></div>`) : S.h`<p class="small muted nm">لا جلسات محفوظة بعد. اضغط «إنهاء وحفظ الجلسة» في المسبحة.</p>`}</div>
        ${sess.length ? S.h`<button class="btn danger block" data-act="tClearSessions">مسح سجل الجلسات</button>` : ''}
      </div>`
    };
  });
  S.act('tDailyGoal', async () => { const v = await S.prompt('الهدف اليومي', { label: 'عدد التسبيحات يومياً (0 للإلغاء)', type: 'number', value: S.kv.get('tasbeeh.dailyGoal', '') }); if (v == null) return; await S.kv.set('tasbeeh.dailyGoal', Math.max(0, Math.floor(+v || 0))); S.router.refresh(); });
  S.act('tClearSessions', async () => { if (await S.confirm('مسح سجل الجلسات؟ (لا تتأثر الإحصاءات اليومية)', { danger: true })) { await S.db.clear('tasbeeh'); S.router.refresh(); } });
  S.tasbeeh = { summary, presets };
})();

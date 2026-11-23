/* =====================================================================
   سِراج — worship.js : أدوات العبادات
   قضاء الصلاة والصيام • حاسبة الخمس • حاسبة الزكاة • أحكام الصيام/الطهارة/السفر • تعليم الوضوء والصلاة • الاستفتاءات • الأعمال المستحبة
   مبادئ ثابتة:
     • لا يُنشئ التطبيق فتوى. الأحكام تُعرض فقط من «مداخل موثقة» منسوبة لاسم المرجع ومصدرها (رسالة عملية + رقم مسألة).
     • الحاسبات حسابية بحتة بمعاملات ظاهرة وقابلة للتعديل ومنسوبة لمصدرها؛ ولا تغني عن الرجوع لمرجعك.
     • الاستفتاء (إرسال سؤال إلى مكتب مرجع) غير مربوط: يحفظ التطبيق السؤال والجواب الذي تحصل عليه أنت فقط.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const esc = S.esc;
  const marja = () => (S.settings.marja || '').trim();
  const P5 = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];
  const ruleEntries = async (topic) => (await S.db.where('entries', 'collection', 'rulings')).filter((e) => !topic || e.extra.topic === topic);

  /* ---------------- قضاء الصلاة والصيام ---------------- */
  const QK = 'qada';
  const emptyQ = () => ({ id: QK, prayers: Object.fromEntries(P5.map(([k]) => [k, { total: 0, done: 0 }])), fast: { total: 0, done: 0 }, log: [], created: Date.now() });
  const loadQ = async () => (await S.db.get('qada', QK)) || emptyQ();
  const saveQ = (q) => S.db.put('qada', q);
  const sumQ = (q) => { const t = P5.reduce((a, [k]) => a + q.prayers[k].total, 0), d = P5.reduce((a, [k]) => a + q.prayers[k].done, 0); return { t, d, left: Math.max(0, t - d) }; };
  S.router.add('/qada', async () => {
    const q = await loadQ(); const s = sumQ(q); const goal = S.kv.get('qada.daily', 5); const last7 = q.log.filter((l) => l.ts > Date.now() - 7 * 864e5).reduce((a, l) => a + l.n, 0);
    const eta = goal > 0 && s.left ? Math.ceil(s.left / goal) : 0; const etaD = eta ? new Date(Date.now() + eta * 864e5) : null;
    return {
      title: 'قضاء الصلاة والصيام', nav: 'more', back: '/prayer',
      html: S.h`<div class="stack">${S.ui.notice('info', 'عن هذه الصفحة', 'عدّاد وجدولة لتنظيم قضائك فقط. أحكام القضاء (الترتيب، قضاء المسافر، الاحتياط، العدد عند الشك…) تُؤخذ من رسالة مرجعك' + (marja() ? ' (' + marja() + ')' : '') + '، ولا يحدّدها التطبيق.')}
        <div class="card"><div class="row between"><div><b>المتبقي من الصلوات</b><div class="small muted">أُنجز ${S.n(s.d)} من ${S.n(s.t)}</div></div>${S.ui.ring(s.t ? s.d / s.t * 100 : 0)}</div>${etaD ? S.h`<div class="small">بوتيرة ${S.n(goal)} صلاة يومياً تنتهي بعد نحو <b>${S.n(eta)}</b> يوماً (${S.fmt.gdate(etaD, { day: 'numeric', month: 'long', year: 'numeric' })}).</div>` : ''}<div class="small muted">آخر 7 أيام: ${S.n(last7)} صلاة</div></div>
        <div class="card"><div class="card-t">${S.icon('mosque')} الصلوات</div>${P5.map(([k, n]) => { const x = q.prayers[k]; return S.h`<div class="qd"><div class="grow"><b>${n}</b><div class="tiny muted">متبقٍ ${S.n(Math.max(0, x.total - x.done))} من ${S.n(x.total)}</div><div class="bar"><i style="width:${x.total ? Math.min(100, x.done / x.total * 100) : 0}%"></i></div></div><button class="btn sm" data-act="qdAdj" data-k="${k}" data-d="-1" aria-label="تراجع">−</button><button class="btn sm primary" data-act="qdAdj" data-k="${k}" data-d="1">قُضيت ${S.icon('check')}</button></div>`; })}
          <button class="btn block mt" data-act="qdSet">${S.icon('edit')} ضبط الأعداد المطلوبة</button><button class="btn block mt-s" data-act="qdRange">${S.icon('calendar')} حساب العدد من فترة (تاريخين)</button></div>
        <div class="card"><div class="card-t">${S.icon('moon')} قضاء الصيام (أيام)</div><div class="qd"><div class="grow"><b>الأيام</b><div class="tiny muted">متبقٍ ${S.n(Math.max(0, q.fast.total - q.fast.done))} من ${S.n(q.fast.total)}</div><div class="bar"><i style="width:${q.fast.total ? Math.min(100, q.fast.done / q.fast.total * 100) : 0}%"></i></div></div><button class="btn sm" data-act="qdFast" data-d="-1">−</button><button class="btn sm primary" data-act="qdFast" data-d="1">+1 يوم</button></div><button class="btn block mt-s" data-act="qdFastSet">ضبط عدد الأيام</button></div>
        <div class="card">${S.f.text('qgoal', 'هدفي اليومي (صلوات/يوم)', goal, { type: 'number', ltr: true, min: 1 })}<button class="btn block" data-act="qdGoal">حفظ الهدف</button></div>
        <button class="btn danger block" data-act="qdReset">${S.icon('trash')} تصفير الجدول</button></div>`
    };
  });
  S.act('qdAdj', async (el) => { const q = await loadQ(); const x = q.prayers[el.dataset.k]; const d = +el.dataset.d; if (d > 0 && x.done >= x.total) return S.toast('لا متبقٍ من هذه الصلاة — اضبط العدد أولاً', 'err'); if (d < 0 && x.done <= 0) return; x.done += d; q.log.push({ ts: Date.now(), k: el.dataset.k, n: d }); q.log = q.log.slice(-500); await saveQ(q); S.vibrate(15); S.router.refresh(); });
  S.act('qdSet', async () => { const q = await loadQ(); S.modal({ title: 'الأعداد المطلوبة قضاؤها', body: S.h`<p class="small muted">أدخل عدد ما عليك من كل صلاة (بحسب ما حدّده مرجعك). لا تقل عن المقضيّ.</p>${P5.map(([k, n]) => S.f.text('n_' + k, n, q.prayers[k].total, { type: 'number', ltr: true, min: 0 }))}`, actions: [{ label: 'إلغاء', cls: 'ghost' }, { label: 'حفظ', cls: 'primary', onClick: async (box) => { const d = S.f.read(box); for (const [k] of P5) { const v = Math.floor(+d['n_' + k] || 0); if (v < 0 || v > 200000) { S.toast('عدد غير صالح', 'err'); return false; } if (v < q.prayers[k].done) { S.toast('العدد أقل مما قُضي (' + q.prayers[k].done + ')', 'err'); return false; } q.prayers[k].total = v; } await saveQ(q); await S.audit('qada.set', 'prayers'); S.router.refresh(); } }] }); });
  S.act('qdRange', () => S.modal({ title: 'حساب العدد من فترة', body: S.h`<p class="small muted">يحسب عدد الأيام بين تاريخين، ويضع لكل صلاة عدد الأيام. اطرح ما صلّيته أنت بنفسك يدوياً بعد ذلك. التفاصيل الشرعية (البلوغ، السفر…) لمرجعك.</p>${S.f.text('d1', 'من تاريخ', '', { type: 'date' })}${S.f.text('d2', 'إلى تاريخ', S.today(), { type: 'date' })}${S.f.check('pl', 'اجمع على ما هو مسجل الآن', false)}`, actions: [{ label: 'إلغاء', cls: 'ghost' }, { label: 'احسب وطبّق', cls: 'primary', onClick: async (box) => { const d = S.f.read(box); if (!d.d1 || !d.d2) { S.toast('اختر التاريخين', 'err'); return false; } const days = Math.round((new Date(d.d2) - new Date(d.d1)) / 864e5) + 1; if (!(days > 0 && days < 40000)) { S.toast('الفترة غير صالحة', 'err'); return false; } const q = await loadQ(); P5.forEach(([k]) => { q.prayers[k].total = (d.pl ? q.prayers[k].total : 0) + days; }); await saveQ(q); S.toast('طُبّق: ' + days + ' يوماً لكل صلاة', 'ok'); S.router.refresh(); } }] }));
  S.act('qdFast', async (el) => { const q = await loadQ(); const d = +el.dataset.d; if (d > 0 && q.fast.done >= q.fast.total) return S.toast('لا أيام متبقية — اضبط العدد', 'err'); if (d < 0 && q.fast.done <= 0) return; q.fast.done += d; await saveQ(q); S.router.refresh(); });
  S.act('qdFastSet', async () => { const v = await S.prompt('عدد أيام الصيام المطلوب قضاؤها', { type: 'number', label: 'عدد الأيام', value: '' }); if (v === null) return; const n = Math.floor(+v); const q = await loadQ(); if (!(n >= 0 && n < 10000) || n < q.fast.done) return S.toast('عدد غير صالح', 'err'); q.fast.total = n; await saveQ(q); S.router.refresh(); });
  S.act('qdGoal', async () => { const v = Math.floor(+S.$('#f_qgoal').value); if (!(v >= 1 && v <= 500)) return S.toast('الهدف بين 1 و500', 'err'); await S.kv.set('qada.daily', v); S.toast('حُفظ', 'ok'); S.router.refresh(); });
  S.act('qdReset', async () => { if (await S.confirm('تصفير جدول القضاء كاملاً؟', { danger: true, yes: 'تصفير' })) { await saveQ(emptyQ()); await S.audit('qada.reset', ''); S.router.refresh(); } });

  /* ---------------- حاسبات الخمس والزكاة ---------------- */
  const CALC_NOTE = 'الحاسبة تُجري عملية حسابية بالمعاملات الظاهرة فقط. المستثنيات وما يدخل في المؤونة والديون وتفاصيل الحول تختلف باختلاف المراجع وأحوال المكلّف، فاسأل مرجعك أو وكيله. لا تُعدّ هذه الحاسبة فتوى.';
  const Z = {
    src: 'القيم الافتراضية مأخوذة من «توضيح المسائل/المنهاج» للسيد علي السيستاني كما نُشر على موقع مكتبه الرسمي (sistani.org): نصاب الغلات الأربع 300 صاع ≈ 847 كغم (م 1880)، ونصاب الذهب 20 مثقالاً شرعياً = 15 مثقالاً صيرفياً، والفضة 105 مثاقيل صيرفية، والمقدار الواجب فيهما ربع العشر (2.5%).',
    mithqal: 4.608, goldM: 15, silverM: 105, grain: 847, rate: 2.5
  };
  S.router.add('/worship/calc', () => ({
    title: 'حاسبات الخمس والزكاة', nav: 'more', back: '/more',
    html: S.h`<div class="stack">${S.ui.notice('warn', 'ليست فتوى', CALC_NOTE)}${marja() ? S.ui.notice('info', 'مرجعك المسجَّل: ' + marja(), 'عدّل المعاملات إن كان رأي مرجعك يختلف عمّا هو مكتوب أدناه.') : S.ui.notice('info', 'المرجع غير محدد', 'يمكنك تسجيل المرجع الذي تقلّده من الإعدادات ليُذكر بجانب النتائج.')}
      <a class="card tap" href="#/worship/khums"><b>${S.icon('scale')} حاسبة الخمس</b><div class="small muted">20% من فاضل مؤونة السنة بمعاملات تُدخلها</div></a>
      <a class="card tap" href="#/worship/zakat"><b>${S.icon('scale')} حاسبة الزكاة</b><div class="small muted">النقدان (الذهب والفضة) والغلات الأربع — الأنعام غير مدرجة</div></a></div>`
  }));
  const num = (id) => { const v = parseFloat(String(S.$('#f_' + id).value).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,،\s]/g, '')); return Number.isFinite(v) ? v : NaN; };
  const money = (v) => S.n(v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  S.router.add('/worship/khums', () => ({
    title: 'حاسبة الخمس', nav: 'more', back: '/worship/calc',
    html: S.h`<div class="stack">${S.ui.notice('warn', 'ليست فتوى', CALC_NOTE)}<div class="card"><div class="card-t">${S.icon('calc')} الخمس السنوي (أرباح المكاسب)</div>
      <p class="small muted nm">القاعدة المعروفة: الخمس (1/5 = 20%) فيما يفضل عن مؤونة السنة من أرباح المكاسب. الوحدة: أي عملة تختارها.</p>
      ${S.f.text('kinc', 'الأرباح خلال السنة الخمسية', '', { type: 'number', ltr: true, min: 0, hint: 'مجموع ما ربحته وفضل عندك أو صُرف في غير المؤونة' })}${S.f.text('kexp', 'مؤونة السنة (نفقاتك المعتادة)', '', { type: 'number', ltr: true, min: 0 })}${S.f.text('kdebt', 'ديون تُسقَط وفق رأي مرجعك (اختياري)', '0', { type: 'number', ltr: true, min: 0 })}${S.f.text('kother', 'أموال أخرى متعلق بها الخمس تدخلها بنفسك (اختياري)', '0', { type: 'number', ltr: true, min: 0, hint: 'مثل ما أعدّه مرجعك خاضعاً: لا يحدّده التطبيق' })}${S.f.text('krate', 'نسبة الخمس %', 20, { type: 'number', ltr: true, min: 0, max: 100 })}
      <button class="btn primary block" data-act="khCalc">${S.icon('calc')} احسب</button><div id="kh-out"></div></div></div>`
  }));
  S.act('khCalc', async () => {
    const inc = num('kinc'), exp = num('kexp'), debt = num('kdebt') || 0, oth = num('kother') || 0, rate = num('krate'); if (!(inc >= 0) || !(exp >= 0)) return S.toast('أدخل الأرباح والمؤونة بأرقام صحيحة', 'err'); if (!(rate >= 0 && rate <= 100)) return S.toast('النسبة بين 0 و100', 'err');
    const surplus = Math.max(0, inc - exp - debt); const base = surplus + Math.max(0, oth); const kh = base * rate / 100;
    S.$('#kh-out').innerHTML = `<div class="card flat mt"><div class="kv"><span>الأرباح</span><b>${money(inc)}</b></div><div class="kv"><span>− المؤونة</span><b>${money(exp)}</b></div>${debt ? `<div class="kv"><span>− الديون</span><b>${money(debt)}</b></div>` : ''}<div class="kv"><span>= الفاضل</span><b>${money(surplus)}</b></div>${oth ? `<div class="kv"><span>+ أموال أخرى</span><b>${money(oth)}</b></div>` : ''}<div class="kv"><span>الخمس (${S.n(rate)}%)</span><b class="gold" style="font-size:1.3rem">${money(kh)}</b></div><p class="tiny muted nm">${esc(marja() ? 'تُسلَّم وتُقسَّم وفق ما يحدّده مرجعك (' + marja() + ') أو وكيله.' : 'تُسلَّم وتُقسَّم وفق ما يحدّده مرجعك أو وكيله.')} ${inc - exp - debt < 0 ? 'لا فاضل: لا خمس على هذا المدخل وفق هذه العملية الحسابية.' : ''}</p></div>`;
    await S.stat.inc('calc:khums');
  });
  S.router.add('/worship/zakat', () => ({
    title: 'حاسبة الزكاة', nav: 'more', back: '/worship/calc',
    html: S.h`<div class="stack">${S.ui.notice('warn', 'ليست فتوى', CALC_NOTE)}${S.ui.notice('info', 'مصدر المعاملات', Z.src)}${S.ui.notice('warn', 'نطاق الحاسبة', 'تغطي النقدين (الذهب والفضة) والغلات الأربع (الحنطة والشعير والتمر والزبيب) فقط. زكاة الأنعام الثلاثة (الإبل والبقر والغنم) لها جداول خاصة غير مدرجة هنا: ارجع إلى رسالة مرجعك. كذلك قد يختلف المراجع في زكاة العملات الورقية وعروض التجارة.')}
      <div class="card"><div class="card-t">${S.icon('calc')} الذهب والفضة (مسكوكَين)</div><p class="tiny muted nm">بحسب ما نشره مكتب السيد السيستاني تتعلق الزكاة بالنقدين المسكوكَين المتداولَين، والحلي والمصوغات معفاة؛ للمراجع الآخرين تفصيل مختلف أحياناً — راجع رسالة مرجعك.</p>${S.f.select('zk', 'النوع', [{ v: 'gold', t: 'ذهب' }, { v: 'silver', t: 'فضة' }], 'gold')}${S.f.text('zw', 'الوزن بالغرام', '', { type: 'number', ltr: true, min: 0 })}${S.f.check('zy', 'مضى عليه حول كامل (سنة هلالية) وهو في ملكي وتحت تصرّفي', false)}
        <details class="acc"><summary>المعاملات (قابلة للتعديل وفق مرجعك)</summary><div class="acc-b">${S.f.text('zm', 'غرام المثقال الصيرفي', Z.mithqal, { type: 'number', ltr: true, step: 0.001, hint: '4.608 غ (24 حمصة) تقريب حسابي معروف وليس نصاً من الرسالة؛ عدّله إن اعتمد مرجعك قيمة أخرى' })}${S.f.text('zgm', 'نصاب الذهب (مثقال صيرفي)', Z.goldM, { type: 'number', ltr: true })}${S.f.text('zsm', 'نصاب الفضة (مثقال صيرفي)', Z.silverM, { type: 'number', ltr: true })}${S.f.text('zr', 'نسبة الزكاة %', Z.rate, { type: 'number', ltr: true, step: 0.1 })}</div></details>
        <button class="btn primary block mt" data-act="zkCalc">${S.icon('calc')} احسب زكاة النقدين</button><div id="zk-out"></div></div>
      <div class="card"><div class="card-t">${S.icon('calc')} الغلات الأربع</div>${S.f.select('gk', 'النوع', [{ v: 'wheat', t: 'حنطة' }, { v: 'barley', t: 'شعير' }, { v: 'dates', t: 'تمر' }, { v: 'raisins', t: 'زبيب' }], 'wheat')}${S.f.text('gw', 'الكمية بعد اليبس (كغم)', '', { type: 'number', ltr: true, min: 0 })}${S.f.select('gi', 'طريقة السقي', [{ v: '10', t: 'مطر أو نهر أو ما لا كلفة فيه (العُشر 10%)' }, { v: '5', t: 'بالدلو أو المضخة (نصف العُشر 5%)' }, { v: '7.5', t: 'مختلط بالنصف (7.5%)' }], '10')}<details class="acc"><summary>نصاب الغلات</summary><div class="acc-b">${S.f.text('gn', 'نصاب الغلات (كغم)', Z.grain, { type: 'number', ltr: true })}<p class="tiny muted nm">300 صاع ≈ 847 كغم «فيما قيل» بحسب نص الرسالة؛ والتقريب الوزني يختلف عند بعض المراجع.</p></div></details>
        <button class="btn primary block mt" data-act="grCalc">${S.icon('calc')} احسب زكاة الغلات</button><div id="gr-out"></div></div></div>`
  }));
  S.act('zkCalc', async () => {
    const w = num('zw'), m = num('zm'), gm = num('zgm'), sm = num('zsm'), r = num('zr'); const kind = S.$('#f_zk').value; if (!(w >= 0) || !(m > 0) || !(gm > 0) || !(sm > 0) || !(r > 0 && r <= 100)) return S.toast('تحقّق من الأرقام المُدخلة', 'err');
    const nis = (kind === 'gold' ? gm : sm) * m; const hawl = S.$('[name=zy]').checked; let html = `<div class="card flat mt"><div class="kv"><span>النصاب</span><b>${money(nis)} غ</b></div><div class="kv"><span>وزنك</span><b>${money(w)} غ</b></div>`;
    if (w < nis) html += `<p class="nm"><b>لم يبلغ النصاب</b> فلا زكاة وفق هذه المعاملات.</p>`;
    else if (!hawl) html += `<p class="nm"><b>بلغ النصاب</b> لكن لم تؤكّد مرور الحول فلا تجب الآن وفق الشرط المعروف.</p>`;
    else html += `<div class="kv"><span>الزكاة (${S.n(r)}%)</span><b class="gold" style="font-size:1.3rem">${money(w * r / 100)} غ</b></div>`;
    S.$('#zk-out').innerHTML = html + `<p class="tiny muted nm">${esc(marja() ? 'اعرض النتيجة على مرجعك (' + marja() + ') أو وكيله للتحقق.' : 'تحقق من النتيجة عند مرجعك أو وكيله.')} الحول يُحسب من ملكيتك للنصاب كاملاً طوال المدة، وللمراجع تفصيل في ذلك.</p></div>`; await S.stat.inc('calc:zakat');
  });
  S.act('grCalc', async () => {
    const w = num('gw'), n = num('gn'), rate = +S.$('#f_gi').value; if (!(w >= 0) || !(n > 0)) return S.toast('تحقّق من الأرقام المُدخلة', 'err');
    S.$('#gr-out').innerHTML = `<div class="card flat mt"><div class="kv"><span>النصاب</span><b>${money(n)} كغم</b></div><div class="kv"><span>كميتك</span><b>${money(w)} كغم</b></div>${w < n ? '<p class="nm"><b>لم تبلغ النصاب</b> فلا زكاة وفق هذه المعاملات.</p>' : `<div class="kv"><span>الزكاة (${S.n(rate)}%)</span><b class="gold" style="font-size:1.3rem">${money(w * rate / 100)} كغم</b></div>`}<p class="tiny muted nm">${esc(marja() ? 'تحقق من التفاصيل عند ' + marja() + ' (المستثنيات، وقت التعلّق، المؤونة).' : 'تحقق من التفاصيل عند مرجعك (المستثنيات، وقت التعلّق).')}</p></div>`; await S.stat.inc('calc:zakat');
  });

  /* ---------------- أبواب الأحكام: صيام، طهارة، سفر، وضوء، صلاة ---------------- */
  const TOPICS = {
    sawm: { t: 'أحكام الصيام', ic: 'moon', intro: 'مبطلات الصوم، الكفارة، القضاء، المسافر والمريض…' },
    taharah: { t: 'أحكام الطهارة والنجاسات', ic: 'droplet', intro: 'المياه والنجاسات والمطهّرات والغسل…' },
    safar: { t: 'أحكام السفر', ic: 'map-pin', intro: 'المسافة الشرعية، قصر الصلاة، الإفطار في السفر…' },
    wudu: { t: 'الوضوء', ic: 'droplet', intro: 'أحكام الوضوء الواجبة والمستحبة والمبطلات.' },
    salat: { t: 'الصلاة', ic: 'mosque', intro: 'واجبات الصلاة ومبطلاتها وأحكام الخلل.' }
  };
  const ruleCard = (e) => S.h`<div class="card"><div class="row between"><b>${e.title}</b>${S.ui.badge(e.extra.marja, S.norm(e.extra.marja) === S.norm(marja()) ? 'ok' : '')}</div><p class="quote">${e.text}</p>${e.sources.map((s) => S.h`<div class="tiny muted">المصدر: ${s.book}${s.author ? ' — ' + s.author : ''}${s.number ? '، مسألة/رقم ' + s.number : ''}${s.volume ? '، ج ' + s.volume : ''}${s.page ? '، ص ' + s.page : ''}</div>`)}<a class="btn xs mt-s" href="#/research/rulings/${e.id}">تفاصيل المدخل</a></div>`;
  Object.keys(TOPICS).forEach((tp) => {
    S.router.add('/worship/' + tp, async () => {
      const T = TOPICS[tp]; const rows = await ruleEntries(tp); const mine = rows.filter((e) => marja() && S.norm(e.extra.marja) === S.norm(marja())); const others = rows.filter((e) => !mine.includes(e));
      return {
        title: T.t, nav: 'more', back: '/worship',
        html: S.h`<div class="stack">${S.ui.notice('warn', 'مصدر الأحكام', 'لا يضع سِراج أحكاماً من عنده ولا يولّدها بالذكاء الاصطناعي. تُعرض هنا فقط أحكام وصلت من الناشر بنصها من رسالة المرجع المسمّى مع رقم المسألة. للحكم المعتمد لديك ارجع إلى رسالة مرجعك' + (marja() ? ' (' + marja() + ')' : '') + '.')}
          ${mine.length ? S.h`${S.ui.sectionTitle('أحكام مرجعك: ' + marja())}${mine.map(ruleCard)}` : marja() ? S.ui.notice('info', 'لا أحكام موثقة لمرجعك في هذا الباب بعد', 'ارجع إلى رسالته العملية. يصل المحتوى الموثق من الناشر عبر «تحديثات المحتوى».') : S.ui.notice('info', 'سجّل مرجعك', 'ضع اسم المرجع في الإعدادات لتظهر أحكامه أولاً.')}
          ${others.length ? S.h`${S.ui.sectionTitle('أحكام منسوبة لمراجع آخرين')}${others.map(ruleCard)}` : ''}
          ${tp === 'wudu' || tp === 'salat' ? teachBlock(tp) : ''}
          <a class="btn block" href="#/istifta?topic=${tp}">${S.icon('help-circle')} صياغة استفتاء حول هذا الباب</a></div>`
      };
    });
  });
  const WUDU = [['الوجه', ''], ['اليدان إلى المرافق', ''], ['الرأس', ''], ['الرجلان إلى الكعبين', '']];
  const teachBlock = (tp) => (tp === 'wudu' ? S.h`<div class="card"><div class="card-t">${S.icon('droplet')} الأعضاء المذكورة في آية الوضوء — للتعلّم لا للفتوى</div><p class="small muted nm">الأصل القرآني: سورة المائدة، الآية 6. اضغط للانتقال إلى الآية (يظهر نصها بعد تنزيل المصحف). نذكر هنا أسماء الأعضاء الواردة في الآية فقط دون وصف الفعل أو حدوده.</p><div class="chips"><a class="chip" href="#/quran/ayah/5/6">المائدة ٦</a></div><ol class="list-b">${WUDU.map(([a, b]) => S.h`<li><b>${a}</b></li>`)}</ol><p class="tiny muted nm">كيفية الفعل وحدوده والترتيب والموالاة والنية وشروط الوضوء وأحكام الجبيرة والخلل تؤخذ كلها من رسالة مرجعك أو من معلم موثوق. هذه القائمة لا تغني عن الرسالة.</p></div>` : S.h`<div class="card"><div class="card-t">${S.icon('mosque')} تعلّم الصلاة</div><p class="small nm">نصوص الأذكار والقراءة وتفصيل الأفعال تُؤخذ من «رسالة مرجعك» أو من معلم موثوق. لم يُضمَّن هنا نص تعليمي للصلاة لأن صيغه وتفاصيله تُنقل من مصادر موثقة ولم يصل بعد من الناشر مدخل بمصدره.</p><a class="btn sm" href="#/duas">الأدعية الموثقة</a></div>`);

  /* ---------------- المركز: /worship ---------------- */
  S.router.add('/worship', async () => {
    const q = await loadQ(); const s = sumQ(q); const rules = (await ruleEntries()).length; const ist = S.kv.get('istifta', []).length; const m = S.data.sample.mustahabb;
    const tile = (ic, t, d, href) => S.h`<a class="card tap" href="#${href}">${S.icon(ic)}<b>${t}</b><div class="tiny muted">${d}</div></a>`;
    return {
      title: 'العبادات', nav: 'more', back: '/more',
      html: S.h`<div class="stack">${S.ui.notice('warn', 'المرجعية', 'مرجعك المسجَّل: ' + (marja() || 'غير محدد') + '. لا يُصدر سِراج فتاوى؛ الأحكام تُعرض بنصها ومصدرها منسوبة لمراجعها فقط.')}
        <div class="grid2">${tile('clock', 'مواقيت الصلاة', 'حسب موقعك وطريقة الحساب', '/prayer')}${tile('compass', 'القبلة', 'بوصلة وزاوية حسابية', '/qibla')}${tile('calendar', 'التقويم والمناسبات', 'هجري وميلادي', '/calendar')}${tile('check-circle', 'متابعة الصلاة', 'سجل اليوم والإحصاءات', '/prayer/stats')}
          ${tile('repeat', 'قضاء الصلاة', 'متبقٍ ' + S.n(s.left), '/qada')}${tile('calc', 'الخمس والزكاة', 'حاسبتان بمعاملات ظاهرة', '/worship/calc')}${tile('moon', 'أحكام الصيام', '', '/worship/sawm')}${tile('droplet', 'أحكام الطهارة', '', '/worship/taharah')}
          ${tile('map-pin', 'أحكام السفر', '', '/worship/safar')}${tile('droplet', 'تعليم الوضوء', 'مخطط + أحكام موثقة', '/worship/wudu')}${tile('mosque', 'تعليم الصلاة', '', '/worship/salat')}${tile('help-circle', 'الاستفتاءات', ist + ' محفوظ — الإرسال غير مربوط', '/istifta')}
          ${tile('star', 'الأعمال المستحبة', S.n(m.length) + ' عملاً للتتبع اليومي', '/daily/mustahabb')}${tile('beads', 'المسبحة', 'عداد وأهداف', '/tasbeeh')}</div>
        <div class="small muted center">${S.n(rules)} حكماً موثقاً في الموسوعة</div></div>`
    };
  });

  /* ---------------- الاستفتاءات ---------------- */
  S.router.add('/istifta', (p, q) => {
    const list = S.kv.get('istifta', []).slice().sort((a, b) => b.ts - a.ts); const tp = q.topic && TOPICS[q.topic] ? TOPICS[q.topic].t : '';
    return {
      title: 'الاستفتاءات الشرعية', nav: 'more', back: '/worship',
      html: S.h`<div class="stack">${S.ui.notice('err', 'غير مربوط', 'إرسال الاستفتاء إلى مكتب مرجع غير موصول في هذه النسخة (يحتاج اتفاقاً مع المكتب وخادماً). هنا تُصاغ الأسئلة وتُحفظ على جهازك، وتنسخها لإرسالها بنفسك عبر القناة الرسمية لمرجعك، ثم تسجّل الجواب الذي تحصل عليه مع مصدره.')}
        <div class="card"><div class="card-t">${S.icon('edit')} صياغة سؤال</div>${S.f.text('iq', 'الباب', tp)}${S.f.area('it', 'نص السؤال (اذكر الحالة بدقة)', '', { rows: 5 })}<button class="btn primary block" data-act="isSave">${S.icon('check')} حفظ السؤال</button></div>
        ${list.length ? list.map((x) => S.h`<div class="card"><div class="row between"><b>${x.topic || 'سؤال'}</b><span class="tiny muted">${S.fmt.dt(x.ts)}</span></div><p class="nm">${x.q}</p>${x.a ? S.h`<div class="notice ok">${S.icon('check-circle')}<div><b>الجواب المسجَّل (من المرجع)</b><p class="nm">${x.a}</p><div class="tiny muted">المرجع/المكتب: ${x.by} • المصدر: ${x.src}</div></div></div>` : S.h`<div class="tiny muted">لا جواب مسجَّل بعد.</div>`}<div class="row wrap mt-s"><button class="btn xs" data-act="isCopy" data-id="${x.id}">${S.icon('copy')} نسخ للإرسال</button><button class="btn xs" data-act="isAns" data-id="${x.id}">تسجيل الجواب</button><button class="btn xs danger" data-act="isDel" data-id="${x.id}">حذف</button></div></div>`) : S.ui.empty('help-circle', 'لا أسئلة محفوظة')}</div>`
    };
  });
  S.act('isSave', async () => { const t = S.$('#f_it').value.trim(); if (t.length < 8) return S.toast('اكتب السؤال بوضوح', 'err'); const a = S.kv.get('istifta', []); a.push({ id: S.uid('is'), topic: S.$('#f_iq').value.trim(), q: t, ts: Date.now() }); await S.kv.set('istifta', a); S.toast('حُفظ', 'ok'); S.router.refresh(); });
  S.act('isCopy', (el) => { const x = S.kv.get('istifta', []).find((i) => i.id === el.dataset.id); S.copy('السلام عليكم ورحمة الله\n' + (x.topic ? 'الباب: ' + x.topic + '\n' : '') + 'السؤال: ' + x.q); });
  S.act('isDel', async (el) => { if (await S.confirm('حذف السؤال؟', { danger: true })) { await S.kv.set('istifta', S.kv.get('istifta', []).filter((i) => i.id !== el.dataset.id)); S.router.refresh(); } });
  S.act('isAns', async (el) => { const a = S.kv.get('istifta', []); const x = a.find((i) => i.id === el.dataset.id); S.modal({ title: 'تسجيل الجواب', body: S.h`<p class="small muted">سجّل الجواب كما ورد لك من مكتب المرجع، مع اسم المرجع والمصدر (رقم الاستفتاء أو التاريخ). لا تسجّل جواباً لم تتلقَّه.</p>${S.f.area('ans', 'الجواب كما ورد', x.a || '', { rows: 5 })}${S.f.text('by', 'المرجع/المكتب', x.by || marja())}${S.f.text('src', 'المصدر (رقم/تاريخ/قناة)', x.src || '')}`, actions: [{ label: 'إلغاء', cls: 'ghost' }, { label: 'حفظ', cls: 'primary', onClick: async (box) => { const d = S.f.read(box); if (!d.ans.trim() || !d.by.trim() || !d.src.trim()) { S.toast('الجواب والمرجع والمصدر كلها مطلوبة', 'err'); return false; } Object.assign(x, { a: d.ans.trim(), by: d.by.trim(), src: d.src.trim() }); await S.kv.set('istifta', a); S.router.refresh(); } }] }); });

  S.worship = { init() { /* لا مؤقتات؛ الصفحات تقرأ من التخزين عند الطلب */ }, sumQ, loadQ, Z };
})();

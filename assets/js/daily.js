/* =====================================================================
   سِراج — daily.js : الإضافات اليومية (15 ميزة)
   1 ورد يومي • 2 تحدي قراءة • 3 عشر صفحات يومياً • 4 متابعة ختمة • 5 دفتر تدبر • 6 سجل الأعمال المستحبة • 7 أهداف الذكر
   8 أذكار الصباح والمساء • 9 تنبيهات قراءة الأدعية • 10 هدية كتاب رقمي (عند ترخيص يسمح) • 11 مكتبة صوتية • 12 تحويل النص إلى صوت
   13 مزامنة التقدم (غير مربوطة) • 14 وضع كبار السن • 15 إشعارات المناسبات
   لا شيء مختلق: النصوص الدينية تأتي من الأدعية الموثقة فقط، والعدّادات من استخدامك أنت.
   التنبيهات في المتصفح تعمل والتطبيق مفتوح فقط؛ في تطبيق أندرويد تُجدول كإشعارات نظام (native-notify.js).
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const L = () => S.library;
  const dayKey = (d) => S.fmt.day(d || Date.now());
  const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const WD = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
  const streak = async (fn) => { let s = 0; let i = 0; if (!(await fn(dayKey(back(0))))) i = 1; while (i < 400 && (await fn(dayKey(back(i))))) { s++; i++; } return s; };
  const weekBars = (vals, max) => S.h`<div class="wk">${vals.map((v) => S.h`<div class="wk-c"><i style="height:${max ? Math.max(4, Math.min(100, v.n / max * 100)) : 4}%" class="${v.n ? 'on' : ''}"></i><span>${v.l}</span><b>${S.n(v.n)}</b></div>`)}</div>`;
  const week = async (fn) => { const o = []; for (let i = 6; i >= 0; i--) { const d = back(i); o.push({ l: WD[d.getDay()], n: await fn(dayKey(d)) }); } return o; };

  /* ---------------- الصفحة الرئيسية للإضافات ---------------- */
  S.router.add('/daily', async () => {
    const wird = S.kv.get('daily.wird', []); const today = dayKey(); let wd = 0; for (const w of wird) if (await S.stat.get('wird:' + today + ':' + w.id)) wd++;
    const rd = await S.stat.get('read:' + today); const rt = S.kv.get('daily.readTarget', 10); const must = S.data.sample.mustahabb.concat(S.kv.get('daily.mustahabb.custom', [])); let md = 0; for (let i = 0; i < must.length; i++) if (await S.stat.get('must:' + today + ':' + i)) md++;
    const ts = await S.tasbeeh.summary(); const dg = S.kv.get('tasbeeh.dailyGoal', 0); const kh = S.quran && S.quran.khatmaState && S.quran.khatmaState(); const nTad = (await S.db.where('notes', 'type', 'tadabbur')).length; const rem = S.kv.get('daily.reminders', []).filter((r) => r.enabled).length;
    const up = S.calendar.upcoming(1)[0]; const tile = (n, ic, t, d, href) => S.h`<a class="card tap dl" href="#${href}"><span class="dl-top"><span class="dl-ic">${S.icon(ic)}</span><span class="dl-n">${S.n(n)}</span></span><b>${t}</b><div class="tiny muted">${d}</div></a>`;
    return {
      title: 'الإضافات اليومية', nav: 'more', back: '/more',
      html: S.h`<div class="stack"><div class="card hero-mini"><b>يومك مع سِراج</b><p class="small nm">عدّادات وسجلات تحفظها على جهازك فقط. لا نصوص دينية مُختلَقة: الأذكار والأدعية تأتي موثقة بمصدرها أو لا تظهر.</p></div>
        <div class="grid2">${tile(1, 'check-circle', 'الورد اليومي', wird.length ? S.n(wd) + ' من ' + S.n(wird.length) + ' اليوم' : 'أضِف وردك', '/daily/wird')}${tile(2, 'target', 'تحدي القراءة', S.n(rd) + ' / ' + S.n(rt) + ' صفحة اليوم', '/daily/reading')}${tile(3, 'book-open', 'عشر صفحات يومياً', 'اضبط الهدف على 10', '/daily/reading?preset=10')}${tile(4, 'target', 'متابعة الختمة', kh && kh.plan ? 'ختمة جارية' : 'لم تبدأ ختمة', '/quran/khatma')}
          ${tile(5, 'notebook', 'دفتر التدبر', S.n(nTad) + ' تدبّراً', '/tadabbur')}${tile(6, 'star', 'الأعمال المستحبة', S.n(md) + ' من ' + S.n(must.length) + ' اليوم', '/daily/mustahabb')}${tile(7, 'beads', 'أهداف الذكر', dg ? S.n(ts.today) + ' / ' + S.n(dg) : 'اليوم ' + S.n(ts.today), '/daily/dhikr')}${tile(8, 'sun', 'أذكار الصباح والمساء', 'من الأدعية الموثقة', '/daily/adhkar')}
          ${tile(9, 'bell', 'تنبيهات الأدعية', S.n(rem) + ' تنبيه مفعّل', '/daily/reminders')}${tile(10, 'heart', 'هدية كتاب رقمي', 'عند ترخيص يسمح', '/daily/gift')}${tile(11, 'volume', 'المكتبة الصوتية', 'تسجيلات مرخّصة', '/daily/audio')}${tile(12, 'mic', 'تحويل النص إلى صوت', 'صوت جهازك', '/daily/tts')}
          ${tile(15, 'calendar', 'إشعارات المناسبات', up ? 'القادمة: ' + up.occ.title : 'عند فتح التطبيق', '/daily/occasions')}</div>
        <div class="card"><div class="setting"><div class="sd">14 • وضع كبار السن<small>خط أكبر وأزرار أوسع وتباين أعلى</small></div><label class="switch"><input type="checkbox" ${S.settings.elder ? S.raw('checked') : ''} data-chg="pref" data-k="elder" aria-label="وضع كبار السن"><i></i></label></div></div></div>`
    };
  });

  /* ---------------- 1: الورد اليومي ---------------- */
  const WIRD_PRE = [['قراءة صفحة من القرآن', 'quran'], ['تسبيح الزهراء (ع) بعد الصلاة', 'dhikr'], ['دعاء أو زيارة من الأدعية الموثقة', 'dua'], ['تدبّر آية', 'note']];
  S.router.add('/daily/wird', async () => {
    const list = S.kv.get('daily.wird', []); const today = dayKey(); const st = {}; for (const w of list) st[w.id] = await S.stat.get('wird:' + today + ':' + w.id);
    const sk = await streak(async (d) => { if (!list.length) return false; for (const w of list) if (!(await S.stat.get('wird:' + d + ':' + w.id))) return false; return true; });
    const wk = await week(async (d) => { let n = 0; for (const w of list) if (await S.stat.get('wird:' + d + ':' + w.id)) n++; return n; });
    return {
      title: 'الورد اليومي', nav: 'more', back: '/daily',
      html: S.h`<div class="stack"><div class="card"><div class="row between"><b>اليوم</b>${S.ui.badge('تتابع ' + S.n(sk) + ' يوم', sk ? 'ok' : '')}</div>${list.length ? list.map((w) => S.h`<div class="qd"><label class="check grow"><input type="checkbox" ${st[w.id] ? S.raw('checked') : ''} data-chg="wirdTick" data-id="${w.id}"><span>${w.title}</span></label><button class="btn xs danger" data-act="wirdDel" data-id="${w.id}" aria-label="حذف">${S.icon('trash')}</button></div>`) : S.h`<p class="small muted nm">لم تضف وردك بعد. اختر من القوالب أو اكتب بنفسك.</p>`}</div>
        ${weekBars(wk, Math.max(1, list.length))}
        <div class="card"><div class="card-t">${S.icon('plus')} إضافة إلى الورد</div><div class="chips">${WIRD_PRE.map(([t, k]) => S.h`<button class="chip" data-act="wirdAdd" data-t="${t}" data-k="${k}">${t}</button>`)}</div>${S.f.text('wt', 'ورد خاص', '', { placeholder: 'مثال: قراءة دعاء الصباح' })}<button class="btn block" data-act="wirdAdd">${S.icon('plus')} إضافة</button></div></div>`
    };
  });
  S.act('wirdAdd', async (el) => { const t = (el.dataset.t || S.$('#f_wt').value).trim(); if (!t) return S.toast('اكتب بند الورد', 'err'); const a = S.kv.get('daily.wird', []); if (a.some((x) => x.title === t)) return S.toast('البند موجود', 'err'); if (a.length >= 30) return S.toast('الحد 30 بنداً', 'err'); a.push({ id: S.uid('w'), title: t, kind: el.dataset.k || 'custom' }); await S.kv.set('daily.wird', a); S.router.refresh(); });
  S.act('wirdDel', async (el) => { if (await S.confirm('حذف البند من الورد؟', { danger: true })) { await S.kv.set('daily.wird', S.kv.get('daily.wird', []).filter((x) => x.id !== el.dataset.id)); S.router.refresh(); } });
  S.onChange('wirdTick', async (el) => { const k = 'wird:' + dayKey() + ':' + el.dataset.id; const cur = await S.stat.get(k); const rec = { id: k, n: el.checked ? 1 : 0, ts: Date.now() }; await S.db.put('stats', rec); if (el.checked) S.vibrate(15); S.router.refresh(); });

  /* ---------------- 2 و3: تحدي القراءة ---------------- */
  S.router.add('/daily/reading', async (p, q) => {
    if (q.preset) { const t = Math.max(1, Math.min(200, +q.preset || 10)); await S.kv.set('daily.readTarget', t); }
    const t = S.kv.get('daily.readTarget', 10); const today = await S.stat.get('read:' + dayKey()); const wk = await week((d) => S.stat.get('read:' + d)); const sk = await streak(async (d) => (await S.stat.get('read:' + d)) >= t);
    const tot = (await S.stat.all()).filter((r) => r.id.startsWith('read:')).reduce((a, r) => a + Math.max(0, r.n), 0); const last = S.progress.get('quran', 'last'); const lastBook = S.progress.last('book');
    return {
      title: 'تحدي القراءة اليومي', nav: 'more', back: '/daily',
      html: S.h`<div class="stack"><div class="card"><div class="row between"><div><b>اليوم: ${S.n(today)} من ${S.n(t)} صفحة</b><div class="small muted">تتابع ${S.n(sk)} يوم • الإجمالي ${S.n(tot)} صفحة</div></div>${S.ui.ring(Math.min(100, today / t * 100))}</div>
        <div class="grid3 mt"><button class="btn" data-act="rdAdd" data-n="1" dir="ltr">+${S.n(1)}</button><button class="btn" data-act="rdAdd" data-n="5" dir="ltr">+${S.n(5)}</button><button class="btn primary" data-act="rdAdd" data-n="10" dir="ltr">+${S.n(10)}</button></div><button class="btn block mt-s ghost" data-act="rdAdd" data-n="-1">تراجع صفحة</button>${q.preset ? S.ui.notice('ok', 'تم ضبط الهدف', 'الهدف اليومي الآن ' + S.n(t) + ' صفحات.') : ''}</div>
        ${weekBars(wk, Math.max(t, ...wk.map((x) => x.n)))}
        <div class="card">${S.f.text('rtg', 'الهدف اليومي (صفحات)', t, { type: 'number', ltr: true, min: 1, max: 200 })}<div class="grid2"><button class="btn" data-act="rdTarget">حفظ الهدف</button><a class="btn" href="#/daily/reading?preset=10">عشر صفحات يومياً</a></div></div>
        <div class="card"><div class="card-t">${S.icon('book-open')} تابع من حيث توقفت</div>${last ? S.h`<a class="li" href="#/quran/surah/${last.pos.s}?a=${last.pos.a}"><span class="li-body"><span class="li-t">القرآن: سورة ${S.quran.surahName(last.pos.s)} آية ${S.n(last.pos.a)}</span></span>${S.icon('chevron-left')}</a>` : ''}${lastBook && L().byId.get(lastBook.ref) ? S.h`<a class="li" href="#/library/book/${lastBook.ref}"><span class="li-body"><span class="li-t">${L().byId.get(lastBook.ref).title}</span></span>${S.icon('chevron-left')}</a>` : ''}${!last && !lastBook ? S.h`<p class="small muted nm">لم تبدأ قراءة بعد.</p>` : ''}<p class="tiny muted nm">العدّاد يدوي: سجّل ما قرأته بنفسك. لا يُحتسب تلقائياً حتى لا تُسجَّل صفحات لم تقرأها.</p></div></div>`
    };
  });
  S.act('rdAdd', async (el) => { const k = 'read:' + dayKey(); const cur = await S.stat.get(k); const v = Math.max(0, cur + (+el.dataset.n)); await S.db.put('stats', { id: k, n: v, ts: Date.now() }); S.vibrate(15); const t = S.kv.get('daily.readTarget', 10); if (cur < t && v >= t) { S.toast('أتممت هدف اليوم', 'ok'); S.notify.add({ title: 'أتممت تحدي القراءة اليوم', body: S.n(v) + ' صفحة', kind: 'info' }); } S.router.refresh(); });
  S.act('rdTarget', async () => { const v = Math.floor(+S.$('#f_rtg').value); if (!(v >= 1 && v <= 200)) return S.toast('الهدف بين 1 و200', 'err'); await S.kv.set('daily.readTarget', v); S.toast('حُفظ', 'ok'); S.router.refresh(); });

  /* ---------------- 6: الأعمال المستحبة ---------------- */
  S.router.add('/daily/mustahabb', async () => {
    const all = S.data.sample.mustahabb.concat(S.kv.get('daily.mustahabb.custom', [])); const today = dayKey(); const st = []; for (let i = 0; i < all.length; i++) st.push(await S.stat.get('must:' + today + ':' + i));
    const wk = await week(async (d) => { let n = 0; for (let i = 0; i < all.length; i++) if (await S.stat.get('must:' + d + ':' + i)) n++; return n; }); const sk = await streak(async (d) => { for (let i = 0; i < all.length; i++) if (await S.stat.get('must:' + d + ':' + i)) return true; return false; });
    return {
      title: 'سجل الأعمال المستحبة', nav: 'more', back: '/daily',
      html: S.h`<div class="stack">${S.ui.tip('info', 'سجلّك الخاص', 'تسجّل هنا ما فعلته أنت. أحكام الاستحباب والتفاصيل تؤخذ من رسالة مرجعك.')}<div class="card"><div class="row between"><b>اليوم</b>${S.ui.badge('تتابع ' + S.n(sk) + ' يوم', sk ? 'ok' : '')}</div>${all.map((t, i) => S.h`<label class="check"><input type="checkbox" ${st[i] ? S.raw('checked') : ''} data-chg="mustTick" data-i="${i}"><span>${t}</span></label>`)}</div>${weekBars(wk, Math.max(1, all.length))}
        <div class="card">${S.f.text('mc', 'إضافة عمل مستحب خاص بك', '', {})}<button class="btn block" data-act="mustAdd">${S.icon('plus')} إضافة</button></div></div>`
    };
  });
  S.onChange('mustTick', async (el) => { await S.db.put('stats', { id: 'must:' + dayKey() + ':' + el.dataset.i, n: el.checked ? 1 : 0, ts: Date.now() }); if (el.checked) S.vibrate(15); S.router.refresh(); });
  S.act('mustAdd', async () => { const t = S.$('#f_mc').value.trim(); if (!t) return S.toast('اكتب العمل', 'err'); const a = S.kv.get('daily.mustahabb.custom', []); a.push(t); await S.kv.set('daily.mustahabb.custom', a); S.router.refresh(); });

  /* ---------------- 7: أهداف الذكر ---------------- */
  S.router.add('/daily/dhikr', async () => {
    const ts = await S.tasbeeh.summary(); const dg = S.kv.get('tasbeeh.dailyGoal', 0);
    return { title: 'أهداف الذكر اليومية', nav: 'more', back: '/daily', html: S.h`<div class="stack"><div class="card"><div class="row between"><div><b>اليوم: ${S.n(ts.today)}${dg ? ' من ' + S.n(dg) : ''}</b><div class="small muted">تتابع ${S.n(ts.streak)} يوم • آخر 30 يوماً ${S.n(ts.month)}</div></div>${dg ? S.ui.ring(Math.min(100, ts.today / dg * 100)) : ''}</div></div>${weekBars(ts.week.map((w) => ({ l: w.l, n: w.n })), Math.max(dg, ...ts.week.map((w) => w.n)))}<div class="card">${S.f.text('dg', 'هدف الذكر اليومي (تسبيحة)', dg || '', { type: 'number', ltr: true, min: 0 })}<button class="btn block" data-act="dgSave">حفظ الهدف</button></div><a class="btn primary block" href="#/tasbeeh">${S.icon('beads')} فتح المسبحة</a></div>` };
  });
  S.act('dgSave', async () => { const v = Math.floor(+S.$('#f_dg').value || 0); if (!(v >= 0 && v <= 100000)) return S.toast('هدف غير صالح', 'err'); await S.kv.set('tasbeeh.dailyGoal', v); S.toast('حُفظ', 'ok'); S.router.refresh(); });

  /* ---------------- 8: أذكار الصباح والمساء ---------------- */
  S.router.add('/daily/adhkar', async (p, q) => {
    const ds = (await S.db.all('duas')).filter((d) => d.textStatus === 'documented' && d.text); const m = ds.filter((d) => /صباح/.test(d.title)), e = ds.filter((d) => /مساء/.test(d.title)); const cat = ds.filter((d) => d.cat === 'daily' && !m.includes(d) && !e.includes(d));
    const card = (d) => S.h`<a class="li" href="#/duas/item/${d.id}"><span class="li-body"><span class="li-t">${d.title}</span><span class="li-s">${(d.textSource || {}).book || ''}</span></span>${S.icon('chevron-left')}</a>`;
    return {
      title: 'أذكار الصباح والمساء', nav: 'more', back: '/daily',
      html: S.h`<div class="stack">${S.ui.tip('info', 'من الأدعية الموثقة فقط', 'لا يكتب سِراج أذكاراً من عنده. تظهر هنا العناصر التي وصلت بنصها ومصدرها وطبعتها.')}
        ${[['sun', 'الصباح', m], ['moon', 'المساء', e]].map(([ic, t, l]) => S.h`<div class="card"><div class="card-t">${S.icon(ic)} ${t}</div>${l.length ? l.map(card) : S.h`<p class="small muted nm">لم يُضَف بعد نص موثق لأذكار ${t}. (يصل المحتوى الموثق عبر «تحديثات المحتوى».)</p>`}</div>`)}
        ${cat.length ? S.h`<div class="card"><div class="card-t">${S.icon('heart-handshake')} أدعية يومية موثقة</div>${cat.map(card)}</div>` : ''}<a class="btn block" href="#/daily/reminders">${S.icon('bell')} ضبط تذكير</a></div>`
    };
  });

  /* ---------------- 9: تنبيهات قراءة الأدعية (والتطبيق مفتوح) ---------------- */
  const PERM = () => (window.Notification ? Notification.permission : 'unsupported');
  S.router.add('/daily/reminders', async (p, q) => {
    const list = S.kv.get('daily.reminders', []); const duas = (await S.db.all('duas')).filter((d) => d.textStatus === 'documented'); const pre = q.dua ? duas.find((d) => d.id === q.dua) : null;
    return {
      title: 'تنبيهات قراءة الأدعية', nav: 'more', back: '/daily',
      html: S.h`<div class="stack">${(S.nativeNotify && S.nativeNotify.available() ? S.ui.tip('info', 'تصلك كإشعارات نظام', 'تُجدول التنبيهات على هاتفك عبر منبّه أندرويد فتصل والتطبيق مغلق، بشرط السماح بالإشعارات (زر «السماح بإشعارات النظام» أدناه أو من إعدادات الصلاة). لا يوجد خادم؛ كل شيء يُحسب على جهازك.') : S.ui.tip('warn', 'تعمل والتطبيق مفتوح', 'المتصفح لا يسمح لصفحة مغلقة بإطلاق تنبيه من تلقاء نفسها دون خادم دفع (Push)، وهو غير مربوط هنا. التنبيه يظهر داخل التطبيق (وكإشعار نظام إن سمحتَ) ما دام التطبيق مفتوحاً في الخلفية أو الواجهة. ثبّت تطبيق أندرويد لتصلك والتطبيق مغلق.'))}
        <div class="card"><div class="card-t">${S.icon('plus')} تنبيه جديد</div>${S.f.text('rt', 'العنوان', pre ? 'قراءة: ' + pre.title : '', { placeholder: 'مثال: دعاء الصباح' })}${S.f.text('rh', 'الوقت', '07:00', { type: 'time', ltr: true })}${S.f.select('rd', 'الدعاء (اختياري)', [{ v: '', t: '— بلا —' }].concat(duas.map((d) => ({ v: d.id, t: d.title }))), pre ? pre.id : '')}<div class="chips" id="rdays">${['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((d, i) => S.h`<label class="chip"><input type="checkbox" name="day${i}" checked> ${d}</label>`)}</div><button class="btn primary block mt" data-act="remAdd">${S.icon('bell')} إضافة</button></div>
        ${list.length ? list.map((r) => S.h`<div class="card"><div class="row between"><b>${r.title}</b><label class="switch"><input type="checkbox" ${r.enabled ? S.raw('checked') : ''} data-chg="remTog" data-id="${r.id}"><i></i></label></div><div class="small muted">${S.n(r.time)} • ${r.days.map((d) => ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d]).join('، ')}</div><button class="btn xs danger mt-s" data-act="remDel" data-id="${r.id}">حذف</button></div>`) : S.ui.empty('bell', 'لا تنبيهات')}
        <div class="card"><div class="kv"><span>إشعارات النظام</span><b>${({ granted: 'مسموحة', denied: 'محظورة', default: 'لم يُطلب', unsupported: 'غير مدعومة' })[PERM()]}</b></div>${PERM() === 'default' ? S.h`<button class="btn block mt-s" data-act="notifPerm">${S.icon('bell')} السماح بإشعارات النظام</button>` : ''}</div></div>`
    };
  });
  S.act('remAdd', async () => { const d = S.f.read(S.$('#view')); if (!d.rt.trim()) return S.toast('اكتب العنوان', 'err'); if (!/^\d{2}:\d{2}$/.test(d.rh)) return S.toast('الوقت غير صالح', 'err'); const days = [0, 1, 2, 3, 4, 5, 6].filter((i) => d['day' + i]); if (!days.length) return S.toast('اختر يوماً واحداً على الأقل', 'err'); const a = S.kv.get('daily.reminders', []); if (a.length >= 20) return S.toast('الحد 20 تنبيهاً', 'err'); a.push({ id: S.uid('r'), title: d.rt.trim(), time: d.rh, days, dua: d.rd || '', enabled: true }); await S.kv.set('daily.reminders', a); if (S.nativeNotify) S.nativeNotify.later(200); S.toast('أُضيف التنبيه', 'ok'); S.router.refresh(); });
  S.act('remDel', async (el) => { await S.kv.set('daily.reminders', S.kv.get('daily.reminders', []).filter((r) => r.id !== el.dataset.id)); if (S.nativeNotify) S.nativeNotify.later(200); S.router.refresh(); });
  S.onChange('remTog', async (el) => { const a = S.kv.get('daily.reminders', []); const r = a.find((x) => x.id === el.dataset.id); if (r) { r.enabled = el.checked; await S.kv.set('daily.reminders', a); if (S.nativeNotify) S.nativeNotify.later(200); } });
  function tick() {
    const now = new Date(); const hm = S.fmt.pad(now.getHours()) + ':' + S.fmt.pad(now.getMinutes()); const key = dayKey() + ' ' + hm; const a = S.kv.get('daily.reminders', []); if (!a.length) return; if (S.nativeNotify && S.nativeNotify.active()) return; /* إشعار النظام يتولّى الأمر */ const fired = S.kv.get('daily.fired', {});
    a.forEach((r) => { if (r.enabled && r.time === hm && r.days.includes(now.getDay()) && fired[r.id] !== key) { fired[r.id] = key; S.kv.set('daily.fired', fired); const body = r.dua ? 'حان وقت قراءة الدعاء' : 'حان وقت تنبيهك'; S.toast(r.title + ' — ' + body, 'ok'); S.notify.add({ title: r.title, body, kind: 'dua', href: r.dua ? '/duas/item/' + r.dua : '' }); S.vibrate([120, 60, 120]); try { if (PERM() === 'granted') new Notification(r.title, { body, icon: 'assets/images/icon-192.png', tag: 'siraj-rem-' + r.id }); } catch (e) { /* قيد منصة */ } } });
  }

  /* ---------------- 10: هدية كتاب رقمي ---------------- */
  S.router.add('/daily/gift', () => {
    const ok = L().published().filter((b) => b.hasPdf && b.allowDownload && S.schema.copyOk(b.copyright)); const pick = ok.length ? ok[S.dayIdx() % ok.length] : null;
    return {
      title: 'هدية اليوم', nav: 'more', back: '/daily',
      html: S.h`<div class="stack">${pick ? S.h`<div class="card gold-edge"><div class="small gold">هدية اليوم</div><b class="q-name">${pick.title}</b><div class="small muted">${pick.author}</div><div class="tiny muted">الرخصة: ${pick.copyright}</div><div class="grid2 mt"><a class="btn primary" href="#/library/book/${pick.id}">${S.icon('book-open')} فتح الكتاب</a><button class="btn" data-act="bookDownload" data-id="${pick.id}">${S.icon('download')} تنزيل</button></div></div>` : S.ui.empty('heart', 'لا هدية اليوم', 'تظهر هدايا الكتب فقط للكتب التي رُفع ملفها وكانت رخصتها (ملك عام/Creative Commons/بإذن) تسمح بالنشر والتنزيل. لا توجد كتب بهذه الشروط حالياً.')}
        ${S.ui.tip('info', 'قاعدة الهدايا', 'لا يُهدي سِراج ملفاً لا يملك ترخيصاً موثقاً بنشره.')}</div>`
    };
  });

  /* ---------------- 11: المكتبة الصوتية ---------------- */
  S.router.add('/daily/audio', async () => {
    const rows = (await S.db.all('audiolib')).sort((a, b) => b.ts - a.ts); const urls = rows.map((r) => (r.blob ? URL.createObjectURL(r.blob) : null)); const au = await S.db.count('audio');
    return {
      title: 'المكتبة الصوتية', nav: 'more', back: '/daily',
      html: S.h`<div class="stack">${rows.length ? rows.map((r, i) => S.h`<div class="card"><b>${r.title}</b><div class="small muted">${r.by || ''} • ${({ recitation: 'تلاوة', dua: 'دعاء/زيارة', lecture: 'محاضرة', adhan: 'أذان' })[r.kind] || r.kind}</div><audio controls preload="none" src="${urls[i]}" style="width:100%;margin-top:6px"></audio><div class="tiny muted">الترخيص: ${r.license}</div></div>`) : S.ui.empty('volume', 'لا تسجيلات بعد', 'تظهر هنا تسجيلاتك الصوتية، مثل الأذان المخصص الذي تضيفه من إعدادات مواقيت الصلاة.')}
        <div class="card"><div class="kv"><span>تلاوات قرآنية منزَّلة على جهازك</span><b>${S.n(au)}</b></div><a class="btn block mt-s" href="#/quran/download">إدارة التنزيلات</a></div></div>`,
      unmount() { urls.forEach((u) => u && URL.revokeObjectURL(u)); }
    };
  });

  /* ---------------- 12: تحويل النص إلى صوت ---------------- */
  /* يمرّ عبر S.tts: إضافة المحرك الأصلي في تطبيق أندرويد، وspeechSynthesis في المتصفح */
  let voices = [];
  const loadVoices = () => { try { voices = S.tts.mode() === 'web' ? speechSynthesis.getVoices() : []; } catch (e) { voices = []; } };
  S.router.add('/daily/tts', async () => {
    loadVoices(); const mode = S.tts.mode(); const supported = mode !== 'none'; const ar = voices.filter((v) => /^ar/i.test(v.lang)); const duas = (await S.db.all('duas')).filter((d) => d.textStatus === 'documented' && d.text);
    const hasAr = mode === 'native' ? await S.tts.hasArabic() : null;
    const status = !supported ? S.ui.notice('err', 'القراءة الآلية غير متاحة', 'هذا الجهاز لا يوفّر محرك قراءة. ثبّت «خدمات الكلام من Google» (Speech Services by Google) من متجر Play ثم أعد فتح التطبيق.')
      : mode === 'native' ? (hasAr === false ? S.ui.notice('warn', 'لا صوت عربي على جهازك', 'ثبّت الصوت العربي من إعدادات الهاتف ← تحويل النص إلى كلام، ثم أعد المحاولة. بدونه قد ينطق الجهاز بلغة أخرى فيُخطئ.') : S.ui.notice('ok', 'القراءة الآلية جاهزة', 'تستعمل محرك الكلام في هاتفك، ويُحدَّد الصوت من إعدادات الهاتف.'))
      : ar.length ? S.ui.notice('ok', 'أصوات عربية متاحة', 'عدد الأصوات العربية على جهازك: ' + S.n(ar.length)) : S.ui.notice('warn', 'لا صوت عربي على جهازك', 'ثبّت صوتاً عربياً من إعدادات النظام (تحويل النص إلى كلام/Text-to-speech) ثم أعد فتح الصفحة. قد يقرأ الجهاز بلغة أخرى فيُخطئ النطق.');
    const voiceField = mode === 'web' ? S.f.select('tv', 'الصوت', [{ v: '', t: 'الافتراضي' }].concat(ar.map((v) => ({ v: v.name, t: v.name + ' (' + v.lang + ')' }))), ar[0] ? ar[0].name : '') : '';
    return {
      title: 'تحويل النص إلى صوت', nav: 'more', back: '/daily',
      html: S.h`<div class="stack">${status}
        ${S.ui.tip('info', 'تنبيه', 'القراءة الاصطناعية للنصوص العامة والأدعية للمساعدة فقط. لا يُنصح بها لتلاوة القرآن: استعمل التلاوات المسجلة.')}
        <div class="card">${duas.length ? S.f.select('tdua', 'من الأدعية الموثقة', [{ v: '', t: '— اختر دعاءً —' }].concat(duas.map((d) => ({ v: d.id, t: d.title }))), '', { chg: 'ttsPick' }) : ''}${S.f.area('tt', 'النص', '', { rows: 6 })}${voiceField}<div class="grid2">${S.f.text('tr', 'السرعة', 0.9, { type: 'number', ltr: true, step: 0.1, min: 0.5, max: 2 })}${S.f.text('tp', 'النبرة', 1, { type: 'number', ltr: true, step: 0.1, min: 0.5, max: 2 })}</div><div class="grid2"><button class="btn primary" data-act="ttsPlay">${S.icon('play')} قراءة</button><button class="btn" data-act="ttsStop">إيقاف</button></div></div></div>`,
      mount() { if (mode === 'web') { try { speechSynthesis.onvoiceschanged = () => { if (S.router.cur.path === '/daily/tts' && !S.$('#f_tt').value) { const n = speechSynthesis.getVoices().length; if (n !== voices.length) S.router.refresh(); } }; } catch (e) { /* */ } } },
      unmount() { S.tts.stop(); }
    };
  });
  S.onChange('ttsPick', async (el) => { if (!el.value) return; const d = await S.db.get('duas', el.value); S.$('#f_tt').value = d ? d.text : ''; });
  S.act('ttsPlay', () => {
    const t = S.$('#f_tt').value.trim(); if (!t) return S.toast('اكتب النص أو اختر دعاءً', 'err');
    if (!S.tts.supported()) return S.toast('هذا الجهاز لا يوفّر قراءة آلية. ثبّت «خدمات الكلام من Google» من متجر Play.', 'err');
    const vEl = S.$('#f_tv'); const v = vEl ? voices.find((x) => x.name === vEl.value) : null;
    S.tts.speak(t, { voice: v, rate: S.clamp(+S.$('#f_tr').value || 0.9, 0.5, 2), pitch: S.clamp(+S.$('#f_tp').value || 1, 0.5, 2) }).catch((e) => { if (e && e.message !== 'unsupported') S.toast('تعذّرت القراءة الآلية على هذا الجهاز', 'err'); });
  });
  S.act('ttsStop', () => { S.tts.stop(); });

  /* ---------------- 13: مزامنة التقدم ---------------- */
  S.router.add('/daily/sync', async () => {
    const pr = (await S.db.all('progress')).length; const bm = (await S.db.all('bookmarks')).length; const nt = (await S.db.all('notes')).length;
    return {
      title: 'مزامنة تقدم القراءة', nav: 'more', back: '/daily',
      html: S.h`<div class="stack"><div class="card"><div class="card-t">${S.icon('database')} محفوظ على جهازك</div><div class="kv"><span>مواضع القراءة</span><b>${S.n(pr)}</b></div><div class="kv"><span>العلامات المرجعية</span><b>${S.n(bm)}</b></div><div class="kv"><span>الملاحظات والتدبّرات</span><b>${S.n(nt)}</b></div></div>
        <div class="card"><div class="card-t">${S.icon('download')} الحل المتاح الآن</div><p class="small nm">صدِّر نسخة احتياطية من «الإعدادات» وانقلها إلى جهازك الآخر ثم استعدها هناك.</p><a class="btn block mt-s" href="#/settings">${S.icon('settings')} النسخ الاحتياطي والاستعادة</a></div></div>`
    };
  });

  /* ---------------- 15: إشعارات المناسبات ---------------- */
  S.router.add('/daily/occasions', () => {
    const up = S.calendar.upcoming(6);
    return { title: 'إشعارات المناسبات', nav: 'more', back: '/daily', html: S.h`<div class="stack"><div class="card"><div class="setting"><div class="sd">تنبيه المناسبات<small>يظهر في الإشعارات قبل المناسبة بيوم وفي يومها (إشعار نظام في تطبيق أندرويد)</small></div><label class="switch"><input type="checkbox" ${S.settings.notifyOcc ? S.raw('checked') : ''} data-chg="pref" data-k="notifyOcc"><i></i></label></div></div>${S.ui.notice('info', 'ملاحظة', 'التواريخ بحسب التقويم الهجري المختار في الإعدادات، وقد تختلف بيوم عن رؤية مرجعك؛ اضبط «إزاحة الهجري» عند الحاجة.')}<div class="list">${up.map((x) => S.h`<div class="li"><span class="li-body"><span class="li-t">${x.occ.title}</span><span class="li-s">${S.fmt.gdate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span></span><span class="li-end">${x.days === 0 ? 'اليوم' : 'بعد ' + S.n(x.days) + ' يوم'}</span></div>`)}</div><a class="btn block" href="#/calendar/occasions">كل المناسبات</a></div>` };
  });

  S.daily = { init() { loadVoices(); setInterval(tick, 20000); setTimeout(tick, 3000); }, streak, tick };
})();

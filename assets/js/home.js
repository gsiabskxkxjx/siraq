/* =====================================================================
   سِراج — home.js : الصفحة الرئيسية، «المزيد»، الإشعارات
   لا شيء هنا مُختلَق: كل بطاقة تعرض بياناتها الحقيقية أو حالة فراغ صريحة تقول ما ينقص وكيف يُضاف.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const dayIdx = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); };
  S.dayIdx = dayIdx;

  function greeting() {
    const h = new Date().getHours();
    const g = h < 5 ? 'ليلة مباركة' : h < 12 ? 'صباح النور' : h < 17 ? 'طاب يومك' : h < 20 ? 'مساء الخير' : 'مساء النور';
    return g + (S.settings.userName ? '، ' + S.settings.userName : '');
  }

  /* مرجع آية اليوم: رقم عام مشتق من التاريخ، يُحوَّل إلى سورة:آية بحسب عدّ الآيات الموثق في البيانات */
  function verseRefOfDay() {
    const surahs = S.data.quran.surahs; const total = S.data.quran.totalAyahs;
    let g = (dayIdx() * 97 + 13) % total; // خطوة أولية مع الإزاحة: توزيع متفرق لا يتكرر قريباً
    for (const s of surahs) { if (g < s.ayahs) return { s: s.n, a: g + 1, name: s.name }; g -= s.ayahs; }
    return { s: 1, a: 1, name: surahs[0].name };
  }

  async function verseCard() {
    const r = verseRefOfDay(); const Q = S.quran; let text = null;
    try { if (Q && Q.hasText && Q.hasText()) text = Q.ayah(r.s, r.a); } catch (e) { /* */ }
    const head = S.h`<div class="card-t">${S.icon('book-open')} آية اليوم <span class="muted small">— سورة ${r.name} • ${S.n(r.a)}</span></div>`;
    if (text) {
      const tr = (S.settings.showTranslation && Q.translationAyah) ? Q.translationAyah(r.s, r.a) : '';
      return S.h`<div class="card verse-card">${head}<div class="q-inline">${text} <span class="ayah-end">${S.arNum(r.a)}</span></div>${tr ? S.h`<p class="small muted center" dir="ltr">${tr}</p>` : ''}<div class="row between"><a class="btn sm" href="#/quran/surah/${r.s}?a=${r.a}">${S.icon('book-open')} اقرأ في السياق</a><button class="btn sm ghost" data-act="shareVerse" data-s="${r.s}" data-a="${r.a}">${S.icon('share')} مشاركة</button></div></div>`;
    }
    return S.h`<div class="card verse-card">${head}<p class="small muted nm">نص القرآن لم يُحمَّل بعد على هذا الجهاز. لا يتضمن سِراج نصاً قرآنياً مكتوباً يدوياً؛ يُحمَّل المصحف مرة واحدة من مصدر موثق (مشروع Tanzil) ثم يعمل دون إنترنت.</p><a class="btn gold block" href="#/quran/download">${S.icon('download')} تحميل المصحف الشريف</a></div>`;
  }
  S.act('shareVerse', async (el) => { const Q = S.quran; const s = +el.dataset.s, a = +el.dataset.a; if (Q && Q.shareImage) return Q.shareImage(s, a); });

  async function duaCard() {
    const all = await S.db.all('duas'); const ok = all.filter((d) => d.textStatus === 'documented' && d.text);
    if (ok.length) {
      const d = ok[dayIdx() % ok.length];
      return S.h`<div class="card"><div class="card-t">${S.icon('heart-handshake')} دعاء اليوم</div><b>${d.title}</b><p class="small muted nm">${(d.textSource && d.textSource.book) || d.commonSource || ''}</p><a class="btn sm" href="#/duas/item/${d.id}">قراءة الدعاء</a></div>`;
    }
    return S.h`<div class="card"><div class="card-t">${S.icon('heart-handshake')} دعاء اليوم</div><p class="small muted nm">لا توجد نصوص أدعية موثقة في هذه النسخة بعد (فهرس الأدعية يحتوي العناوين فقط). عند إضافة نص موثق بمصدره وطبعته يظهر هنا يومياً.</p><a class="btn sm" href="#/duas">فهرس الأدعية والزيارات</a></div>`;
  }
  async function hadithCard() {
    const rows = (await S.db.where('entries', 'collection', 'narrations')).filter((e) => (e.sources || []).length && e.text);
    if (rows.length) {
      const e = rows[dayIdx() % rows.length]; const src = e.sources[0];
      return S.h`<div class="card"><div class="card-t">${S.icon('scroll')} حديث اليوم</div><div class="quote-text">${e.text}</div><p class="small muted nm">المصدر: ${src.book}${src.part ? ' • ج' + src.part : ''}${src.page ? ' • ص' + src.page : ''}${src.number ? ' • رقم ' + src.number : ''}</p><a class="btn sm" href="#/research/narrations/${e.id}">التفاصيل والتخريج</a></div>`;
    }
    return S.h`<div class="card"><div class="card-t">${S.icon('scroll')} حديث اليوم</div><p class="small muted nm">لا توجد روايات موثقة في الموسوعة بعد. لا يُنشئ سِراج أحاديث من عنده؛ أضِف رواية مع مصدرها (الكتاب والجزء والصفحة) من «موسوعة الأبحاث» لتظهر هنا.</p><a class="btn sm" href="#/research/narrations">موسوعة الروايات</a></div>`;
  }
  function dhikrCard() {
    const list = S.data.sample.dhikr; const d = list[dayIdx() % list.length];
    return S.h`<div class="card"><div class="card-t">${S.icon('beads')} ذكر اليوم</div><b>${d.title}</b><p class="small muted nm">${d.phases.map((p) => p.t + ' × ' + S.n(p.n)).join(' • ')}</p><a class="btn sm" href="#/tasbeeh?preset=${d.id}">ابدأ التسبيح</a></div>`;
  }

  function khatmaCard() {
    const k = S.quran && S.quran.khatma ? S.quran.khatma() : null;
    if (!k || !k.plan) return S.h`<div class="card"><div class="card-t">${S.icon('target')} ختمة القرآن</div><p class="small muted nm">لم تبدأ ختمة بعد. اختر خطة 30 يوماً أو 7 أيام ويُحسب تقدّمك تلقائياً مما تقرؤه.</p><a class="btn sm primary" href="#/quran/khatma">ابدأ ختمة</a></div>`;
    return S.h`<a class="card tap" href="#/quran/khatma"><div class="row"><div>${S.ui.ring(k.pct)}</div><div class="grow"><div class="card-t" style="margin:0">${S.icon('target')} ختمتك (${k.plan === 30 ? '30 يوماً' : '7 أيام'})</div><div class="small muted">اليوم ${S.n(k.dayNo)} من ${S.n(k.plan)} • ${S.n(k.readAyahs)} آية من ${S.n(6236)}</div><div class="small">${k.todayLabel || ''}</div></div></div></a>`;
  }

  async function nextPrayerBlock() {
    const P = S.prayer; const loc = P && P.loc();
    if (!loc) return S.h`<div class="next-prayer"><div><div class="small muted">مواقيت الصلاة</div><div>حدّد مدينتك لحساب المواقيت</div></div><a class="btn sm gold" href="#/prayer/location">${S.icon('map-pin')} الموقع</a></div>`;
    const nx = P.next(); if (!nx) return '';
    return S.h`<a class="next-prayer" href="#/prayer" style="color:inherit"><div><div class="small" style="opacity:.8">الصلاة القادمة • ${loc.name}</div><div class="np-n">${nx.name}</div><div class="small" style="opacity:.85">${nx.time}</div></div><div class="np-c" data-countdown>${S.fmt.hm(nx.at - new Date())}</div></a>`;
  }
  function prayerStrip() {
    const P = S.prayer; if (!P || !P.loc()) return '';
    const t = P.times(); const nx = P.next();
    return S.h`<div class="card"><div class="card-t">${S.icon('clock')} أوقات اليوم</div><div class="ptimes">${P.FIVE.map(([k, n]) => S.h`<div class="pt ${nx && nx.key === k && nx.today && nx.today.day.d === t.day.d ? 'next' : ''}"><b>${n}</b><span>${P.fmtHours(t.hours[k])}</span></div>`)}</div><p class="tiny muted nm">حساب فلكي بطريقة ${P.METHODS[S.settings.calcMethod].name.split('(')[0].trim()} — <a href="#/prayer/settings">الإعدادات</a></p></div>`;
  }

  function occasionsCard() {
    const C = S.calendar; if (!C) return '';
    const list = C.upcoming(4); if (!list.length) return '';
    return S.h`<div class="card"><div class="card-t">${S.icon('calendar')} مناسبات قادمة</div><div class="list" style="border:0">${list.map((o) => S.h`<a class="li" href="#/calendar/occasions"><span class="li-body"><span class="li-t">${o.occ.title}</span><span class="li-s">${S.n(o.occ.d)} ${S.data.sample.hijriMonths[o.occ.m - 1]} • ${S.fmt.gdate(o.date, { day: 'numeric', month: 'long' })}</span></span><span class="li-end">${o.days === 0 ? 'اليوم' : o.days === 1 ? 'غداً' : 'بعد ' + S.n(o.days) + ' يوماً'}</span></a>`)}</div><p class="tiny muted nm">تواريخ مشهورة؛ قد يختلف بعضها بحسب الرؤية والمصدر. راجع مرجعك للأحكام.</p></div>`;
  }

  const QUICK = [
    ['book-open', 'القرآن', '/quran'], ['heart-handshake', 'الأدعية', '/duas'], ['library', 'المكتبة', '/library'], ['beads', 'المسبحة', '/tasbeeh'],
    ['compass', 'القبلة', '/qibla'], ['calendar', 'التقويم', '/calendar'], ['network', 'الموسوعات', '/research'], ['sparkle', 'مساعد سِراج', '/assistant']
  ];

  S.router.add('/home', async () => {
    const L = S.library; const now = new Date();
    const [vc, dc, hc, nb, notes] = await Promise.all([verseCard(), duaCard(), hadithCard(), nextPrayerBlock(), S.notify.list()]);
    const last = S.progress.last('book'); const lastBook = last && L.byId.get(last.ref);
    const lastQ = S.progress.last('quran');
    const recent = L.published().slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')).slice(0, 8);
    const rec = L.recommended(3);
    const cnt = L.countBySection();
    return {
      title: 'سِراج', nav: 'home', back: false, bar: false,
      html: S.h`<div class="stack">
        <div class="hero">
          <div class="row between"><div class="brand"><img src="assets/images/logo-mark.png" alt="" width="46" height="46"><div><b>سِراج</b><small>نور العلم وهداية الطريق</small></div></div>
            <div class="row"><button class="iconbtn" data-act="toggleTheme" aria-label="${S.theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}">${S.icon(S.theme === 'dark' ? 'sun' : 'moon')}</button><a class="iconbtn" href="#/notifications" aria-label="الإشعارات" style="position:relative">${S.icon('bell')}<span class="dot" data-bell hidden></span></a><a class="iconbtn" href="#/settings" aria-label="الإعدادات">${S.icon('settings')}</a></div></div>
          <div class="greet mt">${greeting()}</div>
          <div class="dates"><span class="dchip">${S.icon('moon')} ${S.hijriStr(now)}</span><span class="dchip">${S.fmt.gdate(now)}</span></div>
          ${nb}
        </div>
        ${prayerStrip()}
        ${S.h`<div class="quick">${QUICK.map(([ic, t, h]) => S.h`<a class="qk" href="#${h}">${S.icon(ic)}<span>${t}</span></a>`)}</div>`}
        ${lastQ || lastBook ? S.h`<div class="grid2">${lastQ ? S.h`<a class="card tap" href="#/quran/surah/${lastQ.pos.s}?a=${lastQ.pos.a}"><div class="small muted">آخر قراءة في القرآن</div><b>${(S.data.quran.surahs[lastQ.pos.s - 1] || {}).name}</b><div class="small">آية ${S.n(lastQ.pos.a)}</div></a>` : ''}${lastBook ? S.h`<a class="card tap" href="#/library/book/${lastBook.id}"><div class="small muted">آخر كتاب</div><b>${lastBook.title}</b><div class="small">${last.page ? 'صفحة ' + S.n(last.page) : lastBook.author}</div></a>` : ''}</div>` : ''}
        ${khatmaCard()}
        ${vc}
        ${dc}${hc}${dhikrCard()}
        ${occasionsCard()}
        ${S.ui.sectionTitle('أقسام المكتبة', '#/library')}
        <div class="chips">${S.sections.map((s) => S.h`<a class="chip" href="#/library/sec/${s.id}">${S.icon(S.hasIcon(s.icon) ? s.icon : 'book-open')} ${s.title} <small>(${S.n(cnt[s.id] || 0)})</small></a>`)}</div>
        ${recent.length ? S.h`${S.ui.sectionTitle('كتب أُضيفت حديثاً', '#/library/search?sort=recent')}<div class="hscroll">${recent.map(L.card)}</div>` : ''}
        ${rec.books.length ? S.h`${S.ui.sectionTitle('اقتراحات القراءة اليومية', '#/library/recommended')}<div class="stack s">${rec.books.map(L.row)}</div>` : ''}
        ${notes.length ? S.h`${S.ui.sectionTitle('آخر الإشعارات', '#/notifications')}<div class="list">${notes.slice(0, 3).map((n) => S.h`<div class="li"><span class="li-body"><span class="li-t">${n.title}</span><span class="li-s">${n.body || ''}</span></span><span class="li-end tiny">${S.fmt.dt(n.ts)}</span></div>`)}</div>` : ''}
        <p class="tiny muted center">الإصدار ${S.version} — <a href="#/status">حالة التطبيق</a> • <a href="#/about">عن سِراج</a></p>
      </div>`,
      mount() { if (!S.settings.onboarded) onboarding(); }
    };
  });

  function onboarding() {
    S.modal({
      title: 'أهلاً بك في سِراج', persistent: true,
      body: S.h`<p class="small">لتهيئة التطبيق (كل شيء اختياري ويُحفظ في جهازك فقط):</p>
        ${S.f.text('uname', 'اسمك (يظهر في التحية)', S.settings.userName, { placeholder: 'اختياري' })}
        ${S.f.text('umarja', 'المرجع الذي تقلّده (يُعرض عند الأحكام الشرعية)', S.settings.marja, { placeholder: 'اختياري — لا يضع سِراج فتاوى من عنده' })}
        ${S.f.select('uth', 'المظهر', [{ v: 'auto', t: 'تلقائي' }, { v: 'light', t: 'نهاري' }, { v: 'dark', t: 'ليلي' }], S.settings.theme)}
        <p class="tiny muted">حدّد مدينتك لاحقاً من «مواقيت الصلاة» لحساب الأوقات والقبلة. لا يعرض سِراج نصاً دينياً دون مصدره، وتصل الإضافات عبر «تحديثات المحتوى» الموقّعة.</p>`,
      actions: [{ label: 'لاحقاً', cls: 'ghost', value: 'skip', onClick: () => { S.set('onboarded', true); } }, { label: 'ابدأ', cls: 'primary', value: 'ok', onClick: (box) => { const d = S.f.read(box); S.set({ userName: d.uname.trim(), marja: d.umarja.trim(), theme: d.uth, onboarded: true }); S.router.refresh(); } }]
    });
  }

  /* ---------- الإشعارات ---------- */
  S.router.add('/notifications', async () => {
    const list = await S.notify.list(); await S.notify.markAll();
    return {
      title: 'الإشعارات', nav: 'home', back: '/home',
      actions: list.length ? [{ icon: 'trash', label: 'مسح الكل', act: 'notifClear' }] : [],
      html: list.length ? S.h`<div class="list">${list.map((n) => S.h`<div class="li"><span class="li-ico">${S.icon(n.kind === 'prayer' ? 'mosque' : n.kind === 'review' ? 'shield' : 'bell')}</span><span class="li-body"><span class="li-t">${n.title}</span><span class="li-s">${n.body || ''}</span></span><span class="li-end tiny">${S.fmt.dt(n.ts)}</span></div>`)}</div>` : S.ui.empty('bell', 'لا توجد إشعارات', 'تظهر هنا تنبيهات الصلاة والمناسبات وتحديثات المحتوى.')
    };
  });
  S.act('notifClear', async () => { if (await S.confirm('مسح كل الإشعارات؟')) { await S.notify.clear(); S.router.refresh(); } });

  /* ---------- مركز «المزيد» ---------- */
  const GROUPS = [
    ['العبادة والمواقيت', [['mosque', 'مواقيت الصلاة', 'حساب فلكي حسب موقعك', '/prayer'], ['compass', 'اتجاه القبلة', 'من إحداثياتك إلى الكعبة', '/qibla'], ['calendar', 'التقويم الهجري والمناسبات', 'وأيام الصيام المستحب', '/calendar'], ['check-circle', 'جدول قضاء الصلاة', 'تتبّع ما عليك قضاؤه', '/qada'], ['calc', 'حاسبة الخمس والزكاة', 'حساب مع بيان المرجع', '/worship/calc'], ['droplet', 'الوضوء والصلاة والأحكام', 'مع نسبة كل حكم لمرجعه', '/worship']]],
    ['القرآن والدعاء', [['book-open', 'القرآن الكريم', '114 سورة • 30 جزءاً', '/quran'], ['heart-handshake', 'الأدعية والزيارات', 'فهرس بمصادر موثقة', '/duas'], ['beads', 'المسبحة', 'عدّاد وأهداف وإحصاءات', '/tasbeeh'], ['sparkle', 'الأوراد والأعمال اليومية', 'ورد، تحدي قراءة، أذكار', '/daily'], ['notebook', 'دفتر التدبر', 'ملاحظاتك على الآيات', '/tadabbur']]],
    ['الموسوعات', [['star', 'العقائد', 'أصول الدين والإمامة', '/aqeedah'], ['users', 'الأئمة الاثنا عشر (ع)', 'سِيَر وجدول زمني', '/imams'], ['network', 'موسوعة الأبحاث العلمية', '20 وحدة بحثية', '/research'], ['sparkle', 'مساعد سِراج العلمي', 'يجيب من المكتبة مع الإحالة', '/assistant']]],
    ['المكتبة والتحديثات', [['library', 'المكتبة', 'أقسام موضوعية', '/library'], ['download', 'تحديثات المحتوى', 'حزم موقّعة من الناشر', '/updates']]],
    ['التطبيق', [['settings', 'الإعدادات', 'المظهر والخط والنسخ الاحتياطي', '/settings'], ['wifi', 'حالة الاتصال والتخزين', 'التشخيص', '/status'], ['info', 'عن سِراج والمصادر والتراخيص', '', '/about']]]
  ];
  S.router.add('/more', () => ({
    title: 'المزيد', nav: 'more', back: false,
    html: S.h`<div class="stack">${GROUPS.map(([t, items], i) => S.h`<div ${S.raw(i === 2 ? 'id="enc"' : '')}>${S.ui.sectionTitle(t)}<div class="list">${items.map(([ic, n, s, h]) => S.ui.li({ icon: ic, t: n, s, href: '#' + h }))}</div></div>`)}</div>`
  }));
})();

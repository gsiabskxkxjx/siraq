/* =====================================================================
   سِراج — duas.js : الأدعية والزيارات
   الفهرس يحتوي العناوين فقط. لا يظهر نص دعاء أو زيارة إلا إذا وصل بمصدر (كتاب/طبعة/صفحة) ضمن حزمة موقّعة من الناشر أو من نص المصحف،
   وحينها تكون حالته «موثق». أي نص بلا مصدر يُرفض عند الاستيراد.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const STATUS = { documented: ['نص موثق', 'ok'], missing: ['العنوان فقط', 'warn'], demo: ['نص اختبار للواجهة', 'info'] };
  const KIND = { dua: 'دعاء', ziyarah: 'زيارة', collection: 'مجموعة', demo: 'تجريبي' };
  const badge = (it) => { const [t, k] = STATUS[it.textStatus] || STATUS.missing; return S.ui.badge(t, k); };
  const srcLine = (it) => { const s = it.textSource; if (!s) return it.commonSource || ''; return [s.book, s.author, s.edition && 'طبعة: ' + s.edition, s.part && 'ج' + s.part, s.page && 'ص' + s.page].filter(Boolean).join(' — '); };

  const D = (S.duas = {
    cats: () => S.data.duas.categories,
    async all() { return (await S.db.all('duas')).sort((a, b) => (a.order || 0) - (b.order || 0)); },
    validate: (it) => S.schema.validateDua(it)
  });

  S.router.add('/duas', async (p, q) => {
    const all = await D.all(); const term = (q.q || '').trim(); const cats = D.cats();
    const counts = {}; all.forEach((d) => (counts[d.cat] = (counts[d.cat] || 0) + 1));
    const documented = all.filter((d) => d.textStatus === 'documented').length; const favs = (await S.fav.list('dua')).length;
    const res = term ? all.filter((d) => S.norm(d.title + ' ' + (d.textStatus !== 'missing' ? d.text : '')).includes(S.norm(term))) : [];
    return {
      title: 'الأدعية والزيارات', nav: 'more', back: '/more',
      actions: [],
      html: S.h`<div class="stack">
        <div class="searchbox">${S.icon('search')}<input class="input" id="dq" type="search" value="${term}" placeholder="ابحث في الأدعية والزيارات" enterkeyhint="search"></div>
        ${term ? (res.length ? S.h`<div class="list">${res.map(row)}</div>` : S.ui.empty('search', 'لا نتائج')) : S.h`
        ${S.ui.notice('info', 'عن المحتوى', S.h`<span>الفهرس يضم <b>${S.n(all.filter((d) => d.kind !== 'demo').length)}</b> عنواناً، منها <b>${S.n(documented)}</b> بنص موثق. لا يعرض سِراج نص دعاء دون ذكر كتابه وطبعته وصفحته. تصل النصوص الجديدة عبر <a href="#/updates">تحديثات المحتوى</a> الموقّعة.</span>`)}
        ${qdNotice(all)}
        <div class="chips"><a class="chip" href="#/duas/favorites">${S.icon('heart')} المفضلة (${S.n(favs)})</a></div>
        <div class="grid2">${cats.map((c) => S.h`<a class="card tap" href="#/duas/cat/${c.id}"><b>${c.title}</b><div class="small muted">${S.n(counts[c.id] || 0)} عنوان</div></a>`)}</div>`}
      </div>`,
      mount() { const f = S.$('#dq'); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') S.router.go('/duas?q=' + encodeURIComponent(f.value)); }); }
    };
  });
  /* الأدعية القرآنية تُبنى من نص المصحف؛ إن لم يُحمَّل المصحف نقول ذلك بصراحة بدل إظهار قائمة فارغة */
  function qdNotice(all) {
    const Q = S.quran, QD = S.quranDuas; if (!QD) return '';
    const have = all.filter((d) => /^qd_/.test(d.id)).length;
    if (have) return S.ui.notice('ok', 'الأدعية القرآنية', S.h`<span><b>${S.n(have)}</b> دعاءً من القرآن الكريم بنصّ المصحف المحمَّل على جهازك، مع السورة والآية لكل دعاء. <a href="#/duas/cat/quran">عرضها</a></span>`);
    if (!Q || !Q.text) return S.h`<div class="card"><div class="card-t">${S.icon('book-open')} الأدعية القرآنية (${S.n(QD.total())} موضعاً)</div><p class="small muted nm">تظهر نصوصها بعد تحميل المصحف الشريف على جهازك، لأن سِراج لا يكتب آيات يدوياً بل يأخذها من المصحف ويتحقق منها.</p><a class="btn sm gold" href="#/quran/download">${S.icon('download')} تحميل المصحف</a></div>`;
    return '';
  }
  const row = (d) => S.h`<a class="li" href="#/duas/item/${d.id}"><span class="li-ico">${S.icon(d.kind === 'ziyarah' ? 'mosque' : d.kind === 'collection' ? 'book-open' : 'heart-handshake')}</span><span class="li-body"><span class="li-t">${d.title}</span><span class="li-s">${KIND[d.kind] || ''}${d.commonSource ? ' • ' + d.commonSource : ''}</span></span><span class="li-end">${badge(d)}</span></a>`;
  S.router.add('/duas/cat/:id', async (p) => {
    const c = D.cats().find((x) => x.id === p.id); const all = (await D.all()).filter((d) => d.cat === p.id);
    return { title: c ? c.title : 'تصنيف', nav: 'more', back: '/duas', html: all.length ? S.h`<div class="list">${all.map(row)}</div>` : S.ui.empty('heart-handshake', 'لا عناصر في هذا التصنيف') };
  });
  S.router.add('/duas/favorites', async () => {
    const f = await S.fav.list('dua'); const items = []; for (const x of f) { const d = await S.db.get('duas', x.ref); if (d) items.push(d); }
    return { title: 'أدعيتي المفضلة', nav: 'more', back: '/duas', html: items.length ? S.h`<div class="list">${items.map(row)}</div>` : S.ui.empty('heart', 'لا مفضلة بعد', 'افتح أي دعاء واضغط على القلب.') };
  });

  /* ---------- قارئ الدعاء ---------- */
  let tts = null;
  /* تكرار مقطع (A–B) على التسجيل الصوتي المرتبط بالدعاء إن وُجد */
  const AB = { a: null, b: null }; const fmtT = (x) => (x == null ? '—' : Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0'));
  const abPaint = () => { const A = S.$('#dua-a'), B = S.$('#dua-b'), st = S.$('#dua-abst'); if (!A) return; A.textContent = fmtT(AB.a); B.textContent = fmtT(AB.b); st.textContent = AB.a != null && AB.b != null ? 'يتكرر المقطع من ' + fmtT(AB.a) + ' إلى ' + fmtT(AB.b) : 'لا مقطع محدد.'; };
  S.act('duaA', () => { const au = S.$('#dua-au'); if (!au) return; AB.a = au.currentTime; if (AB.b != null && AB.b <= AB.a) AB.b = null; abPaint(); });
  S.act('duaB', () => { const au = S.$('#dua-au'); if (!au) return; if (AB.a == null) return S.toast('حدّد البداية أولاً', 'err'); if (au.currentTime <= AB.a + 0.3) return S.toast('النهاية يجب أن تكون بعد البداية', 'err'); AB.b = au.currentTime; au.currentTime = AB.a; au.play().catch(() => {}); abPaint(); });
  S.act('duaABclr', () => { AB.a = AB.b = null; abPaint(); });
  S.onChange('duaLoopAll', (el) => { const au = S.$('#dua-au'); if (au) au.loop = el.checked; });
  document.addEventListener('timeupdate', (e) => { const au = e.target; if (au && au.id === 'dua-au' && AB.a != null && AB.b != null && au.currentTime >= AB.b) au.currentTime = AB.a; }, true);

  S.router.add('/duas/item/:id', async (p) => {
    const d = await S.db.get('duas', p.id); if (!d) return { title: 'دعاء', back: '/duas', html: S.ui.empty('alert', 'العنصر غير موجود') };
    AB.a = AB.b = null; const fav = S.fav.has('dua', d.id); const prog = S.progress.get('dua', d.id); const lines = d.text ? d.text.split('\n').filter((x) => x.trim()) : [];
    let audioUrl = null; if (d.audio) { const f = await S.files.get(d.audio); if (f) audioUrl = URL.createObjectURL(f.blob); }
    const ok = d.textStatus !== 'missing' && lines.length; const cat = D.cats().find((c) => c.id === d.cat);
    return {
      title: d.title, nav: 'more', back: '/duas/cat/' + d.cat,
      actions: [{ icon: 'heart', label: 'مفضلة', act: 'duaFav', attrs: 'data-id="' + S.esc(d.id) + '"' }],
      html: S.h`<div class="stack">
        <div class="card"><div class="row between"><div><b class="h2">${d.title}</b><div class="small muted">${KIND[d.kind] || ''}${cat ? ' • ' + cat.title : ''}</div></div>${badge(d)}</div></div>
        ${d.textStatus === 'demo' ? S.ui.notice('warn', 'نص اختبار', 'هذا النص مخصص لاختبار واجهة القراءة فقط وليس دعاءً ولا نصاً دينياً.') : ''}
        ${ok ? S.h`
          <div class="q-bar" style="position:static;margin:0;border-radius:14px;border:1px solid var(--border)"><button class="iconbtn" data-act="qFont" data-d="-0.1" aria-label="تصغير">${S.icon('minus')}</button><button class="iconbtn" data-act="qFont" data-d="0.1" aria-label="تكبير">${S.icon('plus')}</button><button class="btn sm" data-act="duaCopy" data-id="${d.id}">${S.icon('copy')} نسخ</button><button class="btn sm" data-act="duaShare" data-id="${d.id}">${S.icon('share')} مشاركة</button><button class="btn sm" data-act="duaTts" data-id="${d.id}">${S.icon('volume')} قراءة آلية</button>${prog ? S.h`<a class="btn sm gold" href="#/duas/item/${d.id}?goto=${prog.pos}">آخر موضع</a>` : ''}</div>
          <div class="card"><div class="dua-text" id="duatext">${lines.map((ln, i) => S.h`<span class="dua-line ${prog && prog.pos === i ? 'mark' : ''}" data-act="duaMark" data-id="${d.id}" data-i="${i}" id="dl-${i}">${ln}</span>`)}</div></div>
          ${audioUrl ? S.h`<div class="card"><div class="card-t">${S.icon('volume')} تسجيل صوتي</div><audio controls preload="none" id="dua-au" src="${audioUrl}" style="width:100%"></audio>
            <div class="card flat mt"><div class="small"><b>تكرار مقطع</b> — شغّل التسجيل ثم حدّد بداية المقطع ونهايته ليتكرر</div><div class="grid3 mt-s"><button class="btn sm" data-act="duaA">بداية: <b id="dua-a">—</b></button><button class="btn sm" data-act="duaB">نهاية: <b id="dua-b">—</b></button><button class="btn sm" data-act="duaABclr">إلغاء</button></div><label class="check"><input type="checkbox" id="dua-all" data-chg="duaLoopAll"><span>تكرار التسجيل كاملاً</span></label><div class="tiny muted" id="dua-abst">لا مقطع محدد.</div></div>
            <div class="tiny muted">${d.audioNote || 'ملف صوتي مرتبط بالدعاء. تأكد من ترخيصه.'}</div></div>` : ''}`
          : S.ui.empty('scroll', 'النص الموثق غير مضاف بعد', 'لا يُنشئ سِراج نصوص الأدعية من عنده. عند إضافة النص من كتاب معتمد (مثل مفاتيح الجنان أو الصحيفة السجادية) مع الطبعة والصفحة يظهر هنا للقراءة.', S.h`<a class="btn" href="#/updates">تحديثات المحتوى</a>`)}
        <div class="card"><div class="card-t">${S.icon('link')} المصدر</div><p class="nm">${srcLine(d) || 'غير محدد'}</p>${d.textSource && d.textSource.url ? S.h`<a class="small" href="${d.textSource.url}" target="_blank" rel="noopener noreferrer">رابط المصدر</a>` : ''}<p class="tiny muted nm mt">${d.note || ''}</p></div>
        ${ok ? S.h`<a class="btn block" href="#/daily/reminders?dua=${d.id}">${S.icon('bell')} جدولة قراءة هذا الدعاء</a>` : ''}
      </div>`,
      mount() { const g = new URLSearchParams((location.hash.split('?')[1]) || '').get('goto'); const el = g != null ? document.getElementById('dl-' + g) : null; if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('mark'); } },
      unmount() { stopTts(); }
    };
  });
  S.act('duaFav', async (el) => { const on = await S.fav.toggle('dua', el.dataset.id); S.toast(on ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'ok'); });
  S.act('duaMark', async (el) => { S.$$('.dua-line.mark').forEach((x) => x.classList.remove('mark')); el.classList.add('mark'); await S.progress.set('dua', el.dataset.id, +el.dataset.i); });
  const full = async (id) => { const d = await S.db.get('duas', id); return d.title + '\n\n' + d.text + '\n\nالمصدر: ' + srcLine(d) + '\n— عبر تطبيق سِراج'; };
  S.act('duaCopy', async (el) => S.copy(await full(el.dataset.id)));
  S.act('duaShare', async (el) => { const d = await S.db.get('duas', el.dataset.id); S.share({ title: d.title, text: await full(el.dataset.id) }); });
  function stopTts() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* */ } tts = null; }
  S.act('duaTts', async (el) => {
    if (!('speechSynthesis' in window)) return S.toast('الجهاز لا يدعم القراءة الآلية', 'err');
    if (tts) { stopTts(); return S.toast('أُوقفت القراءة'); }
    const d = await S.db.get('duas', el.dataset.id); const voices = speechSynthesis.getVoices(); const ar = voices.find((v) => /^ar/i.test(v.lang));
    if (!ar && voices.length) S.toast('لا يوجد صوت عربي مثبّت على جهازك؛ قد تكون القراءة غير واضحة', 'err');
    const u = new SpeechSynthesisUtterance(d.text); u.lang = ar ? ar.lang : 'ar-SA'; if (ar) u.voice = ar; u.rate = 0.85; u.onend = () => { tts = null; }; tts = u; speechSynthesis.speak(u);
    S.toast('قراءة آلية بصوت جهازك — وليست تلاوة بشرية');
  });
})();

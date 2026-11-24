/* =====================================================================
   سِراج — settings.js : الإعدادات، حالة الاتصال والتخزين، عن التطبيق
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;

  const sw = (k, label, sub) => S.h`<div class="setting"><div class="sd">${label}${sub ? S.h`<small>${sub}</small>` : ''}</div><label class="switch"><input type="checkbox" ${S.settings[k] ? S.raw('checked') : ''} data-chg="pref" data-k="${k}" aria-label="${label}"><i></i></label></div>`;

  S.act('toggleTheme', () => S.toggleTheme());
  S.onChange('pref', (el) => {
    const k = el.dataset.k; let v;
    if (el.type === 'checkbox') v = el.checked; else if (el.type === 'range' || el.type === 'number' || el.dataset.num) v = Number(el.value); else v = el.value;
    S.set(k, v);
    if (k === 'digits' || k === 'hijriCal' || k === 'hijriOffset') S.router.refresh();
    else S.toast('تم الحفظ', 'ok');
  });
  S.onInput('prefLive', (el) => { const k = el.dataset.k; const v = Number(el.value); document.documentElement.style.setProperty(k === 'fontScale' ? '--fscale' : '--q-scale', String(v)); S.$('#lbl-' + k) && (S.$('#lbl-' + k).textContent = S.n(Math.round(v * 100)) + '%'); });
  S.onInput('prefText', S.debounce((el) => { S.set(el.dataset.k, el.value.trim()); }, 400));

  S.router.add('/settings', async () => {
    const st = S.settings; const info = await S.storageInfo();
    return {
      title: 'الإعدادات', nav: 'more', back: '/more',
      html: S.h`<div class="stack">
        <div class="card"><div class="card-t">${S.icon('sun')} المظهر والقراءة</div>
          ${S.f.select('theme', 'المظهر', [{ v: 'auto', t: 'تلقائي (حسب الجهاز)' }, { v: 'light', t: 'نهاري' }, { v: 'dark', t: 'ليلي' }], st.theme, { chg: 'pref', k: 'theme', })}
          <div class="field"><label>حجم الخط العام: <b id="lbl-fontScale">${S.n(Math.round(st.fontScale * 100))}%</b></label><input type="range" min="0.85" max="1.5" step="0.05" value="${st.fontScale}" data-inp="prefLive" data-chg="pref" data-k="fontScale"></div>
          <div class="field"><label>حجم خط المصحف: <b id="lbl-quranScale">${S.n(Math.round(st.quranScale * 100))}%</b></label><input type="range" min="0.8" max="2" step="0.05" value="${st.quranScale}" data-inp="prefLive" data-chg="pref" data-k="quranScale"></div>
          ${sw('elder', 'وضع كبار السن', 'خطوط أكبر وأزرار أوضح وتباين أعلى')}
          ${S.f.select('digits', 'نوع الأرقام', [{ v: 'en', t: '0 1 2 3 (لاتينية)' }, { v: 'ar', t: '٠ ١ ٢ ٣ (هندية)' }], st.digits, { chg: 'pref', k: 'digits', })}
        </div>
        <div class="card"><div class="card-t">${S.icon('user')} الملف الشخصي</div>
          <div class="field"><label>الاسم</label><input class="input" value="${st.userName}" data-inp="prefText" data-k="userName" placeholder="اختياري"></div>
          <div class="field"><label>المرجع الذي تقلّده</label><input class="input" value="${st.marja}" data-inp="prefText" data-k="marja" placeholder="اختياري"><span class="hint">يُعرض عند الأحكام الشرعية. لا يضع سِراج فتاوى من عنده، فراجع رسالة مرجعك أو مكتبه.</span></div>
        </div>
        <div class="card"><div class="card-t">${S.icon('moon')} التاريخ الهجري</div>
          ${S.f.select('hijriCal', 'نوع التقويم', [{ v: 'umalqura', t: 'أم القرى' }, { v: 'civil', t: 'الجدول المدني (حسابي)' }], st.hijriCal, { chg: 'pref', k: 'hijriCal', })}
          ${S.f.select('hijriOffset', 'تعديل يدوي (لمطابقة الرؤية في بلدك)', [-2, -1, 0, 1, 2].map((v) => ({ v, t: v === 0 ? 'بلا تعديل' : (v > 0 ? '+' : '') + v + ' يوم' })), st.hijriOffset, { chg: 'pref', k: 'hijriOffset', num: 1, })}
          <p class="tiny muted nm">التقاويم الحسابية تقريبية؛ بداية الشهر الشرعي تثبت بالرؤية عند كثير من المراجع.</p></div>
        <div class="card"><div class="card-t">${S.icon('bell')} التنبيهات والتفاعل</div>
          ${sw('notifyOcc', 'تنبيه المناسبات', 'قبلها بيوم وفي يومها')}${sw('vibrate', 'الاهتزاز')}${sw('sound', 'الأصوات')}
          <a class="btn block mt" href="#/prayer/settings">إعدادات الصلاة والأذان</a></div>
        <div class="card"><div class="card-t">${S.icon('database')} بياناتك</div>
          <p class="small muted nm">كل بياناتك (المفضلة، الملاحظات، التقدم، المسبحة، القضاء) تُحفظ على هذا الجهاز فقط. النسخة الاحتياطية تضم بياناتك الشخصية فقط، أما المحتوى (كتب/أدعية/مداخل) فيصل عبر «تحديثات المحتوى» الموقّعة.</p>
          <div class="kv"><span>التخزين الدائم</span><b>${info.mem ? 'غير متاح (ذاكرة مؤقتة)' : info.persisted ? 'مُثبَّت' : 'قابل للإزالة عند امتلاء الجهاز'}</b></div>
          ${info.usage != null ? S.h`<div class="kv"><span>المستخدم</span><b class="op-ltr">${S.fmt.bytes(info.usage)} / ${S.fmt.bytes(info.quota)}</b></div>` : ''}
          <div class="grid2 mt"><button class="btn" data-act="backupExport" data-files="0">${S.icon('download')} نسخة احتياطية (بدون ملفات)</button><button class="btn" data-act="backupExport" data-files="1">${S.icon('download')} نسخة كاملة بالملفات</button></div>
          ${S.f.file('bkfile', 'استعادة من نسخة احتياطية', 'application/json,.json')}
          <button class="btn block" data-act="backupImport">${S.icon('upload')} استعادة</button>
          <a class="btn block mt" href="#/updates">${S.icon('download')} تحديثات المحتوى</a>
          <button class="btn danger block mt" data-act="resetDemo">${S.icon('refresh')} إعادة المحتوى المضمّن إلى أصله</button>
        </div>
        <div class="card"><div class="card-t">${S.icon('download')} التثبيت</div><p class="small muted nm">ثبّت سِراج على الشاشة الرئيسية ليعمل كتطبيق مستقل.</p><button class="btn gold block" data-act="install">تثبيت التطبيق</button></div>
        <div class="list">${S.ui.li({ icon: 'wifi', t: 'حالة الاتصال والتخزين', href: '#/status' })}${S.ui.li({ icon: 'info', t: 'عن سِراج والمصادر والتراخيص', href: '#/about' })}</div>
      </div>`
    };
  });
  S.act('backupExport', async (el) => {
    const blob = await S.backup.export({ includeFiles: el.dataset.files === '1' });
    S.download(blob, 'siraj-backup-' + S.today() + '.json'); S.toast('تم إنشاء النسخة (' + S.fmt.bytes(blob.size) + ')', 'ok');
  });
  S.act('backupImport', async (el) => {
    const f = S.$('[name=bkfile]', el.parentNode).files[0]; if (!f) return S.toast('اختر ملف النسخة الاحتياطية أولاً', 'err');
    if (!(await S.confirm('ستُدمج بيانات النسخة مع بياناتك الحالية (تُستبدل السجلات المتطابقة). متابعة؟'))) return;
    const n = await S.backup.import(await S.readFile(f, 'text'), { settings: true });
    if (S.library) await S.library.init(); S.toast('تمت استعادة ' + S.n(n) + ' سجلاً', 'ok'); S.router.refresh();
  });
  S.act('resetDemo', async () => {
    if (!(await S.confirm('سيُحذف المحتوى الذي وصل عبر تحديثات المحتوى ويعود المحتوى المضمّن في التطبيق كما كان. تبقى مفضلتك وملاحظاتك وإعداداتك. متابعة؟', { danger: true, yes: 'نعم، أعد التعيين' }))) return;
    await S.resetDemo(); S.toast('أُعيد المحتوى المضمّن', 'ok'); S.router.refresh();
  });

  /* ---------- حالة الاتصال والتخزين ---------- */
  S.router.add('/status', async () => {
    const info = await S.storageInfo(); const counts = {};
    for (const s of ['books', 'files', 'quran', 'audio', 'duas', 'entries', 'favorites', 'notes', 'prayerlog', 'tasbeeh']) { try { counts[s] = await S.db.count(s); } catch (e) { counts[s] = '؟'; } }
    let cacheNames = []; try { if (window.caches) cacheNames = await caches.keys(); } catch (e) { /* */ }
    const ctrl = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    const swTxt = { ready: ctrl ? 'مفعّل ويتحكم بالصفحة' : 'مسجّل (يتحكم بعد إعادة التحميل)', registering: 'قيد التسجيل', file: 'غير متاح عند الفتح من ملف (file://) — يلزم HTTPS أو localhost', insecure: 'غير متاح: الصفحة ليست HTTPS', failed: 'فشل التسجيل', native: 'غير مطلوب: الملفات مضمّنة داخل تطبيق أندرويد' }[S.swState] || 'غير معروف';
    const errs = S.logs.filter((l) => l.level === 'error').slice(-8);
    const qs = S.quran && S.quran.hasText ? S.quran.hasText() : false;
    return {
      title: 'حالة التطبيق', nav: 'more', back: '/more',
      html: S.h`<div class="stack">
        <div class="card"><div class="kv"><span>الاتصال بالإنترنت</span><b class="${navigator.onLine ? 'ok' : 'bad'}">${navigator.onLine ? 'متصل' : 'غير متصل'}</b></div>
          <div class="kv"><span>البروتوكول</span><b class="op-ltr">${location.protocol}//${location.host || '(ملف محلي)'}</b></div>
          <div class="kv"><span>Service Worker (العمل دون إنترنت)</span><b>${swTxt}</b></div>
          <div class="kv"><span>ذاكرة التطبيق المؤقتة</span><b class="op-ltr">${cacheNames.length ? cacheNames.join(', ') : '—'}</b></div>
          <div class="kv"><span>قاعدة البيانات (IndexedDB)</span><b class="${info.idb ? 'ok' : 'bad'}">${info.idb ? 'تعمل' : 'غير متاحة — ' + info.error}</b></div>
          <div class="kv"><span>نص المصحف على الجهاز</span><b class="${qs ? 'ok' : ''}">${qs ? 'محمّل' : 'غير محمّل'}</b></div>
          <div class="kv"><span>الإصدار</span><b class="op-ltr">${S.version}</b></div>
          <button class="btn block mt" data-act="netTest">${S.icon('wifi')} اختبار الاتصال الفعلي</button><div id="nettest" class="small muted mt"></div></div>
        ${S.isFile ? S.ui.notice('warn', 'تعمل الآن من ملف مباشر', 'التخزين المحلي يعمل لكن ميزات HTTPS (التثبيت، العمل دون إنترنت عبر Service Worker، GPS، الإشعارات) تتطلب رفع المجلد على استضافة HTTPS أو تشغيله على localhost. راجع README.') : ''}
        <div class="card"><div class="card-t">${S.icon('database')} محتوى قاعدة البيانات</div>${Object.entries(counts).map(([k, v]) => S.h`<div class="kv"><span class="op-ltr">${k}</span><b>${S.n(v)}</b></div>`)}</div>
        <div class="card"><div class="card-t">${S.icon('alert')} آخر الأخطاء البرمجية</div>${errs.length ? errs.map((e) => S.h`<div class="small bad">${e.msg}</div>`) : S.h`<p class="small muted nm">لا أخطاء مسجّلة في هذه الجلسة.</p>`}</div>
        <div class="grid2"><button class="btn" data-act="clearCaches">مسح الذاكرة المؤقتة للتطبيق</button><button class="btn" data-act="persistStorage">طلب التخزين الدائم</button></div>
      </div>`
    };
  });
  S.act('netTest', async (el) => {
    const out = S.$('#nettest'); out.textContent = 'جارٍ الاختبار…'; const t0 = performance.now();
    try { const r = await fetch('manifest.json?t=' + Date.now(), { cache: 'no-store' }); out.textContent = r.ok ? 'تم الوصول إلى الخادم خلال ' + S.n(Math.round(performance.now() - t0)) + ' مللي ثانية.' : 'استجاب الخادم برمز ' + r.status; }
    catch (e) { out.textContent = S.isFile ? 'لا يمكن الاختبار عند الفتح من ملف.' : 'تعذّر الوصول إلى الخادم (قد تكون دون اتصال).'; }
  });
  S.act('clearCaches', async () => {
    if (!(await S.confirm('سيُمسح ما خُزِّن للعمل دون إنترنت وتُلغى تسجيلات Service Worker (لا تتأثر بياناتك). متابعة؟'))) return;
    try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) { return S.fail(e); }
    S.toast('تم المسح. أعد تحميل الصفحة', 'ok');
  });
  S.act('persistStorage', async () => { const ok = await S.db.persist(); S.toast(ok ? 'تم تثبيت التخزين' : 'لم يمنح المتصفح التخزين الدائم', ok ? 'ok' : 'err'); S.router.refresh(); });

  /* ---------- عن التطبيق ---------- */
  S.router.add('/about', () => ({
    title: 'عن سِراج', nav: 'more', back: '/more',
    html: S.h`<div class="stack">
      <div class="card center"><img src="assets/images/logo.png" alt="سِراج" style="max-width:220px;margin:auto"><p class="gold nm">نور العلم وهداية الطريق</p><p class="small muted nm">القرآن • العترة • المعرفة</p><p class="tiny muted">الإصدار ${S.version}</p></div>
      ${S.ui.notice('info', 'عن بيانات المكتبة', S.data.sample.meta.dataNotice)}
      <div class="card"><div class="card-t">${S.icon('shield')} ضوابط المحتوى</div>
        <ul class="small"><li>لا يُنشئ سِراج كتباً ولا مؤلفين ولا روايات ولا فتاوى. كل مادة دينية تُضاف بمصدرها.</li><li>وجود ملف PDF على الإنترنت لا يعني إذن إعادة نشره؛ لا يُنشر كتاب دون حالة حقوق واضحة.</li><li>الأحكام الشرعية تُنسب لمرجعها؛ والمساعد العلمي لا يُصدر فتاوى.</li><li>لا يُنشر شيء تلقائياً: قرار النشر النهائي لمالك التطبيق افتراضياً.</li></ul></div>
      <div class="card"><div class="card-t">${S.icon('link')} المصادر والتراخيص</div>
        <ul class="small">
          <li>نص القرآن الكريم: ${S.data.quran.attribution.text}</li>
          <li>قارئ PDF: مكتبة PDF.js (Mozilla) — رخصة Apache-2.0.</li>
          <li>الخطوط: Cairo وAmiri وAmiri Quran عبر Google Fonts — رخصة SIL OFL.</li>
          <li>صوتيات التلاوة: عبر شبكة cdn.islamic.network (تُحمَّل بإذن المستخدم وتُحفظ على جهازه).</li>
          <li>بحث الكتب المفتوحة (اختياري): واجهة archive.org.</li>
        </ul>
        <div class="row wrap">${S.data.quran.attribution.links.map(([t, u]) => S.h`<a class="chip" href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)}</div></div>
      <div class="card"><div class="card-t">${S.icon('flag')} ما ليس مربوطاً بعد</div><p class="small muted nm">لا يوجد خادم في هذه النسخة: تسجيل المستخدمين الحقيقي، المزامنة بين الأجهزة، المساعد الذكي الحقيقي، ونشر الكتب العام تحتاج بنية خلفية (Supabase), وتظهر في الواجهة بوسم «غير مربوط».</p></div>
    </div>`
  }));
})();

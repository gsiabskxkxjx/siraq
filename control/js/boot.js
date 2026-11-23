/* =====================================================================
   سِراج — التحكم : boot.js — الصفحة الرئيسية، زر الرجوع في أندرويد، الإقلاع
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ; const { list } = S.ctl;

  S.router.add('/home', async () => {
    const [b, d, e] = await Promise.all([list('books'), list('duas'), list('entries')]); const rd = (a) => a.filter((x) => x.ready).length;
    const hist = S.kv.get('ctl.history', []); const last = hist[0]; const hasKey = S.keys.exists();
    const step = !hasKey ? ['1', 'أنشئ مفتاح النشر', '/key', 'key'] : rd(b) + rd(d) + rd(e) === 0 ? ['2', 'أضف أول محتوى وعلّمه «جاهز»', '/content', 'plus'] : ['3', 'أصدر حزمة موقّعة', '/publish', 'upload'];
    return {
      title: 'سِراج — التحكم', back: false, nav: 'home', actions: [{ icon: S.theme === 'dark' ? 'sun' : 'moon', label: 'المظهر', act: 'toggleTheme' }],
      html: S.h`<div class="stack">
        <div class="card hero-mini"><b>أداة الناشر لتطبيق سِراج</b><p class="small nm">أنت وحدك من يصدر المحتوى: تضيف الكتب والأدعية والمداخل بمصادرها، فتوقّعها بمفتاحك في حزمة، ويقبلها سِراج بعد التحقق من التوقيع. لا خادم ولا حسابات.</p></div>
        <a class="card tap gold-edge" href="#${step[2]}"><div class="row"><span class="unit-n">${step[0]}</span><div class="grow"><b>الخطوة التالية</b><div class="small muted">${step[1]}</div></div>${S.icon(step[3])}</div></a>
        <div class="grid2"><div class="stat"><b>${S.n(rd(b))}</b><span>كتب جاهزة (${S.n(b.length)})</span></div><div class="stat"><b>${S.n(rd(d))}</b><span>أدعية جاهزة (${S.n(d.length)})</span></div><div class="stat"><b>${S.n(rd(e))}</b><span>مداخل جاهزة (${S.n(e.length)})</span></div><div class="stat"><b>${S.n(hist.length)}</b><span>حزم صدرت</span></div></div>
        <div class="card"><div class="card-t">${S.icon('key')} المفتاح</div>${hasKey ? S.h`<div class="kv"><span>البصمة</span><b class="fp">${S.keys.id()}</b></div><div class="kv"><span>الحالة</span><b>${S.keys.isUnlocked() ? 'مفتوح' : 'مقفل'}</b></div>` : S.ui.notice('warn', 'لا يوجد مفتاح', 'لن تستطيع إصدار حزم قبل إنشائه.')}</div>
        ${last ? S.h`<div class="card"><div class="card-t">${S.icon('clock')} آخر حزمة</div><div class="kv"><span>${last.title || last.id}</span><b>${S.fmt.dt(last.at)}</b></div><div class="kv"><span>البصمة</span><b class="fp">${last.fp}</b></div></div>` : ''}
      </div>`
    };
  });
  S.act('toggleTheme', () => { S.toggleTheme(); S.router.refresh(); });
  S.router.add('/', () => { S.router.replace('/home'); return { title: '', html: '' }; });

  function installBackButton() {
    if (!S.isNative) return; let tries = 0;
    const attach = () => {
      let A = null; try { A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; } catch (e) { /* */ }
      if (!A || !A.addListener) { if (++tries < 20) setTimeout(attach, 250); return; }
      let last = 0; const tops = ['/home', '/content', '/publish', '/key', '/'];
      S.onBackButton = function () {
        if (S.hasModal && S.hasModal()) { history.back(); return 'modal'; }
        const path = (S.router.cur && S.router.cur.path) || '/home';
        if (!tops.includes(path)) { S.router.back('/content'); return 'back'; }
        if (path !== '/home') { S.router.go('/home'); return 'home'; }
        const now = Date.now(); if (now - last < 2200) { try { A.exitApp(); } catch (e) { /* */ } return 'exit'; }
        last = now; S.toast('اضغط رجوع مرة أخرى للخروج'); return 'hint';
      };
      A.addListener('backButton', () => { try { S.onBackButton(); } catch (e) { S.log('warn', 'backButton: ' + e.message); } });
    };
    attach();
  }
  /* يُقفل المفتاح عند إخفاء التطبيق أكثر من دقيقتين */
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 120000) { S.keys.lock(); try { S.router.refresh(); } catch (e) { /* */ } } });

  async function boot() {
    try {
      S.loadData(); S.init(); S.buildNav();
      const ok = await S.db.open(); await S.kv.load(); installBackButton();
      S.db.persist(); await S.router.start();
      if (!ok) S.toast('تعذّر التخزين الدائم — ستُفقد البيانات عند الإغلاق', 'err');
    } catch (e) {
      S.log('error', 'فشل الإقلاع: ' + e.message, e.stack);
      const v = document.getElementById('view'); if (v) v.innerHTML = '<div class="empty"><b>تعذّر تشغيل التطبيق</b><p class="small">' + S.esc(e.message) + '</p></div>';
    } finally {
      const sp = document.getElementById('splash'); if (sp) { sp.classList.add('gone'); setTimeout(() => sp.remove(), 450); }
      document.documentElement.dataset.ready = '1';
    }
  }
  S.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

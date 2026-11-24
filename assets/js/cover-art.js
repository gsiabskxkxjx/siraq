/* =====================================================================
   سِراج — cover-art.js : مُصيِّر أغلفة الكتب بأسلوب «المخطوطة»
   مشترك بين تطبيق سِراج (أغلفة المكتبة المولَّدة) وتطبيق «سِراج — الأغلفة» (غلاف من اسم الكتاب).
   • svg(o)  → نص SVG (للعرض عبر <img>/data-URI؛ الخط فيه من خطوط النظام إن لم يتوفر Amiri)
   • draw(canvas|ctx, W, o) → رسم على Canvas بخط Amiri المحمَّل في الصفحة (للمعاينة والتصدير عالي الدقة)
   • toBlob(o, W) → PNG بدقة عالية
   لا يُنسب لأي كتاب غلاف حقيقي: هذه أغلفة مولَّدة بحسب العنوان فقط.
   ===================================================================== */
(function (root) {
  'use strict';
  const W0 = 300, H0 = 428; /* وحدات الرسم؛ النسبة 70:100 */
  const PALETTES = [
    { id: 'lapis', name: 'لازورد', bg: '#1F3A6B', ink: '#F4E3B8', rule: '#E6C26A' },
    { id: 'ox', name: 'عنّابي', bg: '#7A2E2A', ink: '#F4E3B8', rule: '#E6C26A' },
    { id: 'green', name: 'أخضر', bg: '#2F5D3A', ink: '#F4E3B8', rule: '#E6C26A' },
    { id: 'amber', name: 'كهرماني', bg: '#8A5A1C', ink: '#FBEFCB', rule: '#F0D27C' },
    { id: 'coal', name: 'فحمي', bg: '#2B2A33', ink: '#F4E3B8', rule: '#D9B45A' },
    { id: 'plum', name: 'بنفسجي', bg: '#5B2A4F', ink: '#F4E3B8', rule: '#E6C26A' },
    { id: 'teal', name: 'فيروزي', bg: '#1F5F5B', ink: '#F4E3B8', rule: '#E6C26A' },
    { id: 'vellum', name: 'رَقّ', bg: '#EFE3C2', ink: '#2B2218', rule: '#9A7020', light: true }
  ];
  const FONT = "Amiri,'Noto Naskh Arabic','Scheherazade New','DejaVu Sans',serif";
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); };
  const toHex = (c) => '#' + c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((x, i) => x + (B[i] - x) * t)); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pal = (o) => (typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? { id: 'custom', bg: o.color, ink: '#F4E3B8', rule: '#E6C26A' } : PALETTES.find((p) => p.id === o.color) || PALETTES[0]);

  /* هندسة مشتركة بين svg وcanvas */
  function geom(o) {
    const SP = 16, left = o.spine === 'left';
    const x0 = left ? SP + 12 : 15, x1 = left ? W0 - 15 : W0 - SP - 12, y0 = 16, y1 = H0 - 16;
    return { SP, left, x0, x1, y0, y1, cx: (x0 + x1) / 2, tw: x1 - x0 - 40 };
  }
  /* تقسيم العنوان إلى أسطر: measure(text, fs) تُرجع العرض بوحدات الرسم */
  function layout(title, g, measure) {
    const words = String(title || 'كتاب').trim().replace(/\s+/g, ' ').split(' ');
    for (let fs = 46; fs >= 20; fs -= 2) {
      const lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, fs) > g.tw) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur);
      const maxLines = fs >= 38 ? 3 : fs >= 30 ? 4 : 6;
      if (lines.length <= maxLines && lines.every((l) => measure(l, fs) <= g.tw)) return { fs, lines };
    }
    const fs = 20; const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, fs) > g.tw) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return { fs, lines: lines.slice(0, 7) };
  }
  const approx = (t, fs) => { let w = 0; for (const c of t) w += c === ' ' ? 0.26 : /[ً-ٰٟ]/.test(c) ? 0 : 0.47; return w * fs; };
  function plan(o, measure) {
    const g = geom(o); const L = layout(o.title, g, measure); const lh = L.fs * 1.5;
    const author = String(o.author || '').trim();
    const blockH = L.lines.length * lh; const hasAu = !!author;
    const mid = g.y0 + (g.y1 - g.y0) * (hasAu ? 0.44 : 0.47);
    const top = mid - blockH / 2;
    return { g, L, lh, author, top, ornY: top + blockH + 6, auY: g.y1 - 40, titleY: (i) => top + lh * (i + 0.72) };
  }

  /* ---------- SVG ---------- */
  function svg(o) {
    o = o || {}; const p = pal(o); const P = plan(o, approx); const g = P.g; const id = 'g' + (Math.abs(hash(String(o.title) + p.bg)) % 99999);
    const sp0 = g.left ? 0 : W0 - g.SP, sp1 = g.left ? g.SP : W0; const sh = g.left ? [0, 1] : [1, 0];
    const dim = p.light ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.34)';
    const dia = (x, y, r) => `<path d="M${x} ${y - r}l${r} ${r}-${r} ${r}-${r}-${r}z" fill="${p.rule}"/>`;
    const lines = P.L.lines.map((t, i) => `<text x="${g.cx}" y="${P.titleY(i).toFixed(1)}" text-anchor="middle" direction="rtl" font-size="${P.L.fs}" font-weight="700" fill="${p.ink}" font-family="${FONT}">${esc(t)}</text>`).join('');
    const au = P.author ? `<text x="${g.cx}" y="${P.auY}" text-anchor="middle" direction="rtl" font-size="19" fill="${p.ink}" fill-opacity=".88" font-family="${FONT}">${esc(P.author.slice(0, 40))}</text>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W0} ${H0}"><defs>`
      + `<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(p.bg, '#ffffff', p.light ? 0.35 : 0.1)}"/><stop offset="1" stop-color="${mix(p.bg, '#000000', p.light ? 0.12 : 0.2)}"/></linearGradient>`
      + `<linearGradient id="${id}s" x1="${sh[0]}" y1="0" x2="${sh[1]}" y2="0"><stop offset="0" stop-color="${dim}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></linearGradient></defs>`
      + `<rect width="${W0}" height="${H0}" fill="url(#${id}b)"/><rect x="${sp0}" width="${g.SP}" height="${H0}" fill="url(#${id}s)"/>`
      + `<rect x="${g.x0}" y="${g.y0}" width="${g.x1 - g.x0}" height="${g.y1 - g.y0}" fill="none" stroke="${p.rule}" stroke-opacity=".7" stroke-width="1.4"/>`
      + `<rect x="${g.x0 + 5}" y="${g.y0 + 5}" width="${g.x1 - g.x0 - 10}" height="${g.y1 - g.y0 - 10}" fill="none" stroke="${p.rule}" stroke-opacity=".32" stroke-width=".9"/>`
      + dia(g.x0, g.y0, 4) + dia(g.x1, g.y0, 4) + dia(g.x0, g.y1, 4) + dia(g.x1, g.y1, 4)
      + dia(g.cx, g.y0 + 24, 5) + dia(g.cx - 14, g.y0 + 24, 2.6) + dia(g.cx + 14, g.y0 + 24, 2.6)
      + lines
      + `<g stroke="${p.rule}" stroke-width="1"><path d="M${g.cx - 70} ${P.ornY}h56M${g.cx + 14} ${P.ornY}h56"/></g>${dia(g.cx, P.ornY, 6)}`
      + au + '</svg>';
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; }

  /* ---------- Canvas ---------- */
  function draw(target, Wpx, o) {
    o = o || {}; const cv = target && target.getContext ? target : null; const ctx = cv ? cv.getContext('2d') : target;
    const k = Wpx / W0; if (cv) { cv.width = Math.round(Wpx); cv.height = Math.round(H0 * k); }
    const p = pal(o); ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.font = `700 40px ${FONT}`; ctx.direction = 'rtl';
    const meas = (t, fs) => { ctx.font = `700 ${fs}px ${FONT}`; return ctx.measureText(t).width; };
    const P = plan(o, meas); const g = P.g;
    /* قماش الغلاف */
    const gr = ctx.createLinearGradient(0, 0, W0, H0); gr.addColorStop(0, mix(p.bg, '#ffffff', p.light ? 0.35 : 0.1)); gr.addColorStop(1, mix(p.bg, '#000000', p.light ? 0.12 : 0.2));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W0, H0);
    ctx.fillStyle = p.light ? 'rgba(90,60,10,.035)' : 'rgba(255,255,255,.018)';
    for (let y = 0; y < H0; y += 3) ctx.fillRect(0, y, W0, 1);
    for (let x = 0; x < W0; x += 3) ctx.fillRect(x, 0, 1, H0);
    /* الكعب */
    const sx = g.left ? 0 : W0 - g.SP; const sg = ctx.createLinearGradient(g.left ? 0 : W0, 0, g.left ? g.SP : W0 - g.SP, 0);
    sg.addColorStop(0, p.light ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.34)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(sx, 0, g.SP, H0);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(g.left ? g.SP : W0 - g.SP - 1, 0, 1, H0);
    /* إطار مذهّب مزدوج */
    ctx.strokeStyle = p.rule; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.4; ctx.strokeRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
    ctx.globalAlpha = 0.32; ctx.lineWidth = 0.9; ctx.strokeRect(g.x0 + 5, g.y0 + 5, g.x1 - g.x0 - 10, g.y1 - g.y0 - 10); ctx.globalAlpha = 1;
    const dia = (x, y, r) => { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fillStyle = p.rule; ctx.fill(); };
    dia(g.x0, g.y0, 4); dia(g.x1, g.y0, 4); dia(g.x0, g.y1, 4); dia(g.x1, g.y1, 4); dia(g.cx, g.y0 + 24, 5); dia(g.cx - 14, g.y0 + 24, 2.6); dia(g.cx + 14, g.y0 + 24, 2.6);
    /* العنوان */
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = p.ink;
    ctx.shadowColor = p.light ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.4)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.font = `700 ${P.L.fs}px ${FONT}`; P.L.lines.forEach((t, i) => ctx.fillText(t, g.cx, P.titleY(i)));
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    /* زخرفة */
    ctx.strokeStyle = p.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.cx - 70, P.ornY); ctx.lineTo(g.cx - 14, P.ornY); ctx.moveTo(g.cx + 14, P.ornY); ctx.lineTo(g.cx + 70, P.ornY); ctx.stroke(); dia(g.cx, P.ornY, 6);
    if (P.author) { ctx.fillStyle = p.ink; ctx.globalAlpha = 0.88; ctx.font = `400 19px ${FONT}`; ctx.fillText(P.author.slice(0, 40), g.cx, P.auY); ctx.globalAlpha = 1; }
    ctx.restore(); return cv;
  }
  async function ensureFont() { try { if (root.document && root.document.fonts) { await Promise.all([root.document.fonts.load('700 40px Amiri', 'سِراج كتاب'), root.document.fonts.load('400 19px Amiri', 'سِراج كتاب')]); } } catch (e) { /* خط النظام */ } }
  async function toBlob(o, Wpx) {
    await ensureFont(); const c = root.document.createElement('canvas'); draw(c, Wpx || 1200, o);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('تعذّر إنشاء الصورة'))), 'image/png'));
  }
  root.SIRAJ_COVER = { W: W0, H: H0, PALETTES, svg, draw, toBlob, ensureFont, mix, hash };
})(window);

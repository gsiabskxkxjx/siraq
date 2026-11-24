/* =====================================================================
   سِراج — tts.js : القراءة الآلية (تحويل النص إلى كلام)
   • تطبيق أندرويد: إضافة @capacitor-community/text-to-speech (محرك الهاتف نفسه) لأن WebView لا يوفّر speechSynthesis غالباً.
   • المتصفح: speechSynthesis.
   الصوت صوت محرك جهازك (مثل Google TTS) وليس تلاوة بشرية؛ ويلزم أن يكون الصوت العربي مثبّتاً عندك.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIRAJ;
  const plug = () => { try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech; } catch (e) { return null; } };
  const web = () => { try { return !!window.speechSynthesis && typeof window.speechSynthesis.speak === 'function' && typeof window.SpeechSynthesisUtterance === 'function'; } catch (e) { return false; } };
  let playing = false, token = 0;
  /* محركات أندرويد ترفض نصاً يزيد عن ~4000 حرف: نقسّمه عند نهايات الجمل/الأسطر */
  function chunks(text, max) {
    const out = []; let cur = '';
    String(text).split(/(?<=[.!؟?۔\n])\s*/).forEach((p) => { if (!p) return; if ((cur + ' ' + p).length > max && cur) { out.push(cur); cur = ''; } while (p.length > max) { out.push(p.slice(0, max)); p = p.slice(max); } cur = cur ? cur + ' ' + p : p; });
    if (cur.trim()) out.push(cur); return out;
  }
  const T = (S.tts = {
    mode() { return S.isNative && plug() ? 'native' : web() ? 'web' : 'none'; },
    supported() { return T.mode() !== 'none'; },
    get playing() { return playing; },
    /* هل يوجد صوت عربي؟ true/false، أو null إن لم يمكن التحقق */
    async hasArabic() {
      try {
        if (T.mode() === 'native') { const r = await plug().isLanguageSupported({ lang: 'ar-SA' }); return !!(r && r.supported); }
        if (T.mode() === 'web') { const v = speechSynthesis.getVoices(); return v.length ? v.some((x) => /^ar/i.test(x.lang)) : null; }
      } catch (e) { /* */ }
      return null;
    },
    async speak(text, o) {
      o = o || {}; const my = ++token; await T.stop(); token = my; playing = true;
      try {
        if (T.mode() === 'native') {
          for (const c of chunks(text, 1500)) { if (token !== my) break; await plug().speak({ text: c, lang: o.lang || 'ar-SA', rate: o.rate || 0.85, pitch: o.pitch || 1, volume: 1, category: 'ambient', queueStrategy: 1 }); }
        } else if (T.mode() === 'web') {
          await new Promise((res, rej) => { const u = new SpeechSynthesisUtterance(text); const v = o.voice; if (v) { u.voice = v; u.lang = v.lang; } else u.lang = o.lang || 'ar-SA'; u.rate = o.rate || 0.85; u.pitch = o.pitch || 1; u.onend = res; u.onerror = (e) => (e && e.error === 'interrupted' ? res() : rej(new Error(e && e.error || 'tts'))); speechSynthesis.speak(u); });
        } else throw new Error('unsupported');
      } finally { if (token === my) playing = false; }
    },
    async stop() { token++; playing = false; try { if (T.mode() === 'native') await plug().stop(); else if (web()) speechSynthesis.cancel(); } catch (e) { /* */ } }
  });
})();

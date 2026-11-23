/* =====================================================================
   سِراج — packcrypto.js : التوقيع الرقمي للحزم (يُستعمل في تطبيق سِراج للتحقق وفي تطبيق التحكم للتوقيع)
   الخوارزمية: ECDSA على المنحنى P-256 مع SHA-256 عبر WebCrypto (مدعومة في كل متصفحات أندرويد الحديثة)،
   اخترناها بدل Ed25519 لأن الأخيرة غير متوفرة في WebView أندرويد الأقدم.
   صيغة الملف (.sirajpack): JSON  { format, keyId, alg, payload: "<نص JSON>", sig }
   التوقيع يقع على بايتات UTF-8 لنص payload كما هو، فلا حاجة لتسوية JSON (canonicalization) ولا مجال لالتباسها.
   لا يوجد هنا أي تخزين: حفظ المفاتيح مسؤولية تطبيق التحكم.
   ===================================================================== */
(function () {
  'use strict';
  const S = (window.SIRAJ = window.SIRAJ || {});
  const FORMAT = 'siraj-pack/1', ALG = 'ES256';
  const EC = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const subtle = () => {
    const c = window.crypto;
    if (!c || !c.subtle) throw new Error('هذه البيئة لا توفّر WebCrypto (تلزم نافذة آمنة HTTPS أو تطبيق أندرويد)');
    return c.subtle;
  };
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
  const b64u = {
    enc(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { str = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  };
  const pub = (j) => ({ kty: 'EC', crv: 'P-256', x: j.x, y: j.y });
  const validPub = (j) => !!(j && j.kty === 'EC' && j.crv === 'P-256' && typeof j.x === 'string' && typeof j.y === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(j.x) && /^[A-Za-z0-9_-]{40,50}$/.test(j.y));

  const P = (S.pcrypto = {
    FORMAT, ALG, b64u, hex, validPub, pub,
    /* معرّف المفتاح: أول 16 خانة سداسية من SHA-256 لإحداثيات المفتاح العام (للعرض والمطابقة، لا للأمان) */
    async keyId(jwk) { return hex(await subtle().digest('SHA-256', enc.encode(jwk.x + '.' + jwk.y))).slice(0, 16); },
    async sha(str) { return hex(await subtle().digest('SHA-256', enc.encode(str))); },
    async generate() {
      const kp = await subtle().generateKey(EC, true, ['sign', 'verify']);
      const priv = await subtle().exportKey('jwk', kp.privateKey); const pb = pub(priv);
      return { private: priv, public: pb, id: await P.keyId(pb) };
    },
    async sign(payloadStr, privJwk, keyId) {
      const k = await subtle().importKey('jwk', privJwk, EC, false, ['sign']);
      const sig = await subtle().sign(SIG, k, enc.encode(payloadStr));
      return { format: FORMAT, keyId, alg: ALG, payload: payloadStr, sig: b64u.enc(sig) };
    },
    async verify(env, pubJwk) {
      if (!validPub(pubJwk)) return false;
      try { const k = await subtle().importKey('jwk', pub(pubJwk), EC, false, ['verify']); return await subtle().verify(SIG, k, b64u.dec(env.sig), enc.encode(env.payload)); } catch (e) { return false; }
    },
    /* ---- تشفير المفتاح السري بعبارة مرور (PBKDF2 + AES-GCM) ---- */
    async _kdf(pass, salt, iter) {
      const base = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
      return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    },
    async seal(privJwk, pass, meta, iter) {
      iter = iter || 600000; const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await P._kdf(pass, salt, iter); const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(privJwk)));
      return Object.assign({ v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64u.enc(salt), iv: b64u.enc(iv), ct: b64u.enc(ct) }, meta || {});
    },
    async unseal(blob, pass) {
      if (!blob || blob.v !== 1 || !blob.ct) throw new Error('ملف المفتاح غير صالح');
      const iter = +blob.iter; if (!(iter >= 100000 && iter <= 5000000)) throw new Error('إعدادات تشفير غير مقبولة');
      try {
        const key = await P._kdf(pass, b64u.dec(blob.salt), iter);
        const pt = await subtle().decrypt({ name: 'AES-GCM', iv: b64u.dec(blob.iv) }, key, b64u.dec(blob.ct));
        return JSON.parse(dec.decode(pt));
      } catch (e) { throw new Error('عبارة المرور غير صحيحة'); }
    }
  });
})();

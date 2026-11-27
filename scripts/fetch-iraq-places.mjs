// يجلب أقضية ونواحي العراق (بأسمائها العربية وإحداثياتها) من Wikidata وقت البناء إلى
// www/assets/data/iraq-places.json، فيعرضها التطبيق تحت كل محافظة.
// الصدق: لا نكتب أي موقع أو إحداثية من عندنا؛ كل شيء من Wikidata (رخصة CC0). لم نختبر الاستعلام على الخدمة الحية من بيئة التطوير
// (لا إنترنت)، لذلك الفشل غير قاتل: يبقى التطبيق بالمدن المضمّنة موزّعة على محافظاتها.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.IRAQ_PLACES_OUT || join(root, 'www/assets/data/iraq-places.json');
const ENDPOINT = process.env.WIKIDATA_SPARQL || 'https://query.wikidata.org/sparql';

export const QUERY = `
SELECT ?q ?qLabel ?tLabel ?gLabel ?c WHERE {
  ?g wdt:P31 ?gt. ?gt rdfs:label "governorate of Iraq"@en.
  ?q wdt:P131+ ?g; wdt:P31 ?t; wdt:P625 ?c.
  ?t rdfs:label ?tl. FILTER(LANG(?tl)="en" && CONTAINS(LCASE(?tl), "district"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ar". }
}`;

const AR = /[؀-ۿ]/;
/** يحوّل نتيجة SPARQL JSON إلى {govs:[{name,places:[{id,name,kind,lat,lng}]}]} ويرفض ما ليس عربياً أو بلا إحداثيات سليمة. */
export function parse(json) {
  const by = new Map(); let ok = 0, bad = 0;
  for (const b of (json && json.results && json.results.bindings) || []) {
    const name = b.qLabel && b.qLabel.value; const gov = b.gLabel && b.gLabel.value.replace(/^محافظة\s+/, ''); const t = (b.tLabel && b.tLabel.value) || '';
    const m = b.c && /Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(b.c.value);
    if (!name || !gov || !AR.test(name) || !AR.test(gov) || !m) { bad++; continue; }
    const lng = +m[1], lat = +m[2];
    if (!(lat > 28 && lat < 38 && lng > 38 && lng < 49)) { bad++; continue; } /* خارج العراق */
    const id = 'wd_' + String(b.q.value).split('/').pop();
    const kind = /sub|nahiya|nahia|ناحية/i.test(t) ? 'ناحية' : 'قضاء';
    if (!by.has(gov)) by.set(gov, new Map());
    by.get(gov).set(id, { id, name, kind, lat: +lat.toFixed(4), lng: +lng.toFixed(4) }); ok++;
  }
  return { ok, bad, govs: [...by.entries()].map(([name, m]) => ({ name, places: [...m.values()] })) };
}

if (process.argv[1] && process.argv[1].endsWith('fetch-iraq-places.mjs')) {
  try {
    const r = await fetch(ENDPOINT + '?format=json&query=' + encodeURIComponent(QUERY), { headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'SIRAJ-build/1.0 (iraq places)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const res = parse(await r.json());
    if (res.ok < 20) throw new Error('نتائج قليلة جداً (' + res.ok + ')');
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({ source: 'Wikidata (CC0)', fetched: new Date().toISOString(), govs: res.govs }) + '\n');
    console.log('iraq-places: ' + res.ok + ' موقع في ' + res.govs.length + ' محافظة (مرفوض ' + res.bad + ')');
  } catch (e) { console.warn('::warning::تعذّر جلب أقضية العراق: ' + e.message + ' — تبقى المدن المضمّنة'); }
}

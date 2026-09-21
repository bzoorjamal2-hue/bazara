// قراءةُ محادثةٍ وتحويلُها إلى مسوّدةِ طلبٍ للتاجرة.
//
// نفسُ الفهمِ الذي تستعملُه البائعةُ الآليّة، مُسخَّراً لصاحبةِ المتجرِ حين تحوّلُ
// المحادثةَ بيدِها: تقرأُ الرسائلَ مرّةً واحدةً فتخرجُ بالاسمِ والرقمِ والبلدةِ
// ووصفِ العنوانِ والقطعةِ ولونِها ونمرتِها. كانت التاجرةُ تعيدُ كتابةَ ما قرأَتْه
// للتوِّ بعينِها، وهذا أكثرُ ما يُنفّرُ من تحويلِ المحادثاتِ إلى طلبات.
//
// والقاعدةُ نفسُها هنا: **النموذجُ يقرأُ، والخادمُ يتحقّق.** لا يُقبَلُ معرّفُ قطعةٍ
// ليست في المتجر، ولا رقمٌ ليس جوّالاً، ولا بلدةٌ ليست في قائمةِ التوصيل.

import { normalizePhone } from './salesAgent.js';

const norm = (s) => String(s || '').toLowerCase()
  .replace(/[ً-ْ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    phone: { type: 'string' },
    place: { type: 'string' },
    address: { type: 'string' },
    productId: { type: 'string' },
    color: { type: 'string' },
    size: { type: 'string' },
    qty: { type: 'number' },
    notes: { type: 'string' },
  },
};

function systemPrompt(products) {
  const lines = products.slice(0, 40).map((p) => {
    const colors = p.color ? ` | الألوان:${p.color}` : '';
    const sizes = p.size ? ` | النمر:${p.size}` : '';
    return `- id:${p.id} | ${p.name}${colors}${sizes}`;
  }).join('\n');

  return `اقرئي المحادثةَ التاليةَ بين متجرٍ وزبون، واستخرجي منها بياناتِ الطلبِ كما قالها الزبونُ بنفسِه.

قواعد:
- لا تخمّني ولا تكملي من عندِك: ما لم يُذكَرْ صراحةً اتركيه فارغاً. حقلٌ فارغٌ خيرٌ من حقلٍ مخترع.
- name: الاسمُ الذي كتبَه الزبونُ للطلبِ إن كتبَه (لا اسمَ حسابِه على إنستغرام).
- phone: رقمُ الجوّالِ كما ورد.
- place: اسمُ البلدةِ أو القريةِ أو المدينةِ وحدَه (كلمةٌ أو كلمتان) — لا العنوانُ كلُّه. مثال: من «جنين - رابا - أول البلد» تكون place هي «رابا».
- address: بقيّةُ العنوانِ الوصفيُّ الذي يصلُ به المندوب (الشارعُ والعلامةُ المميّزة) بلا اسمِ البلدة.
- productId: معرّفُ القطعةِ من القائمةِ أدناه إن تبيّنَ أيَّ قطعةٍ يريد. إن لم يتبيّنْ فاتركيه فارغاً.
- color / size: اللونُ والنمرةُ كما طلبَهما، بنفسِ صيغةِ القائمة.
- qty: العددُ إن ذكرَه، وإلا 1.
- notes: أيُّ طلبٍ خاصٍّ ذكرَه (تغليفُ هديّةٍ، وقتُ تسليمٍ مفضَّل…).

قطعُ المتجر:
${lines}`;
}

async function callClaude(system, convo) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        tools: [{ name: 'extract', description: 'بياناتُ الطلبِ من المحادثة.', input_schema: SCHEMA }],
        tool_choice: { type: 'tool', name: 'extract' },
        messages: [{ role: 'user', content: convo }],
      }),
    });
    if (!r.ok) throw new Error(`claude ${r.status}`);
    const data = await r.json();
    const tool = Array.isArray(data.content) ? data.content.find((b) => b.type === 'tool_use') : null;
    return tool?.input || {};
  } finally { clearTimeout(timer); }
}

async function callGemini(system, convo) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: convo }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 600, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const data = await r.json();
    try { return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'); } catch { return {}; }
  } finally { clearTimeout(timer); }
}

// الاحتياطيُّ بلا مفتاحِ ذكاء: الرقمُ وحدَه يُلتقَطُ بنمطٍ صريح. ما عداه يبقى
// للتاجرة — تخمينٌ خاطئٌ باسمٍ أو ببلدةٍ أسوأُ من خانةٍ فارغة.
function fallback(convo) {
  const digits = convo.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = digits.match(/(?:\+?9[75]0?)?0?5\d[\s-]?\d{3}[\s-]?\d{4}/);
  return { phone: m ? normalizePhone(m[0]) : '' };
}

// حدُّ الكلمة: هل يردُ هذا الاسمُ كلمةً مستقلّةً في النصّ؟ الاحتواءُ المجرّدُ
// يقتطعُ كلمةً من داخلِ كلمة — و«جنين» تحوي «نين» وهي قريةٌ تابعةٌ للناصرة.
const ARABIC_WORD = /[ء-يa-z0-9]/;
function occursAsWord(hay, needle) {
  const n = norm(needle);
  if (!n || !hay) return false;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(n, from);
    if (i === -1) return false;
    const before = i === 0 ? '' : hay[i - 1];
    const after = hay[i + n.length] || '';
    if (!ARABIC_WORD.test(before) && !ARABIC_WORD.test(after)) return true;
    from = i + 1;
  }
}

// الناسُ لا تكتبُ اسمَ الجدولِ حرفيّاً: تكتبُ «رام الله» والجدولُ يقولُ «رام الله
// والبيرة»، وتكتبُ «الطيبة» والجدولُ يقولُ «الطيبة (رام الله)». فلكلِّ مكانٍ
// أسماؤُه المقبولة: الاسمُ كما هو، وبلا القوسِ، وما قبلَ الواوِ العاطفة.
const aliasCache = new Map();
function aliasesOf(name) {
  const base = norm(name);
  if (aliasCache.has(base)) return aliasCache.get(base);
  const out = new Set([base]);
  const noParen = base.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (noParen.length >= 3) out.add(noParen);
  const beforeAnd = noParen.split(/\s+و(?=\S)/)[0].trim();
  if (beforeAnd.length >= 4) out.add(beforeAnd);
  const list = [...out];
  aliasCache.set(base, list);
  return list;
}
const matchesPlace = (hay, z) => aliasesOf(z.name).some((a) => a.length >= 3 && occursAsWord(hay, a));

// البلدةُ تُطابَقُ على قائمةِ أماكنِ المتجرِ نفسِها (هي التي تحملُ الأجرة)، فلا
// يخرجُ اسمٌ لا يعرفُه التوصيل.
//
// وثلاثةُ أخطاءٍ وقعت هنا فعلاً، كلُّها من مطابقةٍ متساهلة:
//
// ١) `norm(z.name).includes(n)` كانت تجعلُ أيَّ شُظيّةٍ تلتقطُ قريةً عشوائيّة:
//    «او» تُخرِجُ «قراوة بني حسان»، و«وف» تُخرِجُ «عرابة البطوف». حُذِفَ هذا
//    الاتّجاهُ كلُّه — اسمُ المكانِ يردُ داخلَ ما كُتِبَ لا العكس.
//
// ٢) الاحتواءُ بلا حدودِ كلمة: «جنين» تحوي «نين»، وتفضيلُ القرى كان يُقدّمُها
//    على «جنين» نفسِها فيصيرُ طلبُ جنينَ طلبَ الناصرة.
//
// ٣) والأخطر: اسمٌ لم يُذكَرْ بالمحادثةِ أصلاً. أعادَ النموذجُ «طولكرم - شوفة»
//    لزبونٍ كتبَ «جنين - رابا» — و«شوفة» ليست في جدولِنا إطلاقاً. فما يختارُه
//    النموذجُ يجبُ أن يظهرَ بنصِّ المحادثة، وإلّا أُهمِلَ وقرأنا النصَّ بأنفسِنا.
function resolvePlace(place, text, localities) {
  const list = Array.isArray(localities) ? localities : [];
  const t = norm(text || '');
  // القريةُ تُقدَّمُ على المدينةِ حين تُذكَرانِ معاً: «جنين - رابا» تعني رابا،
  // وهي ما يحتاجُه المندوبُ فعلاً. والأجرةُ واحدةٌ فلا خسارةَ في أيِّ الحالتين.
  const best = (a, b) => {
    const av = a.parent && a.parent !== a.name ? 1 : 0;
    const bv = b.parent && b.parent !== b.name ? 1 : 0;
    return (bv - av) || (norm(b.name).length - norm(a.name).length);
  };
  const pick = (needle) => {
    const n = norm(needle);
    if (n.length < 3) return null;
    const exact = list.find((z) => norm(z.name) === n);
    if (exact) return exact;
    return list.filter((z) => matchesPlace(n, z)).sort(best)[0] || null;
  };

  // ما استخرجَه النموذجُ أوّلاً — بشرطِ أن يكونَ من كلامِ الزبونِ لا من رأسِه
  let hit = pick(place);
  if (hit && t && !matchesPlace(t, hit)) hit = null;
  if (!hit && t) hit = list.filter((z) => matchesPlace(t, z)).sort(best)[0] || null;
  if (!hit) return null;
  return {
    city: hit.parent || hit.name,
    area: (hit.parent && hit.parent !== hit.name) ? hit.name : '',
    fee: Number(hit.fee) || 0,
  };
}

/**
 * يقرأُ المحادثةَ ويُعيدُ مسوّدةً مُتحقَّقاً منها.
 * messages: [{ direction:'in'|'out', text }]
 */
export async function extractOrderDraft({ messages, products, localities }) {
  const convo = messages
    .filter((m) => String(m.text || '').trim())
    .slice(-25)
    .map((m) => `${m.direction === 'in' ? 'الزبون' : 'المتجر'}: ${String(m.text).trim().slice(0, 300)}`)
    .join('\n');
  if (!convo) return { found: false };

  let raw = {};
  let usedAi = false;
  if (process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      const system = systemPrompt(products);
      raw = process.env.ANTHROPIC_API_KEY ? await callClaude(system, convo) : await callGemini(system, convo);
      usedAi = true;
    } catch (err) {
      console.error('⚠️ استخراج الطلب:', err.message);
    }
  }
  if (!usedAi) raw = fallback(convo);

  // ── التحقّق ──
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const product = byId.get(String(raw.productId || '')) || null;

  // اللونُ والنمرةُ لا يُقبلانِ إلّا إن كانا من خياراتِ القطعةِ نفسِها
  const optionList = (v) => String(v || '').split(/[،,/]/).map((x) => x.trim()).filter(Boolean);
  const colorOk = (c) => {
    if (!product || !c) return '';
    const cs = product.color_stock && typeof product.color_stock === 'object' ? product.color_stock : {};
    const all = Object.keys(cs).length ? Object.keys(cs) : optionList(product.color);
    return all.find((x) => norm(x) === norm(c)) || '';
  };
  const sizeOk = (s) => {
    if (!product || !s) return '';
    const cs = product.color_stock && typeof product.color_stock === 'object' ? product.color_stock : {};
    const set = new Set();
    for (const sizes of Object.values(cs)) Object.keys(sizes || {}).forEach((x) => set.add(x));
    const all = set.size ? [...set] : optionList(product.size);
    return all.find((x) => norm(x) === norm(s)) || '';
  };

  const place = resolvePlace(raw.place, convo, localities);
  return {
    found: true,
    usedAi,
    name: String(raw.name || '').trim().slice(0, 100),
    phone: normalizePhone(raw.phone),
    city: place?.city || '',
    area: place?.area || '',
    deliveryFee: place ? String(place.fee) : '',
    address: String(raw.address || '').trim().slice(0, 200),
    notes: String(raw.notes || '').trim().slice(0, 200),
    productId: product ? String(product.id) : '',
    color: colorOk(raw.color),
    size: sizeOk(raw.size),
    qty: Math.max(1, Math.min(10, Number(raw.qty) || 1)),
  };
}

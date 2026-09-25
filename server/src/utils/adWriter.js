// كاتبةُ الإعلان — تكتبُ ثلاثَ نسخٍ لقطعةٍ بعينِها، وتقترحُ جمهوراً وميزانية.
//
// ما تكتبُه يُنشَرُ باسمِ التاجرةِ ويُصرَفُ عليه مال، فالقاعدةُ نفسُها التي تحكمُ
// البائعةَ الآليّةَ تحكمُ هنا: **النموذجُ يكتبُ، والخادمُ يقرّر.** السعرُ والتوفّرُ
// يُقرآنِ من القاعدةِ ويُحقنانِ بالنصِّ حقناً، والميزانيّةُ تُحسَبُ بقاعدةٍ لا
// يخترعُها نموذج — نصيحةٌ ماليّةٌ يخمّنُها نموذجٌ أسوأُ من لا نصيحة.
//
// وبلا مفتاحِ ذكاءٍ لا يتعطّل: قوالبُ مكتوبةٌ بعنايةٍ تملأُ من بياناتِ القطعة.

const GOALS = {
  sales: { ar: 'مبيعات', cta: 'اطلبيها الآن' },
  traffic: { ar: 'زيارات للمتجر', cta: 'شوفي التشكيلة' },
  messages: { ar: 'رسائل', cta: 'راسلينا' },
  awareness: { ar: 'تعريف بالمتجر', cta: 'تعرّفي علينا' },
};

export const GOAL_KEYS = Object.keys(GOALS);

// اللهجةُ تُفرَضُ بأمثلةٍ لا باسمِها. قلنا للنموذجِ «بلهجةٍ فلسطينيّةٍ محكيّة»
// فكتبَ «حطّ في الكارت الحين» و«شنو اللي تدوّري عليه» — خليجيّةٌ صريحة. النماذجُ
// تنجرفُ إلى أشهرِ لهجةٍ بتدريبِها ما لم تُمسَك بكلماتٍ بعينِها. وهذه الخريطةُ
// نفسُها تحكمُ البائعةَ الآليّة، فيخرجُ صوتُ المتجرِ واحداً بالمحادثةِ والإعلان.
const DIALECTS = {
  ps: 'الفلسطينيّة المحكيّة: بدّي، كتير، مش، هيك، منيح، شو، لسّا، هلّق، عنّا.',
  sy: 'الشاميّة المحكيّة: بدّي، كتير، شو، هلّق، منيح، هيك.',
  eg: 'المصريّة المحكيّة: عايزة، أوي، إزاي، دلوقتي، كده، جامد.',
  gulf: 'الخليجيّة المحكيّة: أبغى، وايد، شنو، الحين، زين، تبين.',
  msa: 'العربيّة الفصحى المبسّطة بلا تقعّر.',
};
export const DIALECT_KEYS = Object.keys(DIALECTS);

// ───────────────────── حقائقُ القطعة ─────────────────────

function inStockBits(p) {
  const cs = p.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const ss = p.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
  const colors = Object.entries(cs)
    .filter(([, sizes]) => Object.values(sizes || {}).some((q) => Number(q) > 0))
    .map(([c]) => c);
  const sizes = new Set();
  for (const sizesOf of Object.values(cs)) {
    for (const [sz, q] of Object.entries(sizesOf || {})) if (Number(q) > 0) sizes.add(sz);
  }
  for (const [sz, q] of Object.entries(ss)) if (Number(q) > 0) sizes.add(sz);
  if (!colors.length && p.color) colors.push(...String(p.color).split(/[،,/]/).map((x) => x.trim()).filter(Boolean));
  if (!sizes.size && p.size) String(p.size).split(/[،,/]/).forEach((x) => x.trim() && sizes.add(x.trim()));
  return { colors: colors.slice(0, 6), sizes: [...sizes].slice(0, 8) };
}

function saleInfo(p) {
  const old = p.old_price != null ? Number(p.old_price) : null;
  const ends = p.sale_ends_at ? new Date(p.sale_ends_at) : null;
  const live = Boolean(ends && ends > new Date() && old && old > Number(p.price));
  if (!live) return null;
  const off = Math.round(((old - Number(p.price)) / old) * 100);
  const hours = Math.max(1, Math.round((ends - new Date()) / 3600000));
  return { old, off, hours };
}

// ميزانيّةٌ تبدأُ صغيرةً وتُحسَبُ لا تُخمَّن: ما يكفي لتُري الإعلانَ لعددٍ معقولٍ
// قبلَ أن تقرّري إن كان يستحقُّ الاستمرار. القاعدةُ: ثمنُ قطعةٍ واحدةٍ تقريباً
// موزَّعاً على خمسةِ أيّام، بحدٍّ أدنى خمسةَ عشرَ شيقلاً وأقصى ثمانين — فوقَهما
// يصيرُ قراراً لا اقتراحاً.
export function suggestBudget(price) {
  const p = Math.max(0, Number(price) || 0);
  const daily = Math.round((p / 5) / 5) * 5;
  return { budget: Math.max(15, Math.min(80, daily || 15)), days: 5 };
}

// جمهورٌ مبدئيٌّ بحسبِ الفئة. ليس بحثاً سوقيّاً — هو نقطةُ بدءٍ تعدّلُها التاجرةُ،
// ومكتوبٌ بصراحةٍ أنّه كذلك بالواجهة.
const AUDIENCE = {
  dress: { ageMin: 20, ageMax: 40, interests: ['فساتين سهرة', 'أزياء نسائية', 'مناسبات'] },
  abaya: { ageMin: 22, ageMax: 50, interests: ['عبايات', 'أزياء محتشمة', 'حجاب'] },
  hijab: { ageMin: 18, ageMax: 45, interests: ['حجاب', 'أزياء محتشمة', 'طرح'] },
  set: { ageMin: 18, ageMax: 38, interests: ['أطقم نسائية', 'موضة', 'ستايل يومي'] },
  jacket: { ageMin: 18, ageMax: 40, interests: ['جاكيتات', 'موضة شتوية'] },
  trench: { ageMin: 22, ageMax: 45, interests: ['معاطف', 'موضة شتوية'] },
  shirt: { ageMin: 18, ageMax: 40, interests: ['بلوزات', 'ملابس عمل', 'ستايل يومي'] },
  // الفئتان العامّتان لقسمَي الأحذية والإكسسوارات — ولكلّ فئةٍ خاصّةٍ فيهما
  shoes: { ageMin: 18, ageMax: 45, interests: ['أحذية نسائية', 'كعب عالي', 'موضة'] },
  accessory: { ageMin: 18, ageMax: 45, interests: ['حقائب نسائية', 'إكسسوارات', 'مجوهرات'] },
};

export function suggestAudience(category, department = 'clothing') {
  // فئةٌ خاصّة («كعب عالي» عند متجرٍ واحد) تأخذ جمهور قسمها
  const key = AUDIENCE[category] ? category : department === 'shoes' ? 'shoes' : department === 'accessories' ? 'accessory' : category;
  const base = AUDIENCE[key] || { ageMin: 18, ageMax: 45, interests: ['أزياء نسائية', 'تسوّق أونلاين'] };
  return { ...base, genders: 'female', locations: ['الضفة الغربية', 'القدس'] };
}

// ───────────────────── القوالبُ المجّانيّة ─────────────────────

function fallbackCopies(p, store, goal) {
  const { colors, sizes } = inStockBits(p);
  const sale = saleInfo(p);
  const cta = GOALS[goal]?.cta || GOALS.sales.cta;
  const colorLine = colors.length ? `متوفّرة بـ${colors.slice(0, 3).join(' و')}` : '';
  const sizeLine = sizes.length ? `النمر: ${sizes.join('، ')}` : '';
  const priceLine = sale ? `السعر ${Number(p.price)}₪ بدل ${sale.old}₪` : `السعر ${Number(p.price)}₪`;
  const tags = [p.department === 'shoes' ? '#أحذية_نسائية' : p.department === 'accessories' ? '#إكسسوارات' : '#أزياء_نسائية', '#فلسطين', `#${String(store.name || '').replace(/\s+/g, '_')}`, '#تسوق_اونلاين'];

  return [
    {
      headline: sale ? `خصم ${sale.off}٪ على ${p.name}` : `${p.name} — جديد عنّا`,
      primary: [`${p.name} 🌷`, colorLine, sizeLine, priceLine, cta].filter(Boolean).join('\n'),
      cta, hashtags: tags,
    },
    {
      headline: `${p.name} بمتجر ${store.name}`,
      primary: [
        `في قطع بتلبسك من أول مرة — و${p.name} وحدة منهن.`,
        colorLine, priceLine,
        'الطلب من الموقع بضغطة.',
        cta,
      ].filter(Boolean).join('\n'),
      cta, hashtags: tags,
    },
    {
      headline: sizes.length ? `النمر المتوفّرة: ${sizes.slice(0, 4).join('، ')}` : `${p.name}`,
      primary: [
        `بتدوّري على ${p.name}؟`,
        sizeLine || colorLine,
        priceLine,
        sale ? `العرض لآخر ${sale.hours} ساعة ⏳` : 'الكمية محدودة.',
        cta,
      ].filter(Boolean).join('\n'),
      cta, hashtags: tags,
    },
  ];
}

// ───────────────────── الطبقةُ الذكيّة ─────────────────────

const SCHEMA = {
  type: 'object',
  properties: {
    copies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          primary: { type: 'string' },
          cta: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
        required: ['headline', 'primary'],
      },
    },
  },
  required: ['copies'],
};

function systemPrompt(p, store, goal, tone, dialect) {
  const { colors, sizes } = inStockBits(p);
  const sale = saleInfo(p);
  const facts = [
    `الاسم: ${p.name}`,
    `السعر: ${Number(p.price)} شيكل`,
    sale ? `عرضٌ قائم: كان ${sale.old} شيكل (خصم ${sale.off}٪) وينتهي بعد ${sale.hours} ساعة` : 'لا عرضَ قائماً',
    colors.length ? `الألوان المتوفّرة الآن: ${colors.join('، ')}` : 'الألوان: غير محدّدة',
    sizes.length ? `النمر المتوفّرة الآن: ${sizes.join('، ')}` : 'النمر: غير محدّدة',
    p.description ? `الوصف: ${String(p.description).replace(/\s+/g, ' ').slice(0, 200)}` : '',
  ].filter(Boolean).join('\n');

  return `أنتِ كاتبةُ إعلاناتٍ لمتاجرِ الأزياءِ النسائيّةِ في فلسطين. تكتبينَ لمتجرِ "${store.name}".

اكتبي **ثلاثةَ إعلاناتٍ مختلفةٍ فعلاً** لهذه القطعةِ على فيسبوك وإنستغرام. مختلفةٌ بالزاويةِ لا بالكلمات: الأوّلُ مباشرٌ بالعرضِ والسعر، والثاني يخاطبُ شعورَ الزبونةِ ومناسبتَها، والثالثُ يبدأُ بسؤالٍ أو بحاجةٍ ملموسة.

الهدفُ الإعلانيّ: ${GOALS[goal]?.ar || 'مبيعات'}.
النبرة: ${tone === 'luxury' ? 'راقيةٌ هادئة' : tone === 'playful' ? 'مرحةٌ خفيفة' : 'دافئةٌ قريبة'}.
**اللهجة (إلزاميّة): ${DIALECTS[dialect] || DIALECTS.ps}** لا تكتبي بلهجةٍ أخرى ولا بكلماتٍ من لهجةٍ أخرى مهما بدت مألوفة.
المخاطَبةُ بصيغةِ المؤنّثِ دائماً (بتحبّي، إلك، شوفي) — الجمهورُ سيّدات.

قواعدُ لا تُكسَر:
- لا تخترعي لوناً ولا نمرةً ولا سعراً ولا خصماً غيرَ المكتوبِ بالحقائقِ أدناه. القطعةُ التي لا عرضَ عليها لا تُكتَبُ لها كلمةُ «خصم».
- لا تَعِدي بتوصيلٍ مجّانيٍّ ولا بموعدِ وصولٍ ولا بإرجاعٍ — لا نعرفُ سياسةَ هذا المتجر.
- لا تقولي «الأفضل» ولا «الأرخص» ولا أيَّ ادّعاءٍ لا يُثبَت.
- النمرُ تُذكَرُ كما هي مفصولةً بفواصل. **ممنوعٌ المدى بكلِّ صيغِه**: لا «٣٦ إلى ٤٤» ولا «من ٣٦ لحدّ ٤٤» ولا «كلُّ المقاسات» — المدى يَعِدُ بنمرٍ بينهما قد تكونُ نفدت.
- لا تستعملي كلمةَ «نسخة» ولا «الخيار الأوّل/الثاني» بنصِّ الإعلان: هذه كلماتُنا نحن، والزبونةُ تقرأُ إعلاناً واحداً لا قائمة.
- primary: أربعةُ أسطرٍ كحدٍّ أقصى، كلُّ سطرٍ قصير. لا فقراتٍ طويلة. إيموجي واحدٌ أو اثنانِ بالنسخةِ كلِّها.
- headline: ستُّ كلماتٍ كحدٍّ أقصى — تُقرأُ بلمحةٍ فوقَ الصورة.
- hashtags: من أربعةٍ إلى ستّةٍ عربيّةٍ مناسبة.

حقائقُ القطعة (المصدرُ الوحيدُ المسموح):
${facts}`;
}

async function callClaude(system) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system,
        tools: [{ name: 'write', description: 'ثلاثُ نسخٍ إعلانيّة.', input_schema: SCHEMA }],
        tool_choice: { type: 'tool', name: 'write' },
        messages: [{ role: 'user', content: 'اكتبي النسخَ الثلاث.' }],
      }),
    });
    if (!r.ok) throw new Error(`claude ${r.status}`);
    const data = await r.json();
    const tool = Array.isArray(data.content) ? data.content.find((b) => b.type === 'tool_use') : null;
    return tool?.input || {};
  } finally { clearTimeout(timer); }
}

async function callGemini(system) {
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
        contents: [{ role: 'user', parts: [{ text: 'اكتبي النسخَ الثلاث.' }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 1200, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const data = await r.json();
    try { return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'); } catch { return {}; }
  } finally { clearTimeout(timer); }
}

// ───────────────────── التحقّقُ قبلَ العرض ─────────────────────

// النسخةُ التي تَعِدُ بخصمٍ لا وجودَ له، أو بسعرٍ غيرِ سعرِ القطعة، لا تُعرَضُ
// على التاجرةِ لتكتشفَها بنفسِها — الإعلانُ يُقرأُ بسرعةٍ ويُنشَرُ بسرعة.
function sanitize(out, p, goal) {
  const sale = saleInfo(p);
  const price = Number(p.price);
  const { sizes } = inStockBits(p);
  const sizeSet = new Set(sizes.map(String));
  const sizeList = sizes.join('، ');
  const clean = [];
  for (const c of Array.isArray(out.copies) ? out.copies : []) {
    let primary = String(c?.primary || '').trim().slice(0, 600);
    let headline = String(c?.headline || '').trim().slice(0, 80);
    if (!primary || !headline) continue;

    // ادّعاءُ خصمٍ على قطعةٍ بلا عرضٍ قائم: يُشطَبُ السطرُ كلُّه
    if (!sale) {
      primary = primary.split('\n')
        .filter((line) => !/(خصم|تخفيض|بدل\s*\d|كان\s*\d|sale|off)/i.test(line))
        .join('\n');
      headline = /(خصم|تخفيض|sale)/i.test(headline) ? p.name : headline;
    }
    // أيُّ سعرٍ مذكورٍ يجبُ أن يكونَ سعرَ القطعةِ أو سعرَها القديمَ إن كان بعرض
    const allowed = new Set([String(price), String(Math.round(price)), sale ? String(sale.old) : '']);
    primary = primary.replace(/(\d+(?:[.,]\d+)?)\s*(₪|شيكل|شيقل|ils)/gi, (m, n, cur) => (
      allowed.has(String(Number(String(n).replace(',', '.')))) ? m : `${price} ${cur}`
    ));

    // «٣٦ لـ ٤٤» تَعِدُ بنمرٍ بينهما قد تكونُ نفدت. نستبدلُها بالقائمةِ الحقيقيّةِ
    // متى كان طرفاها نمرتينِ متوفّرتينِ فعلاً — فلا نلمسُ رقماً ليس مقاساً.
    if (sizeList) {
      const range = /(\d{2})\s*(?:إلى|الى|لحدّ|لحد|حتى|لـ|ل|[-–—])\s*(\d{2})/g;
      const fix = (m, a, b) => (sizeSet.has(a) && sizeSet.has(b) ? sizeList : m);
      primary = primary.replace(range, fix);
      headline = headline.replace(range, fix);
      primary = primary.replace(/(كلّ|كل)\s+(المقاسات|النمر)(\s+متوفّرة|\s+موجودة)?/g, sizeList);
    }

    clean.push({
      headline,
      primary,
      cta: String(c?.cta || '').trim().slice(0, 30) || GOALS[goal]?.cta || GOALS.sales.cta,
      hashtags: (Array.isArray(c?.hashtags) ? c.hashtags : [])
        .map((h) => String(h).trim().replace(/^#*/, '#').replace(/\s+/g, '_'))
        .filter((h) => h.length > 1).slice(0, 6),
    });
    if (clean.length === 3) break;
  }
  return clean;
}

// ───────────────────── المدخلُ الوحيد ─────────────────────

export async function writeAd({ product, store, goal = 'sales', tone = 'warm', dialect = 'ps' }) {
  const g = GOAL_KEYS.includes(goal) ? goal : 'sales';
  let copies = [];
  let usedAi = false;

  if (process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      const system = systemPrompt(product, store, g, tone, DIALECTS[dialect] ? dialect : 'ps');
      const out = process.env.ANTHROPIC_API_KEY ? await callClaude(system) : await callGemini(system);
      copies = sanitize(out, product, g);
      usedAi = copies.length > 0;
    } catch (err) {
      console.error('⚠️ كاتبة الإعلان — سقوطٌ للقوالب:', err.message);
    }
  }
  // نكملُ الناقصَ بالقوالبِ لا نستبدلُ الموجود: نسختانِ ذكيّتانِ وثالثةٌ من قالبٍ
  // أفضلُ من إعادةِ الطلبِ (ثانيتانِ وتكلفةٌ) أو من عرضِ نسختينِ فقط.
  if (copies.length < 3) {
    const filler = fallbackCopies(product, store, g);
    copies = [...copies, ...filler].slice(0, 3);
  }

  const { colors, sizes } = inStockBits(product);
  return {
    copies,
    usedAi,
    audience: suggestAudience(product.category, product.department),
    ...suggestBudget(product.price),
    facts: { colors, sizes, sale: saleInfo(product), price: Number(product.price) },
  };
}

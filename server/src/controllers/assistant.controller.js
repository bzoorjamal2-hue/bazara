import { query } from '../config/db.js';
import { mapProduct } from './product.controller.js';
import { activeStoreSql } from '../utils/subscription.js';

// مساعِدة التسوّق الذكية — ترشّح للزبونة قطعاً من منتجات هذا المتجر فقط (grounding).
// تعمل بثلاث طبقات حسب المتوفّر، فلا تتعطّل أبداً وتشتغل مجاناً افتراضياً:
//   1) بلا أي مفتاح → محرّك ترشيح بقواعد ذكية (مجاني للأبد، بلا حدود).
//   2) GEMINI_API_KEY → ذكاء اصطناعي مجاني من Google.
//   3) ANTHROPIC_API_KEY → Claude (أرقى جودة).
// المفاتيح تبقى على الخادم ولا تصل المتصفّح. لو فشل مزوّد الذكاء نسقط للقواعد تلقائياً.

const MAX_PRODUCTS = 60;   // سقف الكتالوج الكامل (للمحرّك المجاني — بلا توكنات)
const AI_CATALOG = 40;     // سقف الكتالوج المُمرَّر للذكاء (أقل توكنات)
const MAX_MESSAGES = 10;   // سقف رسائل المحادثة المخزّنة
const AI_HISTORY = 6;      // آخر رسائل تُرسل للذكاء (توفير توكن)
const TOP_N = 6;           // عدد القطع المقترحة كحدّ أقصى
const CATALOG_TTL = 3 * 60 * 1000; // كاش الكتالوج لكل متجر (يقلّل ضغط القاعدة)

// كاش كتالوج بالذاكرة لكل متجر — معزول تماماً بمفتاح السلَگ (لا تشابك بين المتاجر)
const catalogCache = new Map(); // slug -> { rows, ts }

const CATALOG_SELECT = `
  SELECT p.id, p.name, p.description, p.category, p.price, p.old_price, p.sale_ends_at,
         p.size, p.color, p.stock, p.featured,
         s.slug AS store_slug, s.name AS store_name
  FROM products p
  JOIN stores s ON s.id = p.store_id
  JOIN users u ON u.id = s.user_id
`;

function onSale(p) {
  const old = p.old_price != null ? Number(p.old_price) : null;
  const ends = p.sale_ends_at ? new Date(p.sale_ends_at) : null;
  return Boolean(ends && ends > new Date() && old && old > Number(p.price));
}

// ───────────────────── أدوات نصّية عربية ─────────────────────
function normalizeAr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ً-ْ]/g, '')       // إزالة التشكيل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')                      // التطويل
    .trim();
}
function hasArabic(s) { return /[؀-ۿ]/.test(String(s || '')); }

// ───────────────────── محرّك القواعد (الطبقة المجانية) ─────────────────────
const BUILTIN = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// مرادفات الفئات (عربي/إنجليزي) → مفتاح الفئة
const CAT_WORDS = {
  abaya: ['عبايه', 'عباءه', 'عباية', 'abaya', 'abayas'],
  set: ['طقم', 'سيت', 'تنوره وبلوزه', 'set', 'co-ord', 'twopiece', 'two-piece'],
  dress: ['فستان', 'فساتين', 'سهره', 'dress', 'dresses', 'gown'],
  hijab: ['حجاب', 'طرحه', 'شيله', 'اسدال', 'خمار', 'hijab', 'scarf', 'veil'],
  trench: ['ترنش', 'معطف', 'كوت', 'بالطو', 'trench', 'coat'],
  jacket: ['جاكيت', 'جاكت', 'جكيت', 'بليزر', 'jacket', 'blazer'],
  shirt: ['قميص', 'بلوزه', 'توب', 'shirt', 'blouse', 'top'],
};

// مناسبات → فئات مرجّحة
const OCCASION_CAT = {
  wedding: { words: ['عرس', 'زفاف', 'خطوبه', 'سهره', 'حفله', 'مناسبه', 'عيد', 'wedding', 'party', 'evening', 'engagement', 'gala'], cats: ['dress', 'abaya', 'set'] },
  everyday: { words: ['يومي', 'كاجوال', 'مريح', 'بيت', 'casual', 'everyday', 'comfy', 'daily'], cats: ['shirt', 'set', 'jacket'] },
  work: { words: ['شغل', 'دوام', 'عمل', 'مكتب', 'رسمي', 'work', 'office', 'formal'], cats: ['set', 'shirt', 'trench'] },
  winter: { words: ['شتا', 'شتاء', 'برد', 'دفا', 'winter', 'cold'], cats: ['trench', 'jacket', 'abaya'] },
  summer: { words: ['صيف', 'صيفي', 'حر', 'summer'], cats: ['dress', 'shirt', 'set'] },
};

// ألوان (مرادفات) → كلمة قياسية تُطابَق مع نص لون المنتج
const COLOR_WORDS = {
  اسود: ['اسود', 'سوداء', 'black'], ابيض: ['ابيض', 'بيضاء', 'white', 'اوف وايت', 'off white'],
  احمر: ['احمر', 'حمراء', 'red'], وردي: ['وردي', 'زهري', 'روز', 'بينك', 'pink', 'rose'],
  ازرق: ['ازرق', 'زرقاء', 'blue', 'سماوي', 'لبني', 'sky'], كحلي: ['كحلي', 'نيلي', 'navy'],
  اخضر: ['اخضر', 'خضراء', 'green', 'زيتي', 'olive'], بيج: ['بيج', 'جملي', 'beige', 'nude', 'نهدي', 'نود'],
  ذهبي: ['ذهبي', 'gold', 'golden'], فضي: ['فضي', 'silver'],
  بني: ['بني', 'brown', 'كافيه', 'بنّي'], رمادي: ['رمادي', 'gray', 'grey', 'شاركول', 'charcoal', 'رصاصي'],
  بنفسجي: ['بنفسجي', 'موف', 'purple', 'lilac', 'ليلكي'], اصفر: ['اصفر', 'yellow'],
  خمري: ['خمري', 'عنابي', 'نبيتي', 'maroon', 'burgundy', 'wine'],
  برتقالي: ['برتقالي', 'orange', 'مشمشي'], تركوازي: ['تركواز', 'تركوازي', 'turquoise', 'teal'],
  كريمي: ['كريمي', 'عاجي', 'cream', 'ivory'], فوشي: ['فوشي', 'فوشيا', 'fuchsia', 'magenta'],
};

// كلمات التحية والشكر (دردشة بلا نيّة شراء)
const GREET_WORDS = ['مرحبا', 'مرحبتين', 'هلا', 'اهلا', 'اهلين', 'السلام', 'سلام', 'صباح', 'مساء', 'هاي', 'هلو', 'كيفك', 'شلونك', 'شخبارك', 'وينك', 'hi', 'hello', 'hey', 'yo'];
const THANKS_WORDS = ['شكرا', 'شكرن', 'مشكوره', 'مشكور', 'يسلمو', 'تسلمي', 'يعطيك', 'ثانكس', 'thanks', 'thank', 'thx'];
const INTENT_WORDS = ['رخيص', 'ارخص', 'اقتصادي', 'ميزانيه', 'فخم', 'فخامه', 'راقي', 'غالي', 'فاخر', 'عرض', 'عروض', 'خصم', 'تخفيض', 'تنزيلات', 'مقاس', 'نمره', 'لون', 'cheap', 'budget', 'affordable', 'luxury', 'elegant', 'sale', 'offer', 'discount', 'size', 'color', 'colour'];

// هل في النصّ أي إشارة شراء (فئة/مناسبة/لون/سعر/مقاس)؟
function hasShoppingIntent(q) {
  const all = [
    ...Object.values(CAT_WORDS).flat(),
    ...Object.values(OCCASION_CAT).flatMap((o) => o.words),
    ...Object.values(COLOR_WORDS).flat(),
    ...INTENT_WORDS,
  ];
  return all.some((w) => q.includes(normalizeAr(w)));
}

// تصنيف الدردشة: تحية/شكر فقط إن لم تتضمّن أي نيّة شراء
function smalltalkType(text) {
  const q = normalizeAr(text);
  if (hasShoppingIntent(q)) return null;
  if (GREET_WORDS.some((w) => q.includes(normalizeAr(w)))) return 'greet';
  if (THANKS_WORDS.some((w) => q.includes(normalizeAr(w)))) return 'thanks';
  return null;
}

function smalltalkReply(type, lang) {
  const en = lang === 'en';
  if (type === 'thanks') {
    return en ? "You're most welcome 🌷 Happy to help anytime. Want me to suggest something else?"
              : 'العفو حبيبتي 🌷 دايماً بالخدمة. بتحبي أرشّحلك شي ثاني؟';
  }
  return en ? "Hello and welcome 🌷 I'm your style assistant — tell me the occasion or the kind of piece you're after and I'll find the best options for you."
            : 'أهلاً وسهلاً فيكِ 🌷 أنا مساعِدة الأناقة — قوليلي عن أي مناسبة أو نوع قطعة بتدوّري عليها وأرشّحلك أحلى الخيارات.';
}

export function ruleBasedRecommend(rows, lastUserMsg, lang) {
  const q = normalizeAr(lastUserMsg);
  const en = lang === 'en';

  // كشف النيّة
  const wantedCats = new Set();
  for (const [cat, words] of Object.entries(CAT_WORDS)) {
    if (words.some((w) => q.includes(normalizeAr(w)))) wantedCats.add(cat);
  }
  const occasionCats = new Set();
  let occasionLabel = '';
  for (const o of Object.values(OCCASION_CAT)) {
    if (o.words.some((w) => q.includes(normalizeAr(w)))) {
      o.cats.forEach((c) => occasionCats.add(c));
      if (!occasionLabel) occasionLabel = o.words[0];
    }
  }
  const wantedColors = [];
  for (const [canon, words] of Object.entries(COLOR_WORDS)) {
    if (words.some((w) => q.includes(normalizeAr(w)))) wantedColors.push(canon);
  }
  const wantCheap = ['رخيص', 'ارخص', 'اقتصادي', 'ميزانيه', 'بسيط', 'cheap', 'budget', 'affordable'].some((w) => q.includes(normalizeAr(w)));
  const wantLux = ['فخم', 'فخامه', 'راقي', 'غالي', 'فاخر', 'luxury', 'elegant', 'premium'].some((w) => q.includes(normalizeAr(w)));
  const wantSale = ['عرض', 'عروض', 'خصم', 'تخفيض', 'تنزيلات', 'sale', 'offer', 'discount'].some((w) => q.includes(normalizeAr(w)));

  const maxPrice = Math.max(1, ...rows.map((p) => Number(p.price)));

  const scored = rows.map((p) => {
    let score = 0;
    const cat = p.category;
    if (wantedCats.has(cat)) score += 6;
    if (occasionCats.has(cat)) score += 3;

    if (wantedColors.length) {
      const col = normalizeAr(`${p.color} ${p.name} ${p.description || ''}`);
      if (wantedColors.some((c) => col.includes(c) || COLOR_WORDS[c].some((w) => col.includes(normalizeAr(w))))) score += 5;
    }
    if (wantSale && onSale(p)) score += 5;
    if (p.featured) score += 1;

    // مطابقة كلمات حرّة من الاسم/الوصف
    const hay = normalizeAr(`${p.name} ${p.description || ''}`);
    q.split(/\s+/).filter((w) => w.length >= 3).forEach((w) => { if (hay.includes(w)) score += 1; });

    // نيّة السعر
    if (wantCheap) score += (1 - Number(p.price) / maxPrice) * 3;
    if (wantLux) score += (Number(p.price) / maxPrice) * 2 + (p.featured ? 1 : 0);

    if (p.stock === 0) score -= 8; // المتوفّر أولاً
    return { p, score };
  });

  // دوال مطابقة دقيقة للون/الفئة على مستوى القطعة
  // نقرأ اللون من حقل اللون + اسم المنتج + وصفه (مثل "ترانش كوت خمري")
  const itemColor = (p) => {
    if (!wantedColors.length) return false;
    const col = normalizeAr(`${p.color} ${p.name} ${p.description || ''}`);
    return wantedColors.some((c) => col.includes(c) || COLOR_WORDS[c].some((w) => col.includes(normalizeAr(w))));
  };
  const itemCat = (p) => wantedCats.has(p.category);

  const askedColor = wantedColors.length > 0;
  const askedCat = wantedCats.size > 0;

  let picks = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  // أولوية صارمة: نطابق اللون و/أو الفئة المطلوبة فعلياً، فلا نعرض لوناً/نوعاً غلط كأنه مطابق
  const both = picks.filter((s) => itemColor(s.p) && itemCat(s.p));
  const colorOnly = picks.filter((s) => itemColor(s.p));
  const catOnly = picks.filter((s) => itemCat(s.p));
  if (askedColor && askedCat && both.length) picks = both;
  else if (askedColor && colorOnly.length) picks = colorOnly;
  else if (askedCat && catOnly.length) picks = catOnly;

  // لا شيء طابق إطلاقاً → أبرز القطع (مميّزة ثم المتوفّر أولاً)
  if (picks.length === 0) {
    picks = [...scored].sort((a, b) => (b.p.featured - a.p.featured) || (a.p.stock === 0 ? 1 : -1));
  }
  const ids = picks.slice(0, TOP_N).map((s) => String(s.p.id));

  // رسالة صادقة بحسب ما أمكن تلبيته فعلاً (لا ندّعي مطابقة غير موجودة)
  const colorMissing = askedColor && colorOnly.length === 0;
  const catMissing = askedCat && catOnly.length === 0;
  let reply;
  if (en) {
    if (colorMissing) reply = "I couldn't find that exact color 🌷 here are the closest pieces — or try another color, or message the store.";
    else if (catMissing) reply = "We don't have that exact type right now 🌷 here are the closest pieces you might like.";
    else if (askedColor || askedCat || occasionCats.size || wantSale) reply = 'Here are pieces that match what you asked for 🌷 want me to refine by size or budget?';
    else reply = "Here are some of our standout pieces 🌷 tell me the occasion, a color, or your budget and I'll narrow it down.";
  } else {
    if (colorMissing) reply = 'ما لقيت قطع باللون اللي طلبتيه بالضبط 🌷 بس هاي أقرب الخيارات — جرّبي لون ثاني أو راسلي المتجر.';
    else if (catMissing) reply = 'ما عندنا قطع من هالنوع حالياً 🌷 بس هاي أقرب القطع اللي ممكن تعجبك.';
    else if (askedColor || askedCat || occasionCats.size || wantSale) reply = 'اخترتلك هالقطع اللي بتناسب طلبك 🌷 إذا بتحبي حدّديلي المقاس أو ميزانيتك وبضبّطلك أكثر.';
    else reply = 'تفضّلي أبرز القطع عنا 🌷 قوليلي المناسبة أو لون أو ميزانيتك وبرشّحلك بدقة أكبر.';
  }
  return { reply, ids };
}

// ───────────────────── الطبقة الذكية (اختيارية) ─────────────────────
function catalogLine(p, withStore = false) {
  const price = Number(p.price);
  const desc = (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 55);
  const parts = [`id:${p.id}`, `الاسم:${p.name}`, `الفئة:${p.category}`,
    onSale(p) ? `السعر:${price} (كان ${Number(p.old_price)} — عرض)` : `السعر:${price}`];
  if (withStore && p.store_name) parts.push(`المتجر:${p.store_name}`);
  if (p.color) parts.push(`الألوان:${p.color}`);
  if (p.size) parts.push(`المقاسات:${p.size}`);
  parts.push(p.stock === 0 ? 'التوفّر:نفد' : 'التوفّر:متوفّر');
  if (desc) parts.push(`الوصف:${desc}`);
  return '- ' + parts.join(' | ');
}

function systemPrompt(storeName, rows, marketplace = false) {
  const who = marketplace
    ? `أنتِ "مساعِدة بازارا" — خبيرة أزياء في سوق "بازارا" الذي يضمّ عدّة متاجر أزياء نسائية فاخرة. ترشّحين أنسب القطع من أي متجر داخل السوق.`
    : `أنتِ "مساعِدة الأناقة" في متجر "${storeName}" — خبيرة أزياء نسائية ذكية ودودة وراقية.`;
  const catTitle = marketplace ? 'كتالوج السوق (قطع من متاجر متعدّدة — المصدر الوحيد المسموح):' : 'كتالوج المتجر (المصدر الوحيد المسموح):';
  return `${who} جمهورك سيّدات، فخاطبيهنّ بصيغة المؤنّث بدفء وذوق.
مهمّتك: افهمي مقصد الزبونة بأي صياغة كتبتها (مناسبة، ستايل، لون، مقاس، ميزانية، أو حتى سؤال عام)، وساعديها بقطع من الكتالوج أدناه فقط.

كوني ذكية ومرنة:
- جاوبي على أي كلام طبيعي: تحية، شكر، أسئلة عامة مثل "شو عندكم؟" أو "بدي شي حلو" — ردّي بطبيعية واعرضي تشكيلة متنوّعة مناسبة.
- لو الطلب غامض، رشّحي أفضل ما يناسب + اسألي سؤالاً لطيفاً يوضّح (مثلاً اللون أو المناسبة).
- لو الزبونة طلبت شيئاً غير موجود (لون/نوع مش بالكتالوج) قوليها بصراحة ولطف واقترحي أقرب بديل موجود — لا تدّعي وجوده.
- استعيني بسياق المحادثة السابقة (مثلاً لو قالت "فستان" ثم "أبيض" فهي تريد فستاناً أبيض).

قواعد صارمة (لا تُكسر):
- لا ترشّحي إلا منتجات موجودة في الكتالوج أدناه وبمعرّفها (id) الحرفي تماماً. لا تخترعي منتجات أو أسعاراً أو معرّفات أو ألواناً غير مذكورة.
- ضعي في productIds معرّفات القطع المقترحة فعلاً (${TOP_N} كحدّ أقصى، الأنسب أولاً). للتحية/الشكر/سؤال لا يحتاج عرضاً اتركيها فارغة.
- reply رسالة قصيرة دافئة (جملة إلى ثلاث) بنفس لغة الزبونة. لا تذكري الأسعار (تظهر تلقائياً على الكروت).
- للتوصيل/الدفع/الإرجاع اطلبي مراسلة المتجر عبر واتساب؛ لا تخترعي سياسات.

${catTitle}
${rows.map((r) => catalogLine(r, marketplace)).join('\n')}`;
}

async function callClaude(system, messages, validIds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        tools: [{
          name: 'suggest',
          description: 'ترشيح قطع للزبونة مع رسالة ودّية.',
          input_schema: {
            type: 'object',
            properties: {
              reply: { type: 'string' },
              productIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['reply', 'productIds'],
          },
        }],
        tool_choice: { type: 'tool', name: 'suggest' },
        messages,
      }),
    });
    if (!r.ok) throw new Error(`claude ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const data = await r.json();
    const tool = Array.isArray(data.content) ? data.content.find((b) => b.type === 'tool_use') : null;
    const out = tool?.input || {};
    return cleanAi(out, validIds);
  } finally { clearTimeout(timer); }
}

async function callGemini(system, messages, validIds) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 700,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: { reply: { type: 'string' }, productIds: { type: 'array', items: { type: 'string' } } },
            required: ['reply', 'productIds'],
          },
        },
      }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let out = {};
    try { out = JSON.parse(txt); } catch { out = {}; }
    return cleanAi(out, validIds);
  } finally { clearTimeout(timer); }
}

function cleanAi(out, validIds) {
  const reply = typeof out.reply === 'string' && out.reply.trim() ? out.reply.trim() : 'تفضّلي بعض الاقتراحات 🌷';
  const ids = Array.isArray(out.productIds) ? out.productIds.map(String).filter((id) => validIds.has(id)).slice(0, TOP_N) : [];
  return { reply, ids };
}

// ───────────────────── المعالج الرئيسي ─────────────────────
export async function chatAssistant(req, res, next) {
  const marketplace = req.body.marketplace === true; // وضع السوق: ترشيح من كل المتاجر (الصفحة العامة)
  const slug = String(req.body.store || '').trim();
  if (!marketplace && !slug) return res.status(400).json({ error: 'المتجر مطلوب.' });

  const raw = Array.isArray(req.body.messages) ? req.body.messages : [];
  const messages = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1000) }))
    .filter((m) => m.content);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'أرسلي رسالة أولاً.' });
  }

  const lastUser = messages[messages.length - 1].content;
  const lang = hasArabic(lastUser) ? 'ar' : 'en';

  // البحث بالصورة (اختياري) — تُصغَّر بالمتصفح قبل الإرسال لتوفير التوكن
  const image = typeof req.body.image === 'string' ? req.body.image.trim() : '';
  let imgMatch = null;
  if (image) {
    imgMatch = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!imgMatch || image.length > 700000) {
      return res.status(400).json({ error: 'الصورة غير صالحة أو كبيرة. جرّبي صورة أصغر.' });
    }
  }

  // تحية/شكر بلا نيّة شراء (وبلا صورة) → ردّ ودّي فوري بلا منتجات (بلا قاعدة بيانات ولا توكنات)
  const chat = !image && smalltalkType(lastUser);
  if (chat) return res.json({ reply: smalltalkReply(chat, lang), products: [] });

  try {
    const active = activeStoreSql('u');
    let storeName = 'بازارا';
    let rows;

    if (marketplace) {
      // كتالوج السوق: قطع من كل المتاجر الفعّالة (مميّزة ثم الأحدث) — كاش بمفتاح خاص
      const cacheKey = '__market__';
      let cached = catalogCache.get(cacheKey);
      if (!cached || Date.now() - cached.ts > CATALOG_TTL) {
        const prodRes = await query(`${CATALOG_SELECT} WHERE ${active} ORDER BY p.featured DESC, p.created_at DESC LIMIT ${MAX_PRODUCTS}`);
        cached = { rows: prodRes.rows, ts: Date.now() };
        catalogCache.set(cacheKey, cached);
      }
      rows = cached.rows;
    } else {
      const storeRes = await query(`SELECT s.id, s.name FROM stores s JOIN users u ON u.id = s.user_id WHERE s.slug = $1 AND ${active}`, [slug]);
      const store = storeRes.rows[0];
      if (!store) return res.status(404).json({ error: 'المتجر غير موجود.' });
      storeName = store.name;
      // كتالوج المتجر من الكاش (معزول بالسلَگ)
      let cached = catalogCache.get(slug);
      if (!cached || Date.now() - cached.ts > CATALOG_TTL) {
        const prodRes = await query(
          `${CATALOG_SELECT} WHERE p.store_id = $1 ORDER BY p.featured DESC, p.created_at DESC LIMIT ${MAX_PRODUCTS}`,
          [store.id]
        );
        cached = { rows: prodRes.rows, ts: Date.now() };
        catalogCache.set(slug, cached);
      }
      rows = cached.rows;
    }
    if (rows.length === 0) {
      return res.json({ reply: marketplace ? 'لسّا ما في قطع معروضة بالسوق. تابعونا قريباً 🌷' : 'لسّا ما في قطع معروضة بهالمتجر. تابعينا قريباً 🌷', products: [] });
    }

    const validIds = new Set(rows.map((p) => String(p.id)));
    // سياق المحرّك المجاني: آخر رسالتين للزبونة (يحافظ على الفئة عند متابعة بلون/مقاس)
    const recentUserText = messages.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join(' ');

    // اختيار المزوّد حسب المتوفّر، مع السقوط للقواعد عند أي فشل
    let result;
    try {
      const aiRows = rows.slice(0, AI_CATALOG);            // كتالوج أصغر للذكاء = توكنات أقل
      let aiMessages = messages.slice(-AI_HISTORY);         // آخر رسائل فقط = توكنات أقل
      let sys = systemPrompt(storeName, aiRows, marketplace);

      if (image) {
        // البحث بالصورة (Claude vision): نرفق الصورة بآخر رسالة + تعليمات تحليل
        sys += '\n\nالزبونة أرسلت صورة لقطعة تريد شبيهها. حلّلي الصورة (القصّة، النوع، الستايل، اللون) واقترحي أقرب القطع تشابهاً من الكتالوج، واذكري باختصار لماذا تشبهها.';
        const lastIdx = aiMessages.length - 1;
        aiMessages = aiMessages.map((m, i) => (i === lastIdx
          ? { role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: imgMatch[1], data: imgMatch[2] } },
              { type: 'text', text: m.content || (marketplace ? 'دوّريلي على أقرب قطعة شبيهة لهالصورة من متاجر بازارا.' : 'دوّريلي على أقرب قطعة شبيهة لهالصورة من منتجات هذا المتجر.') },
            ] }
          : m));
      }

      if (process.env.ANTHROPIC_API_KEY) {
        result = await callClaude(sys, aiMessages, validIds);
      } else if (process.env.GEMINI_API_KEY && !image) {
        result = await callGemini(sys, aiMessages, validIds);
      } else if (image) {
        // لا مزوّد يدعم الرؤية متاح → نطلب وصفاً نصّياً بدل الصورة
        result = { reply: 'ميزة البحث بالصورة بحاجة لتفعيل الذكاء. بالوقت الحالي اوصفيلي القطعة (نوعها/لونها) وأرشّحلك 🌷', ids: [] };
      } else {
        result = ruleBasedRecommend(rows, recentUserText, lang);
      }
    } catch (aiErr) {
      console.error('⚠️ مزوّد الذكاء فشل، نسقط للقواعد:', aiErr.message);
      result = image
        ? { reply: 'تعذّر تحليل الصورة الآن، اوصفيلي القطعة وأرشّحلك 🌷', ids: [] }
        : ruleBasedRecommend(rows, recentUserText, lang);
    }

    const { reply, ids } = result;
    let products = [];
    if (ids.length) {
      const r = await query(
        `SELECT p.*, s.slug AS store_slug, s.name AS store_name, s.whatsapp AS store_whatsapp,
                s.instagram AS store_instagram, s.phone AS store_phone, s.size_chart AS store_size_chart,
                s.return_policy AS store_return_policy, 0 AS rating_avg, 0 AS rating_count
         FROM products p JOIN stores s ON s.id = p.store_id
         WHERE p.id = ANY($1::uuid[])`,
        [ids]
      );
      const byId = new Map(r.rows.map((row) => [String(row.id), mapProduct(row)]));
      products = ids.map((id) => byId.get(id)).filter(Boolean); // نحافظ على ترتيب الترشيح
    }

    res.json({ reply, products });
  } catch (err) {
    next(err);
  }
}

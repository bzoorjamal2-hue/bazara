import { query } from '../config/db.js';
import { mapProduct } from './product.controller.js';
import { activeStoreSql } from '../utils/subscription.js';

// مساعِدة التسوّق الذكية — ترشّح للزبونة قطعاً من منتجات هذا المتجر فقط (grounding).
// تعمل بثلاث طبقات حسب المتوفّر، فلا تتعطّل أبداً وتشتغل مجاناً افتراضياً:
//   1) بلا أي مفتاح → محرّك ترشيح بقواعد ذكية (مجاني للأبد، بلا حدود).
//   2) GEMINI_API_KEY → ذكاء اصطناعي مجاني من Google.
//   3) ANTHROPIC_API_KEY → Claude (أرقى جودة).
// المفاتيح تبقى على الخادم ولا تصل المتصفّح. لو فشل مزوّد الذكاء نسقط للقواعد تلقائياً.

const MAX_PRODUCTS = 60; // سقف الكتالوج (يوازن الجودة/التكلفة)
const MAX_MESSAGES = 12;  // سقف رسائل المحادثة
const TOP_N = 6;          // عدد القطع المقترحة كحدّ أقصى

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
  اسود: ['اسود', 'سوداء', 'black'], ابيض: ['ابيض', 'بيضاء', 'white'],
  احمر: ['احمر', 'حمراء', 'red'], وردي: ['وردي', 'زهري', 'روز', 'pink', 'rose'],
  ازرق: ['ازرق', 'زرقاء', 'blue'], كحلي: ['كحلي', 'نيلي', 'navy'],
  اخضر: ['اخضر', 'خضراء', 'green', 'زيتي', 'olive'], بيج: ['بيج', 'جملي', 'beige', 'nude'],
  ذهبي: ['ذهبي', 'gold', 'golden'], فضي: ['فضي', 'silver'],
  بني: ['بني', 'brown'], رمادي: ['رمادي', 'gray', 'grey'],
  بنفسجي: ['بنفسجي', 'موف', 'purple', 'lilac'], اصفر: ['اصفر', 'yellow'],
};

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
      const col = normalizeAr(p.color);
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

  let picks = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  // لا شيء طابق → أبرز القطع (مميّزة ثم الأحدث، المتوفّر أولاً)
  if (picks.length === 0) {
    picks = scored.sort((a, b) => (b.p.featured - a.p.featured) || (a.p.stock === 0 ? 1 : -1));
  }
  const ids = picks.slice(0, TOP_N).map((s) => String(s.p.id));

  // رسالة دافئة بحسب ما فُهم
  const matched = wantedCats.size || occasionCats.size || wantedColors.length || wantSale;
  let reply;
  if (en) {
    reply = matched
      ? 'Here are pieces I think suit what you described 🌷 Want me to refine by color, size or budget?'
      : "Here are some of our standout pieces 🌷 Tell me the occasion, a color, or your budget and I'll narrow it down.";
  } else {
    reply = matched
      ? 'اخترتلك هالقطع اللي بتناسب طلبك 🌷 إذا بتحبي حدّديلي اللون أو المقاس أو ميزانيتك وبضبّطلك أكثر.'
      : 'تفضّلي أبرز القطع عنا 🌷 قوليلي المناسبة أو لون أو ميزانيتك وبرشّحلك بدقة أكبر.';
  }
  return { reply, ids };
}

// ───────────────────── الطبقة الذكية (اختيارية) ─────────────────────
function catalogLine(p) {
  const price = Number(p.price);
  const desc = (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const parts = [`id:${p.id}`, `الاسم:${p.name}`, `الفئة:${p.category}`,
    onSale(p) ? `السعر:${price} (كان ${Number(p.old_price)} — عرض)` : `السعر:${price}`];
  if (p.color) parts.push(`الألوان:${p.color}`);
  if (p.size) parts.push(`المقاسات:${p.size}`);
  parts.push(p.stock === 0 ? 'التوفّر:نفد' : 'التوفّر:متوفّر');
  if (desc) parts.push(`الوصف:${desc}`);
  return '- ' + parts.join(' | ');
}

function systemPrompt(storeName, rows) {
  return `أنتِ "مساعِدة بازارا"، خبيرة أناقة في متجر أزياء نسائي فاخر. جمهورك سيّدات فخاطبيهنّ بصيغة المؤنّث بلطف وذوق راقٍ.
مهمّتك: تفهمين طلب الزبونة (مناسبة، ستايل، لون، مقاس، ميزانية) وترشّحين قطعاً من كتالوج هذا المتجر فقط.
قواعد صارمة:
- لا ترشّحي إلا منتجات موجودة في الكتالوج وبمعرّفها (id) الحرفي. لا تخترعي منتجات أو أسعاراً أو معرّفات.
- ضعي في productIds معرّفات القطع المقترحة فعلاً (${TOP_N} كحدّ أقصى، الأنسب أولاً). إن لم يناسب شيء فاتركيها فارغة وردّي بلطف أو اسألي سؤالاً يوضّح الطلب.
- reply رسالة قصيرة دافئة (جملتان أو ثلاث) بنفس لغة الزبونة. لا تكرري الأسعار (تظهر تلقائياً على الكروت).
- للتوصيل/الدفع/الإرجاع اطلبي مراسلة المتجر عبر واتساب؛ لا تخترعي سياسات.
اسم المتجر: ${storeName}
كتالوج المتجر (المصدر الوحيد المسموح):
${rows.map(catalogLine).join('\n')}`;
}

async function callClaude(system, messages, validIds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || 'claude-sonnet-4-6',
        max_tokens: 700,
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
  const timer = setTimeout(() => controller.abort(), 45000);
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
  const slug = String(req.body.store || '').trim();
  if (!slug) return res.status(400).json({ error: 'المتجر مطلوب.' });

  const raw = Array.isArray(req.body.messages) ? req.body.messages : [];
  const messages = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1000) }))
    .filter((m) => m.content);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'أرسلي رسالة أولاً.' });
  }

  try {
    const active = activeStoreSql('u');
    const storeRes = await query(`SELECT id, name FROM stores s JOIN users u ON u.id = s.user_id WHERE s.slug = $1 AND ${active}`, [slug]);
    const store = storeRes.rows[0];
    if (!store) return res.status(404).json({ error: 'المتجر غير موجود.' });

    const prodRes = await query(
      `${CATALOG_SELECT} WHERE p.store_id = $1 ORDER BY p.featured DESC, p.created_at DESC LIMIT ${MAX_PRODUCTS}`,
      [store.id]
    );
    const rows = prodRes.rows;
    if (rows.length === 0) {
      return res.json({ reply: 'لسّا ما في قطع معروضة بهالمتجر. تابعينا قريباً 🌷', products: [] });
    }

    const validIds = new Set(rows.map((p) => String(p.id)));
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const lang = hasArabic(lastUser) ? 'ar' : 'en';

    // اختيار المزوّد حسب المتوفّر، مع السقوط للقواعد عند أي فشل
    let result;
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        result = await callClaude(systemPrompt(store.name, rows), messages, validIds);
      } else if (process.env.GEMINI_API_KEY) {
        result = await callGemini(systemPrompt(store.name, rows), messages, validIds);
      } else {
        result = ruleBasedRecommend(rows, lastUser, lang);
      }
    } catch (aiErr) {
      console.error('⚠️ مزوّد الذكاء فشل، نسقط للقواعد:', aiErr.message);
      result = ruleBasedRecommend(rows, lastUser, lang);
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

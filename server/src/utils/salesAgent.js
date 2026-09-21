// البائعةُ الآليّة — تردُّ على الزبونةِ باسمِ المتجرِ حين لا تكونُ التاجرةُ على الشاشة.
//
// المبدأُ الحاكمُ كلَّ سطرٍ هنا: **النموذجُ يتكلَّم، والخادمُ يقرّر.** ما من رقمٍ
// يخرجُ من رأسِ النموذج: التوفّرُ يُقرأُ من `color_stock` هذه اللحظة، والسعرُ
// المسموحُ عرضُه يُحسَبُ هنا من سُلَّمِ تنازلٍ لا ينزلُ تحتَ أرضيّةِ التاجرة. ولو
// تسلَّلَ رقمٌ أدنى إلى نصِّ الردِّ استُبدِلَ قبلَ الإرسال. بلا هذه الطبقةِ تصيرُ
// «بائعةٌ ذكيّة» بابَ خسارةٍ: تَعِدُ بنمرةٍ نفدَتْ، وتبيعُ بسعرٍ تحتَ التكلفة.
//
// ثلاثُ طبقاتٍ كما في مساعِدةِ التسوّق، فلا تتعطَّلُ أبداً وتشتغلُ مجّاناً افتراضاً:
//   1) بلا أيِّ مفتاح → ردٌّ محسوبٌ بالقواعد (مجّانيٌّ للأبد).
//   2) GEMINI_API_KEY → ذكاءٌ مجّانيٌّ من Google.
//   3) ANTHROPIC_API_KEY → Claude (أرقى جودة).

import { query } from '../config/db.js';

const CATALOG_TTL = 2 * 60 * 1000; // كاشُ كتالوجِ البائعة (أقصرُ من كاشِ المساعِدة: المخزونُ يتغيّر)
const AI_CATALOG = 30;             // سقفُ القطعِ المُمرَّرةِ للنموذج (توكناتٌ أقل)
const AI_HISTORY = 8;              // آخرُ رسائلِ المحادثةِ المُمرَّرة
const TOP_N = 4;                   // أقصى ما تعرضُه البائعةُ بردٍّ واحد
export const MONTHLY_QUOTA = 300;  // ردودٌ ذكيّةٌ بالشهرِ لكلِّ متجر، وبعدَها القواعدُ المجّانيّة
// ردودٌ آليّةٌ متتاليةٌ بلا بشر. لا حدَّ عمليّاً — محادثةُ بيعٍ قد تطولُ عشرينَ
// رسالةً حتى يكتملَ الطلب، وقطعُها في منتصفِها يُضيّعُ البيعَ الذي جاءت لأجلِه.
// السِتّونَ هنا حاجزُ جموحٍ لا حدُّ خدمة: حلقةٌ بين آليَّينِ تُوقَفُ، وحديثُ إنسانٍ
// لا يبلغُها أبداً.
export const MAX_BOT_REPLIES = 60;

const catalogCache = new Map(); // storeId -> { rows, ts }

// ───────────────────── أدواتٌ صغيرة ─────────────────────

export function hasArabic(s) { return /[؀-ۿ]/.test(String(s || '')); }

function normalizeAr(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ْ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '')
    .trim();
}

// النموذجُ قد يكتبُ بالأرقامِ الهنديّة، والتحقّقُ من السعرِ يقرأُ اللاتينيّةَ وحدَها —
// فتمرُّ «٩٠» من تحتِ الأرضيّةِ بلا أن يراها أحد. نوحّدُها قبلَ أيِّ فحص.
function westernDigits(s) {
  return String(s || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

const money = (n) => Math.round(Number(n) * 100) / 100;

// ───────────────────── إعداداتُ المتجرِ للبائعة ─────────────────────

export const BOT_COLUMNS = `bot_enabled, bot_channels, bot_mode, bot_tone, bot_dialect,
  bot_hours, bot_haggle, bot_haggle_steps, bot_signature, bot_notes, bot_promo_product,
  bot_quota_used, bot_quota_month, bot_replies_total, bot_handoffs_total,
  bot_test_only, bot_test_accounts, bot_haggle_margin, delivery_tiers, free_shipping_over`;

export async function loadBot(storeId) {
  try {
    const r = await query(`SELECT id, name, ${BOT_COLUMNS} FROM stores WHERE id = $1`, [storeId]);
    return r.rows[0] || null;
  } catch (err) {
    // العمودُ ناقصٌ على خادمٍ لم تصلْه الترقيةُ بعد: ميزةٌ معطّلةٌ أهونُ من شاشةٍ ساقطة
    if (err.code === '42703') return null;
    throw err;
  }
}

// اسمُ المستخدمِ يُكتَبُ بأشكال: ‎@name أو Name أو بمسافات. نوحّدُه قبلَ المقارنةِ
// كي لا يفشلَ الحارسُ على فرقِ حرفٍ كبيرٍ أو علامةِ ‎@.
const normUser = (s) => String(s || '').trim().replace(/^@+/, '').toLowerCase();

// وضعُ التجربة: قائمةٌ فارغةٌ مع تشغيلِ الوضعِ تعني **لا أحد** — لا الجميع.
// الفشلُ هنا يجبُ أن يكونَ إلى الصمتِ لا إلى الكلام.
// مُرسِلُ ماسنجر بلا اسمِ حسابٍ أصلاً — له اسمٌ معروضٌ فقط. فكان وضعُ التجربةِ
// يمنعُ كلَّ رسائلِ فيسبوكَ بلا استثناء، ولا سبيلَ لتجربةِ القناةِ إلّا بإطفاءِ
// الحارسِ عن زبائنِ المتجرِ الحقيقيّين. فصارَ يقبلُ الاسمَ المعروضَ أيضاً.
export function testModeAllows(bot, username, displayName = '') {
  if (!bot?.bot_test_only) return true;
  const list = Array.isArray(bot.bot_test_accounts) ? bot.bot_test_accounts.map(normUser) : [];
  if (!list.length) return false;
  const tries = [normUser(username), normUser(displayName)].filter(Boolean);
  return tries.some((x) => list.includes(x));
}

function channels(bot) {
  const c = Array.isArray(bot?.bot_channels) ? bot.bot_channels : [];
  return new Set(c.map(String));
}

// هل تعملُ البائعةُ الآنَ على هذه القناة؟ الوضعُ «خارجَ الدوام» يُحسَبُ بتوقيتِ
// فلسطينَ لا بتوقيتِ الخادم (Render بـ UTC، فالتاسعةُ مساءً عندَه السادسةُ عندنا).
export function botActiveNow(bot, channel, { isFirstMessage = false } = {}) {
  if (!bot?.bot_enabled) return false;
  if (!channels(bot).has(channel)) return false;
  if (bot.bot_mode === 'first') return isFirstMessage;
  if (bot.bot_mode === 'offhours') {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hebron' }));
    const mins = now.getHours() * 60 + now.getMinutes();
    const parse = (v, def) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ''));
      return m ? Number(m[1]) * 60 + Number(m[2]) : def;
    };
    const from = parse(bot.bot_hours?.from, 9 * 60);
    const to = parse(bot.bot_hours?.to, 21 * 60);
    const working = from <= to ? (mins >= from && mins < to) : (mins >= from || mins < to);
    return !working; // البائعةُ تغطّي ما بعدَ الدوامِ وحدَه
  }
  return true;
}

// ───────────────────── الكتالوجُ والتوفّرُ الحيّ ─────────────────────

export function clearCatalog(storeId) { catalogCache.delete(String(storeId)); }

async function loadCatalog(storeId) {
  const key = String(storeId);
  const hit = catalogCache.get(key);
  if (hit && Date.now() - hit.ts < CATALOG_TTL) return hit.rows;
  const r = await query(
    `SELECT id, name, description, category, price, old_price, sale_ends_at, floor_price,
            size, color, stock, size_stock, color_stock, featured
     FROM products WHERE store_id = $1 AND hidden_at IS NULL
     ORDER BY featured DESC, created_at DESC LIMIT 60`,
    [storeId]
  );
  catalogCache.set(key, { rows: r.rows, ts: Date.now() });
  return r.rows;
}

// سطرُ التوفّرِ كما هو في القاعدةِ هذه اللحظة — وهو عمودُ الصدقِ كلِّه هنا.
// نذكرُ النمرَ النافدةَ صراحةً لا نحذفُها: الزبونةُ تسألُ عن نمرتِها بالاسم،
// و«ما عندي جواب» يجعلُ النموذجَ يخمّن — فنكتبُها «نفدت» ليقولَها كما هي.
export function stockLine(p) {
  const cs = p.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const ss = p.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
  const colors = Object.keys(cs);
  if (colors.length) {
    return colors.map((c) => {
      const sizes = cs[c] && typeof cs[c] === 'object' ? cs[c] : {};
      const inner = Object.entries(sizes)
        .map(([sz, q]) => `${sz}:${Number(q) > 0 ? Number(q) : 'نفدت'}`)
        .join('، ');
      return `${c}(${inner || 'بلا نمر'})`;
    }).join(' · ');
  }
  const sizes = Object.keys(ss);
  if (sizes.length) {
    return sizes.map((sz) => `${sz}:${Number(ss[sz]) > 0 ? Number(ss[sz]) : 'نفدت'}`).join('، ');
  }
  if (p.stock === null || p.stock === undefined) return 'متوفّر';
  return Number(p.stock) > 0 ? `متوفّر (${Number(p.stock)})` : 'نفد';
}

// نمرُ القطعةِ المتوفّرةُ الآن — يقرأُها حارسُ السعرِ كي لا يحسبَ نمرةً سعراً،
// ويقرأُها مدقّقُ الطلبِ كي لا يُسجَّلَ طلبٌ بنمرةٍ نفدت.
export function sizesOf(p) {
  const out = new Set();
  const cs = p?.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const ss = p?.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
  for (const sizes of Object.values(cs)) {
    for (const [sz, q] of Object.entries(sizes || {})) if (Number(q) > 0) out.add(String(sz));
  }
  for (const [sz, q] of Object.entries(ss)) if (Number(q) > 0) out.add(String(sz));
  if (!out.size && p?.size) String(p.size).split(/[،,/]/).forEach((x) => x.trim() && out.add(x.trim()));
  return [...out];
}

// ألوانُ القطعةِ التي بقيَ منها شيء
export function colorsOf(p) {
  const cs = p?.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const live = Object.entries(cs)
    .filter(([, sizes]) => Object.values(sizes || {}).some((q) => Number(q) > 0))
    .map(([c]) => c);
  if (live.length) return live;
  return p?.color ? String(p.color).split(/[،,/]/).map((x) => x.trim()).filter(Boolean) : [];
}

// هل النمرةُ واللونُ متوفّرانِ معاً بهذه القطعةِ الآن؟ هذا ما يقرّرُ قبولَ الطلب،
// لا ما يظنُّه النموذجُ ولا ما تذكرُه الزبونة.
export function variantAvailable(p, color, size) {
  const cs = p?.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const ss = p?.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
  if (Object.keys(cs).length) {
    const c = String(color || '').trim();
    if (!c || !cs[c]) return false;
    return Number(cs[c][String(size || '').trim()] || 0) > 0;
  }
  if (Object.keys(ss).length) return Number(ss[String(size || '').trim()] || 0) > 0;
  if (p?.stock === null || p?.stock === undefined) return true;
  return Number(p.stock) > 0;
}

// هل بقيَ من القطعةِ شيءٌ أصلاً؟ ما نفدَ كلُّه لا يُعرَضُ ابتداءً.
function anyLeft(p) {
  const cs = p.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const ss = p.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
  if (Object.keys(cs).length) {
    return Object.values(cs).some((sizes) => Object.values(sizes || {}).some((q) => Number(q) > 0));
  }
  if (Object.keys(ss).length) return Object.values(ss).some((q) => Number(q) > 0);
  if (p.stock === null || p.stock === undefined) return true;
  return Number(p.stock) > 0;
}

function onSale(p) {
  const old = p.old_price != null ? Number(p.old_price) : null;
  const ends = p.sale_ends_at ? new Date(p.sale_ends_at) : null;
  return Boolean(ends && ends > new Date() && old && old > Number(p.price));
}

// ───────────────────── سُلَّمُ المفاصلة ─────────────────────

// هامشُ المفاصلةِ الافتراضيُّ للمنصّةِ كلِّها: عشرةُ شواقلَ ولا شيقلَ أكثر.
// لا يُكتَبُ برقمٍ داخلَ كلِّ قطعةٍ — يُحسَبُ وقتَ الردّ. فالقطعُ التي ستُضافُ
// غداً تأخذُه بلا أن يلمسَها أحد، وقطعةٌ يتغيّرُ سعرُها يبقى هامشُها صحيحاً
// (أرضيّةٌ محفوظةٌ برقمٍ جامدٍ تصيرُ خطأً أوّلَ مرّةٍ يُعدَّلُ فيها السعر).
export const DEFAULT_HAGGLE_MARGIN = 10;

// وهو سقفٌ لا هامشٌ فقط: لا تنزلُ بائعةٌ بهذه المنصّةِ أكثرَ من عشرةِ شواقلَ عن
// سعرِ القطعة، ولو كتبت التاجرةُ أرضيّةً أبعدَ بيدِها. يُفرَضُ هنا لا عندَ الحفظِ
// وحدَه: صفٌّ كُتِبَ قبلَ السقفِ أو من مسارٍ آخرَ يبقى محكوماً به.
export const MAX_HAGGLE_MARGIN = 10;

// أقلُّ تنازلٍ له معنى بالسوق. بائعٌ ينزلُ شيقلين ليس يفاصل — هو يستهزئ.
const MIN_CONCESSION = 10;

export function haggleMargin(bot) {
  const m = Number(bot?.bot_haggle_margin);
  const raw = Number.isFinite(m) && m > 0 ? m : DEFAULT_HAGGLE_MARGIN;
  return money(Math.min(raw, MAX_HAGGLE_MARGIN));
}

// الأرضيّةُ الفعليّةُ لهذه القطعةِ الآن: ما كتبَتْه التاجرةُ لها بعينِها إن كتبت،
// وإلّا السعرُ ناقصَ هامشِ المتجر. و‎null تعني «لا مفاصلةَ على هذه القطعة» —
// قطعةٌ ثمنُها كهامشِ المفاصلةِ أو أقلُّ لا مجالَ فيها للنزول.
export function effectiveFloor(product, bot) {
  const price = Number(product?.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const cap = price - MAX_HAGGLE_MARGIN;   // أبعدُ ما يُسمَحُ بالنزولِ إليه إطلاقاً
  const own = product?.floor_price != null ? Number(product.floor_price) : null;
  if (own != null) {
    if (!Number.isFinite(own) || !(own > 0) || own >= price) return null;
    // أرضيّةٌ أبعدُ من السقفِ تُرفَعُ إليه لا تُلغى: التاجرةُ أرادت مفاصلةً على
    // هذه القطعةِ فتبقى لها مفاصلةٌ — بحدِّ المنصّةِ لا بحدِّها.
    return cap > 0 ? money(Math.max(own, cap)) : null;
  }
  const margin = haggleMargin(bot);
  return price > margin ? money(price - margin) : null;
}

// أدنى سعرٍ يُسمَحُ بعرضِه عندَ هذه الدرجة. الأرضيّةُ خطٌّ لا يُعبَر مهما بلغَ
// إلحاحُ الزبونة، والدرجاتُ إيقاعٌ فقط: بائعةٌ تنزلُ إلى آخرِ سعرِها من أوّلِ
// «غالي» ليست بائعةً — هي خصمٌ دائمٌ مُعلَن.
export function allowedPrice(product, bot, stage) {
  const price = Number(product.price);
  const floor = effectiveFloor(product, bot);
  if (!bot?.bot_haggle || floor == null || floor >= price) return money(price);
  const steps = Math.max(1, Math.min(3, Number(bot.bot_haggle_steps) || 2));
  const s = Math.max(0, Math.min(steps, Number(stage) || 0));
  if (s === 0) return money(price);
  if (s >= steps) return money(floor);
  const cut = (price - floor) * (s / steps);
  // التنازلُ الوسطيُّ التافهُ لا يُقدَّم: تتمسّكُ بسعرِها هذه الجولةَ كما يفعلُ
  // بائعٌ حقيقيّ، وتُعطي الفرقَ كاملاً بالجولةِ التالية. بهامشِ عشرةٍ يعني هذا
  // أنّها تفاصلُ أوّلاً ثمّ تنزلُ العشرةَ — لا أن تنزلَ خمسةً من أوّلِ كلمة.
  if (cut < MIN_CONCESSION) return money(price);
  // تقريبٌ لأقربِ خمسةٍ (شكلُ السعرِ في السوق)، ثمّ حارسٌ ألّا ينزلَ تحتَ الأرضيّة
  const rounded = Math.round((price - cut) / 5) * 5;
  return money(Math.max(floor, Math.min(price, rounded)));
}

// كلماتٌ تعني «فاصِلني» ولا تعني غيرَه. الكلمةُ العامّةُ («كتير» «شوي» «حرام»)
// أُخرِجت عمداً: «حلوة كتير» ليست مفاصلة، ورفعُ درجةِ التنازلِ عليها يعطي خصماً
// لزبونةٍ لم تطلبْه — وهو خصمٌ من جيبِ التاجرةِ لا من جيبِنا.
const HAGGLE_WORDS = ['غالي', 'غاليه', 'غالييه', 'اخر سعر', 'احسن سعر', 'اقل سعر', 'افضل سعر',
  'نزلي', 'بتنزلي', 'تنزلي', 'ما بتنزل', 'خصم', 'حسم', 'تخفيض', 'ارخص', 'ارخصلي',
  'ما بقدر ادفع', 'ميزانيتي', 'مفاصله', 'فاصلني', 'بزياده', 'last price', 'best price',
  'discount', 'cheaper', 'too expensive', 'lower the price'];

export function haggleIntent(text) {
  const q = normalizeAr(westernDigits(text));
  return HAGGLE_WORDS.some((w) => q.includes(normalizeAr(w)));
}

// ما يُسلَّمُ للتاجرةِ فوراً: البائعةُ لا تَعِدُ بسياسةٍ ولا تعالجُ شكوى
const HANDOFF_WORDS = ['ارجع', 'ارجاع', 'استرجاع', 'مرتجع', 'استبدال', 'استبدل', 'بدلهالي',
  'شكوى', 'مشكله', 'تاخر الطلب', 'ما وصل', 'ما وصلني', 'خربان', 'مكسور', 'مغشوش', 'نصب',
  'محامي', 'بلغت عنكم', 'refund', 'return it', 'complaint', 'broken', 'damaged'];

export function needsHuman(text) {
  const q = normalizeAr(westernDigits(text));
  return HANDOFF_WORDS.some((w) => q.includes(normalizeAr(w)));
}

// ───────────────────── نصُّ النظام ─────────────────────

const TONES = {
  warm: 'دافئة ولطيفة، تُشعر الزبونة أنّها بمحلٍّ يعرفها.',
  short: 'مختصرة جداً: جملة أو جملتان بلا زخرفة، جوابٌ مباشرٌ على السؤال.',
  formal: 'مهذّبة رسميّة بلا دلال، كموظّفةِ مبيعاتٍ محترفة.',
};

const DIALECTS = {
  ps: 'اللهجة الفلسطينيّة المحكيّة (بدّي، كتير، مش، هيك، منيح).',
  sy: 'اللهجة الشاميّة المحكيّة (بدّي، كتير، شو، هلّق).',
  eg: 'اللهجة المصريّة المحكيّة (عايزة، أوي، إزاي، دلوقتي).',
  gulf: 'اللهجة الخليجيّة المحكيّة (أبغى، وايد، كيف، الحين).',
  msa: 'العربيّة الفصحى المبسّطة بلا تقعّر.',
};

function catalogLine(p, bot, stageFor) {
  const price = Number(p.price);
  const parts = [`id:${p.id}`, `الاسم:${p.name}`, `الفئة:${p.category}`];
  parts.push(onSale(p) ? `السعر:${price} (كان ${Number(p.old_price)} — عرض)` : `السعر:${price}`);
  // السعرُ المسموحُ عرضُه الآنَ وحدَه يُمرَّر — لا الأرضيّة. لو تسرَّبَ سطرُ النظامِ
  // كلُّه إلى الزبونةِ (وهذا يحدث) فأسوأُ ما يُكشَفُ هو عرضٌ نحن راضونَ به أصلاً،
  // لا آخرُ ما تقبلُه التاجرةُ فتفاصلَ عليه كلُّ زبونةٍ من يومِها.
  const allowed = allowedPrice(p, bot, stageFor);
  if (bot?.bot_haggle && allowed < price) parts.push(`أدنى سعرٍ مسموحٍ الآن:${allowed}`);
  if (p.color) parts.push(`الألوان:${p.color}`);
  parts.push(`التوفّر الآن:${stockLine(p)}`);
  const desc = (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (desc) parts.push(`الوصف:${desc}`);
  return '- ' + parts.join(' | ');
}

function buildSystem({ storeName, bot, rows, stage, promo, lang, customerName }) {
  const tone = TONES[bot.bot_tone] || TONES.warm;
  const dialect = lang === 'en' ? 'English, warm and natural.' : (DIALECTS[bot.bot_dialect] || DIALECTS.ps);
  const promoLine = promo
    ? `\nالقطعةُ التي تُروّجينَ لها اليوم: "${promo.name}" (id:${promo.id}). قدّميها أوّلاً ما لم تسألِ الزبونةُ عن غيرِها صراحةً.`
    : '';
  // هل لهذه الجولةِ تنازلٌ أصلاً؟ بجولةِ التمسّكِ لا يُكتَبُ لأيِّ قطعةٍ سطرُ
  // «أدنى سعرٍ مسموح»، فلو تركناها على النصِّ العامِّ لأغلقت البابَ نهائيّاً
  // ("ما في خصم أبداً") ثمّ أعطت عشرةً بالجولةِ التالية — وهذا تناقضٌ يُفقِدُها
  // مصداقيّتَها. البائعةُ الحقيقيّةُ تتمسّكُ بسعرِها أوّلاً وتُبقي البابَ موارباً.
  const conceding = bot.bot_haggle
    && rows.some((p) => allowedPrice(p, bot, stage) < Number(p.price));
  const haggleLine = !bot.bot_haggle
    ? '\nالمفاصلة: ممنوعة. السعرُ المكتوبُ هو السعر. إن ألحَّتْ فاعتذري بلطفٍ واذكري ما يستحقُّ به السعر.'
    : (conceding
      ? `\nالمفاصلة: مسموحة. لا تنزلي عن السعرِ المعروضِ إلّا إذا فاصلَتْكِ الزبونةُ فعلاً، ولا تعرضي أبداً رقماً أقلَّ من "أدنى سعرٍ مسموحٍ الآن" المكتوبِ بجانبِ القطعة. إذا لم يُكتَبْ للقطعةِ سطرُ أدنى سعرٍ فلا خصمَ عليها إطلاقاً — قوليها بلطفٍ واذكري قيمةَ القطعة.`
      : `\nالمفاصلة: مسموحة لكن **ليس بهذه الجولة**. تمسّكي بالسعرِ المكتوبِ الآنَ كما يفعلُ أيُّ بائعٍ: اذكري لماذا تستحقُّ القطعةُ ثمنَها (القماشُ، القصّة، الشغل) ولا تعرضي أيَّ رقمٍ أقلّ. ولا تقولي "ما في خصم أبداً" ولا "هذا آخرُ سعرٍ نهائيّاً" — اتركي البابَ مواربـاً بلا وعد.`);
  const notes = (bot.bot_notes || '').trim().slice(0, 600);

  // أجرةُ التوصيلِ من إعداداتِ المتجرِ نفسِها. بلا هذا السطرِ كانت البائعةُ تقولُ
  // «ما بقدر أقولّك السعر النهائي» لزبونٍ سألَ سؤالاً جوابُه مكتوبٌ عندنا — وهو
  // آخرُ سؤالٍ قبلَ القرار، وأسوأُ مكانٍ يُترَكُ فيه بلا جواب.
  const t = bot.delivery_tiers && typeof bot.delivery_tiers === 'object' ? bot.delivery_tiers : {};
  const parts = [];
  if (Number(t.wb) > 0) parts.push(`الضفة الغربية ${Number(t.wb)}₪`);
  if (Number(t.quds) > 0) parts.push(`القدس ${Number(t.quds)}₪`);
  if (Number(t.dakhel) > 0) parts.push(`الداخل ${Number(t.dakhel)}₪`);
  const freeOver = Number(bot.free_shipping_over) || 0;
  const deliveryLine = parts.length
    ? `\n- أجرةُ التوصيل: ${parts.join(' · ')}${freeOver > 0 ? ` (مجّانيٌّ فوقَ ${freeOver}₪)` : ''}.`
    : '';

  // الخطابُ كان مفروضاً بالمؤنّثِ دائماً، فخاطبَ رجلاً بـ«حبيبتي، كيفك انتِ».
  // المتجرُ نسائيٌّ نعم، لكنّ الرجالَ يشترونَ الهدايا — واسمُ المُرسِلِ يصلُنا من
  // ميتا، فلا عذرَ للافتراض.
  const who = String(customerName || '').trim();
  const address = who
    ? `اسمُ من تكلّمينَه: "${who}". خاطبيه بما يناسبُ اسمَه — مذكّراً إن كان اسمَ رجلٍ ومؤنّثاً إن كان اسمَ امرأة. وإن لم يتّضحْ من الاسمِ فاستعملي صيغةً محايدةً ("أهلاً وسهلاً"، "تفضّل") ولا تفترضي.`
    : 'لا تعرفينَ اسمَ من تكلّمينَه: استعملي صيغةً محايدةً ولا تفترضي أنّه امرأة.';

  return `أنتِ بائعةٌ في متجرِ "${storeName}" للأزياءِ النسائيّة، تكلّمينَ زبوناً حقيقيّاً الآن. لستِ روبوتاً يُجيبُ بقوائم — أنتِ بائعةٌ شاطرةٌ هدفُها أن يخرجَ من عندكِ بقطعةٍ يحبُّها.

${address}

أسلوبُكِ: ${tone}
لغتُكِ: ${dialect}
اكتبي كما يكتبُ الناسُ بالمحادثة: جملٌ قصيرة، بلا عناوينَ ولا نقاطٍ ولا تنسيق، وإيموجي واحدٌ على الأكثرِ بالردّ.${promoLine}${haggleLine}

قواعدُ لا تُكسَرُ أبداً:
- لا تذكري قطعةً ليست في الكتالوجِ أدناه، ولا تخترعي لوناً ولا نمرةً ولا سعراً.
- التوفّرُ مكتوبٌ بجانبِ كلِّ قطعةٍ ("التوفّر الآن") وهو من مخزنِ المتجرِ هذه اللحظة. إن سألتْ عن نمرةٍ مكتوبٍ أمامَها "نفدت" فقولي إنّها نفدت، واعرضي لوناً أو نمرةً موجودةً بدلَها. لا تقولي "بتفقّد" ولا "أكيد متوفّرة" — الرقمُ أمامَكِ.
- لا تَعِدي بسياسةِ إرجاعٍ ولا بتوفيرِ قطعةٍ نفدت.
- أجرةُ التوصيلِ مكتوبةٌ لكِ تحت. اجمعيها على سعرِ القطعةِ حين تُسألينَ عن الإجمالي، ولا تخترعي رقماً ولا تقولي «ما بعرف».${deliveryLine}
- عندَ الشكوى أو الإرجاعِ أو أيِّ أمرٍ يحتاجُ قراراً، لا تجاوبي: اضبطي handoff=true وقولي إنّ صاحبةَ المتجرِ ستردُّ بنفسِها بعدَ قليل.
- أنهي ردَّكِ بخطوةٍ واحدةٍ واضحة: سؤالٌ عن اللونِ أو النمرة، أو "بحجزهالك؟".
- إن وصلتْكِ **صورة**: انظري إليها واذكري ما فيها بكلماتِكِ (النوعُ والقصّةُ واللون)، ثمّ رشّحي أقربَ قطعةٍ من الكتالوجِ شبهاً بها وقولي لماذا تُشبهُها. وإن لم يكن في الكتالوجِ شبيهٌ فقولي ذلك بصراحةٍ واعرضي أقربَ ما عندَكِ.

الردّ:
- reply: نصُّ رسالتِكِ للزبونةِ كما تُرسَلُ حرفيّاً (بلا مقدّماتٍ ولا شرحٍ لنفسِكِ).
- productIds: معرّفاتُ القطعِ التي تتكلّمينَ عنها فعلاً (${TOP_N} كحدٍّ أقصى، وفارغةٌ إن كان الردُّ تحيّةً أو جواباً عامّاً). إن طلبت الزبونةُ **تشكيلةً** أو «شو عندكم» أو «ابعثيلي أشوف» فضعي ثلاثَ قطعٍ لا واحدة، واذكريهنّ بالاسمِ في ردِّكِ. وإن سألت عن قطعةٍ بعينِها فضعيها وحدَها.
- ولا تضعي معرّفَ قطعةٍ سبقَ أن أرسلتِها بهذه المحادثةِ إلّا إن سألت عنها الزبونةُ من جديد — يصلُها رابطُ كلِّ قطعةٍ مرّةً واحدة.
- offerProductId/offerPrice: املئيهما فقط إن عرضتِ سعراً مخفَّضاً بردِّكِ هذا.
- handoff: true إن وجبَ تسليمُ المحادثةِ لصاحبةِ المتجر.
- order: مسوّدةُ الطلب — انظري «إتمامُ الطلب» أدناه.

إتمامُ الطلب (هذه مهمّتُكِ الأهمّ):
حين تقولُ الزبونةُ إنّها تريدُ أن تطلبَ، أكملي معها حتى النهايةِ ولا تُحيليها لأحد. تحتاجينَ سبعةَ أشياءَ لا أقلّ:
القطعةَ، واللونَ، والنمرة، والعدد، والاسمَ الكامل، ورقمَ الهاتف، والعنوانَ (المدينةُ أو القريةُ + وصفٌ يصلُ به المندوب).
- اطلبيها بلطفٍ وبرسالةٍ أو رسالتين لا بقائمةِ استمارة، وما نقصَ منها اسأليها عنه وحدَه.
- املئي في order كلَّ ما عرفتِه حتى الآن (ولو ناقصاً)، واتركي ما لم تعرفيه فارغاً.
- **لا تقولي أبداً إنّ الطلبَ سُجِّلَ أو أُرسِلَ أو صارَ له رقم.** التسجيلُ يجري عندنا بعدَ ردِّكِ، ونحن من يُخبرُها ويعطيها الرقم. قولي «بسجّلهولك هلق» لا «تمّ التسجيل».
- إن طلبت نمرةً أو لوناً مكتوباً أمامَه «نفدت» فلا تأخذي الطلب: قولي إنّها نفدت واعرضي المتوفّر.
${notes ? `\nتعليماتٌ من صاحبةِ المتجرِ (تتقدَّمُ على ذوقِكِ لا على القواعدِ أعلاه):\n${notes}\n` : ''}
كتالوجُ المتجرِ (المصدرُ الوحيدُ المسموح):
${rows.map((p) => catalogLine(p, bot, stage)).join('\n')}`;
}

// ───────────────────── مزوّدو الذكاء ─────────────────────

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    productIds: { type: 'array', items: { type: 'string' } },
    offerProductId: { type: 'string' },
    offerPrice: { type: 'number' },
    handoff: { type: 'boolean' },
    // مسوّدةُ الطلب: يملؤُها النموذجُ ممّا قالته الزبونةُ فعلاً، حقلاً حقلاً، عبرَ
    // الرسائل. والخادمُ وحدَه يقرّرُ متى اكتملت ومتى تصيرُ طلباً حقيقيّاً.
    order: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        color: { type: 'string' },
        size: { type: 'string' },
        qty: { type: 'number' },
        name: { type: 'string' },
        phone: { type: 'string' },
        city: { type: 'string' },
        address: { type: 'string' },
      },
    },
  },
  required: ['reply', 'productIds'],
};

async function callClaude(system, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system,
        tools: [{ name: 'say', description: 'ردُّ البائعةِ على الزبونة.', input_schema: SCHEMA }],
        tool_choice: { type: 'tool', name: 'say' },
        // الصورةُ تُرفَقُ بالرسالةِ نفسِها قبلَ نصِّها — هكذا تقرأُها Claude
        messages: messages.map((m) => (m.image
          ? {
            role: m.role,
            content: [
              { type: 'image', source: { type: 'base64', media_type: m.image.mime, data: m.image.base64 } },
              { type: 'text', text: m.content || 'شو رأيك بهاي؟' },
            ],
          }
          : { role: m.role, content: m.content })),
      }),
    });
    if (!r.ok) throw new Error(`claude ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const data = await r.json();
    const tool = Array.isArray(data.content) ? data.content.find((b) => b.type === 'tool_use') : null;
    return tool?.input || {};
  } finally { clearTimeout(timer); }
}

async function callGemini(system, messages) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: m.image
            ? [{ inline_data: { mime_type: m.image.mime, data: m.image.base64 } }, { text: m.content || '' }]
            : [{ text: m.content }],
        })),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 600,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const data = await r.json();
    try { return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'); } catch { return {}; }
  } finally { clearTimeout(timer); }
}

// ───────────────────── التحقّقُ قبلَ الإرسال ─────────────────────

// كلُّ ما يخرجُ من النموذجِ يمرُّ من هنا. الردُّ الذي يحملُ سعراً تحتَ المسموحِ
// لا يُصحَّحُ بإعادةِ السؤال (ثانيتانِ أخرى وتكلفةٌ ثانية) بل يُستبدَلُ الرقمُ فيه
// بالمسموح: الزبونةُ ترى عرضاً صحيحاً، والتاجرةُ لا تخسرُ شيقلاً.
// مُصدَّرةٌ ليفحصَها الاختبارُ مباشرةً: هي الحارسُ الذي يقفُ بين كلامِ النموذجِ
// والزبونةِ، وحارسٌ لا يُختبَرُ ليس حارساً.
export function sanitize(out, { rows, bot, stage }) {
  const byId = new Map(rows.map((p) => [String(p.id), p]));
  let reply = westernDigits(typeof out.reply === 'string' ? out.reply : '').trim();
  const ids = (Array.isArray(out.productIds) ? out.productIds : [])
    .map(String).filter((id) => byId.has(id)).slice(0, TOP_N);

  let offer = null;
  const target = byId.get(String(out.offerProductId || '')) || byId.get(ids[0] || '');
  if (target && Number.isFinite(Number(out.offerPrice)) && Number(out.offerPrice) > 0) {
    const allowed = allowedPrice(target, bot, stage);
    const asked = money(out.offerPrice);
    offer = { productId: String(target.id), price: Math.max(allowed, Math.min(Number(target.price), asked)) };
  }

  // حارسُ السعر: يمنعُ رقماً تحتَ أدنى سعرٍ مسموح.
  //
  // كان يمسحُ **كلَّ** رقمٍ بالنصِّ ويستبدلُ ما وقعَ بين رُبعِ السعرِ والسعر. وقطعةٌ
  // بمئةِ شيقلٍ نمرُها ٣٦ و٣٨ و٤٠ — وكلُّها داخلَ ذلك المدى. فخرجَ للزبون: «بتفضّل
  // الحجم ١٠٠ ولا ١٠٠ ولا ١٠٠». البائعةُ كتبت النمرَ صحيحةً والحارسُ أفسدَها.
  //
  // الآن لا يُلمَسُ إلّا رقمٌ **مقرونٌ بعملةٍ صراحةً** — فالنمرةُ رقمٌ مجرّدٌ لا
  // عملةَ بجانبِه. ورقمٌ يساوي إحدى نمرِ القطعةِ لا يُمَسُّ ولو قُرِنَ بعملة.
  const mentioned = ids.map((id) => byId.get(id)).filter(Boolean);
  if (mentioned.length && reply) {
    const lowest = Math.min(...mentioned.map((p) => allowedPrice(p, bot, stage)));
    const sizeSet = new Set();
    for (const p of mentioned) for (const sz of sizesOf(p)) sizeSet.add(String(Number(sz)));
    reply = reply.replace(/(\d+(?:[.,]\d+)?)(\s*)(₪|شيكل|شيقل|ils)/gi, (m, num, sp, cur) => {
      const n = Number(String(num).replace(',', '.'));
      if (!Number.isFinite(n) || n >= lowest) return m;
      if (sizeSet.has(String(n))) return m; // نمرةٌ لا سعر
      return `${lowest}${sp}${cur}`;
    });
  }

  // مسوّدةُ الطلبِ كما جمعَها النموذج — تُدقَّقُ هنا لا تُصدَّق. القطعةُ من هذا
  // المتجر، واللونُ والنمرةُ متوفّرانِ فعلاً الآن، والرقمُ رقمُ جوّالٍ حقيقيّ.
  // وما نقصَ يُعادُ بـ missing كي تعرفَ الطبقةُ الأعلى أنّ الطلبَ لم يكتملْ بعد.
  const draft = out.order && typeof out.order === 'object' ? out.order : {};
  const prod = byId.get(String(draft.productId || '')) || byId.get(ids[0] || '') || null;
  const phone = normalizePhone(draft.phone);
  const order = {
    product: prod,
    color: String(draft.color || '').trim(),
    size: String(draft.size || '').trim(),
    qty: Math.max(1, Math.min(10, Number(draft.qty) || 1)),
    name: String(draft.name || '').trim().slice(0, 100),
    phone,
    city: String(draft.city || '').trim().slice(0, 80),
    address: String(draft.address || '').trim().slice(0, 300),
  };
  const missing = [];
  if (!order.product) missing.push('product');
  if (!order.name || order.name.split(/\s+/).length < 2) missing.push('name');
  if (!order.phone) missing.push('phone');
  if (!order.city) missing.push('city');
  if (!order.address) missing.push('address');
  if (order.product) {
    if (colorsOf(order.product).length && !order.color) missing.push('color');
    if (sizesOf(order.product).length && !order.size) missing.push('size');
    if (!missing.includes('color') && !missing.includes('size')
        && !variantAvailable(order.product, order.color, order.size)) missing.push('unavailable');
  }
  order.missing = missing;
  order.ready = missing.length === 0;

  return { reply, ids, offer, handoff: out.handoff === true, order };
}

// رقمُ الجوّالِ الفلسطينيُّ بأشكالِه: 059… · 0599… · ‎+97059… · ‎97259…
// نردُّ فراغاً لما ليس رقماً، فلا يُسجَّلُ طلبٌ برقمٍ لا يُتَّصَلُ به.
export function normalizePhone(raw) {
  const d = westernDigits(String(raw || '')).replace(/\D/g, '');
  if (!d) return '';
  let s = d;
  if (s.startsWith('00')) s = s.slice(2);
  if (s.startsWith('970') || s.startsWith('972')) s = s.slice(3);
  if (!s.startsWith('0')) s = `0${s}`;
  return /^05\d{8}$/.test(s) ? s : '';
}

// ───────────────────── الطبقةُ المجّانيّة (بلا مفتاح) ─────────────────────

// ليست «ردّاً احتياطيّاً باهتاً»: هي جوابٌ محسوبٌ على أكثرِ ثلاثةِ أسئلةٍ تُسألُ
// بمتجرِ ملابس — متوفّر؟ بكم؟ عندكم لونٌ كذا؟ — ومن القاعدةِ نفسِها. متجرٌ بلا
// مفتاحِ ذكاءٍ يبقى يردُّ صادقاً بدل أن يصمت.
function freeReply({ rows, bot, stage, lastUser, promo }) {
  const q = normalizeAr(westernDigits(lastUser));
  const pick = (() => {
    const named = rows.find((p) => q.includes(normalizeAr(p.name).slice(0, 12)));
    if (named) return named;
    if (promo && anyLeft(promo)) return promo;
    return rows.find(anyLeft) || rows[0];
  })();
  if (!pick) {
    return { reply: 'لسّا ما في قطع معروضة عنّا. تابعينا قريباً 🌷', ids: [], offer: null, handoff: false };
  }

  const price = Number(pick.price);
  const allowed = allowedPrice(pick, bot, stage);
  const stock = stockLine(pick);

  if (bot.bot_haggle && allowed < price && haggleIntent(lastUser)) {
    return {
      reply: `بفهمك 🌷 آخر شي بقدر أعملّك إيّاه على "${pick.name}" ${allowed} بدل ${price}. بحجزهالك؟`,
      ids: [String(pick.id)], offer: { productId: String(pick.id), price: allowed }, handoff: false,
    };
  }
  return {
    reply: `"${pick.name}" سعرها ${price}. المتوفّر حالياً: ${stock}. قوليلي اللون والنمرة وبحجزهالك 🌷`,
    ids: [String(pick.id)], offer: null, handoff: false,
  };
}

// ───────────────────── المدخلُ الوحيد ─────────────────────

// يُنادى من قناتين: مساعِدةُ الموقع (assistant.controller) وwebhook إنستغرام.
// messages: [{ role:'user'|'assistant', content }] — آخرُها رسالةُ الزبونة.
export async function agentReply({ store, bot, messages, stage = 0, customerName = '', image = null }) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const lang = hasArabic(lastUser) ? 'ar' : 'en';

  // شكوى/إرجاع: لا نجيبُ أصلاً ولا ننفقُ توكناً — تسليمٌ فوريٌّ للتاجرة
  if (needsHuman(lastUser)) {
    return {
      reply: lang === 'en'
        ? 'Let me pass this to the store owner herself — she will reply shortly 🌷'
        : 'هاي بحكيها مع صاحبة المتجر شخصياً، بتردّ عليكِ هي بعد شوي 🌷',
      ids: [], offer: null, handoff: true, stage, usedAi: false,
    };
  }

  const all = await loadCatalog(store.id);
  const rows = all.filter(anyLeft).slice(0, AI_CATALOG);
  const promo = bot.bot_promo_product ? all.find((p) => String(p.id) === String(bot.bot_promo_product)) : null;
  if (promo && !rows.some((p) => String(p.id) === String(promo.id))) rows.unshift(promo);
  if (rows.length === 0) {
    return { reply: 'لسّا ما في قطع معروضة عنّا. تابعينا قريباً 🌷', ids: [], offer: null, handoff: false, stage, usedAi: false };
  }

  // درجةُ التنازلِ ترتفعُ بفعلِ الزبونةِ لا باختيارِ النموذج: هو لا يملكُ أن يقفزَ
  // إلى آخرِ سعرٍ من أوّلِ رسالة.
  const nextStage = bot.bot_haggle && haggleIntent(lastUser)
    ? Math.min(Number(bot.bot_haggle_steps) || 2, (Number(stage) || 0) + 1)
    : (Number(stage) || 0);

  const withinQuota = quotaLeft(bot) > 0;
  const canAi = withinQuota && Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);

  if (canAi) {
    try {
      const system = buildSystem({ storeName: store.name, bot, rows, stage: nextStage, promo, lang, customerName });
      const history = messages.slice(-AI_HISTORY).map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) }));
      // الصورةُ تُلحَقُ بآخرِ رسالةٍ من الزبونةِ وحدَها: تاريخُ المحادثةِ نصٌّ،
      // والصورةُ هي ما وصلَ الآن.
      if (image && history.length) {
        const last = history.length - 1;
        if (history[last].role === 'user') history[last] = { ...history[last], image };
      }
      const out = process.env.ANTHROPIC_API_KEY
        ? await callClaude(system, history)
        : await callGemini(system, history);
      const clean = sanitize(out, { rows, bot, stage: nextStage });
      if (clean.reply) return { ...clean, stage: nextStage, usedAi: true };
    } catch (err) {
      console.error('⚠️ البائعة الآلية — سقوطٌ للقواعد:', err.message);
    }
  }
  const free = freeReply({ rows, bot, stage: nextStage, lastUser, promo });
  return { ...free, order: { ready: false, missing: [] }, stage: nextStage, usedAi: false };
}

// ───────────────────── الحصّةُ الشهريّة ─────────────────────

function monthKey() { return new Date().toISOString().slice(0, 7); }

export function quotaLeft(bot) {
  if (!bot) return 0;
  if (bot.bot_quota_month !== monthKey()) return MONTHLY_QUOTA; // شهرٌ جديدٌ = عدّادٌ جديد
  return Math.max(0, MONTHLY_QUOTA - (Number(bot.bot_quota_used) || 0));
}

// تُنادى بعدَ إرسالِ الردِّ لا قبلَه: لا تُخصَمُ حصّةٌ على ردٍّ لم يصل.
export async function countReply(storeId, usedAi, handoff) {
  const m = monthKey();
  await query(
    `UPDATE stores SET
       bot_quota_used = CASE WHEN bot_quota_month = $2 THEN bot_quota_used + $3 ELSE $3 END,
       bot_quota_month = $2,
       bot_replies_total = bot_replies_total + 1,
       bot_handoffs_total = bot_handoffs_total + $4
     WHERE id = $1`,
    [storeId, m, usedAi ? 1 : 0, handoff ? 1 : 0]
  ).catch((e) => console.error('⚠️ عدّاد البائعة:', e.message));
}

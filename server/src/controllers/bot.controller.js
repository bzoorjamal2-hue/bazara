// لوحةُ البائعةِ الآليّة — ما تضبطُه التاجرةُ بنفسِها من تبويبِ «البائعة الآلية».
//
// كلُّ ما هنا يخصُّ متجرَ صاحبةِ الطلبِ وحدَها: لا معرّفَ متجرٍ يُقرأُ من الجسم،
// بل من الجلسة. البائعةُ تتكلّمُ باسمِ المتجر، فبابُ إعدادِها لا يُفتَحُ لغيرِ صاحبتِه.

import { query } from '../config/db.js';
import {
  loadBot, agentReply, clearCatalog, quotaLeft, MONTHLY_QUOTA, allowedPrice, stockLine,
} from '../utils/salesAgent.js';

const MODES = ['always', 'first', 'offhours'];
const TONES = ['warm', 'short', 'formal'];
const DIALECTS = ['ps', 'sy', 'eg', 'gulf', 'msa'];
const CHANNELS = ['site', 'instagram'];

async function getUserStore(userId) {
  const r = await query('SELECT id, name FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

function mapBot(b) {
  return {
    enabled: Boolean(b.bot_enabled),
    channels: Array.isArray(b.bot_channels) ? b.bot_channels : ['site'],
    mode: b.bot_mode || 'always',
    tone: b.bot_tone || 'warm',
    dialect: b.bot_dialect || 'ps',
    hours: b.bot_hours && typeof b.bot_hours === 'object' ? b.bot_hours : { from: '09:00', to: '21:00' },
    haggle: Boolean(b.bot_haggle),
    haggleSteps: Number(b.bot_haggle_steps) || 2,
    signature: b.bot_signature || '',
    notes: b.bot_notes || '',
    promoProduct: b.bot_promo_product || '',
    quotaUsed: Number(b.bot_quota_used) || 0,
    quotaLeft: quotaLeft(b),
    quotaTotal: MONTHLY_QUOTA,
    repliesTotal: Number(b.bot_replies_total) || 0,
    handoffsTotal: Number(b.bot_handoffs_total) || 0,
  };
}

// GET /api/bot/settings — الإعدادات + قطعُ المتجرِ بأسعارِها وأرضيّاتِها
export async function getBotSettings(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const bot = await loadBot(store.id);
    if (!bot) return res.status(503).json({ error: 'الميزة قيد التحديث على الخادم. جرّبي بعد قليل.' });

    const r = await query(
      `SELECT id, name, price, floor_price, images, stock, size_stock, color_stock
       FROM products WHERE store_id = $1 AND hidden_at IS NULL
       ORDER BY featured DESC, created_at DESC LIMIT 200`,
      [store.id]
    );
    const products = r.rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      floorPrice: p.floor_price != null ? Number(p.floor_price) : null,
      // منتجاتُ المنصّةِ فيديو بلا صور، وcldThumb تأخذُ لقطةً من الفيديو —
      // فبلا هذا تبقى كلُّ مصغّراتِ القائمةِ مربّعاتٍ فارغة.
      image: (Array.isArray(p.images) ? p.images.filter(Boolean)[0] : '') || p.video_url || '',
      stock: stockLine(p),
    }));

    // هل لهذا الخادمِ مزوّدُ ذكاءٍ أصلاً؟ التاجرةُ تستحقُّ أن تعرفَ أنّها على
    // المحرّكِ المجّانيِّ بدل أن تظنَّ الردودَ باهتةً بلا سبب.
    const smart = Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
    res.json({ settings: mapBot(bot), products, smart, storeName: store.name });
  } catch (err) { next(err); }
}

// PUT /api/bot/settings
export async function saveBotSettings(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const b = req.body || {};

    const channels = (Array.isArray(b.channels) ? b.channels : [])
      .map(String).filter((c) => CHANNELS.includes(c));
    const time = (v, def) => (/^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v) : def);
    const hours = { from: time(b.hours?.from, '09:00'), to: time(b.hours?.to, '21:00') };

    // المنتجُ المروَّجُ يجبُ أن يكونَ من هذا المتجر: معرّفٌ من متجرٍ آخرَ يجعلُ
    // بائعتَنا تروّجُ لقطعةِ جارتِها.
    let promo = null;
    if (b.promoProduct) {
      const p = await query('SELECT id FROM products WHERE id = $1 AND store_id = $2', [b.promoProduct, store.id])
        .catch(() => ({ rows: [] }));
      promo = p.rows[0]?.id || null;
    }

    await query(
      `UPDATE stores SET
         bot_enabled = $2, bot_channels = $3, bot_mode = $4, bot_tone = $5, bot_dialect = $6,
         bot_hours = $7, bot_haggle = $8, bot_haggle_steps = $9, bot_signature = $10,
         bot_notes = $11, bot_promo_product = $12
       WHERE id = $1`,
      [
        store.id,
        b.enabled === true,
        JSON.stringify(channels.length ? channels : ['site']),
        MODES.includes(b.mode) ? b.mode : 'always',
        TONES.includes(b.tone) ? b.tone : 'warm',
        DIALECTS.includes(b.dialect) ? b.dialect : 'ps',
        JSON.stringify(hours),
        b.haggle === true,
        Math.max(1, Math.min(3, Number(b.haggleSteps) || 2)),
        String(b.signature || '').trim().slice(0, 120),
        String(b.notes || '').trim().slice(0, 2000),
        promo,
      ]
    );
    const bot = await loadBot(store.id);
    res.json({ settings: mapBot(bot) });
  } catch (err) { next(err); }
}

// PUT /api/bot/floor — { productId, floorPrice } · null يلغي المفاصلةَ على القطعة
export async function saveFloorPrice(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const id = String(req.body.productId || '');
    const raw = req.body.floorPrice;
    const floor = raw === null || raw === '' ? null : Number(raw);
    if (floor != null && (!Number.isFinite(floor) || floor <= 0)) {
      return res.status(400).json({ error: 'سعر المفاصلة غير صالح.' });
    }
    const p = await query('SELECT id, price FROM products WHERE id = $1 AND store_id = $2', [id, store.id]);
    if (!p.rows[0]) return res.status(404).json({ error: 'المنتج غير موجود.' });
    // أرضيّةٌ فوقَ السعرِ المعروضِ ليست أرضيّة. رفضُها هنا أوضحُ من قَبولِها
    // ثمّ رؤيةِ بائعةٍ «تخصم» فترفعُ السعر.
    if (floor != null && floor >= Number(p.rows[0].price)) {
      return res.status(400).json({ error: 'سعر المفاصلة يجب أن يكون أقل من سعر القطعة.' });
    }
    await query('UPDATE products SET floor_price = $2 WHERE id = $1', [id, floor]);
    clearCatalog(store.id); // كي تفاصلَ البائعةُ بالسعرِ الجديدِ فوراً لا بعدَ دقيقتين
    res.json({ productId: id, floorPrice: floor });
  } catch (err) { next(err); }
}

// POST /api/bot/try — تجربةُ البائعةِ بلا إرسالٍ لأحد.
// التاجرةُ تجرّبُها قبلَ أن تثقَ بها على زبونةٍ حقيقيّة — وهذا وحدَه ما يجعلُها
// تضغطُ «شغّليها».
export async function tryBot(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const bot = await loadBot(store.id);
    if (!bot) return res.status(503).json({ error: 'الميزة قيد التحديث على الخادم.' });

    const messages = (Array.isArray(req.body.messages) ? req.body.messages : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 800) }))
      .filter((m) => m.content);
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'اكتبي رسالة أولاً.' });
    }

    // التجربةُ تتجاهلُ مفتاحَ التشغيلِ والقناةَ والدوام: التاجرةُ تجرّبُ قبلَ أن
    // تشغّل، فلو اشترطنا التشغيلَ لصارت التجربةُ بلا معنى.
    const out = await agentReply({
      store, bot: { ...bot, bot_enabled: true }, messages, stage: Number(req.body.stage) || 0,
    });
    res.json({
      reply: out.reply, productIds: out.ids, offer: out.offer,
      handoff: out.handoff, stage: out.stage, usedAi: out.usedAi,
    });
  } catch (err) { next(err); }
}

export { allowedPrice };

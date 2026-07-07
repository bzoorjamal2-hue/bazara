import { query } from '../config/db.js';
import slugify from 'slugify';
import { generateUniqueStoreSlug } from '../utils/slug.js';
import { pingIndexNow } from '../utils/indexnow.js';
import { toHostedUrl } from '../utils/hostImage.js';

function mapStore(s) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    logoUrl: s.logo_url,
    phone: s.phone,
    whatsapp: s.whatsapp,
    instagram: s.instagram,
    facebook: s.facebook,
    tiktok: s.tiktok,
    themeColor: s.theme_color,
    deliveryInfo: s.delivery_info,
    paymentInfo: s.payment_info,
    deliveryPhone: s.delivery_phone || '',
    banners: Array.isArray(s.banners) ? s.banners : [],
    deliveryZones: Array.isArray(s.delivery_zones) ? s.delivery_zones : [],
    freeShippingOver: Number(s.free_shipping_over || 0),
    referralPercent: Number(s.referral_percent || 0),
    sizeChart: s.size_chart && typeof s.size_chart === 'object' ? s.size_chart : {},
    returnPolicy: s.return_policy || '',
    announcement: s.announcement || '',
    announcementEn: s.announcement_en || '',
    welcomeOffer: s.welcome_offer || '',
    categoryMeta: s.category_meta && typeof s.category_meta === 'object' ? s.category_meta : {},
    customCategories: Array.isArray(s.custom_categories) ? s.custom_categories : [],
    fbPixel: s.fb_pixel || '',
    tiktokPixel: s.tiktok_pixel || '',
    gaId: s.ga_id || '',
    loyaltyEvery: Number(s.loyalty_every || 0),
    loyaltyPercent: Number(s.loyalty_percent || 0),
    flashPercent: Number(s.flash_percent || 0),
    flashEndsAt: s.flash_ends_at,
    createdAt: s.created_at,
  };
}

// المقاسات المسموح بها بدليل المقاسات المخصّص
const CHART_SIZES = ['36', '38', '40', '42', '44', '46', '48'];

// الفئات الثابتة بالنظام (قابلة للتخصيص بصورة/اسم لكل متجر)
const CATEGORY_KEYS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// تنقية الفئات الإضافية المخصّصة: [{key, name, image}] — اسم مطلوب، مفتاح آمن وفريد
function sanitizeCustomCategories(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set(CATEGORY_KEYS); // تفادي التصادم مع الفئات الأصلية
  const out = [];
  for (const c of raw.slice(0, 20)) {
    const name = typeof c?.name === 'string' ? c.name.trim().slice(0, 40) : '';
    if (!name) continue;
    let key = typeof c?.key === 'string' ? c.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) : '';
    if (!key) key = 'c_' + Math.random().toString(36).slice(2, 9);
    if (seen.has(key)) continue;
    seen.add(key);
    const image = typeof c?.image === 'string' ? c.image.trim().slice(0, 2000) : '';
    out.push({ key, name, image });
  }
  return out;
}

// تنقية تخصيص الفئات: {"dress": {image, name}} — مفاتيح معروفة فقط، نصوص آمنة
function sanitizeCategoryMeta(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const c of CATEGORY_KEYS) {
    const m = raw[c];
    if (!m || typeof m !== 'object') continue;
    const image = typeof m.image === 'string' ? m.image.trim().slice(0, 2000) : '';
    const name = typeof m.name === 'string' ? m.name.trim().slice(0, 40) : '';
    if (image || name) out[c] = { image, name };
  }
  return out;
}

// تنقية دليل المقاسات: {"38": {bust,waist,hips}, ...} — أرقام بين 0 و300، مقاسات معروفة فقط
function sanitizeSizeChart(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const s of CHART_SIZES) {
    const m = raw[s];
    if (!m || typeof m !== 'object') continue;
    const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n <= 300 ? n : 0; };
    const bust = num(m.bust), waist = num(m.waist), hips = num(m.hips);
    if (bust || waist || hips) out[s] = { bust, waist, hips };
  }
  return out;
}

// تنقية مناطق التوصيل [{name, fee}] — حد أقصى 60 منطقة
function sanitizeZones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 60)
    .map((z) => ({ name: String(z?.name || '').trim().slice(0, 60), fee: Math.max(0, Number(z?.fee) || 0) }))
    .filter((z) => z.name);
}

// تنقية شرايح البانر القادمة من النموذج (حد أقصى 5، نص آمن + خلفية مخصّصة)
export function sanitizeBanners(raw) {
  if (!Array.isArray(raw)) return [];
  const bgTypes = ['color', 'image', 'video'];
  return raw
    .slice(0, 5)
    .map((b) => ({
      title: String(b?.title || '').trim().slice(0, 80),
      subtitle: String(b?.subtitle || '').trim().slice(0, 160),
      bgType: bgTypes.includes(b?.bgType) ? b.bgType : '',
      bgValue: String(b?.bgValue || '').slice(0, 900000), // يسمح بصورة base64 مضغوطة أو رابط
      // زر اختياري على الشريحة: نص + وجهة (رابط خارجي أو مسار داخلي)
      btnLabel: String(b?.btnLabel || '').trim().slice(0, 40),
      btnHref: String(b?.btnHref || '').trim().slice(0, 500),
    }))
    .filter((b) => b.title || b.subtitle || b.bgValue);
}

// جلب متجر المستخدم الحالي مع إحصائيات بسيطة
export async function getMyStore(req, res, next) {
  try {
    const storeResult = await query('SELECT * FROM stores WHERE user_id = $1', [req.user.id]);
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر لهذا المستخدم.' });

    const countResult = await query('SELECT COUNT(*)::int AS count FROM products WHERE store_id = $1', [store.id]);

    res.json({
      store: mapStore(store),
      stats: { productsCount: countResult.rows[0].count },
    });
  } catch (err) {
    next(err);
  }
}

// تحديث إعدادات المتجر (المالك فقط)
export async function updateMyStore(req, res, next) {
  const { name, description, logoUrl, phone, whatsapp, instagram, facebook, tiktok, themeColor, deliveryInfo, paymentInfo } = req.body;
  const deliveryPhone = String(req.body.deliveryPhone || '').replace(/[^\d+]/g, '').slice(0, 40);
  const banners = sanitizeBanners(req.body.banners);
  const deliveryZones = sanitizeZones(req.body.deliveryZones);
  const freeShippingOver = Math.max(0, Number(req.body.freeShippingOver) || 0);
  const referralPercent = Math.min(90, Math.max(0, Number(req.body.referralPercent) || 0));
  const sizeChart = sanitizeSizeChart(req.body.sizeChart);
  const returnPolicy = String(req.body.returnPolicy || '').slice(0, 2000);
  const announcement = String(req.body.announcement || '').slice(0, 500);
  const announcementEn = String(req.body.announcementEn || '').slice(0, 500);
  const welcomeOffer = String(req.body.welcomeOffer || '').slice(0, 300);
  const categoryMeta = sanitizeCategoryMeta(req.body.categoryMeta);
  const customCategories = sanitizeCustomCategories(req.body.customCategories);
  // بكسلات التمويل: معرّفات فقط (أرقام/حروف/شرطات) — تُحقن كسكربتات رسمية بالواجهة
  const pixelId = (v, max = 40) => String(v || '').trim().replace(/[^\w-]/g, '').slice(0, max);
  const fbPixel = pixelId(req.body.fbPixel);
  const tiktokPixel = pixelId(req.body.tiktokPixel);
  const gaId = pixelId(req.body.gaId);
  // نقاط الولاء: كل N طلبات (2-50) → خصم % (0-50). صفر = معطّلة
  const loyaltyEvery = Math.min(50, Math.max(0, Math.round(Number(req.body.loyaltyEvery) || 0)));
  const loyaltyPercent = Math.min(50, Math.max(0, Number(req.body.loyaltyPercent) || 0));
  // عرض الفلاش: نسبة (0-90) + وقت انتهاء. تاريخ غير صالح/فارغ → null (معطّل)
  const flashPercent = Math.min(90, Math.max(0, Number(req.body.flashPercent) || 0));
  const flashEndsRaw = req.body.flashEndsAt ? new Date(req.body.flashEndsAt) : null;
  const flashEndsAt = flashEndsRaw && !Number.isNaN(flashEndsRaw.getTime()) ? flashEndsRaw : null;
  try {
    const current = await query('SELECT id, name, slug, old_slugs FROM stores WHERE user_id = $1', [req.user.id]);
    const store = current.rows[0];
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر لهذا المستخدم.' });

    const oldSlugs = Array.isArray(store.old_slugs) ? store.old_slugs : [];
    let slug = store.slug;
    const customSlug = String(req.body.slug || '').trim();
    if (customSlug) {
      // رابط متجر مخصّص (handle لاتيني يختاره المالك)
      const clean = slugify(customSlug, { lower: true, strict: true });
      if (!clean || clean.length < 3) {
        return res.status(400).json({ error: 'رابط المتجر غير صالح (٣ أحرف لاتينية/أرقام على الأقل).' });
      }
      if (clean !== store.slug) {
        const taken = await query('SELECT id FROM stores WHERE (slug = $1 OR $1 = ANY(old_slugs)) AND id <> $2', [clean, store.id]);
        if (taken.rows.length) return res.status(400).json({ error: 'هذا الرابط مستخدم، اختاري رابطاً آخر.' });
        slug = clean;
      }
    } else if (name && name !== store.name) {
      slug = await generateUniqueStoreSlug(name, store.id);
    }
    // نحفظ الروابط القديمة لتبقى شغّالة (تحوّل للجديد)
    const newOldSlugs = slug !== store.slug ? [...new Set([...oldSlugs, store.slug])].slice(-10) : oldSlugs;

    // حماية: لو دخل الشعار كصورة base64 ثقيلة، نرفعه تلقائياً لـ Cloudinary ونخزّن الرابط الخفيف
    const hostedLogo = await toHostedUrl(logoUrl || '');

    const updated = await query(
      `UPDATE stores SET
         name = $1, description = $2, logo_url = $3, slug = $4,
         phone = $5, whatsapp = $6, instagram = $7, facebook = $8, tiktok = $9,
         theme_color = $10, delivery_info = $11, payment_info = $12,
         banners = $13::jsonb, delivery_zones = $14::jsonb, free_shipping_over = $15,
         size_chart = $16::jsonb, return_policy = $17, announcement = $18, welcome_offer = $19,
         category_meta = $20::jsonb, custom_categories = $21::jsonb, referral_percent = $23,
         announcement_en = $24, old_slugs = $25::text[], delivery_phone = $26,
         fb_pixel = $27, tiktok_pixel = $28, ga_id = $29,
         loyalty_every = $30, loyalty_percent = $31,
         flash_percent = $32, flash_ends_at = $33, updated_at = now()
       WHERE id = $22
       RETURNING *`,
      [
        name,
        description || '',
        hostedLogo,
        slug,
        phone || '',
        whatsapp || '',
        instagram || '',
        facebook || '',
        tiktok || '',
        themeColor || '#d4af37',
        deliveryInfo || '',
        paymentInfo || '',
        JSON.stringify(banners),
        JSON.stringify(deliveryZones),
        freeShippingOver,
        JSON.stringify(sizeChart),
        returnPolicy,
        announcement,
        welcomeOffer,
        JSON.stringify(categoryMeta),
        JSON.stringify(customCategories),
        store.id,
        referralPercent,
        announcementEn,
        newOldSlugs,
        deliveryPhone,
        fbPixel,
        tiktokPixel,
        gaId,
        loyaltyEvery,
        loyaltyPercent,
        flashPercent,
        flashEndsAt,
      ]
    );

    const s = updated.rows[0];
    pingIndexNow(`${process.env.PUBLIC_SITE_URL}/store/${s.slug}`);
    res.json({ store: mapStore(s) });
  } catch (err) {
    next(err);
  }
}

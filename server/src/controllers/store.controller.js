import { query } from '../config/db.js';
import slugify from 'slugify';
import { generateUniqueStoreSlug } from '../utils/slug.js';
import { pingIndexNow } from '../utils/indexnow.js';
import { toHostedUrl } from '../utils/hostImage.js';
import { normalizeTiers, flatInternalLocalities, mapExternalLocalities } from '../config/deliveryCities.js';
import { cachedLocalities, fetchAllLocalities } from '../config/opost.js';
import { ensureToken } from './opost.controller.js';

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
    deliveryTiers: normalizeTiers(s.delivery_tiers),
    freeShippingOver: Number(s.free_shipping_over || 0),
    referralPercent: Number(s.referral_percent || 0),
    sizeChart: s.size_chart && typeof s.size_chart === 'object' ? s.size_chart : {},
    returnPolicy: s.return_policy || '',
    announcement: s.announcement || '',
    announcementEn: s.announcement_en || '',
    tagline: s.tagline || '',
    taglineEn: s.tagline_en || '',
    welcomeOffer: s.welcome_offer || '',
    categoryMeta: s.category_meta && typeof s.category_meta === 'object' ? s.category_meta : {},
    customCategories: Array.isArray(s.custom_categories) ? s.custom_categories : [],
    collections: Array.isArray(s.collections) ? s.collections : [],
    fbPixel: s.fb_pixel || '',
    tiktokPixel: s.tiktok_pixel || '',
    gaId: s.ga_id || '',
    loyaltyEvery: Number(s.loyalty_every || 0),
    loyaltyPercent: Number(s.loyalty_percent || 0),
    flashPercent: Number(s.flash_percent || 0),
    flashEndsAt: s.flash_ends_at,
    cardPaymentEnabled: Boolean(s.card_payment_enabled),
    // حسابُ التاجرةِ البنكيّ — إليه يصلُ ثمنُ طلباتِها. الآيبانُ مقنّعٌ إلّا آخرَ أربعة
    bankAccountName: s.bank_account_name || '',
    bankName: s.bank_name || '',
    bankIban: s.bank_iban ? '••••' + s.bank_iban.slice(-4) : '',
    bankSwift: s.bank_swift || '',
    payoutStatus: s.payout_status || 'none',
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

// تنقية مجموعات المتجر التحريرية (تسوّقي حسب المناسبة): عنوان + صورة + كلمة بحث.
// لا روابط حرّة (الواجهة تبني /search بكلمة البحث) فلا حقن. الصورة رابط أو مضمّنة.
// (كانت مستدعاة بلا تعريف → ReferenceError يُسقط كل حفظ إعدادات + ينهار الخادم.)
function sanitizeStoreCollections(raw) {
  if (!Array.isArray(raw)) return [];
  // 12: نفس السقف الذي تسمح به لوحة المالكة. كان 8 هنا، فالبطاقات
  // التاسعة فما فوق تُرمى بصمتٍ بعد رسالة «تم الحفظ» وتعود المالكة فلا تجدها.
  return raw
    .slice(0, 12)
    .map((c) => ({
      title: String(c?.title ?? '').slice(0, 60).trim(),
      titleEn: String(c?.titleEn ?? '').slice(0, 60).trim(),
      image: typeof c?.image === 'string' ? c.image.trim().slice(0, 2000) : '',
      q: String(c?.q ?? '').slice(0, 60).trim(),
    }))
    .filter((c) => c.title && c.q); // بلا عنوان أو كلمة بحث لا معنى للبطاقة
}

// تنقية تخصيص الفئات: {"dress": {image, name}} — نصوص آمنة ومفاتيح بنمطٍ صارم.
//
// كنّا نلفّ على الفئات السبع الثابتة وحدها، فتخصيص أي فئةٍ يضيفها المدير
// للمنصّة (صورة/اسم/إخفاء) يُرمى بصمتٍ ولا يُحفظ — تظنّ المالكة أنها حفظت
// وتعود فتجده كما كان. نقبل الآن أي مفتاحٍ يطابق نمط مفاتيح المنصّة نفسه
// (a-z و0-9 وشرطة/شرطة سفلية، 2–50 محرفاً) فيبقى الإدخال مقيّداً.
const CAT_KEY_RE = /^[a-z0-9_-]{2,50}$/i;
// مفاتيح تُلوّث النموذج الأولي لو أُسندت على كائنٍ عاديّ — يمرّرها النمط لأنها
// حروفٌ وشرطات سفلية، فنستبعدها صراحةً.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeCategoryMeta(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = Object.create(null);
  const keys = Object.keys(raw)
    .filter((k) => CAT_KEY_RE.test(k) && !UNSAFE_KEYS.has(k.toLowerCase()))
    .slice(0, 40);
  for (const c of keys) {
    const m = raw[c];
    if (!m || typeof m !== 'object') continue;
    const image = typeof m.image === 'string' ? m.image.trim().slice(0, 2000) : '';
    const name = typeof m.name === 'string' ? m.name.trim().slice(0, 40) : '';
    const hidden = m.hidden === true || m.hidden === 'true';
    if (image || name || hidden) out[c] = { image, name, ...(hidden ? { hidden: true } : {}) };
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

// قائمة الأماكن المسطّحة للمتجر (كل مدينة وقرية بندٌ مستقل): قائمة أوبتيموس الكاملة
// إن كانت مخزّنة، وإلا قائمتنا الداخلية فوراً مع بناء أوبتيموس بالخلفية (بلا تأخير).
async function localitiesForStoreRow(store) {
  const tiers = store.delivery_tiers;
  if (store.opost_connected) {
    const cached = cachedLocalities();
    if (cached && cached.length) return mapExternalLocalities(cached, tiers);
    ensureToken(store).then((token) => fetchAllLocalities(token)).catch(() => {});
  }
  return flatInternalLocalities(tiers);
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
      // قائمة مسطّحة: كل مدينة وقرية بندٌ مستقل بسعره — لخانة البحث بنموذج الطلب اليدوي
      localities: await localitiesForStoreRow(store),
    });
  } catch (err) {
    next(err);
  }
}

// تحديث إعدادات المتجر (المالك فقط)
export async function updateMyStore(req, res, next) {
  // كل المعالجة داخل try — كانت التنقية تُنفَّذ قبل try، فأي خطأ فيها يهرب كرفض غير
  // ملتقَط ويُسقط الاتصال ("فقدت الاتصال") بدل إرجاع خطأ نظيف. الآن كل شيء محاط.
  try {
  const { name, description, logoUrl, phone, whatsapp, instagram, facebook, tiktok, themeColor, deliveryInfo, paymentInfo } = req.body;
  const deliveryPhone = String(req.body.deliveryPhone || '').replace(/[^\d+]/g, '').slice(0, 40);
  const banners = sanitizeBanners(req.body.banners);
  const deliveryZones = []; // النظام صار ثلاث شرائح ثابتة فقط (بلا استثناءات نصية) — العمود يبقى فارغاً
  const deliveryTiers = normalizeTiers(req.body.deliveryTiers);
  const freeShippingOver = Math.max(0, Number(req.body.freeShippingOver) || 0);
  const referralPercent = Math.min(90, Math.max(0, Number(req.body.referralPercent) || 0));
  const sizeChart = sanitizeSizeChart(req.body.sizeChart);
  const returnPolicy = String(req.body.returnPolicy || '').slice(0, 2000);
  const announcement = String(req.body.announcement || '').slice(0, 500);
  const announcementEn = String(req.body.announcementEn || '').slice(0, 500);
  const tagline = String(req.body.tagline || '').slice(0, 120);
  const taglineEn = String(req.body.taglineEn || '').slice(0, 120);
  const welcomeOffer = String(req.body.welcomeOffer || '').slice(0, 300);
  const categoryMeta = sanitizeCategoryMeta(req.body.categoryMeta);
  const customCategories = sanitizeCustomCategories(req.body.customCategories);
  const collections = sanitizeStoreCollections(req.body.collections);
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
  // Paytabs: دفع بالبطاقة اختياري — المالك يفعّله ويدخل بياناته
  const cardPaymentEnabled = req.body.cardPaymentEnabled === true || req.body.cardPaymentEnabled === 'true';
  // الحسابُ البنكيُّ للتاجرة — الآيبانُ بلا مسافاتٍ وبأحرفٍ كبيرة كما تطلبُه أنظمةُ التحويل
  const bankAccountName = String(req.body.bankAccountName || '').trim().slice(0, 120);
  const bankName = String(req.body.bankName || '').trim().slice(0, 80);
  const bankIban = String(req.body.bankIban || '').replace(/\s+/g, '').toUpperCase().slice(0, 40);
  const bankSwift = String(req.body.bankSwift || '').replace(/\s+/g, '').toUpperCase().slice(0, 20);
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
         collections = $34::jsonb,
         announcement_en = $24, old_slugs = $25::text[], delivery_phone = $26,
         fb_pixel = $27, tiktok_pixel = $28, ga_id = $29,
         loyalty_every = $30, loyalty_percent = $31,
         flash_percent = $32, flash_ends_at = $33, delivery_tiers = $35::jsonb,
         tagline = $36, tagline_en = $37,
         card_payment_enabled = $38,
         bank_account_name = $39, bank_name = $40,
         bank_iban = CASE WHEN $41 = '' OR $41 LIKE '••••%' THEN bank_iban ELSE $41 END,
         bank_swift = $42,
         -- تغييرُ الآيبانِ يُبطلُ تسجيلَ المستفيدِ السابقَ عند PayTabs: نُعيدُها للانتظار
         paytabs_entity_id = CASE WHEN $41 = '' OR $41 LIKE '••••%' THEN paytabs_entity_id ELSE '' END,
         payout_status = CASE
           WHEN $41 <> '' AND $41 NOT LIKE '••••%' THEN 'pending'
           WHEN payout_status = 'none' AND bank_iban <> '' THEN 'pending'
           ELSE payout_status END,
         updated_at = now()
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
        JSON.stringify(collections),
        JSON.stringify(deliveryTiers),
        tagline,
        taglineEn,
        cardPaymentEnabled,
        bankAccountName,
        bankName,
        bankIban,
        bankSwift,
      ]
    );

    const s = updated.rows[0];
    pingIndexNow(`${process.env.PUBLIC_SITE_URL}/store/${s.slug}`);
    res.json({ store: mapStore(s) });
  } catch (err) {
    next(err);
  }
}

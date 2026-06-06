import { query } from '../config/db.js';
import { generateUniqueStoreSlug } from '../utils/slug.js';
import { pingIndexNow } from '../utils/indexnow.js';

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
    tiktok: s.tiktok,
    themeColor: s.theme_color,
    deliveryInfo: s.delivery_info,
    paymentInfo: s.payment_info,
    banners: Array.isArray(s.banners) ? s.banners : [],
    createdAt: s.created_at,
  };
}

// تنقية شرايح البانر القادمة من النموذج (حد أقصى 5، نص آمن)
function sanitizeBanners(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 5)
    .map((b) => ({
      title: String(b?.title || '').trim().slice(0, 80),
      subtitle: String(b?.subtitle || '').trim().slice(0, 160),
    }))
    .filter((b) => b.title || b.subtitle);
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
  const { name, description, logoUrl, phone, whatsapp, instagram, tiktok, themeColor, deliveryInfo, paymentInfo } = req.body;
  const banners = sanitizeBanners(req.body.banners);
  try {
    const current = await query('SELECT id, name, slug FROM stores WHERE user_id = $1', [req.user.id]);
    const store = current.rows[0];
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر لهذا المستخدم.' });

    let slug = store.slug;
    if (name && name !== store.name) {
      slug = await generateUniqueStoreSlug(name, store.id);
    }

    const updated = await query(
      `UPDATE stores SET
         name = $1, description = $2, logo_url = $3, slug = $4,
         phone = $5, whatsapp = $6, instagram = $7, tiktok = $8,
         theme_color = $9, delivery_info = $10, payment_info = $11,
         banners = $12::jsonb, updated_at = now()
       WHERE id = $13
       RETURNING *`,
      [
        name,
        description || '',
        logoUrl || '',
        slug,
        phone || '',
        whatsapp || '',
        instagram || '',
        tiktok || '',
        themeColor || '#d4af37',
        deliveryInfo || '',
        paymentInfo || '',
        JSON.stringify(banners),
        store.id,
      ]
    );

    const s = updated.rows[0];
    pingIndexNow(`${process.env.PUBLIC_SITE_URL}/store/${s.slug}`);
    res.json({ store: mapStore(s) });
  } catch (err) {
    next(err);
  }
}

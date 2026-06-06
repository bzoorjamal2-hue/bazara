import { query } from '../config/db.js';
import { mapProduct } from './product.controller.js';
import { activeStoreSql } from '../utils/subscription.js';

// أعمدة المنتج + بيانات المتجر + تجميع التقييمات. نربط users لفلترة المشتركين الفعّالين.
const PRODUCT_SELECT = `
  SELECT p.*, s.slug AS store_slug, s.name AS store_name,
         s.whatsapp AS store_whatsapp, s.instagram AS store_instagram, s.phone AS store_phone,
         COALESCE(r.avg, 0) AS rating_avg, COALESCE(r.cnt, 0) AS rating_count
  FROM products p
  JOIN stores s ON s.id = p.store_id
  JOIN users u ON u.id = s.user_id
  LEFT JOIN (
    SELECT product_id, AVG(rating)::numeric AS avg, COUNT(*)::int AS cnt
    FROM reviews GROUP BY product_id
  ) r ON r.product_id = p.id
`;

function mapStorePublic(s) {
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

export async function getHomeData(_req, res, next) {
  try {
    const active = activeStoreSql('u');
    const stores = await query(
      `SELECT s.*, COUNT(p.id)::int AS products_count
       FROM stores s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN products p ON p.store_id = s.id
       WHERE ${active}
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 8`
    );

    const featured = await query(`${PRODUCT_SELECT} WHERE p.featured = true AND ${active} ORDER BY p.created_at DESC LIMIT 8`);
    const latest = await query(`${PRODUCT_SELECT} WHERE ${active} ORDER BY p.created_at DESC LIMIT 12`);

    res.json({
      stores: stores.rows.map((s) => ({ ...mapStorePublic(s), productsCount: s.products_count })),
      featured: featured.rows.map(mapProduct),
      products: latest.rows.map(mapProduct),
    });
  } catch (err) {
    next(err);
  }
}

export async function getStoreBySlug(req, res, next) {
  const { slug } = req.params;
  try {
    const active = activeStoreSql('u');
    const storeResult = await query(
      `SELECT s.* FROM stores s JOIN users u ON u.id = s.user_id WHERE s.slug = $1 AND ${active}`,
      [slug]
    );
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'المتجر غير موجود.' });

    const productsResult = await query(
      `${PRODUCT_SELECT} WHERE p.store_id = $1 ORDER BY p.featured DESC, p.created_at DESC`,
      [store.id]
    );

    res.json({
      store: mapStorePublic(store),
      products: productsResult.rows.map(mapProduct),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  const { id } = req.params;
  try {
    const active = activeStoreSql('u');
    const result = await query(`${PRODUCT_SELECT} WHERE p.id = $1 AND ${active}`, [id]);
    const product = result.rows[0];
    if (!product) return res.status(404).json({ error: 'المنتج غير موجود.' });

    const reviews = await query(
      'SELECT id, author_name, rating, comment, created_at FROM reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      product: mapProduct(product),
      reviews: reviews.rows.map((r) => ({
        id: r.id,
        authorName: r.author_name,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// منتجات فئة معيّنة عبر كل المتاجر الفعّالة (تصفّح حسب الفئة)
export async function getByCategory(req, res, next) {
  const { cat } = req.params;
  const valid = ['abaya', 'set', 'dress', 'hijab'];
  if (!valid.includes(cat)) return res.status(400).json({ error: 'فئة غير صالحة.' });
  try {
    const active = activeStoreSql('u');
    const r = await query(
      `${PRODUCT_SELECT} WHERE p.category = $1 AND ${active} ORDER BY p.featured DESC, p.created_at DESC LIMIT 60`,
      [cat]
    );
    res.json({ category: cat, products: r.rows.map(mapProduct) });
  } catch (err) {
    next(err);
  }
}

export async function addReview(req, res, next) {
  const { id } = req.params;
  const { authorName, rating, comment } = req.body;
  try {
    const exists = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود.' });

    const result = await query(
      'INSERT INTO reviews (product_id, author_name, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, author_name, rating, comment, created_at',
      [id, authorName, rating, comment || '']
    );
    const r = result.rows[0];
    res.status(201).json({
      review: { id: r.id, authorName: r.author_name, rating: r.rating, comment: r.comment, createdAt: r.created_at },
    });
  } catch (err) {
    next(err);
  }
}

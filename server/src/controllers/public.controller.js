import { query } from '../config/db.js';
import { mapProduct } from './product.controller.js';
import { activeStoreSql } from '../utils/subscription.js';

// أعمدة المنتج + بيانات المتجر + تجميع التقييمات. نربط users لفلترة المشتركين الفعّالين.
const PRODUCT_SELECT = `
  SELECT p.*, s.slug AS store_slug, s.name AS store_name,
         s.whatsapp AS store_whatsapp, s.instagram AS store_instagram, s.phone AS store_phone,
         s.size_chart AS store_size_chart, s.return_policy AS store_return_policy,
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
    facebook: s.facebook,
    tiktok: s.tiktok,
    themeColor: s.theme_color,
    deliveryInfo: s.delivery_info,
    paymentInfo: s.payment_info,
    banners: Array.isArray(s.banners) ? s.banners : [],
    deliveryZones: Array.isArray(s.delivery_zones) ? s.delivery_zones : [],
    freeShippingOver: Number(s.free_shipping_over || 0),
    sizeChart: s.size_chart && typeof s.size_chart === 'object' ? s.size_chart : {},
    returnPolicy: s.return_policy || '',
    ownerPhone: s.owner_phone || '', // رقم المالك من التسجيل (احتياطي للواتساب)
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
      `SELECT s.*, u.phone AS owner_phone FROM stores s JOIN users u ON u.id = s.user_id WHERE s.slug = $1 AND ${active}`,
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

// تتبّع الطلبات: الزبون يُدخل رقم هاتفه فيرى حالة طلباته (مطابقة بآخر 9 أرقام لتفادي اختلاف الصيغة)
export async function trackOrders(req, res, next) {
  const phone = String(req.body.phone || '').replace(/\D/g, '');
  if (phone.length < 6) return res.status(400).json({ error: 'أدخل رقم هاتف صحيح.' });
  const last9 = phone.slice(-9);
  try {
    const r = await query(
      `SELECT o.reference, o.status, o.items, o.total, o.delivery_fee, o.discount, o.created_at, o.city, s.name AS store_name
       FROM orders o JOIN stores s ON s.id = o.store_id
       WHERE regexp_replace(o.customer_phone, '\\D', '', 'g') LIKE $1
       ORDER BY o.created_at DESC LIMIT 20`,
      ['%' + last9]
    );
    res.json({
      orders: r.rows.map((o) => ({
        reference: o.reference,
        status: o.status,
        items: o.items,
        total: Number(o.total),
        deliveryFee: Number(o.delivery_fee || 0),
        discount: Number(o.discount || 0),
        city: o.city || '',
        storeName: o.store_name,
        createdAt: o.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// بيانات خفيفة للسلة: مناطق التوصيل + شحن مجاني + واتساب (بلا تحميل المنتجات)
export async function getStoreCheckout(req, res, next) {
  const { slug } = req.params;
  try {
    const r = await query(
      'SELECT whatsapp, delivery_zones, free_shipping_over FROM stores WHERE slug = $1',
      [slug]
    );
    const s = r.rows[0];
    if (!s) return res.status(404).json({ error: 'المتجر غير موجود.' });
    res.json({
      whatsapp: s.whatsapp || '',
      deliveryZones: Array.isArray(s.delivery_zones) ? s.delivery_zones : [],
      freeShippingOver: Number(s.free_shipping_over || 0),
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
      'SELECT id, author_name, rating, comment, image_url, created_at FROM reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      product: mapProduct(product),
      reviews: reviews.rows.map((r) => ({
        id: r.id,
        authorName: r.author_name,
        rating: r.rating,
        comment: r.comment,
        imageUrl: r.image_url || '',
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// منتجات فئة معيّنة. مع ?store=slug تُحصر بمتجر واحد (تفادي خلط منتجات المتاجر)،
// وبدونه تشمل كل المتاجر الفعّالة (تصفّح ماركت بازارا).
export async function getByCategory(req, res, next) {
  const { cat } = req.params;
  const storeSlug = (req.query.store || '').trim();
  const valid = ['abaya', 'set', 'dress', 'hijab', 'trench'];
  if (!valid.includes(cat)) return res.status(400).json({ error: 'فئة غير صالحة.' });
  try {
    const active = activeStoreSql('u');
    let r;
    if (storeSlug) {
      r = await query(
        `${PRODUCT_SELECT} WHERE p.category = $1 AND s.slug = $2 AND ${active} ORDER BY p.featured DESC, p.created_at DESC LIMIT 60`,
        [cat, storeSlug]
      );
    } else {
      r = await query(
        `${PRODUCT_SELECT} WHERE p.category = $1 AND ${active} ORDER BY p.featured DESC, p.created_at DESC LIMIT 60`,
        [cat]
      );
    }
    res.json({ category: cat, products: r.rows.map(mapProduct) });
  } catch (err) {
    next(err);
  }
}

export async function addReview(req, res, next) {
  const { id } = req.params;
  const { authorName, rating, comment } = req.body;
  // تحقّق من المدخلات: اسم غير فارغ + تقييم صحيح بين 1 و5
  const name = (authorName || '').trim();
  const stars = Number(rating);
  if (!name || name.length > 60) return res.status(400).json({ error: 'الاسم مطلوب.' });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: 'تقييم غير صالح.' });
  // صورة اختيارية: رابط http(s) أو data URL لصورة فقط، بحدّ معقول للطول
  let imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
  if (imageUrl && !/^(https?:\/\/|data:image\/)/i.test(imageUrl)) imageUrl = '';
  imageUrl = imageUrl.slice(0, 2000);
  try {
    const exists = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود.' });

    const result = await query(
      'INSERT INTO reviews (product_id, author_name, rating, comment, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, author_name, rating, comment, image_url, created_at',
      [id, name, stars, (comment || '').trim().slice(0, 500), imageUrl]
    );
    const r = result.rows[0];
    res.status(201).json({
      review: { id: r.id, authorName: r.author_name, rating: r.rating, comment: r.comment, imageUrl: r.image_url || '', createdAt: r.created_at },
    });
  } catch (err) {
    next(err);
  }
}

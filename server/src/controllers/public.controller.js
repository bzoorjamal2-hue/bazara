import { query } from '../config/db.js';
import { mapProduct } from './product.controller.js';
import { activeStoreSql } from '../utils/subscription.js';
import { notifyStoreOwner } from '../utils/notify.js';
import { statusLabelAr as opostStatusLabelAr } from '../config/opost.js';
import { epsStatusLabelAr } from '../config/eps.js';

// أعمدة المنتج + بيانات المتجر + تجميع التقييمات. نربط users لفلترة المشتركين الفعّالين.
const PRODUCT_SELECT = `
  SELECT p.*, s.slug AS store_slug, s.name AS store_name, s.logo_url AS store_logo,
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
    referralPercent: Number(s.referral_percent || 0),
    sizeChart: s.size_chart && typeof s.size_chart === 'object' ? s.size_chart : {},
    returnPolicy: s.return_policy || '',
    announcement: s.announcement || '',
    announcementEn: s.announcement_en || '',
    welcomeOffer: s.welcome_offer || '',
    categoryMeta: s.category_meta && typeof s.category_meta === 'object' ? s.category_meta : {},
    customCategories: Array.isArray(s.custom_categories) ? s.custom_categories : [],
    ownerPhone: s.owner_phone || '', // رقم المالك من التسجيل (احتياطي للواتساب)
    createdAt: s.created_at,
  };
}

function mapStory(s) {
  return {
    id: s.id,
    mediaUrl: s.media_url,
    mediaType: s.media_type,
    productId: s.product_id || null,
    caption: s.caption || '',
    views: s.views != null ? Number(s.views) : 0,
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
    // بانرات الصفحة الرئيسية (يتحكّم بها المدير) — قد لا يوجد الجدول بعد على نسخ قديمة
    let homeBanners = [];
    try {
      const sb = await query('SELECT home_banners FROM site_settings WHERE id = 1');
      homeBanners = Array.isArray(sb.rows[0]?.home_banners) ? sb.rows[0].home_banners : [];
    } catch { /* الجدول غير موجود بعد */ }

    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'); // كاش حافة Vercel
    res.json({
      stores: stores.rows.map((s) => ({ ...mapStorePublic(s), productsCount: s.products_count })),
      featured: featured.rows.map(mapProduct),
      products: latest.rows.map(mapProduct),
      homeBanners,
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
      `SELECT s.*, u.phone AS owner_phone FROM stores s JOIN users u ON u.id = s.user_id
       WHERE (s.slug = $1 OR $1 = ANY(s.old_slugs)) AND ${active}`,
      [slug]
    );
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'المتجر غير موجود.' });

    // نجلب كل المنتجات (الواجهة تفلتر/تفرز فوراً بالمتصفّح)، مع سقف أمان يمنع تحميلاً ضخماً لو كبر المتجر جداً
    const productsResult = await query(
      `${PRODUCT_SELECT} WHERE p.store_id = $1 ORDER BY p.featured DESC, p.created_at DESC LIMIT 500`,
      [store.id]
    );

    // ستوريات المتجر الفعّالة (لم تنتهِ بعد) — للعرض على دائرة الستوري
    const storiesResult = await query(
      `SELECT id, media_url, media_type, product_id, caption, views, created_at FROM stories WHERE store_id = $1 AND expires_at > now() ORDER BY created_at ASC`,
      [store.id]
    );

    res.json({
      store: mapStorePublic(store),
      products: productsResult.rows.map(mapProduct),
      stories: storiesResult.rows.map(mapStory),
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
      `SELECT o.reference, o.status, o.items, o.total, o.delivery_fee, o.discount, o.created_at, o.city, s.name AS store_name,
              o.opost_tracking, o.opost_status, o.eps_barcode, o.eps_status, o.gobox_barcode, o.gobox_status
       FROM orders o JOIN stores s ON s.id = o.store_id
       WHERE regexp_replace(o.customer_phone, '\\D', '', 'g') LIKE $1
       ORDER BY o.created_at DESC LIMIT 20`,
      ['%' + last9]
    );
    // معلومات شركة التوصيل للزبون: الاسم + الحالة الحيّة (معرّبة) + رقم التتبّع.
    // '✓' يعني أُرسل بلا رقم تتبّع من الشركة — لا نعرضه كرقم.
    const courierInfo = (o) => {
      const clean = (v) => (v && v !== '✓' ? String(v) : '');
      if (o.opost_tracking) return { courier: 'أوبتيموس', tracking: clean(o.opost_tracking), courierStatus: o.opost_status ? opostStatusLabelAr(o.opost_status) : '' };
      if (o.eps_barcode) return { courier: 'EPS', tracking: clean(o.eps_barcode), courierStatus: o.eps_status ? epsStatusLabelAr(o.eps_status) : '' };
      if (o.gobox_barcode) return { courier: 'gobox', tracking: clean(o.gobox_barcode), courierStatus: o.gobox_status ? epsStatusLabelAr(o.gobox_status) : '' };
      return { courier: '', tracking: '', courierStatus: '' };
    };
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
        ...courierInfo(o),
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
  const builtin = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];
  try {
    const active = activeStoreSql('u');
    // فئة مخصّصة (غير الأصلية): لازم تكون ضمن متجر محدّد يملك هذه الفئة
    if (!builtin.includes(cat)) {
      if (!storeSlug) return res.status(400).json({ error: 'فئة غير صالحة.' });
      const sc = await query('SELECT custom_categories FROM stores WHERE slug = $1', [storeSlug]);
      const cats = Array.isArray(sc.rows[0]?.custom_categories) ? sc.rows[0].custom_categories : [];
      if (!cats.some((c) => c && c.key === cat)) return res.status(400).json({ error: 'فئة غير صالحة.' });
      const rc = await query(
        `${PRODUCT_SELECT} WHERE p.category = $1 AND s.slug = $2 AND ${active} ORDER BY p.featured DESC, p.created_at DESC LIMIT 60`,
        [cat, storeSlug]
      );
      return res.json({ category: cat, products: rc.rows.map(mapProduct) });
    }
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

// كل القطع المخفّضة عبر المتاجر الفعّالة (لصفحة "العروض")
export async function getOffers(_req, res, next) {
  try {
    const active = activeStoreSql('u');
    const r = await query(
      `${PRODUCT_SELECT} WHERE p.old_price IS NOT NULL AND p.old_price > p.price AND ${active} ORDER BY p.created_at DESC LIMIT 60`
    );
    // mapProduct يلغي الخصم المنتهي زمنياً → نُبقي ما يزال مخفّضاً فعلاً
    const products = r.rows.map(mapProduct).filter((p) => p.oldPrice && p.oldPrice > p.price);
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

// ريلز: منتجات الفيديو (تصفّح عمودي عصري). ?store=slug → ريلز متجر واحد فقط.
const REELS_PAGE = 40;
export async function getReels(req, res, next) {
  try {
    const active = activeStoreSql('u');
    const slug = (req.query.store || '').trim();
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const params = [];
    let sql = `${PRODUCT_SELECT} WHERE p.video_url IS NOT NULL AND p.video_url <> '' AND ${active}`;
    if (slug) { params.push(slug); sql += ` AND s.slug = $${params.length}`; } // ريلز متجر واحد
    sql += ` ORDER BY p.featured DESC, p.created_at DESC`;
    params.push(REELS_PAGE); sql += ` LIMIT $${params.length}`;
    params.push(offset); sql += ` OFFSET $${params.length}`;
    const r = await query(sql, params);
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    // الريلز وحدها تعرض شعار المتجر (أفاتار صغير) → نضيفه هنا فقط، ونتجاهل الشعارات الضخمة (base64) لتفادي ثقلها
    res.json({
      products: r.rows.map((row) => {
        const logo = row.store_logo || '';
        return { ...mapProduct(row), storeLogo: logo.startsWith('data:') ? '' : logo };
      }),
      hasMore: r.rows.length === REELS_PAGE,
    });
  } catch (err) {
    next(err);
  }
}

// صف ستوريات السوق العام: المتاجر الفعّالة التي لديها ستوريات حالية (للصفحة الرئيسية)
export async function getStoriesFeed(_req, res, next) {
  try {
    const active = activeStoreSql('u');
    const r = await query(
      `SELECT st.id, st.media_url, st.media_type, st.product_id, st.caption, st.views, st.created_at,
              s.slug AS store_slug, s.name AS store_name, s.logo_url AS store_logo, s.whatsapp AS store_whatsapp
       FROM stories st
       JOIN stores s ON s.id = st.store_id
       JOIN users u ON u.id = s.user_id
       WHERE st.expires_at > now() AND ${active}
       ORDER BY s.id, st.created_at ASC`
    );
    // نجمّع الستوريات حسب المتجر
    const byStore = new Map();
    for (const row of r.rows) {
      if (!byStore.has(row.store_slug)) {
        byStore.set(row.store_slug, {
          slug: row.store_slug, name: row.store_name, logoUrl: row.store_logo || '', whatsapp: row.store_whatsapp || '',
          stories: [],
        });
      }
      byStore.get(row.store_slug).stories.push(mapStory(row));
    }
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.json({ feed: [...byStore.values()].slice(0, 30) });
  } catch (err) {
    next(err);
  }
}

// عدّاد زيارات المتجر — يُستدعى مرّة لكل جلسة زائر (يُمنع التكرار على العميل).
// يدعم الروابط القديمة للمتاجر المعاد تسميتها. أي خطأ لا يزعج الزائر.
export async function trackStoreVisit(req, res) {
  try {
    const slug = String(req.params.slug || '').trim();
    if (slug) {
      await query('UPDATE stores SET views = COALESCE(views, 0) + 1 WHERE slug = $1 OR $1 = ANY(old_slugs)', [slug]);
    }
  } catch { /* غير حرج */ }
  res.json({ ok: true });
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
    const exists = await query('SELECT id, store_id, name FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود.' });
    const product = exists.rows[0];

    const result = await query(
      'INSERT INTO reviews (product_id, author_name, rating, comment, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, author_name, rating, comment, image_url, created_at',
      [id, name, stars, (comment || '').trim().slice(0, 500), imageUrl]
    );
    const r = result.rows[0];
    res.status(201).json({
      review: { id: r.id, authorName: r.author_name, rating: r.rating, comment: r.comment, imageUrl: r.image_url || '', createdAt: r.created_at },
    });

    // إشعار المالك بتقييم جديد (بالخلفية)
    notifyStoreOwner(product.store_id, {
      title: `⭐ تقييم جديد (${stars}/5) — ${product.name}`,
      body: `${name}${(comment || '').trim() ? `: ${(comment || '').trim().slice(0, 80)}` : ''}`,
      url: '/dashboard?tab=myProducts',
    });
  } catch (err) {
    next(err);
  }
}

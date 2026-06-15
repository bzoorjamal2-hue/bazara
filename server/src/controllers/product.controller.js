import { query } from '../config/db.js';
import { pingIndexNow } from '../utils/indexnow.js';

async function getUserStore(userId) {
  const r = await query('SELECT id, slug FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

export async function listMyProducts(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const result = await query(
      `SELECT * FROM products WHERE store_id = $1 ORDER BY featured DESC, created_at DESC`,
      [store.id]
    );
    res.json({ products: result.rows.map(mapProduct) });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  const p = normalizeBody(req.body);
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const result = await query(
      `INSERT INTO products
         (store_id, name, price, old_price, description, size, color, category, image_url, images, stock, featured, video_url, size_stock, sale_ends_at, color_stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [store.id, p.name, p.price, p.oldPrice, p.description, p.size, p.color, p.category, p.imageUrl, p.images, p.stock, p.featured, p.videoUrl, JSON.stringify(p.sizeStock), p.saleEndsAt, JSON.stringify(p.colorStock)]
    );

    const product = result.rows[0];
    pingIndexNow([
      `${process.env.PUBLIC_SITE_URL}/store/${store.slug}`,
      `${process.env.PUBLIC_SITE_URL}/product/${product.id}`,
    ]);
    res.status(201).json({ product: mapProduct(product) });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  const { id } = req.params;
  const p = normalizeBody(req.body);
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const owns = await query('SELECT id FROM products WHERE id = $1 AND store_id = $2', [id, store.id]);
    if (owns.rows.length === 0) {
      return res.status(404).json({ error: 'المنتج غير موجود أو لا تملك صلاحية تعديله.' });
    }

    const result = await query(
      `UPDATE products SET
         name=$1, price=$2, old_price=$3, description=$4, size=$5, color=$6,
         category=$7, image_url=$8, images=$9, stock=$10, featured=$11, video_url=$12, size_stock=$13, sale_ends_at=$14, color_stock=$15, updated_at=now()
       WHERE id=$16 AND store_id=$17
       RETURNING *`,
      [p.name, p.price, p.oldPrice, p.description, p.size, p.color, p.category, p.imageUrl, p.images, p.stock, p.featured, p.videoUrl, JSON.stringify(p.sizeStock), p.saleEndsAt, JSON.stringify(p.colorStock), id, store.id]
    );
    res.json({ product: mapProduct(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const result = await query('DELETE FROM products WHERE id = $1 AND store_id = $2 RETURNING id', [id, store.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المنتج غير موجود أو لا تملك صلاحية حذفه.' });
    }
    res.json({ message: 'تم حذف المنتج.', id });
  } catch (err) {
    next(err);
  }
}

// كمية المخزون لكل مقاس: نقبل فقط المقاسات الموجودة فعلاً ضمن size، وقيمة عددية ≥ 0
function normalizeSizeStock(raw, sizeStr) {
  if (!raw || typeof raw !== 'object') return {};
  const validSizes = new Set((sizeStr || '').split(',').map((s) => s.trim()).filter(Boolean));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim();
    if (!validSizes.has(key)) continue; // نتجاهل مقاسات غير مختارة
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) out[key] = n;
  }
  return out;
}

// مخزون لكل لون ثم نمرة: { "أسود": {"38": 3}, ... } — قيم عددية ≥ 0
function normalizeColorStock(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [color, sizes] of Object.entries(raw)) {
    const cname = String(color).trim().slice(0, 50);
    if (!cname || !sizes || typeof sizes !== 'object') continue;
    const inner = {};
    for (const [sz, qty] of Object.entries(sizes)) {
      const sname = String(sz).trim().slice(0, 20);
      const n = parseInt(qty, 10);
      if (sname && Number.isFinite(n) && n >= 0) inner[sname] = n;
    }
    if (Object.keys(inner).length) out[cname] = inner;
  }
  return out;
}

function normalizeBody(b) {
  const oldPrice = b.oldPrice === '' || b.oldPrice == null ? null : Number(b.oldPrice);
  const stock = b.stock === '' || b.stock == null ? null : parseInt(b.stock, 10);
  const colorStock = normalizeColorStock(b.colorStock);
  const usingColorStock = Object.keys(colorStock).length > 0;

  // عند استخدام المخزون لكل لون: نشتقّ الألوان والمقاسات والمخزون المجمّع لكل مقاس
  // (للحفاظ على عمل الفلاتر والبحث والمؤشّرات القديمة)
  let size = b.size || '';
  let color = b.color || '';
  let sizeStock;
  if (usingColorStock) {
    color = Object.keys(colorStock).join(',');
    const sizeSet = new Set();
    const agg = {};
    for (const sizes of Object.values(colorStock)) {
      for (const [sz, qty] of Object.entries(sizes)) {
        sizeSet.add(sz);
        agg[sz] = (agg[sz] || 0) + qty;
      }
    }
    size = [...sizeSet].join(',');
    sizeStock = agg;
  } else {
    sizeStock = normalizeSizeStock(b.sizeStock, size);
  }

  return {
    name: b.name,
    price: Number(b.price),
    oldPrice,
    description: b.description || '',
    size,
    color,
    category: b.category,
    imageUrl: b.imageUrl || '',
    images: Array.isArray(b.images) ? b.images.filter(Boolean).slice(0, 6) : [],
    stock,
    featured: Boolean(b.featured),
    videoUrl: typeof b.videoUrl === 'string' ? b.videoUrl.trim().slice(0, 2000) : '',
    sizeStock,
    colorStock,
    saleEndsAt: (() => { const d = b.saleEndsAt ? new Date(b.saleEndsAt) : null; return d && !isNaN(d) ? d : null; })(),
  };
}

export function mapProduct(p) {
  // العرض المؤقّت: إن انتهى وقته يعود السعر الأصلي تلقائياً (بلا خصم)
  let price = Number(p.price);
  let oldPrice = p.old_price != null ? Number(p.old_price) : null;
  const saleEnds = p.sale_ends_at ? new Date(p.sale_ends_at) : null;
  const saleActive = saleEnds && saleEnds > new Date();
  if (saleEnds && !saleActive && oldPrice && oldPrice > price) {
    price = oldPrice; // انتهى العرض → السعر الأصلي
    oldPrice = null;
  }
  return {
    id: p.id,
    name: p.name,
    price,
    oldPrice,
    saleEndsAt: saleActive ? p.sale_ends_at : null,
    description: p.description,
    size: p.size,
    color: p.color,
    category: p.category,
    imageUrl: p.image_url,
    images: p.images || [],
    videoUrl: p.video_url || '',
    stock: p.stock, // null = متوفّر دائماً
    sizeStock: p.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {},
    colorStock: p.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {},
    featured: p.featured,
    ratingAvg: p.rating_avg != null ? Math.round(Number(p.rating_avg) * 10) / 10 : 0,
    ratingCount: p.rating_count != null ? Number(p.rating_count) : 0,
    storeSlug: p.store_slug,
    storeName: p.store_name,
    storeWhatsapp: p.store_whatsapp || '',
    storeInstagram: p.store_instagram || '',
    storePhone: p.store_phone || '',
    storeSizeChart: p.store_size_chart && typeof p.store_size_chart === 'object' ? p.store_size_chart : {},
    storeReturnPolicy: p.store_return_policy || '',
    createdAt: p.created_at,
  };
}

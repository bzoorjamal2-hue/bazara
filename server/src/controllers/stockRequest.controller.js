import { query } from '../config/db.js';

async function getUserStore(userId) {
  const r = await query('SELECT id FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

// الزبون يطلب تنبيهاً عند توفّر منتج/نمرة نفدت (عام)
export async function createStockRequest(req, res, next) {
  const productId = String(req.body.productId || '').trim();
  const phone = String(req.body.phone || '').replace(/[^\d+]/g, '');
  const color = String(req.body.color || '').trim().slice(0, 50);
  const size = String(req.body.size || '').trim().slice(0, 20);
  if (!productId || phone.replace(/\D/g, '').length < 6) {
    return res.status(400).json({ error: 'بيانات ناقصة.' });
  }
  try {
    const p = await query('SELECT id, store_id, name FROM products WHERE id = $1', [productId]);
    const product = p.rows[0];
    if (!product) return res.status(404).json({ error: 'المنتج غير موجود.' });

    // تفادي التكرار: نفس الرقم لنفس المنتج/اللون/النمرة
    const dup = await query(
      'SELECT id FROM stock_requests WHERE product_id = $1 AND phone = $2 AND color = $3 AND size = $4',
      [productId, phone, color, size]
    );
    if (dup.rows.length) return res.json({ ok: true });

    await query(
      'INSERT INTO stock_requests (store_id, product_id, product_name, color, size, phone) VALUES ($1,$2,$3,$4,$5,$6)',
      [product.store_id, productId, product.name, color, size, phone]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// قائمة طلبات التوفّر لمتجر المشترك
// هل المتغيّر المطلوب (لون/نمرة) متوفّر الآن؟ نطابق منطق صفحة المنتج للزبون.
function variantInStock(p, color, size) {
  if (!p) return false; // المنتج محذوف
  const sizeStock = p.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
  const colorStock = p.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const hasColorStock = Object.keys(colorStock).length > 0;
  if (color && size && hasColorStock) {
    const q = colorStock?.[color]?.[size];
    if (typeof q === 'number') return q > 0;
  }
  if (size) {
    const q = sizeStock?.[size];
    if (typeof q === 'number') return q > 0;
  }
  if (p.stock === null || p.stock === undefined) return true; // مخزون عام غير محدود
  return Number(p.stock) > 0;
}

// قائمة طلبات التوفّر لمتجر المشترك — مع تمييز ما رجع للمخزون فعلاً (inStock)
export async function listMyStockRequests(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query(
      `SELECT sr.id, sr.product_id, sr.product_name, sr.color, sr.size, sr.phone, sr.created_at,
              p.stock, p.size_stock, p.color_stock
       FROM stock_requests sr
       LEFT JOIN products p ON p.id = sr.product_id
       WHERE sr.store_id = $1 ORDER BY sr.created_at DESC LIMIT 300`,
      [store.id]
    );
    const mapped = r.rows.map((x) => ({
      id: x.id,
      productId: x.product_id,
      productName: x.product_name,
      color: x.color || '',
      size: x.size || '',
      phone: x.phone,
      createdAt: x.created_at,
      inStock: variantInStock(x, x.color, x.size), // رجع متوفّراً → نبّهي الزبونة
    }));
    // المتوفّر الآن أولاً (الأهم للمالكة)، ثم الأحدث
    mapped.sort((a, b) => (b.inStock - a.inStock) || (new Date(b.createdAt) - new Date(a.createdAt)));
    res.json({ requests: mapped });
  } catch (err) {
    next(err);
  }
}

export async function deleteStockRequest(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('DELETE FROM stock_requests WHERE id = $1 AND store_id = $2 RETURNING id', [id, store.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'الطلب غير موجود.' });
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
}

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
export async function listMyStockRequests(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query(
      `SELECT id, product_id, product_name, color, size, phone, created_at
       FROM stock_requests WHERE store_id = $1 ORDER BY created_at DESC LIMIT 300`,
      [store.id]
    );
    res.json({
      requests: r.rows.map((x) => ({
        id: x.id,
        productId: x.product_id,
        productName: x.product_name,
        color: x.color || '',
        size: x.size || '',
        phone: x.phone,
        createdAt: x.created_at,
      })),
    });
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

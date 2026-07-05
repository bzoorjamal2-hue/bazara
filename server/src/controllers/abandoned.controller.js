import { query } from '../config/db.js';

// ───────── الطلبات غير المكتملة (إنقاذ السلات المتروكة) ─────────
// الزبونة تدخل بياناتها بشاشة إتمام الطلب ولا تؤكّد؟ نحفظ مسودة يراها صاحب
// المتجر ليتابعها برسالة واتساب لطيفة. تُحذف تلقائياً عند إتمام الطلب فعلياً.

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

// POST /api/public/abandoned — تُستدعى من شاشة الإتمام (بلا تسجيل دخول، بمُحدِّد معدل)
export async function saveAbandoned(req, res, next) {
  try {
    const slug = String(req.body.slug || '').trim();
    const phone = digitsOnly(req.body?.customer?.phone).slice(0, 20);
    // رقم قصير جداً = ما زالت تكتب — لا نحفظ حتى لا نملأ الجدول بمسودات ناقصة
    if (!slug || phone.length < 9) return res.json({ ok: true });

    const sr = await query('SELECT id FROM stores WHERE slug = $1', [slug]);
    const storeId = sr.rows[0]?.id;
    if (!storeId) return res.json({ ok: true });

    const name = String(req.body?.customer?.name || '').trim().slice(0, 100);
    const city = String(req.body?.customer?.city || '').trim().slice(0, 80);
    const address = String(req.body?.customer?.address || '').trim().slice(0, 400);
    const total = Math.max(0, Number(req.body.total) || 0);
    const items = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 30).map((i) => ({
      name: String(i.name || '').slice(0, 150),
      qty: Math.max(1, parseInt(i.qty, 10) || 1),
      price: Number(i.price) || 0,
      size: String(i.size || '').slice(0, 20),
      color: String(i.color || '').slice(0, 50),
    }));
    if (!items.length) return res.json({ ok: true });

    // صف واحد لكل (متجر، هاتف): آخر مسودة تحلّ محل السابقة
    await query(
      `INSERT INTO abandoned_checkouts (store_id, name, phone, city, address, items, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (store_id, phone) DO UPDATE SET
         name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address,
         items = EXCLUDED.items, total = EXCLUDED.total, updated_at = now()`,
      [storeId, name, phone, city, address, JSON.stringify(items), total]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// تُستدعى من إنشاء الطلب الفعلي: الزبون أكمل → نحذف مسودته
export async function clearAbandoned(storeId, phone) {
  const p = digitsOnly(phone);
  if (!storeId || !p) return;
  await query('DELETE FROM abandoned_checkouts WHERE store_id = $1 AND phone = $2', [storeId, p]).catch(() => {});
}

// GET /api/orders/abandoned — قائمة صاحب المتجر (نستثني الطازجة: قد تكون الزبونة
// ما زالت تُكمل الطلب الآن، ونحذف الأقدم من 14 يوماً تلقائياً)
export async function listAbandoned(req, res, next) {
  try {
    const sr = await query('SELECT id FROM stores WHERE user_id = $1', [req.user.id]);
    const storeId = sr.rows[0]?.id;
    if (!storeId) return res.json({ abandoned: [] });
    await query(`DELETE FROM abandoned_checkouts WHERE store_id = $1 AND updated_at < now() - interval '14 days'`, [storeId]);
    const r = await query(
      `SELECT id, name, phone, city, address, items, total, updated_at
       FROM abandoned_checkouts
       WHERE store_id = $1 AND updated_at < now() - interval '10 minutes'
       ORDER BY updated_at DESC LIMIT 100`,
      [storeId]
    );
    res.json({
      abandoned: r.rows.map((x) => ({
        id: x.id,
        name: x.name,
        phone: x.phone,
        city: x.city,
        address: x.address,
        items: x.items,
        total: Number(x.total),
        updatedAt: x.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/orders/abandoned/:id — صاحب المتجر تابعها/خلص منها
export async function deleteAbandoned(req, res, next) {
  try {
    const sr = await query('SELECT id FROM stores WHERE user_id = $1', [req.user.id]);
    const storeId = sr.rows[0]?.id;
    if (!storeId) return res.status(404).json({ error: 'لا يوجد متجر.' });
    await query('DELETE FROM abandoned_checkouts WHERE id = $1 AND store_id = $2', [req.params.id, storeId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

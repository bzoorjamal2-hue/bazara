import { query } from '../config/db.js';

async function getUserStore(userId) {
  const r = await query('SELECT id FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

function mapCoupon(c) {
  return {
    id: c.id,
    code: c.code,
    type: c.type, // percent | fixed
    value: Number(c.value),
    minTotal: Number(c.min_total || 0),
    maxUses: c.max_uses != null ? Number(c.max_uses) : null,
    usedCount: Number(c.used_count || 0),
    expiresAt: c.expires_at,
    active: c.active,
    createdAt: c.created_at,
  };
}

// يحسب قيمة الخصم من الكوبون على مجموع فرعي، ويعيد سبب الرفض إن وُجد
export function evaluateCoupon(coupon, subtotal) {
  if (!coupon || !coupon.active) return { ok: false, reason: 'invalid' };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { ok: false, reason: 'expired' };
  if (coupon.max_uses != null && Number(coupon.used_count) >= Number(coupon.max_uses)) return { ok: false, reason: 'maxed' };
  if (subtotal < Number(coupon.min_total || 0)) return { ok: false, reason: 'min', minTotal: Number(coupon.min_total || 0) };
  let discount = coupon.type === 'percent'
    ? (subtotal * Number(coupon.value)) / 100
    : Number(coupon.value);
  discount = Math.min(discount, subtotal); // لا يتجاوز الخصم المجموع
  discount = Math.round(discount * 100) / 100;
  return { ok: true, discount };
}

// ── إدارة الكوبونات (صاحب المتجر) ───────────────────────────────
export async function listMyCoupons(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('SELECT * FROM coupons WHERE store_id = $1 ORDER BY created_at DESC', [store.id]);
    res.json({ coupons: r.rows.map(mapCoupon) });
  } catch (err) { next(err); }
}

function normalizeCoupon(b) {
  const type = b.type === 'fixed' ? 'fixed' : 'percent';
  let value = Number(b.value) || 0;
  if (type === 'percent') value = Math.min(100, Math.max(0, value));
  else value = Math.max(0, value);
  const maxUses = b.maxUses === '' || b.maxUses == null ? null : Math.max(1, parseInt(b.maxUses, 10) || 0) || null;
  const expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
  return {
    code: String(b.code || '').trim().toUpperCase().slice(0, 40),
    type,
    value,
    minTotal: Math.max(0, Number(b.minTotal) || 0),
    maxUses,
    expiresAt: expiresAt && !isNaN(expiresAt) ? expiresAt : null,
    active: b.active === undefined ? true : Boolean(b.active),
  };
}

export async function createCoupon(req, res, next) {
  const c = normalizeCoupon(req.body);
  if (!c.code) return res.status(400).json({ error: 'كود الكوبون مطلوب.' });
  if (c.value <= 0) return res.status(400).json({ error: 'قيمة الخصم يجب أن تكون أكبر من صفر.' });
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const dup = await query('SELECT id FROM coupons WHERE store_id = $1 AND code = $2', [store.id, c.code]);
    if (dup.rows.length) return res.status(409).json({ error: 'هذا الكود مستخدم مسبقاً.' });
    const r = await query(
      `INSERT INTO coupons (store_id, code, type, value, min_total, max_uses, expires_at, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [store.id, c.code, c.type, c.value, c.minTotal, c.maxUses, c.expiresAt, c.active]
    );
    res.status(201).json({ coupon: mapCoupon(r.rows[0]) });
  } catch (err) { next(err); }
}

export async function updateCoupon(req, res, next) {
  const { id } = req.params;
  const c = normalizeCoupon(req.body);
  if (!c.code) return res.status(400).json({ error: 'كود الكوبون مطلوب.' });
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const dup = await query('SELECT id FROM coupons WHERE store_id = $1 AND code = $2 AND id <> $3', [store.id, c.code, id]);
    if (dup.rows.length) return res.status(409).json({ error: 'هذا الكود مستخدم مسبقاً.' });
    const r = await query(
      `UPDATE coupons SET code=$1, type=$2, value=$3, min_total=$4, max_uses=$5, expires_at=$6, active=$7
       WHERE id=$8 AND store_id=$9 RETURNING *`,
      [c.code, c.type, c.value, c.minTotal, c.maxUses, c.expiresAt, c.active, id, store.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'الكوبون غير موجود.' });
    res.json({ coupon: mapCoupon(r.rows[0]) });
  } catch (err) { next(err); }
}

export async function deleteCoupon(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('DELETE FROM coupons WHERE id = $1 AND store_id = $2 RETURNING id', [id, store.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'الكوبون غير موجود.' });
    res.json({ ok: true, id });
  } catch (err) { next(err); }
}

// ── تحقّق عام من الكوبون (الزبون عند السلة) ─────────────────────
export async function validateCoupon(req, res, next) {
  const slug = String(req.body.slug || '').trim();
  const code = String(req.body.code || '').trim().toUpperCase();
  const subtotal = Math.max(0, Number(req.body.subtotal) || 0);
  if (!slug || !code) return res.status(400).json({ error: 'بيانات ناقصة.' });
  try {
    const s = await query('SELECT id FROM stores WHERE slug = $1', [slug]);
    if (!s.rows.length) return res.status(404).json({ valid: false, error: 'متجر غير موجود.' });
    const r = await query('SELECT * FROM coupons WHERE store_id = $1 AND code = $2', [s.rows[0].id, code]);
    const coupon = r.rows[0];
    if (!coupon) return res.json({ valid: false, reason: 'invalid' });
    const ev = evaluateCoupon(coupon, subtotal);
    if (!ev.ok) return res.json({ valid: false, reason: ev.reason, minTotal: ev.minTotal });
    res.json({ valid: true, code: coupon.code, type: coupon.type, value: Number(coupon.value), discount: ev.discount });
  } catch (err) { next(err); }
}

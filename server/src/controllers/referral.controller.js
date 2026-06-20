import { query } from '../config/db.js';

// نظام الإحالة: كل زبونة تأخذ كوداً خاصاً (مربوطاً برقمها) تشاركه؛ الزبونة الجديدة
// التي تستخدمه تحصل على خصم (نسبة يحدّدها المتجر)، والمتجر يرى من أحال ومن.
// الزبونات بلا حسابات، فالهويّة عبر الكود + رقم الهاتف (معزول لكل متجر).

async function getUserStore(userId) {
  const r = await query('SELECT id FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا أحرف ملتبسة (O/0/I/1)
function randomCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function mapReferral(r) {
  return {
    code: r.code,
    phone: r.phone,
    name: r.name || '',
    uses: Number(r.uses || 0),
    createdAt: r.created_at,
  };
}

// ── إنشاء/جلب كود الإحالة للزبونة (عام) ─────────────────────────
// idempotent: نفس الرقم في نفس المتجر يعيد نفس الكود دائماً.
export async function createReferral(req, res, next) {
  const slug = String(req.body.store || '').trim();
  const phone = String(req.body.phone || '').replace(/[^\d+]/g, '').slice(0, 40);
  const name = String(req.body.name || '').trim().slice(0, 80);
  if (!slug) return res.status(400).json({ error: 'المتجر مطلوب.' });
  if (phone.replace(/\D/g, '').length < 6) return res.status(400).json({ error: 'أدخلي رقم هاتف صحيح.' });
  try {
    const s = await query('SELECT id, referral_percent FROM stores WHERE slug = $1', [slug]);
    const store = s.rows[0];
    if (!store) return res.status(404).json({ error: 'المتجر غير موجود.' });

    // موجود مسبقاً لنفس الرقم؟ أعيدي نفس الكود
    const existing = await query('SELECT * FROM referrals WHERE store_id = $1 AND phone = $2', [store.id, phone]);
    if (existing.rows.length) {
      const r = existing.rows[0];
      if (name && name !== r.name) await query('UPDATE referrals SET name = $1 WHERE id = $2', [name, r.id]);
      return res.json({ referral: mapReferral({ ...r, name: name || r.name }), percent: Number(store.referral_percent || 0) });
    }

    // كود فريد لهذا المتجر (محاولات قليلة كافية لمساحة الأكواد الكبيرة)
    let code = '';
    for (let i = 0; i < 6; i++) {
      const c = randomCode();
      const dup = await query('SELECT 1 FROM referrals WHERE store_id = $1 AND code = $2', [store.id, c]);
      if (!dup.rows.length) { code = c; break; }
    }
    if (!code) return res.status(500).json({ error: 'تعذّر توليد كود. حاولي مجدداً.' });

    const ins = await query(
      'INSERT INTO referrals (store_id, code, phone, name) VALUES ($1,$2,$3,$4) RETURNING *',
      [store.id, code, phone, name]
    );
    res.status(201).json({ referral: mapReferral(ins.rows[0]), percent: Number(store.referral_percent || 0) });
  } catch (err) { next(err); }
}

// ── تحقّق من كود الإحالة (عام — تستخدمه الزبونة الجديدة عند السلة) ──
export async function validateReferral(req, res, next) {
  const slug = String(req.query.store || req.body.store || '').trim();
  const code = String(req.params.code || req.body.code || '').trim().toUpperCase().slice(0, 20);
  if (!slug || !code) return res.status(400).json({ valid: false, error: 'بيانات ناقصة.' });
  try {
    const s = await query('SELECT id, referral_percent FROM stores WHERE slug = $1', [slug]);
    const store = s.rows[0];
    if (!store) return res.status(404).json({ valid: false });
    const percent = Number(store.referral_percent || 0);
    if (percent <= 0) return res.json({ valid: false, reason: 'disabled' }); // المتجر لم يفعّل الإحالة
    const r = await query('SELECT name FROM referrals WHERE store_id = $1 AND code = $2', [store.id, code]);
    if (!r.rows.length) return res.json({ valid: false, reason: 'invalid' });
    res.json({ valid: true, code, percent, referrerName: r.rows[0].name || '' });
  } catch (err) { next(err); }
}

// ── لوحة المتجر: قائمة الإحالات مرتّبة بالأكثر جلباً (مالك) ──────
export async function listMyReferrals(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('SELECT * FROM referrals WHERE store_id = $1 ORDER BY uses DESC, created_at DESC LIMIT 200', [store.id]);
    const tot = await query('SELECT COALESCE(SUM(uses),0)::int AS total FROM referrals WHERE store_id = $1', [store.id]);
    res.json({ referrals: r.rows.map(mapReferral), totalReferred: tot.rows[0].total });
  } catch (err) { next(err); }
}

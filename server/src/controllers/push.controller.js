import { query } from '../config/db.js';
import { getPublicKey, isPushConfigured } from '../config/push.js';

// المفتاح العام للاشتراك (عام) — وحالة التفعيل
export function publicKey(_req, res) {
  res.json({ key: getPublicKey(), enabled: isPushConfigured() });
}

// تسجيل اشتراك جهاز للمستخدم الحالي
export async function subscribe(req, res, next) {
  const sub = req.body.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'اشتراك غير صالح.' });
  }
  try {
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function unsubscribe(req, res, next) {
  try {
    await query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [req.user.id, req.body.endpoint || '']);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

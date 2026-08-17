import { query } from '../config/db.js';
import { getPublicKey, isPushConfigured, sendToStoreFollowers } from '../config/push.js';

// فترة تهدئة بين الحملات (تمنع الإزعاج/الإرسال المكرر بالخطأ)
const CAMPAIGN_COOLDOWN_MS = 30 * 60 * 1000; // ٣٠ دقيقة

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

// تسجيل توكن جهاز أصلي (آيفون/أندرويد من التطبيق المغلّف) للمستخدم الحالي
export async function registerNative(req, res, next) {
  const token = (req.body.token || '').trim();
  const platform = req.body.platform === 'android' ? 'android' : 'ios';
  if (!token) return res.status(400).json({ error: 'توكن غير صالح.' });
  try {
    await query(
      `INSERT INTO native_push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform`,
      [req.user.id, token, platform]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function unregisterNative(req, res, next) {
  try {
    await query('DELETE FROM native_push_tokens WHERE user_id = $1 AND token = $2', [req.user.id, req.body.token || '']);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ───────── حملات إشعارات المتجر (لصاحب المتجر) ─────────
async function ownerStore(userId) {
  const r = await query('SELECT id, slug FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

// GET /api/push/campaign — حالة الحملات: عدد المتابِعين + آخر حملة + جاهزية الإرسال
export async function campaignStatus(req, res, next) {
  try {
    const store = await ownerStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const [fc, last] = await Promise.all([
      query('SELECT COUNT(*)::int AS n FROM store_followers WHERE store_id = $1', [store.id]),
      query('SELECT title, sent_count, created_at FROM store_campaigns WHERE store_id = $1 ORDER BY created_at DESC LIMIT 1', [store.id]),
    ]);
    const lastRow = last.rows[0] || null;
    const nextAt = lastRow ? new Date(new Date(lastRow.created_at).getTime() + CAMPAIGN_COOLDOWN_MS) : null;
    res.json({
      enabled: isPushConfigured(),
      followers: fc.rows[0].n,
      last: lastRow ? { title: lastRow.title, sentCount: lastRow.sent_count, at: lastRow.created_at } : null,
      readyAt: nextAt && nextAt.getTime() > Date.now() ? nextAt : null, // وقت جاهزية الحملة التالية (تهدئة)
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/push/campaign — إرسال حملة إشعار لكل متابِعي المتجر
export async function sendCampaign(req, res, next) {
  try {
    if (!isPushConfigured()) return res.status(400).json({ error: 'الإشعارات غير مُفعّلة.' });
    const store = await ownerStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const title = String(req.body.title || '').trim().slice(0, 80);
    const body = String(req.body.body || '').trim().slice(0, 160);
    let url = String(req.body.url || '').trim().slice(0, 300);
    if (!title || !body) return res.status(400).json({ error: 'اكتب عنواناً ونصّاً للإشعار.' });
    // الرابط: مسار داخلي فقط (يبدأ بـ /) — نتفادى روابط خارجية. الافتراضي صفحة المتجر
    if (!url.startsWith('/')) url = `/store/${store.slug}`;

    // تهدئة: امنع حملة جديدة قبل مرور المدة على آخر واحدة
    const last = await query('SELECT created_at FROM store_campaigns WHERE store_id = $1 ORDER BY created_at DESC LIMIT 1', [store.id]);
    if (last.rows[0]) {
      const elapsed = Date.now() - new Date(last.rows[0].created_at).getTime();
      if (elapsed < CAMPAIGN_COOLDOWN_MS) {
        const mins = Math.ceil((CAMPAIGN_COOLDOWN_MS - elapsed) / 60000);
        return res.status(429).json({ error: `انتظر ${mins} دقيقة قبل إرسال حملة جديدة.` });
      }
    }

    const sent = await sendToStoreFollowers(store.id, { title, body, url });
    await query(
      'INSERT INTO store_campaigns (store_id, title, body, url, sent_count) VALUES ($1, $2, $3, $4, $5)',
      [store.id, title, body, url, sent]
    );
    res.json({ ok: true, sent });
  } catch (err) {
    next(err);
  }
}

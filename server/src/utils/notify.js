import { query } from '../config/db.js';
import { sendPushToUser } from '../config/push.js';
import { sendNativeToUser } from '../config/nativePush.js';

// ───────────────────────── إشعارات المالكة ─────────────────────────
//
// كانت الإشعارات تُرسَل دفعاً فقط: يقفل الهاتف أو تُمسح الإشعارة من الشريط
// فيضيع الطلب بلا أثر، ولا مكان بالتطبيق تراجع فيه ما فاتها. وشارة أيقونة
// التطبيق كانت الرقم 1 دائماً مهما تراكم.
//
// صار لكلّ إشعار صفٌّ يُحفظ أوّلاً، ثم يُحسب عدد غير المقروء ويُرسَل مع
// الدفعة: المتصفّح يضعه بالشارة من الـservice worker، وiOS يضعه بـ aps.badge.
// فالرقم على الأيقونة يساوي ما ينتظرها بالتطبيق بالضبط.

const TITLE_MAX = 200;
const BODY_MAX = 500;
const URL_MAX = 300;

// يحفظ الإشعار ويُرجع عدد غير المقروء بعده. الفشل لا يمنع الدفع.
async function record(userId, storeId, payload) {
  try {
    await query(
      `INSERT INTO notifications (user_id, store_id, type, title, body, url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        storeId || null,
        String(payload.type || 'general').slice(0, 30),
        String(payload.title || '').slice(0, TITLE_MAX),
        String(payload.body || '').slice(0, BODY_MAX),
        String(payload.url || '/dashboard').slice(0, URL_MAX),
      ]
    );
  } catch (e) {
    console.error('notify.record:', e.message);
  }
  return unreadCount(userId);
}

export async function unreadCount(userId) {
  try {
    const r = await query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );
    return r.rows[0]?.n || 0;
  } catch {
    return 0;
  }
}

// الطريق الوحيد للإشعار: يحفظ ثم يدفع بالعدد الصحيح. لا يرمي أبداً —
// فشل الإشعار يجب ألّا يُسقط الطلب أو الحفظ الذي استدعاه.
export async function notifyUser(userId, payload, storeId = null) {
  try {
    if (!userId) return 0;
    const badge = await record(userId, storeId, payload);
    const withBadge = { ...payload, badge };
    sendPushToUser(userId, withBadge);
    sendNativeToUser(userId, withBadge);
    return badge;
  } catch (e) {
    console.error('notifyUser:', e.message);
    return 0;
  }
}

// إشعار مالك متجر بالـstoreId — يجد صاحبه ثم يمرّ بالطريق نفسه
export async function notifyStoreOwner(storeId, payload) {
  try {
    if (!storeId) return 0;
    const r = await query('SELECT user_id FROM stores WHERE id = $1', [storeId]);
    const userId = r.rows[0]?.user_id;
    if (!userId) return 0;
    return notifyUser(userId, payload, storeId);
  } catch (e) {
    console.error('notifyStoreOwner:', e.message);
    return 0;
  }
}

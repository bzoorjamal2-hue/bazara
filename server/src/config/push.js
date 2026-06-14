import webpush from 'web-push';
import { query } from './db.js';

// إعداد Web Push عبر مفاتيح VAPID من البيئة (تُضبط على Render).
// إن لم تُضبط، تكون الإشعارات معطّلة بهدوء بلا أخطاء.
const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@bazara.app';

let configured = false;
if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  } catch (err) {
    console.error('⚠️ VAPID غير صالح:', err.message);
  }
}

export function isPushConfigured() {
  return configured;
}
export function getPublicKey() {
  return PUBLIC;
}

// إرسال إشعار لكل أجهزة مستخدم — يحذف الاشتراكات المنتهية تلقائياً
export async function sendPushToUser(userId, payload) {
  if (!configured || !userId) return;
  try {
    const r = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
    await Promise.all(
      r.rows.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload)
          );
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    console.error('sendPushToUser:', err.message);
  }
}

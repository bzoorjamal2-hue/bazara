import { query } from '../config/db.js';
import { sendPushToUser } from '../config/push.js';
import { sendNativeToUser } from '../config/nativePush.js';

// إشعار مالك متجر (بالـ storeId) على الويب (VAPID) والتطبيق الأصلي (APNs) معاً.
// يعمل بالخلفية ولا يرمي أخطاء — الإشعارات معطّلة بهدوء إن لم تُضبط المفاتيح.
export async function notifyStoreOwner(storeId, payload) {
  try {
    if (!storeId) return;
    const r = await query('SELECT user_id FROM stores WHERE id = $1', [storeId]);
    const userId = r.rows[0]?.user_id;
    if (!userId) return;
    sendPushToUser(userId, payload);
    sendNativeToUser(userId, payload);
  } catch (e) {
    console.error('notifyStoreOwner:', e.message);
  }
}

import { query } from '../config/db.js';
import { unreadCount } from '../utils/notify.js';
import { sendBadgeToUser } from '../config/nativePush.js';

// ─────────────────────── مركز الإشعارات ───────────────────────
// سجلّ ما وصل المالكة: الطلبات والسلات المتروكة ونفاد المخزون وتحديثات
// الشحن ورسائل إنستغرام. الدفع وحده لا يكفي — تُمسح الإشعارة من شريط
// الهاتف فيضيع الطلب، ولا مكان تراجع فيه ما فاتها وهي نائمة.

const PAGE = 30;
const MAX_PAGE = 100;

const mapRow = (r) => ({
  id: String(r.id),
  type: r.type,
  title: r.title,
  body: r.body,
  url: r.url,
  read: Boolean(r.read_at),
  createdAt: r.created_at,
});

// قائمة إشعارات المستخدم + عدد غير المقروء (وهو نفسه رقم شارة التطبيق)
export async function list(req, res, next) {
  try {
    const limit = Math.min(MAX_PAGE, Math.max(1, parseInt(req.query.limit, 10) || PAGE));
    // before: مؤشّر صفحةٍ تالية (معرّف آخر إشعارٍ ظهر) — أثبت من الإزاحة
    // حين يصل إشعارٌ جديد أثناء التصفّح فيزيح الصفوف.
    const before = /^\d+$/.test(String(req.query.before || '')) ? req.query.before : null;
    const rows = await query(
      `SELECT id, type, title, body, url, read_at, created_at
         FROM notifications
        WHERE user_id = $1 ${before ? 'AND id < $3' : ''}
        ORDER BY id DESC
        LIMIT $2`,
      before ? [req.user.id, limit, before] : [req.user.id, limit]
    );
    res.json({
      notifications: rows.rows.map(mapRow),
      unread: await unreadCount(req.user.id),
      hasMore: rows.rows.length === limit,
    });
  } catch (err) { next(err); }
}

// عدد غير المقروء وحده — نداء خفيف يستدعيه التطبيق ليضبط الشارة
export async function count(req, res, next) {
  try {
    res.json({ unread: await unreadCount(req.user.id) });
  } catch (err) { next(err); }
}

// تعليم مقروء: إشعار بعينه ({ id }) أو الكل. يُرجع العدد الجديد كي تضبط
// الواجهة الشارة من الردّ نفسه بلا نداءٍ ثانٍ.
export async function markRead(req, res, next) {
  try {
    const id = req.body?.id;
    // معرّف مُرسَل لكنه غير صالح ⇐ خطأ، لا «علّم الكل»: خللٌ صغير بالواجهة
    // كان يكفي ليطفئ كلّ النقاط الحمراء دفعةً واحدة بلا قصد المالكة.
    if (id != null && !/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: 'معرّف إشعار غير صالح.' });
    }
    if (id != null) {
      await query(
        'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL',
        [String(id), req.user.id]
      );
    } else {
      await query(
        'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL',
        [req.user.id]
      );
    }
    const unread = await unreadCount(req.user.id);
    // أيقونة الآيفون لا تعرف أنّها قُرئت إلّا بدفعةٍ صامتة — بدونها يبقى
    // الرقم القديم عالقاً لين يصل إشعارٌ جديد.
    sendBadgeToUser(req.user.id, unread);
    res.json({ ok: true, unread });
  } catch (err) { next(err); }
}

// حذف الكل — للمالكة التي تريد بداية نظيفة
export async function clearAll(req, res, next) {
  try {
    await query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    sendBadgeToUser(req.user.id, 0);
    res.json({ ok: true, unread: 0 });
  } catch (err) { next(err); }
}

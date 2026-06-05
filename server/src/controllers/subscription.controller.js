import { query } from '../config/db.js';
import { isUserActive, daysRemaining, isAdminEmail, planPeriodEnd } from '../utils/subscription.js';

const PLANS = { monthly: true, yearly: true };

// تعليمات الدفع: من قاعدة البيانات (يحرّرها المدير)، وإلا من المتغيّر، وإلا نص افتراضي.
async function getPaymentInfo() {
  const r = await query("SELECT value FROM app_settings WHERE key = 'payment_info'");
  const dbVal = r.rows[0]?.value;
  return (
    (dbVal && dbVal.trim()) ||
    process.env.ADMIN_PAYMENT_INFO ||
    'سيتم إضافة تفاصيل الدفع قريباً. تواصل مع إدارة Bazara لإتمام الاشتراك.'
  );
}

// جلب إعدادات المنصة (للمدير)
export async function getSettings(_req, res, next) {
  try {
    res.json({ paymentInfo: await getPaymentInfo() });
  } catch (err) {
    next(err);
  }
}

// تحديث تعليمات الدفع (للمدير)
export async function updateSettings(req, res, next) {
  const { paymentInfo } = req.body;
  try {
    await query(
      `INSERT INTO app_settings (key, value) VALUES ('payment_info', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [paymentInfo || '']
    );
    res.json({ message: 'تم حفظ تعليمات الدفع.', paymentInfo: paymentInfo || '' });
  } catch (err) {
    next(err);
  }
}

// حالة اشتراك المستخدم الحالي + آخر طلب + تعليمات الدفع
export async function getStatus(req, res, next) {
  try {
    const r = await query(
      'SELECT email, subscription_status, subscription_plan, current_period_end, subscriber_code FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = r.rows[0];

    const reqRes = await query(
      'SELECT plan, status, created_at FROM subscription_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    const last = reqRes.rows[0] || null;

    res.json({
      status: u.subscription_status,
      plan: u.subscription_plan,
      currentPeriodEnd: u.current_period_end,
      active: isUserActive(u),
      daysRemaining: daysRemaining(u),
      subscriberCode: u.subscriber_code,
      isAdmin: isAdminEmail(u.email),
      pending: last && last.status === 'pending',
      lastRequest: last ? { plan: last.plan, status: last.status, createdAt: last.created_at } : null,
      paymentInfo: await getPaymentInfo(),
    });
  } catch (err) {
    next(err);
  }
}

// المشترك يرسل طلب اشتراك بعد الدفع المحلي (مع رقم العملية/ملاحظة)
export async function requestSubscription(req, res, next) {
  const { plan, method, reference } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  try {
    // إن وُجد طلب معلّق نحدّثه بدل إنشاء جديد
    const existing = await query(
      "SELECT id FROM subscription_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1",
      [req.user.id]
    );
    if (existing.rows.length > 0) {
      await query(
        'UPDATE subscription_requests SET plan=$1, method=$2, reference=$3, created_at=now() WHERE id=$4',
        [plan, method || '', reference || '', existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO subscription_requests (user_id, plan, method, reference) VALUES ($1, $2, $3, $4)',
        [req.user.id, plan, method || '', reference || '']
      );
    }
    res.status(201).json({ message: 'تم استلام طلبك، سيتم تفعيل اشتراكك بعد المراجعة.' });
  } catch (err) {
    next(err);
  }
}

// ===== مسارات المدير =====

// قائمة الطلبات (الأحدث أولاً) مع بيانات المستخدم والمتجر
export async function listRequests(req, res, next) {
  try {
    const r = await query(
      `SELECT sr.id, sr.plan, sr.method, sr.reference, sr.status, sr.created_at,
              u.name AS user_name, u.email AS user_email,
              s.name AS store_name, s.slug AS store_slug
       FROM subscription_requests sr
       JOIN users u ON u.id = sr.user_id
       LEFT JOIN stores s ON s.user_id = u.id
       ORDER BY (sr.status = 'pending') DESC, sr.created_at DESC
       LIMIT 200`
    );
    res.json({
      requests: r.rows.map((x) => ({
        id: x.id,
        plan: x.plan,
        method: x.method,
        reference: x.reference,
        status: x.status,
        createdAt: x.created_at,
        userName: x.user_name,
        userEmail: x.user_email,
        storeName: x.store_name,
        storeSlug: x.store_slug,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// موافقة: تفعيل اشتراك المستخدم وتمديد المدة حسب الخطة
export async function approveRequest(req, res, next) {
  const { id } = req.params;
  try {
    const reqRow = await query('SELECT user_id, plan, status FROM subscription_requests WHERE id = $1', [id]);
    const sr = reqRow.rows[0];
    if (!sr) return res.status(404).json({ error: 'الطلب غير موجود.' });

    // نمدد من نهاية الفترة الحالية إن كانت مستقبلية (تجديد يتراكم)
    const userRow = await query('SELECT current_period_end FROM users WHERE id = $1', [sr.user_id]);
    const cur = userRow.rows[0]?.current_period_end;
    const from = cur && new Date(cur) > new Date() ? new Date(cur) : new Date();
    const end = planPeriodEnd(sr.plan, from);

    await query(
      "UPDATE users SET subscription_status='active', subscription_plan=$1, current_period_end=$2 WHERE id=$3",
      [sr.plan, end, sr.user_id]
    );
    await query("UPDATE subscription_requests SET status='approved', reviewed_at=now() WHERE id=$1", [id]);

    res.json({ message: 'تم تفعيل الاشتراك.', currentPeriodEnd: end });
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req, res, next) {
  const { id } = req.params;
  try {
    const r = await query(
      "UPDATE subscription_requests SET status='rejected', reviewed_at=now() WHERE id=$1 RETURNING id",
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود.' });
    res.json({ message: 'تم رفض الطلب.' });
  } catch (err) {
    next(err);
  }
}

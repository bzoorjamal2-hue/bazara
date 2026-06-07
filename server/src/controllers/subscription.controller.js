import { query } from '../config/db.js';
import { isUserActive, daysRemaining, isAdminEmail, planPeriodEnd } from '../utils/subscription.js';
import { sendMail, isMailConfigured } from '../utils/mail.js';

const PLANS = { monthly: true, yearly: true };
const planLabel = (p) => (p === 'yearly' ? 'سنوية' : 'شهرية');

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
      lifetime: isAdminEmail(u.email),
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

// توليد كود عشوائي بصيغة BZ-XXXX-XXXX
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `BZ-${part()}-${part()}`;
}

// المشترك يُدخل كود التفعيل بعد التحويل
export async function redeemCode(req, res, next) {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'أدخل كود التفعيل.' });
  try {
    const r = await query('SELECT * FROM activation_codes WHERE code = $1', [code]);
    const c = r.rows[0];
    if (!c || c.used) return res.status(400).json({ error: 'كود غير صالح أو مُستخدَم مسبقاً.' });

    // التمديد من نهاية الفترة الحالية إن كانت مستقبلية (تجديد يتراكم)
    const userRow = await query('SELECT current_period_end FROM users WHERE id = $1', [req.user.id]);
    const cur = userRow.rows[0]?.current_period_end;
    const from = cur && new Date(cur) > new Date() ? new Date(cur) : new Date();
    const end = planPeriodEnd(c.plan, from);

    await query(
      "UPDATE users SET subscription_status='active', subscription_plan=$1, current_period_end=$2, subscription_started_at=$3 WHERE id=$4",
      [c.plan, end, from, req.user.id]
    );
    await query('UPDATE activation_codes SET used=true, used_by=$1, used_at=now() WHERE id=$2', [req.user.id, c.id]);

    res.json({ message: 'تم تفعيل اشتراكك بنجاح!', plan: c.plan, currentPeriodEnd: end });
  } catch (err) {
    next(err);
  }
}

// ===== مسارات المدير =====

// توليد أكواد تفعيل (للمدير)
export async function generateCodes(req, res, next) {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  const count = Math.min(50, Math.max(1, parseInt(req.body.count, 10) || 1));
  try {
    const created = [];
    for (let i = 0; i < count; i++) {
      let code;
      // نضمن التفرّد
      for (let tries = 0; tries < 5; tries++) {
        code = genCode();
        const exists = await query('SELECT 1 FROM activation_codes WHERE code = $1', [code]);
        if (exists.rows.length === 0) break;
      }
      await query('INSERT INTO activation_codes (code, plan) VALUES ($1, $2)', [code, plan]);
      created.push(code);
    }
    res.json({ codes: created, plan });
  } catch (err) {
    next(err);
  }
}

// توليد كود وإرساله مباشرة لبريد المشترك (للمدير)
export async function sendCodeToSubscriber(req, res, next) {
  const { email, plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  try {
    const r = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: 'لا يوجد مشترك بهذا البريد.' });

    let code;
    for (let tries = 0; tries < 5; tries++) {
      code = genCode();
      const exists = await query('SELECT 1 FROM activation_codes WHERE code = $1', [code]);
      if (exists.rows.length === 0) break;
    }
    await query('INSERT INTO activation_codes (code, plan) VALUES ($1, $2)', [code, plan]);

    let mailed = false;
    if (isMailConfigured()) {
      try {
        await sendMail({
          to: email,
          subject: 'كود تفعيل اشتراكك — Bazara',
          html: `<div style="font-family:Tahoma,Arial;direction:rtl;text-align:right">
            <h2>كود تفعيل اشتراكك في Bazara</h2>
            <p>مرحباً ${u.name || ''}، تم تجهيز كود تفعيل اشتراكك (حزمة ${planLabel(plan)}):</p>
            <p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#b8932c">${code}</p>
            <p>سجّل دخولك ← صفحة الاشتراك ← أدخل الكود لتفعيل متجرك.</p>
          </div>`,
        });
        mailed = true;
      } catch (e) {
        console.error('sendCode mail failed:', e.message);
      }
    }
    res.json({ message: mailed ? 'تم إرسال الكود إلى بريد المشترك.' : 'تم توليد الكود (تعذّر الإرسال بالبريد، أرسله يدوياً).', code, mailed });
  } catch (err) {
    next(err);
  }
}

// قائمة المشتركين (للمدير)
export async function listSubscribers(req, res, next) {
  try {
    const r = await query(
      `SELECT u.name, u.email, u.subscription_plan, u.subscription_status,
              u.subscription_started_at, u.current_period_end, u.created_at,
              s.name AS store_name, s.slug AS store_slug
       FROM users u JOIN stores s ON s.user_id = u.id
       ORDER BY u.created_at DESC LIMIT 300`
    );
    res.json({
      subscribers: r.rows.map((x) => ({
        name: x.name,
        email: x.email,
        plan: x.subscription_plan,
        status: x.subscription_status,
        // المدير: تاريخ اشتراك = تاريخ إنشاء حسابه، واشتراكه مدى الحياة بلا انتهاء
        startedAt: x.subscription_started_at || (isAdminEmail(x.email) ? x.created_at : null),
        currentPeriodEnd: x.current_period_end,
        storeName: x.store_name,
        storeSlug: x.store_slug,
        active: isUserActive({ email: x.email, subscription_status: x.subscription_status, current_period_end: x.current_period_end }),
        isAdmin: isAdminEmail(x.email),
        lifetime: isAdminEmail(x.email),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// حذف حساب مشترك نهائياً (للمدير) — يحذف معه المتجر والمنتجات (CASCADE)
export async function deleteSubscriber(req, res, next) {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
  if (isAdminEmail(email)) return res.status(400).json({ error: 'لا يمكن حذف حساب المدير.' });
  try {
    const r = await query('DELETE FROM users WHERE lower(email) = $1 RETURNING id', [email]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });
    res.json({ message: 'تم حذف الحساب وكل بياناته.', email });
  } catch (err) {
    next(err);
  }
}

// قائمة الأكواد (للمدير)
export async function listCodes(req, res, next) {
  try {
    const r = await query(
      `SELECT c.code, c.plan, c.used, c.used_at, c.created_at, u.email AS used_email
       FROM activation_codes c LEFT JOIN users u ON u.id = c.used_by
       ORDER BY c.used ASC, c.created_at DESC LIMIT 200`
    );
    res.json({
      codes: r.rows.map((x) => ({
        code: x.code, plan: x.plan, used: x.used, usedAt: x.used_at, usedEmail: x.used_email, createdAt: x.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

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

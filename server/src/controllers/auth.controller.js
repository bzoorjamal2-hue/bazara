import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool, { query } from '../config/db.js';
import { generateUniqueStoreSlug } from '../utils/slug.js';
import { generateSubscriberCode, isUserActive, daysRemaining, isAdminEmail, planPeriodEnd } from '../utils/subscription.js';
import { sendMail, isMailConfigured } from '../utils/mail.js';

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const firstUrl = (v) => (v || '').split(',')[0].trim().replace(/\/$/, '');

const SALT_ROUNDS = 12;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 أيام
    path: '/',
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// إنشاء حساب جديد + متجر خاص بالمستخدم (لا يسجّل الدخول تلقائياً)
export async function register(req, res, next) {
  const { name, email, password, storeName, phone } = req.body;
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'البريد الإلكتروني مستخدم مسبقاً.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const slug = await generateUniqueStoreSlug(storeName);

    await client.query('BEGIN');
    const userResult = await client.query(
      'INSERT INTO users (name, email, password_hash, subscriber_code, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email',
      [name, email, passwordHash, generateSubscriberCode(), phone || '']
    );
    const user = userResult.rows[0];

    // نعبّي رقم واتساب/هاتف المتجر تلقائياً برقم التسجيل (يقدر يغيّره لاحقاً)
    await client.query('INSERT INTO stores (user_id, name, slug, phone, whatsapp) VALUES ($1, $2, $3, $4, $4)', [
      user.id,
      storeName,
      slug,
      phone || '',
    ]);
    await client.query('COMMIT');

    // دخول تلقائي بعد التسجيل ليصل المستخدم مباشرةً لصفحة الدفع/الاشتراك
    const token = signToken(user);
    res.cookie('token', token, cookieOptions());
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

export async function login(req, res, next) {
  const { email, password } = req.body;
  try {
    const result = await query(
      'SELECT id, name, email, password_hash, avatar_url, subscription_status, current_period_end FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    const invalid = () => res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });

    if (!user) return invalid();
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return invalid();

    // منع الدخول إذا كان الاشتراك منتهياً أو غير مفعّل (لغير المدير) — يجدّد بكود من الإدارة
    if (!isUserActive(user)) {
      return res.status(403).json({
        error: 'اشتراكك منتهٍ. أدخل كود التجديد الذي أرسلته لك الإدارة لتفعيل حسابك.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    const token = signToken(user);
    res.cookie('token', token, cookieOptions());
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url } });
  } catch (err) {
    next(err);
  }
}

// دخول + تجديد بكود التفعيل معاً (للمشترك المنتهي): يتحقّق من البيانات + الكود، يفعّل، ويسجّل الدخول.
export async function loginWithCode(req, res, next) {
  const { email, password } = req.body;
  const code = (req.body.code || '').trim().toUpperCase();
  try {
    const result = await query(
      'SELECT id, name, email, password_hash, avatar_url, current_period_end FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });

    // تحقّق كود التفعيل
    const r = await query('SELECT * FROM activation_codes WHERE code = $1', [code]);
    const c = r.rows[0];
    if (!c) return res.status(400).json({ error: 'كود التفعيل غير صحيح.' });
    if (c.used) return res.status(400).json({ error: 'هذا الكود مُستخدَم مسبقاً.' });

    // فعّل الاشتراك: من الآن + مدة الخطة + الوقت المتبقّي (إن وُجد)
    const from = new Date();
    const cpe = user.current_period_end ? new Date(user.current_period_end) : null;
    const remainingMs = cpe ? Math.max(0, cpe.getTime() - from.getTime()) : 0;
    const end = new Date(planPeriodEnd(c.plan, from).getTime() + remainingMs);

    await query(
      "UPDATE users SET subscription_status='active', subscription_plan=$1, current_period_end=$2, subscription_started_at=$3 WHERE id=$4",
      [c.plan, end, from, user.id]
    );
    await query('UPDATE activation_codes SET used=true, used_by=$1, used_at=now() WHERE id=$2', [user.id, c.id]);

    const token = signToken(user);
    res.cookie('token', token, cookieOptions());
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url } });
  } catch (err) {
    next(err);
  }
}

export function logout(_req, res) {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'تم تسجيل الخروج.' });
}

// بيانات المستخدم الحالي + متجره
export async function me(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url,
              u.subscription_status, u.subscription_plan, u.current_period_end, u.subscriber_code,
              EXISTS(SELECT 1 FROM subscription_requests sr WHERE sr.user_id = u.id AND sr.status = 'pending') AS has_pending,
              s.id AS store_id, s.name AS store_name, s.slug AS store_slug,
              s.description AS store_description, s.logo_url AS store_logo_url
       FROM users u
       LEFT JOIN stores s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'المستخدم غير موجود.' });

    res.json({
      user: { id: row.id, name: row.name, email: row.email, avatarUrl: row.avatar_url },
      subscription: {
        status: row.subscription_status,
        plan: row.subscription_plan,
        currentPeriodEnd: row.current_period_end,
        active: isUserActive(row),
        daysRemaining: daysRemaining(row),
        subscriberCode: row.subscriber_code,
        isAdmin: isAdminEmail(row.email),
        pending: row.has_pending,
      },
      store: row.store_id
        ? {
            id: row.store_id,
            name: row.store_name,
            slug: row.store_slug,
            description: row.store_description,
            logoUrl: row.store_logo_url,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// تحديث الملف الشخصي (الاسم + صورة الحساب)
export async function updateProfile(req, res, next) {
  const { name, avatarUrl } = req.body;
  try {
    const result = await query(
      'UPDATE users SET name = $1, avatar_url = $2 WHERE id = $3 RETURNING id, name, email, avatar_url',
      [name, avatarUrl || '', req.user.id]
    );
    const u = result.rows[0];
    res.json({ user: { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url } });
  } catch (err) {
    next(err);
  }
}

// تغيير كلمة المرور (يتطلب كلمة المرور الحالية)
export async function changePassword(req, res, next) {
  const { currentPassword, newPassword } = req.body;
  try {
    const r = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(currentPassword, r.rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح.' });
  } catch (err) {
    next(err);
  }
}

// تغيير البريد الإلكتروني (يتطلب كلمة المرور الحالية)
export async function changeEmail(req, res, next) {
  const { currentPassword, newEmail } = req.body;
  try {
    const r = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(currentPassword, r.rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'كلمة المرور غير صحيحة.' });

    const taken = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [newEmail, req.user.id]);
    if (taken.rows.length > 0) return res.status(409).json({ error: 'البريد مستخدم مسبقاً.' });

    const updated = await query(
      'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, name, email, avatar_url',
      [newEmail, req.user.id]
    );
    const u = updated.rows[0];
    res.json({ user: { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url } });
  } catch (err) {
    next(err);
  }
}

// طلب استعادة كلمة المرور (يرسل رابطاً للبريد)
export async function forgotPassword(req, res, next) {
  const { email } = req.body;
  try {
    const r = await query('SELECT id FROM users WHERE email = $1', [email]);
    // رد عام دائماً (عدم كشف وجود البريد)
    const generic = { message: 'إذا كان البريد مسجّلاً، فقد أرسلنا رابط استعادة كلمة المرور.' };

    if (r.rows.length === 0) return res.json(generic);
    if (!isMailConfigured()) {
      console.warn('forgotPassword: email not configured');
      return res.json(generic);
    }

    // كود من 6 أرقام صالح 15 دقيقة
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [
      hashToken(code),
      expires,
      r.rows[0].id,
    ]);

    // وقت الإرسال بتوقيت فلسطين (لتمييز أحدث رسالة)
    const sentAt = new Date().toLocaleString('ar', {
      timeZone: 'Asia/Hebron',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    // إرسال غير متزامن (لا نوقف الرد على المستخدم)
    // نضع الكود في العنوان ليكون كل بريد مميّزاً (لا يتجمّع في Gmail) ويظهر فوراً
    sendMail({
      to: email,
      subject: `رمز التحقق ${code} — Bazara`,
      html: `<div style="font-family:Tahoma,Arial;direction:rtl;text-align:right">
        <h2>رمز استعادة كلمة المرور</h2>
        <p>رمز التحقق الخاص بك (صالح لمدة 15 دقيقة فقط، ويُلغى أي رمز سابق):</p>
        <p style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#b8932c">${code}</p>
        <p style="color:#888;font-size:13px">تم الإرسال: ${sentAt} (بتوقيت فلسطين)</p>
        <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
      </div>`,
    }).catch((e) => console.error('sendMail failed:', e.message));

    res.json(generic);
  } catch (err) {
    next(err);
  }
}

// إعادة تعيين كلمة مرور أي مستخدم (للمدير فقط — بدون إيميل)
export async function adminResetPassword(req, res, next) {
  const { email, newPassword } = req.body;
  try {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const r = await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2 RETURNING email',
      [hash, email]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'لا يوجد مستخدم بهذا البريد.' });
    res.json({ message: 'تم تعيين كلمة مرور جديدة لهذا المستخدم.', email: r.rows[0].email });
  } catch (err) {
    next(err);
  }
}

// تعيين كلمة مرور جديدة عبر التوكن
export async function resetPassword(req, res, next) {
  const { email, token, newPassword } = req.body;
  try {
    const r = await query(
      'SELECT id, reset_token, reset_token_expires FROM users WHERE email = $1',
      [email]
    );
    const u = r.rows[0];
    const valid =
      u && u.reset_token && u.reset_token === hashToken(token) && new Date(u.reset_token_expires) > new Date();
    if (!valid) return res.status(400).json({ error: 'الرابط غير صالح أو منتهي الصلاحية.' });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, u.id]
    );
    res.json({ message: 'تم تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.' });
  } catch (err) {
    next(err);
  }
}

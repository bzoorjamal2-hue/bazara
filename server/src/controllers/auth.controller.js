import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool, { query } from '../config/db.js';
import { generateUniqueStoreSlug } from '../utils/slug.js';
import { generateSubscriberCode, isUserActive, daysRemaining, isAdminEmail } from '../utils/subscription.js';

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
  const { name, email, password, storeName } = req.body;
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
      'INSERT INTO users (name, email, password_hash, subscriber_code) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [name, email, passwordHash, generateSubscriberCode()]
    );
    const user = userResult.rows[0];

    await client.query('INSERT INTO stores (user_id, name, slug) VALUES ($1, $2, $3)', [
      user.id,
      storeName,
      slug,
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
      'SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    const invalid = () => res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });

    if (!user) return invalid();
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return invalid();

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

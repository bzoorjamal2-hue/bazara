import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import validator from 'validator';
import { NEW_STORE_DEPTS, normDepts, withPlatformLinks } from '../utils/department.js';
import pool, { query } from '../config/db.js';
import { generateUniqueStoreSlug } from '../utils/slug.js';
import { generateSubscriberCode, isUserActive, daysRemaining, isAdminEmail, planPeriodEnd } from '../utils/subscription.js';
import { sendMail, isMailConfigured } from '../utils/mail.js';
import { resetCodeEmail } from '../utils/emailTemplates.js';
import { logAdmin } from '../utils/adminLog.js';

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const firstUrl = (v) => (v || '').split(',')[0].trim().replace(/\/$/, '');

const SALT_ROUNDS = 12;

const SESSION_DAYS = 90; // بقاء تسجيل الدخول لمدة طويلة (يظل المستخدم مسجّلاً)

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    // COOKIE_DOMAIN (مثل .bazarastore.site) يجعل الكوكي مشتركاً بين الموقع
    // ودومين الـAPI الفرعي (api.bazarastore.site) — فيبقى "first-party" وتعمل
    // الجلسة على Safari/iOS التي تحجب كوكيز الطرف الثالث. بدونه: السلوك كما هو.
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    maxAge: 1000 * 60 * 60 * 24 * SESSION_DAYS,
    path: '/',
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || `${SESSION_DAYS}d`,
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
    await client.query('INSERT INTO stores (user_id, name, slug, phone, whatsapp, departments) VALUES ($1, $2, $3, $4, $4, $5::jsonb)', [
      user.id,
      storeName,
      slug,
      phone || '',
      NEW_STORE_DEPTS,
    ]);
    await client.query('COMMIT');

    // دخول تلقائي بعد التسجيل ليصل المستخدم مباشرةً لصفحة الدفع/الاشتراك
    const token = signToken(user);
    res.cookie('token', token, cookieOptions());
    // نعيد التوكن أيضاً ليُخزَّن محلياً (بقاء الجلسة داخل تطبيق iOS المثبّت)
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
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
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url } });
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
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url } });
  } catch (err) {
    next(err);
  }
}

// ===== الدخول بجوجل وفيسبوك =====
// المعرّفان عامّان بطبعهما (يظهران بكود الصفحة)، والتحقّق لا يحتاج سرّاً: نسأل
// المزوّد نفسه عن التوكن ونتأكّد أنّه صادرٌ لتطبيقنا نحن لا لتطبيقٍ آخر.
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || '413501449549-6dsq0efb225kvkt8i1huq0qub61e5jk8.apps.googleusercontent.com';
// تطبيق ميتا المخصّص للدخول، منفصلٌ عمداً عن تطبيق إنستغرام (نوعه Business
// ولا يقبل الدخول العاديّ إلّا مقروناً بصلاحيات صفحات).
const FB_LOGIN_APP_ID = process.env.FB_LOGIN_APP_ID || '1070136699145310';
const GRAPH = 'https://graph.facebook.com/v23.0';

// التسجيل العاديّ يمرّر البريد بـnormalizeEmail (جيميل بلا نقاط)، فنطابقه
// بنفس القاعدة وإلّا صار لصاحب الحساب حسابان.
const normEmail = (e) => validator.normalizeEmail(e) || e.toLowerCase();

async function verifyGoogleCredential(credential) {
  if (!credential || typeof credential !== 'string') return null;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) return null;
  const p = await r.json();
  if (p.aud !== GOOGLE_CLIENT_ID) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) return null;
  if (p.email_verified !== 'true' && p.email_verified !== true) return null;
  return { id: String(p.sub), email: normEmail(p.email), name: (p.name || '').slice(0, 100) };
}

// ‏/app بتوكن المستخدم يعيد التطبيقَ الذي صدر له التوكن: هكذا نرفض توكناً
// أُخذ من تطبيقٍ آخر وجيء به إلينا. وفيسبوك لا تعيد إلّا بريداً مؤكَّداً.
async function verifyFacebookToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;
  const t = encodeURIComponent(accessToken);
  const a = await fetch(`${GRAPH}/app?access_token=${t}`);
  if (!a.ok) return null;
  if (String((await a.json()).id) !== FB_LOGIN_APP_ID) return null;
  const m = await fetch(`${GRAPH}/me?fields=id,name,email&access_token=${t}`);
  if (!m.ok) return null;
  const p = await m.json();
  if (!p.id) return null;
  return { id: String(p.id), email: p.email ? normEmail(p.email) : '', name: (p.name || '').slice(0, 100) };
}

// عمود المعرّف لكلّ مزوّد — قائمةٌ مغلقة، فلا يدخل اسمُ عمودٍ من الطلب إلى SQL
const PROVIDERS = {
  google: { column: 'google_id', label: 'جوجل' },
  facebook: { column: 'facebook_id', label: 'فيسبوك' },
};

// توكنٌ قصير يحمل الهويّة بين الخطوتين (الزرّ ← اسم المتجر والجوال)، كي لا
// نثق بما يرسله المتصفّح بالخطوة الثانية.
// ‏pid لا sub: حارسُ الجلسات يقرأ sub معرّفاً للمستخدم، فلا يُقبَل هذا التوكن جلسةً.
const signSocialSignup = (provider, g) =>
  jwt.sign({ typ: 'social_signup', provider, pid: g.id, email: g.email, name: g.name }, process.env.JWT_SECRET, {
    expiresIn: '30m',
  });

async function socialLogin(provider, g, res) {
  const { column } = PROVIDERS[provider];
  const r = await query(
    `SELECT id, name, email, ${column} AS pid, avatar_url, subscription_status, current_period_end FROM users WHERE ${column} = $1 OR email = $2 ORDER BY (${column} = $1) DESC NULLS LAST LIMIT 1`,
    [g.id, g.email]
  );
  const user = r.rows[0];

  // حسابٌ جديد: ينقصه اسم المتجر والجوال قبل الإنشاء
  if (!user) {
    return res.json({ needsSignup: true, provider, signupToken: signSocialSignup(provider, g), name: g.name, email: g.email });
  }

  // حسابٌ قائمٌ بالبريد نفسه: المزوّد أكّد ملكيّة البريد، فنربطه
  if (!user.pid) await query(`UPDATE users SET ${column} = $1 WHERE id = $2`, [g.id, user.id]);

  if (!isUserActive(user)) {
    return res.status(403).json({
      error: 'اشتراكك منتهٍ. سجّل الدخول بالبريد وكلمة المرور وأدخل كود التجديد الذي أرسلته لك الإدارة.',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }

  const token = signToken(user);
  res.cookie('token', token, cookieOptions());
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url } });
}

export async function googleAuth(req, res, next) {
  try {
    const g = await verifyGoogleCredential(req.body.credential);
    if (!g) return res.status(401).json({ error: 'تعذّر التحقّق من حساب جوجل. حاول مرّة أخرى.' });
    await socialLogin('google', g, res);
  } catch (err) {
    next(err);
  }
}

export async function facebookAuth(req, res, next) {
  try {
    const g = await verifyFacebookToken(req.body.accessToken);
    if (!g) return res.status(401).json({ error: 'تعذّر التحقّق من حساب فيسبوك. حاول مرّة أخرى.' });
    // حسابات فيسبوك المسجّلة بالجوال لا بريد لها، والبريد عندنا هو الحساب
    if (!g.email) {
      return res.status(400).json({
        error: 'حساب فيسبوك هذا بلا بريد إلكتروني (أو لم تسمح بمشاركته). سجّل بجوجل أو بالبريد الإلكتروني.',
      });
    }
    await socialLogin('facebook', g, res);
  } catch (err) {
    next(err);
  }
}

export async function socialRegister(req, res, next) {
  const { storeName, phone } = req.body;
  let g;
  try {
    g = jwt.verify(req.body.signupToken || '', process.env.JWT_SECRET);
    if (g.typ !== 'social_signup' || !PROVIDERS[g.provider]) throw new Error('bad type');
  } catch {
    return res.status(401).json({ error: 'انتهت مهلة التسجيل. اضغط الزرّ من جديد.' });
  }
  const { column, label } = PROVIDERS[g.provider];

  const name = (req.body.name || g.name || '').trim().slice(0, 100) || g.email.split('@')[0];
  const client = await pool.connect();
  try {
    const existing = await client.query(`SELECT id FROM users WHERE email = $1 OR ${column} = $2`, [g.email, g.pid]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `هذا الحساب مسجّل مسبقاً. سجّل الدخول بزرّ ${label}.` });
    }

    // لا كلمة مرور لصاحب هذا الحساب: نخزّن بصمةً لسرٍّ عشوائيٍّ لا يعرفه أحد،
    // ومتى أرادها عيّنها من «نسيت كلمة المرور».
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    const slug = await generateUniqueStoreSlug(storeName);

    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, subscriber_code, phone, ${column}) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email`,
      [name, g.email, passwordHash, generateSubscriberCode(), phone || '', g.pid]
    );
    const user = userResult.rows[0];
    await client.query('INSERT INTO stores (user_id, name, slug, phone, whatsapp, departments) VALUES ($1, $2, $3, $4, $4, $5::jsonb)', [
      user.id,
      storeName,
      slug,
      phone || '',
      NEW_STORE_DEPTS,
    ]);
    await client.query('COMMIT');

    const token = signToken(user);
    res.cookie('token', token, cookieOptions());
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

export function logout(_req, res) {
  // المسح يطابق الإنشاء بكلّ خاصّية لا بالمسار والنطاق وحدهما: المتصفّح يعتبر
  // كوكيّاً بـsameSite/secure مختلفين كوكيّاً آخر فلا يمسحه — فيبقى المستخدم
  // داخلاً بعد «تسجيل الخروج»، وأوّل نداءٍ لـ/auth/me يعيده إلى حسابه.
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie('token', opts);
  // وكتابته فارغاً منتهيَ الصلاحية: حزامٌ ثانٍ حين يرفض المتصفّح Set-Cookie
  // الحذفَ لاختلافٍ دقيق بالخصائص.
  res.cookie('token', '', { ...opts, maxAge: 0, expires: new Date(0) });
  res.json({ message: 'تم تسجيل الخروج.' });
}

// بيانات المستخدم الحالي + متجره
export async function me(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url,
              u.subscription_status, u.subscription_plan, u.current_period_end, u.subscriber_code,
              u.suspended_at, u.suspended_reason,
              EXISTS(SELECT 1 FROM subscription_requests sr WHERE sr.user_id = u.id AND sr.status = 'pending') AS has_pending,
              s.id AS store_id, s.name AS store_name, s.slug AS store_slug,
              s.description AS store_description, s.logo_url AS store_logo_url,
              s.custom_categories AS store_custom_categories,
              s.departments AS store_departments,
              s.banners AS store_banners, s.panel_image AS store_panel_image,
              s.ig_connected AS store_ig_connected
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
        // سبب الإيقاف يُعرض لصاحبته: قرارٌ يُقفل متجرها ولا تعرف لماذا يجعلها
        // تظنّ أنّ عطلاً وقع، فتراسل الدعم بدل أن تعالج السبب.
        suspended: Boolean(row.suspended_at),
        suspendedReason: row.suspended_reason || '',
      },
      store: row.store_id
        ? {
            id: row.store_id,
            name: row.store_name,
            slug: row.store_slug,
            description: row.store_description,
            logoUrl: row.store_logo_url,
            // رأسُ اللوحةِ ودرجُها يرسمانِ صورةَ المتجر: بلا هذين الحقلَينِ
            // كان الرأسُ يبحثُ عن بانرٍ لا يصلُه أبداً فيبقى لوحاً داكناً عامّاً.
            panelImage: row.store_panel_image || '',
            banners: Array.isArray(row.store_banners) ? row.store_banners : [],
            customCategories: withPlatformLinks(row.store_custom_categories),
            departments: normDepts(row.store_departments),
            // زرُّ الرسائلِ بالشريطِ السفليِّ يظهرُ لمن ربطت إنستغرام وحدَها، لا
            // لكلِّ تاجرةٍ بيومِ إطلاقٍ نتذكّرُ تبديلَه. والحقلُ يركبُ الحمولةَ
            // التي تُحمَّلُ مرّةً عند الدخول — لا طلبَ جديدٌ بكلِّ فتحةِ صفحة.
            igConnected: Boolean(row.store_ig_connected),
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
      ...resetCodeEmail(code, sentAt),
    }).catch((e) => console.error('sendMail failed:', e.message));

    res.json(generic);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/admin/send-reset ────────────────────────────────────────
// يرسل رمز الاستعادة إلى بريد المشترِكة نفسها. الطريق الآمن: لا أحد يرى كلمة
// السرّ — لا المدير ولا قناة الإرسال. البديل أدناه (تعيينها يدوياً) يُبقي
// كلمة سرٍّ صريحة تمرّ في واتساب أو بريد، ويجعل المدير عارفاً بسرّ غيره.
export async function adminSendReset(req, res, next) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  try {
    if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
    const r = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });
    if (!isMailConfigured()) return res.status(503).json({ error: 'البريد غير مُهيّأ على الخادم.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [
      hashToken(code), expires, r.rows[0].id,
    ]);

    const sentAt = new Date().toLocaleString('ar', { timeZone: 'Asia/Hebron', dateStyle: 'short', timeStyle: 'short' });
    sendMail({
      to: email,
      ...resetCodeEmail(code, sentAt),
    }).catch((e) => console.error('sendMail failed:', e.message));

    await logAdmin(req, 'user.sendReset', { type: 'user', id: email, label: email });
    res.json({ ok: true, email });
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
    // أخطر فعل إداريّ: يمنح المدير دخولاً لحساب غيره. كان بلا أثر إطلاقاً.
    // لا نسجّل كلمة السرّ نفسها — السجلّ يثبت الفعل لا يُفشي السرّ.
    await logAdmin(req, 'user.resetPassword', { type: 'user', id: r.rows[0].email, label: r.rows[0].email });
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

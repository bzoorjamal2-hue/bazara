import crypto from 'crypto';

// حماية CSRF بأسلوب Double-Submit Cookie:
// الخادم يضع توكناً في كوكي، ويعيد نفس القيمة في جسم رد /api/csrf.
// الواجهة تخزّن القيمة وتعيدها في ترويسة X-CSRF-Token مع كل طلب يعدّل البيانات.
// الخادم يقارن قيمة الترويسة بقيمة الكوكي (يقرأها من جهته) — يعمل حتى عبر دومينين مختلفين.

const COOKIE_NAME = 'csrfToken';

export function issueCsrfToken(req, res, next) {
  let token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/',
    });
  }
  // نتيحه لمسار /api/csrf لإرجاعه للواجهة
  req.csrfToken = token;
  next();
}

export function verifyCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get('X-CSRF-Token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'طلب غير مصرّح به (CSRF).' });
  }
  next();
}

// مسار يعيد توكن CSRF الحالي للواجهة
export function getCsrfToken(req, res) {
  res.json({ csrfToken: req.csrfToken });
}

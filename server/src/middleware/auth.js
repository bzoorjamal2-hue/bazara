import jwt from 'jsonwebtoken';

// التوكن من كوكي httpOnly أو من ترويسة Authorization: Bearer.
// الـ Bearer ضروري لأن كوكيز iOS داخل التطبيق المثبّت لا تبقى بين الجلسات،
// وهو آمن ضد CSRF لأن المواقع الأخرى لا تستطيع ضبط ترويسة مخصّصة عبر النطاقات.
function getToken(req) {
  if (req.cookies?.token) return req.cookies.token;
  const h = req.headers?.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

/**
 * يتحقق من توكن JWT (كوكي httpOnly أو Bearer).
 * يضع بيانات المستخدم في req.user.
 */
export function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'الجلسة منتهية أو غير صالحة.' });
  }
}

/**
 * يتطلب أن يكون المستخدم مديراً (بريده ضمن ADMIN_EMAIL).
 */
export function requireAdmin(req, res, next) {
  const admins = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!req.user || !admins.includes((req.user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'صلاحيات غير كافية.' });
  }
  next();
}

/**
 * مصادقة اختيارية: إن وُجد توكن صالح يضع req.user، وإلا يكمل بدونه.
 */
export function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      /* تجاهل التوكن غير الصالح */
    }
  }
  next();
}

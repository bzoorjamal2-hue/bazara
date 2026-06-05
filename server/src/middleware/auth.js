import jwt from 'jsonwebtoken';

/**
 * يتحقق من توكن JWT المخزّن في httpOnly cookie.
 * يضع بيانات المستخدم في req.user.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
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
  const token = req.cookies?.token;
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

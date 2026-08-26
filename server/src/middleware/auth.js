import jwt from 'jsonwebtoken';

// التوكن من كوكي httpOnly أو من ترويسة Authorization: Bearer.
// الـ Bearer ضروري لأن كوكيز iOS داخل التطبيق المثبّت لا تبقى بين الجلسات،
// وهو آمن ضد CSRF لأن المواقع الأخرى لا تستطيع ضبط ترويسة مخصّصة عبر النطاقات.
// الترويسة تسبق الكوكي: الترويسة لا تُرسَل إلا إذا وضعها تطبيقنا عمداً، أما
// الكوكي فيُرسَل مع كل طلبٍ تلقائياً. لو غلب الكوكي لتعذّر تبديل الجلسة من
// داخل المتصفّح — وهو ما تحتاجه جلسة «التصفّح كصاحبة المتجر»: كوكي المديرة
// موجودٌ فيبتلع توكن الجلسة الجديد وتبقى ترى حسابها هي.
function getToken(req) {
  const h = req.headers?.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies?.token) return req.cookies.token;
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
    // جلسة تصفّحٍ نيابةً عن صاحبة متجر (يفتحها المدير للدعم): نحملها معنا كي
    // تُسجَّل باسم من فتحها، وتُمنع منها صلاحيات الإدارة.
    if (payload.imp) req.impersonation = payload.imp;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'الجلسة منتهية أو غير صالحة.' });
  }
}

/**
 * يتطلب أن يكون المستخدم مديراً (بريده ضمن ADMIN_EMAIL).
 */
export function requireAdmin(req, res, next) {
  // جلسة التصفّح النيابيّ لا تمنح صلاحية إدارة أبداً، ولو كان صاحبها مديراً:
  // هي جلسةُ «أرى ما تراه هي»، فلو مرّرت أدوات الإدارة لصار المدير يديرها
  // من داخل حسابها بلا أن يُعرف أيّ حسابٍ نفّذ. الحاجز هنا احتياطٌ ثانٍ —
  // البريد بالتوكن بريدُها هي أصلاً — كي لا يسقط الأمان بتغييرٍ لاحق.
  if (req.impersonation) {
    return res.status(403).json({ error: 'أدوات الإدارة غير متاحة أثناء التصفّح كصاحبة المتجر. اخرج من الجلسة أولاً.' });
  }
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

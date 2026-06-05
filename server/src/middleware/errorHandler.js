// معالج أخطاء مركزي: يخفي التفاصيل الحساسة عن المستخدم ويسجّلها داخلياً فقط.
export function notFound(req, res) {
  res.status(404).json({ error: 'المسار غير موجود.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // نسجّل الخطأ الكامل في السجلات الداخلية فقط
  console.error('[ERROR]', err);

  // نعيد رسالة عامة آمنة للمستخدم
  const status = err.status || 500;
  const message =
    status === 500 ? 'حدث خطأ في الخادم. حاول لاحقاً.' : err.message || 'حدث خطأ.';

  res.status(status).json({ error: message });
}

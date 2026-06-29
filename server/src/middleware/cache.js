// كاش بسيط في ذاكرة الخادم للصفحات العامة (قراءة فقط).
// يلغي استعلام قاعدة البيانات المتكرّر: أول طلب يملأ الكاش، والطلبات التالية
// ضمن مدة الصلاحية تُخدَم فوراً من الذاكرة (أجزاء من الثانية بدل مئات الميلي ثانية).
// مدة قصيرة (افتراضياً 30 ثانية) فيبقى المحتوى محدّثاً عملياً.
const store = new Map(); // key (المسار) -> { body, expires }

export function cacheGet(ttlSeconds = 30) {
  const ttl = ttlSeconds * 1000;
  return (req, res, next) => {
    const key = req.originalUrl;
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expires > now) {
      res.set('X-Cache', 'HIT');
      return res.json(hit.body);
    }
    // نلتقط أول استجابة JSON ناجحة (200) ونخزّنها لبقية الطلبات
    const orig = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) store.set(key, { body, expires: now + ttl });
      res.set('X-Cache', 'MISS');
      return orig(body);
    };
    next();
  };
}

// تفريغ كامل للكاش — يُستدعى عند أي تعديل بيانات (منتج/متجر/ستوري...) كي لا يبقى قديماً
export function clearPublicCache() {
  store.clear();
}

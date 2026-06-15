// مخزّن مؤقّت بسيط لاستجابات الصفحات (منتج/متجر) — يجعل الرجوع فورياً بلا إعادة تحميل،
// ويثبّت استعادة موضع التمرير لأن المحتوى يجهز لحظياً. نُحدّث في الخلفية (stale-while-revalidate).
const mem = new Map();
const TTL = 5 * 60 * 1000; // 5 دقائق

export function getCache(key) {
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() - e.t > TTL) { mem.delete(key); return null; }
  return e.v;
}

export function setCache(key, value) {
  mem.set(key, { v: value, t: Date.now() });
}

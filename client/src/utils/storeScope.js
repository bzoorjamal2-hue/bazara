// المتجر الذي يتصفّحه الزائر حالياً — لتذكيره في الصفحات التي لا يحمل رابطها سلاِگ
// المتجر (صفحة المنتج تحديداً). يضبطه ProductDetails، ويقرؤه الشريط السفلي كي يبقى
// التنقّل داخل المتجر (رئيسية/تصنيفات/عروض/ريلز/تتبّع) بلا خروج للموقع العام.
let current = '';
const subs = new Set();

export const getStoreScope = () => current;

export const setStoreScope = (slug) => {
  const v = slug || '';
  if (v === current) return;
  current = v;
  subs.forEach((fn) => fn());
};

export const subscribeStoreScope = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

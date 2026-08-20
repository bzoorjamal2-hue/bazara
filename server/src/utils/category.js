// الفئات القديمة → الحالية.
//
// عمود products.category بدأ نوعاً مُعدّداً (men/women/kids/accessories)، ثم
// تحوّل إلى نصّ حرّ بفئات أزياء (abaya/set/dress/…). التحويل وإعادة تعيين
// القيم كانا في schema.sql وحدها — وهي لا تُنفَّذ عند الإقلاع بل يدوياً، فبقيت
// منتجات بقيمٍ قديمة على الخادم بينما تقارن الواجهة بالقيم الجديدة مقارنةً
// نصّية صارمة (p.category === cat)، فلا يظهر شيء تحت زرّ الفئة.
//
// التطبيع هنا شبكة أمان تعمل فوراً على البيانات القديمة، والترقية في index.js
// تُصلح المخزَّن نفسه فتصبح هذه الخريطة بلا عمل.
export const LEGACY_CATEGORIES = {
  women: 'dress',
  men: 'set',
  kids: 'abaya',
  accessories: 'hijab',
};

export function normalizeCategory(value) {
  const v = String(value ?? '').trim();
  if (!v) return v;
  return LEGACY_CATEGORIES[v] || v;
}

// كل القيم التي قد تكون مخزَّنة لهذه الفئة: الحالية ومرادفها القديم. تصفية
// الفئة تجري في SQL لا في JS، فلا يكفي التطبيع عند القراءة — لا بدّ أن يلتقط
// الاستعلام نفسه المنتجات التي ما زالت بقيمتها القديمة.
export function categoryAliases(value) {
  const v = String(value ?? '').trim();
  if (!v) return [];
  const legacy = Object.entries(LEGACY_CATEGORIES).filter(([, nw]) => nw === v).map(([old]) => old);
  return [v, ...legacy];
}

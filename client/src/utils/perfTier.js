// مستوى أداء الجهاز — نُقرّره مرّة واحدة عند الإقلاع ونضع صنفاً على <html>،
// فتتأقلم كل حركات الموقع تلقائياً: الأجهزة القوية تأخذ التأثيرات الكاملة
// (ضبابية سينمائية، زجاج شفّاف)، والضعيفة تأخذ نفس الحركة بلا العمليات المكلفة
// على وحدة الرسم — فتبقى الملاحة ناعمة بلا تقطيع على الجميع.
//
// المعايير (كلها اختيارية عبر المتصفّحات — نتعامل مع غيابها بأمان):
//   deviceMemory        — ذاكرة الجهاز بالغيغابايت (Chrome/Android)
//   hardwareConcurrency — عدد أنوية المعالج
//   saveData            — وضع توفير البيانات (إشارة صريحة من المستخدم لتخفيف كل شيء)
export function applyPerfTier() {
  if (typeof document === 'undefined') return 'full';

  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const mem = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;
  const conn = nav.connection || {};
  const saveData = Boolean(conn.saveData);
  const slowNet = /(^|-)2g$/.test(String(conn.effectiveType || ''));

  // جهاز ضعيف: ذاكرة ≤ 4غ، أو أنوية ≤ 4، أو توفير بيانات/شبكة بطيئة جداً.
  // نتعمّد التساهل: عند غياب المؤشّرات (سفاري/آيفون لا يكشفانها) نبقى على الوضع
  // الكامل — أجهزة آبل قوية عادةً، ولا نعاقب المستخدم بسبب نقص معلومة.
  const weak =
    (mem != null && mem <= 4) ||
    (cores != null && cores <= 4) ||
    saveData ||
    slowNet;

  const tier = weak ? 'lite' : 'full';
  document.documentElement.classList.toggle('bz-lite', weak);
  return tier;
}

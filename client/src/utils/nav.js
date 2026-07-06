// رجوع موحّد لكل أزرار "الرجوع" بالموقع: يرجع للصفحة السابقة الفعلية بالتاريخ
// (فيحافظ على موضع التمرير عبر استرجاع App.jsx)، وإن فُتحت الصفحة مباشرة
// (رابط خارجي/تحديث — لا تاريخ داخل التطبيق) يذهب للمسار الاحتياطي بدلاً من لا شيء.
// react-router يخزّن فهرس الدخول في history.state.idx — صفر يعني أول صفحة بالجلسة.
export function goBack(navigate, fallback = '/') {
  const idx = window.history.state?.idx ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}

// ───── رجوع ذكي لأيقونات التنقّل (فتات الخبز وما شابه) ─────
// نسجّل مسار كل صفحة تُزار (يستدعيه App مع كل تنقّل). عند الضغط على أيقونة
// وجهتها هي نفس الصفحة السابقة بالتاريخ، نرجع فعلياً (navigate(-1)) بدل فتح
// صفحة جديدة — فيستعيد المستخدم نفس موضع التمرير الذي كان عليه.
const navStack = [];
export function recordNav(key, path) {
  const i = navStack.findIndex((e) => e.key === key);
  if (i >= 0) navStack.length = i + 1; // رجوع/تقدّم لموضع موجود → قصّ ما بعده
  else navStack.push({ key, path });
  if (navStack.length > 80) navStack.shift();
}
export function smartNav(navigate, to) {
  const prev = navStack[navStack.length - 2];
  if (prev && prev.path === to) navigate(-1); // نفس الصفحة السابقة → رجوع حقيقي
  else navigate(to);
}

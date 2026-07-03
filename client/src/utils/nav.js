// رجوع موحّد لكل أزرار "الرجوع" بالموقع: يرجع للصفحة السابقة الفعلية بالتاريخ
// (فيحافظ على موضع التمرير عبر استرجاع App.jsx)، وإن فُتحت الصفحة مباشرة
// (رابط خارجي/تحديث — لا تاريخ داخل التطبيق) يذهب للمسار الاحتياطي بدلاً من لا شيء.
// react-router يخزّن فهرس الدخول في history.state.idx — صفر يعني أول صفحة بالجلسة.
export function goBack(navigate, fallback = '/') {
  const idx = window.history.state?.idx ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}

// هل التطبيق يعمل كتطبيق مثبّت (standalone) بدل متصفّح؟
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    // معاينة واجهة التطبيق داخل المتصفّح: أضِف ?app=1 للرابط
    new URLSearchParams(window.location.search).get('app') === '1'
  );
}

// هل يوجد توكن جلسة محفوظ؟ (يعني المستخدم سجّل دخوله سابقاً على هذا الجهاز)
export function hasStoredToken() {
  try { return !!localStorage.getItem('bz_auth_token'); } catch { return false; }
}

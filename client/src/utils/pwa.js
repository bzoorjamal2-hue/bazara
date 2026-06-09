// هل التطبيق يعمل كتطبيق مثبّت (standalone) بدل متصفّح؟
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

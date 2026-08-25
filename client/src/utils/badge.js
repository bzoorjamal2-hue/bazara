// شارة أيقونة التطبيق (الرقم الأحمر على الأيقونة بالشاشة الرئيسية).
//
// ثلاثة مسارات، لأنّ لكلّ منها لحظته:
//  • الصفحة مفتوحة → navigator.setAppBadge مباشرةً.
//  • التطبيق مغلق والإشعار واصل → الـservice worker يضبطها من الحمولة.
//  • آيفون أصلي → الخادم يضبطها بـ aps.badge ويصفّرها بدفعةٍ صامتة.
//
// كلّها تعمل بلا تنسيقٍ بينها: كلّ مسارٍ يكتب الرقم نفسه (عدد غير المقروء).

export function setAppBadge(unread) {
  const n = Number(unread);
  if (!Number.isFinite(n) || n < 0) return;
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch { /* المتصفّح لا يدعمها — لا شيء نفعله */ }
  // الـSW يملك تسجيله الخاص؛ نبلّغه كي تبقى الشارة صحيحة بعد إغلاق التبويب
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'bz-set-badge', unread: n });
  } catch { /* تجاهل */ }
}

export function badgeSupported() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

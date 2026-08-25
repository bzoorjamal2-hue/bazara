/* معالج إشعارات الدفع — يُحقن داخل Service Worker الرئيسي عبر importScripts */

// شارة أيقونة التطبيق: العدد يصل بالحمولة من الخادم (عدد غير المقروء).
// نضبطها هنا لأنّ هذا الكود يعمل والتطبيق مغلق — لو انتظرنا فتحه لبقيت
// الأيقونة نظيفة بينما إشعاراتٌ تنتظر بالداخل.
function applyBadge(n) {
  if (typeof n !== 'number' || n < 0) return;
  if (n > 0 && self.registration.setAppBadge) return self.registration.setAppBadge(n);
  if (n === 0 && self.registration.clearAppBadge) return self.registration.clearAppBadge();
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Bazara';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [60, 30, 60],
    // tag حسب النوع: إشعارات الطلبات المتتالية تستبدل بعضها بشريط الهاتف
    // بدل أن تتكدّس عشرين سطراً — renotify يُبقي التنبيه محسوساً مع ذلك.
    tag: data.type ? `bz-${data.type}` : undefined,
    renotify: Boolean(data.type),
    data: { url: data.url || '/dashboard?tab=myOrders' },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      applyBadge(data.badge),
      // إعلام أي نافذةٍ مفتوحة كي تحدّث الجرس فوراً بلا انتظار نداء دوريّ
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        list.forEach((c) => c.postMessage({ type: 'bz-notification', unread: data.badge }));
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// تصفير الشارة بطلبٍ من التطبيق (بعد قراءة الإشعارات)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'bz-set-badge') applyBadge(event.data.unread);
});

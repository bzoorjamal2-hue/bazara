// بكسلات التمويل لكل متجر: صاحب المتجر يضع معرّفاته (فيسبوك/تيكتوك/جوجل) بإعدادات
// متجره، فنحقن السكربتات الرسمية بصفحات متجره ونطلق أحداث التجارة (مشاهدة منتج،
// إضافة للسلة، بدء إتمام، شراء) — فيقدر يموّل منتجاته ويقيس نتائج إعلاناته بدقة.

const loaded = { fb: new Set(), tt: new Set(), ga: new Set() };

function initFb(id) {
  if (!id || loaded.fb.has(id)) return;
  loaded.fb.add(id);
  if (!window.fbq) {
    const n = (window.fbq = function () {
      if (n.callMethod) n.callMethod.apply(n, arguments);
      else n.queue.push(arguments);
    });
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  window.fbq('init', id);
  window.fbq('track', 'PageView');
}

function initTiktok(id) {
  if (!id || loaded.tt.has(id)) return;
  loaded.tt.add(id);
  if (!window.ttq) {
    window.TiktokAnalyticsObject = 'ttq';
    const ttq = (window.ttq = window.ttq || []);
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat([].slice.call(arguments, 0))); }; };
    for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
    ttq.load = function (e) {
      const u = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = u;
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[e] = {};
      const s = document.createElement('script');
      s.async = true;
      s.src = `${u}?sdkid=${e}&lib=ttq`;
      document.head.appendChild(s);
    };
  }
  window.ttq.load(id);
  window.ttq.page();
}

function initGa(id) {
  if (!id || loaded.ga.has(id)) return;
  loaded.ga.add(id);
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
  }
  window.gtag('config', id);
}

// تُستدعى عند تحميل صفحة متجر/منتج — تقبل شكلَي البيانات (store أو product)
export function initPixels(src = {}) {
  try {
    initFb(src.fbPixel || src.storeFbPixel);
    initTiktok(src.tiktokPixel || src.storeTiktokPixel);
    initGa(src.gaId || src.storeGaId);
  } catch { /* البكسل تجميلي — لا يكسر الصفحة أبداً */ }
}

// أسماء أحداث كل منصة مقابل الاسم الموحّد (أسماء فيسبوك القياسية)
const TT_EVENTS = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', Purchase: 'CompletePayment' };
const GA_EVENTS = { ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', Purchase: 'purchase' };

// إطلاق حدث تجاري موحّد: name أحد ViewContent/AddToCart/InitiateCheckout/Purchase
// data: { value, content_name, content_ids } — العملة شيكل دائماً
export function trackPixel(name, data = {}) {
  const payload = { currency: 'ILS', ...data };
  try { if (window.fbq) window.fbq('track', name, payload); } catch { /* تجاهل */ }
  try { if (window.ttq) window.ttq.track(TT_EVENTS[name] || name, payload); } catch { /* تجاهل */ }
  try { if (window.gtag) window.gtag('event', GA_EVENTS[name] || name, { currency: 'ILS', value: Number(data.value) || 0 }); } catch { /* تجاهل */ }
}

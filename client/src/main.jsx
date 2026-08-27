// الخطوط مستضافة داخل التطبيق (بدل شبكة جوجل) — الحرجة منها (تجوال/القاهرة عربي +
// Cairo/Playfair لاتيني للشعار) معرّفة يدوياً بأسماء ثابتة في index.css ومحمّلة
// preload في index.html فتظهر بأول رسمة بلا أي تبديل. الباقي هنا (نطاقات مختلفة).
import '@fontsource/tajawal/latin-400.css';
import '@fontsource/tajawal/latin-700.css';
import '@fontsource/el-messiri/arabic-600.css';
import '@fontsource/el-messiri/arabic-700.css';
import '@fontsource/el-messiri/latin-600.css';
import '@fontsource/el-messiri/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/playfair-display/latin-600.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ready as i18nReady } from './i18n.js';
import './index.css';
import App from './App.jsx';
import { applyPerfTier } from './utils/perfTier.js';
import api from './api/client.js';
import { startOrderQueue } from './utils/orderQueue.js';
import { registerSW } from 'virtual:pwa-register';

// نحدّد مستوى أداء الجهاز قبل أول رسمة — فتبدأ الحركات مضبوطة من اللحظة الأولى
// (بلا وميض تأثيرات ثقيلة ثم تخفيفها)
applyPerfTier();
// طلباتٌ تعثّر حفظُها تُعاد تلقائياً حين تعود الشبكة — لا يفعل شيئاً إن كان
// الطابور فارغاً، وهو الحال دائماً تقريباً.
startOrderQueue(api);
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// تسجيل الـ Service Worker مع فحص تحديث تلقائي — حتى يلتقط التطبيق المثبّت
// أحدث نسخة بعد كل نشر. autoUpdate يطبّق التحديث ويعيد التحميل عند توفّرها.
//
// بعد الإقلاع لا أثناءه: التسجيل يبدأ تخزين ٧٤ ملفاً (٢٫٧ ميغا) مسبقاً، وكان
// immediate يطلقها بالمسار الحرج فتزاحم صورةَ الهيرو والخطوطَ والحزمة على
// عرضٍ محدود — أي أنّ ما يخدم الزيارة القادمة كان يؤخّر الزيارة الحالية.
// التخزين المسبق يبقى كما هو (وهو ما يجعل التطبيق يعمل بشبكةٍ ضعيفة)، لكنّه
// ينتظر أن تُرسم الصفحة.
function startServiceWorker() {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) {
      if (!r) return;
      const check = () => { r.update().catch(() => {}); };
      // كان الفحص كلّ دقيقة — طلبُ شبكةٍ كلّ ٦٠ ثانية لكلّ تبويبٍ مفتوح، طوال
      // اليوم، على بيانات الجوّال. واللحظة التي تهمّ فعلاً هي العودةُ للتطبيق
      // وهي مغطّاةٌ بـvisibilitychange أدناه، فيبقى المؤقّت شبكةَ أمانٍ بعيدة.
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    },
  });
}
if (document.readyState === 'complete') startServiceWorker();
else window.addEventListener('load', () => setTimeout(startServiceWorker, 1200));

// تعافٍ تلقائي من فشل تحميل أجزاء الموقع (يحدث بكاش قديم بعد تحديث) — يمنع التعليق
// على شاشة كريمية بإعادة التحميل مرة واحدة لجلب أحدث الملفات.
// لا يُسحب شيء من الصفحة: الروابط والأزرار والصور كانت تُسحب بالإصبع أو الفأرة
// (شبح العنصر يمشي مع اليد) — إحساس «صفحة ويب» لا «تطبيق». حارسٌ واحد على مستوى
// المستند يغطّي كل الصفحات وكل الحسابات (مدير · مشترك · زبونة) بلا لمس كل زرّ.
// نستثني حقول الإدخال: سحب النصّ داخلها تحريرٌ مشروع. ولا يمسّ هذا إفلات الملفات
// من الجهاز داخل حقول الصور/الفيديو (ذاك drop لا dragstart).
document.addEventListener('dragstart', (e) => {
  const el = e.target;
  if (el && el.closest && el.closest('input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
}, { capture: true });

// نتحكّم باستعادة موضع التمرير يدوياً (عبر الراوتر) بدل سلوك المتصفّح
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// فشل تحميل جزء = كاش قديم بعد نشر جديد. مجرّد reload لا يكفي لو ظلّ الـ Service Worker
// يخدم index.html قديماً يشير لملفات مفقودة — فتظلّ الصفحة تنهار (وعليها يفشل حتى تسجيل
// الدخول). نكسر الجمود: نُلغي الـ SW ونمسح كل مخابئه ثم نعيد التحميل مرّة واحدة لجلب نسخة
// نظيفة فعلاً. الحارس (sessionStorage) يمنع حلقة إعادة لا نهائية.
window.addEventListener('vite:preloadError', async () => {
  if (sessionStorage.getItem('bz_chunk_reload')) return;
  sessionStorage.setItem('bz_chunk_reload', '1');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* نُعيد التحميل على أي حال */ }
  window.location.reload();
});

// ننتظر نصوص اللغة المختارة قبل أول رسمة (العربية مُضمّنة فتُحلّ فوراً)
i18nReady.finally(() => ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <HelmetProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <NotificationsProvider>
              <WishlistProvider>
                <CartProvider>
                  <App />
                </CartProvider>
              </WishlistProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
));

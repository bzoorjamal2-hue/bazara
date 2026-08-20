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
import './i18n.js';
import './index.css';
import App from './App.jsx';
import { applyPerfTier } from './utils/perfTier.js';
import { registerSW } from 'virtual:pwa-register';

// نحدّد مستوى أداء الجهاز قبل أول رسمة — فتبدأ الحركات مضبوطة من اللحظة الأولى
// (بلا وميض تأثيرات ثقيلة ثم تخفيفها)
applyPerfTier();
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// تسجيل الـ Service Worker مع فحص تحديث تلقائي متكرّر — حتى يلتقط التطبيق المثبّت
// أحدث نسخة بسرعة بعد كل نشر (لا ينتظر إعادة فتح التطبيق). autoUpdate يطبّق التحديث
// ويعيد التحميل تلقائياً عند توفّر نسخة جديدة.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (!r) return;
    const check = () => { r.update().catch(() => {}); };
    setInterval(check, 60 * 1000); // كل دقيقة
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  },
});

// تعافٍ تلقائي من فشل تحميل أجزاء الموقع (يحدث بكاش قديم بعد تحديث) — يمنع التعليق
// على شاشة كريمية بإعادة التحميل مرة واحدة لجلب أحدث الملفات.
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <HelmetProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

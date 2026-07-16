// الخطوط مستضافة داخل التطبيق (بدل شبكة جوجل): تُخزَّن مع ملفات التطبيق في الـ Service Worker
// فتظهر النصوص بالخط الفخم فوراً من أول لحظة — بلا اختفاء نص ولا "تبديل خط" ولا انتظار شبكة.
// نستورد المجموعات المطلوبة فقط (عربي للعربي + لاتيني للإنجليزي) ليبقى الحجم خفيفاً.
import '@fontsource/tajawal/arabic-400.css';
import '@fontsource/tajawal/arabic-700.css';
import '@fontsource/tajawal/latin-400.css';
import '@fontsource/tajawal/latin-700.css';
import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/el-messiri/arabic-600.css';
import '@fontsource/el-messiri/arabic-700.css';
import '@fontsource/el-messiri/latin-600.css';
import '@fontsource/el-messiri/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './i18n.js';
import './index.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

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

window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('bz_chunk_reload')) {
    sessionStorage.setItem('bz_chunk_reload', '1');
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>
);

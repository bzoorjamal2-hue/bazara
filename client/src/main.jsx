import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './i18n.js';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

// تعافٍ تلقائي من فشل تحميل أجزاء الموقع (يحدث بكاش قديم بعد تحديث) — يمنع التعليق
// على شاشة كريمية بإعادة التحميل مرة واحدة لجلب أحدث الملفات.
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

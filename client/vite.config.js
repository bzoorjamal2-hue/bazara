import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // تطبيق ويب تقدّمي (PWA): قابل للتثبيت على الجوال، يفتح بملء الشاشة، ويعمل جزئياً بلا إنترنت.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Bazara Store',
        short_name: 'Bazara',
        description: 'Bazara — وجهتك للأزياء الفاخرة',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#F4EDE2',
        background_color: '#F4EDE2',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        // تخزين هيكل التطبيق مسبقاً (يفتح فوراً وبلا نت). لا نُخزّن طلبات /api ليبقى المحتوى محدّثاً.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // hls.js (~500KB) يخصّ أندرويد فقط (iOS يشغّل HLS أصلياً) — يُحمَّل عند فتح الريلز
        // بدل تنزيله مسبقاً على كل الأجهزة مع كل تحديث
        globIgnores: ['**/hls-*.js'],
        navigateFallback: '/index.html',
        // ‏/share يجب أن يصل للسيرفر (صفحات المعاينة والتحويل) — اعتراضه يعرض 404 داخل التطبيق
        navigateFallbackDenylist: [/^\/api/, /^\/share\//, /^\/sitemap\.xml/, /^\/robots\.txt/],
        cleanupOutdatedCaches: true,
        // حقن معالج إشعارات الدفع داخل الـ Service Worker
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
  build: {
    // فصل المكتبات الكبيرة لملفّات مستقلة → تخزين مؤقت أفضل وتحميل أوّلي أخف
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // وكيل التطوير: يحوّل طلبات /api إلى الخادم المحلي لتفادي مشاكل CORS/الكوكيز
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

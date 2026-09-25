import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// بصمةُ الإصدارة: تدخل ببادئة مفاتيح الكاش، فتُهمَل نسخُ الإصدارة السابقة
// تلقائياً بدل أن تُعرض بشكلٍ قديمٍ للبيانات فتُسقط الصفحة.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || String(Date.now().toString(36));

// وجهةُ الوكيل: الخادمُ المحلّيُّ افتراضاً، وAPI_PROXY لمعاينةِ الواجهةِ على بياناتِ الإنتاج بلا تشغيلِ
// الخادمِ محلّياً (المحلّيُّ متّصلٌ بقاعدةِ الإنتاج ويشغّلُ مهامَّ خلفيّة) — والإنتاجُ لا يسمحُ بـCORS من localhost.
const API_TARGET = process.env.API_PROXY || 'http://localhost:5000';

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    // تطبيق ويب تقدّمي (PWA): قابل للتثبيت على الجوال، يفتح بملء الشاشة، ويعمل جزئياً بلا إنترنت.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Bazara Store',
        short_name: 'Bazara',
        description: 'Bazara — أزياء وأحذية وإكسسوارات',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#FAF9F7',
        background_color: '#FAF9F7',
        // ‏maskable لها ملفٌّ خاصّ: أندرويدُ يقصُّ الأيقونةَ المقنَّعةَ إلى دائرةٍ
        // قطرُها 80٪ من الضلع، وكان يشيرُ هنا إلى الأيقونةِ الممتلئةِ نفسِها
        // (الختمُ فيها 76٪) — فتُقَصُّ حلقتُه الخارجيّةُ على شاشةِ الجوّال.
        // النسخةُ المقنَّعةُ ختمُها 60٪ فتبقى كاملةً داخلَ أيِّ قناع.
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        // تخزين هيكل التطبيق مسبقاً (يفتح فوراً وبلا نت). لا نُخزّن طلبات /api ليبقى المحتوى محدّثاً.
        // رسوم الفئات (WebP) تُخزَّن مسبقاً: تظهر فوراً من الجهاز عند فتح الرئيسية أو
        // تبديل القسم، ولو على شبكةٍ بطيئة — ٤٩٠ ك.ب. للستّ عشرة كلّها.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}', 'categories/*.webp'],
        // hls.js (~500KB) يخصّ أندرويد فقط (iOS يشغّل HLS أصلياً) — يُحمَّل عند فتح الريلز
        // بدل تنزيله مسبقاً على كل الأجهزة مع كل تحديث.
        // ونسخ PNG الاحتياطيّة لفئات الملابس (١٫٥ م.ب.) لا تُطلب إلا لمتصفّحٍ بلا WebP،
        // وصورة المشاركة (og-cover) لمنصّات التواصل لا للزائر — لا مكان لهما بالتنزيل المسبق.
        globIgnores: ['**/hls-*.js', 'categories/*.png', 'og-cover.png', '__t/**'],
        // الرسوم تُطلب بـ?v= (تبديل النسخة يكسر كاش المتصفّح)، والتخزين المسبق يحفظها
        // بلا استعلام — نُسقط v عند المطابقة فتُخدَم من الجهاز. النسخة الجديدة تصل مع
        // كلّ نشر لأنّ التخزين المسبق يعرف بصمة كلّ ملف.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
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
        // الصيغة الدالّية لا النصّية: القائمة النصّية تطابق المُعرِّف كما يُكتب،
        // و react/jsx-runtime يصله Vite بمسارٍ مُعالَجٍ مسبقاً فلا تطالبه القاعدة —
        // فيسقط بأوّل قطعةٍ تصله، وكانت قطعة الحركة. وكلُّ مكوّنٍ بالمشروع يستورد
        // jsx-runtime، فصارت الحركة (١٢٧ كيلو) تُحمَّل مسبقاً مع كلّ صفحة مهما
        // أُجّل استعمالُها. (اكتشفتُها بقراءة القطعة المبنيّة: import{j} — والـj
        // هو jsx لا motion.) المطابقة بالمسار تُمسك كلّ صيغ المُعرِّف.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const p = id.replace(/\\/g, '/');
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(p)) return 'react-vendor';
          // مشتركةٌ بين أدراجٍ ونوافذَ وصفحاتٍ مؤجّلة. وبلا تسميتها هنا يرفعها
          // Rollup إلى القطعة الرئيسية بوصفها أقرب سلفٍ مشترك (قِستُ: ٤٥٢ ← ٥٥١).
          if (p.includes('/framer-motion/')) return 'motion';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    // وكيل التطوير: يحوّل طلبات /api إلى الخادم المحلي لتفادي مشاكل CORS/الكوكيز
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  // نفس الوكيل لخادم المعاينة (vite preview): بلا هذا يتعذّر فحصُ النسخة
  // المبنيّة محلياً، فتُقاس أرقامُ خادم التطوير — وهي لا تقول شيئاً عمّا يصل
  // المستخدمة: Vite يخدم بالتطوير عشرات الوحدات غير مجمّعة.
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});

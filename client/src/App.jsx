import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigationType, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RequireSubscription from './components/RequireSubscription.jsx';
import Spinner from './components/Spinner.jsx';
import Home from './pages/Home.jsx'; // الصفحة الرئيسية تبقى فورية (أول ما يفتح الزائر)
import AppWelcome from './components/AppWelcome.jsx';
import Splash from './components/Splash.jsx';
import { isStandalone, hasStoredToken } from './utils/pwa.js';
import { useAuth } from './context/AuthContext.jsx';

// داخل التطبيق المثبّت:
// - مشترك مسجّل دخوله → يفتح مباشرة على لوحة التحكم (حسابه).
// - زائر → شاشة افتتاح أنيقة.
// في المتصفح: يعرض الصفحة الرئيسية العامة كالمعتاد.
function Root() {
  const { user, loading } = useAuth();
  // مهلة قصوى للسبلاش: لو تأخّر الخادم (Render نائم) لا نعلّق — نعرض شاشة الترحيب بعد 6 ثوانٍ
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 6000);
    return () => clearTimeout(id);
  }, []);
  if (!isStandalone()) return <Home />;
  if (user) return <Navigate to="/dashboard" replace />;
  if (loading && hasStoredToken() && !waited) return <Splash />;
  return <AppWelcome />;
}

// باقي الصفحات تُحمّل عند الحاجة فقط (code-splitting) — يقلّل حجم التحميل الأولي كثيراً
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Subscribe = lazy(() => import('./pages/Subscribe.jsx'));
const StorePage = lazy(() => import('./pages/StorePage.jsx'));
const CategoryPage = lazy(() => import('./pages/CategoryPage.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const ProductDetails = lazy(() => import('./pages/ProductDetails.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const Track = lazy(() => import('./pages/Track.jsx'));
const PaymentCallback = lazy(() => import('./pages/PaymentCallback.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

// مواضع التمرير المحفوظة لكل صفحة (لاستعادتها عند الرجوع)
const scrollPositions = new Map();

// انتقالات ناعمة بين الصفحات + استعادة موضع التمرير عند الرجوع، والتمرير لأعلى عند صفحة جديدة
function AnimatedRoutes() {
  const location = useLocation();
  const navType = useNavigationType(); // POP عند الرجوع/التقدّم

  // نحفظ موضع التمرير الحالي باستمرار لمفتاح هذه الصفحة
  useEffect(() => {
    const onScroll = () => { scrollPositions.set(location.key, window.scrollY); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.key]);

  // عند الرجوع (POP) نستعيد الموضع بدقّة. المحتوى (ومنه القوائم/الصور) قد يُحمّل
  // بعد لحظات (خاصةً عند نوم خادم Render)، فنواصل المحاولة حتى يطول المستند كفايةً
  // ليصل للموضع المطلوب — أو حتى انقضاء مهلة قصوى. هكذا لا يرجع لأعلى الصفحة.
  useEffect(() => {
    if (navType === 'POP') {
      const y = scrollPositions.get(location.key) || 0;
      if (y > 0) {
        let raf = 0;
        const start = performance.now();
        const tryScroll = () => {
          window.scrollTo({ top: y, behavior: 'auto' });
          const reached = Math.abs(window.scrollY - y) < 4;
          const maxScrollable =
            document.documentElement.scrollHeight - window.innerHeight >= y - 4;
          // نتوقّف عند الوصول (وكان المستند طويلاً كفايةً) أو بعد 4 ثوانٍ كحدّ أقصى
          if ((reached && maxScrollable) || performance.now() - start > 4000) return;
          raf = requestAnimationFrame(tryScroll);
        };
        raf = requestAnimationFrame(tryScroll);
        return () => cancelAnimationFrame(raf);
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    return undefined;
  }, [location.key, navType]);

  // التطبيق أقلع بنجاح → نصفّر علم إعادة التحميل (ليعمل التعافي مجدداً عند أي فشل لاحق)
  useEffect(() => { try { sessionStorage.removeItem('bz_chunk_reload'); } catch { /* ignore */ } }, []);

  // تحميل مُسبق للصفحات الشائعة بعد الإقلاع — يلغي وميض/فصل التحميل عند الانتقال
  useEffect(() => {
    const warm = () => {
      import('./pages/Login.jsx');
      import('./pages/Register.jsx');
      import('./pages/StorePage.jsx');
      import('./pages/ProductDetails.jsx');
      import('./pages/Categories.jsx');
      import('./pages/CategoryPage.jsx');
      import('./pages/Wishlist.jsx');
    };
    const ric = window.requestIdleCallback;
    const id = ric ? ric(warm) : setTimeout(warm, 1200);
    return () => { if (ric && window.cancelIdleCallback) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, []);

  // انتقال فوري بلا انتظار: الصفحة الجديدة تظهر مباشرة بحركة تلاشٍ سريعة (بلا
  // حركة خروج تُبقي الشاشة كريمية فارغة لحظة) — يلغي إحساس "التعليق" بين الصفحات.
  return (
    <Suspense fallback={<Spinner full />}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Root />} />
          <Route path="/shop" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/track" element={<Track />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route
            path="/dashboard"
            element={
              <RequireSubscription>
                <Dashboard />
              </RequireSubscription>
            }
          />
          <Route
            path="/subscribe"
            element={
              <ProtectedRoute>
                <Subscribe />
              </ProtectedRoute>
            }
          />
          <Route path="/store/:slug" element={<StorePage />} />
          <Route path="/category/:cat" element={<CategoryPage />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </Suspense>
  );
}

export default function App() {
  return (
    <Layout>
      <AnimatedRoutes />
    </Layout>
  );
}

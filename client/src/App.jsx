import { Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react';
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
// نتولّى استعادة التمرير بأنفسنا — نوقف استعادة المتصفّح التلقائية كي لا تتعارض
if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

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

  // عند الرجوع (POP) نستعيد الموضع بقفزة واحدة فورية بالضبط (بلا تدرّج ولا رجوع للأعلى).
  // useLayoutEffect: نقفز قبل أن يرسم المتصفّح الإطار، فلا تظهر الصفحة من الأعلى لحظةً
  // عندما يكون المحتوى جاهزاً (مخزّن). وإن كان المحتوى يُحمّل، ننتظر طول المستند ثم نقفز.
  useLayoutEffect(() => {
    if (navType === 'POP') {
      const target = scrollPositions.get(location.key) || 0;
      if (target > 0) {
        let done = false;
        let ro = null;
        let cap = null;
        const finish = () => {
          if (done) return;
          done = true;
          window.scrollTo({ top: target, behavior: 'instant' });
          if (ro) ro.disconnect();
          if (cap) clearTimeout(cap);
        };
        // نقفز فقط عندما يصبح المستند طويلاً كفايةً ليبلغ الموضع المطلوب
        const tryJump = () => {
          if (done) return;
          if (document.documentElement.scrollHeight - window.innerHeight >= target - 2) finish();
        };
        tryJump(); // فوري إن كان المحتوى جاهزاً (من الكاش) → قفزة لحظية بلا أي زحف
        if (!done) {
          ro = new ResizeObserver(tryJump); // نراقب نمو الصفحة ونقفز عند جهوزها
          ro.observe(document.body);
          cap = setTimeout(finish, 3000); // مهلة أمان: أقرب موضع متاح
        }
        return () => { done = true; if (ro) ro.disconnect(); if (cap) clearTimeout(cap); };
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
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
        transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
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

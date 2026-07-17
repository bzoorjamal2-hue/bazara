import { Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigationType, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { recordNav } from './utils/nav.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RequireSubscription from './components/RequireSubscription.jsx';
import Spinner from './components/Spinner.jsx';
import Home from './pages/Home.jsx'; // الصفحة الرئيسية تبقى فورية (أول ما يفتح الزائر)
import Search from './pages/Search.jsx'; // البحث يفتح من الهيدر مباشرة — ضمن الحزمة الأساسية ليفتح فورياً بلا وميض تحميل
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
const Offers = lazy(() => import('./pages/Offers.jsx'));
const Reels = lazy(() => import('./pages/Reels.jsx'));
const Track = lazy(() => import('./pages/Track.jsx'));
const PaymentCallback = lazy(() => import('./pages/PaymentCallback.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
// معاينة تطويرية لنموذج المنتج (DEV فقط — يزيلها البناء نهائياً)
const DevProductForm = lazy(() =>
  import('./pages/dashboard/ProductForm.jsx').then((m) => ({
    default: () => <m.default initial={null} onClose={() => {}} onSaved={() => {}} />,
  }))
);

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

  // نحفظ موضع التمرير الحالي باستمرار لمفتاح هذه الصفحة، ونلتقطه أيضاً لحظة المغادرة
  // (في التنظيف) كي يبقى الموضع مضموناً حتى لو لم يُطلق حدث تمرير قبل الانتقال — هذا
  // يمنع "الرجوع لأعلى الصفحة" عند تكرار التنقّل.
  // useLayoutEffect لا useEffect: التنظيف (الذي يحفظ الموضع ويزيل المستمع) يعمل في
  // مرحلة التخطيط — أي قبل أن تصفّر الصفحة الجديدة التمرير بـ scrollTo(0). لو كان
  // useEffect (تمريري) لعمل التنظيف بعد ذلك فيحفظ 0 بدل الموضع الحقيقي (كان يرجع للأعلى).
  // نحفظ موضع التمرير على كل حدث تمرير (يلتقط الموضع الحقيقي أثناء التصفّح). لا نحفظ
  // في التنظيف: لحظة المغادرة يتقلّص ارتفاع الصفحة القديمة فينقصّ scrollY (clamp) لقيمة
  // أصغر — والتنظيف كان يحفظها فيرجع الزر لمكان خاطئ. المستمع سبق وحفظ القيمة الصحيحة،
  // والتنظيف يكتفي بإزالة المستمع (يُزال تزامنياً قبل حدث القصّ غير المتزامن).
  useLayoutEffect(() => {
    const key = location.key;
    // نسجّل المسار لسجل "الرجوع الذكي" (أيقونات فتات الخبز ترجع بدل ما تفتح صفحة جديدة)
    recordNav(key, location.pathname + location.search);
    const save = () => { scrollPositions.set(key, window.scrollY); };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // عند الرجوع (POP) نستعيد الموضع بقفزة واحدة فورية بالضبط (بلا تدرّج ولا رجوع للأعلى).
  // useLayoutEffect: نقفز قبل أن يرسم المتصفّح الإطار، فلا تظهر الصفحة من الأعلى لحظةً
  // عندما يكون المحتوى جاهزاً (مخزّن). وإن كان المحتوى يُحمّل، ننتظر طول المستند ثم نقفز.
  useLayoutEffect(() => {
    if (navType === 'POP') {
      const target = scrollPositions.get(location.key) || 0;
      if (target > 0) {
        let done = false;
        // نصحّح الموضع فقط عند الانحراف الفعلي (>2px). لا نستخدم ResizeObserver على body
        // (كان يقرأ scrollHeight مع كل تغيّر حجم أثناء تحميل الصور/الفيديو = layout thrashing
        // = تعليق). بدلاً منه: بضع محاولات مجدولة قليلة تلتقط انزياح التحميل بلا شغل مستمر.
        const apply = () => {
          if (done) return;
          const maxReach = document.documentElement.scrollHeight - window.innerHeight;
          if (maxReach >= target - 2 && Math.abs(window.scrollY - target) > 2) {
            window.scrollTo({ top: target, behavior: 'instant' });
          }
        };
        const onUser = () => { done = true; }; // لا نقاوم المستخدم إن حرّك بنفسه
        window.addEventListener('wheel', onUser, { passive: true });
        window.addEventListener('touchmove', onUser, { passive: true });
        apply(); // فوري (المحتوى من الكاش غالباً جاهز)
        const timers = [80, 200, 400, 700].map((ms) => setTimeout(apply, ms));
        return () => {
          done = true;
          timers.forEach(clearTimeout);
          window.removeEventListener('wheel', onUser);
          window.removeEventListener('touchmove', onUser);
        };
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

  // انتقال فوري بلا انتظار: الصفحة الجديدة تظهر مباشرة بحركة تلاشٍ سريعة عبر CSS
  // خالص (بدل framer-motion الذي كان يضيف شغل جافاسكربت مع كل تنقّل = جزء من التعليق).
  return (
    <Suspense fallback={<Spinner full />}>
      <div key={location.pathname} className="route-fade">
        <Routes location={location}>
          <Route path="/" element={<Root />} />
          <Route path="/shop" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/search" element={<Search />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/track" element={<Track />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          {/* معاينة نموذج المنتج أثناء التطوير فقط — لا يدخل بنسخة الإنتاج (يُحذف بالبناء) */}
          {import.meta.env.DEV && <Route path="/__dev/product-form" element={<DevProductForm />} />}
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
          <Route path="/store/:slug/reels" element={<Reels />} />
          <Route path="/category/:cat" element={<CategoryPage />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
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

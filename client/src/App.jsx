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

// مواضع التمرير المحفوظة لكل صفحة (لاستعادتها عند الرجوع) — في الذاكرة + sessionStorage
// (react-router يعيد نفس location.key لكل إدخال بالتاريخ حتى بعد إعادة التحميل، فتنجو
// المواضع من إعادة فتح التطبيق/PWA ويرجع الزائر لمكانه بالضبط).
const SCROLL_STORE = 'bz_scrollpos_v1';
const scrollPositions = (() => {
  try { return new Map(JSON.parse(sessionStorage.getItem(SCROLL_STORE) || '[]')); }
  catch { return new Map(); }
})();
// مواضع بحسب المسار (وليس مفتاح التاريخ): للتنقّل المباشر بين تبويبات الشريط السفلي
// (رئيسية → ريلز → رئيسية = PUSH لا POP) — يرجع الزائر لموضعه بآخر زيارة لنفس الصفحة
const pathPositions = new Map();
const flushScrollPositions = () => {
  try { sessionStorage.setItem(SCROLL_STORE, JSON.stringify([...scrollPositions].slice(-80))); }
  catch { /* تجاهل */ }
};
if (typeof window !== 'undefined') {
  // pagehide (وليس beforeunload) — الوحيد الموثوق على iOS/سفاري عند إغلاق أو تصغير التطبيق
  window.addEventListener('pagehide', flushScrollPositions);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushScrollPositions(); });
}
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
    // أثناء قفل التمرير (درج/نافذة مفتوحة يثبّت body) يكون scrollY صفراً زائفاً — لا نحفظه
    const save = () => {
      if (document.body.style.position === 'fixed') return;
      scrollPositions.set(key, window.scrollY);
      pathPositions.set(location.pathname + location.search, window.scrollY);
    };
    // حزامان معاً — أحداث التمرير وحدها لم تكن كافية (قد تضيع لحظة التعليق/الزخم على
    // الموبايل فيُحفظ موضع قديم ويرجع الزائر لأعلى الصفحة):
    // 1) scroll: يلتقط الموضع باستمرار أثناء التصفّح.
    // 2) pointerdown/click بمرحلة الالتقاط (قبل معالجات React والتنقّل): يلتقط الموضع
    //    الحقيقي لحظة اللمسة التي ستسبّب الانتقال — والمستند ما يزال سليماً بلا قصّ.
    window.addEventListener('scroll', save, { passive: true });
    document.addEventListener('pointerdown', save, { capture: true, passive: true });
    document.addEventListener('click', save, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', save);
      document.removeEventListener('pointerdown', save, true);
      document.removeEventListener('click', save, true);
    };
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // عند الرجوع (POP) نستعيد الموضع بقفزة واحدة فورية بالضبط (بلا تدرّج ولا رجوع للأعلى).
  // useLayoutEffect: نقفز قبل أن يرسم المتصفّح الإطار، فلا تظهر الصفحة من الأعلى لحظةً
  // عندما يكون المحتوى جاهزاً (مخزّن). وإن كان المحتوى يُحمّل، ننتظر نموّ المستند ثم نقفز.
  // كانت هنا مؤقّتات ثابتة تستسلم بعد 700ms — على شبكة أبطأ من ذلك كان الرجوع يهبط
  // لأعلى الصفحة. الآن ResizeObserver على body (مخنوق بإطار الرسم: قراءة واحدة كحدّ
  // أقصى لكل إطار، وفقط عندما يتغيّر الارتفاع فعلاً — لا layout thrashing) يلتقط وصول
  // المحتوى مهما تأخّر، بسقف 5 ثوانٍ، ويتوقّف فوراً عند أي تمرير يدوي من المستخدم.
  useLayoutEffect(() => {
    {
      // POP (رجوع): موضع مفتاح التاريخ. PUSH (تنقّل مباشر كتبويبات الشريط السفلي):
      // موضع آخر زيارة لنفس المسار — فالرئيسية ترجع لمكانها حتى بالتنقّل بالأزرار
      const target = navType === 'POP'
        ? (scrollPositions.get(location.key) || 0)
        : (pathPositions.get(location.pathname + location.search) || 0);
      if (target > 0) {
        let done = false;
        let raf = 0;
        const apply = () => {
          if (done) return;
          const maxReach = document.documentElement.scrollHeight - window.innerHeight;
          // لم يكبر المستند بما يكفي بعد؟ ننتظر نموّه (المراقب يعيد استدعاءنا)
          if (maxReach < target - 2) return;
          if (Math.abs(window.scrollY - target) > 2) window.scrollTo({ top: target, behavior: 'instant' });
          // وصلنا → نوقف المراقبة فوراً. سابقاً كانت تستمر حتى مهلة الـ5 ثوانٍ، فكل قفزة
          // تمرير تغيّر التخطيط فيُطلق ResizeObserver من جديد → حلقة تُصدر خطأ
          // "ResizeObserver loop completed with undelivered notifications" وتعليقاً بكل رجوع.
          stop();
        };
        const scheduled = () => { if (!done && !raf) raf = requestAnimationFrame(() => { raf = 0; apply(); }); };
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduled) : null;
        const stop = () => {
          done = true;
          if (raf) cancelAnimationFrame(raf);
          if (ro) ro.disconnect();
          window.removeEventListener('wheel', stop);
          window.removeEventListener('touchmove', stop);
        };
        window.addEventListener('wheel', stop, { passive: true }); // لا نقاوم المستخدم إن حرّك بنفسه
        window.addEventListener('touchmove', stop, { passive: true });
        apply(); // فوري (المحتوى من الكاش غالباً جاهز — قفزة قبل أول رسم فلا وميض)
        if (ro && !done) ro.observe(document.body); // !done: قد تكون apply() نجحت فوراً وأوقفت كل شيء
        else [80, 250, 600, 1200, 2500].forEach((ms) => setTimeout(() => scheduled(), ms)); // احتياط نادر
        const cap = setTimeout(stop, 5000);
        return () => { clearTimeout(cap); stop(); };
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
  // عند الرجوع (POP) لا تلاشي إطلاقاً — الصفحة السابقة تظهر فوراً على موضعها المحفوظ؛
  // كان التلاشي + قفزة التمرير بنفس اللحظة يعطيان إحساس "تعليق" عند كل رجوع.
  return (
    <Suspense fallback={<Spinner full />}>
      <div key={location.pathname} className={navType === 'POP' ? undefined : 'route-fade'}>
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

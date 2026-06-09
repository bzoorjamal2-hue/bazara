import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RequireSubscription from './components/RequireSubscription.jsx';
import Spinner from './components/Spinner.jsx';
import Home from './pages/Home.jsx'; // الصفحة الرئيسية تبقى فورية (أول ما يفتح الزائر)
import AppWelcome from './components/AppWelcome.jsx';
import { isStandalone } from './utils/pwa.js';

// داخل التطبيق المثبّت: الجذر "/" يعرض شاشة افتتاح أنيقة. في المتصفح: يعرض الصفحة الرئيسية كالمعتاد.
function Root() {
  return isStandalone() ? <AppWelcome /> : <Home />;
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
const ProductDetails = lazy(() => import('./pages/ProductDetails.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const PaymentCallback = lazy(() => import('./pages/PaymentCallback.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Spinner full />}>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/shop" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/wishlist" element={<Wishlist />} />
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
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RequireSubscription from './components/RequireSubscription.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Subscribe from './pages/Subscribe.jsx';
import StorePage from './pages/StorePage.jsx';
import CategoryPage from './pages/CategoryPage.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Wishlist from './pages/Wishlist.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/wishlist" element={<Wishlist />} />
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
    </Layout>
  );
}

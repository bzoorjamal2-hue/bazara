import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

// يحمي لوحة التحكم: لا يدخلها إلا مستخدم مسجّل دخول ولديه اشتراك فعّال (أو مدير).
// غير المشترك يُحوَّل دائماً لصفحة الاشتراك/الدفع.
export default function RequireSubscription({ children }) {
  const { user, subscription, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  if (subscription && !subscription.active) return <Navigate to="/subscribe" replace />;
  return children;
}

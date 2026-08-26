import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

// يحمي لوحة التحكم: لا يدخلها إلا مستخدم مسجّل دخول ولديه اشتراك فعّال (أو مدير).
// غير المشترك يُحوَّل دائماً لصفحة الاشتراك/الدفع.
export default function RequireSubscription({ children }) {
  const { user, subscription, loading, loggingOut } = useAuth();
  if (loading) return <Spinner full />;
  // أثناء الخروج لا نوجّه أحداً: الانتقالُ إلى الواجهة جارٍ، وتوجيهُنا هنا
  // يسبقه فيُظهر شاشة الدخول لحظةً ثمّ يسحب المستخدم إليها.
  if (loggingOut) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (subscription && !subscription.active) return <Navigate to="/subscribe" replace />;
  return children;
}

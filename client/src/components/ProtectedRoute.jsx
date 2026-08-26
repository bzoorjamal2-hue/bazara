import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading, loggingOut } = useAuth();
  if (loading) return <Spinner full />;
  // أثناء الخروج لا نوجّه أحداً: الانتقالُ إلى الواجهة جارٍ، وتوجيهُنا هنا
  // يسبقه فيُظهر شاشة الدخول لحظةً ثمّ يسحب المستخدم إليها.
  if (loggingOut) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

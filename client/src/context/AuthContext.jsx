import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import api, { setAuthToken, clearAuthToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  // بعد الخروج نرفض أي استعادةٍ للجلسة حتى لو ردّ /auth/me بمستخدم: كوكي
  // الجلسة قد يبقى لحظاتٍ (أو للأبد إن فشل نداء الخروج)، فكان أوّل تحميلٍ
  // للصفحة يعيد صاحبه إلى حسابه رغم خروجه. useRef لا useState: القيمة تُقرأ
  // داخل نداءٍ جارٍ ولا يجوز أن تنتظر إعادة رسم.
  const loggedOut = useRef(false);

  // «خارجٌ الآن»: بين مسحِ المستخدم ووصولِ المسار الجديد تمرّ رسمةٌ يكون فيها
  // المستخدم فارغاً والمسارُ ما يزال صفحةً محميّة — فيرسم حارسُها <Navigate>
  // إلى /login، ويُنفَّذ أثرُه بعد انتقالنا فيسحبنا إلى شاشة الدخول. ولا يكفي
  // ترتيبُ الاستدعاءات: تحديثُ المسار وتحديثُ الحالة لا يقعان بدفعةٍ واحدة.
  // فبدل مطاردة الترتيب، نُعلن الحالة: الحرّاس لا يوجّهون أحداً أثناءها.
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      // خرج المستخدم أثناء الطلب (أو قبله والكوكي لم يُمسح بعد) — لا نستعيده
      if (loggedOut.current) { setLoading(false); return null; }
      setUser(data.user);
      setStore(data.store);
      setSubscription(data.subscription || null);
      return data;
    } catch {
      setUser(null);
      setStore(null);
      setSubscription(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    loggedOut.current = false;
    const { data } = await api.post('/auth/login', { email, password });
    if (data?.token) setAuthToken(data.token); // بقاء الجلسة في التطبيق المثبّت
    return await refresh();
  };

  // دخول + تجديد بكود التفعيل (للمشترك المنتهي اشتراكه)
  const loginWithCode = async (email, password, code) => {
    const { data } = await api.post('/auth/login-with-code', { email, password, code });
    if (data?.token) setAuthToken(data.token);
    return await refresh();
  };

  // التسجيل يُدخِل المستخدم تلقائياً ليصل مباشرةً لصفحة الاشتراك/الدفع
  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    if (data?.token) setAuthToken(data.token);
    return await refresh();
  };

  const logout = async () => {
    // نُفرِغ محلياً أوّلاً فلا تعلّق الواجهة على خادمٍ نائم…
    loggedOut.current = true;
    setLoggingOut(true);
    clearAuthToken();
    // مسح مسودّات النماذج كي لا تُسكب بيانات هذا الحساب على حسابٍ آخر يدخل بعده
    try {
      const pre = 'bz_draft:';
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(pre)) sessionStorage.removeItem(k);
      }
    } catch { /* تصفّح خاص */ }
    setUser(null);
    setStore(null);
    setSubscription(null);
    // …ثمّ ننتظر مسح الكوكي بمهلةٍ قصيرة. الانتظار ضروريّ: الكوكي هو ما يوثّق
    // الطلب التالي، وبلا مسحه يعود المستخدم داخلاً. والمهلة تمنع التعليق.
    try {
      await Promise.race([
        api.post('/auth/logout'),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch { /* الجلسة المحلية مُفرَّغة والحارس أعلاه يمنع الاستعادة */ }
    // انتهى الانتقال: يعود الحرّاس لعملهم الطبيعيّ
    setLoggingOut(false);
  };

  const updateProfile = async (payload) => {
    const { data } = await api.put('/auth/profile', payload);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, store, subscription, loading, loggingOut, login, loginWithCode, register, logout, refresh, updateProfile, setStore }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

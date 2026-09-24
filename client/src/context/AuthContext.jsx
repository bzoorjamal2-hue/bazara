import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import api, { setAuthToken, clearAuthToken, clearReadCache } from '../api/client.js';
import { readAuthCache, writeAuthCache, clearAuthCache } from '../utils/authCache.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // نُقلعُ بآخرِ جوابٍ محفوظٍ بدل الفراغ، فلا تُرسَمُ شاشةُ «لا أعرفُك» أوّلاً
  // ثمّ تُستبدَل. والنداءُ يجري بالخلفيّةِ ويصحّح — انظر utils/authCache.js
  const snap = useRef(readAuthCache()).current;
  const [user, setUser] = useState(snap?.user || null);
  const [store, setStore] = useState(snap?.store || null);
  const [subscription, setSubscription] = useState(snap?.subscription || null);
  // ‏loading معناه «لا أعرفُ بعد». ومع نسخةٍ محفوظةٍ نحن نعرفُ ظنّاً راجحاً،
  // فيمرُّ الحارسُ بلا دوّارةٍ وتُلغى شاشةُ الإقلاع. وإن خابَ الظنُّ صحّحَه
  // الجوابُ بعدَ جزءٍ من الثانيةِ كما يصحّحُ اليوم.
  const [loading, setLoading] = useState(!snap);

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
      if (loggedOut.current) { clearAuthCache(); setLoading(false); return null; }
      setUser(data.user);
      setStore(data.store);
      setSubscription(data.subscription || null);
      return data;
    } catch (err) {
      // «رفَضَك الخادم» شيءٌ و«لم يردَّ الخادم» شيءٌ آخر. خادمُنا على خطّةٍ
      // مجّانيّةٍ ينامُ ويستيقظُ بتأخير، فلو أفرغنا الجلسةَ عند كلِّ فشلٍ لخرجَ
      // المستخدمُ لأنّ الشبكةَ تعثّرت لحظة. ٤٠١/٤٠٣ وحدَهما جوابُ رفض.
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) return null; // نُبقي ما لدينا ونمضي
      setUser(null);
      setStore(null);
      setSubscription(null);
      clearAuthCache();
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // الحفظُ أثرٌ للحالةِ لا سطرٌ بكلِّ مسار: ‎refresh وتعديلُ الملفِّ الشخصيِّ
  // وحفظُ إعداداتِ المتجرِ كلُّها تكتبُ هنا، فلا يبقى طريقٌ ينسى أن يحفظَ
  // فتُقلعَ الصفحةُ التاليةُ باسمٍ أو شعارٍ قديم — انظر utils/authCache.js
  useEffect(() => {
    if (loggedOut.current) return;
    writeAuthCache(user ? { user, store, subscription } : null);
  }, [user, store, subscription]);

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

  // جوجل/فيسبوك: إمّا دخولٌ مباشر، أو needsSignup لحسابٍ جديد ينقصه اسم المتجر والجوال
  const socialLogin = async (path, body) => {
    loggedOut.current = false;
    const { data } = await api.post(path, body);
    if (data?.needsSignup) return data;
    if (data?.token) setAuthToken(data.token);
    return await refresh();
  };
  const googleLogin = (credential) => socialLogin('/auth/google', { credential });
  const facebookLogin = (accessToken) => socialLogin('/auth/facebook', { accessToken });

  const socialRegister = async (payload) => {
    loggedOut.current = false;
    const { data } = await api.post('/auth/social/register', payload);
    if (data?.token) setAuthToken(data.token);
    return await refresh();
  };

  const logout = async () => {
    // نُفرِغ محلياً أوّلاً فلا تعلّق الواجهة على خادمٍ نائم…
    loggedOut.current = true;
    setLoggingOut(true);
    clearAuthToken();
    clearAuthCache();
    clearReadCache();
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
    <AuthContext.Provider value={{ user, store, subscription, loading, loggingOut, login, loginWithCode, register, googleLogin, facebookLogin, socialRegister, logout, refresh, updateProfile, setStore }}>
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

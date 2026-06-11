import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setAuthToken, clearAuthToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
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
    try { await api.post('/auth/logout'); } catch { /* تجاهل */ }
    clearAuthToken();
    setUser(null);
    setStore(null);
    setSubscription(null);
  };

  const updateProfile = async (payload) => {
    const { data } = await api.put('/auth/profile', payload);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, store, subscription, loading, login, loginWithCode, register, logout, refresh, updateProfile, setStore }}>
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

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';

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
    await api.post('/auth/login', { email, password });
    return await refresh();
  };

  // التسجيل لا يُدخِل المستخدم تلقائياً — يعود ويسجّل الدخول بنفسه
  const register = async (payload) => {
    await api.post('/auth/register', payload);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setStore(null);
  };

  const updateProfile = async (payload) => {
    const { data } = await api.put('/auth/profile', payload);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, store, subscription, loading, login, register, logout, refresh, updateProfile, setStore }}>
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

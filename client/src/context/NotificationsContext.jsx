import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/client.js';
import { setAppBadge } from '../utils/badge.js';
import { useAuth } from './AuthContext.jsx';

// ─────────────────────── مركز الإشعارات ───────────────────────
// مصدرٌ واحد لعدد غير المقروء: يغذّي الجرس باللوحة وشارة أيقونة التطبيق
// معاً، فلا يختلف الرقمان أبداً.
//
// يتحدّث من ثلاثة أبواب:
//  • رسالة من الـservice worker لحظة وصول الإشعار (فوريّ، بلا انتظار).
//  • عودة التبويب للمقدّمة (visibilitychange) — بعد إشعارٍ وصل والتطبيق مغلق.
//  • نداءٌ دوريّ هادئ كشبكة أمان لو فشل البابان.

const NotificationsContext = createContext(null);

const POLL_MS = 90 * 1000; // هادئ: الدفع هو الطريق السريع، وهذا احتياط

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const seq = useRef(0); // يتجاهل ردّ نداءٍ قديم سبقه أحدث منه

  // العدد وحده — نداء خفيف
  const refreshCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications/count');
      setUnread(data.unread || 0);
      setAppBadge(data.unread || 0);
    } catch { /* الشبكة — نحاول بالدورة القادمة */ }
  }, [user]);

  // القائمة كاملة (عند فتح الجرس)
  const load = useCallback(async (before = null) => {
    if (!user) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: before ? { before } : {} });
      if (my !== seq.current) return;
      setItems((prev) => (before ? [...prev, ...data.notifications] : data.notifications));
      setHasMore(Boolean(data.hasMore));
      setUnread(data.unread || 0);
      setAppBadge(data.unread || 0);
    } catch { /* تجاهل */ } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [user]);

  const loadMore = useCallback(() => {
    const last = items[items.length - 1];
    if (last) load(last.id);
  }, [items, load]);

  // تعليم مقروء: نحدّث الواجهة فوراً ثم نثبّت من ردّ الخادم — الضغطة
  // يجب أن تُطفئ النقطة الحمراء بلا انتظار دورة شبكة.
  const markRead = useCallback(async (id = null) => {
    setItems((prev) => prev.map((n) => (id == null || n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => (id == null ? 0 : Math.max(0, u - 1)));
    setAppBadge(id == null ? 0 : Math.max(0, unread - 1));
    try {
      const { data } = await api.post('/notifications/read', id == null ? {} : { id });
      setUnread(data.unread || 0);
      setAppBadge(data.unread || 0);
    } catch { /* الرقم المتفائل يبقى لين النداء التالي */ }
  }, [unread]);

  const clearAll = useCallback(async () => {
    setItems([]);
    setUnread(0);
    setAppBadge(0);
    try { await api.delete('/notifications'); } catch { /* تجاهل */ }
  }, []);

  // الأبواب الثلاثة
  useEffect(() => {
    if (!user) { setUnread(0); setItems([]); setAppBadge(0); return undefined; }
    refreshCount();

    const onSwMessage = (e) => {
      if (e.data?.type !== 'bz-notification') return;
      if (typeof e.data.unread === 'number') { setUnread(e.data.unread); setAppBadge(e.data.unread); }
      else refreshCount();
      setItems([]); // القائمة صارت قديمة — تُجلب عند فتح الجرس
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    const onVisible = () => { if (document.visibilityState === 'visible') refreshCount(); };
    document.addEventListener('visibilitychange', onVisible);

    const timer = setInterval(refreshCount, POLL_MS);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [user, refreshCount]);

  return (
    <NotificationsContext.Provider
      value={{ unread, items, loading, hasMore, load, loadMore, markRead, clearAll, refreshCount }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext) || {
    unread: 0, items: [], loading: false, hasMore: false,
    load: () => {}, loadMore: () => {}, markRead: () => {}, clearAll: () => {}, refreshCount: () => {},
  };
}

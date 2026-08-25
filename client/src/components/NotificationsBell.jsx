import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../context/NotificationsContext.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import CloseButton from './CloseButton.jsx';

// ─────────────────────── جرس الإشعارات ───────────────────────
// كان الدفع وحده: يصل الإشعار للهاتف، تمسحه المالكة أو يفوتها وهي نائمة،
// فيضيع الطلب بلا أثر. هذا الجرس هو السجلّ — ورقمه هو نفسه رقم شارة
// أيقونة التطبيق، فما تراه على الأيقونة تجده هنا بالضبط.

const ICONS = {
  order: '🛍️',
  abandoned: '🛒',
  stock: '⚠️',
  shipping: '🚚',
  instagram: '💬',
  stockRequest: '🔔',
  general: '✨',
};

// «قبل ٣ دقائق» بلا مكتبة تواريخ — الدقّة المطلوبة هنا خشنة عمداً
function ago(iso, t) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return t('notifications.now');
  if (m < 60) return t('notifications.minutes', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('notifications.hours', { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t('notifications.days', { n: d });
  return new Date(iso).toLocaleDateString();
}

function BellGlyph({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export default function NotificationsBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unread, items, loading, hasMore, load, loadMore, markRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const prevUnread = useRef(unread);
  const [pulse, setPulse] = useState(false);

  // رنّة بصرية قصيرة عند وصول إشعارٍ جديد والتطبيق مفتوح
  useEffect(() => {
    if (unread > prevUnread.current) {
      prevUnread.current = unread;
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 900);
      return () => clearTimeout(id);
    }
    prevUnread.current = unread;
    return undefined;
  }, [unread]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useScrollLock(open);

  const openItem = (n) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    if (n.url) navigate(n.url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('notifications.title')}
        className={`app-tap relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4EDE2]/10 text-[#F4EDE2] ring-1 ring-[#e6c878]/30 transition hover:bg-[#F4EDE2]/20 ${pulse ? 'bell-swing' : ''}`}
      >
        <BellGlyph className="h-[21px] w-[21px]" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold leading-none text-white shadow-[0_0_0_2px_rgba(0,0,0,0.45)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-start sm:pt-16" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/55 animate-fade-up" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet bz-notif-sheet relative flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl"
          >
            <div className="bz-notif-head flex items-center justify-between gap-2 px-4 py-3">
              <h3 className="bz-notif-title flex items-center gap-2 font-display text-base font-bold">
                <BellGlyph className="h-5 w-5" /> {t('notifications.title')}
                {unread > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">{unread}</span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={() => markRead(null)} className="bz-notif-act app-tap rounded-full px-2.5 py-1 text-[11.5px] font-bold transition">
                    {t('notifications.markAll')}
                  </button>
                )}
                <CloseButton onClick={() => setOpen(false)} variant="wine" className="bz-notif-close" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && items.length === 0 ? (
                <ul className="space-y-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="bz-notif-skel h-16 animate-pulse rounded-2xl" />
                  ))}
                </ul>
              ) : items.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <span className="text-4xl">🔔</span>
                  <p className="bz-notif-title mt-3 text-sm font-bold">{t('notifications.emptyTitle')}</p>
                  <p className="bz-notif-sub mt-1 text-xs">{t('notifications.emptyHint')}</p>
                </div>
              ) : (
                <ul className="bz-notif-list">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => openItem(n)}
                        className={`bz-notif-item app-tap flex w-full items-start gap-3 px-4 py-3 text-start ${n.read ? '' : 'bz-notif-unread'}`}
                      >
                        <span className="bz-notif-ico mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg">
                          {ICONS[n.type] || ICONS.general}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                            <span className={`bz-notif-title truncate text-[13.5px] leading-tight ${n.read ? 'font-semibold' : 'font-extrabold'}`}>
                              {n.title}
                            </span>
                          </span>
                          {n.body && (
                            <span className="bz-notif-sub mt-0.5 line-clamp-2 block text-[12px] leading-snug">{n.body}</span>
                          )}
                          <span className="bz-notif-time mt-1 block text-[10.5px] font-semibold">{ago(n.createdAt, t)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {hasMore && (
                <div className="p-3">
                  <button onClick={loadMore} disabled={loading} className="bz-notif-more app-tap w-full rounded-xl py-2.5 text-[12.5px] font-bold transition disabled:opacity-50">
                    {loading ? t('common.loading') : t('notifications.more')}
                  </button>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="bz-notif-foot px-4 py-2.5">
                <button onClick={clearAll} className="app-tap text-[11.5px] font-bold text-red-500/80 transition hover:text-red-500">
                  {t('notifications.clearAll')}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

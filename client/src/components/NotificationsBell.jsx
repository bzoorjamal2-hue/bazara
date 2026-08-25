import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../context/NotificationsContext.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import CloseButton from './CloseButton.jsx';
import { BagIcon, CartIcon, WarnIcon, TruckIcon, InstagramIcon, BellIcon, SparkleIcon } from './icons.jsx';

// ─────────────────────── جرس الإشعارات ───────────────────────
// كان الدفع وحده: يصل الإشعار للهاتف، تمسحه المالكة أو يفوتها وهي نائمة،
// فيضيع الطلب بلا أثر. هذا الجرس هو السجلّ — ورقمه هو نفسه رقم شارة
// أيقونة التطبيق، فما تراه على الأيقونة تجده هنا بالضبط.

// لكلّ نوعٍ أيقونته ولونه. كانت إيموجي: تختلف رسمتها بين أندرويد وiOS
// وويندوز، وتبدو دخيلةً وسط أيقونات الموقع المرسومة كلّها بخطٍّ واحد.
const TYPES = {
  order: { Icon: BagIcon, tone: 'gold' },
  abandoned: { Icon: CartIcon, tone: 'amber' },
  stock: { Icon: WarnIcon, tone: 'red' },
  shipping: { Icon: TruckIcon, tone: 'teal' },
  instagram: { Icon: InstagramIcon, tone: 'pink' },
  stockRequest: { Icon: BellIcon, tone: 'violet' },
  general: { Icon: SparkleIcon, tone: 'gold' },
};
const typeOf = (k) => TYPES[k] || TYPES.general;

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

// اليوم / أمس / أقدم — عناوين تفصل الطازج عمّا مضى، بدل قائمةٍ متّصلة
// لا يُعرف أين ينتهي اليوم فيها.
function dayBucket(iso) {
  const d = new Date(iso).getTime();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d >= startOfToday) return 'today';
  if (d >= startOfToday - 86400000) return 'yesterday';
  return 'older';
}

export default function NotificationsBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unread, items, loading, hasMore, load, loadMore, markRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const prevUnread = useRef(unread);
  const [pulse, setPulse] = useState(false);

  // رنّة بصرية عند وصول إشعارٍ جديد والتطبيق مفتوح
  useEffect(() => {
    if (unread > prevUnread.current) {
      prevUnread.current = unread;
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 1400);
      return () => clearTimeout(id);
    }
    prevUnread.current = unread;
    return undefined;
  }, [unread]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useScrollLock(open);

  // إغلاق بـEsc — النافذة تغطّي الشاشة على الجوال
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const shown = useMemo(
    () => (onlyUnread ? items.filter((n) => !n.read) : items),
    [items, onlyUnread]
  );

  // التجميع للعرض فقط — ترتيب الخادم (الأحدث أولاً) يبقى كما هو
  const groups = useMemo(() => {
    const out = [];
    let last = null;
    for (const n of shown) {
      const b = dayBucket(n.createdAt);
      if (b !== last) { out.push({ bucket: b, rows: [] }); last = b; }
      out[out.length - 1].rows.push(n);
    }
    return out;
  }, [shown]);

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
        className={`bz-bell app-tap ${unread > 0 ? 'bz-bell-on' : ''} ${pulse ? 'bz-bell-ring' : ''}`}
      >
        {/* هالة تتمدّد وتخفت عند وصول إشعار — تلفت النظر ثم تختفي */}
        {pulse && <span className="bz-bell-halo" aria-hidden="true" />}
        <BellIcon className="h-[21px] w-[21px]" />
        {unread > 0 && <span className="bz-bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-start sm:pt-16" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/55 animate-fade-up" />
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t('notifications.title')}
            className="animate-sheet bz-notif-sheet relative flex max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl"
          >
            {/* مقبض السحب — إشارة «هذه ورقة تُسحب» على الجوال */}
            <span className="bz-notif-grip" aria-hidden="true" />

            <div className="bz-notif-head px-4 pb-3 pt-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="bz-notif-title flex items-center gap-2.5 font-display text-[17px] font-extrabold">
                  <span className="bz-notif-headico flex h-9 w-9 items-center justify-center rounded-2xl">
                    <BellIcon className="h-[19px] w-[19px]" />
                  </span>
                  {t('notifications.title')}
                </h3>
                <CloseButton onClick={() => setOpen(false)} variant="wine" className="bz-notif-close" />
              </div>

              {/* مرشّح + إجراء بصفٍّ واحد، بدل أزرارٍ متناثرة بالرأس */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="bz-seg" role="tablist">
                  <button
                    role="tab"
                    aria-selected={!onlyUnread}
                    onClick={() => setOnlyUnread(false)}
                    className={`bz-seg-btn app-tap ${!onlyUnread ? 'bz-seg-on' : ''}`}
                  >
                    {t('notifications.all')}
                  </button>
                  <button
                    role="tab"
                    aria-selected={onlyUnread}
                    onClick={() => setOnlyUnread(true)}
                    className={`bz-seg-btn app-tap ${onlyUnread ? 'bz-seg-on' : ''}`}
                  >
                    {t('notifications.unread')}
                    {unread > 0 && <span className="bz-seg-count">{unread > 99 ? '99+' : unread}</span>}
                  </button>
                </div>
                {unread > 0 && (
                  <button onClick={() => markRead(null)} className="bz-notif-act app-tap shrink-0 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold">
                    {t('notifications.markAll')}
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && items.length === 0 ? (
                <ul className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i} className="bz-notif-skel h-[68px] animate-pulse rounded-2xl" />
                  ))}
                </ul>
              ) : shown.length === 0 ? (
                <div className="px-8 py-12 text-center">
                  <span className="bz-notif-empty mx-auto flex h-20 w-20 items-center justify-center rounded-full">
                    <BellIcon className="h-9 w-9" />
                  </span>
                  <p className="bz-notif-title mt-4 text-[15px] font-extrabold">
                    {onlyUnread ? t('notifications.emptyUnread') : t('notifications.emptyTitle')}
                  </p>
                  <p className="bz-notif-sub mx-auto mt-1.5 max-w-[17rem] text-[12.5px] leading-relaxed">
                    {onlyUnread ? t('notifications.emptyUnreadHint') : t('notifications.emptyHint')}
                  </p>
                </div>
              ) : (
                groups.map((g) => (
                  <section key={g.bucket}>
                    <h4 className="bz-notif-day px-4 pb-1.5 pt-3 text-[11px] font-extrabold">
                      {t(`notifications.${g.bucket}`)}
                    </h4>
                    <ul className="bz-notif-list">
                      {g.rows.map((n, i) => {
                        const { Icon, tone } = typeOf(n.type);
                        return (
                          <li key={n.id} className="bz-notif-in" style={{ animationDelay: `${Math.min(i, 7) * 32}ms` }}>
                            <button
                              onClick={() => openItem(n)}
                              className={`bz-notif-item app-tap flex w-full items-start gap-3 px-4 py-3 text-start ${n.read ? '' : 'bz-notif-unread'}`}
                            >
                              <span className={`bz-notif-ico bz-tone-${tone} mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl`}>
                                <Icon className="h-[19px] w-[19px]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`bz-notif-title block truncate text-[13.5px] leading-tight ${n.read ? 'font-semibold' : 'font-extrabold'}`}>
                                  {n.title}
                                </span>
                                {n.body && (
                                  <span className="bz-notif-sub mt-0.5 line-clamp-2 block text-[12px] leading-snug">{n.body}</span>
                                )}
                                <span className="bz-notif-time mt-1.5 block text-[10.5px] font-bold">{ago(n.createdAt, t)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}

              {hasMore && !onlyUnread && (
                <div className="p-3">
                  <button onClick={loadMore} disabled={loading} className="bz-notif-more app-tap w-full rounded-2xl py-2.5 text-[12.5px] font-bold disabled:opacity-50">
                    {loading ? t('common.loading') : t('notifications.more')}
                  </button>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="bz-notif-foot flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="bz-notif-time text-[11px] font-bold">{t('notifications.total', { n: items.length })}</span>
                <button onClick={clearAll} className="bz-notif-clear app-tap rounded-full px-2.5 py-1 text-[11.5px] font-bold">
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

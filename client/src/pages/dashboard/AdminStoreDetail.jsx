import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import useScrollLock from '../../hooks/useScrollLock.js';
import { SectionHead, Tip } from '../../components/FormField.jsx';
import {
  XIcon, StoreIcon, BagIcon, ReceiptIcon, ChartIcon, CrownIcon,
  MailIcon, LinkIcon, StarIcon, WarnIcon, ClockIcon,
} from '../../components/icons.jsx';

// حالات الطلب بألوان صريحة تُقرأ في الوضعين — أصناف الألوان الشفّافة تهبط
// تحت عتبة القراءة فوق الخلفية الفاتحة.
const STATUS_TONE = {
  new: '#92400e',
  confirmed: '#047857',
  shipped: '#1d4ed8',
  delivered: '#047857',
  cancelled: '#b91c1c',
};

// كل ما يخصّ متجراً واحداً في مكان واحد: مالكه واشتراكه وحجمه وطلباته
// الأخيرة وأكثر ما يبيع. كان المدير يقرّر التفعيل والإيقاف والحذف وهو لا يرى
// من المتجر إلا اسمه، فأيّ قرار كان تخميناً.
export default function AdminStoreDetail({ slug, onClose }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useScrollLock(true);

  useEffect(() => {
    let alive = true;
    api.get(`/subscription/store/${encodeURIComponent(slug)}`)
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => { if (alive) setError(getErrorMessage(e)); });
    return () => { alive = false; };
  }, [slug]);

  // Escape يُغلق — النافذة طويلة ولا يصحّ أن يكون المخرج الوحيد زرّاً بالأعلى
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cur = t('common.currency');
  const money = (n) => `${cur}${Math.round(Number(n || 0)).toLocaleString()}`;
  const date = (d) => (d ? new Date(d).toLocaleDateString(i18n.language) : '—');

  const target = (typeof document !== 'undefined' && (document.querySelector('.theme-pub') || document.body)) || null;
  if (!target) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="glass-strong flex max-h-[92vh] w-full max-w-2xl animate-fade-up flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* رأس لاصق: النافذة تُمرَّر طويلاً ولا يصحّ أن يختفي الإغلاق */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gold-400/15 px-4 py-3.5 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500 text-white shadow-md">
            {data?.store?.logoUrl
              ? <img src={data.store.logoUrl} alt="" className="h-full w-full object-cover" />
              : <StoreIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="gradient-text truncate font-display text-lg font-bold leading-tight">
              {data?.store?.name || t('admin.storeDetail')}
            </h2>
            {data && <p className="mt-0.5 truncate text-[11px] text-stone-400">{data.owner.name} · {data.owner.email}</p>}
          </div>
          <button
            type="button" onClick={onClose}
            aria-label={t('common.close') || 'إغلاق'} title={t('common.close') || 'إغلاق'}
            className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:bg-white/5 hover:text-gold-200"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
          {!data && !error && <Spinner />}

          {data && (
            <>
              {/* الاشتراك — أوّل ما يبحث عنه المدير */}
              <div className="dash-section glass space-y-3 p-4">
                <SectionHead icon={<CrownIcon className="h-5 w-5" />} title={t('admin.subscription')} desc={t('admin.subscriptionDesc')} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Cell label={t('admin.status')}>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-cream"
                      style={{ background: data.owner.active ? '#047857' : '#b91c1c' }}
                    >
                      {data.owner.active ? t('admin.statusActive') : t('admin.statusLocked')}
                    </span>
                  </Cell>
                  <Cell label={t('admin.plan')}>{data.owner.plan ? t(`subscription.${data.owner.plan}`, data.owner.plan) : '—'}</Cell>
                  <Cell label={t('admin.expiresAt')} tip={t('admin.expiresTip')}>
                    {data.owner.isAdmin ? t('admin.lifetime') : date(data.owner.currentPeriodEnd)}
                  </Cell>
                  <Cell label={t('admin.joinedAt')}>{date(data.owner.joinedAt)}</Cell>
                  <Cell label={t('admin.storeCreated')}>{date(data.store.createdAt)}</Cell>
                  <Cell label={t('admin.featuredLabel')} tip={t('admin.featuredTip')}>
                    {data.store.featured
                      ? <span className="inline-flex items-center gap-1 text-gold-300"><StarIcon className="h-3.5 w-3.5" /> {t('common.yes')}</span>
                      : t('common.no')}
                  </Cell>
                </div>
              </div>

              {/* الحجم والنشاط */}
              <div className="dash-section glass space-y-3 p-4">
                <SectionHead icon={<ChartIcon className="h-5 w-5" />} title={t('admin.sizeActivity')} desc={t('admin.sizeActivityDesc')} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric Icon={BagIcon} label={t('admin.ov.products')} value={data.products.total} />
                  <Metric Icon={ReceiptIcon} label={t('admin.ov.orders')} value={data.orders.total} />
                  <Metric Icon={ChartIcon} label={t('admin.ov.gmv')} value={money(data.orders.gmv)} tip={t('admin.gmvTip')} />
                  <Metric Icon={ClockIcon} label={t('admin.lastOrder')} value={date(data.orders.lastOrderAt)} tip={t('admin.lastOrderTip')} />
                </div>

                {/* إشارات تعثّر: لا تظهر إن لم توجد، فلا تُقلق بلا سبب */}
                {(data.products.total === 0 || data.orders.pending > 0 || data.products.outOfStock > 0) && (
                  <div className="space-y-1.5">
                    {data.products.total === 0 && <Flag tone="#92400e" text={t('admin.flagNoProducts')} />}
                    {data.orders.pending > 0 && <Flag tone="#92400e" text={t('admin.flagPending', { count: data.orders.pending })} />}
                    {data.products.outOfStock > 0 && <Flag tone="#57534e" text={t('admin.flagOutOfStock', { count: data.products.outOfStock })} />}
                  </div>
                )}
              </div>

              {/* آخر الطلبات */}
              {data.recentOrders.length > 0 && (
                <div className="dash-section glass space-y-3 p-4">
                  <SectionHead icon={<ReceiptIcon className="h-5 w-5" />} title={t('admin.recentOrders')} desc={t('admin.recentOrdersDesc')} />
                  <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-gold-400/15 bg-black/20">
                    {data.recentOrders.map((o) => (
                      <div key={o.id} className="flex items-center gap-2.5 p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-100">{o.customerName || t('finance.noName')}</p>
                          <p className="mt-0.5 truncate text-[11px] text-stone-400">{o.reference || '—'} · {date(o.createdAt)}</p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-cream"
                          style={{ background: STATUS_TONE[o.status] || '#57534e' }}
                        >
                          {t(`dashboard.ordersSection.${o.status}`, o.status)}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-gold-300">{money(o.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* الأكثر مبيعاً */}
              {data.topProducts.length > 0 && (
                <div className="dash-section glass space-y-3 p-4">
                  <SectionHead icon={<BagIcon className="h-5 w-5" />} title={t('admin.topProducts')} desc={t('admin.topProductsDesc')} />
                  <div className="space-y-1.5">
                    {data.topProducts.map((p, i) => (
                      <div key={`${p.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-gold-400/12 bg-black/15 px-2.5 py-1.5">
                        <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-stone-400">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-stone-100">{p.name}</span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-stone-200">{t('admin.soldQty', { count: p.qty })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* روابط سريعة */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={`${window.location.origin}/store/${data.store.slug}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gold-400/30 px-3 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400/10"
                >
                  <LinkIcon className="h-4 w-4" /> {t('nav.openStore')}
                </a>
                <a
                  href={`mailto:${data.owner.email}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gold-400/30 px-3 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400/10"
                >
                  <MailIcon className="h-4 w-4" /> {t('admin.emailOwner')}
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    target,
  );
}

// خانة معلومة صغيرة
function Cell({ label, tip, children }) {
  return (
    <div className="rounded-xl border border-gold-400/15 bg-black/20 p-2.5">
      <p className="flex items-center gap-1 text-[10px] font-medium text-stone-400">{label} <Tip text={tip} /></p>
      <div className="mt-1 truncate text-sm font-semibold text-stone-100">{children}</div>
    </div>
  );
}

// رقم بارز بأيقونته
function Metric({ Icon, label, value, tip }) {
  return (
    <div className="rounded-xl border border-gold-400/15 bg-black/20 p-2.5 text-center">
      <Icon className="mx-auto h-4 w-4 text-stone-400" />
      <p className="mt-1 truncate font-display text-base font-extrabold tabular-nums text-stone-100">{value}</p>
      <p className="flex items-center justify-center gap-1 text-[10px] text-stone-400">{label} <Tip text={tip} /></p>
    </div>
  );
}

// إشارة تعثّر — لون صريح يُقرأ في الوضعين
function Flag({ tone, text }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-cream" style={{ background: tone }}>
      <WarnIcon className="mt-px h-3.5 w-3.5 shrink-0" /> {text}
    </p>
  );
}

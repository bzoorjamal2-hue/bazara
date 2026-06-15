import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

const ic = (p) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p });
const I = {
  // محفظة/إيراد
  revenue: (c) => (<svg {...ic({ className: c })}><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5V9" /><rect x="3" y="9" width="18" height="10.5" rx="2.2" /><path d="M16.5 14.25h.01" /></svg>),
  // طلب مؤكَّد
  confirmed: (c) => (<svg {...ic({ className: c })}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4L16 9.5" /></svg>),
  // طلب جديد (إيصال)
  newOrders: (c) => (<svg {...ic({ className: c })}><path d="M6 3h9l4 4v13.2a.8.8 0 0 1-1.2.7L16 20l-1.8 1-1.8-1-1.8 1-1.8-1-1.8.9A.8.8 0 0 1 6 20.2Z" /><path d="M14 3v4h4" /><path d="M9.5 12h6M9.5 15h4" /></svg>),
  // منتجات (صندوق)
  products: (c) => (<svg {...ic({ className: c })}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" /><path d="m3.5 7.5 8.5 4.5 8.5-4.5" /><path d="M12 21v-9" /></svg>),
};

// بطاقة إحصاء عصرية: بلاطة أيقونة متدرّجة + رقم بارز + لمعة ناعمة بالخلفية
function StatCard({ label, value, accent = 'text-gold-300', grad = 'from-gold-400 to-amber-500', icon }) {
  const Icon = I[icon];
  return (
    <div className="glass relative overflow-hidden p-5">
      {/* وهج ناعم بزاوية البطاقة */}
      <span aria-hidden className={`pointer-events-none absolute -end-6 -top-8 h-20 w-20 rounded-full bg-gradient-to-br ${grad} opacity-15 blur-2xl`} />
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${grad}`}>
        {Icon && Icon('h-[22px] w-[22px]')}
      </span>
      <p className="mt-3 text-xs font-medium text-stone-400">{label}</p>
      <p className={`mt-1 font-display text-3xl font-extrabold leading-tight ${accent}`}>{value}</p>
    </div>
  );
}

export default function AnalyticsManager() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/orders/stats').then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (error) return <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>;
  if (!data) return <Spinner />;

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.orders));
  const maxTop = Math.max(1, ...data.topProducts.map((p) => p.qty));
  const cur = t('common.currency');
  const dayName = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(i18n.language === 'en' ? 'en' : 'ar', { weekday: 'short' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold gradient-text">📊 {t('dashboard.analytics.title')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('dashboard.analytics.hint')}</p>
      </div>

      {/* البطاقات الرئيسية */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="revenue" grad="from-emerald-400 to-teal-500" accent="text-emerald-300" label={t('dashboard.analytics.revenue')} value={`${cur}${data.revenue.toFixed(0)}`} />
        <StatCard icon="confirmed" grad="from-gold-400 to-amber-500" accent="text-gold-300" label={t('dashboard.analytics.confirmed')} value={data.confirmedOrders} />
        <StatCard icon="newOrders" grad="from-sky-400 to-indigo-500" accent="text-sky-300" label={t('dashboard.analytics.newOrders')} value={data.newOrders} />
        <StatCard icon="products" grad="from-wine to-rose-700" accent="text-stone-100" label={t('dashboard.productsCount')} value={data.productsCount} />
      </div>

      {/* نشاط آخر 7 أيام */}
      <div className="glass p-5">
        <h2 className="mb-4 font-display text-lg font-bold text-stone-100">{t('dashboard.analytics.last7')}</h2>
        {data.totalOrders === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">{t('dashboard.analytics.empty')}</p>
        ) : (
          <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
            {data.daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-bold text-gold-200">{d.orders || ''}</span>
                <div
                  className="w-full max-w-[34px] rounded-t-lg bg-gradient-to-t from-wine to-gold-400/70 transition-all"
                  style={{ height: `${(d.orders / maxDaily) * 100}%`, minHeight: d.orders ? 6 : 2 }}
                  title={`${d.orders}`}
                />
                <span className="text-[10px] text-stone-400">{dayName(d.day)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* الأكثر مبيعاً */}
      <div className="glass p-5">
        <h2 className="mb-4 font-display text-lg font-bold text-stone-100">🏆 {t('dashboard.analytics.topProducts')}</h2>
        {data.topProducts.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">{t('dashboard.analytics.noSales')}</p>
        ) : (
          <div className="space-y-3">
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center text-sm font-bold text-gold-300">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-stone-200">{p.name}</span>
                    <span className="shrink-0 text-xs font-bold text-gold-200">{p.qty}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-wine" style={{ width: `${(p.qty / maxTop) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

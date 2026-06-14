import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

const ic = (p) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p });
const I = {
  revenue: (c) => (<svg {...ic({ className: c })}><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>),
  confirmed: (c) => (<svg {...ic({ className: c })}><path d="M21 11.5V12a9 9 0 1 1-5.3-8.2" /><path d="m9 11 3 3L22 4" /></svg>),
  newOrders: (c) => (<svg {...ic({ className: c })}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M12 11v5M9.5 13.5h5" /></svg>),
  products: (c) => (<svg {...ic({ className: c })}><path d="M16 8.5 8 4 3.3 6.6 12 11.6l8.7-5L16 8.5Z" /><path d="M3.3 6.6V17l8.7 5 8.7-5V6.6" /><path d="M12 11.6V22" /></svg>),
};

function StatCard({ label, value, accent = 'text-gold-300', tint = 'bg-gold-400/10 text-gold-300', icon }) {
  const Icon = I[icon];
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>{Icon && Icon('h-5 w-5')}</span>
        <p className="text-sm text-stone-400">{label}</p>
      </div>
      <p className={`mt-3 font-display text-3xl font-extrabold ${accent}`}>{value}</p>
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
        <StatCard icon="revenue" tint="bg-emerald-500/15 text-emerald-300" accent="text-emerald-300" label={t('dashboard.analytics.revenue')} value={`${cur}${data.revenue.toFixed(0)}`} />
        <StatCard icon="confirmed" tint="bg-gold-400/15 text-gold-300" accent="text-gold-300" label={t('dashboard.analytics.confirmed')} value={data.confirmedOrders} />
        <StatCard icon="newOrders" tint="bg-sky-500/15 text-sky-300" accent="text-sky-300" label={t('dashboard.analytics.newOrders')} value={data.newOrders} />
        <StatCard icon="products" tint="bg-wine/15 text-wine" accent="text-stone-100" label={t('dashboard.productsCount')} value={data.productsCount} />
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

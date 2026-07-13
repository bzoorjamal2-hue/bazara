import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { ChartIcon, WarnIcon, TrophyIcon } from '../../components/icons.jsx';

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

// بطاقة إحصاء عصرية: بلاطة أيقونة متدرّجة + رقم بارز.
// (أُزيل الوهج الزخرفي: كان يتسرّب خارج زاوية البطاقة على iOS — منظر مقزّز.)
function StatCard({ label, value, accent = 'text-gold-300', grad = 'from-gold-400 to-amber-500', icon }) {
  const Icon = I[icon];
  return (
    <div className="glass overflow-hidden p-5">
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
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text"><ChartIcon className="h-6 w-6" /> {t('dashboard.analytics.title')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('dashboard.analytics.hint')}</p>
      </div>

      {/* البطاقات الرئيسية */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="revenue" grad="from-emerald-500 to-emerald-700" accent="text-emerald-300" label={t('dashboard.analytics.revenue')} value={`${cur}${data.revenue.toFixed(0)}`} />
        <StatCard icon="confirmed" grad="from-gold-400 to-amber-500" accent="text-gold-300" label={t('dashboard.analytics.confirmed')} value={data.confirmedOrders} />
        <StatCard icon="newOrders" grad="from-amber-400 to-amber-600" accent="text-amber-700" label={t('dashboard.analytics.newOrders')} value={data.newOrders} />
        <StatCard icon="products" grad="from-wine to-wine-dark" accent="text-stone-100" label={t('dashboard.productsCount')} value={data.productsCount} />
      </div>

      {/* لوحة النمو: قمع التحويل الحقيقي — أين يتسرّب الزبائن قبل الشراء */}
      {data.funnel && data.funnel.visitors > 0 && (
        <div className="glass p-5">
          <h2 className="mb-1 flex items-center gap-1.5 font-display text-lg font-bold text-stone-100">📈 {t('dashboard.analytics.funnelTitle')}</h2>
          <p className="mb-4 text-xs text-stone-400">{t('dashboard.analytics.funnelHint')}</p>
          {(() => {
            const f = data.funnel;
            const steps = [
              { key: 'visitors', value: f.visitors, grad: 'from-[#8a6a4f] to-[#5e4636]' },
              { key: 'startedCheckout', value: f.startedCheckout, grad: 'from-amber-400 to-orange-500' },
              { key: 'orders', value: f.orders, grad: 'from-gold-400 to-amber-500' },
              { key: 'delivered', value: f.delivered, grad: 'from-emerald-500 to-emerald-700' },
            ];
            const max = Math.max(1, f.visitors);
            const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
            return (
              <div className="space-y-2.5">
                {steps.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-semibold text-stone-300 sm:w-28">{t(`dashboard.analytics.funnel.${s.key}`)}</span>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-white/5">
                      <div className={`flex h-full items-center rounded-lg bg-gradient-to-r ${s.grad} px-2`} style={{ width: `${Math.max(6, (s.value / max) * 100)}%` }}>
                        <span className="text-xs font-bold text-white drop-shadow">{s.value}</span>
                      </div>
                    </div>
                    {/* نسبة التحويل من الخطوة السابقة */}
                    {i > 0 && <span className="w-12 shrink-0 text-end text-[11px] font-bold text-stone-400">{pct(s.value, steps[i - 1].value)}%</span>}
                    {i === 0 && <span className="w-12 shrink-0" />}
                  </div>
                ))}
                {/* الخلاصة الذهبية: معدّل التحويل الكلي (زائر → طلب) */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gold-400/10 px-4 py-3 ring-1 ring-gold-400/20">
                  <span className="text-sm font-semibold text-stone-200">{t('dashboard.analytics.convRate')}</span>
                  <span className="font-display text-2xl font-extrabold text-gold-300">{pct(f.orders, f.visitors)}%</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* فرصة ضائعة: سلات متروكة بقيمة ₪ — رابط سريع لمتابعتها */}
      {data.abandonedCount > 0 && (
        <div className="glass flex flex-wrap items-center justify-between gap-3 border border-amber-400/25 p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100">🛒 {t('dashboard.analytics.abandonedTitle')}</h2>
            <p className="mt-0.5 text-xs text-stone-400">{t('dashboard.analytics.abandonedHint', { count: data.abandonedCount })}</p>
          </div>
          <span className="font-display text-2xl font-extrabold text-amber-300">{cur}{data.abandonedValue.toFixed(0)}</span>
        </div>
      )}

      {/* قاربت على النفاد — تنبيه لإعادة التوفير */}
      {data.lowStock?.length > 0 && (
        <div className="glass border border-amber-400/25 p-5">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><WarnIcon className="h-5 w-5" /> {t('dashboard.analytics.lowStock')}</h2>
          <p className="mb-3 mt-0.5 text-xs text-stone-400">{t('dashboard.analytics.lowStockHint')}</p>
          <div className="flex flex-wrap gap-2">
            {data.lowStock.map((p) => (
              <span
                key={p.id}
                className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ${
                  p.remaining <= 0 ? 'bg-red-500/15 text-red-300 ring-red-500/30' : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
                }`}
              >
                <span className="min-w-0 truncate font-medium text-stone-100">{p.name}</span>
                <span className="shrink-0 font-bold">
                  {p.remaining <= 0 ? t('dashboard.analytics.soldOut') : t('dashboard.analytics.remaining', { count: p.remaining })}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* تقرير التحصيل الشهري حسب شركة التوصيل — لمطابقة مبالغ الدفع عند الاستلام */}
      {data.courierMonth?.length > 0 && (
        <div className="glass p-5">
          <h2 className="mb-1 font-display text-lg font-bold text-stone-100">💰 {t('dashboard.analytics.courierMonth')}</h2>
          <p className="mb-4 text-xs text-stone-400">{t('dashboard.analytics.courierMonthHint')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.courierMonth.map((c) => (
              <div key={c.courier} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-100">{t(`dashboard.analytics.courierNames.${c.courier}`)}</p>
                  <p className="text-xs text-stone-400">{t('dashboard.analytics.courierOrders', { count: c.orders })}</p>
                </div>
                <span className="shrink-0 font-display text-xl font-extrabold text-emerald-300">{t('common.currency')}{c.amount.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <h2 className="mb-4 flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><TrophyIcon className="h-5 w-5" /> {t('dashboard.analytics.topProducts')}</h2>
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

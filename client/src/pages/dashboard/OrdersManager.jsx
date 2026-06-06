import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

export default function OrdersManager() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/orders/mine').then((r) => setOrders(r.data.orders)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (orders === null && !error) return <Spinner />;

  const badge = (s) => {
    const map = { paid: 'bg-emerald-500/20 text-emerald-200', pending: 'bg-orange-500/20 text-orange-200', failed: 'bg-red-500/20 text-red-200' };
    return <span className={`badge ${map[s] || ''}`}>{t(`dashboard.ordersSection.${s}`)}</span>;
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.ordersSection.title')}</h1>
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {orders && orders.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.ordersSection.empty')}</div>
      ) : (
        <div className="space-y-3">
          {orders?.map((o) => (
            <div key={o.id} className="glass p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold text-stone-100">{o.customerName || '—'}</span>
                  <span className="ms-2 text-xs text-stone-400" dir="ltr">{o.customerEmail} {o.customerPhone}</span>
                </div>
                {badge(o.status)}
              </div>
              <p className="mt-2 text-sm text-stone-300">
                {(o.items || []).map((it) => `${it.name} ×${it.qty}`).join(' · ')}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-stone-500">{new Date(o.createdAt).toLocaleString()}</span>
                <span className="font-display font-bold text-gold-300">{t('common.currency')}{o.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

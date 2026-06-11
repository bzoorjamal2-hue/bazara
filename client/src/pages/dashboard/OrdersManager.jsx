import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { buildWhatsappLink } from '../../utils/whatsapp.js';

const FLOW = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const BADGE = {
  new: 'bg-sky-500/20 text-sky-200',
  confirmed: 'bg-gold-400/20 text-gold-200',
  shipped: 'bg-indigo-500/20 text-indigo-200',
  delivered: 'bg-emerald-500/20 text-emerald-200',
  cancelled: 'bg-red-500/20 text-red-200',
  paid: 'bg-emerald-500/20 text-emerald-200',
  pending: 'bg-orange-500/20 text-orange-200',
  failed: 'bg-red-500/20 text-red-200',
};

export default function OrdersManager() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    api.get('/orders/mine').then((r) => setOrders(r.data.orders)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  const setStatus = async (id, status) => {
    setSavingId(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o))); // تفاؤلي
    try {
      await api.patch(`/orders/${id}/status`, { status });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingId('');
    }
  };

  if (orders === null && !error) return <Spinner />;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.ordersSection.title')}</h1>
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {orders && orders.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.ordersSection.empty')}</div>
      ) : (
        <div className="space-y-3">
          {orders?.map((o) => {
            const subtotal = (o.total - (o.deliveryFee || 0)).toFixed(2);
            const wa = o.customerPhone ? buildWhatsappLink(o.customerPhone) : '';
            return (
              <div key={o.id} className="glass p-4">
                {/* رأس: الزبون + الحالة */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-stone-100">{o.customerName || '—'}</span>
                    {o.customerPhone && <span className="ms-2 text-xs text-stone-400" dir="ltr">{o.customerPhone}</span>}
                  </div>
                  <span className={`badge ${BADGE[o.status] || ''}`}>{t(`dashboard.ordersSection.${o.status}`)}</span>
                </div>

                {/* المنتجات (مع المقاس/اللون) */}
                <ul className="mt-2 space-y-0.5 text-sm text-stone-300">
                  {(o.items || []).map((it, i) => (
                    <li key={i}>
                      • {it.name}{it.size ? ` (${it.size})` : ''}{it.color ? ` - ${it.color}` : ''} ×{it.qty}
                      <span className="text-stone-500"> — {t('common.currency')}{(it.price * it.qty).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                {/* التوصيل */}
                {(o.city || o.address) && (
                  <p className="mt-2 text-xs text-stone-400">
                    📍 {t('dashboard.ordersSection.deliveryTo')}: <span className="text-stone-200">{o.city}</span>
                    {o.address ? <span className="text-stone-300"> — {o.address}</span> : null}
                  </p>
                )}
                {o.notes && <p className="mt-1 text-xs text-stone-400">📝 {o.notes}</p>}

                {/* المبالغ */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-sm">
                  <span className="text-xs text-stone-500">{new Date(o.createdAt).toLocaleString()}</span>
                  <div className="flex items-center gap-3 text-stone-400">
                    <span>{t('dashboard.ordersSection.subtotal')}: {t('common.currency')}{subtotal}</span>
                    <span>{t('dashboard.ordersSection.delivery')}: {t('common.currency')}{(o.deliveryFee || 0).toFixed(2)}</span>
                    <span className="font-display text-base font-bold text-gold-300">{t('common.currency')}{o.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* تحديث الحالة + تواصل */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-stone-400">{t('dashboard.ordersSection.updateStatus')}:</span>
                  <div className="min-w-[140px]">
                    <Select
                      value={FLOW.includes(o.status) ? o.status : 'new'}
                      onChange={(v) => setStatus(o.id, v)}
                      options={FLOW.map((s) => ({ value: s, label: t(`dashboard.ordersSection.${s}`) }))}
                    />
                  </div>
                  {savingId === o.id && <span className="text-xs text-stone-500">…</span>}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp !px-3 !py-1.5 text-xs">💬 {t('dashboard.ordersSection.contactWhatsapp')}</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

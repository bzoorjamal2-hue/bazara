import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { buildWhatsappLink } from '../../utils/whatsapp.js';
import { useAuth } from '../../context/AuthContext.jsx';

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
  const { store } = useAuth();
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

  // إرسال الطلب لشركة التوصيل عبر واتساب برسالة جاهزة (الزبونة + العنوان + الإجمالي COD)
  const sendToDelivery = (o) => {
    if (!store?.deliveryPhone) return;
    const cur = t('common.currency');
    const items = (o.items || []).map((it) => `• ${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`).join('\n');
    const msg = [
      `🚚 طلب توصيل — ${store.name || ''}`,
      `الزبونة: ${o.customerName || ''}`,
      `الهاتف: ${o.customerPhone || ''}`,
      o.city ? `المدينة: ${o.city}` : '',
      o.address ? `العنوان: ${o.address}` : '',
      '',
      items,
      '',
      `الإجمالي: ${cur}${Number(o.total).toFixed(2)} (الدفع عند الاستلام)`,
      o.notes ? `ملاحظات: ${o.notes}` : '',
    ].filter(Boolean).join('\n');
    window.open(buildWhatsappLink(store.deliveryPhone, msg), '_blank');
  };

  // تصدير الطلبات لملف CSV يفتح في Excel (BOM لدعم العربية) — بناء من البيانات مباشرة بلا خادم
  const exportCsv = () => {
    if (!orders?.length) return;
    const o2 = (k) => t(`dashboard.ordersSection.${k}`);
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [o2('date'), o2('customer'), o2('phone'), o2('deliveryTo'), o2('address'), o2('items'), o2('subtotal'), o2('discount'), o2('coupon'), o2('delivery'), o2('total'), o2('status')];
    const rows = orders.map((o) => [
      new Date(o.createdAt).toLocaleString(),
      o.customerName || '',
      o.customerPhone || '',
      o.city || '',
      o.address || '',
      (o.items || []).map((it) => `${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} x${it.qty}`).join(' | '),
      (o.total - (o.deliveryFee || 0) + (o.discount || 0)).toFixed(2),
      (o.discount || 0).toFixed(2),
      o.couponCode || '',
      (o.deliveryFee || 0).toFixed(2),
      o.total.toFixed(2),
      o2(o.status),
    ]);
    const csv = '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bazara-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (orders === null && !error) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.ordersSection.title')}</h1>
          <p className="mt-1 text-sm text-stone-400">{t('dashboard.ordersSection.stockHint')}</p>
        </div>
        {orders?.length > 0 && (
          <button
            onClick={exportCsv}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gold-400/30 px-3 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
            </svg>
            {t('dashboard.ordersSection.export')}
          </button>
        )}
      </div>
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {orders && orders.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.ordersSection.empty')}</div>
      ) : (
        <div className="space-y-3">
          {orders?.map((o) => {
            const subtotal = (o.total - (o.deliveryFee || 0) + (o.discount || 0)).toFixed(2);
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
                  <div className="flex flex-wrap items-center gap-3 text-stone-400">
                    <span>{t('dashboard.ordersSection.subtotal')}: {t('common.currency')}{subtotal}</span>
                    {o.discount > 0 && <span className="text-emerald-300">🎟️ {o.couponCode}: −{t('common.currency')}{o.discount.toFixed(2)}</span>}
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
                  {store?.deliveryPhone && (
                    <button onClick={() => sendToDelivery(o)} className="inline-flex items-center gap-1 rounded-xl border border-gold-400/30 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-400/10">
                      🚚 {t('dashboard.ordersSection.sendDelivery')}
                    </button>
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

import { useEffect, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { buildWhatsappLink } from '../../utils/whatsapp.js';
import { PinIcon, NoteIcon, TicketIcon, WhatsAppIcon, TruckIcon } from '../../components/icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import OpostSend from '../../components/OpostSend.jsx';
import EpsSend from '../../components/EpsSend.jsx';

const FLOW = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

// خريطة حالات أوبتيموس (snake_case مؤكّدة من الـ API + القياسية) → عربي،
// لعرض نفس مسمّى حالة تطبيق أوبتيموس بصفحة الطلبات.
const OPOST_STATUS_AR = {
  draft: 'مسودّة',
  submitted: 'قيد التجهيز', created: 'قيد التجهيز', new: 'قيد التجهيز', processing: 'قيد التجهيز',
  ready: 'جاهزة للاستلام', ready_for_pickup: 'جاهزة للاستلام', confirmed: 'جاهزة للاستلام',
  awaiting_pickup: 'بانتظار التحميل', waiting_pickup: 'بانتظار التحميل', assigned: 'بانتظار التحميل',
  picked_up: 'تم التحميل', pickedup: 'تم التحميل', loaded: 'تم التحميل', received: 'تم التحميل',
  in_transit: 'جاري التسليم', out_for_delivery: 'جاري التسليم', delivering: 'جاري التسليم', dispatched: 'جاري التسليم', shipped: 'جاري التسليم',
  cod_pickup: 'تم التحصيل', collected: 'تم التحصيل', cod_collected: 'تم التحصيل',
  delivered: 'تم التسليم', completed: 'تم التسليم',
  returned: 'مرتجع', return: 'مرتجع', returned_to_business: 'مرتجع',
  cancelled: 'ملغاة', canceled: 'ملغاة',
  pending: 'عالق', stuck: 'عالق', postponed: 'مؤجّلة', rejected: 'مرفوض',
};
const opostLabel = (raw) => {
  const key = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return OPOST_STATUS_AR[key] || String(raw || '').trim();
};

// خريطة حالات EPS (نظام LogesTechs — أكواد UPPER_SNAKE من توثيقهم الرسمي) → عربي
const EPS_STATUS_AR = {
  DRAFT: 'مسودّة',
  PENDING_CUSTOMER_CARE_APPROVAL: 'طلب جديد',
  APPROVED_BY_CUSTOMER_CARE_AND_WAITING_FOR_DISPATCHER: 'بانتظار تعيين سائق',
  ASSIGNED_TO_DRIVER_AND_PENDING_APPROVAL: 'بانتظار موافقة السائق',
  REJECTED_BY_DRIVER_AND_PENDING_MANGEMENT: 'رفضها السائق',
  ACCEPTED_BY_DRIVER_AND_PENDING_PICKUP: 'بانتظار التحميل',
  SCANNED_BY_DRIVER_AND_IN_CAR: 'بالمركبة',
  SCANNED_BY_HANDLER_AND_UNLOADED: 'وصلت مركز الفرز',
  MOVED_TO_SHELF_AND_OUT_OF_HANDLER_CUSTODY: 'على الرفوف',
  OPENED_ISSUE_AND_WAITING_FOR_MANAGEMENT: 'بانتظار مراجعة الإدارة',
  OUT_FOR_DELIVERY: 'جاري التسليم',
  POSTPONED_DELIVERY: 'مؤجّلة',
  FAILED: 'فشل التوصيل',
  DELIVERED_TO_RECIPIENT: 'تم التوصيل',
  PARTIALLY_DELIVERED: 'تسليم جزئي',
  COMPLETED: 'مغلقة',
  CANCELLED: 'ملغاة',
  RETURNED_BY_RECIPIENT: 'مرتجعة',
  DELIVERED_TO_SENDER: 'مسلّمة للمرسل',
  TRANSFERRED_OUT: 'مصدرة لشريك',
  EXPORTED_TO_THIRD_PARTY: 'مصدرة لطرف ثالث',
  SWAPPED: 'تم تبديلها',
  BROUGHT: 'تم إحضارها',
  LOST: 'مفقودة',
  DAMAGED: 'تالفة',
};
const epsLabel = (raw) => {
  const key = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return EPS_STATUS_AR[key] || String(raw || '').trim();
};

// مفتاح اليوم (سنة-شهر-يوم) لفصل الطلبات اليومية، ووصف بشري له (اليوم/أمس/تاريخ)
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const dayLabel = (d, t) => {
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return t('dashboard.ordersSection.today');
  if (diff === 1) return t('dashboard.ordersSection.yesterday');
  return new Date(d).toLocaleDateString();
};
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
  // ربط أوبتيموس: نجلب الحالة + المدن + أنواع الشحن مرّة واحدة (لا لكل طلب) — يقلّل استهلاك الـ API
  const [opost, setOpost] = useState({ connected: false, cities: [], types: [], defaultType: '' });
  // ربط EPS (LogesTechs): الحالة + المدن مرّة واحدة
  const [eps, setEps] = useState({ connected: false, cities: [] });

  useEffect(() => {
    let on = true;
    api.get('/orders/mine').then(async (r) => {
      if (!on) return;
      const list = r.data.orders;
      setOrders(list);
      // مزامنة حالة الطلبات المُرسلة لأوبتيموس مع حالتها الحيّة هناك
      if (list.some((o) => o.opostTracking)) {
        try {
          const s = await api.get('/opost/sync');
          const m = s.data.statuses || {};
          if (on) setOrders((prev) => prev.map((o) => (m[o.id] != null ? { ...o, opostStatus: m[o.id] } : o)));
        } catch { /* تجاهل */ }
      }
      // ونفس الشي لشحنات EPS
      if (list.some((o) => o.epsTracking)) {
        try {
          const s = await api.get('/eps/sync');
          const m = s.data.statuses || {};
          if (on) setOrders((prev) => prev.map((o) => (m[o.id] != null ? { ...o, epsStatus: m[o.id] } : o)));
        } catch { /* تجاهل */ }
      }
    }).catch((e) => on && setError(getErrorMessage(e)));
    return () => { on = false; };
  }, []);

  useEffect(() => {
    let on = true;
    api.get('/eps/status').then(async (r) => {
      if (!on || !r.data.connected) return;
      const c = await api.get('/eps/cities').catch(() => ({ data: { cities: [] } }));
      if (on) setEps({ connected: true, cities: c.data.cities || [] });
    }).catch(() => {});
    return () => { on = false; };
  }, []);

  useEffect(() => {
    let on = true;
    api.get('/opost/status').then(async (r) => {
      if (!on || !r.data.connected) return;
      const [c, ty] = await Promise.all([
        api.get('/opost/cities').catch(() => ({ data: { cities: [] } })),
        api.get('/opost/shipment-types').catch(() => ({ data: { types: [] } })),
      ]);
      if (on) setOpost({ connected: true, cities: c.data.cities || [], types: ty.data.types || [], defaultType: r.data.shipmentType || '' });
    }).catch(() => {});
    return () => { on = false; };
  }, []);

  // بعد إرسال طلب لشركة توصيل: نحفظ رقم التتبّع ونحوّل الحالة لـ"تم الشحن" محلياً (مُقفلة)
  const markSent = (id, tracking) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, opostTracking: tracking || '✓', status: 'shipped' } : o)));
  const markSentEps = (id, tracking) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, epsTracking: tracking || '✓', status: 'shipped' } : o)));

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

  // إرسال الطلب عبر واتساب برسالة جاهزة — لشركة التوصيل إن حُدّدت، وإلا لواتساب صاحب المتجر
  const sendToDelivery = (o) => {
    const num = store?.deliveryPhone || store?.whatsapp;
    if (!num) return;
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
    window.open(buildWhatsappLink(num, msg), '_blank');
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
          {(() => {
            // عدد الطلبات لكل يوم (لعرضه بجانب عنوان اليوم)
            const counts = {};
            orders.forEach((o) => { const k = dayKey(o.createdAt); counts[k] = (counts[k] || 0) + 1; });
            let lastDay = null;
            return orders.map((o) => {
            const subtotal = (o.total - (o.deliveryFee || 0) + (o.discount || 0)).toFixed(2);
            const wa = o.customerPhone ? buildWhatsappLink(o.customerPhone) : '';
            const k = dayKey(o.createdAt);
            const header = k !== lastDay ? (
              <div className="flex items-center gap-2 pt-2">
                <h3 className="text-sm font-bold text-gold-300">{dayLabel(o.createdAt, t)}</h3>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-stone-400">{t('dashboard.ordersSection.ordersCount', { count: counts[k] })}</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
            ) : null;
            lastDay = k;
            return (
              <Fragment key={o.id}>
              {header}
              <div className="glass p-4">
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
                    <PinIcon className="inline h-4 w-4" /> {t('dashboard.ordersSection.deliveryTo')}: <span className="text-stone-200">{o.city}</span>
                    {o.address ? <span className="text-stone-300"> — {o.address}</span> : null}
                  </p>
                )}
                {o.notes && <p className="mt-1 flex items-center gap-1 text-xs text-stone-400"><NoteIcon className="h-3.5 w-3.5 shrink-0" /> {o.notes}</p>}

                {/* المبالغ */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-sm">
                  <span className="text-xs text-stone-500">{new Date(o.createdAt).toLocaleString()}</span>
                  <div className="flex flex-wrap items-center gap-3 text-stone-400">
                    <span>{t('dashboard.ordersSection.subtotal')}: {t('common.currency')}{subtotal}</span>
                    {o.discount > 0 && <span className="inline-flex items-center gap-1 text-emerald-300"><TicketIcon className="h-3.5 w-3.5" /> {o.couponCode}: −{t('common.currency')}{o.discount.toFixed(2)}</span>}
                    <span>{t('dashboard.ordersSection.delivery')}: {t('common.currency')}{(o.deliveryFee || 0).toFixed(2)}</span>
                    <span className="font-display text-base font-bold text-gold-300">{t('common.currency')}{o.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* تحديث الحالة + تواصل */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-stone-400">{t('dashboard.ordersSection.updateStatus')}:</span>
                  {o.opostTracking ? (
                    // الطلب بعهدة أوبتيموس → الحالة مُقفلة (تُدار عبر شركة التوصيل)
                    <span className="inline-flex items-center gap-1 rounded-xl bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-200">
                      🔒 {o.opostStatus ? opostLabel(o.opostStatus) : t(`dashboard.ordersSection.${FLOW.includes(o.status) ? o.status : 'shipped'}`)} · {t('dashboard.opost.managed')}
                    </span>
                  ) : o.epsTracking ? (
                    // الطلب بعهدة EPS → الحالة مُقفلة (تُدار عبر شركة التوصيل)
                    <span className="inline-flex items-center gap-1 rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200">
                      🔒 {o.epsStatus ? epsLabel(o.epsStatus) : t(`dashboard.ordersSection.${FLOW.includes(o.status) ? o.status : 'shipped'}`)} · {t('dashboard.eps.managed')}
                    </span>
                  ) : (
                    <div className="min-w-[140px]">
                      <Select
                        value={FLOW.includes(o.status) ? o.status : 'new'}
                        onChange={(v) => setStatus(o.id, v)}
                        options={FLOW.map((s) => ({ value: s, label: t(`dashboard.ordersSection.${s}`) }))}
                      />
                    </div>
                  )}
                  {savingId === o.id && <span className="text-xs text-stone-500">…</span>}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp gap-1.5 !px-3 !py-1.5 text-xs"><WhatsAppIcon className="h-4 w-4" /> {t('dashboard.ordersSection.contactWhatsapp')}</a>
                  )}
                  {(store?.deliveryPhone || store?.whatsapp) && (
                    <button onClick={() => sendToDelivery(o)} className="inline-flex items-center gap-1 rounded-xl border border-gold-400/30 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-400/10">
                      <TruckIcon className="inline h-4 w-4" /> {t('dashboard.ordersSection.sendDelivery')}
                    </button>
                  )}
                  {(opost.connected || o.opostTracking) && !o.epsTracking && (
                    <OpostSend order={o} cities={opost.cities} types={opost.types} defaultType={opost.defaultType} onSent={markSent} />
                  )}
                  {(eps.connected || o.epsTracking) && !o.opostTracking && (
                    <EpsSend order={o} cities={eps.cities} onSent={markSentEps} />
                  )}
                </div>
              </div>
              </Fragment>
            );
            });
          })()}
        </div>
      )}
    </div>
  );
}

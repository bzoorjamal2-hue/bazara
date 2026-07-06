import { useEffect, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { buildWhatsappLink, waCandidates } from '../../utils/whatsapp.js';
import { getCache, setCache } from '../../utils/apiCache.js';
import { PinIcon, NoteIcon, TicketIcon, WhatsAppIcon, TruckIcon, BellIcon, TrashIcon, BagIcon } from '../../components/icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import OpostSend from '../../components/OpostSend.jsx';
import EpsSend from '../../components/EpsSend.jsx';
import GoboxSend from '../../components/GoboxSend.jsx';

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
// gobox على نفس نظام LogesTechs → نفس أسماء الحالات
const goboxLabel = epsLabel;

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
  // ربط gobox (LogesTechs بالقرى): حالة الربط فقط — القرى تُبحث عند الإرسال
  const [gobox, setGobox] = useState({ connected: false });
  // طلبات لم تكتمل (سلات متروكة ببيانات تواصل) — لمتابعتها برسالة وإنقاذ البيع
  const [abandoned, setAbandoned] = useState([]);
  // فلترة وبحث بالطلبات: حالة + اسم/هاتف/رقم طلب — للوصول لأي طلب بثوانٍ
  const [statusFilter, setStatusFilter] = useState('all');
  const [oq, setOq] = useState('');

  useEffect(() => {
    let on = true;
    api.get('/orders/abandoned').then((r) => { if (on) setAbandoned(r.data.abandoned || []); }).catch(() => {});
    return () => { on = false; };
  }, []);

  const removeAbandoned = async (id) => {
    setAbandoned((prev) => prev.filter((x) => x.id !== id));
    try { await api.delete(`/orders/abandoned/${id}`); } catch { /* تجاهل */ }
  };

  // فتح فوري بلا تعليق: نعرض آخر قائمة محفوظة فوراً (خاصة أول فتحة والخادم
  // ما زال يستيقظ)، ثم يحدّثها الجلب الفعلي بالخلفية — نفس أسلوب صفحة المتجر
  useEffect(() => {
    if (store?.id) {
      const cached = getCache(`myorders:${store.id}`);
      if (cached) setOrders((prev) => prev ?? cached);
    }
  }, [store?.id]);

  useEffect(() => {
    let on = true;
    api.get('/orders/mine').then(async (r) => {
      if (!on) return;
      const list = r.data.orders;
      setOrders(list);
      if (store?.id) setCache(`myorders:${store.id}`, list);
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
      // ونفس الشي لشحنات gobox
      if (list.some((o) => o.goboxTracking)) {
        try {
          const s = await api.get('/gobox/sync');
          const m = s.data.statuses || {};
          if (on) setOrders((prev) => prev.map((o) => (m[o.id] != null ? { ...o, goboxStatus: m[o.id] } : o)));
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
    api.get('/gobox/status').then((r) => {
      if (on && r.data.connected) setGobox({ connected: true });
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
  const markSentGobox = (id, tracking) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, goboxTracking: tracking || '✓', status: 'shipped' } : o)));

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

  // رسالة جاهزة للزبون عن حالة طلبه الحالية (مع شركة التوصيل ورقم التتبّع إن وُجدا)
  const orderStatusMsg = (o) => {
    const st = FLOW.includes(o.status) ? o.status : 'new';
    const courier = o.opostTracking ? 'أوبتيموس' : o.epsTracking ? 'EPS' : o.goboxTracking ? 'gobox' : '';
    const tracking = o.opostTracking || o.epsTracking || o.goboxTracking || '';
    const lines = [
      t('dashboard.ordersSection.waStatus.greet', { name: o.customerName || '', store: store?.name || '' }),
      t(`dashboard.ordersSection.waStatus.${st}`),
    ];
    if (courier && tracking && tracking !== '✓' && (st === 'shipped' || st === 'delivered')) {
      lines.push(t('dashboard.ordersSection.waStatus.trackingLine', { courier, tracking }));
    }
    lines.push(t('dashboard.ordersSection.waStatus.totalLine', { total: Number(o.total || 0).toFixed(2) }));
    lines.push(t('dashboard.ordersSection.waStatus.thanks'));
    return lines.join('\n');
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

  // الطلبات المعروضة بعد الفلترة والبحث (الاسم/الهاتف بأي صيغة/رقم الطلب)
  const term = oq.trim().toLowerCase();
  const termDigits = term.replace(/\D/g, '');
  const visibleOrders = (orders || []).filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!term) return true;
    return (
      (o.customerName || '').toLowerCase().includes(term) ||
      (termDigits.length >= 3 && (o.customerPhone || '').replace(/\D/g, '').includes(termDigits)) ||
      (o.reference || '').toLowerCase().includes(term)
    );
  });

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

      {/* طلبات لم تكتمل: زبائن أدخلوا بياناتهم بشاشة الإتمام ولم يؤكّدوا — فرصة بيع تُنقَذ برسالة */}
      {abandoned.length > 0 && (
        <div className="glass border border-amber-400/25 p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-stone-100">
            <BagIcon className="h-5 w-5 text-amber-300" /> {t('dashboard.abandoned.title')}
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">{abandoned.length}</span>
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-stone-400">{t('dashboard.abandoned.hint')}</p>
          <div className="space-y-2">
            {abandoned.map((a) => {
              const itemsTxt = (a.items || []).map((it) => `• ${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`).join('\n');
              const msg = t('dashboard.abandoned.waMsg', { name: a.name || '', store: store?.name || '', items: itemsTxt, total: Number(a.total || 0).toFixed(2) });
              const nums = waCandidates(a.phone);
              const pieces = (a.items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-100">
                      {a.name || a.phone} <span dir="ltr" className="ms-1 text-xs font-normal text-stone-400">{a.phone}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {t('dashboard.abandoned.itemsCount', { count: pieces })}{a.city ? ` · ${a.city}` : ''} · ₪{Number(a.total || 0).toFixed(0)} · {new Date(a.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {nums[0] && (
                      <a href={`https://wa.me/${nums[0]}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="btn-whatsapp gap-1.5 !px-3 !py-1.5 text-xs">
                        <WhatsAppIcon className="h-4 w-4" /> {t('dashboard.abandoned.nudge')}
                      </a>
                    )}
                    {nums[1] && (
                      <a href={`https://wa.me/${nums[1]}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" title={t('dashboard.ordersSection.waAltHint')} className="btn-whatsapp gap-1 !px-2.5 !py-1.5 text-xs opacity-80">
                        <WhatsAppIcon className="h-4 w-4" /> <span dir="ltr">+{nums[1].slice(0, 3)}</span>
                      </a>
                    )}
                    <button onClick={() => removeAbandoned(a.id)} aria-label={t('common.remove')} className="p-1.5 text-stone-500 transition hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* شريط الفلترة والبحث — يظهر عندما تكثر الطلبات ليصل المالك لأي طلب بثوانٍ */}
      {orders?.length > 3 && (
        <div className="glass space-y-2.5 p-3">
          <input
            className="input"
            placeholder={t('dashboard.ordersSection.searchPlaceholder')}
            value={oq}
            onChange={(e) => setOq(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {['all', ...FLOW].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === s
                    ? 'bg-gold-400 text-wine-dark shadow-sm'
                    : 'bg-white/5 text-stone-300 ring-1 ring-white/10 hover:bg-white/10'
                }`}
              >
                {s === 'all' ? t('common.all') : t(`dashboard.ordersSection.${s}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {orders && orders.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.ordersSection.empty')}</div>
      ) : (
        <div className="space-y-3">
          {(() => {
            if (!visibleOrders.length) {
              return <div className="glass p-8 text-center text-sm text-stone-400">{t('dashboard.ordersSection.noResults')}</div>;
            }
            // عدد الطلبات لكل يوم (لعرضه بجانب عنوان اليوم)
            const counts = {};
            visibleOrders.forEach((o) => { const k = dayKey(o.createdAt); counts[k] = (counts[k] || 0) + 1; });
            let lastDay = null;
            return visibleOrders.map((o) => {
            const subtotal = (o.total - (o.deliveryFee || 0) + (o.discount || 0)).toFixed(2);
            // أرقام 059/056 قد تكون على واتساب بمقدمة 970 أو 972 — نجهّز المقدمتين:
            // الزر الرئيسي يفتح الأرجح، وبجانبه بديل صغير لو قال واتساب "غير موجود"
            const waNums = o.customerPhone ? waCandidates(o.customerPhone) : [];
            const wa = waNums[0] ? `https://wa.me/${waNums[0]}` : '';
            const waAlt = waNums[1] ? `https://wa.me/${waNums[1]}` : '';
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
                  ) : o.goboxTracking ? (
                    // الطلب بعهدة gobox → الحالة مُقفلة (تُدار عبر شركة التوصيل)
                    <span className="inline-flex items-center gap-1 rounded-xl bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-200">
                      🔒 {o.goboxStatus ? goboxLabel(o.goboxStatus) : t(`dashboard.ordersSection.${FLOW.includes(o.status) ? o.status : 'shipped'}`)} · {t('dashboard.gobox.managed')}
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
                    <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp gap-1.5 !px-3 !py-1.5 text-xs"><WhatsAppIcon className="h-4 w-4" /> {t('dashboard.ordersSection.contactWhatsapp')}{waAlt ? <span dir="ltr" className="opacity-75">+{waNums[0].slice(0, 3)}</span> : null}</a>
                  )}
                  {waAlt && (
                    <a href={waAlt} target="_blank" rel="noreferrer" title={t('dashboard.ordersSection.waAltHint')} className="btn-whatsapp gap-1 !px-2.5 !py-1.5 text-xs opacity-80"><WhatsAppIcon className="h-4 w-4" /> <span dir="ltr">+{waNums[1].slice(0, 3)}</span></a>
                  )}
                  {/* رسالة جاهزة للزبون عن حالة طلبه الحالية (مع رقم التتبّع إن وُجد) */}
                  {wa && (
                    <a
                      href={`https://wa.me/${waNums[0]}?text=${encodeURIComponent(orderStatusMsg(o))}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-sky-400/30 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/10"
                    >
                      <BellIcon className="h-4 w-4" /> {t('dashboard.ordersSection.notifyCustomer')}
                    </a>
                  )}
                  {(store?.deliveryPhone || store?.whatsapp) && (
                    <button onClick={() => sendToDelivery(o)} className="inline-flex items-center gap-1 rounded-xl border border-gold-400/30 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-400/10">
                      <TruckIcon className="inline h-4 w-4" /> {t('dashboard.ordersSection.sendDelivery')}
                    </button>
                  )}
                  {(opost.connected || o.opostTracking) && !o.epsTracking && !o.goboxTracking && (
                    <OpostSend order={o} cities={opost.cities} types={opost.types} defaultType={opost.defaultType} onSent={markSent} />
                  )}
                  {(eps.connected || o.epsTracking) && !o.opostTracking && !o.goboxTracking && (
                    <EpsSend order={o} cities={eps.cities} onSent={markSentEps} />
                  )}
                  {(gobox.connected || o.goboxTracking) && !o.opostTracking && !o.epsTracking && (
                    <GoboxSend order={o} onSent={markSentGobox} />
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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import OpostSend from './OpostSend.jsx';
import EpsSend from './EpsSend.jsx';
import GoboxSend from './GoboxSend.jsx';

// طبقة مشتركة لشركات التوصيل (أوبتيموس/EPS/gobox): حالة الربط + أسماء الحالات
// + أزرار الإرسال — تستعملها صفحة الطلبات وصفحة طلبات التوفّر بنفس السلوك تماماً.

// خريطة حالات أوبتيموس (snake_case مؤكّدة من الـ API + القياسية) → عربي
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
export const opostLabel = (raw) => {
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
export const epsLabel = (raw) => {
  const key = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return EPS_STATUS_AR[key] || String(raw || '').trim();
};
// gobox على نفس نظام LogesTechs → نفس أسماء الحالات
export const goboxLabel = epsLabel;

// الشركة التي بعهدتها الطلب حالياً (إن أُرسل) — مصدر واحد لكل الشاشات
export function courierOf(o) {
  if (!o) return null;
  if (o.opostTracking) return { key: 'opost', tracking: o.opostTracking, status: o.opostStatus, label: opostLabel(o.opostStatus), name: 'أوبتيموس' };
  if (o.epsTracking) return { key: 'eps', tracking: o.epsTracking, status: o.epsStatus, label: epsLabel(o.epsStatus), name: 'EPS' };
  if (o.goboxTracking) return { key: 'gobox', tracking: o.goboxTracking, status: o.goboxStatus, label: goboxLabel(o.goboxStatus), name: 'gobox' };
  return null;
}

// حالة الربط + المدن/الأنواع تُجلب مرّة واحدة للصفحة (لا لكل طلب) — يقلّل استهلاك الـ API
export function useCouriers() {
  const [opost, setOpost] = useState({ connected: false, cities: [], types: [], defaultType: '' });
  const [eps, setEps] = useState({ connected: false, cities: [] });
  const [gobox, setGobox] = useState({ connected: false });

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
    api.get('/eps/status').then(async (r) => {
      if (!on || !r.data.connected) return;
      const c = await api.get('/eps/cities').catch(() => ({ data: { cities: [] } }));
      if (on) setEps({ connected: true, cities: c.data.cities || [] });
    }).catch(() => {});
    api.get('/gobox/status').then((r) => {
      if (on && r.data.connected) setGobox({ connected: true });
    }).catch(() => {});
    return () => { on = false; };
  }, []);

  return { opost, eps, gobox };
}

// مزامنة حالات الشحنات الحيّة لقائمة طلبات → { [orderId]: { opostStatus | epsStatus | goboxStatus } }
export async function syncCourierStatuses(list) {
  const orders = (list || []).filter(Boolean);
  const patch = {};
  const jobs = [];
  const pull = (path, field) => api.get(path).then((r) => {
    const m = r.data.statuses || {};
    Object.entries(m).forEach(([id, st]) => { patch[id] = { ...(patch[id] || {}), [field]: st }; });
  }).catch(() => {});
  if (orders.some((o) => o.opostTracking)) jobs.push(pull('/opost/sync', 'opostStatus'));
  if (orders.some((o) => o.epsTracking)) jobs.push(pull('/eps/sync', 'epsStatus'));
  if (orders.some((o) => o.goboxTracking)) jobs.push(pull('/gobox/sync', 'goboxStatus'));
  if (!jobs.length) return null;
  await Promise.all(jobs);
  return patch;
}

// شارة "الطلب بعهدة شركة التوصيل" (الحالة مُقفلة وتُدار من عندهم) — أو null إن لم يُرسل
export function CourierLock({ order, fallbackLabel }) {
  const { t } = useTranslation();
  const c = courierOf(order);
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-xl bg-wine/10 px-3 py-1.5 text-xs font-semibold text-wine">
      🔒 {c.label || fallbackLabel} · {t(`dashboard.${c.key}.managed`)}
    </span>
  );
}

// أزرار الإرسال للشركات المربوطة (تختفي البقيّة بعد إرسال الطلب لواحدة منها)
export function CourierSend({ order, couriers, onSent }) {
  const { opost, eps, gobox } = couriers;
  const sent = (key) => (id, tracking) => onSent?.(id, tracking, key);
  return (
    <>
      {(opost.connected || order.opostTracking) && !order.epsTracking && !order.goboxTracking && (
        <OpostSend order={order} cities={opost.cities} types={opost.types} defaultType={opost.defaultType} onSent={sent('opost')} />
      )}
      {(eps.connected || order.epsTracking) && !order.opostTracking && !order.goboxTracking && (
        <EpsSend order={order} cities={eps.cities} onSent={sent('eps')} />
      )}
      {(gobox.connected || order.goboxTracking) && !order.opostTracking && !order.epsTracking && (
        <GoboxSend order={order} onSent={sent('gobox')} />
      )}
    </>
  );
}

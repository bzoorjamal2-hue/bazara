import dotenv from 'dotenv';

dotenv.config();

// تكامل شركة التوصيل EPS — تعمل على نظام LogesTechs (apisv2.logestechs.com).
// لا يوجد OAuth هنا: كل استدعاء إنشاء شحنة يتطلّب بريد/كلمة سر حساب المتجر لدى EPS
// (تُخزّن كلمة السر مشفّرة AES-256-GCM بنفس مفتاح أوبتيموس)، وكل الاستدعاءات
// تتطلّب ترويسة company-id (معرّف EPS في LogesTechs = 4) — مؤكّد بالتجربة.

export const EPS_BASE = (process.env.EPS_BASE_URL || 'https://apisv2.logestechs.com/api').replace(/\/$/, '');
export const EPS_COMPANY_ID = String(process.env.EPS_COMPANY_ID || '4');

// ───────── استدعاء عام بترويسة الشركة ─────────
export async function epsApi(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { Accept: 'application/json', 'company-id': EPS_COMPANY_ID },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${EPS_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || data.message || `EPS ${res.status}`);
    e.status = res.status;
    e.body = data;
    throw e;
  }
  return data;
}

// ───────── المدن (تُخزّن مؤقتاً — نادراً تتغيّر) ─────────
// القائمة مقسّمة صفحات (10 افتراضياً) — pageSize كبير يرجّعها كاملة (~83 مدينة).
const TTL = 6 * 60 * 60 * 1000;
const mem = { cities: null, citiesAt: 0 };

export async function fetchEpsCities() {
  if (mem.cities && Date.now() - mem.citiesAt < TTL) return mem.cities;
  const resp = await epsApi('/addresses/cities?returnAll=true&pageSize=1000');
  const list = (Array.isArray(resp?.data) ? resp.data : []).map((c) => ({
    id: c.id,
    name: c.arabicName || c.name || c.englishName || String(c.id),
  }));
  if (list.length) {
    mem.cities = list;
    mem.citiesAt = Date.now();
  }
  return list;
}

// ───────── إنشاء شحنة ─────────
// POST /ship/request/by-email — البريد/كلمة السر داخل الجسم يحدّدان حساب المتجر لدى EPS.
export function createEpsShipment(payload) {
  return epsApi('/ship/request/by-email', { method: 'POST', body: payload });
}

// ───────── حالة شحنة بالباركود (بلا توثيق — يكفي company-id) ─────────
export async function getEpsPackageStatus(barcode) {
  const data = await epsApi(`/guests/packages/status?barcode=${encodeURIComponent(barcode)}`);
  return String(data?.status || '').trim(); // مثل DELIVERED_TO_RECIPIENT
}

// ───────── بوليصة الشحن (AWB) — يرجّع رابط PDF ─────────
export async function getEpsAwb(barcodes) {
  const data = await epsApi(`/guests/${EPS_COMPANY_ID}/packages/pdf`, {
    method: 'POST',
    body: { barcodes },
  });
  return String(data?.url || '');
}

// ───────── حالات LogesTechs → عربي (الأسماء من ملف التوثيق الرسمي) ─────────
const STATUS_AR = {
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

export function epsStatusLabelAr(raw) {
  const key = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS_AR[key] || String(raw || '').trim();
}

// الحالات النهائية — ما نعيد الاستعلام عنها (وفّر استدعاءات)
export const EPS_TERMINAL = new Set([
  'DELIVERED_TO_RECIPIENT', 'COMPLETED', 'CANCELLED', 'RETURNED_BY_RECIPIENT',
  'DELIVERED_TO_SENDER', 'TRANSFERRED_OUT', 'EXPORTED_TO_THIRD_PARTY',
  'SWAPPED', 'BROUGHT', 'PARTIALLY_DELIVERED', 'LOST', 'DAMAGED',
]);

// انعكاس حالة EPS على حالة طلب بازارا (للإحصائيات والمخزون):
// تسليم → delivered، إلغاء/إرجاع → cancelled (يُعيد المخزون)، غير ذلك تبقى shipped.
export function epsToBazaraStatus(raw) {
  const key = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (key === 'DELIVERED_TO_RECIPIENT' || key === 'COMPLETED' || key === 'PARTIALLY_DELIVERED') return 'delivered';
  if (key === 'CANCELLED' || key === 'RETURNED_BY_RECIPIENT' || key === 'DELIVERED_TO_SENDER') return 'cancelled';
  return '';
}

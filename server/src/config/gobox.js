import dotenv from 'dotenv';

dotenv.config();

// تكامل شركة التوصيل gobox — تعمل على نظام LogesTechs (apisv2.logestechs.com) مثل EPS.
// الفروقات عن EPS (مؤكّدة من توثيق gobox الرسمي + التجربة على company-id 15):
//  • الموقع بالقرى (villages) لا المدن: /addresses/villages يرجّع villageId+cityId+regionId معاً،
//    والعنوان يتطلّب الثلاثة (إجبارية). لذا كل "وجهة" = قرية تحمل معرّفاتها الثلاثة.
//  • نوع الخدمة نصّي: serviceType: "STANDARD" (بدل serviceTypeId/vehicleTypeId الرقمية بـEPS).
//  • البوليصة (AWB) تُطلب بمصفوفة ids (معرّفات الشحنات) لا barcodes.
// كلمة السر تُخزّن مشفّرة بنفس مفتاح أوبتيموس، وكل الاستدعاءات تتطلّب ترويسة company-id = 15.

export const GOBOX_BASE = (process.env.GOBOX_BASE_URL || 'https://apisv2.logestechs.com/api').replace(/\/$/, '');
export const GOBOX_COMPANY_ID = String(process.env.GOBOX_COMPANY_ID || '15');

// ───────── استدعاء عام بترويسة الشركة ─────────
export async function goboxApi(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { Accept: 'application/json', 'company-id': GOBOX_COMPANY_ID },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${GOBOX_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || data.message || `gobox ${res.status}`);
    e.status = res.status;
    e.body = data;
    throw e;
  }
  return data;
}

// ───────── بحث القرى/المناطق (search-based — القائمة الكاملة آلاف) ─────────
// كل نتيجة تحمل معرّفاتها الثلاثة معاً: id(=villageId) + cityId + regionId.
export async function searchGoboxVillages(term) {
  const q = String(term || '').trim();
  if (!q) return [];
  const resp = await goboxApi(`/addresses/villages?search=${encodeURIComponent(q)}`);
  const list = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
  return list.map((v) => ({
    village: v.id,
    city: v.cityId,
    region: v.regionId,
    name: v.arabicName || v.name || String(v.id),
    cityName: v.cityName || v.cityArabicName || '',
    // اسم معروض كامل يساعد صاحب المتجر يميّز القرى المتشابهة
    label: [v.arabicName || v.name, v.cityName].filter(Boolean).join(' - '),
  }));
}

// ───────── إنشاء شحنة ─────────
// POST /ship/request/by-email — البريد/كلمة السر داخل الجسم يحدّدان حساب المتجر لدى gobox.
export function createGoboxShipment(payload) {
  return goboxApi('/ship/request/by-email', { method: 'POST', body: payload });
}

// ───────── حالة شحنة بالباركود (بلا توثيق — يكفي company-id) ─────────
export async function getGoboxPackageStatus(barcode) {
  const data = await goboxApi(`/guests/packages/status?barcode=${encodeURIComponent(barcode)}`);
  return String(data?.status || '').trim();
}

// ───────── بوليصة الشحن (AWB) — بمصفوفة معرّفات الشحنات (ids) ─────────
export async function getGoboxAwb(ids) {
  const data = await goboxApi(`/guests/${GOBOX_COMPANY_ID}/packages/pdf`, {
    method: 'POST',
    body: { ids },
  });
  return String(data?.url || '');
}

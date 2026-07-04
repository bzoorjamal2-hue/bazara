import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// تكامل شركة التوصيل أوبتيموس (Opost) — opost.ps
// طريقة المصادقة الرسمية بالملف: تسجيل دخول (password grant) → access_token + refresh_token.
// كل متجر يربط حسابه الخاص (توكنه يُخزّن مشفّراً)، فمصاري الدفع عند الاستلام تروح لكل صاحب متجر.

export const OPOST_BASE = (process.env.OPOST_BASE_URL || 'https://opost.ps').replace(/\/$/, '');
const CLIENT_ID = process.env.OPOST_CLIENT_ID || '';
const CLIENT_SECRET = process.env.OPOST_CLIENT_SECRET || '';

// التكامل "نائم" حتى تُضبط مفاتيح تطبيق بازارا على أوبتيموس (مثل Lahza/الإشعارات الأصلية)
export function isOpostConfigured() {
  return Boolean(OPOST_BASE && CLIENT_ID && CLIENT_SECRET);
}

// ───────── تشفير التوكنات المخزّنة (AES-256-GCM) — لا تُحفظ كلمة سر المتجر إطلاقاً ─────────
const ENC_KEY = crypto
  .createHash('sha256')
  .update(process.env.OPOST_ENC_KEY || process.env.JWT_SECRET || 'bazara-opost-fallback')
  .digest();

export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(blob) {
  if (!blob || typeof blob !== 'string' || !blob.startsWith('v1:')) return '';
  try {
    const [, ivB, tagB, dataB] = blob.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// ───────── ترميز نموذج بمفاتيح متداخلة: consignee[name], shipment_types[0][id] ... ─────────
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') flatten(v, key, out);
    else if (v !== undefined && v !== null && v !== '') out[key] = v;
  }
  return out;
}

function encodeForm(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(flatten(obj))) p.append(k, String(v));
  return p.toString();
}

// ───────── تسجيل الدخول / التجديد (password & refresh_token grants) ─────────
async function tokenRequest(params) {
  const res = await fetch(`${OPOST_BASE}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.message || data.error || `Opost auth ${res.status}`;
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return data; // { token_type, expires_in, access_token, refresh_token }
}

export function loginOpost(email, password) {
  return tokenRequest({
    grant_type: 'password',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    username: email,
    password,
    scope: '',
  });
}

export function refreshOpost(refreshToken) {
  return tokenRequest({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    scope: '',
  });
}

// ───────── استدعاء عام لمسارات /api/... ─────────
export async function opostApi(path, token, { method = 'GET', form } = {}) {
  const opts = { method, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } };
  if (form) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = encodeForm(form);
  }
  const res = await fetch(`${OPOST_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.message || data.error_description || data.error || `Opost ${res.status}`);
    e.status = res.status;
    e.body = data;
    throw e;
  }
  return data;
}

// قائمة بأشكال أوبتيموس المختلفة. الشكل الفعلي: [{ data:[...], pagination:{...} }]
// (مصفوفة من عنصر واحد بداخله data) — كذلك ندعم الأشكال الأبسط احتياطاً.
export function asList(resp) {
  if (Array.isArray(resp)) {
    if (resp.length && resp[0] && Array.isArray(resp[0].data)) return resp[0].data;
    return resp;
  }
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.data?.data)) return resp.data.data;
  return [];
}

// ───────── تخزين مؤقّت بالذاكرة للمدن وأنواع الشحن (نادراً تتغيّر) — يقلّل استهلاك الـ API ─────────
const TTL = 6 * 60 * 60 * 1000; // 6 ساعات
const mem = { cities: null, citiesAt: 0, types: null, typesAt: 0, areas: new Map() };

// يجلب كل الصفحات: ردّ أوبتيموس مقسّم صفحات (25/صفحة) — جنين مثلاً 133 منطقة على 6 صفحات.
// كان الكود يجلب الصفحة الأولى فقط فتغيب القرى (رابا = منطقة 50 على الصفحة الثالثة).
async function fetchAllPages(path, token) {
  const sep = path.includes('?') ? '&' : '?';
  let all = [];
  for (let page = 1; page <= 40; page++) {
    const resp = await opostApi(`${path}${sep}page=${page}`, token);
    const block = Array.isArray(resp) ? resp[0] : resp;
    const data = Array.isArray(block?.data) ? block.data : asList(resp);
    if (data.length) all = all.concat(data);
    const pg = block?.pagination;
    if (!pg || !pg.has_more_pages || page >= (pg.last_page || page)) break;
  }
  return all;
}

export async function fetchCities(token) {
  if (mem.cities && Date.now() - mem.citiesAt < TTL) return mem.cities;
  const list = await fetchAllPages('/api/resources/cities', token);
  if (list.length) { mem.cities = list; mem.citiesAt = Date.now(); }
  return list;
}

export async function fetchAreas(token, cityId) {
  const key = String(cityId);
  const hit = mem.areas.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.list;
  const list = await fetchAllPages(`/api/resources/areas?city=${encodeURIComponent(cityId)}`, token);
  if (list.length) mem.areas.set(key, { list, at: Date.now() });
  return list;
}

export async function fetchShipmentTypes(token) {
  if (mem.types && Date.now() - mem.typesAt < TTL) return mem.types;
  const list = asList(await opostApi('/api/resources/shipment-types', token));
  mem.types = list;
  mem.typesAt = Date.now();
  return list;
}

export function createShipment(token, payload) {
  return opostApi('/api/resources/shipments', token, { method: 'POST', form: payload });
}

// جلب شحنة واحدة بالمعرّف (للمزامنة الحيّة لحالة الطلب)
export async function getShipment(token, id) {
  const data = await opostApi(`/api/resources/shipments/${encodeURIComponent(id)}`, token);
  // قد يرجع الكائن مباشرة أو ملفوفاً بـ data / [{data:[...]}]
  if (data && typeof data === 'object' && !Array.isArray(data) && data.id) return data;
  const list = asList(data);
  return list[0] || data || {};
}

// الحالة الحالية للشحنة. نفضّل last_status.status لأنه الكود القانوني (snake_case
// مثل picked_up/cod_pickup) وأحدث حدث، ثم الحقل status العام كبديل.
export function shipmentStatus(obj) {
  return String(obj?.last_status?.status || obj?.status || '').trim();
}

// خريطة حالات أوبتيموس → عربي (للإشعارات). أكواد مؤكّدة من الـ API + القياسية.
const STATUS_AR = {
  draft: 'مسودّة', submitted: 'قيد التجهيز', created: 'قيد التجهيز', processing: 'قيد التجهيز',
  ready: 'جاهزة للاستلام', ready_for_pickup: 'جاهزة للاستلام',
  awaiting_pickup: 'بانتظار التحميل', assigned: 'بانتظار التحميل',
  picked_up: 'تم التحميل', loaded: 'تم التحميل', received: 'تم التحميل',
  in_transit: 'جاري التسليم', out_for_delivery: 'جاري التسليم', dispatched: 'جاري التسليم', shipped: 'جاري التسليم',
  cod_pickup: 'تم التحصيل', collected: 'تم التحصيل',
  delivered: 'تم التسليم', completed: 'تم التسليم',
  returned: 'مرتجع', returned_to_business: 'مرتجع',
  cancelled: 'ملغاة', canceled: 'ملغاة',
  pending: 'عالق', postponed: 'مؤجّلة', rejected: 'مرفوض',
};
export function statusLabelAr(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STATUS_AR[key] || String(raw || '').trim();
}

// استخراج رقم التتبّع/المعرّف من ردّ إنشاء الشحنة — دفاعي لأن الملف ما فيه مثال ردّ ناجح
export function extractShipmentInfo(resp) {
  const top = resp?.data && typeof resp.data === 'object' ? resp.data : resp || {};
  const n = (top.data && typeof top.data === 'object') ? top.data : top;
  const pick = (...keys) => {
    for (const k of keys) if (n[k] !== undefined && n[k] !== null && n[k] !== '') return String(n[k]);
    return '';
  };
  const id = pick('id', 'shipment_id', 'shipmentId');
  const tracking = pick('barcode', 'tracking', 'tracking_number', 'trackingNumber', 'qr_code', 'qr', 'code') || id;
  const status = pick('status', 'state');
  return { id, tracking, status, raw: n };
}

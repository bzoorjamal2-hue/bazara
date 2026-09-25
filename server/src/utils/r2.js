// محرّكُ وسائطِ بازارا — طبقةُ التخزين: Cloudflare R2 عبرَ واجهةِ S3.
//
// لماذا R2: المتجرُ فيديو في جوهره، فالخانقُ دائماً «التسليم» لا التخزين — وهو ما
// أوقفَ حسابَ كلاوديناري المجّانيَّ مرّتين (انظر ذاكرةَ bazara-cloudinary-quota).
// R2 لا يتقاضى على التسليمِ أبداً، وتخزينُه المجّانيُّ عشرةُ غيغا.
//
// لا مكتبةَ AWS: التوقيعُ (SigV4) بـcrypto المدمجةِ وحدَها — خمسون سطراً بدلَ حزمةٍ
// بعشراتِ الميغابايت. والروابطُ موقّعةٌ مسبقاً (presigned) فيرفعُ متصفّحُ التاجرةِ
// إلى R2 مباشرةً ولا يحملُ خادمُنا الملفَّ أصلاً.
//
// المتغيّرات (Render): R2_ACCOUNT_ID · R2_ACCESS_KEY_ID · R2_SECRET_ACCESS_KEY ·
// R2_BUCKET · MEDIA_PUBLIC_BASE (عنوانُ التسليمِ العامّ، بلا شرطةٍ أخيرة).
// غيابُ أيٍّ منها = المحرّكُ مطفأ، والرفعُ يعودُ لكلاوديناري كما كان.

import crypto from 'crypto';

function cfg() {
  return {
    account: process.env.R2_ACCOUNT_ID || '',
    key: process.env.R2_ACCESS_KEY_ID || '',
    secret: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicBase: (process.env.MEDIA_PUBLIC_BASE || '').replace(/\/+$/, ''),
  };
}

export function r2Enabled() {
  const c = cfg();
  return Boolean(c.account && c.key && c.secret && c.bucket && c.publicBase);
}

export const publicUrl = (key) => `${cfg().publicBase}/${key}`;

/** هل الرابطُ من وسائطِنا (R2 أو كلاوديناري القديم)؟ — للتحقّقِ قبلَ حفظِ رابطٍ أو تمريرِه لميتا */
// النطاق الخاصّ للمحرّك (media.bazarastore.site) يخدم الملفّات نفسها التي يخدمها
// عنوان ‎r2.dev — والواجهة صارت تعرض الأوّل وتعيده عند الحفظ، فيُقبَل الاثنان.
const MEDIA_ALIASES = (process.env.MEDIA_ALIAS_BASES || 'https://media.bazarastore.site')
  .split(',').map((b) => b.trim().replace(/\/+$/, '')).filter(Boolean);

export function isOwnMediaUrl(url) {
  const u = String(url || '');
  const base = cfg().publicBase;
  return u.startsWith('https://res.cloudinary.com/')
    || Boolean(base && u.startsWith(`${base}/`))
    || MEDIA_ALIASES.some((b) => u.startsWith(`${b}/`));
}

const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// ترميزُ URI بقواعدِ AWS: يُرمِّزُ ما يتركُه encodeURIComponent من ‎!'()*
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * رابطٌ موقّعٌ مسبقاً لعمليّةٍ واحدةٍ على مفتاحٍ واحد.
 * headers: ترويساتٌ تدخلُ التوقيع — فيلتزمُ بها من يستعملُ الرابط حرفياً.
 *   content-length يُثبِّتُ الحجمَ الذي أذنّا به: لا يُرفَعُ ملفٌّ أكبرُ برابطٍ أُعطيَ لأصغر.
 *   content-type يُثبِّتُ النوعَ فيُسلَّمُ الملفُّ بنوعِه الصحيح.
 */
export function presign(method, key, { expires = 900, headers = {} } = {}) {
  const c = cfg();
  return signQuery({
    method, host: `${c.account}.r2.cloudflarestorage.com`, region: 'auto',
    path: `/${c.bucket}/${key.split('/').map(enc).join('/')}`,
    accessKey: c.key, secret: c.secret, expires, headers,
    amz: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
  });
}

/**
 * توقيعُ SigV4 بسلسلةِ الاستعلام — دالّةٌ نقيّةٌ منفصلةٌ ليُختبَرَ على المثالِ الرسميِّ من وثائقِ
 * AWS («Authenticating Requests: Using Query Parameters»)؛ خطأُ حرفٍ واحدٍ هنا يرفضُ كلَّ رفع.
 */
export function signQuery({ method, host, region, path, accessKey, secret, expires, headers = {}, amz, service = 's3' }) {
  const day = amz.slice(0, 8);
  const scope = `${day}/${region}/${service}/aws4_request`;
  const hdrs = { host, ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])) };
  const names = Object.keys(hdrs).sort();
  const signed = names.join(';');
  const q = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': signed,
  };
  const qs = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join('&');
  const canonical = [method, path, qs, names.map((n) => `${n}:${hdrs[n]}\n`).join(''), signed, 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n');
  const kSign = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), service), 'aws4_request');
  const sig = crypto.createHmac('sha256', kSign).update(toSign).digest('hex');
  return `https://${host}${path}?${qs}&X-Amz-Signature=${sig}`;
}

/** رفعٌ من الخادم (مخرجاتُ معالجةِ الفيديو، شعاراتٌ مضمّنة، نسخُ مرفقاتِ ميتا) */
// كلّ مفتاحٍ بالمحرّك معرّفٌ عشوائيّ لا يُعاد استعماله (i/<id>/…، v/<id>/…): ما يُكتب
// لا يتغيّر أبداً، فيُخزَّن بالمتصفّح سنةً بلا سؤال. كانت الملفّات بلا ترويسة كاش
// إطلاقاً، فكلّ فتحٍ للمتجر يعيد السؤال عن كلّ غلاف فيديو.
const IMMUTABLE = 'public, max-age=31536000, immutable';

export async function putObject(key, body, contentType) {
  const size = body.length;
  const url = presign('PUT', key, { headers: { 'content-length': size, 'content-type': contentType, 'cache-control': IMMUTABLE } });
  const res = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': contentType, 'Content-Length': String(size), 'Cache-Control': IMMUTABLE } });
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return publicUrl(key);
}

export async function deleteObject(key) {
  const res = await fetch(presign('DELETE', key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}`);
}

/** رابطُ قراءةٍ موقّع — يُنزِّلُ به العاملُ الأصلَ الخامَ من الواجهةِ الخاصّةِ لا من عنوانِ التسليمِ العامّ */
export const signedGet = (key, expires = 3600) => presign('GET', key, { expires });

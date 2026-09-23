// محرّكُ وسائطِ بازارا — جانبُ المتصفّح.
//
// العملُ الثقيلُ يجري هنا على جهازِ التاجرة لا على خادمِنا: الصورةُ تُصغَّرُ لأربعةِ مقاساتٍ
// قبلَ الرفع، والفيديو يُرفَعُ أصلُه ومعه غلافٌ من الجهازِ نفسِه. ثمّ نطلبُ من الخادمِ روابطَ
// موقّعةً ونرفعُ إلى R2 مباشرةً — الخادمُ لا يحملُ البايتات (server/src/utils/r2.js).
//
// لماذا المقاساتُ عندنا لا بالتسليم: كلاوديناري كان يُولِّدُ كلَّ عرضٍ عند الطلبِ ويحسبُه من
// رصيدٍ محدودٍ أوقفَ الموقعَ كلَّه. هنا تُولَّدُ مرّةً واحدةً عند الرفعِ ولا يُحسَبُ التسليمُ أبداً.
//
// شبكةُ أمان: إن ردَّ الخادمُ «المحرّكُ مطفأ» (لا مفاتيحَ R2 بعد) عُدنا لكلاوديناري كما كان —
// فالكودُ يُنشَرُ اليومَ بلا خطر، ويعملُ المحرّكُ لحظةَ تُضافُ المفاتيح.

import api from '../api/client.js';
import { uploadToCloudinary, cloudinaryEnabled } from './cloudinary.js';

// الأسماءُ عقدٌ مع الخادمِ ومع مشتقّاتِ الروابطِ بـcloudinary.js — لا تُغيَّرُ من طرفٍ واحد
const WIDTHS = [32, 480, 960, 1600];
const MAX_VIDEO = 400 * 1024 * 1024;
let engineOff = false; // «مطفأ» يُتذكَّرُ للجلسة: لا نسألُ الخادمَ عن كلِّ ملفٍّ من جديد

class EngineOff extends Error {}

/** رفعٌ برابطٍ موقّع (PUT) مع التقدّم. النوعُ والحجمُ داخلانِ بالتوقيع فيجبُ أن يطابقا */
function putFile(url, blob, type, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('فشل الرفع.')));
    xhr.onerror = () => reject(new Error('تعذّر الاتصال بخادم الرفع.'));
    xhr.send(blob);
  });
}

async function presign(kind, parts) {
  try {
    const { data } = await api.post('/media/presign', { kind, parts: parts.map(({ name, blob }) => ({ name, size: blob.size })) });
    return data;
  } catch (e) {
    if (e?.response?.status === 503 && e.response.data?.error === 'media_engine_off') throw new EngineOff();
    throw new Error(e?.response?.data?.error || 'تعذّر تجهيز الرفع.');
  }
}

/** يرفعُ الأجزاءَ بالتتابعِ ويجمعُ التقدّمَ نسبةً واحدةً (٠–١٠٠) بحسبِ الحجم */
async function putAll(signed, parts, onProgress, span = [0, 100]) {
  const total = parts.reduce((a, p) => a + p.blob.size, 0) || 1;
  let done = 0;
  for (const p of parts) {
    const s = signed.put[p.name];
    await putFile(s.url, p.blob, s.type, (f) => {
      if (onProgress) onProgress(Math.round(span[0] + ((done + f * p.blob.size) / total) * (span[1] - span[0])));
    });
    done += p.blob.size;
  }
}

/* ═════════ الصور ═════════ */

const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // المتصفّحُ يطبّقُ اتّجاهَ EXIF تلقائياً — صورُ الجوّالِ لا تنقلب
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function encode(img, w, type, q) {
  const scale = Math.min(1, w / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return toBlob(c, type, q);
}

async function uploadImage(file, onProgress, { jpeg = false } = {}) {
  const img = await loadImage(file);
  // WebP حيث يدعمُه المتصفّح (نتحقّقُ بالنتيجةِ لا بالتخمين: Safari القديمُ يُعيدُ PNG بصمت).
  // وإلّا: PNG لما قد يحملُ شفافيّة (شعارات) كي لا تسودَّ خلفيّتُه، وJPEG لغيرِه.
  // وjpeg إجباريّ لما تجلبُه ميتا (مرفقاتُ إنستغرام) — لا تقبلُ WebP.
  let type = 'image/webp', ext = 'webp';
  const probe = jpeg ? null : await encode(img, 32, type, 0.5);
  if (jpeg) { type = 'image/jpeg'; ext = 'jpg'; }
  else if (!probe || probe.type !== 'image/webp') {
    const alpha = /png|webp|gif|svg/i.test(file.type);
    type = alpha ? 'image/png' : 'image/jpeg';
    ext = alpha ? 'png' : 'jpg';
  }
  const parts = [];
  for (const w of WIDTHS) {
    const blob = w === 32 && ext === 'webp' ? probe : await encode(img, w, type, w === 32 ? 0.5 : 0.82);
    if (!blob) throw new Error('تعذّر تجهيز الصورة.');
    parts.push({ name: `${w}.${ext}`, blob });
  }
  const signed = await presign('image', parts);
  await putAll(signed, parts, onProgress);
  return `${signed.base}/1600.${ext}`;
}

/* ═════════ الفيديو ═════════ */

/** غلافٌ من الجهازِ نفسِه — يظهرُ فوراً ريثما يُعالَجُ الفيديو. فشلُه لا يُفشلُ الرفع */
function posterFrom(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const done = (b) => { URL.revokeObjectURL(url); resolve(b); };
    const timer = setTimeout(() => done(null), 8000);
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    v.onerror = () => { clearTimeout(timer); done(null); };
    v.onloadeddata = () => { v.currentTime = Math.min(0.3, (v.duration || 1) / 2); };
    v.onseeked = async () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, 720 / Math.min(v.videoWidth, v.videoHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        done(await toBlob(c, 'image/jpeg', 0.8));
      } catch { done(null); }
    };
  });
}

function videoExt(file) {
  const m = /\.(mov|mp4|m4v|webm|3gp)$/i.exec(file.name || '');
  if (m) return m[1].toLowerCase();
  if (/quicktime/.test(file.type)) return 'mov';
  if (/webm/.test(file.type)) return 'webm';
  return 'mp4';
}

async function uploadVideo(file, onProgress) {
  if (file.size > MAX_VIDEO) throw new Error('الفيديو أكبر من ٤٠٠ ميغا. جرّبي مقطعاً أقصر.');
  const src = `src.${videoExt(file)}`;
  const poster = await posterFrom(file);
  const parts = [{ name: src, blob: file }];
  if (poster) parts.push({ name: 'poster.jpg', blob: poster });
  const signed = await presign('video', parts);
  await putAll(signed, parts, onProgress, [0, 97]);
  const { data } = await api.post(`/media/video/${signed.id}/process`, { src });
  if (onProgress) onProgress(100);
  return data.url;
}

/* ═════════ الصوت (رسائلُ إنستغرام) ═════════ */

async function uploadAudio(file, onProgress) {
  const m = /\.(webm|m4a|mp4|ogg|aac|wav)$/i.exec(file.name || '');
  const src = `src.${m ? m[1].toLowerCase() : (/webm/.test(file.type) ? 'webm' : 'm4a')}`;
  const parts = [{ name: src, blob: file }];
  const signed = await presign('audio', parts);
  await putAll(signed, parts, onProgress, [0, 90]);
  // يُحوَّلُ MP3 بالطلبِ نفسِه (ثوانٍ) فيعودُ الرابطُ جاهزاً لميتا
  const { data } = await api.post(`/media/audio/${signed.id}/process`, { src });
  if (onProgress) onProgress(100);
  return data.url;
}

/* ═════════ الواجهةُ العامّة ═════════ */

/**
 * يرفعُ صورةً أو فيديو أو صوتاً ويعيدُ رابطَه الدائم: المحرّكُ أوّلاً، ثمّ كلاوديناري، ثمّ null
 * (لا وسيلةَ رفع — المُستدعي يقرّرُ البديل، كـdata URL للصورِ الصغيرة).
 * kind: 'image' | 'video' | 'audio'   ·   opts.jpeg: صورةٌ ستجلبُها ميتا (لا تقبلُ WebP)
 */
export async function uploadMedia(file, kind, onProgress, opts = {}) {
  if (!engineOff) {
    try {
      if (kind === 'video') return await uploadVideo(file, onProgress);
      if (kind === 'audio') return await uploadAudio(file, onProgress);
      return await uploadImage(file, onProgress, opts);
    } catch (e) {
      if (!(e instanceof EngineOff)) throw e;
      engineOff = true;
    }
  }
  // كلاوديناري يضعُ الصوتَ تحت نوعِ video — وهو مسارُه لكلِّ ما ليس صورة
  if (cloudinaryEnabled) return uploadToCloudinary(file, kind === 'audio' ? 'video' : kind, onProgress);
  return null;
}

const VID_ID = /\/v\/([a-f0-9]{32})\/720\.mp4$/;

/**
 * ينتظرُ حتّى يجهزَ فيديو المحرّك (يُعالَجُ على الخادمِ بعد الرفع). لمن يحتاجُ الملفَّ فوراً:
 * ميتا تجلبُ المرفقَ لحظةَ الإرسال، والستوري تُعرَضُ للزبوناتِ حالَ نشرِها.
 * رابطٌ من غيرِ المحرّكِ يعودُ فوراً. يرمي إن فشلت المعالجة.
 */
export async function waitVideoReady(url, { timeoutMs = 6 * 60 * 1000, onTick } = {}) {
  const id = VID_ID.exec(String(url || ''))?.[1];
  if (!id) return url;
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const { data } = await api.get(`/media/video/${id}`);
    if (data.status === 'done') return url;
    if (data.status === 'error') throw new Error('تعذّرت معالجة الفيديو. جرّبي ملفاً آخر.');
    if (onTick) onTick(Date.now() - t0);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('المعالجة تأخّرت أكثر من المعتاد. جرّبي بعد قليل.');
}

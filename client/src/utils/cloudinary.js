import { CLOUDINARY_CLOUD, CLOUDINARY_PRESET } from '../config/site.js';

// هل الرفع المباشر مفعّل؟ (تمّت تهيئة Cloudinary)
export const cloudinaryEnabled = Boolean(CLOUDINARY_CLOUD && CLOUDINARY_PRESET);

// صورة غلاف (أول لقطة) من فيديو Cloudinary — تظهر بكل الأجهزة بما فيها iOS.
// نبنيها من قاعدة الفيديو النظيفة حتى لا تتضارب مع تحويلات الفيديو (f_mp4/vc_h264)
// التي كانت تُنتج رابطاً معطوباً (صورة سوداء/علامة استفهام).
export function cldVideoPoster(url, width = 800) {
  const p = cldVideoParts(url);
  if (!p) return '';
  return `${p.base}so_0,f_jpg,q_auto,w_${width},c_limit/${p.rest}.jpg`; // لقطة الثانية 0 كـ jpg مُهيّأة الحجم
}

// يفكّك رابط فيديو Cloudinary لأجزائه (القاعدة + المعرّف) متجاهلاً أي تحويلات قديمة
function cldVideoParts(url) {
  const m = String(url || '').match(/^(https?:\/\/[^/]+\/[^/]+\/video\/upload\/)(.+)$/);
  if (!m) return null;
  const segs = m[2].split('/');
  let vi = segs.findIndex((s) => /^v\d+$/.test(s)); // جزء الإصدار v123… — ما قبله تحويلات قديمة نتجاهلها
  if (vi === -1) vi = segs.length - 1;
  return { base: m[1], rest: segs.slice(vi).join('/').replace(/\.[a-z0-9]+(\?.*)?$/i, '') };
}

// رابط فيديو متوافق مع كل المتصفّحات وiOS: mp4 بترميز H.264. كثير من فيديوهات
// الآيفون تُرفَع بصيغة MOV/HEVC لا يشغّلها المتصفّح (معاينة سوداء)، فنجبر التسليم mp4.
// idempotent: يعمل على الروابط الأصلية والمحوّلة سابقاً على حدٍّ سواء.
export function cldVideoMp4(url, width = 1080) {
  const p = cldVideoParts(url);
  if (!p) return url; // رابط غير كلاوديناري — كما هو
  return `${p.base}f_mp4,vc_h264,q_auto,w_${width},c_limit/${p.rest}.mp4`;
}

// رابط محسّن بجودة عالية (صيغة تلقائية + أعلى جودة بصرية، بدون فقدان ملحوظ)
export function cldOptimized(url, kind = 'image') {
  if (typeof url !== 'string' || !url.includes('/upload/')) return url;
  // الفيديو: نُجبر mp4/H.264 ليشتغل على كل الأجهزة (خاصة MOV/HEVC من الآيفون)
  if (kind === 'video') return cldVideoMp4(url);
  return url.replace('/upload/', `/upload/f_auto,q_auto:best,dpr_auto/`);
}

// صورة مصغّرة محسّنة للشبكات (بطاقات المنتجات) — تقلّل الحجم كثيراً وتسرّع التحميل.
// width بالبكسل (الحد الأقصى)؛ المتصفّح يصغّرها للعرض المطلوب.
export function cldThumb(url, width = 500) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return url;
  if (url.includes('/video/upload/')) return url; // بوستر الفيديو مُهيّأ الحجم مسبقاً — لا نضاعف التحويلات
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit,dpr_auto/`);
}

// مجموعة أحجام لـ srcset: المتصفّح يختار الأنسب لعرض العنصر وكثافة الشاشة معاً،
// فبطاقة بعرض 180px على جوال تنزّل ~200px بدل 500px (توفير بيانات ملموس).
// بلا dpr_auto عمداً — واصفات w تتكفّل بالكثافة، وجمعهما معاً يضاعف الحجم بلا داعٍ.
export function cldSrcSet(url, widths = [200, 300, 400, 600, 800]) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return undefined;
  if (url.includes('/video/upload/')) return undefined; // بوستر الفيديو مُهيّأ مسبقاً
  return widths
    .map((w) => `${url.replace('/upload/', `/upload/f_auto,q_auto,w_${w},c_limit/`)} ${w}w`)
    .join(', ');
}

// نسخة ضئيلة ضبابية (LQIP) تُعرض خلف الصورة حتى تجهز — تصل خلال أجزاء من الثانية
// (بضعة كيلوبايت) فترى الزبونة ملامح القطعة وألوانها فوراً بدل مربّع رمادي.
export function cldBlur(url, width = 32) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return undefined;
  if (url.includes('/video/upload/')) return undefined; // بوستر الفيديو — بلا نسخة ضبابية مشتقّة
  return url.replace('/upload/', `/upload/f_auto,q_auto:low,w_${width},e_blur:600,c_limit/`);
}

// رسالة خطأ ودّية بالعربي بدل رسائل Cloudinary التقنية (خاصة تجاوز الحجم)
function friendlyUploadError(msg) {
  if (typeof msg === 'string' && /(file size too large|maximum is|too large)/i.test(msg)) {
    return 'حجم الفيديو كبير جداً على باقة الرفع الحالية. جرّبي فيديو أقصر أو بجودة أقل.';
  }
  return msg || 'فشل الرفع.';
}

// رفعة HTTP واحدة (جزء أو ملف كامل) عبر XHR — تدعم شريط التقدّم وترويسات الرفع المجزّأ.
function xhrUpload(url, blob, { headers = {}, onProgress } = {}) {
  const form = new FormData();
  form.append('file', blob);
  form.append('upload_preset', CLOUDINARY_PRESET);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total); };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(res);
        else reject(new Error(friendlyUploadError(res?.error?.message)));
      } catch {
        reject(new Error('فشل الرفع.'));
      }
    };
    xhr.onerror = () => reject(new Error('تعذّر الاتصال بخادم الرفع.'));
    xhr.send(form);
  });
}

// رفع ملف (صورة/فيديو) مباشرة من جهاز المستخدم إلى Cloudinary، ويعيد الرابط الآمن.
// الملفات الكبيرة (خاصة فيديو الآيفون MOV) تُرفَع مجزّأة (Content-Range) لتجاوز
// حدّ الطلب الواحد (~100MB) الذي كان يُفشل رفع الفيديوهات الكبيرة عند إضافة منتج.
// resourceType: 'video' | 'image' | 'auto'
export async function uploadToCloudinary(file, resourceType = 'auto', onProgress) {
  if (!cloudinaryEnabled) throw new Error('الرفع المباشر غير مُهيّأ.');

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;
  const CHUNK = 20 * 1024 * 1024; // 20MB لكل جزء (أكبر من حدّ Cloudinary الأدنى 5MB)

  // ملف صغير: رفعة واحدة عادية
  if (file.size <= CHUNK) {
    const res = await xhrUpload(url, file, { onProgress: (l, tt) => onProgress && onProgress(Math.round((l / tt) * 100)) });
    if (!res.secure_url) throw new Error('فشل الرفع.');
    return res.secure_url;
  }

  // ملف كبير: رفع مجزّأ متسلسل — كل الأجزاء تشترك بمعرّف واحد، والأخير يعيد الرابط
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const total = file.size;
  let start = 0;
  let last = null;
  while (start < total) {
    const end = Math.min(start + CHUNK, total);
    const chunk = file.slice(start, end);
    const chunkStart = start;
    last = await xhrUpload(url, chunk, {
      headers: {
        'X-Unique-Upload-Id': uniqueId,
        'Content-Range': `bytes ${chunkStart}-${end - 1}/${total}`,
      },
      onProgress: (loaded) => { if (onProgress) onProgress(Math.round(((chunkStart + loaded) / total) * 100)); },
    });
    start = end;
  }
  if (!last?.secure_url) throw new Error('فشل الرفع.');
  return last.secure_url;
}

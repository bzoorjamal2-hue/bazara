import { CLOUDINARY_CLOUD, CLOUDINARY_PRESET } from '../config/site.js';

// هل الرفع المباشر مفعّل؟ (تمّت تهيئة Cloudinary)
export const cloudinaryEnabled = Boolean(CLOUDINARY_CLOUD && CLOUDINARY_PRESET);

// صورة غلاف (أول لقطة) من فيديو Cloudinary — تظهر بكل الأجهزة بما فيها iOS
export function cldVideoPoster(url) {
  if (typeof url !== 'string') return '';
  if (!/res\.cloudinary\.com\/.+\/video\/upload\//.test(url)) return '';
  let poster = url.replace(/\.(mp4|mov|webm|m4v|avi|mkv|ogv)(\?.*)?$/i, '.jpg');
  poster = poster.replace('/upload/', '/upload/so_0/'); // اللقطة عند الثانية 0
  return poster;
}

// رابط محسّن بجودة عالية (صيغة تلقائية + أعلى جودة بصرية، بدون فقدان ملحوظ)
export function cldOptimized(url, kind = 'image') {
  if (typeof url !== 'string' || !url.includes('/upload/')) return url;
  const tr = kind === 'video' ? 'f_auto,q_auto:best' : 'f_auto,q_auto:best,dpr_auto';
  return url.replace('/upload/', `/upload/${tr}/`);
}

// رفع ملف (صورة/فيديو) مباشرة من جهاز المستخدم إلى Cloudinary، ويعيد الرابط الآمن.
// resourceType: 'video' | 'image' | 'auto'
export async function uploadToCloudinary(file, resourceType = 'auto', onProgress) {
  if (!cloudinaryEnabled) throw new Error('الرفع المباشر غير مُهيّأ.');

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url);
        else reject(new Error(res?.error?.message || 'فشل الرفع.'));
      } catch {
        reject(new Error('فشل الرفع.'));
      }
    };
    xhr.onerror = () => reject(new Error('تعذّر الاتصال بخادم الرفع.'));
    xhr.send(form);
  });
}

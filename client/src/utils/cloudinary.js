import { CLOUDINARY_CLOUD, CLOUDINARY_PRESET } from '../config/site.js';

// هل الرفع المباشر مفعّل؟ (تمّت تهيئة Cloudinary)
export const cloudinaryEnabled = Boolean(CLOUDINARY_CLOUD && CLOUDINARY_PRESET);

// صورة غلاف (أول لقطة) من فيديو Cloudinary — تظهر بكل الأجهزة بما فيها iOS.
// نبنيها من قاعدة الفيديو النظيفة حتى لا تتضارب مع تحويلات الفيديو (f_mp4/vc_h264)
// التي كانت تُنتج رابطاً معطوباً (صورة سوداء/علامة استفهام).
export function cldVideoPoster(url, width = 500) {
  return cldFrom(url, `f_auto,q_auto,w_${width},c_limit`) || '';
}

// يبني تحويلاً على مصدرٍ من كلاوديناري صورةً كان أو فيديو.
// الفيديو يحتاجُ ‎so_0 (لقطةُ الثانيةِ صفر) ومساراً نظيفاً بلا تحويلاتٍ سابقة،
// والصورةُ يكفيها حقنُ التحويلِ بعدَ ‎/upload/. وكانت أدواتُ الصورِ الثلاثُ
// ‏(مصغّرة · srcset · ضبابيّة) تنسحبُ أمامَ الفيديو وتردُّ الرابطَ كما هو —
// فبطاقةُ منتجٍ بلا صورةٍ تُنزّلُ لقطةً بعرضِ ٨٠٠ مهما صَغُرَ مقاسُها بالشاشة،
// بلا نسخةٍ ضبابيّةٍ ولا اختيارِ مقاس. ومتجرٌ كلُّ بضاعتِه فيديو = ميغابايتٌ
// من اللقطاتِ بالصفحةِ الواحدة.
function cldFrom(url, transform) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return '';
  if (url.includes('/video/upload/')) {
    const v = cldVideoParts(url);
    return v ? `${v.base}so_0,${transform}/${v.rest}` : '';
  }
  const m = url.match(/^(https?:\/\/[^/]+\/[^/]+\/image\/upload\/)(.+)$/);
  if (!m) return url.replace('/upload/', `/upload/${transform}/`);
  // ما قبلَ جزءِ الإصدارِ ‎(v123…) تحويلاتٌ سابقةٌ نُسقِطُها: الروابطُ تُخزَّنُ
  // محوّلةً منذ الرفع، فحقنُ تحويلٍ فوقَها يُنتِجُ سلسلةً تغلبُ فيها الجودةُ
  // المخزَّنةُ ‎(q_auto:best) على المطلوبةِ فتعودُ الصورةُ بأضعافِ حجمِها.
  const segs = m[2].split('/');
  let vi = segs.findIndex((x) => /^v\d+$/.test(x));
  if (vi === -1) vi = segs.length - 1;
  return `${m[1]}${transform}/${segs.slice(vi).join('/')}`;
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
export function cldVideoMp4(url, width = 720, quality = 'q_auto') {
  const p = cldVideoParts(url);
  if (!p) return url; // رابط غير كلاوديناري — كما هو
  return `${p.base}f_mp4,vc_h264,${quality},w_${width},c_limit/${p.rest}.mp4`;
}

// عرضُ فيديو الهيرو حسبَ الشاشةِ لا مقاسٌ واحدٌ للجميع.
//
// كان ‎720 بكسلاً للكلّ: كافياً لجوّالٍ عرضُه ثلاثُ مئةٍ وستّون، ونصفَ ما تحتاجُه
// شاشةُ حاسوبٍ عرضُها ألفٌ وثلاثُ مئةٍ وستّةٌ وستّون — فيُمدَّدُ الفيديو ويُغبَّش.
// والمصدرُ عرضُه ألفٌ وأربعُ مئةٍ وأربعون، فنصفُ دقّتِه كان يُهدَرُ.
//
// وليس المقاسُ الأكبرُ للجميعِ حلّاً: الوسائطُ كلُّها على حسابِ كلاوديناري
// مجّانيٍّ محدود، وتجاوزُه يُخفي صورَ الموقعِ كلَّها. فالجوّالُ يبقى على ‎720
// ‏(خمسةُ ميغا) والحاسوبُ يأخذُ ‎1440 بجودةٍ اقتصاديّةٍ ‏(عشرةُ ميغا) — قِستُ
// البدائلَ: ‎1440 بجودةٍ عاديّةٍ اثنا عشرَ ميغا ونصف، والاقتصاديّةُ لا يُلحَظُ
// فرقُها على فيديو متحرّك.
export function heroVideoWidth() {
  if (typeof window === 'undefined') return 1080;
  const w = window.innerWidth;
  if (w <= 640) return 720;
  if (w <= 1280) return 1080;
  return 1440;
}

// فيديو الهيرو مقصوصاً بنسبةِ الصندوقِ الذي سيملؤُه — كما تفعلُ heroCrop بالصور.
//
// ‏c_limit لا يقصّ، إنّما يحدّ العرض. فكان الجوّالُ يُنزّلُ فيديو 720×378 عريضاً
// ثمّ يمدُّه المتصفّحُ ليملأَ صندوقاً 375×680 طوليّاً: تكبيرٌ 1.8× بالبكسل
// المنطقيّ (3.6× على شاشةٍ بكثافةٍ مضاعفة) — وهو الغبش. والأسوأُ أنّ 71٪ من
// عرضِ الفيديو المُنزَّلِ يقعُ خارجَ الشاشةِ ويُرمى: ندفعُ بايتاتٍ لبكسلاتٍ لا
// تُرى، ونُجوِّعُ التي تُرى.
//
// ‏c_fill + ar: كلاوديناري يقصُّ عندَه بالنسبةِ المطلوبة فتصلُ البكسلاتُ حيث تُرى.
//
// وبلا ‎g_auto قصداً — جرّبتُه فردَّ الخادمُ ثلاثةَ أخطاءٍ تشرحُ نفسَها:
//   ‏c_lfill,g_auto      → 400 «g_auto only supports fill,fill_pad»
//   ‏c_fill,g_auto,ar_   → 400 «g_auto must be in a transformation component by itself»
//   ‏g_auto/… (مسلسلاً)  → 423 «Video tracking-crop is pending»
// فالثالثةُ تكشفُ أنّ قصَّ الفيديو الذكيَّ وظيفةٌ غيرُ متزامنةٍ تُنتَجُ بطلبٍ أوّلٍ
// يفشل: الهيرو يبقى بلا فيديو حتى تنتهي، وتستهلكُ من رصيدٍ محدودٍ أصلاً. والقصُّ
// هنا أفقيٌّ لا رأسيّ (عريضٌ ← طوليّ) فالقامةُ كاملةٌ بأيِّ حال، والعارضةُ
// بالمنتصفِ عادةً — فالمركزُ يكفي ولا يستحقُّ المخاطرة.
export function cldVideoCrop(url, width, ar, quality = 'q_auto') {
  const p = cldVideoParts(url);
  if (!p) return url;
  if (!ar) return cldVideoMp4(url, width, quality);
  return `${p.base}f_mp4,vc_h264,${quality},w_${width},c_fill,ar_${ar}/${p.rest}.mp4`;
}

// شكلُ فيديو الهيرو لكلِّ شاشة: عرضٌ ونسبةٌ وجودة.
// النسبةُ هي الجديد. والصندوقُ على الجوّالِ طوليٌّ (‎375×560 ≈ 2:3) فنقصُّ 4:5 —
// أقربُ نسبةٍ شائعةٍ تملؤُه بتصغيرٍ لا بتكبير. وعلى الشاشةِ العريضةِ يبقى عريضاً.
//
// وعرضُ الجوّالِ 540 لا 720: مقصوصاً بـ4:5 يصيرُ 540×675 = 364 ألفَ بكسل، مقابل
// 720×378 = 272 ألفاً اليوم. زيادةٌ 34٪ بالبايتات، لكنّ المرئيَّ منها كان 29٪
// فقط — فالبكسلاتُ النافعةُ تتضاعفُ أربعَ مرّاتٍ ونصفاً بثلثِ زيادةٍ بالحجم.
export function heroVideoShape() {
  // والجودةُ اقتصاديّةٌ بكلِّ المقاسات: خلفيّةُ الهيرو معتَّمةٌ بالنصفِ وفوقَها
  // عنوانٌ وأزرار، وهي متحرّكةٌ — ثلاثةُ أسبابٍ يختفي معها فرقُ الجودةِ تماماً،
  // ويبقى التوفيرُ خُمسَ الحجمِ إلى ربعِه. كانت ‎eco للشاشةِ العريضةِ وحدَها،
  // وهي أوسعُ الشاشاتِ بياناً وأقلُّها حاجةً للتوفير — والجوّالُ العكس.
  if (typeof window === 'undefined') return { w: 1080, ar: '16:10', q: 'q_auto:eco' };
  const w = window.innerWidth;
  if (w <= 640) return { w: 540, ar: '4:5', q: 'q_auto:eco' };
  if (w <= 1280) return { w: 1080, ar: '16:10', q: 'q_auto:eco' };
  return { w: 1440, ar: '16:9', q: 'q_auto:eco' };
}

// شبكةٌ ضعيفةٌ أو وضعُ توفيرِ بيانات؟ لا فيديو أصلاً — اللقطةُ الثابتةُ تكفي.
//
// اللقطةُ مقصوصةٌ بنسبةِ الصندوقِ نفسِها ومأخوذةٌ من أوّلِ إطارِ الفيديو، فالهيرو
// يبقى كما هو شكلاً؛ ما يُفقَدُ الحركةُ وحدَها. وهي مقايضةٌ سهلة: زبونةٌ على
// شبكةِ بياناتٍ بطيئةٍ تفضّلُ صفحةً تفتحُ على ميغابايتٍ يمشي خلفَ نصّ.
//
// و‎saveData صريحٌ من الزبونةِ نفسِها (وضعُ توفيرِ البياناتِ بالمتصفّح) —
// تجاهلُه بعدَ أن تطلبَه سوءُ أدب.
export function heroVideoAllowed() {
  if (typeof navigator === 'undefined') return true;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return true;
  if (c.saveData) return false;
  return !['slow-2g', '2g'].includes(c.effectiveType);
}

// نسخة معاينة صامتة: عرض صغير وجودة اقتصاديّة. تُستعمل حيث يُشغَّل الفيديو تلقائياً
// بلا قصدٍ صريح من الزبونة (معاينة بطاقة المنتج) — البطاقة عرضها ~300px فلا معنى
// لتنزيل 720px عليها. الفرق البصري في مربّع صغير معدوم، والتوفير أضعاف.
export function cldVideoPreview(url, width = 480) {
  const p = cldVideoParts(url);
  if (!p) return url;
  return `${p.base}f_mp4,vc_h264,q_auto:eco,w_${width},c_limit/${p.rest}.mp4`;
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
  return cldFrom(url, `f_auto,q_auto,w_${width},c_limit,dpr_auto`) || url;
}

// مجموعة أحجام لـ srcset: المتصفّح يختار الأنسب لعرض العنصر وكثافة الشاشة معاً،
// فبطاقة بعرض 180px على جوال تنزّل ~200px بدل 500px (توفير بيانات ملموس).
// بلا dpr_auto عمداً — واصفات w تتكفّل بالكثافة، وجمعهما معاً يضاعف الحجم بلا داعٍ.
export function cldSrcSet(url, widths = [200, 300, 400, 600, 800]) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return undefined;
  const set = widths
    .map((w) => [cldFrom(url, `f_auto,q_auto,w_${w},c_limit`), w])
    .filter(([u]) => u)
    .map(([u, w]) => `${u} ${w}w`);
  return set.length ? set.join(', ') : undefined;
}

// نسخة ضئيلة ضبابية (LQIP) تُعرض خلف الصورة حتى تجهز — تصل خلال أجزاء من الثانية
// (بضعة كيلوبايت) فترى الزبونة ملامح القطعة وألوانها فوراً بدل مربّع رمادي.
export function cldBlur(url, width = 32) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return undefined;
  return cldFrom(url, `f_auto,q_auto:low,w_${width},e_blur:600,c_limit`) || undefined;
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

// نسخةٌ من صورةِ هيرو بنسبةٍ وعرضٍ محدَّدَين — للصفحةِ الرئيسيّةِ وصفحاتِ المتاجرِ
// معاً. تتجاهلُ أيَّ تحويلاتٍ قديمةٍ بالرابطِ فلا تتراكم، وتعملُ على الصورةِ وعلى
// لقطةِ الفيديو. وتُعيدُ فراغاً لأيِّ رابطٍ آخرَ (base64 أو مستضافٍ خارجاً) —
// وعندها يعملُ الاحتياطيُّ بالوسمِ ولا يسقطُ الهيرو.
//
// ‏c_lfill لا c_fill: الثانيةُ تُكبّرُ المصدرَ ليبلغَ العرضَ المطلوب، والتكبيرُ لا
// يُضيفُ تفصيلاً بل يُذيبُه. الأولى تقصُّ للنسبةِ ولا تتجاوزُ دقّةَ الأصلِ أبداً.
export function heroCrop(url, w, ar) {
  const s = String(url || '');
  const m = s.match(/^(https?:\/\/[^/]+\/[^/]+\/(image|video)\/upload\/)(.+)$/);
  if (!m) return '';
  const segs = m[3].split('/');
  let vi = segs.findIndex((x) => /^v\d+$/.test(x));
  if (vi === -1) vi = segs.length - 1;
  const rest = segs.slice(vi).join('/').replace(/\.[a-z0-9]+$/i, '');
  const frame = m[2] === 'video' ? 'so_0,' : '';
  return `${m[1]}${frame}f_auto,q_auto:best,w_${w},c_lfill,g_auto,ar_${ar},e_sharpen:60/${rest}.jpg`;
}

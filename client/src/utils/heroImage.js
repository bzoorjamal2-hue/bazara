// صورة الهيرو تأتي برابطٍ يلصقه المدير — قد يكون رفعاً عبر كلاوديناري، وقد
// يكون رابطاً خارجياً. وهي أثقل صورةٍ بالموقع وأوّلُ ما يُرسم، فتنزيلُها بعرضٍ
// أكبر ممّا تُعرض به هدرٌ مباشر على أوّل انطباع: قِستُ ١٩٢٠px تُنزَّل لمساحةٍ
// تحتاج ٧٥٠ — أي ٢٫٦ أضعاف، ١١١ كيلو بدل نحو ٤٠.
//
// نولّد srcset فقط لمن نعرف كيف نغيّر عرضه بأمان — كلاوديناري وأنسبلاش، وكلاهما
// يوثّق مُعامل العرض. وأيُّ مضيفٍ آخر يبقى كما هو بلا تخمين: رابطٌ مكسورٌ أسوأ
// من صورةٍ ثقيلة.

const WIDTHS = [640, 828, 1080, 1440, 1920];

function cloudinaryAt(url, w) {
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${w},c_limit/`);
}

function unsplashAt(url, w) {
  try {
    const u = new URL(url);
    u.searchParams.set('w', String(w));
    if (!u.searchParams.has('auto')) u.searchParams.set('auto', 'format');
    if (!u.searchParams.has('q')) u.searchParams.set('q', '80');
    return u.toString();
  } catch {
    return url;
  }
}

function resizerFor(url) {
  if (typeof url !== 'string' || !url) return null;
  if (url.includes('/upload/') && url.includes('cloudinary')) return cloudinaryAt;
  if (/(^|\.)images\.unsplash\.com/.test(safeHost(url))) return unsplashAt;
  return null;
}

function safeHost(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

/** srcset للهيرو، أو undefined إن كان المضيف غير معروفٍ لنا فلا نعبث برابطه. */
export function heroSrcSet(url) {
  const at = resizerFor(url);
  if (!at) return undefined;
  return WIDTHS.map((w) => `${at(url, w)} ${w}w`).join(', ');
}

/** الرابط الافتراضي (src): عرضٌ متوسّط يناسب أغلب الشاشات إن تجاهل المتصفّح srcset. */
export function heroSrc(url) {
  const at = resizerFor(url);
  return at ? at(url, 1440) : url;
}

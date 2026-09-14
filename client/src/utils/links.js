import { SITE_URL } from '../config/site.js';

/**
 * روابطُ المنصّة — مصدرٌ واحدٌ لكلِّ رابطٍ يُعرَض أو يُنسَخ أو يُشارَك.
 *
 * قاعدتان:
 * ١) كلُّ رابطِ منتجٍ يحملُ اسمَ متجرِه: bazarastore.site/store/<المتجر>/product/<المعرّف>
 *    فيعرفُ من يستلمُه من أيِّ متجرٍ هو قبل أن يفتحَه، ويبقى اسمُ المتجرِ ظاهراً
 *    بشريطِ العنوانِ ما دامت الزبونةُ داخلَه.
 * ٢) الروابطُ المنسوخةُ تُبنى على الدومينِ الرسميِّ لا على ما يصادفُ أن يكونَ
 *    في شريطِ العنوان: النسخُ من localhost أو من دومينِ معاينةٍ كان يُنتجُ رابطاً
 *    لا يفتحُ عند أحدٍ غير صاحبِه.
 */

// أصلٌ صالحٌ للمشاركة: الدومينُ الحاليُّ إن كان دوماً عامّاً حقيقياً، وإلا الرسميّ
export function siteOrigin() {
  if (typeof window !== 'undefined') {
    const o = window.location.origin || '';
    const local = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|\[)/i.test(o);
    if (/^https?:\/\//i.test(o) && !local) return o;
  }
  return SITE_URL;
}

// مسارُ المنتجِ داخلَ الموقع (للتنقّلِ الداخليّ بـLink/navigate)
export function productPath(product, { color = '' } = {}) {
  if (!product?.id) return '/shop';
  const slug = product.storeSlug || product.slug || '';
  const base = slug ? `/store/${slug}/product/${product.id}` : `/product/${product.id}`;
  return color ? `${base}?color=${encodeURIComponent(color)}` : base;
}

// الرابطُ الكاملُ للمنتج (للنسخِ والمشاركةِ وبطاقاتِ المعاينة)
export function productUrl(product, opts) {
  return `${siteOrigin()}${productPath(product, opts)}`;
}

// صفحاتُ المتجرِ الداخليّة: تحملُ اسمَه بالمسارِ لا بالاستعلام، فيبقى ظاهراً
// بشريطِ العنوانِ وفي كلِّ رابطٍ تنسخُه الزبونةُ من داخلِ المتجر.
export const trackPath = (slug) => (slug ? `/store/${slug}/track` : '/track');
export function searchPath(slug, q = '') {
  const base = slug ? `/store/${slug}/search` : '/search';
  return q ? `${base}?q=${encodeURIComponent(q)}` : base;
}

// مسارُ المتجرِ ورابطُه الكامل (ref = كودُ الإحالةِ إن وُجد)
export const storePath = (slug) => (slug ? `/store/${slug}` : '/shop');
export function storeUrl(slug, { ref = '' } = {}) {
  return `${siteOrigin()}${storePath(slug)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
}

/**
 * نسخُ نصٍّ إلى الحافظة بكلِّ الطرقِ الممكنة.
 *
 * navigator.clipboard غيرُ متاحٍ خارجَ السياقِ الآمن وقد يرفضُه متصفّحُ التطبيقِ
 * المدمج، وكان الرفضُ يُبتلَع بصمتٍ في catch فارغ: تضغطُ التاجرةُ «نسخ» فلا يحدثُ
 * شيءٌ ولا تعرفُ لماذا. الآن نجرّبُ الحافظةَ ثمّ الطريقةَ القديمة (execCommand)،
 * ونعيدُ false إن فشلتا كلتاهما فيعرضُ النداءُ الرابطَ لتنسخَه يدوياً.
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* نجرّب الطريقة القديمة */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    // خارجَ الشاشةِ بلا تمريرٍ للصفحة، ومع تفادي تكبيرِ iOS التلقائيِّ للحقول
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * مشاركةُ رابطٍ: ورقةُ المشاركةِ الأصليةُ إن وُجدت، وإلا نسخٌ إلى الحافظة.
 * تُعيد: 'shared' | 'copied' | 'failed' — ليقرّرَ النداءُ ما يعرضُه للتاجرة.
 *
 * لا نمرّرُ text مع url: بعضُ الأنظمةِ تدمجُ الاثنين عند اختيار «نسخ» فيخرجُ
 * الرابطُ ملوّثاً بكلام، وصفحةُ المعاينةِ تُظهرُ الاسمَ والسعرَ أصلاً.
 */
export async function shareLink({ title = '', url }) {
  if (!url) return 'failed';
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (err) {
      // الإلغاءُ ليس فشلاً — لا ننسخُ خلفَ ظهرِها عند الإلغاء
      if (err?.name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

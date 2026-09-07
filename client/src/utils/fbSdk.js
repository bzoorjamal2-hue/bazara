// تسجيل الدخول لفيسبوك بطريقة «إعادة التوجيه» (Redirect) — لا نوافذ منبثقة، فتشتغل
// على iOS والتطبيق المثبّت وكل المتصفّحات. تطبيقات «Facebook Login for Business»
// تتطلّب config_id (لا scope القديم) + response_type=code.

// المسار الذي نعود إليه بعد موافقة فيسبوك — يجب تسجيله في إعدادات تسجيل الدخول عند Meta.
export const IG_REDIRECT_PATH = '/dashboard?tab=instagram';

export function igRedirectUri() {
  return `${window.location.origin}${IG_REDIRECT_PATH}`;
}


// يبدأ الدخول: يوجّه الصفحة كاملةً لنافذة فيسبوك. بعد الموافقة يرجّع فيسبوك المستخدم
// إلى IG_REDIRECT_PATH مع ?code=… فنكمّل الربط من هناك.
// نمرُّ بخادمِنا لا بفيسبوك مباشرةً. الذهابُ المباشرُ إلى facebook.com يلتقطُه iOS
// فيفتحُ تطبيقَ فيسبوك (رابطٌ شامل)، والتطبيقُ يُتمُّ الموافقةَ ثمّ يفتحُ رابطَ العودةِ
// في سفاري لا في تطبيقِنا المثبَّت — فتنقطعُ الرحلةُ ويبدو الزرُّ معطّلاً. والروابطُ
// الشاملةُ لا تُلتقَطُ حين يصلُ المتصفّحُ بتحويلةٍ من نطاقٍ آخر، فتبقى الرحلةُ داخلَنا.
// وبذلك أمكن أيضاً `fresh` — دخولٌ جديدٌ في كلِّ مرّةٍ فيربطُ كلٌّ حسابَه هو.
// يُفتَحُ الربطُ في نافذةٍ مستقلّة، لا بتحويلِ الصفحةِ نفسِها. على الآيفون يلتقطُ
// النظامُ روابطَ facebook.com من التصفّحِ العاديِّ ويفتحُ تطبيقَ فيسبوك، فيُتمُّ
// الموافقةَ ثمّ يفتحُ رابطَ العودةِ في سفاري لا في تطبيقِنا المثبَّت — فتنقطعُ الرحلة.
// أمّا نافذةُ المتصفّحِ المستقلّةُ فلا تُسلّمُ روابطَها للتطبيقات.
// والتذكرةُ (lt) هي كيف يعرفُ الخادمُ صاحبَ الرحلة: تلك النافذةُ لا تحملُ جلسةَ
// المستخدمِ في التطبيقِ المثبَّت، فلا تكفيها الكوكيز.
export async function startFbLogin({ fresh = true, requestTicket } = {}) {
  const base = import.meta.env.VITE_API_URL || '/api';
  const ticket = requestTicket ? await requestTicket() : '';
  const p = new URLSearchParams(ticket ? { lt: ticket } : { redirect_uri: igRedirectUri() });
  if (fresh) p.set('fresh', '1');
  const url = `${base}/instagram/login?${p.toString()}`;
  // النافذةُ المستقلّةُ قد تُمنَع (حاجبُ النوافذ)، فنعودُ حينَها إلى تحويلِ الصفحة.
  const win = window.open(url, '_blank');
  if (!win) window.location.href = url;
}

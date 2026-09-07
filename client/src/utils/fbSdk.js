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
// fresh: طلبُ دخولٍ جديدٍ من فيسبوك. مطفأٌ افتراضاً لأنّ تجربتَنا أظهرت أنّه قد
// يدفعُ iOS لتسليمِ الرحلةِ إلى تطبيقِ فيسبوك فتنقطع. يُفتَحُ بزرِّ «حسابٌ آخر».
export function startFbLogin({ fresh = false } = {}) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem('ig_oauth_state', state); } catch { /* تجاهل */ }

  const base = import.meta.env.VITE_API_URL || '/api';
  const p = new URLSearchParams({ redirect_uri: igRedirectUri(), state });
  if (fresh) p.set('fresh', '1');
  window.location.href = `${base}/instagram/login?${p.toString()}`;
}

// تسجيل الدخول لفيسبوك بطريقة «إعادة التوجيه» (Redirect) — لا نوافذ منبثقة، فتشتغل
// على iOS والتطبيق المثبّت وكل المتصفّحات. تطبيقات «Facebook Login for Business»
// تتطلّب config_id (لا scope القديم) + response_type=code.

// المسار الذي نعود إليه بعد موافقة فيسبوك — يجب تسجيله في إعدادات تسجيل الدخول عند Meta.
export const IG_REDIRECT_PATH = '/dashboard?tab=instagram';

export function igRedirectUri() {
  return `${window.location.origin}${IG_REDIRECT_PATH}`;
}

// صلاحيات احتياطية للمسار القديم فقط — التطبيق التجاري يعتمد config_id.
const SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
].join(',');

// يبدأ الدخول: يوجّه الصفحة كاملةً لنافذة فيسبوك. بعد الموافقة يرجّع فيسبوك المستخدم
// إلى IG_REDIRECT_PATH مع ?code=… فنكمّل الربط من هناك.
export function startFbLogin({ appId, configId, graphVersion = 'v21.0' }) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem('ig_oauth_state', state); } catch { /* تجاهل */ }

  const p = new URLSearchParams({
    client_id: appId,
    redirect_uri: igRedirectUri(),
    response_type: 'code',
    state,
  });
  if (configId) {
    // تسجيل الدخول للأعمال: config_id بدل scope + تجاوز نوع الردّ الافتراضي
    p.set('config_id', configId);
    p.set('override_default_response_type', 'true');
  } else {
    p.set('scope', SCOPES); // احتياطي (تطبيق دخول عادي)
  }
  window.location.href = `https://www.facebook.com/${graphVersion}/dialog/oauth?${p.toString()}`;
}

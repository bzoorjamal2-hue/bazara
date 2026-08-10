// تحميل Facebook JS SDK عند الحاجة فقط (ربط إنستغرام) — لا نحمّله بكل زيارة.
let sdkPromise = null;

export function loadFbSdk(appId, version = 'v21.0') {
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = function () {
      window.FB.init({ appId, cookie: false, xfbml: false, version });
      resolve(window.FB);
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.defer = true;
    s.crossOrigin = 'anonymous';
    s.onerror = () => { sdkPromise = null; reject(new Error('sdk_load_failed')); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

// نافذة تسجيل دخول فيسبوك → توكن المستخدم قصير العمر (نرسله للخادم ليكمل الربط).
// الصلاحيات المطلوبة لرسائل إنستغرام Business.
const SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_manage_metadata',
  'business_management',
].join(',');

export function fbLogin() {
  return new Promise((resolve, reject) => {
    window.FB.login(
      (resp) => {
        const token = resp?.authResponse?.accessToken;
        if (token) resolve(token);
        else reject(new Error('cancelled'));
      },
      { scope: SCOPES, auth_type: 'rerequest', return_scopes: true }
    );
  });
}

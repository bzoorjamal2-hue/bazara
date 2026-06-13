import axios from 'axios';

// نستخدم دائماً نفس الأصل (/api):
// - محلياً: وكيل Vite يحوّله إلى localhost:5000
// - عند النشر: وكيل Vercel (rewrite) يحوّله إلى خادم Render
// هذا يجعل الكوكيز "first-party" فتعمل على كل المتصفحات (Safari/iOS أيضاً).
const baseURL = '/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // إرسال واستقبال الكوكيز (httpOnly + csrf)
  // مهلة قصوى — يمنع تعلّق "جاري التحميل" للأبد لو كان الخادم بطيء الاستيقاظ (Render)
  timeout: 60000,
});

// توكن المصادقة المخزّن محلياً — بديل موثوق للكوكيز داخل تطبيق iOS المثبّت
// (الكوكيز قد لا تبقى بين جلسات التطبيق، أما localStorage فيبقى).
const TOKEN_KEY = 'bz_auth_token';
let authToken = null;
try { authToken = localStorage.getItem(TOKEN_KEY) || null; } catch { /* ignore */ }

export function setAuthToken(t) {
  authToken = t || null;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}
export function clearAuthToken() {
  setAuthToken(null);
}

// نخزّن توكن CSRF في الذاكرة (يعمل حتى عبر دومينين مختلفين)
let csrfToken = null;

export async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const { data } = await api.get('/csrf');
  csrfToken = data.csrfToken;
  return csrfToken;
}

// إرفاق توكن CSRF في الطلبات المعدِّلة (double-submit)
api.interceptors.request.use(async (config) => {
  // توكن المصادقة (Bearer) — يضمن بقاء الجلسة داخل التطبيق المثبّت
  if (authToken) config.headers['Authorization'] = `Bearer ${authToken}`;
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = await ensureCsrf();
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

// عند خطأ CSRF (403) نعيد جلب التوكن مرة واحدة ونعيد المحاولة
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 403 && !original._retried) {
      original._retried = true;
      csrfToken = null;
      await ensureCsrf();
      return api(original);
    }
    return Promise.reject(error);
  }
);

// استخراج رسالة خطأ آمنة للعرض
export function getErrorMessage(err, fallback = 'حدث خطأ، حاول مجدداً.') {
  // خطأ شبكة (لا يوجد رد من الخادم) أو الجهاز غير متصل بالإنترنت
  const noNetwork =
    err &&
    !err.response &&
    (err.code === 'ERR_NETWORK' ||
      err.message === 'Network Error' ||
      (typeof navigator !== 'undefined' && navigator.onLine === false));
  if (noNetwork) return 'فقدت الاتصال بالشبكة. تحقّق من اتصالك بالإنترنت وحاول مجدداً.';
  if (err?.code === 'ECONNABORTED') return 'الخادم يستغرق وقتاً أطول من المعتاد. حاول مجدداً بعد لحظات.';
  return err?.response?.data?.error || fallback;
}

export default api;

import axios from 'axios';

// عند وجود VITE_API_URL نستخدمه (النشر)، وإلا نعتمد على وكيل Vite (نفس الأصل)
const baseURL = (import.meta.env.VITE_API_URL || '') + '/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // إرسال واستقبال الكوكيز (httpOnly + csrf)
});

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
  return err?.response?.data?.error || fallback;
}

export default api;

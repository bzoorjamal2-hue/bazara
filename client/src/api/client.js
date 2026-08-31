import axios from 'axios';
import { markServerDown, markServerUp, isServerDown } from '../utils/serverState.js';

// وجهة الـAPI:
// - افتراضياً نفس الأصل (/api): محلياً وكيل Vite → localhost:5000، وعند النشر
//   وكيل Vercel (rewrite) → خادم Render.
// - عند ضبط VITE_API_URL (مثل https://api.bazarastore.site/api) نكلّم الخادم
//   مباشرةً. هذا يتجاوز جدار حماية Vercel تماماً، فلا تُحجب عمليات تسجيل الدخول
//   ولا أي طلب عند تفعيل تحدّي DDoS/Attack Mode.
//   شرط أساسي: أن يكون دوماً دوماً فرعياً من نفس نطاق الموقع (api.bazarastore.site)
//   لا نطاقاً غريباً (onrender.com) — عندها تبقى الكوكيز "first-party" فتعمل على
//   Safari/iOS التي تحجب كوكيز الطرف الثالث.
const baseURL = import.meta.env.VITE_API_URL || '/api';

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

// تعثّرٌ عابر: خادمٌ نائم يستيقظ، أو بوّابةٌ ترد 502/503/504، أو مهلةٌ انتهت.
// نعيد المحاولة مرّتين بتراجعٍ أُسّيّ بدل إظهار خطأٍ على أوّل تعثّر.
const RETRY_STATUS = [502, 503, 504, 522, 524];
const isTransient = (err) => {
  const st = err.response?.status;
  if (st) return RETRY_STATUS.includes(st);
  // بلا ردّ: شبكةٌ أو مهلة. وردُّ 5xx بلا ترويسات CORS يصل هكذا أيضاً.
  return err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.message === 'Network Error';
};
// الإعادةُ آمنةٌ للقراءة دائماً. أمّا الكتابةُ فلا نعيدها إلا إن لم يصل ردٌّ
// أصلاً — وحينها لم يُنفَّذ الطلبُ غالباً. (والطلباتُ تحمل مفتاحَ منع تكرار.)
const mayRetry = (cfg, err) => {
  const m = (cfg.method || 'get').toLowerCase();
  return m === 'get' || m === 'head' || !err.response;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

api.interceptors.response.use(
  (res) => { markServerUp(); return res; },
  async (error) => {
    const original = error.config;
    if (error.response?.status === 403 && !original._retried) {
      original._retried = true;
      csrfToken = null;
      await ensureCsrf();
      return api(original);
    }
    if (original && isTransient(error) && mayRetry(original, error)) {
      original._tries = (original._tries || 0) + 1;
      if (original._tries <= 2) {
        await wait(original._tries * 1200); // 1.2s ثمّ 2.4s
        return api(original);
      }
    }
    // نفدت المحاولات: نسأل أصلَ الموقع قبل أن نتّهم شبكةَ الزبونة
    if (isTransient(error)) markServerDown();
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
  // الخادمُ واقفٌ (تحقّقنا بجلب ملفٍّ من أصل الموقع نفسه) → لا نتّهم شبكتَها
  if (isServerDown()) return 'خدمة الموقع متوقّفة مؤقّتاً. اتّصالُكِ سليم — أعيدي المحاولة بعد قليل.';
  if (err?.response?.status >= 500) return 'الخادم لا يستجيب مؤقّتاً. أعيدي المحاولة بعد لحظات.';
  if (noNetwork) return 'فقدت الاتصال بالشبكة. تحقّق من اتصالك بالإنترنت وحاول مجدداً.';
  if (err?.code === 'ECONNABORTED') return 'الخادم يستغرق وقتاً أطول من المعتاد. حاول مجدداً بعد لحظات.';
  return err?.response?.data?.error || fallback;
}

export default api;

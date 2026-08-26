import api, { setAuthToken } from '../api/client.js';

// ───────── التصفّح كصاحبة متجر ─────────
//
// أقوى أداة دعم: تُشخَّص مشكلتها من داخل لوحتها هي، بلا أن تُطلب كلمة سرّها
// ولا أن تُوصف لك الشاشة عبر الهاتف.
//
// نحفظ توكن المديرة جانباً ونضع مكانه توكن الجلسة، فالخروج يعيدها كما كانت
// بلا تسجيل دخولٍ من جديد. الجلسة ساعةٌ واحدة، وأدوات الإدارة محجوبة داخلها
// (الخادم يرفضها)، وكلّ فتحٍ يُسجَّل باسم من فتحه.

const KEY = 'bz_impersonation';

export function impersonationInfo() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function isImpersonating() {
  return Boolean(impersonationInfo());
}

export async function startImpersonation(email) {
  const { data } = await api.post('/subscription/impersonate', { email });
  // توكن المديرة يُحفَظ في sessionStorage: يزول بإغلاق التبويب فلا تبقى
  // جلسةٌ معلّقة على جهازٍ مشترك، ويبقى ما دام العمل جارياً.
  let adminToken = null;
  try { adminToken = localStorage.getItem('bz_auth_token'); } catch { /* تجاهل */ }
  sessionStorage.setItem(KEY, JSON.stringify({
    adminToken,
    name: data.user?.name || '',
    email: data.user?.email || email,
    storeName: data.user?.storeName || '',
    slug: data.user?.slug || '',
    until: Date.now() + (data.minutes || 60) * 60000,
  }));
  setAuthToken(data.token);
  // إعادة تحميل كاملة لا تنقّل داخليّ: كل ما بالذاكرة (سياق الحساب، الطلبات،
  // كاش الصفحات) يخصّ المديرة، ولو أبقيناه لاختلط حسابان بشاشةٍ واحدة.
  window.location.replace('/dashboard');
}

export function stopImpersonation() {
  const info = impersonationInfo();
  sessionStorage.removeItem(KEY);
  setAuthToken(info?.adminToken || null);
  window.location.replace('/dashboard?tab=subscribers');
}

// انتهاء المهلة: نخرج بأنفسنا بدل أن تصطدم بـ«الجلسة منتهية» بلا تفسير
export function impersonationExpired() {
  const info = impersonationInfo();
  return Boolean(info && info.until && Date.now() > info.until);
}

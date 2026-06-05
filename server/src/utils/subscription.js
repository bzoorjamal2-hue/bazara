// نموذج الاشتراك: تفعيل يدوي + دفع محلي. المدير يوافق على الطلبات.

// هل إلزام الاشتراك مفعّل؟ (افتراضياً نعم؛ اجعله false لتعطيله مؤقتاً)
export function isSubscriptionsEnabled() {
  return process.env.SUBSCRIPTIONS_ENABLED !== 'false';
}

// قائمة بريد المديرين (مفصولة بفاصلة)
export function adminEmails() {
  return (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  return Boolean(email) && adminEmails().includes(email.toLowerCase());
}

// هل اشتراك المستخدم فعّال؟ (المدير دائماً فعّال؛ وإن كان الإلزام معطّلاً فالجميع فعّال)
export function isUserActive(user) {
  if (!isSubscriptionsEnabled()) return true;
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  const active = user.subscription_status === 'active';
  const notExpired = user.current_period_end && new Date(user.current_period_end) > new Date();
  return active && notExpired;
}

// عدد الأيام المتبقية على الانتهاء (أو null)
export function daysRemaining(user) {
  if (!user?.current_period_end) return null;
  const ms = new Date(user.current_period_end) - new Date();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// تاريخ انتهاء جديد حسب الخطة، بدءاً من تاريخ مرجعي (أو الآن)
export function planPeriodEnd(plan, from = new Date()) {
  const d = new Date(from);
  if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// شرط SQL لإظهار متاجر المشتركين الفعّالين (والمديرين) فقط في الصفحات العامة
export function activeStoreSql(userAlias = 'u') {
  if (!isSubscriptionsEnabled()) return 'TRUE';
  const admins = adminEmails();
  const adminCond = admins.length
    ? ` OR ${userAlias}.email IN (${admins.map((e) => `'${e.replace(/'/g, "''")}'`).join(',')})`
    : '';
  return `((${userAlias}.subscription_status = 'active' AND ${userAlias}.current_period_end > now())${adminCond})`;
}

// توليد رمز مشترك فريد بصيغة BZ-XXXXXX
export function generateSubscriberCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `BZ-${code}`;
}

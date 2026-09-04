import dotenv from 'dotenv';
dotenv.config();

// بوابة الدفع الفلسطينية Lahza (API متوافق مع Paystack)
export const LAHZA_BASE = process.env.LAHZA_BASE || 'https://api.lahza.io';
export const PAY_CURRENCY = process.env.PAY_CURRENCY || 'ILS';

export function isLahzaConfigured() {
  return Boolean(process.env.LAHZA_SECRET_KEY);
}

async function lahzaFetch(path, options = {}) {
  const res = await fetch(`${LAHZA_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.LAHZA_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new Error(data.message || `Lahza error ${res.status}`);
  }
  return data;
}

/**
 * تهيئة معاملة دفع: تُعيد رابط الدفع المستضاف.
 *
 * `subaccount` هو مربطُ السوقِ متعدّدِ البائعات: التاجرةُ لا تفتحُ حساباً ولا
 * تنسخُ مفتاحاً — تُدخلُ حسابَها البنكيَّ عندنا، فيُنشأُ لها حسابٌ فرعيٌّ عند
 * Lahza برمز `ACCT_…`. فيمرُّ الدفعُ بحسابِنا ويُساقُ نصيبُها إلى مصرفِها.
 *
 * `transactionCharge` عمولتُنا بالأغورة/السنت (مبلغٌ مقطوع)، و`bearer` يحدّدُ
 * مَن يتحمّلُ رسومَ البوّابة: 'account' نحن، أو 'subaccount' التاجرة.
 */
export function initializeTransaction({
  email, amount, currency, callbackUrl, reference, metadata,
  subaccount, transactionCharge, bearer,
}) {
  return lahzaFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: String(Math.round(amount * 100)), // أصغر وحدة (أغورة/سنت)
      currency: currency || PAY_CURRENCY,
      callback_url: callbackUrl,
      reference,
      metadata,
      ...(subaccount ? { subaccount } : {}),
      ...(transactionCharge > 0 ? { transaction_charge: String(Math.round(transactionCharge * 100)) } : {}),
      ...(subaccount && bearer ? { bearer } : {}),
    }),
  });
}

/**
 * إنشاء حساب فرعي (sub-account) لتاجرة — يُنشئه المدير بضغطة بدل تسجيله يدوياً.
 * API متوافق مع Paystack: POST /subaccount
 */
export function createSubaccount({ businessName, bankCode, accountNumber, percentageCharge }) {
  return lahzaFetch('/subaccount', {
    method: 'POST',
    body: JSON.stringify({
      business_name: businessName,
      bank_code: bankCode,
      account_number: accountNumber,
      percentage_charge: percentageCharge ?? 95,
    }),
  });
}

// قائمة بنوك Lahza — لربط كود البنك الداخلي بكود Lahza تلقائياً
export function listBanks() {
  return lahzaFetch('/bank', { method: 'GET' });
}

// التحقق من معاملة عبر المرجع
export function verifyTransaction(reference) {
  return lahzaFetch(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
}

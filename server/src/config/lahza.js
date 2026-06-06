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

// تهيئة معاملة دفع: تُعيد رابط الدفع المستضاف
export function initializeTransaction({ email, amount, currency, callbackUrl, reference, metadata }) {
  return lahzaFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: String(Math.round(amount * 100)), // أصغر وحدة (أغورة/سنت)
      currency: currency || PAY_CURRENCY,
      callback_url: callbackUrl,
      reference,
      metadata,
    }),
  });
}

// التحقق من معاملة عبر المرجع
export function verifyTransaction(reference) {
  return lahzaFetch(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
}

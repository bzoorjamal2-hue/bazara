import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// نُهيّئ Stripe فقط إذا توفّر المفتاح السري.
// عند عدم التهيئة يعمل الموقع بوضع "بدون إلزام اشتراك" (مفيد للتطوير/المعاينة).
const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key ? new Stripe(key) : null;

export function isStripeConfigured() {
  return Boolean(stripe);
}

// أسعار الاشتراك (بالسنت). شهري 10$ وسنوي 100$.
export const PLANS = {
  monthly: { amount: 1000, interval: 'month', label: 'Monthly' },
  yearly: { amount: 10000, interval: 'year', label: 'Yearly' },
};
export const PLAN_CURRENCY = 'usd';

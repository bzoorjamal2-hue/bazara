import dotenv from 'dotenv';
dotenv.config();

// Paytabs REST API — بوابة الدفع الفلسطينية عبر شراكة MEPS
// تدعم فيزا وماستركارد وكل البنوك بالضفة.
// نستخدم API المباشر (بلا حزمة npm) لتحكّم أفضل.

const REGION_URLS = {
  ARE: 'https://secure.paytabs.com',
  SAU: 'https://secure.paytabs.sa',
  OMN: 'https://secure-oman.paytabs.com',
  JOR: 'https://secure-jordan.paytabs.com',
  EGY: 'https://secure-egypt.paytabs.com',
  GLOBAL: 'https://secure-global.paytabs.com',
  PSE: 'https://secure-global.paytabs.com',
};

function baseUrl(region) {
  return REGION_URLS[region] || REGION_URLS.GLOBAL;
}

// بيانات المنصة (اشتراكات المتاجر) من متغيّرات البيئة
export function isPlatformPaytabsConfigured() {
  return Boolean(process.env.PAYTABS_PROFILE_ID && process.env.PAYTABS_SERVER_KEY);
}

function platformCreds() {
  return {
    profileId: process.env.PAYTABS_PROFILE_ID,
    serverKey: process.env.PAYTABS_SERVER_KEY,
    region: process.env.PAYTABS_REGION || 'PSE',
  };
}

async function paytabsFetch(endpoint, { profileId, serverKey, region }, body) {
  const url = `${baseUrl(region)}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: serverKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profile_id: Number(profileId), ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.redirect_url) {
    throw new Error(data.message || `Paytabs error ${res.status}`);
  }
  return data;
}

// إنشاء صفحة دفع مستضافة — يُعاد رابط التحويل
export function createPaymentPage(creds, {
  cartId, currency, amount, description,
  customerName, customerEmail, customerPhone,
  customerCity, customerAddress,
  callbackUrl, returnUrl, lang = 'ar',
}) {
  return paytabsFetch('/payment/request', creds, {
    tran_type: 'sale',
    tran_class: 'ecom',
    cart_id: cartId,
    cart_currency: currency,
    cart_amount: Number(amount),
    cart_description: description,
    paypage_lang: lang,
    customer_details: {
      name: customerName || 'Customer',
      email: customerEmail || 'customer@bazara.shop',
      phone: customerPhone || '',
      street1: customerAddress || 'N/A',
      city: customerCity || 'Ramallah',
      state: 'PS',
      country: 'PS',
      zip: '00000',
    },
    shipping_details: {
      name: customerName || 'Customer',
      email: customerEmail || 'customer@bazara.shop',
      phone: customerPhone || '',
      street1: customerAddress || 'N/A',
      city: customerCity || 'Ramallah',
      state: 'PS',
      country: 'PS',
      zip: '00000',
    },
    callback: callbackUrl,
    return: returnUrl,
  });
}

// الاستعلام عن حالة معاملة
export function queryTransaction(creds, tranRef) {
  return paytabsFetch('/payment/query', creds, { tran_ref: tranRef });
}

// إنشاء صفحة دفع بمعلومات المنصة (للاشتراكات)
export function createPlatformPayment(opts) {
  return createPaymentPage(platformCreds(), opts);
}

// التحقّق من معاملة بمعلومات المنصة
export function queryPlatformTransaction(tranRef) {
  return queryTransaction(platformCreds(), tranRef);
}

// التحقّق من صلاحيّة حالة الدفع: A = مقبول
export function isPaymentSuccess(result) {
  return result?.payment_result?.response_status === 'A';
}

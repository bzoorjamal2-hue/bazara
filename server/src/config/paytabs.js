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
  splitPayout,
}) {
  return paytabsFetch('/payment/request', creds, {
    tran_type: 'sale',
    tran_class: 'ecom',
    cart_id: cartId,
    cart_currency: currency,
    cart_amount: Number(amount),
    cart_description: description,
    paypage_lang: lang,
    ...(splitPayout?.length ? { split_payout: splitPayout } : {}),
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

/**
 * بناءُ قائمةِ المستفيدين لتقسيمِ مبلغِ الطلب (Split Payout).
 *
 * التاجرةُ لا تفتحُ حسابَ PayTabs: تُدخلُ حسابَها البنكيَّ عندنا، فنسجّلُها
 * مستفيدةً عندهم ويعطونا entity_id. وهذا الرقمُ وحدَه ما يُرسَلُ مع الطلب —
 * بياناتُها البنكيّةُ محفوظةٌ عندهم لا تمرُّ بالنداء.
 *
 * msc_flag يحدّدُ مَن يتحمّلُ عمولةَ البوّابة:
 *   R = الباقي (تأخذُ ما تبقّى بعد الآخرين) · P = بالتناسب · F = كاملة · Z = لا شيء
 * فنجعلُ المتجرَ يأخذُ الباقيَ لئلّا تضيعَ أُسَيْراتُ التقريبِ من أحد.
 *
 * @param {object} store  صفُّ المتجر (paytabs_entity_id, name, platform_fee_percent)
 * @param {number} total  إجماليُّ الطلب
 * @returns {Array|null}  القائمةُ أو null إن لم تكن التاجرةُ مسجّلةً بعد
 */
export function buildSplitPayout(store, total) {
  const entityId = Number(store?.paytabs_entity_id);
  if (!entityId) return null;

  const amount = Number(total) || 0;
  const feePercent = Math.min(100, Math.max(0, Number(store.platform_fee_percent) || 0));
  const platformCut = Math.round(amount * feePercent) / 100;
  const storeCut = Math.max(0, amount - platformCut);

  const rows = [
    {
      entity_id: entityId,
      entity_name: String(store.name || 'Store').slice(0, 60),
      item_description: 'Store sale',
      item_total: storeCut.toFixed(2),
      msc_flag: 'R',
    },
  ];

  // لا نُضيفُ سطرَ المنصّةِ إن كانت العمولةُ صفراً — دخلُنا من الاشتراكِ لا منها
  const platformEntity = Number(process.env.PAYTABS_PLATFORM_ENTITY_ID);
  if (platformCut > 0 && platformEntity) {
    rows.push({
      entity_id: platformEntity,
      entity_name: 'Bazara',
      item_description: 'Platform commission',
      item_total: platformCut.toFixed(2),
      msc_flag: 'P',
    });
  }
  return rows;
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

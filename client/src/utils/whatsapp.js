// تحويل الرقم لصيغة دولية يقبلها واتساب. يعالج: الصفر البادئ، رمز الدولة المكتوب مسبقاً،
// و00 الدولية. الأهم: يكتشف رمز الدولة من بادئة الموبايل حتى لا يقول واتساب "الرقم غير
// موجود": بادئات الداخل/إسرائيل (050/052/053/054/055/058) → 972، وفلسطين (059/056) وغيرها → 970.
const ISRAELI_MOBILE_PREFIXES = ['50', '52', '53', '54', '55', '58'];
export function waDigits(number, defaultCc = '970') {
  let d = (number || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);                 // 00970… → 970…
  // رقم يحمل رمز دولة معروفاً مسبقاً (970/972): نزيل صفراً زائداً بعده إن وُجد ونُبقيه
  if (d.startsWith('970') || d.startsWith('972')) {
    const cc = d.slice(0, 3);
    let rest = d.slice(3);
    if (rest.startsWith('0')) rest = rest.slice(1);        // 9700x… → 970x…
    return cc + rest;
  }
  // رقم محلّي (بصفر بادئ أو بدونه): نستنتج رمز الدولة من أول رقمين بعد الصفر
  const local = d.startsWith('0') ? d.slice(1) : d;        // بلا الصفر البادئ
  const cc = ISRAELI_MOBILE_PREFIXES.includes(local.slice(0, 2)) ? '972' : defaultCc;
  return cc + local;                                        // 059… → 97059… | 054… → 97254…
}

// كل الأرقام الدولية المحتملة للرقم، بالأرجح أولاً. أرقام 059/056 (جوّال/أوريدو)
// فلسطينية لكن أصحابها قد يكونون مسجّلين على واتساب بمقدمة 970 أو 972 — فلا يمكن
// الجزم من الرقم وحده. نُرجّع المقدمتين ليجرّب المالك الثانية بضغطة لو قال واتساب
// "الرقم غير موجود". بادئات الداخل الحصرية (050/052/…) تبقى مقدمة واحدة (972)،
// والرقم المكتوب بمقدمة صريحة يُقدَّم كما كُتب مع البديل عند 59/56.
export function waCandidates(number, defaultCc = '970') {
  let d = (number || '').replace(/\D/g, '');
  if (!d) return [];
  if (d.startsWith('00')) d = d.slice(2);
  let cc, rest;
  if (d.startsWith('970') || d.startsWith('972')) {
    cc = d.slice(0, 3);
    rest = d.slice(3);
    if (rest.startsWith('0')) rest = rest.slice(1);
  } else {
    rest = d.startsWith('0') ? d.slice(1) : d;
    cc = ISRAELI_MOBILE_PREFIXES.includes(rest.slice(0, 2)) ? '972' : defaultCc;
  }
  if (/^5[69]\d{7}$/.test(rest)) {
    const other = cc === '970' ? '972' : '970';
    return [cc + rest, other + rest];
  }
  return [cc + rest];
}

// طلب كامل مع بيانات التوصيل ورسوم الشحن (Checkout احترافي)
export function buildWhatsappCheckout(number, items, customer, lang = 'ar') {
  const digits = waDigits(number);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = Number(customer.delivery) || 0;
  const discount = Number(customer.discount) || 0;
  const total = Math.max(0, subtotal - discount) + delivery;
  const ar = lang === 'ar';

  const line = (i, n) =>
    ar
      ? `${n + 1}) ${i.name} — الكمية: ${i.qty} × ₪${i.price}${i.size ? ` — المقاس: ${i.size}` : ''}${i.color ? ` — اللون: ${i.color}` : ''}`
      : `${n + 1}) ${i.name} — Qty: ${i.qty} × ₪${i.price}${i.size ? ` — Size: ${i.size}` : ''}${i.color ? ` — Color: ${i.color}` : ''}`;

  const lines = ar
    ? [
        '🛍️ *طلب جديد*',
        '',
        '*المنتجات:*',
        ...items.map(line),
        '',
        `المجموع الفرعي: ₪${subtotal.toFixed(2)}`,
        ...(discount > 0 ? [`الخصم${customer.couponCode ? ` (${customer.couponCode})` : ''}: −₪${discount.toFixed(2)}`] : []),
        `رسوم التوصيل: ₪${delivery.toFixed(2)}`,
        `*الإجمالي: ₪${total.toFixed(2)}*`,
        `طريقة الدفع: الدفع عند الاستلام`,
        '',
        '*بيانات التوصيل:*',
        `الاسم: ${customer.name}`,
        `الهاتف: ${customer.phone}`,
        `المدينة: ${customer.city}`,
        ...(customer.address ? [`العنوان: ${customer.address}`] : []),
        ...(customer.notes ? [`ملاحظات: ${customer.notes}`] : []),
      ]
    : [
        '🛍️ *New order*',
        '',
        '*Items:*',
        ...items.map(line),
        '',
        `Subtotal: ₪${subtotal.toFixed(2)}`,
        ...(discount > 0 ? [`Discount${customer.couponCode ? ` (${customer.couponCode})` : ''}: −₪${discount.toFixed(2)}`] : []),
        `Delivery: ₪${delivery.toFixed(2)}`,
        `*Total: ₪${total.toFixed(2)}*`,
        `Payment: Cash on delivery`,
        '',
        '*Delivery details:*',
        `Name: ${customer.name}`,
        `Phone: ${customer.phone}`,
        `City: ${customer.city}`,
        ...(customer.address ? [`Address: ${customer.address}`] : []),
        ...(customer.notes ? [`Notes: ${customer.notes}`] : []),
      ];

  const text = encodeURIComponent(lines.join('\n'));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildWhatsappLink(number, text = '') {
  const digits = waDigits(number);
  const t = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${t}`;
}

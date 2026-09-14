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

// رسالةُ الطلبِ لصاحبةِ المتجر — بطاقةٌ مرتّبةٌ لا سطورٌ مرصوصة.
//
// كانت الرسالةُ قائمةً عاريةً: منتجاتٌ ومجاميعُ وعنوان، بلا رقمِ طلبٍ يربطُها
// بما ستراه صاحبةُ المتجر بلوحتِها — فتقرأُ الرسالةَ وتبحثُ عن طلبِها بالاسم.
// وبلا اسمِ المتجرِ تختلطُ الطلباتُ على من تُدير أكثرَ من متجر.
//
// الآن: رقمُ الطلبِ أوّلَ سطرٍ (يُنسَخُ بضغطة)، وأقسامٌ مفصولةٌ بخطٍّ واضح —
// القطعُ، ثمّ الحساب، ثمّ الزبونةُ والعنوان، ثمّ طريقةُ الدفعِ والتتبّع.
// كلُّ سطرٍ يبدأُ بعلامةٍ ثابتةٍ فتُمسَحُ بالعينِ بلا قراءةٍ كاملة.
// الفاصلُ قصيرٌ عمداً: كلُّ محرفِ رسمٍ ثلاثةُ بايتاتٍ تصيرُ تسعةً بترميزِ الرابط،
// وسلّةٌ كبيرةٌ برابطٍ طويلٍ قد يقصُّها تطبيقُ واتساب على بعضِ الأجهزة.
const RULE = '━━━━━━━━━━';

/**
 * @param {string} number واتساب المتجر
 * @param {Array} items قطع السلة
 * @param {object} c بيانات الزبونة والحساب:
 *        name/phone/city/area/address/notes/delivery/discount/couponCode
 *        + reference (رقم الطلب) · storeName · eta · payment ('cod' | 'card') · trackUrl
 * @param {string} lang لغة الرسالة
 */
export function buildWhatsappCheckout(number, items, c, lang = 'ar') {
  const digits = waDigits(number);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = Number(c.delivery) || 0;
  const discount = Number(c.discount) || 0;
  const total = Math.max(0, subtotal - discount) + delivery;
  const pieces = items.reduce((s, i) => s + i.qty, 0);
  const ar = lang === 'ar';
  const m = (v) => `₪${Number(v).toFixed(2)}`;

  // القطعةُ بسطرين: اسمُها، وتحتَه تفاصيلُها مُزاحةً — فلا يلتفُّ الاسمُ الطويلُ
  // على تفاصيلِه ويصيرُ السطرُ لغزاً على شاشةِ هاتف.
  const line = (i, n) => {
    const spec = [
      i.size ? `${ar ? 'مقاس' : 'Size'} ${i.size}` : '',
      i.color ? `${ar ? 'لون' : 'Color'} ${i.color}` : '',
    ].filter(Boolean).join(' · ');
    return [
      `*${n + 1}.* ${i.name}`,
      `    ${spec ? `${spec} · ` : ''}${i.qty} × ${m(i.price)} = *${m(i.price * i.qty)}*`,
    ].join('\n');
  };

  const paidByCard = c.payment === 'card';
  // مكانٌ فارغٌ لا سطرَ له: «المكان:» بلا شيءٍ بعدها كان يبدو بياناً ناقصاً
  const place = [c.city, c.area && c.area !== c.city ? c.area : ''].filter(Boolean).join(' - ');
  const head = ar
    ? [
        '🛍️ *طلب جديد*' + (c.storeName ? ` — ${c.storeName}` : ''),
        ...(c.reference ? [`🔖 رقم الطلب: *${c.reference}*`] : []),
      ]
    : [
        '🛍️ *New order*' + (c.storeName ? ` — ${c.storeName}` : ''),
        ...(c.reference ? [`🔖 Order no.: *${c.reference}*`] : []),
      ];

  const lines = ar
    ? [
        ...head,
        RULE,
        `🧾 *القطع* (${pieces})`,
        ...items.map(line),
        RULE,
        `المجموع الفرعي: ${m(subtotal)}`,
        ...(discount > 0 ? [`الخصم${c.couponCode ? ` (${c.couponCode})` : ''}: −${m(discount)}`] : []),
        `رسوم التوصيل: ${delivery > 0 ? m(delivery) : 'مجاني'}`,
        `💰 *الإجمالي: ${m(total)}*`,
        `💳 طريقة الدفع: *${paidByCard ? 'مدفوع بالبطاقة ✅' : 'الدفع عند الاستلام'}*`,
        RULE,
        '📍 *بيانات التوصيل*',
        `الاسم: ${c.name}`,
        `الهاتف: ${c.phone}`,
        ...(place ? [`المكان: ${place}`] : []),
        ...(c.address ? [`العنوان: ${c.address}`] : []),
        ...(c.eta ? [`المدة المتوقعة: ${c.eta}`] : []),
        ...(c.notes ? [`ملاحظات: ${c.notes}`] : []),
        ...(c.trackUrl ? [RULE, `🚚 متابعة الطلب: ${c.trackUrl}`] : []),
      ]
    : [
        ...head,
        RULE,
        `🧾 *Items* (${pieces})`,
        ...items.map(line),
        RULE,
        `Subtotal: ${m(subtotal)}`,
        ...(discount > 0 ? [`Discount${c.couponCode ? ` (${c.couponCode})` : ''}: −${m(discount)}`] : []),
        `Delivery: ${delivery > 0 ? m(delivery) : 'Free'}`,
        `💰 *Total: ${m(total)}*`,
        `💳 Payment: *${paidByCard ? 'Paid by card ✅' : 'Cash on delivery'}*`,
        RULE,
        '📍 *Delivery details*',
        `Name: ${c.name}`,
        `Phone: ${c.phone}`,
        ...(place ? [`Location: ${place}`] : []),
        ...(c.address ? [`Address: ${c.address}`] : []),
        ...(c.eta ? [`Estimated delivery: ${c.eta}`] : []),
        ...(c.notes ? [`Notes: ${c.notes}`] : []),
        ...(c.trackUrl ? [RULE, `🚚 Track this order: ${c.trackUrl}`] : []),
      ];

  const text = encodeURIComponent(lines.join('\n'));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildWhatsappLink(number, text = '') {
  const digits = waDigits(number);
  const t = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${t}`;
}

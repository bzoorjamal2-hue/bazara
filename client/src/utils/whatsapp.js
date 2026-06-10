// يبني رابط واتساب لإرسال طلب جاهز لصاحب المتجر
export function buildWhatsappOrder(number, items, lang = 'ar') {
  const digits = (number || '').replace(/[^\d]/g, '');
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const lines =
    lang === 'ar'
      ? [
          'مرحباً، أرغب بطلب المنتجات التالية:',
          '',
          ...items.map((i, n) => `${n + 1}) ${i.name} — الكمية: ${i.qty} × ₪${i.price}`),
          '',
          `الإجمالي: ₪${total.toFixed(2)}`,
        ]
      : [
          'Hello, I would like to order:',
          '',
          ...items.map((i, n) => `${n + 1}) ${i.name} — Qty: ${i.qty} × ₪${i.price}`),
          '',
          `Total: ₪${total.toFixed(2)}`,
        ];

  const text = encodeURIComponent(lines.join('\n'));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

// طلب كامل مع بيانات التوصيل ورسوم الشحن (Checkout احترافي)
export function buildWhatsappCheckout(number, items, customer, lang = 'ar') {
  const digits = (number || '').replace(/[^\d]/g, '');
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = Number(customer.delivery) || 0;
  const total = subtotal + delivery;
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
  const digits = (number || '').replace(/[^\d]/g, '');
  const t = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${t}`;
}

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

export function buildWhatsappLink(number, text = '') {
  const digits = (number || '').replace(/[^\d]/g, '');
  const t = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${t}`;
}

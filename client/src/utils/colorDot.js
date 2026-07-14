// نقاط الألوان على بطاقات المنتجات (أسلوب المتاجر الكبرى):
// تحويل أسماء الألوان العربية/الإنجليزية الشائعة إلى لون CSS. الاسم غير المعروف يُتجاهل بهدوء.
const MAP = {
  'اسود': '#1c1c1c', 'black': '#1c1c1c',
  'ابيض': '#f8f8f8', 'white': '#f8f8f8',
  'احمر': '#c0392b', 'red': '#c0392b',
  'خمري': '#722f37', 'نبيذي': '#722f37', 'عنابي': '#7f1d2f', 'burgundy': '#722f37', 'maroon': '#7f1d2f',
  'كحلي': '#1f2a44', 'navy': '#1f2a44',
  'ازرق': '#2563eb', 'blue': '#2563eb',
  'سماوي': '#7dd3fc', 'تركواز': '#2aa8a0',
  'اخضر': '#2f6b3a', 'green': '#2f6b3a', 'زيتي': '#5b6236', 'زيتوني': '#5b6236',
  'بيج': '#d9c4a3', 'beige': '#d9c4a3', 'كريمي': '#f1e6d2', 'عاجي': '#f3ecdc', 'اوف وايت': '#f3ecdc', 'offwhite': '#f3ecdc', 'off white': '#f3ecdc',
  'بني': '#6b4a2f', 'brown': '#6b4a2f', 'جملي': '#b08a5a', 'كاميل': '#b08a5a', 'camel': '#b08a5a',
  'ذهبي': '#d4af37', 'gold': '#d4af37', 'فضي': '#c8c8c8', 'silver': '#c8c8c8',
  'رمادي': '#8a8a8a', 'gray': '#8a8a8a', 'grey': '#8a8a8a', 'شاركول': '#3d3d3d', 'فحمي': '#3d3d3d',
  'وردي': '#e8a2b8', 'زهري': '#e8a2b8', 'pink': '#e8a2b8', 'نهدي': '#c8a2a8', 'فوشي': '#d63384',
  'بنفسجي': '#6d5aa8', 'موف': '#b39ddb', 'ليلكي': '#c5b3e6', 'purple': '#6d5aa8',
  'برتقالي': '#e67e22', 'orange': '#e67e22',
  'اصفر': '#e6c14c', 'yellow': '#e6c14c', 'خردلي': '#c9a227',
};

// توحيد الهمزات + حروف صغيرة ليطابق "أسود"/"اسود" وغيرها
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');

export function colorToCss(name) {
  const n = norm(name);
  if (!n) return null;
  if (MAP[n]) return MAP[n];
  // احتواء (مثل "أخضر زيتي" أو "وردي فاتح") — نطابق أول اسم معروف داخل النص
  for (const k of Object.keys(MAP)) if (n.includes(k)) return MAP[k];
  return null;
}

// ألوان المنتج المتاحة: من مخزون الألوان أو صور الألوان أو حقل اللون النصي (مفصول بفواصل)
export function productColors(p) {
  const set = new Set();
  if (p?.colorStock && Object.keys(p.colorStock).length) Object.keys(p.colorStock).forEach((x) => set.add(x));
  else if (p?.colorImages && Object.keys(p.colorImages).length) Object.keys(p.colorImages).forEach((x) => set.add(x));
  else String(p?.color || '').split(/[,،/|]/).map((x) => x.trim()).filter(Boolean).forEach((x) => set.add(x));
  return [...set];
}

// جاهزة للبطاقة: أسماء + ألوان CSS (تُسقط الأسماء غير المعروفة)
export function productColorDots(p) {
  return productColors(p)
    .map((name) => ({ name, css: colorToCss(name) }))
    .filter((d) => d.css);
}

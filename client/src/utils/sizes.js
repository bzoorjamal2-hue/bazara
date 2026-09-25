// مقاسات المنتجات (نمر) — رقمية + "ون سايز" (مقاس واحد) بقيمة مخزّنة ثابتة `one`.
// نعرض التسمية حسب اللغة عبر sizeLabel كي يبقى المخزون موحّداً بين العربية والإنجليزية.
export const SIZES = ['36', '38', '40', '42', '44', '46', '48', 'one'];

// نمر الأحذية (أوروبية): كلّ الأرقام لا الزوجية وحدها — الحذاء ٣٩ غير ٣٨ ولا ٤٠
export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

// طول القدم بالسنتيمتر لكلّ نمرة — تقريبيّ كجدول الملابس، يختلف قليلاً بين المصانع
export const SHOE_CHART = {
  '35': 22.5, '36': 23, '37': 23.5, '38': 24, '39': 25, '40': 25.5,
  '41': 26, '42': 27, '43': 27.5, '44': 28, '45': 29, '46': 29.5,
};

// المقاسات التي تختار منها التاجرة حسب قسم الفئة. الإكسسوار «ون سايز» وحده.
export function sizesForDept(dept) {
  if (dept === 'shoes') return SHOE_SIZES;
  if (dept === 'accessories') return ['one'];
  return SIZES;
}

// المقاسات المعروضة بفلتر شبكةٍ من المنتجات: ما فيها فعلاً مرتّباً بترتيب قسمه.
// كانت قائمة الملابس ثابتة، فتظهر ٤٤ و٤٦ بفلترة أحذية وتغيب ٣٩ الموجودة.
export function sizesInProducts(products) {
  const have = new Set();
  for (const p of products || []) {
    for (const s of String(p?.size || '').split(',')) { const v = s.trim(); if (v) have.add(v); }
  }
  const order = [...SIZES.filter((s) => s !== 'one'), ...SHOE_SIZES, 'one'];
  const known = [...new Set(order)].filter((s) => have.has(s)).sort((a, b) => (a === 'one') - (b === 'one') || Number(a) - Number(b));
  return known.length ? known : SIZES;
}

// التسمية المعروضة للمقاس: الرقم كما هو، و`one` → "ون سايز" / "One Size"
export function sizeLabel(s, t) {
  return s === 'one' ? t('product.oneSize') : s;
}

// جدول مقاسات نسائي قياسي (سنتيمتر) — تقريبي، يساعد الزبونة تختار قياسها الصحيح.
// لكل نمرة: المقاس العالمي + محيط الصدر/الخصر/الأرداف.
export const SIZE_CHART = {
  '36': { intl: 'XS', bust: 84, waist: 66, hips: 90 },
  '38': { intl: 'S', bust: 88, waist: 70, hips: 94 },
  '40': { intl: 'M', bust: 92, waist: 74, hips: 98 },
  '42': { intl: 'L', bust: 96, waist: 78, hips: 102 },
  '44': { intl: 'XL', bust: 100, waist: 82, hips: 106 },
  '46': { intl: 'XXL', bust: 104, waist: 86, hips: 110 },
  '48': { intl: '3XL', bust: 110, waist: 92, hips: 116 },
};

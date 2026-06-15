// مقاسات المنتجات (نمر) — رقمية + "ون سايز" (مقاس واحد) بقيمة مخزّنة ثابتة `one`.
// نعرض التسمية حسب اللغة عبر sizeLabel كي يبقى المخزون موحّداً بين العربية والإنجليزية.
export const SIZES = ['36', '38', '40', '42', '44', '46', '48', 'one'];

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

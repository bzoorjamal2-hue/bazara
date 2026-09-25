// "مقاسك المعتاد": نتذكّر آخر مقاس اختارته الزبونة فنميّزه لها بكل منتج لاحق.
// عمداً لا نختاره تلقائياً — التمييز فقط. الاختيار التلقائي قد يمرّ بلا انتباه فتطلب
// مقاساً خاطئاً؛ التمييز يوفّر البحث ويُبقي القرار بيدها.
//
// لكلّ قسمٍ مقاسه: فستانها ٣٨ لا يعني أنّ حذاءها ٣٨. كان مفتاحاً واحداً، فمن
// اختارت فستاناً رأت ٣٨ مميّزةً على كلّ حذاء. مفتاح الملابس بقي كما كان كي لا
// يضيع ما حفظته الزائرات قبل الأقسام. والإكسسوار «ون سايز» فلا يُتذكَّر.
const KEYS = { clothing: 'bz_my_size', shoes: 'bz_my_size_shoes' };

export function getMySize(dept = 'clothing') {
  const key = KEYS[dept];
  if (!key) return '';
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

export function setMySize(size, dept = 'clothing') {
  const key = KEYS[dept];
  const s = String(size || '').trim();
  if (!key || !s || s === 'one') return;
  try { localStorage.setItem(key, s); } catch { /* تجاهل */ }
}

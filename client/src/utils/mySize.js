// "مقاسك المعتاد": نتذكّر آخر مقاس اختارته الزبونة فنميّزه لها بكل منتج لاحق.
// عمداً لا نختاره تلقائياً — التمييز فقط. الاختيار التلقائي قد يمرّ بلا انتباه فتطلب
// مقاساً خاطئاً؛ التمييز يوفّر البحث ويُبقي القرار بيدها.
const KEY = 'bz_my_size';

export function getMySize() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setMySize(size) {
  const s = String(size || '').trim();
  if (!s) return;
  try { localStorage.setItem(KEY, s); } catch { /* تجاهل */ }
}

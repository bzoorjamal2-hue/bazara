// تخزين كود الإحالة لكل متجر (الزبونة الجديدة تصل عبر رابط ?ref=CODE).
// معزول لكل متجر بالسلَگ كي لا تختلط الإحالات بين المتاجر.
const KEY = (slug) => `bz_ref_${slug}`;

export function saveRef(slug, code) {
  try { if (slug && code) localStorage.setItem(KEY(slug), String(code).toUpperCase().slice(0, 20)); } catch { /* ignore */ }
}
export function getRef(slug) {
  try { return slug ? (localStorage.getItem(KEY(slug)) || '') : ''; } catch { return ''; }
}
export function clearRef(slug) {
  try { if (slug) localStorage.removeItem(KEY(slug)); } catch { /* ignore */ }
}

// الأقسام الثلاثة فوق الفئات — نظير server/src/utils/department.js.
//
// القسم يُشتقّ من الفئة (لا تختاره التاجرة للمنتج)، ويحدّد ثلاثة أشياء:
// المقاسات المعروضة، ودليل المقاسات، ومكان المنتج بواجهة المتجر والمنصّة.
// والمنتج يصل من الخادم حاملاً قسمه (product.department)؛ هذا الملف للفئات
// التي لم يُحفظ عليها منتج بعد (نموذج المنتج، شبكات الفئات).

export const DEPARTMENTS = ['clothing', 'shoes', 'accessories'];

export const CLOTHING_CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// الفئة العامّة لكلّ قسمٍ غير الملابس — تبيع بها التاجرة من أوّل يوم.
// ‏accessory لا accessories: الثانية قيمةٌ قديمة يحوّلها الخادم إلى hijab.
export const DEPT_BASE_CATS = { shoes: 'shoes', accessory: 'accessories' };

// فئات المنصّة الثابتة للأحذية والإكسسوارات — نظير السبع للملابس (والخادم نفسه
// بـutils/department.js). هي هويّة الموقع العام، وفئات التاجرات تُربط بها.
export const SUB_CATS = {
  shoes: ['heels', 'sneakers', 'sandals', 'boots', 'flats'],
  accessories: ['bags', 'watches', 'jewelry', 'sunglasses'],
};

// قسم فئةٍ مدمجة (null لغيرها)
export function builtinDept(key) {
  if (CLOTHING_CATS.includes(key)) return 'clothing';
  if (DEPT_BASE_CATS[key]) return DEPT_BASE_CATS[key];
  for (const [d, keys] of Object.entries(SUB_CATS)) if (keys.includes(key)) return d;
  return null;
}

export const normDept = (v) => (DEPARTMENTS.includes(v) ? v : 'clothing');

export const deptOfProduct = (p) => normDept(p?.department);

// «ون سايز» خيارٌ واحد لا اختيار: حين لا تحمل القطعة (أو لونها المختار) غيرَه
// ومتوفّراً، يُختار تلقائياً — كانت الزبونة تضغط زرّاً وحيداً لتُكمل الطلب.
// ودليل المقاسات لا معنى له لشنطةٍ أو لقطعةٍ بمقاسٍ واحد، فيُخفى.
export function onlyOneSize(product, color) {
  const cs = product?.colorStock && typeof product.colorStock === 'object' ? product.colorStock : {};
  if (Object.keys(cs).length) {
    if (!color) return false;
    const sz = cs[color] || {};
    return Object.keys(sz).length === 1 && 'one' in sz && sz.one !== 0;
  }
  const sizes = String(product?.size || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ss = product?.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {};
  return sizes.length === 1 && sizes[0] === 'one' && ss.one !== 0;
}
export function allOneSize(product) {
  const cs = product?.colorStock && typeof product.colorStock === 'object' ? product.colorStock : {};
  const all = Object.keys(cs).length
    ? Object.values(cs).flatMap((sz) => Object.keys(sz || {}))
    : String(product?.size || '').split(',').map((s) => s.trim()).filter(Boolean);
  return all.length > 0 && all.every((s) => s === 'one');
}

// أقسام المتجر المفعّلة (stores.departments) — القديم بلا حقلٍ ملابس وحدها
export function storeDepts(store) {
  const set = new Set(Array.isArray(store?.departments) ? store.departments : []);
  const out = DEPARTMENTS.filter((d) => set.has(d));
  return out.length ? out : ['clothing'];
}

// قسم فئة: المدمجة معروفة، والمضافة تحمل قسمها (المنصّة قبل المتجر كالخادم)
export function deptOfCategory(key, { platformExtra = [], storeCustom = [] } = {}) {
  const bd = builtinDept(key);
  if (bd) return bd;
  const pe = (platformExtra || []).find((c) => c?.key === key);
  if (pe) return normDept(pe.dept);
  const sc = (storeCustom || []).find((c) => c?.key === key);
  if (sc) return normDept(sc.dept);
  return 'clothing';
}

// ترتيب ثابت للأقسام الموجودة فعلاً، مهما كان ترتيب ظهورها بالقائمة
export function presentDepts(list, getDept = deptOfProduct) {
  const set = new Set((list || []).map(getDept));
  return DEPARTMENTS.filter((d) => set.has(d));
}

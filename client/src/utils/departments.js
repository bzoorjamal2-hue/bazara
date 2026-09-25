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

export const normDept = (v) => (DEPARTMENTS.includes(v) ? v : 'clothing');

export const deptOfProduct = (p) => normDept(p?.department);

// قسم فئة: المدمجة معروفة، والمضافة تحمل قسمها (المنصّة قبل المتجر كالخادم)
export function deptOfCategory(key, { platformExtra = [], storeCustom = [] } = {}) {
  if (CLOTHING_CATS.includes(key)) return 'clothing';
  if (DEPT_BASE_CATS[key]) return DEPT_BASE_CATS[key];
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

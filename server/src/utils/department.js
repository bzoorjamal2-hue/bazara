import { query } from '../config/db.js';

// الأقسام الثلاثة: مستوى فوق الفئات يفصل الملابس عن الأحذية عن الإكسسوارات.
//
// القسم لا تختاره التاجرة للمنتج: يُشتقّ من فئته. فئات الملابس السبع ملابس،
// ولكلّ قسمٍ آخر فئةٌ عامّة باسمه، والفئات التي يضيفها المدير أو التاجرة تحمل
// قسمها معها. فلا يقع منتجٌ بفئة «فساتين» وقسمه «أحذية».
//
// ويُخزَّن على المنتج (products.department) لا يُحسب عند القراءة: القراءات
// كثيرة وتمرّ بمتاجر كثيرة، والحساب يحتاج فئات المنصّة وفئات كلّ متجر.
// يُعاد حسابه حين تتغيّر فئة منتج، أو قسم فئةٍ عند المتجر أو المنصّة.

export const DEPARTMENTS = ['clothing', 'shoes', 'accessories'];

export const CLOTHING_CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// الفئة العامّة لكلّ قسمٍ غير الملابس: تبيع التاجرة حذاءً من أوّل يوم بلا أن
// تُنشئ فئاتٍ أوّلاً. ‏accessory لا accessories: الثانية قيمةٌ قديمة تُحوَّل
// إلى hijab (انظر utils/category.js).
export const DEPT_BASE_CATS = { shoes: 'shoes', accessory: 'accessories' };

export const BUILTIN_CATS = [...CLOTHING_CATS, ...Object.keys(DEPT_BASE_CATS)];

export const normDept = (v) => (DEPARTMENTS.includes(v) ? v : 'clothing');

// الأقسام التي فعّلتها التاجرة لمتجرها (stores.departments). القديم ملابس وحدها.
export function normDepts(v) {
  const set = new Set(Array.isArray(v) ? v : []);
  const out = DEPARTMENTS.filter((d) => set.has(d));
  return out.length ? out : ['clothing'];
}

// ما تُرسله الإعدادات، مع إبقاء كلّ قسمٍ فيه منتجات مفعّلاً: إطفاؤه كان سيخفي
// اختيار قسم منتجاتٍ قائمة عند تعديلها، والمتجر يعرضها على كلّ حال.
export function sanitizeDepartments(raw, mustKeep = []) {
  return normDepts([...(Array.isArray(raw) ? raw : []), ...mustKeep]);
}

// متجرٌ جديد يبدأ بالأقسام الثلاثة، ويطفئ ما لا يبيعه من الإعدادات
export const NEW_STORE_DEPTS = JSON.stringify(DEPARTMENTS);

export function departmentOf(category, { storeCustom = [], platformExtra = [] } = {}) {
  if (CLOTHING_CATS.includes(category)) return 'clothing';
  if (DEPT_BASE_CATS[category]) return DEPT_BASE_CATS[category];
  // المنصّة قبل المتجر: هكذا يقرّر getByCategory أيضاً حين يتصادف المفتاحان
  const pe = (Array.isArray(platformExtra) ? platformExtra : []).find((c) => c?.key === category);
  if (pe) return normDept(pe.dept);
  const sc = (Array.isArray(storeCustom) ? storeCustom : []).find((c) => c?.key === category);
  if (sc) return normDept(sc.dept);
  return 'clothing';
}

export async function loadPlatformExtra() {
  const r = await query('SELECT platform_categories FROM site_settings WHERE id = 1');
  const extra = r.rows[0]?.platform_categories?.extra;
  return Array.isArray(extra) ? extra : [];
}

// يعيد حساب قسم منتجات متجرٍ واحد (أو كلّ المتاجر بلا storeId) بعد تغيّر أقسام
// الفئات. يمرّ على أزواج (متجر، فئة) المتمايزة لا على المنتجات، ويكتب ما تغيّر فقط.
export async function recomputeDepartments(storeId = null) {
  const platformExtra = await loadPlatformExtra();
  const r = await query(
    `SELECT DISTINCT p.store_id, p.category, p.department, s.custom_categories
       FROM products p JOIN stores s ON s.id = p.store_id
      ${storeId ? 'WHERE p.store_id = $1' : ''}`,
    storeId ? [storeId] : []
  );
  for (const row of r.rows) {
    const dept = departmentOf(row.category, { storeCustom: row.custom_categories, platformExtra });
    if (dept !== row.department) {
      await query('UPDATE products SET department = $1 WHERE store_id = $2 AND category = $3', [dept, row.store_id, row.category]);
    }
  }
}

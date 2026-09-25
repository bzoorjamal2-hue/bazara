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

// فئات المنصّة الثابتة للأحذية والإكسسوارات — نظير السبع للملابس. هي هويّة الموقع
// العام: الرئيسية وصفحة التصنيفات تعرضها وحدها بشكلٍ واحد، وكلّ فئةٍ تنشئها التاجرة
// بمتجرها تُربط بواحدةٍ منها فتصل قطعها إليها. والعامّتان (shoes، accessory) آخر
// كلّ قسم: لما لا يطابق شيئاً («أحذية أخرى»).
export const SUB_CATS = {
  shoes: ['heels', 'sneakers', 'sandals', 'boots', 'flats'],
  accessories: ['bags', 'watches', 'jewelry', 'sunglasses'],
};

export const BUILTIN_CATS = [...CLOTHING_CATS, ...SUB_CATS.shoes, 'shoes', ...SUB_CATS.accessories, 'accessory'];

// قسم فئةٍ مدمجة (null لغير المدمجة)
export function builtinDept(key) {
  if (CLOTHING_CATS.includes(key)) return 'clothing';
  if (DEPT_BASE_CATS[key]) return DEPT_BASE_CATS[key];
  for (const [d, keys] of Object.entries(SUB_CATS)) if (keys.includes(key)) return d;
  return null;
}

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
  const bd = builtinDept(category);
  if (bd) return bd;
  // المنصّة قبل المتجر: هكذا يقرّر getByCategory أيضاً حين يتصادف المفتاحان
  const pe = (Array.isArray(platformExtra) ? platformExtra : []).find((c) => c?.key === category);
  if (pe) return normDept(pe.dept);
  const sc = (Array.isArray(storeCustom) ? storeCustom : []).find((c) => c?.key === category);
  if (sc) return normDept(sc.dept);
  return 'clothing';
}

// ───── ربط فئات التاجرة بفئات المنصّة ─────
//
// التاجرة تسمّي فئاتها كما تشاء وتضع لها صورها؛ والموقع العام يعرض فئاته الثابتة.
// كلّ فئةٍ للتاجرة تحمل platform: مفتاح فئة المنصّة التي تقع تحتها. حين لا تختار
// (أو فئةٌ قديمة من قبل هذا) نستنتجه من الاسم: «صنادل صيفيّة» ← sandals.

// تطبيعٌ عربيّ للمطابقة: الهمزات، والتاء المربوطة، والتشكيل، و«ال»
function normAr(s) {
  return String(s || '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .split(/\s+/).map((w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w)).join(' ');
}

// كلماتٌ تدلّ على كلّ فئة (مطبّعة). الأخصّ أوّلاً: «كعب رياضي» كعب لا رياضي.
const HINTS = {
  heels: ['كعب', 'heel', 'stiletto'],
  boots: ['بوت', 'جزمه', 'جزم', 'boot'],
  sandals: ['صندل', 'صنادل', 'شبشب', 'شباشب', 'sandal', 'slipper'],
  flats: ['فلات', 'باليرينا', 'مسطح', 'flat', 'ballerina', 'loafer', 'لوفر'],
  sneakers: ['رياضي', 'سنيكر', 'كوتشي', 'sneaker', 'sport'],
  bags: ['شنط', 'شنطه', 'حقيب', 'حقائب', 'جزدان', 'bag', 'clutch', 'كلتش'],
  watches: ['ساعه', 'ساعات', 'watch'],
  sunglasses: ['نظار', 'glasses', 'sunglass'],
  jewelry: ['مجوهر', 'حلي', 'ذهب', 'فضه', 'اساور', 'اسواره', 'خاتم', 'خواتم', 'عقد', 'عقود', 'حلق', 'سلسال', 'jewel', 'ring', 'necklace', 'bracelet', 'earring'],
  abaya: ['عبايه', 'عبايات', 'عبايا', 'عباءه', 'abaya'],
  set: ['طقم', 'اطقم', 'تنوره', 'تنانير', 'بلاطين', 'بنطلون', 'set', 'skirt'],
  dress: ['فستان', 'فساتين', 'dress'],
  hijab: ['حجاب', 'حجابات', 'شال', 'شالات', 'لفحه', 'طرحه', 'hijab', 'scarf', 'shawl'],
  trench: ['ترنش', 'معطف', 'معاطف', 'كوت', 'trench', 'coat'],
  jacket: ['جاكيت', 'جاكت', 'بليزر', 'jacket', 'blazer'],
  shirt: ['قميص', 'قمصان', 'بلوزه', 'بلايز', 'بلوزات', 'shirt', 'blouse', 'top'],
};

// مفاتيح فئات المنصّة بقسمٍ ما، بترتيب العرض
export function platformKeysOf(dept, platformExtra = []) {
  const builtin = BUILTIN_CATS.filter((k) => builtinDept(k) === dept);
  const extra = (Array.isArray(platformExtra) ? platformExtra : []).filter((c) => c?.key && normDept(c.dept) === dept).map((c) => c.key);
  return [...builtin, ...extra];
}

export function inferPlatformCat(name, dept, platformExtra = []) {
  const n = normAr(name);
  if (!n) return null;
  const allowed = new Set(platformKeysOf(dept, platformExtra));
  // إضافات المدير تُطابَق باسمها
  for (const c of Array.isArray(platformExtra) ? platformExtra : []) {
    if (!allowed.has(c?.key)) continue;
    const en = normAr(c.name);
    if (en && (n.includes(en) || en.includes(n))) return c.key;
  }
  for (const [key, words] of Object.entries(HINTS)) {
    if (allowed.has(key) && words.some((w) => n.includes(normAr(w)))) return key;
  }
  return null;
}

// العامّة لكلّ قسم (للأحذية والإكسسوارات) — الملابس بلا عامّة
const DEPT_FALLBACK = { shoes: 'shoes', accessories: 'accessory' };

// فئة المنصّة لفئةٍ خاصّة بالتاجرة: اختيارها إن صحّ لقسمها، وإلا المستنتجة من اسمها
export function platformOfCustom(cc, platformExtra = []) {
  const dept = normDept(cc?.dept);
  const allowed = platformKeysOf(dept, platformExtra);
  if (cc?.platform && allowed.includes(cc.platform)) return cc.platform;
  return inferPlatformCat(cc?.name, dept, platformExtra) || DEPT_FALLBACK[dept] || null;
}

// فئة المنصّة لمنتج: فئته إن كانت فئة منصّة، وإلا فئة المنصّة التي رُبطت بها فئته
export function platformCategoryOf(category, { storeCustom = [], platformExtra = [] } = {}) {
  if (!category) return null;
  if (builtinDept(category)) return category;
  if ((Array.isArray(platformExtra) ? platformExtra : []).some((c) => c?.key === category)) return category;
  const cc = (Array.isArray(storeCustom) ? storeCustom : []).find((c) => c?.key === category);
  return cc ? platformOfCustom(cc, platformExtra) : null;
}

// فئات المتجر كما تُرسَل للواجهة: كلّ فئةٍ خاصّةٍ تحمل ربطها (المستنتج إن غاب)
export function withPlatformLinks(customCategories, platformExtra = []) {
  return (Array.isArray(customCategories) ? customCategories : []).map((c) => ({ ...c, platform: platformOfCustom(c, platformExtra) || '' }));
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
    `SELECT DISTINCT p.store_id, p.category, p.department, p.platform_category, s.custom_categories
       FROM products p JOIN stores s ON s.id = p.store_id
      ${storeId ? 'WHERE p.store_id = $1' : ''}`,
    storeId ? [storeId] : []
  );
  for (const row of r.rows) {
    const ctx = { storeCustom: row.custom_categories, platformExtra };
    const dept = departmentOf(row.category, ctx);
    const plat = platformCategoryOf(row.category, ctx);
    if (dept !== row.department || plat !== row.platform_category) {
      await query('UPDATE products SET department = $1, platform_category = $2 WHERE store_id = $3 AND category = $4', [dept, plat, row.store_id, row.category]);
    }
  }
}

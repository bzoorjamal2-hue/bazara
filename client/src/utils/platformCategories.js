import { useEffect, useState } from 'react';
import { CLOTHING_CATS, SUB_CATS, DEPT_BASE_CATS, deptOfCategory, storeDepts } from './departments.js';

// فئات المنصّة.
//
// كانت السبع فئات مكتوبةً في خمسة ملفات واجهة وملفٍ في الخادم: إضافة فئة
// للموقع كلّه كانت تعني تعديل كود ونشراً. صارت تُقرأ من مصدر واحد يجمع
// المدمجة بالإضافات التي يعرّفها المدير.
//
// التصميم إضافيّ عمداً: إن لم يعرّف المدير شيئاً فالنتيجة هي القائمة المدمجة
// نفسها بالضبط — فلا يتغيّر شيء حتى قبل نشر الترقية.

// السبع للملابس، ثمّ فئات الأحذية وعامّتها، ثمّ فئات الإكسسوارات وعامّتها — ترتيب
// الخادم نفسه (server/src/utils/department.js)
export const BUILTIN_CATS = [...CLOTHING_CATS, ...SUB_CATS.shoes, 'shoes', ...SUB_CATS.accessories, 'accessory'];

const KEY = 'bz_platform_cats';
const LIVE_KEY = 'bz_live_depts';
const LIVE_CATS_KEY = 'bz_live_cats';

// الأقسام التي فيها قطعٌ معروضة (يحسبها الخادم مع /site-info). قسمٌ فارغ لا يظهر
// بواجهة المنصّة: لا تبويب «أحذية» يفتح على لا شيء، ولا فئة «أحذية» بالقائمة.
let liveDepts = (() => {
  try { const v = JSON.parse(sessionStorage.getItem(LIVE_KEY) || 'null'); return Array.isArray(v) && v.length ? v : ['clothing']; }
  catch { return ['clothing']; }
})();

// الفئات التي فيها قطعٌ معروضة (من /site-info كذلك). null = لم تصل بعد → لا
// نُخفي شيئاً، فأوّل رسمةٍ قبل الشبكة تبقى كما كانت.
let liveCats = (() => {
  try { const v = JSON.parse(sessionStorage.getItem(LIVE_CATS_KEY) || 'null'); return Array.isArray(v) ? new Set(v) : null; }
  catch { return null; }
})();

// ما يعرّفه المدير: { extra: [{key,name,nameEn,image}], hidden: ['shirt', …], images: {heels: url} }
let custom = (() => {
  try { return { images: {}, ...(JSON.parse(sessionStorage.getItem(KEY) || 'null') || { extra: [], hidden: [] }) }; }
  catch { return { extra: [], hidden: [], images: {} }; }
})();

const listeners = new Set();

export function setPlatformCategories(next, live, cats) {
  if (Array.isArray(cats)) {
    liveCats = new Set(cats);
    try { sessionStorage.setItem(LIVE_CATS_KEY, JSON.stringify(cats)); } catch { /* تجاهل */ }
  }
  if (Array.isArray(live) && live.length) {
    liveDepts = live;
    try { sessionStorage.setItem(LIVE_KEY, JSON.stringify(live)); } catch { /* تجاهل */ }
  }
  custom = {
    extra: Array.isArray(next?.extra) ? next.extra.filter((c) => c && c.key) : [],
    hidden: Array.isArray(next?.hidden) ? next.hidden : [],
    images: next?.images && typeof next.images === 'object' ? next.images : {},
  };
  try { sessionStorage.setItem(KEY, JSON.stringify(custom)); } catch { /* التخزين ممتلئ أو محظور */ }
  listeners.forEach((fn) => fn());
}

export function onPlatformCategoriesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// مفاتيح الفئات المعروضة، بالترتيب: المدمجة غير المخفيّة ثم إضافات المدير
export function platformCatKeys() {
  const hidden = new Set(custom.hidden);
  return [
    ...BUILTIN_CATS.filter((k) => !hidden.has(k)),
    ...custom.extra.map((c) => c.key).filter((k) => !BUILTIN_CATS.includes(k)),
  ];
}

// قسم الفئة: فئات المنصّة من هنا، وفئات المتجر تُمرَّر (storeCustom)
export function catDept(key, storeCustom = []) {
  return deptOfCategory(key, { platformExtra: custom.extra, storeCustom });
}

// فئةٌ فيها قطع؟ القاعدة نفسها بواجهة المتجر: لا فئة فارغة تفتح على لا شيء
export function isLiveCat(key) {
  return !liveCats || liveCats.has(key);
}

export function liveDepartments() {
  return liveDepts;
}

// فئات المنصّة للواجهة العامّة: ما في قسمٍ فيه قطع. نموذج المنتج يستعمل
// platformCatKeys كاملةً — التاجرة تضيف أوّل حذاءٍ لقسمٍ لم يُفتح بعد.
export function publicCatKeys() {
  const live = new Set(liveDepts);
  return platformCatKeys().filter((k) => live.has(catDept(k)) && isLiveCat(k));
}

// اسم الفئة المعروض: المدمجة تُترجَم بالمفتاح، والمضافة باسمها كما كتبه المدير
export function platformCatName(key, t, lang) {
  const found = custom.extra.find((c) => c.key === key);
  if (found) return (lang === 'en' ? found.nameEn : found.name) || found.name || key;
  return t(`categories.${key}`, key);
}

// صورة الفئة: المضافة تحمل صورتها، والمدمجة لها ملفّها الثابت.
//
// WebP لا PNG: هذه السبع تُخدَم من المجلّد مباشرةً، فلا يمرّ عليها تحويل
// كلاوديناري الذي يختار الصيغة المثلى تلقائياً (f_auto) كما يفعل بصور
// المنتجات. كانت ٦٦٨ كيلو تُحمَّل كاملةً بصفحة التصنيفات؛ صارت ٩٠.
// والشفافية محفوظة — فحصتُها بالبكسل لا بالنظر: ٥٤٪ شفّافٌ بالصيغتين.
export function platformCatImage(key) {
  const found = custom.extra.find((c) => c.key === key);
  if (found?.image) return found.image;
  // صورةٌ يرفعها المدير لفئةٍ مدمجة تسبق الثابتة — هويّة الموقع بيده
  if (custom.images?.[key]) return custom.images[key];
  if (CLOTHING_CATS.includes(key)) return `/categories/${key}.webp?v=5`;
  // فئات الأحذية والإكسسوارات: رسومٌ من السلسلة نفسها (اللون والمادّة والإضاءة) بمربّع
  // السبع وهامشها. العامّتان (shoes، accessory) بلا رسم: مكانهما أيقونة القسم.
  if (SUB_CATS.shoes.includes(key) || SUB_CATS.accessories.includes(key)) return `/categories/${key}.webp?v=1`;
  return '';
}

// نسخةُ PNG احتياطاً: WebP مدعومٌ منذ سفاري ١٤ (٢٠٢٠)، لكنّ الاحتياط رخيص
// وغيابُ صورة الفئة يترك مربّعاً فارغاً بواجهة التسوّق.
export function platformCatImageFallback(key) {
  const found = custom.extra.find((c) => c.key === key);
  if (found?.image || custom.images?.[key]) return '';
  return CLOTHING_CATS.includes(key) ? `/categories/${key}.png?v=5` : '';
}

// مفاتيح فئات المنصّة بقسمٍ ما (المدمجة غير المخفيّة ثمّ إضافات المدير) — خيارات
// «تظهر بالموقع العام تحت» لفئات التاجرة
export function platformKeysOfDept(dept) {
  return platformCatKeys().filter((k) => catDept(k) === dept);
}

// فئات المنصّة الأساسيّة لمتجر.
//
// تفعيلُ قسمٍ بإعدادات المتجر يُعطي التاجرةَ فئاتِه الثابتةَ كلَّها برسومها — هي أساسُ
// كلِّ متجرٍ بالأقسام الثلاثة — تراها بإعداداتِها وبنموذجِ المنتج، فتُخفي ما لا تبيعُه أو
// تغيّرُ صورتَه واسمَه، وتضيفُ فئاتِها هي تحت عنوان القسم.
// أمّا واجهةُ المتجر (الزبائن) فلا تُظهرُ فئةً ثابتةً إلّا وفيها قطع: فئةٌ فارغةٌ تفتحُها
// الزبونةُ فلا تجدُ شيئاً تُقرأُ متجراً ناقصاً. أوّلُ منتجٍ يُضافُ لها يُظهرُها.
// ‏includeHidden للإعدادات: هناك تظهرُ الثابتةُ كلُّها (والمخفيّةُ معها كي تُظهرَها من جديد).
// ولا تُعرضُ بالإعدادات:
// - فئاتُ قسمٍ غيرِ مفعّل (ما لم تكن فيها قطع)
// - فئةٌ للتاجرة مربوطةٌ بها تحلّ محلّها: «كعب عالي» التي صنعتها بصورتها بدل
//   أساسيّةٍ بالاسم نفسه — لا فئتان متطابقتان بالمتجر
// - العامّتان (أحذية، إكسسوارات): الفئات الفرعيّة تغطّي القسم.
export function storeBuiltinKeys(store, keys = platformCatKeys(), counts = {}, { includeHidden = false } = {}) {
  const enabled = storeDepts(store);
  const meta = store?.categoryMeta || {};
  const custom = Array.isArray(store?.customCategories) ? store.customCategories : [];
  const replaced = new Set(custom.map((c) => c?.platform).filter(Boolean));
  const generic = Object.keys(DEPT_BASE_CATS);
  return keys.filter((k) => {
    if (!includeHidden) return !meta[k]?.hidden && (counts[k] || 0) > 0;
    if ((counts[k] || 0) > 0) return true;
    if (!enabled.includes(catDept(k, custom))) return false;
    if (generic.includes(k) || replaced.has(k)) return false;
    return true;
  });
}

// ترتيب فئات متجرٍ بترتيب المنصّة: فئة التاجرة المربوطة تأخذ مكان الأساسيّة التي
// تحلّ محلّها («كعب عالي» الخاصّة أوّل الأحذية لا بعد البوت)، وغير المربوطة آخراً.
// ‏getRef: مفتاح المنصّة للعنصر (مفتاحه للأساسيّة، وربطه لفئة التاجرة).
export function byPlatformOrder(list, getRef, keys = platformCatKeys()) {
  const rank = (x) => { const i = keys.indexOf(getRef(x)); return i < 0 ? keys.length : i; };
  return list.map((x, i) => [x, i]).sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[1] - b[1])).map(([x]) => x);
}

export function isBuiltinCat(key) {
  return BUILTIN_CATS.includes(key);
}

// هوك يعيد رسم المكوّن عند وصول فئات المدير (تصل بعد أول رسمة من /site-info)
export function usePlatformCatKeys() {
  const [keys, setKeys] = useState(platformCatKeys);
  useEffect(() => onPlatformCategoriesChange(() => setKeys(platformCatKeys())), []);
  return keys;
}

export function usePublicCatKeys() {
  const [keys, setKeys] = useState(publicCatKeys);
  useEffect(() => onPlatformCategoriesChange(() => setKeys(publicCatKeys())), []);
  return keys;
}

export function useLiveDepartments() {
  const [d, setD] = useState(liveDepartments);
  useEffect(() => onPlatformCategoriesChange(() => setD(liveDepartments())), []);
  return d;
}

// فئات المتجر الخاصّة، مطروحاً منها ما صار فئةَ منصّة.
//
// المتجر يختار مفاتيح فئاته بنفسه، والمدير يضيف فئات المنصّة لاحقاً: لو تصادف
// المفتاحان ظهرت الفئة مرّتين بكلّ قائمة (وبمفتاح React مكرّر). نُبقي نسخة
// المنصّة — هي المشتركة بين كل المتاجر — ونُسقط المكرّرة.
export function storeOnlyCats(customCategories, keys = platformCatKeys()) {
  const seen = new Set(keys);
  const out = [];
  for (const cc of Array.isArray(customCategories) ? customCategories : []) {
    const key = cc?.key;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cc);
  }
  return out;
}

// صورةُ فئةٍ ترفعُها التاجرة، مُعامَلةً مُعامَلةَ السبعِ المدمجة.
//
// السبعُ صورُ قطعٍ مقصوصةٍ على شفافيّةٍ بمربّعٍ واحدٍ وهامشٍ واحد. وما ترفعُه
// التاجرةُ يأتي بهوامشَ بيضاءَ عريضةٍ أو ضيّقةٍ وبنسبةٍ أيِّ نسبة — فتقعُ فئتُها
// بالصفِّ أصغرَ أو أكبرَ من جاراتِها ولو تساوى الإطار.
//
// ‏e_trim يقصُّ الحافّةَ الموحّدةَ حولَ القطعةِ مهما كان لونُها، ثمّ نُعيدُ هامشاً
// واحداً بالنسبةِ نفسِها للجميع. فتخرجُ فئةُ التاجرةِ بحجمِ السبعِ بالضبطِ ولو
// رفعت صورةً بهوامشَ مختلفة — بلا أن يُطلَبَ منها ضبطُ شيء.
export function catImage(url, width = 400) {
  const u = String(url || '');
  if (!u.includes('/upload/')) return u;
  const m = u.match(/^(https?:\/\/[^/]+\/[^/]+\/image\/upload\/)(.+)$/);
  if (!m) return u;
  const segs = m[2].split('/');
  let vi = segs.findIndex((x) => /^v\d+$/.test(x));
  if (vi === -1) vi = segs.length - 1;
  const id = segs.slice(vi).join('/');
  return `${m[1]}e_trim:12/c_pad,w_${width},h_${width},b_transparent/f_auto,q_auto,dpr_auto/${id}`;
}

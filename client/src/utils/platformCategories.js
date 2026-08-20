// فئات المنصّة.
//
// كانت السبع فئات مكتوبةً في خمسة ملفات واجهة وملفٍ في الخادم: إضافة فئة
// للموقع كلّه كانت تعني تعديل كود ونشراً. صارت تُقرأ من مصدر واحد يجمع
// المدمجة بالإضافات التي يعرّفها المدير.
//
// التصميم إضافيّ عمداً: إن لم يعرّف المدير شيئاً فالنتيجة هي القائمة المدمجة
// نفسها بالضبط — فلا يتغيّر شيء حتى قبل نشر الترقية.

export const BUILTIN_CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

const KEY = 'bz_platform_cats';

// ما يعرّفه المدير: { extra: [{key,name,nameEn,image}], hidden: ['shirt', …] }
let custom = (() => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || { extra: [], hidden: [] }; }
  catch { return { extra: [], hidden: [] }; }
})();

const listeners = new Set();

export function setPlatformCategories(next) {
  custom = {
    extra: Array.isArray(next?.extra) ? next.extra.filter((c) => c && c.key) : [],
    hidden: Array.isArray(next?.hidden) ? next.hidden : [],
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

// اسم الفئة المعروض: المدمجة تُترجَم بالمفتاح، والمضافة باسمها كما كتبه المدير
export function platformCatName(key, t, lang) {
  const found = custom.extra.find((c) => c.key === key);
  if (found) return (lang === 'en' ? found.nameEn : found.name) || found.name || key;
  return t(`categories.${key}`, key);
}

// صورة الفئة: المضافة تحمل صورتها، والمدمجة لها ملفّها الثابت
export function platformCatImage(key) {
  const found = custom.extra.find((c) => c.key === key);
  if (found?.image) return found.image;
  return BUILTIN_CATS.includes(key) ? `/categories/${key}.png` : '';
}

export function isBuiltinCat(key) {
  return BUILTIN_CATS.includes(key);
}

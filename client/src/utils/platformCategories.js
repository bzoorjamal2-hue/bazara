import { useEffect, useState } from 'react';

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

// هوك يعيد رسم المكوّن عند وصول فئات المدير (تصل بعد أول رسمة من /site-info)
export function usePlatformCatKeys() {
  const [keys, setKeys] = useState(platformCatKeys);
  useEffect(() => onPlatformCategoriesChange(() => setKeys(platformCatKeys())), []);
  return keys;
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

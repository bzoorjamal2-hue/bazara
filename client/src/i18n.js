import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from './locales/ar.json';
import { hasStoredToken } from './utils/pwa.js';

// الترجمة مقسومة عشان أول فتح يصير أخف:
//   ar.json       — نصوص المتجر (اللي بتشوفها الزبونة) → ضمن الحزمة الأساسية
//   ar.dash.json  — نصوص لوحة التحكّم والإدارة (٧٨ كيلوبايت) → ما تنزل إلا لصاحب المتجر
//   en*.json      — الإنجليزية كلها مؤجّلة، لأن العربية هي الافتراضية للجميع
// أي مفتاح جوّا dashboard/admin/finance/campaign بتستعمله صفحة زبونة مكانه ar.json
// (مثل dashboard.ordersSection بصفحة التتبّع) — منقول هناك بنفس مساره.
const CORE = { en: () => import('./locales/en.json') };
const DASH = { ar: () => import('./locales/ar.dash.json'), en: () => import('./locales/en.dash.json') };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
    },
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en'],
    interpolation: { escapeValue: false },
    // الترجمة الأساسية مُضمّنة (resources) فلا حاجة لـ Suspense — يجعل تبديل اللغة فورياً
    // بلا شاشة تحميل. bindI18nStore: 'added' يعيد الرسم لحظة وصول حزمة نصوص مؤجّلة.
    react: { useSuspense: false, bindI18nStore: 'added' },
    // شبكة أمان: لو طلب مكوّنٌ مفتاحاً من حزمة لسّاها ما نزلت، نجلبها ونرجّع فراغاً
    // مؤقّتاً (بدل ما يظهر اسم المفتاح نفسه) — والرسم بيتجدّد أول ما توصل.
    parseMissingKeyHandler: (key) => {
      if (/^(dashboard|admin|finance|campaign)\./.test(key)) ensureDash();
      return '';
    },
    detection: {
      // العربية هي الافتراضية للجميع مهما كانت لغة الجهاز — كانت لغة النظام (navigator)
      // تفتح الموقع بالإنجليزية لكل جهاز مضبوط عليها. الإنجليزية فقط لمن بدّلها بنفسه.
      // مفتاح جديد (bz_lang) لأن المفتاح القديم كان يخزّن لغة الجهاز المكتشفة تلقائياً.
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'bz_lang',
    },
  });

// كل حزمة تُجلب مرّة واحدة ولو طُلبت من أكثر من مكان (نخزّن الوعد نفسه)
const pending = {};
function load(key, importer, lng) {
  if (!importer) return Promise.resolve();
  if (!pending[key]) {
    pending[key] = importer()
      .then((m) => { i18n.addResourceBundle(lng, 'translation', m.default, true, true); })
      .catch(() => { pending[key] = undefined; }); // فشل الشبكة: نسمح بمحاولة لاحقة
  }
  return pending[key];
}

// نصوص المتجر بلغةٍ غير العربية (العربية مُضمّنة أصلاً)
export function ensureCore(lng = i18n.language) {
  return load(`core:${lng}`, CORE[lng], lng);
}

// نصوص لوحة التحكّم/الإدارة — لصاحب المتجر فقط
export function ensureDash(lng = i18n.language) {
  return load(`dash:${lng}`, DASH[lng], lng);
}

// تبديل اللغة: نجلب نصوصها أولاً كي لا تومض الصفحة بالعربية قبل الإنجليزية
export async function switchLanguage(lng) {
  await ensureCore(lng);
  if (pending[`dash:${i18n.language}`]) await ensureDash(lng);
  return i18n.changeLanguage(lng);
}

// جاهزية الإقلاع: ننتظر نصوص اللغة المختارة (وحزمة اللوحة لو كان الفاتح صاحب متجر)
// قبل أول رسمة — فلا يرى أحدٌ نصاً بلغة ثانية للحظة.
export const ready = (async () => {
  await ensureCore();
  const p = window.location.pathname;
  if (hasStoredToken() || p.startsWith('/dashboard') || p.startsWith('/admin')) await ensureDash();
})();

// نضبط اتجاه الصفحة ولغتها عند كل تغيير
function applyDir(lng) {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', lng);
}

applyDir(i18n.language || 'ar');
i18n.on('languageChanged', (lng) => { applyDir(lng); ensureCore(lng); });

export default i18n;

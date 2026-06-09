import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from './locales/ar.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en'],
    interpolation: { escapeValue: false },
    // الترجمة مُضمّنة (resources) فلا حاجة لـ Suspense — يجعل تبديل اللغة فورياً بلا شاشة تحميل
    react: { useSuspense: false },
    detection: {
      // نحفظ اختيار اللغة في localStorage
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lang',
    },
  });

// نضبط اتجاه الصفحة ولغتها عند كل تغيير
function applyDir(lng) {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', lng);
}

applyDir(i18n.language || 'ar');
i18n.on('languageChanged', applyDir);

export default i18n;

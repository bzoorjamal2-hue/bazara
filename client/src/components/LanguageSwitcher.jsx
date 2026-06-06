import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const toggle = () => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');

  return (
    <button
      onClick={toggle}
      className="inline-flex shrink-0 items-center rounded-xl bg-cream px-2.5 py-1.5 text-sm font-bold text-wine shadow-sm transition hover:bg-white"
      aria-label="Switch language"
      title="عربي / English"
    >
      {i18n.language === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}

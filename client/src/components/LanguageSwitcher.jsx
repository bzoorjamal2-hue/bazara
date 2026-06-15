import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ onChanged }) {
  const { i18n } = useTranslation();
  const toggle = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
    onChanged?.();
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-cream px-3 text-sm font-bold text-wine shadow-sm transition hover:bg-white"
      aria-label="Switch language"
      title="عربي / English"
    >
      {i18n.language === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}

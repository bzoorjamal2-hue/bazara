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
      className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-white px-2.5 text-sm font-bold leading-none text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
      aria-label="Switch language"
      title="عربي / English"
    >
      <span className="translate-y-[0.5px] leading-none">{i18n.language === 'ar' ? 'EN' : 'ع'}</span>
    </button>
  );
}

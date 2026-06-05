import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const toggle = () => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');

  return (
    <button
      onClick={toggle}
      className="btn-ghost !px-3 !py-1.5 text-sm"
      aria-label="Switch language"
      title="عربي / English"
    >
      <span className="font-semibold">{i18n.language === 'ar' ? 'EN' : 'ع'}</span>
    </button>
  );
}

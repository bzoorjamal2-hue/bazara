import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <Seo title="404" />
      <p className="font-display text-7xl font-extrabold gradient-text">404</p>
      <p className="mt-4 text-stone-300">{t('errors.notFound')}</p>
      <Link to="/" className="btn-primary mt-6">{t('nav.home')}</Link>
    </div>
  );
}

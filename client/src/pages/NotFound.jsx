import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import { BagIcon } from '../components/icons.jsx';

// 404 بستايل الموقع: بطاقة glass مزخرفة + زرّا عودة (تسوّق/رئيسية) بدل نص عارٍ
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Seo title="404" />
      <div className="glass animate-fade-up relative w-full max-w-md overflow-hidden p-10 text-center">
        <span className="dash-hairline absolute inset-x-0 top-0" />
        <div className="mb-2 flex items-center justify-center gap-2.5 text-wine/40">
          <span aria-hidden className="text-sm">❖</span>
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-wine/30" />
          <span aria-hidden className="text-sm">❖</span>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-wine/30" />
          <span aria-hidden className="text-sm">❖</span>
        </div>
        <p className="font-display text-7xl font-extrabold gradient-text">404</p>
        <p className="mt-3 text-stone-300">{t('errors.notFound')}</p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link
            to="/shop"
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
          >
            <BagIcon className="h-5 w-5" /> {t('co.doneKeepShopping')}
          </Link>
          <Link to="/" className="inline-flex items-center justify-center rounded-full border-2 border-wine/30 px-6 py-3 font-bold text-wine transition hover:bg-wine/5">
            {t('nav.home')}
          </Link>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// صفحة التصنيفات — شبكة بلاطات الفئات (طبق المرجع)
export default function Categories() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('nav.categories')} />
      <div className="mb-6 flex items-center justify-center gap-2.5 text-wine">
        <span aria-hidden className="text-sm text-wine/40">❖</span>
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-wine/30" />
        <h1 className="font-display text-2xl font-bold">{t('nav.categories')}</h1>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-wine/30" />
        <span aria-hidden className="text-sm text-wine/40">❖</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {CATS.map((c) => (
          <Link
            key={c}
            to={`/category/${c}`}
            className="group block transition duration-300 hover:-translate-y-1"
          >
            <div className="flex aspect-square items-center justify-center overflow-hidden">
              <img
                src={`/categories/${c}.png`}
                alt={t(`categories.${c}`)}
                loading="eager"
                decoding="async"
                className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="pt-1 text-center">
              <span className="text-sm font-bold text-wine">{t(`categories.${c}`)}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

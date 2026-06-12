import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import { CATEGORY_ICON } from '../components/icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench'];

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {CATS.map((c) => {
          const Icon = CATEGORY_ICON[c];
          return (
            <Link
              key={c}
              to={`/category/${c}`}
              className="group flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl bg-white shadow-sm ring-1 ring-wine/10 transition duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <Icon className="h-14 w-14 text-wine transition-transform duration-500 group-hover:scale-110" />
              <span className="text-sm font-bold text-wine">{t(`categories.${c}`)}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// صفحة التصنيفات — الفئات الأصلية + الفئات المخصّصة لصاحب المتجر (تظهر تلقائياً)
export default function Categories() {
  const { t } = useTranslation();
  const { store } = useAuth();
  const customCats = Array.isArray(store?.customCategories) ? store.customCategories : [];
  const items = [
    ...CATS.map((c) => ({ key: c, name: t(`categories.${c}`), to: `/category/${c}`, img: `/categories/${c}.png` })),
    // الفئات المخصّصة تعمل داخل متجر صاحبها (تصفية بالرابط)
    ...(store?.slug ? customCats.map((cc) => ({ key: cc.key, name: cc.name, to: `/store/${store.slug}?cat=${cc.key}`, img: cc.image || '' })) : []),
  ];

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
        {items.map((it) => (
          <Link key={it.key} to={it.to} className="group block transition duration-300 hover:-translate-y-1">
            <div className="flex aspect-square items-center justify-center overflow-hidden">
              {it.img ? (
                <img
                  src={it.img}
                  alt={it.name}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-wine/60" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 4a3 3 0 0 0 6 0" />
                  <path d="M12 4 4.5 9v3l3-1.5V20h9V10.5l3 1.5V9L12 4Z" />
                </svg>
              )}
            </div>
            <div className="pt-1 text-center">
              <span className="text-sm font-bold text-wine">{it.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

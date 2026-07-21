import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { cldThumb } from '../utils/cloudinary.js';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// صفحة التصنيفات — الفئات الأصلية + الفئات المخصّصة لصاحب المتجر (تظهر تلقائياً)
export default function Categories() {
  const { t } = useTranslation();
  const { store } = useAuth();
  const customCats = Array.isArray(store?.customCategories) ? store.customCategories : [];
  const items = [
    ...CATS.map((c) => ({ key: c, name: t(`categories.${c}`), to: `/category/${c}`, img: `/categories/${c}.png` })),
    // الفئات المخصّصة: نفس صفحة الفئة (CategoryPage) — بالـbreadcrumbs والرجوع والأيقونة
    ...(store?.slug ? customCats.map((cc) => ({ key: cc.key, name: cc.name, to: `/category/${cc.key}`, img: cc.image || '' })) : []),
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

      {/* بطاقات glass فاخرة بنفس ستايل بطاقات الموقع (hairline ذهبي + رفعة وظل عند المرور) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {items.map((it, i) => (
          <Link
            key={it.key}
            to={it.to}
            className="glass group animate-fade-up relative flex flex-col items-center overflow-hidden p-4 text-center transition duration-300 hover:-translate-y-1.5 hover:shadow-glow"
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
          >
            <span className="dash-hairline absolute inset-x-0 top-0" />
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden">
              {it.img ? (
                <img
                  src={it.img.startsWith('/') ? it.img : cldThumb(it.img, 400)}
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
            <span className="mt-2 font-display text-sm font-bold text-stone-100">{it.name}</span>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-wine/25 px-3.5 py-1 text-[11px] font-bold text-wine transition group-hover:border-wine group-hover:bg-wine group-hover:text-cream">
              {t('home.shopNow')}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

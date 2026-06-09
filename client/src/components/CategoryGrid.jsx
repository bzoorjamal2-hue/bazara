import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICON } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench'];

// شبكة بطاقات الفئات: صورة منتج حقيقية من الفئة (إن توفّرت) وإلا أيقونة أنيقة.
// onSelect → أزرار فلترة (صفحة المتجر) | بدونها → روابط لصفحة الفئة (الرئيسية)
export default function CategoryGrid({ onSelect, active, images }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {CATS.map((c, i) => {
        const Icon = CATEGORY_ICON[c];
        const img = images?.[c];
        const isActive = active === c;
        const inner = (
          <>
            <div
              className={`relative aspect-[4/5] overflow-hidden rounded-2xl shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg ${
                isActive ? 'ring-2 ring-wine ring-offset-2 ring-offset-cream' : ''
              }`}
            >
              {img ? (
                <img
                  src={img}
                  alt={t(`categories.${c}`)}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="pub-cat flex h-full items-center justify-center">
                  <Icon className="h-14 w-14 text-cream transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16" />
                </div>
              )}
            </div>
            <span className={`mt-2 block text-center text-sm font-bold sm:text-base ${isActive ? 'text-wine' : 'text-[#2b2b2b]'}`}>
              {t(`categories.${c}`)}
            </span>
          </>
        );
        const cls = 'group animate-fade-up block';
        const style = { animationDelay: `${i * 60}ms` };

        return onSelect ? (
          <button key={c} type="button" onClick={() => onSelect(isActive ? 'all' : c)} className={cls} style={style}>
            {inner}
          </button>
        ) : (
          <Link key={c} to={`/category/${c}`} className={cls} style={style}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

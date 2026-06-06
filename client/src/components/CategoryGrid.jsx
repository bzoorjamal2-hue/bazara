import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICON } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab'];

// شبكة بطاقات الفئات: بطاقة خمرية بأيقونة عاجية + اسم الفئة أسفلها.
// onSelect → أزرار فلترة (صفحة المتجر) | بدونها → روابط لصفحة الفئة (الرئيسية)
export default function CategoryGrid({ onSelect, active }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {CATS.map((c, i) => {
        const Icon = CATEGORY_ICON[c];
        const isActive = active === c;
        const inner = (
          <>
            <div
              className={`pub-cat flex h-24 items-center justify-center rounded-2xl p-4 transition-all duration-300 group-hover:-translate-y-1 sm:h-28 lg:h-32 ${
                isActive ? 'ring-2 ring-wine ring-offset-2 ring-offset-cream' : ''
              }`}
            >
              <Icon className="h-12 w-12 text-cream transition-transform duration-300 group-hover:scale-110 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
            </div>
            <span className={`mt-2 block text-center text-xs font-semibold sm:text-sm ${isActive ? 'text-wine' : 'text-[#2b2b2b]'}`}>
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

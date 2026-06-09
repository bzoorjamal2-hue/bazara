import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICON } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench'];

// بطاقات فئات أنيقة (editorial): صورة منتج حقيقية + اسم الفئة فوقها بتدرّج ناعم.
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
          <div
            className={`relative aspect-[3/4] overflow-hidden rounded-3xl shadow-md ring-1 ring-wine/10 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-xl ${
              isActive ? 'ring-2 ring-wine' : ''
            }`}
          >
            {img ? (
              <img
                src={img}
                alt={t(`categories.${c}`)}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="pub-cat flex h-full items-center justify-center">
                <Icon className="h-16 w-16 text-cream/90 transition-transform duration-300 group-hover:scale-110" />
              </div>
            )}
            {/* تدرّج سفلي لإبراز الاسم */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 text-center">
              <span className="font-display text-sm font-bold text-white drop-shadow sm:text-base">{t(`categories.${c}`)}</span>
              <span className="mx-auto mt-1.5 block h-0.5 w-6 rounded-full bg-white/70 transition-all duration-300 group-hover:w-10" />
            </div>
          </div>
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

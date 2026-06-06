import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICON } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab'];

// شبكة بطاقات الفئات برسوم ملابس ذهبية.
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
            <div className="flex h-24 items-center justify-center sm:h-28">
              <Icon className={`h-16 w-16 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-gold-300' : 'text-gold-400/80'}`} />
            </div>
            <span className={`block text-center text-sm font-semibold ${isActive ? 'text-gold-200' : 'text-stone-200'}`}>
              {t(`categories.${c}`)}
            </span>
          </>
        );
        const cls = `group glass animate-fade-up p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow ${
          isActive ? 'ring-1 ring-gold-400/60' : ''
        }`;
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

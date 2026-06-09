import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICON } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench'];

// بطاقة فئة: تعرض صورة الفئة المصمّمة من /categories/{key}.png كما هي تماماً.
// إن لم تتوفّر الصورة بعد، تظهر بطاقة احتياطية بأيقونة + اسم الفئة.
function CategoryCard({ c }) {
  const { t } = useTranslation();
  const [err, setErr] = useState(false);
  const Icon = CATEGORY_ICON[c];

  if (err) {
    return (
      <div className="pub-cat flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-3xl">
        <Icon className="h-16 w-16 text-cream/90" />
        <span className="font-display text-base font-bold text-cream">{t(`categories.${c}`)}</span>
      </div>
    );
  }
  return (
    <div className="aspect-[3/4] overflow-hidden rounded-3xl shadow-md ring-1 ring-wine/10">
      <img
        src={`/categories/${c}.png`}
        alt={t(`categories.${c}`)}
        loading="lazy"
        onError={() => setErr(true)}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  );
}

// شبكة الفئات: onSelect → فلترة (صفحة المتجر) | بدونها → روابط لصفحة الفئة (الرئيسية)
export default function CategoryGrid({ onSelect, active }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {CATS.map((c, i) => {
        const isActive = active === c;
        const cls = `group block animate-fade-up transition-all duration-300 hover:-translate-y-1.5 ${isActive ? 'ring-2 ring-wine ring-offset-2 ring-offset-cream rounded-3xl' : ''}`;
        const style = { animationDelay: `${i * 60}ms` };
        return onSelect ? (
          <button key={c} type="button" onClick={() => onSelect(isActive ? 'all' : c)} className={cls} style={style}>
            <CategoryCard c={c} />
          </button>
        ) : (
          <Link key={c} to={`/category/${c}`} className={cls} style={style}>
            <CategoryCard c={c} />
          </Link>
        );
      })}
    </div>
  );
}

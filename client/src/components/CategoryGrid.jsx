import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICON } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench'];

// عدد البطاقات المعروضة حسب عرض الشاشة (جوال 2 · آيباد 3 · كمبيوتر 5)
function getPerPage() {
  if (typeof window === 'undefined') return 5;
  const w = window.innerWidth;
  if (w < 640) return 2;
  if (w < 1024) return 3;
  return 5;
}

// بطاقة فئة: بلاطة كريمية فاتحة + أيقونة الملبس البنّية + اسم الفئة (طبق المرجع).
function CategoryCard({ c }) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[c];
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl bg-white px-2 py-3 shadow-sm ring-1 ring-wine/10 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
      <Icon className="h-12 w-12 text-wine transition-transform duration-500 group-hover:scale-110 sm:h-14 sm:w-14" />
      <span className="text-xs font-bold text-wine sm:text-sm">{t(`categories.${c}`)}</span>
    </div>
  );
}

function Arrow({ dir, rtl, onClick }) {
  const RIGHT = 'M9 6l6 6-6 6'; // chevron ›
  const LEFT = 'M15 6l-6 6 6 6'; // chevron ‹
  // السابق نحو البداية، التالي نحو النهاية — يتبع اتجاه اللغة
  const path = dir === 'prev' ? (rtl ? RIGHT : LEFT) : (rtl ? LEFT : RIGHT);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'next' ? 'next' : 'prev'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wine/20 bg-white text-wine shadow-sm transition hover:bg-wine hover:text-cream"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}

// شبكة/كاروسيل الفئات — تظهر بعدد متجاوب مع الشاشة، مع أسهم ونقاط عند الحاجة.
export default function CategoryGrid({ onSelect, active }) {
  const { i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const [perPage, setPerPage] = useState(getPerPage());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const onResize = () => setPerPage(getPerPage());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pages = Math.ceil(CATS.length / perPage);
  useEffect(() => { setPage((p) => Math.min(p, pages - 1)); }, [pages]);

  const hasNav = CATS.length > perPage;
  // صفحات غير متداخلة: كل فئة تظهر مرة واحدة فقط (آخر صفحة قد تكون أقل عدداً)
  const start = page * perPage;
  const shown = CATS.slice(start, start + perPage);
  const go = (d) => setPage((p) => (p + d + pages) % pages);

  const Item = ({ c }) => {
    const isActive = active === c;
    const cls = `group block animate-fade-up transition-all duration-300 hover:-translate-y-1.5 ${isActive ? 'ring-2 ring-wine ring-offset-2 ring-offset-cream rounded-3xl' : ''}`;
    return onSelect ? (
      <button type="button" onClick={() => onSelect(isActive ? 'all' : c)} className={cls}>
        <CategoryCard c={c} />
      </button>
    ) : (
      <Link to={`/category/${c}`} className={cls}>
        <CategoryCard c={c} />
      </Link>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 sm:gap-3">
        {hasNav && <Arrow dir="prev" rtl={rtl} onClick={() => go(-1)} />}
        <div
          className="grid flex-1 gap-3 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${perPage}, minmax(0,1fr))` }}
        >
          {shown.map((c) => <Item key={c} c={c} />)}
        </div>
        {hasNav && <Arrow dir="next" rtl={rtl} onClick={() => go(1)} />}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-label={`page ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === page ? 'w-5 bg-wine' : 'w-1.5 bg-wine/25'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

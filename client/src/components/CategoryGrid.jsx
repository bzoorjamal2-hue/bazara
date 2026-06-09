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

// بطاقة فئة: صورة اللوقو المصمّمة /categories/{key}.png — مع بطاقة احتياطية بأيقونة لو غابت الصورة.
function CategoryCard({ c }) {
  const { t } = useTranslation();
  const [err, setErr] = useState(false);
  const Icon = CATEGORY_ICON[c];
  if (err) {
    return (
      <div className="pub-cat flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-3xl">
        <Icon className="h-14 w-14 text-cream/90" />
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

function Arrow({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'next' ? 'next' : 'prev'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wine/20 bg-white text-wine shadow-sm transition hover:bg-wine hover:text-cream"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'next' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  );
}

// شبكة/كاروسيل الفئات — تظهر بعدد متجاوب مع الشاشة، مع أسهم ونقاط عند الحاجة.
export default function CategoryGrid({ onSelect, active }) {
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
  const maxStart = Math.max(0, CATS.length - perPage);
  const start = Math.min(page * perPage, maxStart);
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
        {hasNav && <Arrow dir="prev" onClick={() => go(-1)} />}
        <div
          className="grid flex-1 gap-3 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${perPage}, minmax(0,1fr))` }}
        >
          {shown.map((c) => <Item key={c} c={c} />)}
        </div>
        {hasNav && <Arrow dir="next" onClick={() => go(1)} />}
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cldThumb } from '../utils/cloudinary.js';

const BUILTIN = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// عدد البطاقات المعروضة حسب عرض الشاشة (جوال 2 · آيباد 3 · كمبيوتر 5)
function getPerPage() {
  if (typeof window === 'undefined') return 5;
  const w = window.innerWidth;
  if (w < 640) return 2;
  if (w < 1024) return 3;
  return 5;
}

// بطاقة فئة عصرية: صورة (صورة المالكة الحقيقية إن وُجدت، وإلا أيقونة) بزوايا دائرية
// ناعمة بلا إطار بنّي، والاسم بالأسفل مباشرة. تدعم الفئات الأصلية والمخصّصة.
function CategoryCard({ cat }) {
  const { t } = useTranslation();
  const label = cat.name || (cat.builtin ? t(`categories.${cat.key}`) : cat.key);
  // صورة المالكة المخصّصة تُحسَّن بحجم أصغر وصيغة تلقائية لظهور أسرع؛ والأيقونة الثابتة كما هي
  const src = cat.image ? cldThumb(cat.image, 400) : cat.builtin ? `/categories/${cat.key}.png` : '';
  return (
    <div className="transition duration-300 group-hover:-translate-y-1">
      {/* بلا إطار/خلفية — يظهر شكل الأيقونة فقط (الصور بلا خلفية)، بحجم موحّد */}
      <div className="flex aspect-square items-center justify-center overflow-hidden">
        {src ? (
          <img
            src={src}
            alt={label}
            loading="eager"
            decoding="async"
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          // فئة مخصّصة بلا صورة → أيقونة ملبس خطّية أنيقة بلون خمري
          <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-wine/70" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 4a3 3 0 0 0 6 0" />
            <path d="M12 4 4.5 9v3l3-1.5V20h9V10.5l3 1.5V9L12 4Z" />
          </svg>
        )}
      </div>
      <div className="pt-1 text-center">
        <span className="text-xs font-bold text-wine sm:text-sm">{label}</span>
      </div>
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
      // mb-6 يرفع السهم ليتوسّط مع الصورة (يعوّض ارتفاع اسم الفئة أسفل البطاقة)
      className="mb-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wine/20 bg-white text-wine shadow-sm transition hover:bg-wine hover:text-cream"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}

// شبكة/كاروسيل الفئات — تظهر بعدد متجاوب مع الشاشة، مع أسهم ونقاط عند الحاجة.
// cats: قائمة كائنات {key, name, image, builtin}. إن لم تُمرَّر، نبني من الفئات الأصلية الخمس.
export default function CategoryGrid({ onSelect, active, images = {}, names = {}, cats }) {
  const { i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const list = cats && cats.length
    ? cats
    : BUILTIN.map((k) => ({ key: k, name: names[k], image: images[k], builtin: true }));
  const [perPage, setPerPage] = useState(getPerPage());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const onResize = () => setPerPage(getPerPage());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pages = Math.ceil(list.length / perPage);
  useEffect(() => { setPage((p) => Math.min(p, pages - 1)); }, [pages]);

  const hasNav = list.length > perPage;
  // صفحات غير متداخلة: كل فئة تظهر مرة واحدة فقط (آخر صفحة قد تكون أقل عدداً)
  const start = page * perPage;
  const shown = list.slice(start, start + perPage);
  const go = (d) => setPage((p) => (p + d + pages) % pages);

  const Item = ({ cat }) => {
    const isActive = active === cat.key;
    const cls = `group block animate-fade-up transition-all duration-300 hover:-translate-y-1.5 ${isActive ? 'ring-2 ring-wine ring-offset-2 ring-offset-cream rounded-3xl' : ''}`;
    return onSelect ? (
      <button type="button" onClick={() => onSelect(isActive ? 'all' : cat.key)} className={cls}>
        <CategoryCard cat={cat} />
      </button>
    ) : (
      <Link to={`/category/${cat.key}`} className={cls}>
        <CategoryCard cat={cat} />
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
          {shown.map((cat) => <Item key={cat.key} cat={cat} />)}
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

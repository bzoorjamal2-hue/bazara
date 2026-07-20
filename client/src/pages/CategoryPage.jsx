import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import FilteredProductGrid from '../components/FilteredProductGrid.jsx';
import CatThumb from '../components/CatThumb.jsx';
import { getCache, setCache } from '../utils/apiCache.js';
import { smartNav } from '../utils/nav.js';

// لوقو بيت أنيق (زر العودة للصفحة الرئيسية)
function HomeGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 11.3 12 4l8.8 7.3" />
      <path d="M5.2 9.8V19a1 1 0 0 0 1 1h3.3v-4.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3.3a1 1 0 0 0 1-1V9.8" />
    </svg>
  );
}

// أيقونة التصنيفات (زر العودة لصفحة التصنيفات)
function GridGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

// فاصل مسار التنقّل — يشير لاتجاه التتابع (يساراً في العربية، يميناً في الإنجليزية)
function Crumb({ className = 'h-4 w-4' }) {
  const { i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0 text-wine/35`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

export default function CategoryPage() {
  const { cat } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, store } = useAuth();
  // "الرئيسية": المشترك المسجّل يعود لمتجره العام (صفحته بحسابه)؛ الزائر لبازارا العام
  const homeTo = user && store?.slug ? `/store/${store.slug}` : '/shop';
  // المشترك المسجّل يرى منتجات متجره فقط (بلا خلط مع متاجر أخرى)
  const scopeSlug = user && store?.slug ? store.slug : '';
  // فئة مخصّصة؟ نأخذ اسمها وصورتها من إعدادات المتجر (نفس تجربة الفئات الأصلية)
  const customCat = (store?.customCategories || []).find((c) => c.key === cat);
  const label = customCat?.name || t(`categories.${cat}`);
  const cacheKey = `cat:${cat}:${scopeSlug}`;
  const [products, setProducts] = useState(() => getCache(cacheKey) || null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cached = getCache(cacheKey);
    setProducts(cached || null); // عرض فوري من المخزّن عند الرجوع، ثم تحديث بالخلفية
    setError('');
    api
      .get(`/public/category/${cat}${scopeSlug ? `?store=${scopeSlug}` : ''}`)
      .then((r) => { setProducts(r.data.products); setCache(cacheKey, r.data.products); })
      .catch((err) => { if (!cached) setError(getErrorMessage(err)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, scopeSlug]);

  return (
    <>
      <Seo title={label} />

      {/* مسار التنقّل المتتابع: الرئيسية ← التصنيفات ← الفئة (أزرار فعّالة بأيقونات للرجوع) */}
      <nav className="mb-5 mt-1 flex flex-wrap items-center gap-1.5 text-sm">
        {/* رجوع ذكي: إن كانت الوجهة هي الصفحة السابقة فعلياً نرجع بالتاريخ
            (فيستعيد المستخدم نفس موضع تمريره) بدل فتح صفحة جديدة من الأعلى */}
        <button
          type="button"
          onClick={() => smartNav(navigate, homeTo)}
          aria-label={t('nav.home')}
          title={t('nav.home')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
        >
          <HomeGlyph />
        </button>
        <Crumb />
        <button
          type="button"
          onClick={() => smartNav(navigate, '/categories')}
          aria-label={t('nav.categories')}
          title={t('nav.categories')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
        >
          <GridGlyph />
        </button>
        <Crumb />
        <span className="flex items-center gap-2 rounded-full bg-wine/10 px-2.5 py-1 font-display text-base font-bold text-wine">
          {customCat ? (
            customCat.image ? <img src={customCat.image} alt="" className="h-7 w-7 shrink-0 rounded object-contain" /> : null
          ) : (
            <CatThumb cat={cat} className="h-7 w-7" />
          )}
          {label}
        </span>
      </nav>

      {error ? (
        <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <p className="text-stone-300">{error}</p>
          <button
            type="button"
            onClick={() => smartNav(navigate, homeTo)}
            className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
          >
            {t('nav.home')}
          </button>
        </div>
      ) : !products ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('common.noResults')}</div>
      ) : (
        <FilteredProductGrid products={products} />
      )}
    </>
  );
}

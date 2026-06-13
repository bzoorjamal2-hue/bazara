import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CatThumb from '../components/CatThumb.jsx';

// لوقو بيت أنيق (زر العودة للصفحة الرئيسية)
function HomeGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 11.3 12 4l8.8 7.3" />
      <path d="M5.2 9.8V19a1 1 0 0 0 1 1h3.3v-4.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3.3a1 1 0 0 0 1-1V9.8" />
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
  const { t } = useTranslation();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setProducts(null);
    setError('');
    api
      .get(`/public/category/${cat}`)
      .then((r) => setProducts(r.data.products))
      .catch((err) => setError(getErrorMessage(err)));
  }, [cat]);

  return (
    <>
      <Seo title={t(`categories.${cat}`)} />

      {/* مسار التنقّل المتتابع: الرئيسية ← التصنيفات ← الفئة (كل خطوة زر فعّال للرجوع) */}
      <nav className="mb-5 mt-1 flex flex-wrap items-center gap-1.5 text-sm">
        <Link
          to="/shop"
          aria-label={t('nav.home')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
        >
          <HomeGlyph />
        </Link>
        <Crumb />
        <Link to="/categories" className="rounded-full px-2.5 py-1 font-semibold text-wine/70 transition hover:bg-wine/10 hover:text-wine">
          {t('nav.categories')}
        </Link>
        <Crumb />
        <span className="flex items-center gap-2 rounded-full bg-wine/10 px-2.5 py-1 font-display text-base font-bold text-wine">
          <CatThumb cat={cat} className="h-7 w-7" />
          {t(`categories.${cat}`)}
        </span>
      </nav>

      {error ? (
        <div className="glass p-10 text-center text-stone-300">{error}</div>
      ) : !products ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('common.noResults')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} whatsapp={p.storeWhatsapp} />
          ))}
        </div>
      )}
    </>
  );
}

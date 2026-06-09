import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
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

      {/* مسار التنقّل مع زر العودة للرئيسية */}
      <nav className="mb-5 mt-1 flex items-center gap-2 text-sm">
        <Link
          to="/"
          aria-label="home"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
        >
          <HomeGlyph />
        </Link>
        <span className="text-wine/40">←</span>
        <Link to="/" className="text-wine/70 hover:text-wine">{t('nav.home')}</Link>
        <span className="text-wine/40">←</span>
        <span className="flex items-center gap-2 font-display text-lg font-bold text-wine">
          <CatThumb cat={cat} className="h-8 w-8" />
          {t(`categories.${cat}`)}
        </span>
      </nav>

      {error ? (
        <div className="glass p-10 text-center text-stone-300">{error}</div>
      ) : !products ? (
        <Spinner full />
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

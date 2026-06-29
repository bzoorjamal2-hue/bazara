import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { TagIcon } from '../components/icons.jsx';
import { getCache, setCache } from '../utils/apiCache.js';

// صفحة العروض — كل القطع المخفّضة عبر متاجر بازارا بمكان واحد
export default function Offers() {
  const { t } = useTranslation();
  const [products, setProducts] = useState(() => getCache('offers') || null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/public/offers')
      .then((r) => { setProducts(r.data.products); setCache('offers', r.data.products); })
      .catch((e) => { if (!getCache('offers')) setError(getErrorMessage(e)); });
  }, []);

  return (
    <>
      <Seo title={t('offers.title')} description={t('offers.subtitle')} />

      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2.5 text-wine">
          <span aria-hidden className="text-sm text-wine/40">❖</span>
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-wine/30" />
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><TagIcon className="h-6 w-6" /> {t('offers.title')}</h1>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-wine/30" />
          <span aria-hidden className="text-sm text-wine/40">❖</span>
        </div>
        <p className="mt-1 text-sm text-wine/60">{t('offers.subtitle')}</p>
      </div>

      {error ? (
        <div className="glass p-10 text-center text-stone-300">{error}</div>
      ) : !products ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('offers.empty')}</div>
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import FilteredProductGrid from '../components/FilteredProductGrid.jsx';
import { TagIcon } from '../components/icons.jsx';
import { getCache, setCache } from '../utils/apiCache.js';

// صفحة العروض — كل القطع المخفّضة عبر متاجر بازارا بمكان واحد
export default function Offers() {
  const { t } = useTranslation();
  const [products, setProducts] = useState(() => getCache('offers') || null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api
      .get('/public/offers')
      .then((r) => { setProducts(r.data.products); setCache('offers', r.data.products); })
      .catch((e) => { if (!getCache('offers')) setError(getErrorMessage(e)); });
  };
  useEffect(load, []);

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
        // خطأ شبكة: بطاقة بمخرجين (إعادة محاولة + متابعة التسوّق) بدل نص عارٍ يترك الزائرة معلّقة
        <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <p className="text-stone-300">{error}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={load}
              className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
            >
              {t('assistant.retry')}
            </button>
            <Link to="/shop" className="rounded-full border border-wine/30 px-6 py-3 text-sm font-bold text-wine transition hover:bg-wine hover:text-cream">
              {t('co.doneKeepShopping')}
            </Link>
          </div>
        </div>
      ) : !products ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        // حالة فراغ لائقة بأيقونة ومخرج — كباقي الصفحات، بدل نص عارٍ يترك الزائرة معلّقة
        <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-wine/10 text-wine"><TagIcon className="h-8 w-8" /></span>
          <p className="text-stone-300">{t('offers.empty')}</p>
          <Link
            to="/shop"
            className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
          >
            {t('co.doneKeepShopping')}
          </Link>
        </div>
      ) : (
        <FilteredProductGrid products={products} defaultSort="discount" />
      )}
    </>
  );
}

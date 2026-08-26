import { useEffect, useMemo, useState } from 'react';
import useSessionState from '../hooks/useSessionState.js';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import FilteredProductGrid from '../components/FilteredProductGrid.jsx';
import { TagIcon } from '../components/icons.jsx';
import { PageTitle, StateCard, Act, Act2 } from '../components/PageUI.jsx';
import OffersBar, { filterByTier } from '../components/OffersBar.jsx';
import { getCache, setCache } from '../utils/apiCache.js';

// صفحة العروض — كل القطع المخفّضة عبر متاجر بازارا بمكان واحد
export default function Offers() {
  const { t } = useTranslation();
  const [products, setProducts] = useState(() => getCache('offers') || null);
  const [error, setError] = useState('');
  const [tier, setTier] = useSessionState('offers:tier', 'all'); // تصفيتها تبقى بالعودة

  const load = () => {
    setError('');
    api
      .get('/public/offers')
      .then((r) => { setProducts(r.data.products); setCache('offers', r.data.products); })
      .catch((e) => { if (!getCache('offers')) setError(getErrorMessage(e)); });
  };
  useEffect(load, []);

  const shown = useMemo(() => filterByTier(products, tier), [products, tier]);

  return (
    <>
      <Seo title={t('offers.title')} description={t('offers.subtitle')} />

      <PageTitle icon={<TagIcon className="h-6 w-6" />} title={t('offers.title')} sub={t('offers.subtitle')} />

      {error ? (
        // خطأ شبكة: بطاقة بمخرجين (إعادة محاولة + متابعة التسوّق) بدل نص عارٍ يترك الزائرة معلّقة
        <StateCard icon={<TagIcon className="h-7 w-7" />} text={error}>
          <Act onClick={load}>{t('assistant.retry')}</Act>
          <Act2 to="/shop">{t('co.doneKeepShopping')}</Act2>
        </StateCard>
      ) : !products ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        // حالة فراغ لائقة بأيقونة ومخرج — كباقي الصفحات، بدل نص عارٍ يترك الزائرة معلّقة
        <StateCard icon={<TagIcon className="h-7 w-7" />} text={t('offers.empty')}>
          <Act to="/shop">{t('co.doneKeepShopping')}</Act>
        </StateCard>
      ) : (
        <>
          <OffersBar products={products} tier={tier} onTier={setTier} />

          <FilteredProductGrid products={shown} defaultSort="discount" />
        </>
      )}
    </>
  );
}


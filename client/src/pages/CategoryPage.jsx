import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { CATEGORY_ICON } from '../components/icons.jsx';

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

  const Icon = CATEGORY_ICON[cat];

  return (
    <>
      <Seo title={t(`categories.${cat}`)} />
      <div className="mb-6 flex items-center gap-3">
        {Icon && <Icon className="h-10 w-10 text-gold-400" />}
        <h1 className="font-display text-3xl font-extrabold gradient-text">{t(`categories.${cat}`)}</h1>
        <div className="gold-divider flex-1" />
      </div>

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

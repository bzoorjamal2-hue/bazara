import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';

export default function StorePage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { store: myStore } = useAuth();
  const isOwner = myStore?.slug === slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get(`/public/store/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, t('errors.storeNotFound'))));
  }, [slug, t]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
      const matchCat = cat === 'all' || p.category === cat;
      const matchPrice = !maxPrice || p.price <= parseFloat(maxPrice);
      return matchQ && matchCat && matchPrice;
    });
  }, [data, q, cat, maxPrice]);

  if (error) return <div className="glass p-10 text-center text-stone-300">{error}</div>;
  if (!data) return <Spinner full />;

  const { store } = data;
  const wa = store.whatsapp;
  const featured = data.products.filter((p) => p.featured);
  const accent = store.themeColor || '#d4af37';

  return (
    <>
      <Seo title={store.name} description={store.description || `${store.name} — ${t('store.products')}`} image={store.logoUrl} />

      {/* ترويسة المتجر */}
      <section className="glass-strong mb-6 overflow-hidden p-8" style={{ borderColor: `${accent}55` }}>
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-start">
          <img
            src={store.logoUrl || 'https://placehold.co/120x120/121214/d4af37?text=%F0%9F%91%91'}
            alt={store.name}
            className="h-24 w-24 rounded-2xl object-cover shadow-gold"
            style={{ borderWidth: 2, borderStyle: 'solid', borderColor: accent }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold" style={{ color: accent }}>{store.name}</h1>
            {store.description && <p className="mt-2 max-w-2xl text-stone-300">{store.description}</p>}
            <p className="mt-2 text-sm text-stone-400">{data.products.length} {t('store.products')}</p>

            {/* روابط التواصل */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {wa && (
                <a href={buildWhatsappLink(wa)} target="_blank" rel="noreferrer" className="btn-whatsapp !px-3 !py-1.5 text-sm">
                  💬 {t('store.contactWhatsapp')}
                </a>
              )}
              {store.instagram && (
                <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-1.5 text-sm">📸 Instagram</a>
              )}
              {store.tiktok && (
                <a href={`https://tiktok.com/@${store.tiktok}`} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-1.5 text-sm">🎵 TikTok</a>
              )}
              {store.phone && (
                <a href={`tel:${store.phone}`} className="btn-ghost !px-3 !py-1.5 text-sm" dir="ltr">📞 {store.phone}</a>
              )}
            </div>
          </div>
        </div>

        {/* توصيل ودفع */}
        {(store.deliveryInfo || store.paymentInfo) && (
          <div className="mt-6 grid gap-3 border-t border-gold-400/15 pt-5 sm:grid-cols-2">
            {store.deliveryInfo && (
              <div className="rounded-xl bg-black/20 p-3 text-sm">
                <p className="mb-1 font-semibold text-gold-200">🚚 {t('store.deliveryInfo')}</p>
                <p className="text-stone-300">{store.deliveryInfo}</p>
              </div>
            )}
            {store.paymentInfo && (
              <div className="rounded-xl bg-black/20 p-3 text-sm">
                <p className="mb-1 font-semibold text-gold-200">💳 {t('store.paymentInfo')}</p>
                <p className="text-stone-300">{store.paymentInfo}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* منتجات مميّزة */}
      {featured.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 font-display text-xl font-bold gradient-text">★ {t('store.featured')}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} whatsapp={wa} />
            ))}
          </div>
        </section>
      )}

      {/* شريط صاحب المتجر */}
      {isOwner && (
        <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 sm:flex-row">
          <p className="text-sm text-gold-200">👋 {t('store.ownerView')}</p>
          <Link to="/dashboard?tab=myProducts" className="btn-primary !py-2 text-sm">＋ {t('dashboard.addProduct')}</Link>
        </div>
      )}

      {/* تصفّح حسب الفئة */}
      <section className="mb-6">
        <h2 className="mb-4 font-display text-xl font-bold gradient-text">{t('home.browseByCategory')}</h2>
        <CategoryGrid onSelect={setCat} active={cat} />
      </section>

      {/* أدوات البحث والسعر */}
      <section className="glass mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">{t('common.search')}</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} />
        </div>
        <div className="sm:w-36">
          <label className="label">{t('common.to')} ({t('common.price')})</label>
          <input type="number" min="0" className="input" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="∞" />
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">
          {data.products.length === 0 ? t('store.noProducts') : t('common.noResults')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} whatsapp={wa} />
          ))}
        </div>
      )}

      <FloatingWhatsApp number={wa} />
    </>
  );
}

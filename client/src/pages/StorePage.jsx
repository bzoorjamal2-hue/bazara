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
import { SearchIcon, CATEGORY_ICON } from '../components/icons.jsx';

const PAGE_SIZE = 8;

export default function StorePage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { store: myStore } = useAuth();
  const isOwner = myStore?.slug === slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all'); // 'all' = الصفحة الرئيسية للمتجر
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get(`/public/store/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, t('errors.storeNotFound'))));
  }, [slug, t]);

  useEffect(() => setPage(1), [cat, q]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
      const matchCat = cat === 'all' || p.category === cat;
      return matchQ && matchCat;
    });
  }, [data, q, cat]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (error) return <div className="glass p-10 text-center text-stone-300">{error}</div>;
  if (!data) return <Spinner full />;

  const { store } = data;
  const wa = store.whatsapp;
  const accent = store.themeColor || '#d4af37';
  const featured = data.products.filter((p) => p.featured);
  const CatIcon = cat !== 'all' ? CATEGORY_ICON[cat] : null;

  return (
    <>
      <Seo title={store.name} description={store.description || `${store.name}`} image={store.logoUrl} />

      {/* ترويسة المتجر */}
      <section className="glass-strong mb-5 overflow-hidden p-6 sm:p-8" style={{ borderColor: `${accent}55` }}>
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
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {wa && <a href={buildWhatsappLink(wa)} target="_blank" rel="noreferrer" className="btn-whatsapp !px-3 !py-1.5 text-sm">💬 {t('store.contactWhatsapp')}</a>}
              {store.instagram && <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-1.5 text-sm">📸 Instagram</a>}
              {store.phone && <a href={`tel:${store.phone}`} className="btn-ghost !px-3 !py-1.5 text-sm" dir="ltr">📞 {store.phone}</a>}
            </div>
          </div>
        </div>
      </section>

      {/* شريط البحث */}
      <div className="glass mb-5 flex items-center gap-2 p-2">
        <span className="px-2 text-stone-400"><SearchIcon className="h-5 w-5" /></span>
        <input className="w-full bg-transparent py-2 text-stone-100 placeholder:text-stone-500 focus:outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} />
      </div>

      {/* شريط المالك */}
      {isOwner && (
        <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 sm:flex-row">
          <p className="text-sm text-gold-200">👋 {t('store.ownerView')}</p>
          <Link to="/dashboard?tab=myProducts" className="btn-primary !py-2 text-sm">＋ {t('dashboard.addProduct')}</Link>
        </div>
      )}

      {cat === 'all' ? (
        <>
          {/* تصفّح حسب الفئة */}
          <section className="mb-8">
            <h2 className="mb-4 font-display text-xl font-bold gradient-text">{t('home.browseByCategory')}</h2>
            <CategoryGrid onSelect={setCat} active={cat} />
          </section>

          {/* منتجات مميّزة */}
          {featured.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 font-display text-xl font-bold gradient-text">★ {t('store.featured')}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {featured.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={wa} />)}
              </div>
            </section>
          )}

          {/* كل المنتجات */}
          <h2 className="mb-4 font-display text-xl font-bold gradient-text">{t('store.products')}</h2>
        </>
      ) : (
        <>
          {/* فتات التنقّل */}
          <nav className="mb-4 flex items-center gap-2 text-sm text-stone-400">
            <button onClick={() => setCat('all')} className="hover:text-gold-200">🏠 {store.name}</button>
            <span>›</span>
            <span className="flex items-center gap-1.5 font-semibold text-gold-200">{CatIcon && <CatIcon className="h-5 w-5" />}{t(`categories.${cat}`)}</span>
          </nav>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setCat('all')} className="btn-ghost !py-1.5 text-sm">← {t('common.back')}</button>
          </div>
        </>
      )}

      {/* شبكة المنتجات */}
      {filtered.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">
          {data.products.length === 0 ? t('store.noProducts') : t('common.noResults')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pageItems.map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={wa} />)}
          </div>

          {/* ترقيم الصفحات */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${page === i + 1 ? 'bg-gold-400 text-ink-950' : 'border border-gold-400/30 text-stone-200 hover:bg-gold-400/10'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <FloatingWhatsApp number={wa} />
    </>
  );
}

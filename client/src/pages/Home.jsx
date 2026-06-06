import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import { ShieldIcon, DiamondIcon, BoltIcon } from '../components/icons.jsx';

export default function Home() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // الصفحة الرئيسية متاحة دائماً على الرابط / للجميع (بدون أي تحويل)
  useEffect(() => {
    api
      .get('/public/home')
      .then((res) => setData(res.data))
      .catch(() => setData({ stores: [], featured: [], products: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Seo title={t('app.name')} description={t('home.heroDesc')} />

      {/* Hero — بانر خمري فاخر */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="pub-hero relative px-6 py-16 text-center sm:py-24">
          {/* زخارف عاجية شفافة */}
          <div className="pointer-events-none absolute -top-12 start-1/4 h-44 w-44 animate-float rounded-full bg-cream/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 end-1/4 h-44 w-44 animate-float rounded-full bg-cream/[0.07] blur-3xl" />
          <p className="mb-3 animate-fade-in text-sm font-semibold tracking-[0.3em] text-cream/70">LUXURY FASHION</p>
          <h1 className="animate-fade-up font-display text-4xl font-extrabold leading-tight text-cream sm:text-6xl">
            {t('home.heroTitle')} <span className="text-cream/95 underline decoration-cream/30 decoration-2 underline-offset-8">{t('home.heroHighlight')}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-base text-cream/80 sm:text-lg" style={{ animationDelay: '80ms' }}>
            {t('home.heroDesc')}
          </p>
          <div className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-3" style={{ animationDelay: '160ms' }}>
            <Link to="/register" className="inline-flex items-center rounded-xl bg-cream px-6 py-2.5 text-base font-semibold text-wine shadow-lg transition hover:-translate-y-0.5 hover:bg-white">{t('home.ctaStart')}</Link>
            <a href="#stores" className="inline-flex items-center rounded-xl border border-cream/40 px-6 py-2.5 text-base font-semibold text-cream transition hover:bg-cream/10">{t('home.ctaExplore')}</a>
          </div>
          {/* نقاط التنقّل */}
          <div className="mt-9 flex items-center justify-center gap-2">
            <span className="h-2 w-6 rounded-full bg-cream/80" />
            <span className="h-2 w-2 rounded-full bg-cream/30" />
            <span className="h-2 w-2 rounded-full bg-cream/30" />
          </div>
        </div>
      </section>

      {/* تصفّح حسب الفئة */}
      <section className="mt-14">
        <SectionTitle>{t('home.browseByCategory')}</SectionTitle>
        <CategoryGrid />
      </section>

      {/* مزايا */}
      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          { t: t('home.feature1Title'), d: t('home.feature1Desc'), Icon: ShieldIcon },
          { t: t('home.feature2Title'), d: t('home.feature2Desc'), Icon: DiamondIcon },
          { t: t('home.feature3Title'), d: t('home.feature3Desc'), Icon: BoltIcon },
        ].map((f, i) => (
          <div key={i} className="glass animate-fade-up p-6" style={{ animationDelay: `${i * 80}ms` }}>
            <f.Icon className="mb-3 h-8 w-8 text-gold-400" />
            <h3 className="font-display text-lg font-bold text-stone-100">{f.t}</h3>
            <p className="mt-1 text-sm text-stone-400">{f.d}</p>
          </div>
        ))}
      </section>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* منتجات مميّزة */}
          {data.featured?.length > 0 && (
            <section className="mt-14">
              <SectionTitle>{t('home.featuredProducts')}</SectionTitle>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {data.featured.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* متاجر مميزة */}
          <section id="stores" className="mt-14">
            <SectionTitle>{t('home.featuredStores')}</SectionTitle>
            {data.stores.length === 0 ? (
              <p className="text-stone-400">{t('common.noResults')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.stores.map((s, i) => (
                  <Link
                    key={s.id}
                    to={`/store/${s.slug}`}
                    className="glass animate-fade-up flex items-center gap-4 p-5 transition hover:-translate-y-1 hover:shadow-glow"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <img
                      src={s.logoUrl || 'https://placehold.co/80x80/121214/d4af37?text=%F0%9F%91%91'}
                      alt={s.name}
                      className="h-14 w-14 rounded-xl border border-gold-400/30 object-cover"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-stone-100">{s.name}</h3>
                      <p className="text-xs text-stone-400">{s.productsCount} {t('store.products')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* أحدث المنتجات */}
          <section className="mt-14">
            <SectionTitle>{t('home.latestProducts')}</SectionTitle>
            {data.products.length === 0 ? (
              <p className="text-stone-400">{t('common.noResults')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {data.products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <h2 className="font-display text-2xl font-bold gradient-text">{children}</h2>
      <div className="gold-divider flex-1" />
    </div>
  );
}

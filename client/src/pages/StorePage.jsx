import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import StoreHeader from '../components/StoreHeader.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { CATEGORY_ICON } from '../components/icons.jsx';

const PAGE_SIZE = 8;
const CATS = ['abaya', 'set', 'dress', 'hijab'];

export default function StorePage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { store: myStore } = useAuth();
  const isOwner = myStore?.slug === slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all'); // 'all' = الصفحة الرئيسية للمتجر
  const [sort, setSort] = useState('default');
  const [sizeF, setSizeF] = useState('all');
  const [offersOnly, setOffersOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get(`/public/store/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, t('errors.storeNotFound'))));
  }, [slug, t]);

  useEffect(() => setPage(1), [cat, q, sort, sizeF, offersOnly]);

  // المقاسات المتوفّرة (تُستخرج من المنتجات)
  const sizes = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.products.map((p) => (p.size || '').trim()).filter(Boolean))];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.products.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
      const matchCat = cat === 'all' || p.category === cat;
      const matchSize = sizeF === 'all' || (p.size || '').trim() === sizeF;
      const matchOffers = !offersOnly || (p.oldPrice && p.oldPrice > p.price);
      return matchQ && matchCat && matchSize && matchOffers;
    });
    const cmp = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
    }[sort];
    if (cmp) list = [...list].sort(cmp);
    return list;
  }, [data, q, cat, sizeF, offersOnly, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (error) return <div className="glass p-10 text-center text-stone-300">{error}</div>;
  if (!data) return <Spinner full />;

  const { store } = data;
  const wa = store.whatsapp;
  const featured = data.products.filter((p) => p.featured);
  const CatIcon = cat !== 'all' ? CATEGORY_ICON[cat] : null;
  const scrollToAll = () => document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <Seo title={store.name} description={store.description || `${store.name}`} image={store.logoUrl} />

      {/* الهيدر الخاص بالمتجر: قائمة + اسم + بحث */}
      <StoreHeader store={store} q={q} setQ={setQ} cat={cat} setCat={setCat} />

      {/* شريط المالك */}
      {isOwner && (
        <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 sm:flex-row">
          <p className="text-sm text-gold-200">👋 {t('store.ownerView')}</p>
          <Link to="/dashboard?tab=myProducts" className="btn-primary !py-2 text-sm">＋ {t('dashboard.addProduct')}</Link>
        </div>
      )}

      {cat === 'all' ? (
        <>
          {/* سلايدر البانرات (شريحة ثابتة + شرايح عروض المالك) */}
          <HeroSlider store={store} />

          {/* أزرار التواصل + عدد المنتجات */}
          <div className="mb-7 flex flex-col items-center gap-3">
            <p className="text-sm text-stone-400">{data.products.length} {t('store.products')}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {wa && (
                <a href={buildWhatsappLink(wa)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white">
                  💬 {t('store.contactWhatsapp')}
                </a>
              )}
              {store.instagram && (
                <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-wine/30 px-4 py-2 text-sm font-semibold text-wine hover:bg-wine/5">
                  📸 Instagram
                </a>
              )}
              {store.phone && (
                <a href={`tel:${store.phone}`} dir="ltr" className="inline-flex items-center gap-1.5 rounded-full border border-wine/30 px-4 py-2 text-sm font-semibold text-wine hover:bg-wine/5">
                  📞 {store.phone}
                </a>
              )}
            </div>
          </div>

          {/* تصفّحي حسب الفئة + عرض الكل */}
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold gradient-text">{t('store.browseByCategory')}</h2>
              <button
                onClick={scrollToAll}
                className="inline-flex items-center gap-1 rounded-full border border-wine/30 px-4 py-1.5 text-sm font-semibold text-wine transition hover:bg-wine/5"
              >
                {t('store.viewAll')} ‹
              </button>
            </div>
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
          <h2 id="all-products" className="mb-4 scroll-mt-28 font-display text-xl font-bold gradient-text">{t('store.products')}</h2>
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

      {/* شريط الفلاتر والترتيب (أفقي قابل للسحب على الموبايل) */}
      {data.products.length > 0 && (
        <div className="mb-4 -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2">
            <PillSelect
              value={sort}
              onChange={setSort}
              prefix={t('store.sortBy')}
              options={[
                ['default', t('store.sortDefault')],
                ['newest', t('store.sortNewest')],
                ['priceAsc', t('store.sortPriceAsc')],
                ['priceDesc', t('store.sortPriceDesc')],
              ]}
            />
            <PillSelect
              value={cat}
              onChange={setCat}
              prefix={t('store.filterCategory')}
              options={[['all', t('store.allProducts')], ...CATS.map((c) => [c, t(`categories.${c}`)])]}
            />
            {sizes.length > 0 && (
              <PillSelect
                value={sizeF}
                onChange={setSizeF}
                prefix={t('store.sizeLabel')}
                options={[['all', t('store.allSizes')], ...sizes.map((s) => [s, s])]}
              />
            )}
            <button
              type="button"
              onClick={() => setOffersOnly((o) => !o)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                offersOnly ? 'border-wine bg-wine text-cream' : 'border-wine/25 bg-white text-wine hover:bg-wine/5'
              }`}
            >
              {t('store.specialOffers')}
            </button>
          </div>
        </div>
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

// قائمة منسدلة على شكل حبة (pill) لشريط الفلاتر/الترتيب
function PillSelect({ value, onChange, options, prefix }) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-full border border-wine/25 bg-white py-2 pe-9 ps-4 text-sm font-semibold text-wine focus:outline-none focus:ring-2 focus:ring-wine/20"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {prefix ? `${prefix}: ${l}` : l}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[10px] text-wine">▼</span>
    </div>
  );
}

// سلايدر البانرات: شريحة أولى ثابتة (اسم المتجر + شعار/تاغلاين) + شرايح المالك المتغيّرة.
// تشغيل تلقائي + سحب باللمس + نقاط تنقّل.
function HeroSlider({ store }) {
  const banners = Array.isArray(store.banners) ? store.banners : [];
  const slides = [{ fixed: true }, ...banners];
  const len = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef(null);

  useEffect(() => {
    if (len <= 1 || paused) return undefined;
    const id = setInterval(() => setI((p) => (p + 1) % len), 3500);
    return () => clearInterval(id);
  }, [len, paused]);

  const go = (n) => setI(((n % len) + len) % len);

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    startX.current = null;
    setPaused(false);
  };

  return (
    <section className="relative mb-5">
      <div
        className="overflow-hidden rounded-3xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* المسار: نفرضه LTR لتفادي مشاكل اتجاه RTL مع الإزاحة */}
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)`, direction: 'ltr' }}>
          {slides.map((s, idx) => (
            <div key={idx} className="w-full shrink-0" dir="rtl">
              <div className="pub-hero relative flex min-h-[230px] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[300px] sm:py-16">
                <div className="pointer-events-none absolute -top-12 start-1/4 h-44 w-44 animate-float rounded-full bg-cream/10 blur-3xl" />
                {s.fixed ? (
                  <>
                    {store.logoUrl && (
                      <img src={store.logoUrl} alt={store.name} className="mb-4 h-20 w-20 rounded-2xl border-2 border-cream/30 object-cover shadow-lg sm:h-24 sm:w-24" />
                    )}
                    <h1 className="font-display text-3xl font-extrabold text-cream sm:text-5xl">{store.name}</h1>
                    <p className="mt-3 font-display text-lg text-cream/90 sm:text-2xl">أناقة .. حشمة .. تميز</p>
                    <p className="mt-1 text-xs tracking-[0.25em] text-cream/55 sm:text-sm">ELEGANCE · MODESTY · DISTINCTION</p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-3xl font-extrabold text-cream sm:text-5xl">{s.title}</h2>
                    {s.subtitle && <p className="mx-auto mt-3 max-w-xl text-cream/80 sm:text-lg">{s.subtitle}</p>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* نقاط التنقّل */}
      {len > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => go(idx)}
              aria-label={`slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-wine' : 'w-2 bg-wine/30'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

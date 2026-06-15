import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Seo from '../components/Seo.jsx';
import { StorePageSkeleton } from '../components/Skeleton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import StoreHeader from '../components/StoreHeader.jsx';
import FeaturesBar from '../components/FeaturesBar.jsx';
import CatThumb from '../components/CatThumb.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import CloseButton from '../components/CloseButton.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { cldVideoPoster } from '../utils/cloudinary.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { SIZES, sizeLabel } from '../utils/sizes.js';

const PAGE_SIZE = 8;
const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench'];

export default function StorePage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { store: myStore } = useAuth();
  const { ensureStore } = useCart();
  const isOwner = myStore?.slug === slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all'); // 'all' = الصفحة الرئيسية للمتجر
  const [sort, setSort] = useState('default');
  const [sizesSel, setSizesSel] = useState([]); // مقاسات مختارة (متعدّد)
  const [offersOnly, setOffersOnly] = useState(false);
  const [openSheet, setOpenSheet] = useState(null); // 'sort' | 'size' | 'offers'
  const [viewAll, setViewAll] = useState(false); // "عرض جميع المنتجات" من الصفحة الرئيسية
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get(`/public/store/${slug}`)
      .then((res) => {
        const s = res.data.store;
        // نحقن معرّف/اسم المتجر بكل منتج، وننادي ensureStore لتفريغ السلة إن كانت من متجر مختلف
        const products = (res.data.products || []).map((p) => ({ ...p, storeSlug: s.slug, storeName: s.name }));
        setData({ ...res.data, products });
        ensureStore(s.slug);
      })
      .catch((err) => setError(getErrorMessage(err, t('errors.storeNotFound'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, t]);

  useEffect(() => setPage(1), [cat, q, sort, sizesSel, offersOnly]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.products.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
      const matchCat = cat === 'all' || p.category === cat;
      // مقاسات المنتج قد تكون متعدّدة (مفصولة بفواصل)
      const prodSizes = (p.size || '').split(',').map((s) => s.trim()).filter(Boolean);
      const matchSize = sizesSel.length === 0 || sizesSel.some((s) => prodSizes.includes(s));
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
  }, [data, q, cat, sizesSel, offersOnly, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (error) return <div className="glass p-10 text-center text-stone-300">{error}</div>;
  if (!data) return <StorePageSkeleton />;

  const { store } = data;
  // واتساب المتجر: رقم الإعدادات إن وُجد، وإلا رقم المالك المُدخل عند التسجيل
  const wa = store.whatsapp || store.ownerPhone || '';
  const featured = data.products.filter((p) => p.featured);
  // صورة تمثيلية لكل فئة من أول منتج فيها (لعرض الفئات بصور حقيقية)
  const catImages = {};
  for (const p of data.products) {
    if (catImages[p.category]) continue;
    const im = p.imageUrl || (p.images && p.images[0]) || (p.videoUrl && cldVideoPoster(p.videoUrl));
    if (im) catImages[p.category] = im;
  }
  const searching = q.trim().length > 0;
  // أحدث المنتجات (لقسم "جديدنا")
  const newest = [...data.products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8);
  const pickCategory = (c) => { setViewAll(false); setCat(c); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const clearSearch = () => { setQ(''); setCat('all'); setViewAll(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <>
      <Seo title={store.name} description={store.description || `${store.name}`} image={store.logoUrl} />

      {/* الهيدر الخاص بالمتجر: قائمة + اسم + بحث */}
      <StoreHeader store={store} q={q} setQ={setQ} cat={cat} setCat={setCat} products={data.products} />

      {/* شريط المالك */}
      {isOwner && (
        <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 sm:flex-row">
          <p className="text-sm text-gold-200">👋 {t('store.ownerView')}</p>
          <Link to="/dashboard?tab=myProducts" className="btn-primary !py-2 text-sm">＋ {t('dashboard.addProduct')}</Link>
        </div>
      )}

      {searching || cat !== 'all' || viewAll ? (
        /* عرض الشبكة: نتائج بحث / فئة / كل المنتجات */
        <>
          {searching ? (
            <nav className="mb-4 mt-2 flex items-center gap-2 text-sm">
              <button onClick={clearSearch} className="flex h-8 w-8 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream" aria-label="home"><HomeGlyph /></button>
              <Crumb />
              <span className="font-display text-lg font-bold text-wine">{t('store.searchResults')} «{q.trim()}»</span>
            </nav>
          ) : viewAll ? (
            <nav className="mb-4 mt-2 flex items-center gap-2 text-sm">
              <button onClick={() => { setViewAll(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream" aria-label="home"><HomeGlyph /></button>
              <Crumb />
              <span className="font-display text-lg font-bold text-wine">{t('store.allProducts')}</span>
            </nav>
          ) : (
            <nav className="mb-4 mt-2 flex items-center gap-2 text-sm">
              <button onClick={() => pickCategory('all')} className="flex h-8 w-8 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream" aria-label="home"><HomeGlyph /></button>
              <Crumb />
              <button onClick={() => pickCategory('all')} className="text-wine/70 hover:text-wine">{t('store.storeRoot')}</button>
              <Crumb />
              <span className="flex items-center gap-2 font-display text-lg font-bold text-wine">
                <CatThumb cat={cat} className="h-8 w-8" />
                {t(`categories.${cat}`)}
              </span>
            </nav>
          )}

          {/* شرائط الفلترة */}
          {data.products.length > 0 && (
            <div className="mb-4 -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max items-center gap-2">
                <Chip onClick={() => setOpenSheet('sort')}>{t('store.sortBy')}: {t(SORT_LABEL[sort] || 'store.sortDefault')}</Chip>
                <Chip onClick={() => setOpenSheet('size')} active={sizesSel.length > 0}>{t('store.sizeLabel')}{sizesSel.length ? ` (${sizesSel.length})` : ''}</Chip>
                <Chip onClick={() => setOpenSheet('offers')} active={offersOnly}>{t('store.specialOffers')}</Chip>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="glass p-10 text-center text-stone-400">
              {data.products.length === 0 ? t('store.noProducts') : t('common.noResults')}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {pageItems.map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={wa} />)}
              </div>
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i} onClick={() => { setPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${page === i + 1 ? 'bg-wine text-cream' : 'border border-wine/30 text-wine hover:bg-wine/10'}`}>{i + 1}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* الصفحة الرئيسية للمتجر — بأسلوب خريف: هيرو + فئات + جديدنا + الأكثر مبيعاً + عرض الكل */
        <>
          <HeroSlider store={store} />

          <section className="mb-9 mt-7">
            <SectionTitle>{t('store.browseByCategory')}</SectionTitle>
            <CategoryGrid onSelect={pickCategory} active={cat} images={catImages} />
          </section>

          <ProductSection title={`${t('store.newArrivals')} ❤️`} products={newest} wa={wa} />
          <ProductSection title={t('store.bestSellers')} products={featured.slice(0, 8)} wa={wa} />

          {data.products.length > 0 && (
            <div className="mb-10 text-center">
              <button
                onClick={() => { setViewAll(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="rounded-full border border-wine/40 px-8 py-3 font-semibold text-wine transition hover:bg-wine hover:text-cream"
              >
                {t('store.viewAllProducts')}
              </button>
            </div>
          )}
        </>
      )}

      {/* شريط المزايا — بآخر كل صفحات المتجر، قبل الفوتر */}
      <FeaturesBar />

      {/* فوتر المتجر بأيقونات تواصل مربوطة بحسابات المشترك */}
      <StoreFooter store={store} wa={wa} />

      {/* النوافذ السفلية للفلاتر */}
      {openSheet === 'sort' && (
        <SortSheet value={sort} onClose={() => setOpenSheet(null)} onApply={(v) => { setSort(v); setOpenSheet(null); }} />
      )}
      {openSheet === 'size' && (
        <SizeSheet sizes={SIZES} value={sizesSel} onClose={() => setOpenSheet(null)} onApply={(v) => { setSizesSel(v); setOpenSheet(null); }} />
      )}
      {openSheet === 'offers' && (
        <OffersSheet value={offersOnly} onClose={() => setOpenSheet(null)} onApply={(v) => { setOffersOnly(v); setOpenSheet(null); }} />
      )}

      <FloatingWhatsApp number={wa} />
    </>
  );
}

const SORT_LABEL = {
  default: 'store.sortDefault',
  newest: 'store.sortNewest',
  priceAsc: 'store.sortPriceAsc',
  priceDesc: 'store.sortPriceDesc',
};

// فوتر المتجر: أيقونات تواصل مربوطة بحسابات المشترك
function StoreFooter({ store, wa }) {
  const { t, i18n } = useTranslation();
  const ltr = i18n.language === 'en';
  const ig = store.instagram ? `https://instagram.com/${store.instagram.replace(/^@/, '')}` : '';
  const fb = store.facebook ? (/^https?:\/\//.test(store.facebook) ? store.facebook : `https://facebook.com/${store.facebook.replace(/^@/, '')}`) : '';
  const waLink = wa ? buildWhatsappLink(wa) : '';
  const socials = [
    waLink && { label: 'WhatsApp', href: waLink, icon: <WAGlyph /> },
    ig && { label: 'Instagram', href: ig, icon: <IGGlyph /> },
    fb && { label: 'Facebook', href: fb, icon: <FBGlyph /> },
  ].filter(Boolean);

  return (
    <footer className="pub-footer -mx-4 -mb-8 mt-10 sm:-mx-6">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 text-center sm:px-6">
        <p className="font-display text-2xl font-bold text-cream">{store.name}</p>
        {store.description && <p className="mx-auto mt-2 max-w-md text-sm text-cream/70">{store.description}</p>}
        {socials.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/25 text-cream/90 transition hover:bg-cream/10"
              >
                {s.icon}
              </a>
            ))}
          </div>
        )}
        {/* تتبّع الطلب — زر بارز يلاحظه الزبون بسهولة */}
        <Link
          to="/track"
          className="group mx-auto mt-7 flex w-full max-w-sm items-center gap-3 rounded-2xl bg-cream px-5 py-3.5 text-start text-wine shadow-lg ring-1 ring-cream/40 transition hover:-translate-y-0.5 hover:bg-white"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wine/10 text-wine">
            <TruckGlyph />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold leading-tight">{t('nav.track')}</span>
            <span className="block truncate text-xs text-wine/60">{t('track.hint')}</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-wine/50 transition group-hover:text-wine" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ltr ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </Link>
        <div className="mx-auto mt-7 h-px max-w-md bg-cream/15" />
        <p className="mt-5 text-xs text-cream/60">© {new Date().getFullYear()} {store.name} — {t('footer.rights')}</p>
      </div>
    </footer>
  );
}

// شاحنة توصيل أنيقة (لزر تتبّع الطلب)
function TruckGlyph({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H14a1 1 0 0 1 1 1v9H3.5A.5.5 0 0 1 3 14.5Z" />
      <path d="M15 8h3.2a1 1 0 0 1 .8.4l2 2.7a1 1 0 0 1 .2.6V15h-6Z" />
      <circle cx="7.5" cy="17.5" r="1.9" />
      <circle cx="17" cy="17.5" r="1.9" />
      <path d="M9.4 17.5h5.7" />
    </svg>
  );
}

function WAGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648 3.973-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}
function IGGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FBGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6v1.9H16l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

// حبة الفلتر (chip)
function Chip({ onClick, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active ? 'border-wine bg-wine text-cream' : 'border-wine/25 bg-white text-wine hover:bg-wine/5'
      }`}
    >
      {children} <span className="text-[9px]">▼</span>
    </button>
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

// قالب النافذة السفلية
// لوقو بيت أنيق (زر العودة للصفحة الرئيسية للمتجر)
function HomeGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 11.3 12 4l8.8 7.3" />
      <path d="M5.2 9.8V19a1 1 0 0 0 1 1h3.3v-4.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3.3a1 1 0 0 0 1-1V9.8" />
    </svg>
  );
}

// عنوان قسم مركزي بزخرفة أنيقة (طبق المرجع — مطابق للصفحة الرئيسية)
function SectionTitle({ children }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2.5 text-wine sm:gap-3">
      <span aria-hidden className="text-sm text-wine/40">❖</span>
      <span className="h-px w-7 bg-gradient-to-r from-transparent to-wine/30 sm:w-12" />
      <h2 className="whitespace-nowrap font-display text-xl font-bold sm:text-2xl">{children}</h2>
      <span className="h-px w-7 bg-gradient-to-l from-transparent to-wine/30 sm:w-12" />
      <span aria-hidden className="text-sm text-wine/40">❖</span>
    </div>
  );
}

// قسم منتجات بعنوان مركزي (جديدنا / الأكثر مبيعاً)
function ProductSection({ title, products, wa }) {
  if (!products || products.length === 0) return null;
  return (
    <section className="mb-10">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={wa} />)}
      </div>
    </section>
  );
}

function FilterSheet({ title, onClose, onReset, onApply, children }) {
  const { t } = useTranslation();
  useScrollLock(true); // مفتوحة دائماً عند التركيب — تجمّد الخلفية
  return (
    <div className="fixed inset-0 z-[80] flex items-end">
      {/* الخلفية تُغلق النافذة بالضغط خارجها */}
      <div className="absolute inset-0 bg-black/40 animate-fade-up" onClick={onClose} />
      <div className="animate-sheet relative max-h-[80vh] w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onReset} className="w-16 text-start text-sm font-medium text-wine/70 hover:text-wine">Reset</button>
          <h3 className="flex-1 text-center font-display text-lg font-bold text-[#2b2b2b]">{title}</h3>
          <span className="flex w-16 justify-end"><CloseButton onClick={onClose} variant="wine" /></span>
        </div>
        {children}
        <button onClick={onApply} className="mt-5 w-full rounded-xl bg-wine py-3 font-semibold text-cream transition hover:bg-wine-dark">
          {t('store.apply')}
        </button>
      </div>
    </div>
  );
}

function Radio({ on }) {
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? 'border-wine' : 'border-stone-300'}`}>
      {on && <span className="h-2.5 w-2.5 rounded-full bg-wine" />}
    </span>
  );
}
function Check({ on }) {
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${on ? 'border-wine bg-wine text-cream' : 'border-stone-300'}`}>
      {on && '✓'}
    </span>
  );
}

function SortSheet({ value, onClose, onApply }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState(value);
  const opts = [['default', 'store.sortDefault'], ['newest', 'store.sortNewest'], ['priceAsc', 'store.sortPriceAsc'], ['priceDesc', 'store.sortPriceDesc']];
  return (
    <FilterSheet title={t('store.sortBy')} onClose={onClose} onReset={() => setSel('default')} onApply={() => onApply(sel)}>
      <div className="space-y-1">
        {opts.map(([v, l]) => (
          <button key={v} onClick={() => setSel(v)} className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-[#2b2b2b] hover:bg-wine/5">
            <span>{t(l)}</span>
            <Radio on={sel === v} />
          </button>
        ))}
      </div>
    </FilterSheet>
  );
}

function SizeSheet({ sizes, value, onClose, onApply }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState(value);
  const [q, setQ] = useState('');
  const toggle = (s) => setSel((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const list = sizes.filter((s) => !q || s.toLowerCase().includes(q.toLowerCase()));
  return (
    <FilterSheet title={t('store.sizeLabel')} onClose={onClose} onReset={() => setSel([])} onApply={() => onApply(sel)}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`${t('common.search')}...`}
        className="mb-3 w-full rounded-xl border border-wine/15 px-4 py-2.5 text-[#2b2b2b] placeholder:text-stone-400 focus:border-wine/40 focus:outline-none"
      />
      <div className="space-y-1">
        {list.map((s) => (
          <button key={s} onClick={() => toggle(s)} className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-[#2b2b2b] hover:bg-wine/5">
            <span>{sizeLabel(s, t)}</span>
            <Check on={sel.includes(s)} />
          </button>
        ))}
      </div>
    </FilterSheet>
  );
}

function OffersSheet({ value, onClose, onApply }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState(value);
  return (
    <FilterSheet title={t('store.specialOffers')} onClose={onClose} onReset={() => setSel(false)} onApply={() => onApply(sel)}>
      <button onClick={() => setSel((s) => !s)} className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-[#2b2b2b] hover:bg-wine/5">
        <span>{t('store.discounts')}</span>
        <Check on={sel} />
      </button>
    </FilterSheet>
  );
}

// سلايدر البانرات: شريحة أولى ثابتة (اسم المتجر + شعار/تاغلاين) + شرايح المالك المتغيّرة.
// تشغيل تلقائي + سحب باللمس + نقاط تنقّل.
function HeroSlider({ store }) {
  const banners = Array.isArray(store.banners) ? store.banners.filter(Boolean) : [];
  // كل الشرائح من بانرات المالك (يتحكم بالأولى وكلها). لو ما في بانرات نعرض شريحة افتراضية باسم المتجر.
  const slides = banners.length ? banners : [{ fixed: true }];
  const len = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState(0); // إزاحة السحب الحيّة (px) — يتبع الإصبع
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const touch = useRef({ x: 0, y: 0, active: false, horiz: false });

  useEffect(() => {
    if (len <= 1 || paused) return undefined;
    // تتحرّك الشرائح تلقائياً كل 3 ثوانٍ (بما فيها شرائح الفيديو) — منظر أحلى ومتجدّد
    const id = setInterval(() => setI((p) => (p + 1) % len), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len, paused, i]);

  const go = (n) => setI(((n % len) + len) % len);

  // سحب لحظي يتبع الإصبع: المسار يتحرّك مع إصبعك، ويستقر على شريحة واحدة فقط عند الإفلات.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || len <= 1) return undefined;

    const onStart = (e) => {
      const tch = e.touches[0];
      touch.current = { x: tch.clientX, y: tch.clientY, active: true, horiz: false };
      setPaused(true);
    };
    const onMove = (e) => {
      if (!touch.current.active) return;
      const tch = e.touches[0];
      const dx = tch.clientX - touch.current.x;
      const dy = tch.clientY - touch.current.y;
      if (!touch.current.horiz && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
        touch.current.horiz = true;
        draggingRef.current = true;
      }
      if (touch.current.horiz) {
        e.preventDefault(); // يمنع تمرير الصفحة عمودياً أثناء السحب الأفقي
        // مقاومة عند الحواف (أول/آخر شريحة) لإحساس طبيعي
        let d = dx;
        if ((i === 0 && dx > 0) || (i === len - 1 && dx < 0)) d = dx / 3;
        setDrag(d);
      }
    };
    const onEnd = (e) => {
      if (!touch.current.active) return;
      const dx = e.changedTouches[0].clientX - touch.current.x;
      const w = el.offsetWidth || 1;
      const threshold = Math.min(70, w * 0.18); // تجاوز هذه المسافة = ننتقل شريحة واحدة
      let next = i;
      if (touch.current.horiz && Math.abs(dx) > threshold) {
        next = dx < 0 ? i + 1 : i - 1;               // سحب لليسار = التالي، لليمين = السابق (يتبع الإصبع)
        next = Math.max(0, Math.min(len - 1, next));  // شريحة واحدة فقط، بلا تجاوز للحواف
      }
      draggingRef.current = false;
      touch.current.active = false;
      setDrag(0);
      setI(next);
      setPaused(false);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [len, i]);

  return (
    <section className="relative mb-5">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-3xl"
        style={{ touchAction: 'pan-y' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* المسار: نفرضه LTR لتفادي مشاكل اتجاه RTL مع الإزاحة */}
        <div
          className="flex"
          style={{
            transform: `translateX(calc(-${i * 100}% + ${drag}px))`,
            direction: 'ltr',
            transition: draggingRef.current ? 'none' : 'transform 480ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            willChange: 'transform',
          }}
        >
          {slides.map((s, idx) => {
            const isColor = !s.fixed && s.bgType === 'color' && s.bgValue;
            const isImage = !s.fixed && s.bgType === 'image' && s.bgValue;
            const isVideo = !s.fixed && s.bgType === 'video' && s.bgValue;
            const custom = isColor || isImage || isVideo;
            // الصورة والفيديو يُعرضان كعنصر وسائط بنفس درجة التعتيم (brightness) تماماً —
            // فيبقى التعتيم موحّداً بين كل الشرائح بلا فرق عند الانتقال.
            const style = isColor ? { background: s.bgValue } : undefined;
            return (
              <div key={idx} className="w-full shrink-0" dir="rtl">
                <div
                  className={`relative isolate flex h-[260px] flex-col items-center justify-center overflow-hidden bg-wine-dark px-6 text-center sm:h-[340px] ${custom ? '' : 'pub-hero'}`}
                  style={style}
                >
                  {/* وسائط الشريحة (صورة أو فيديو) بنفس التعتيم تماماً — معتّمة من أول لحظة بلا وميض */}
                  {isImage && (
                    <img
                      src={s.bgValue}
                      alt=""
                      aria-hidden="true"
                      style={{ filter: 'brightness(0.6)' }}
                      className="absolute inset-0 z-0 h-full w-full object-cover"
                    />
                  )}
                  {isVideo && (
                    <video
                      src={s.bgValue}
                      poster={cldVideoPoster(s.bgValue)}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      style={{ filter: 'brightness(0.6)' }}
                      className="absolute inset-0 z-0 h-full w-full object-cover"
                    />
                  )}
                  {/* طبقة تظليل موحّدة فوق الصورة/الفيديو — نفس الدرجة لكل الشرائح ليظهر النص بوضوح */}
                  {(isImage || isVideo) && (
                    <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-black/25 to-black/40" />
                  )}
                  {!custom && <div className="pointer-events-none absolute -top-12 start-1/4 h-44 w-44 animate-float rounded-full bg-cream/10 blur-3xl" />}

                  {/* النص فوق الفيديو دائماً (طبقة GPU مستقلة لتفادي اختفائه على iOS أثناء الانتقال) */}
                  <div className="relative z-10" style={{ transform: 'translateZ(0)' }}>
                    {s.fixed ? (
                      <>
                        {store.logoUrl && (
                          <img src={store.logoUrl} alt={store.name} className="mx-auto mb-4 h-20 w-20 rounded-2xl border-2 border-cream/30 object-cover shadow-lg sm:h-24 sm:w-24" />
                        )}
                        <h1 className="font-display text-3xl font-extrabold text-cream sm:text-5xl">{store.name}</h1>
                        <p className="mt-3 font-display text-lg text-cream/90 sm:text-2xl">أناقة .. حشمة .. تميز</p>
                        <p className="mt-1 text-xs tracking-[0.25em] text-cream/55 sm:text-sm">ELEGANCE · MODESTY · DISTINCTION</p>
                      </>
                    ) : (
                      <>
                        <h2 className="font-display text-3xl font-extrabold text-cream drop-shadow sm:text-5xl">{s.title}</h2>
                        {s.subtitle && <p className="mx-auto mt-3 max-w-xl text-cream/90 drop-shadow sm:text-lg">{s.subtitle}</p>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* نقاط التنقّل */}
      {len > 1 && (
        <div dir="ltr" className="mt-4 flex items-center justify-center gap-2">
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

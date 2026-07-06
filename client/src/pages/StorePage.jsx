import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
import StylistChat from '../components/StylistChat.jsx';
import ShareEarnModal from '../components/ShareEarnModal.jsx';
import { WaveIcon, GiftIcon, CheckIcon, PlusIcon } from '../components/icons.jsx';
import CloseButton from '../components/CloseButton.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { SIZES, sizeLabel } from '../utils/sizes.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { saveRef } from '../utils/referral.js';
import { initPixels, trackPixel } from '../utils/pixels.js';

const PAGE_SIZE = 8;
const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

export default function StorePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { store: myStore } = useAuth();
  const { ensureStore } = useCart();
  const isOwner = myStore?.slug === slug;
  const [data, setData] = useState(() => getCache(`storepage:${slug}`) || null);
  const [error, setError] = useState('');
  // بكسلات تمويل المتجر: تُحقن مرة واحدة عند توفّر بيانات المتجر (PageView تلقائي)
  useEffect(() => { if (data?.store) initPixels(data.store); }, [data?.store]);
  // حدث بكسل "بحث" بعد توقف الكتابة — إشارة اهتمام تفيد استهداف الإعلانات
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return undefined;
    const idT = setTimeout(() => trackPixel('Search', { search_string: term }), 900);
    return () => clearTimeout(idT);
  }, [q]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('default');
  const [sizesSel, setSizesSel] = useState([]); // مقاسات مختارة (متعدّد)
  const [offersOnly, setOffersOnly] = useState(false);
  const [openSheet, setOpenSheet] = useState(null); // 'sort' | 'size' | 'offers'
  const [page, setPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false); // نافذة شاركي واربحي
  const [stories, setStories] = useState([]); // ستوريات المتجر الفعّالة

  // الفئة و"عرض الكل" جزء من الرابط (search params) كي يحفظهما زرّ الرجوع:
  // تختار فئة ← تدخل منتج ← ترجع → ترجع لنفس الفئة وموضعها (بدل القفز للرئيسية).
  const [searchParams, setSearchParams] = useSearchParams();
  const cat = searchParams.get('cat') || 'all';
  const viewAll = searchParams.get('view') === 'all';
  const setCat = (c) => setSearchParams(c && c !== 'all' ? { cat: c } : {});
  const setViewAll = (v) => setSearchParams(v ? { view: 'all' } : {});

  useEffect(() => {
    const cached = getCache(`storepage:${slug}`);
    // لا نُعيد ضبط البيانات إن كانت مُحمّلة أصلاً لهذا المتجر (مُهيّأة من useState عند
    // الرجوع) — كان setData بمرجع جديد يُعيد رسم الصفحة الثقيلة كاملةً بلا داعٍ = تعليق.
    setData((prev) => (prev && prev.store?.slug === slug ? prev : (cached || null)));
    setError('');
    if (cached) ensureStore(cached.store.slug);
    const load = () => api
      .get(`/public/store/${slug}`)
      .then((res) => {
        const s = res.data.store;
        // نحقن معرّف/اسم المتجر بكل منتج، وننادي ensureStore لتفريغ السلة إن كانت من متجر مختلف
        const products = (res.data.products || []).map((p) => ({ ...p, storeSlug: s.slug, storeName: s.name }));
        const mapped = { ...res.data, products };
        setCache(`storepage:${slug}`, mapped);
        ensureStore(s.slug);
        // لا نُعيد رسم الصفحة الثقيلة إن كانت البيانات الجديدة مطابقة للمعروضة (شائع عند
        // الرجوع) — مقارنة واحدة أرخص بكثير من إعادة تصيير الشجرة كاملةً.
        setData((prev) => (prev && JSON.stringify(prev) === JSON.stringify(mapped) ? prev : mapped));
      })
      .catch((err) => { if (!cached) setError(getErrorMessage(err, t('errors.storeNotFound'))); });
    // عند الرجوع (كاش موجود) نؤجّل التحديث الخلفي قليلاً كي لا يزاحم رسم الرجوع = بلا تعليق.
    // بلا كاش (فتح أول مرة) نحمّل فوراً.
    if (cached) { const id = setTimeout(load, 450); return () => clearTimeout(id); }
    load();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, t]);

  // عدّاد الزيارة: مرّة واحدة لكل جلسة لكل متجر، وبدون احتساب المالك
  useEffect(() => {
    const s = data?.store;
    if (!s?.slug || isOwner) return;
    const key = `bz_visited:${s.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* ignore */ }
    api.post(`/public/store/${s.slug}/visit`).catch(() => {});
  }, [data?.store?.slug, isOwner]);

  useEffect(() => setPage(1), [cat, q, sort, sizesSel, offersOnly]);
  useEffect(() => { setStories(data?.stories || []); }, [data]); // مزامنة الستوريات
  // تحويل لرابط المتجر الجديد إن فُتح برابط قديم (عشان يبقى الرابط الرسمي نظيفاً)
  useEffect(() => {
    if (data?.store?.slug && data.store.slug !== slug) {
      navigate(`/store/${data.store.slug}${window.location.search}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.store?.slug, slug]);

  // التقاط كود الإحالة من الرابط (?ref=CODE) وحفظه للمتجر، ثم تنظيف الرابط
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && slug) {
      saveRef(slug, ref);
      const sp = new URLSearchParams(searchParams);
      sp.delete('ref');
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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
  // "الأكثر مبيعاً" الحقيقي: ترتيب بعدّاد المبيعات الفعلي (يزيد مع كل طلب مؤكّد)،
  // والمنتجات المميّزة تكمّل القائمة عند قلّة المبيعات (متجر جديد مثلاً)
  const bestSellers = (() => {
    const sold = [...data.products].filter((p) => (p.soldCount || 0) > 0).sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    const fill = data.products.filter((p) => p.featured && !(p.soldCount > 0));
    return [...sold, ...fill].slice(0, 8);
  })();
  // قسم التخفيضات: المنتجات المخفّضة فعلاً (سعر قديم أعلى) — الأعلى نسبة خصم أولاً
  const onSale = [...data.products]
    .filter((p) => p.oldPrice && p.oldPrice > p.price)
    .sort((a, b) => (1 - b.price / b.oldPrice) - (1 - a.price / a.oldPrice))
    .slice(0, 8);
  // تخصيص المالكة للفئات (صورة/اسم) + الفئات الإضافية المخصّصة
  const catMeta = store.categoryMeta || {};
  const customCats = Array.isArray(store.customCategories) ? store.customCategories : [];
  const catNames = {};
  for (const c of CATS) catNames[c] = (catMeta[c]?.name || '').trim();
  for (const cc of customCats) catNames[cc.key] = cc.name;
  const catLabel = (c) => catNames[c] || t(`categories.${c}`);
  // صورة كل فئة: الأصلية تستخدم أيقونتها الثابتة (إلا لو غيّرتها المالكة)؛
  // المخصّصة تستخدم صورة المالكة وإلا أول صورة منتج فيها.
  const catImages = {};
  for (const c of CATS) { if (catMeta[c]?.image) catImages[c] = catMeta[c].image; }
  for (const cc of customCats) { if (cc.image) catImages[cc.key] = cc.image; }
  for (const p of data.products) {
    if (CATS.includes(p.category) || catImages[p.category]) continue; // الأصلية لها أيقونتها الثابتة
    const im = p.imageUrl || (p.images && p.images[0]) || (p.videoUrl && cldVideoPoster(p.videoUrl));
    if (im) catImages[p.category] = im;
  }
  // قائمة الفئات للشبكة: الأصلية الخمس + المخصّصة
  const gridCats = [
    ...CATS.map((k) => ({ key: k, name: catNames[k], image: catImages[k], builtin: true })),
    ...customCats.map((cc) => ({ key: cc.key, name: cc.name, image: catImages[cc.key], builtin: false })),
  ];
  const searching = q.trim().length > 0;
  // أحدث المنتجات (لقسم "جديدنا")
  const newest = [...data.products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8);
  // تحديث الرابط بنداء واحد (سجلّ تاريخ واحد) — حتى يرجع زرّ الرجوع خطوة واحدة بالضبط
  const pickCategory = (c) => { setSearchParams(c && c !== 'all' ? { cat: c } : {}); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const clearSearch = () => { setQ(''); setSearchParams({}); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // بيانات Schema.org للمتجر → Google يعرضه كمتجر (اسم/شعار/تواصل/روابط) بنتائج البحث
  const storeLd = {
    '@context': 'https://schema.org/',
    '@type': 'Store',
    name: store.name,
    ...(store.description ? { description: store.description } : {}),
    ...(store.logoUrl ? { image: store.logoUrl, logo: store.logoUrl } : {}),
    ...(typeof window !== 'undefined' ? { url: window.location.href } : {}),
    ...(store.instagram ? { sameAs: [store.instagram].filter(Boolean) } : {}),
    ...(wa ? { telephone: wa } : {}),
  };

  return (
    <>
      <Seo title={store.name} description={store.description || `${store.name}`} image={store.logoUrl} jsonLd={storeLd} />

      {/* الهيدر الخاص بالمتجر: قائمة + اسم + بحث + ستوري على الشعار */}
      <StoreHeader
        store={store}
        q={q}
        setQ={setQ}
        cat={cat}
        setCat={setCat}
        products={data.products}
        onShare={() => setShareOpen(true)}
        stories={stories}
        isOwner={isOwner}
        onStoryAdded={(s) => setStories((p) => [...p, s])}
        onStoryDeleted={(id) => setStories((p) => p.filter((x) => x.id !== id))}
      />

      {/* شريط إعلانات متحرّك (إن فعّلته المالكة) */}
      {(store.announcement || store.announcementEn) && <AnnouncementBar ar={store.announcement} en={store.announcementEn} />}

      {/* نافذة ترحيب لأول زيارة (إن فعّلتها المالكة) */}
      <WelcomePopup store={store} />

      {/* شريط المالك */}
      {isOwner && (
        <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 sm:flex-row">
          <p className="flex items-center gap-1.5 text-sm text-gold-200"><WaveIcon className="h-4 w-4" /> {t('store.ownerView')}</p>
          <Link to="/dashboard?tab=myProducts" className="btn-primary gap-1.5 !py-2 text-sm"><PlusIcon className="h-4 w-4" /> {t('dashboard.addProduct')}</Link>
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
                {catLabel(cat)}
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

          {/* شريط نقاط الولاء — يشجّع الزبون على تكرار الشراء (يظهر فقط عند تفعيله) */}
          {store.loyaltyEvery >= 2 && store.loyaltyPercent > 0 && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-gold-400/30 bg-gradient-to-r from-gold-400/10 via-gold-400/5 to-gold-400/10 px-4 py-2.5 text-center text-sm font-semibold text-wine">
              <GiftIcon className="h-5 w-5 shrink-0 text-gold-500" />
              {t('store.loyaltyBadge', { every: store.loyaltyEvery, percent: store.loyaltyPercent })}
            </div>
          )}

          <section className="mb-9 mt-7">
            <SectionTitle>{t('store.browseByCategory')}</SectionTitle>
            <CategoryGrid onSelect={pickCategory} active={cat} cats={gridCats} />
          </section>

          <ProductSection title={t('store.newArrivals')} products={newest} wa={wa} />
          <ProductSection title={t('store.bestSellers')} products={bestSellers} wa={wa} />
          {onSale.length > 0 && <ProductSection title={t('store.saleSection')} products={onSale} wa={wa} />}

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
      <StoreFooter store={store} wa={wa} onShare={() => setShareOpen(true)} />

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
      <StylistChat store={store} whatsapp={wa} />
      {shareOpen && <ShareEarnModal store={store} onClose={() => setShareOpen(false)} />}
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
function StoreFooter({ store, wa, onShare }) {
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
        {/* تتبّع الطلب — بنفس نمط "شاركي واربحي" (شفّاف بنص كريمي واضح بالوضعين) */}
        <Link
          to="/track"
          className="group mx-auto mt-7 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-cream/30 px-5 py-3.5 text-start text-cream transition hover:-translate-y-0.5 hover:bg-cream/10"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream/15 text-cream">
            <TruckGlyph />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold leading-tight">{t('nav.track')}</span>
            <span className="block truncate text-xs text-cream/70">{t('track.hint')}</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cream/60 transition group-hover:text-cream" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ltr ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </Link>
        {/* شاركي واربحي — يظهر فقط إن فعّل المتجر برنامج الإحالة */}
        {Number(store.referralPercent) > 0 && (
          <button
            type="button"
            onClick={onShare}
            className="group mx-auto mt-3 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-cream/30 px-5 py-3.5 text-start text-cream transition hover:-translate-y-0.5 hover:bg-cream/10"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream/15" aria-hidden="true"><GiftIcon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-bold leading-tight">{t('referral.shareTitle')}</span>
              <span className="block truncate text-xs text-cream/70">{t('referral.shareDesc', { percent: Number(store.referralPercent) })}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cream/60 transition group-hover:text-cream" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ltr ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
            </svg>
          </button>
        )}
        <div className="mx-auto mt-7 h-px max-w-md bg-cream/15" />
        <p className="mt-5 text-xs text-cream/60">© {new Date().getFullYear()} {store.name} — {t('footer.rights')}</p>
      </div>
    </footer>
  );
}

// شريط إعلانات متحرّك (News Ticker) فخم وهادئ — خلفية شامبين/كريمية بنص خمري ونجمة
// ذهبية فاصلة. يقبل عدّة إعلانات (كل سطر إعلان) ويعرضها بتتابع متّصل سلس بلا تقطّع
// (نسختان متطابقتان من القائمة + سرعة تتناسب تلقائياً مع عدد الإعلانات).
function AnnouncementBar({ ar, en }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const rtl = !isEn;
  // نص الشريط يتبع اللغة: إنجليزي عند en (مع رجوع للعربي إن كان فارغاً) والعكس
  const text = (isEn ? (en || ar) : (ar || en)) || '';
  const items = String(text).split('\n').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return null;

  // نكرّر بعدد كافٍ ثابت (≥12 عنصر بكل مجموعة) فيتجاوز المسار أي شاشة دائماً → بلا
  // قياس وبلا فراغ/اختفاء. مجموعتان متطابقتان + translateX(-50%) = التفاف سلس متصل.
  const reps = Math.max(1, Math.ceil(12 / items.length));
  const groupCount = reps * items.length;
  // المدة تتناسب مع طول النص الكلي → سرعة طبيعية ثابتة مهما طال الإعلان أو قصُر
  const charLen = items.join('  ').length || 8;
  const dur = Math.min(140, Math.max(28, reps * charLen * 0.5));
  const Group = ({ hidden }) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {Array.from({ length: groupCount }).map((_, k) => (
        <span key={k} className="flex items-center gap-2 whitespace-nowrap px-5 text-xs font-semibold tracking-wide text-[#5e4636]" dir="auto">
          <SparkleIcon className="h-3 w-3 shrink-0 text-[#c79a3a]" />
          {items[k % items.length]}
        </span>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="relative -mx-4 mb-5 overflow-hidden border-y border-gold-400/40 bg-gradient-to-r from-[#f5ead6] via-[#efe1c6] to-[#f5ead6] py-1.5 shadow-sm sm:-mx-6">
      <div
        className="flex w-max animate-marquee"
        style={{ animationDuration: `${dur}s`, animationDirection: rtl ? 'normal' : 'reverse' }}
      >
        <Group />
        <Group hidden />
      </div>
      {/* تلاشٍ ناعم عند الحوافّ ليبدو أكثر أناقة */}
      <span className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#f5ead6] to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#f5ead6] to-transparent" />
    </div>
  );
}

// نجمة لامعة أنيقة (فاصل الشريط)
function SparkleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2c.5 3.8 2.2 5.5 6 6-3.8.5-5.5 2.2-6 6-.5-3.8-2.2-5.5-6-6 3.8-.5 5.5-2.2 6-6Z" />
    </svg>
  );
}

// نافذة ترحيب لأول زيارة — تعرض عرض/كوبون المالكة مرّة واحدة لكل زائرة (لكل متجر)
function WelcomePopup({ store }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  useEffect(() => {
    if (!store?.welcomeOffer) return undefined;
    const key = `bz_welcome_${store.slug}`;
    try { if (localStorage.getItem(key)) return undefined; } catch { /* تجاهل */ }
    const id = setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem(key, '1'); } catch { /* تجاهل */ }
    }, 1200);
    return () => clearTimeout(id);
  }, [store?.welcomeOffer, store?.slug]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/55 animate-fade-up" />
      <div onClick={(e) => e.stopPropagation()} className="animate-pop relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl">
        <span className="dash-hairline absolute inset-x-0 top-0" />
        <CloseButton onClick={() => setOpen(false)} variant="wine" className="absolute end-3 top-3" />
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10 text-wine ring-2 ring-gold-400/40"><GiftIcon className="h-7 w-7" /></div>
        <h3 className="font-display text-2xl font-bold text-wine">{t('store.welcomeTitle')}</h3>
        {/* زخرفة ماسية تحت العنوان */}
        <div className="mt-2 flex items-center justify-center gap-2 text-gold-400/70">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#d4af37]/50" />
          <span aria-hidden className="text-[10px]">❖</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#d4af37]/50" />
        </div>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-wine/80">{store.welcomeOffer}</p>
        <button onClick={() => setOpen(false)} className="mt-5 w-full rounded-full bg-gradient-to-r from-[#e6c878] via-[#d4af37] to-[#c79a3a] py-3.5 font-bold text-[#3f2e22] shadow-lg ring-1 ring-[#b8932c]/40 transition hover:brightness-105">
          {t('store.welcomeCta')}
        </button>
      </div>
    </div>
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
      {on && <CheckIcon className="h-3.5 w-3.5" />}
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
    // تتحرّك الشرائح تلقائياً كل 5 ثوانٍ (بما فيها شرائح الفيديو) — وقت كافٍ لمشاهدة كل شريحة
    const id = setInterval(() => setI((p) => (p + 1) % len), 5000);
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
            // نضع صورة أول لقطة (poster) كخلفية الشريحة فوراً → الفيديو يظهر مباشرة بلا خلفية سوداء/بنّية
            // poster مصغّر (يحمّل فوراً) → لا يظهر سواد قبل الفيديو
            const posterImg = isVideo ? cldThumb(cldVideoPoster(s.bgValue), 900) : isImage ? cldThumb(s.bgValue, 1280) : '';
            const style = isColor
              ? { background: s.bgValue }
              : posterImg
                ? { backgroundImage: `url("${posterImg}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined;
            return (
              <div key={idx} className="w-full shrink-0" dir="rtl">
                <div
                  className={`relative isolate flex h-[260px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:h-[340px] ${custom ? 'bg-[#241712]' : 'bg-wine-dark pub-hero'}`}
                  style={style}
                >
                  {/* وسائط الشريحة (صورة أو فيديو) بنفس التعتيم تماماً — معتّمة من أول لحظة بلا وميض */}
                  {isImage && (
                    <img
                      src={cldThumb(s.bgValue, 1280)}
                      alt=""
                      aria-hidden="true"
                      decoding="async"
                      style={{ filter: 'brightness(0.6)' }}
                      className="absolute inset-0 z-0 h-full w-full object-cover"
                    />
                  )}
                  {isVideo && (
                    <>
                      {/* صورة أول لقطة دائمة خلف الفيديو → لا سواد أبداً */}
                      <img src={posterImg} alt="" aria-hidden="true" loading={idx === 0 ? 'eager' : 'lazy'} style={{ filter: 'brightness(0.6)' }} className="absolute inset-0 z-0 h-full w-full object-cover" />
                      <video
                        src={s.bgValue}
                        poster={posterImg}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        onEnded={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); }}
                        onPause={(e) => { if (!document.hidden) e.currentTarget.play().catch(() => {}); }}
                        onCanPlay={(e) => { e.currentTarget.style.opacity = '1'; }}
                        style={{ filter: 'brightness(0.6)', opacity: 0, transition: 'opacity .35s ease' }}
                        className="absolute inset-0 z-[1] h-full w-full object-cover"
                      />
                    </>
                  )}
                  {/* طبقة تظليل موحّدة فوق الصورة/الفيديو — نفس الدرجة لكل الشرائح ليظهر النص بوضوح */}
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

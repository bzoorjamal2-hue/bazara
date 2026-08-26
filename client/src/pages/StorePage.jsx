import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Seo from '../components/Seo.jsx';
import { StorePageSkeleton } from '../components/Skeleton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import OffersBar from '../components/OffersBar.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import StoreHeader from '../components/StoreHeader.jsx';
import StoreFooter from '../components/StoreFooter.jsx';
import FeaturesBar from '../components/FeaturesBar.jsx';
import CollectionsRow from '../components/CollectionsRow.jsx';
import AnnouncementBar from '../components/AnnouncementBar.jsx';
import CatThumb from '../components/CatThumb.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import StylistChat from '../components/StylistChat.jsx';
import ShareEarnModal from '../components/ShareEarnModal.jsx';
import { WaveIcon, GiftIcon, CheckIcon, PlusIcon, BoltIcon, TagIcon, SearchIcon, GridIcon } from '../components/icons.jsx';
import CloseButton from '../components/CloseButton.jsx';
import Reveal from '../components/Reveal.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { cldVideoPoster, cldThumb, cldVideoMp4 } from '../utils/cloudinary.js';
import { SIZES, sizeLabel } from '../utils/sizes.js';
import { getMySize } from '../utils/mySize.js';
import { productColors, colorToCss } from '../utils/colorDot.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { saveRef } from '../utils/referral.js';
import { initPixels, trackPixel } from '../utils/pixels.js';
import { norm } from '../utils/match.js';
import Countdown from '../components/Countdown.jsx';
import { platformCatKeys, platformCatName, platformCatImage, usePlatformCatKeys, storeOnlyCats } from '../utils/platformCategories.js';

const PAGE_SIZE = 8;

// نفد المخزون: صفر عام أو نفاد كل كميات الألوان/النمر (النموذج التفصيلي)
const isSoldOut = (p) => {
  const cs = p?.colorStock && typeof p.colorStock === 'object' ? p.colorStock : null;
  if (cs && Object.keys(cs).length) {
    const v = Object.values(cs).flatMap((sz) => Object.values(sz || {})).filter((q) => typeof q === 'number');
    return v.length > 0 && v.reduce((a, b) => a + b, 0) === 0;
  }
  const ss = p?.sizeStock && typeof p.sizeStock === 'object' ? p.sizeStock : null;
  if (ss && Object.keys(ss).length) {
    const v = Object.values(ss).filter((q) => typeof q === 'number');
    return v.length > 0 && v.reduce((a, b) => a + b, 0) === 0;
  }
  return p?.stock === 0;
};

export default function StorePage() {
  const catKeys = usePlatformCatKeys();
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
  // حفظ فلاتر المتجر أثناء الجلسة: عند الرجوع للمتجر تبقى فلاترك كما تركتها (إحساس
  // تطبيق أصلي). sessionStorage لا localStorage — تُمسح عند إغلاق التطبيق فلا تَقدَم.
  const FKEY = `bz_sf_${slug}`;
  const savedF = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(FKEY) || 'null') || {}; } catch { return {}; }
  }, [FKEY]);
  const [q, setQ] = useState(savedF.q || '');
  const [sort, setSort] = useState(savedF.sort || 'default');
  // حدث بكسل "بحث" بعد توقف الكتابة — إشارة اهتمام تفيد استهداف الإعلانات.
  // (يجب أن يبقى بعد تعريف q أعلاه — وضعه قبله سبّب انهيار الصفحة بالكامل TDZ)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return undefined;
    const idT = setTimeout(() => trackPixel('Search', { search_string: term }), 900);
    return () => clearTimeout(idT);
  }, [q]);
  const [sizesSel, setSizesSel] = useState(() => (Array.isArray(savedF.sizesSel) ? savedF.sizesSel : [])); // مقاسات مختارة (متعدّد)
  const [colorsSel, setColorsSel] = useState(() => (Array.isArray(savedF.colorsSel) ? savedF.colorsSel : [])); // ألوان مختارة (متعدّد)
  const [offersOnly, setOffersOnly] = useState(Boolean(savedF.offersOnly));
  const [stockOnly, setStockOnly] = useState(Boolean(savedF.stockOnly)); // إخفاء القطع المنتهية
  const [mySize] = useState(getMySize); // مقاسها المعتاد — اختصار فلترة بضغطة
  const [openSheet, setOpenSheet] = useState(null); // 'sort' | 'size' | 'color' | 'offers'
  const [page, setPage] = useState(savedF.page || 1);
  const [shareOpen, setShareOpen] = useState(false); // نافذة شاركي واربحي
  const [stories, setStories] = useState([]); // ستوريات المتجر الفعّالة

  // نحفظ الفلاتر الحالية للجلسة كلما تغيّرت — فتُستعاد عند الرجوع للمتجر
  useEffect(() => {
    try {
      const f = { q, sort, sizesSel, colorsSel, offersOnly, stockOnly, page };
      const empty = !q && sort === 'default' && !sizesSel.length && !colorsSel.length && !offersOnly && !stockOnly && page <= 1;
      if (empty) sessionStorage.removeItem(FKEY); // لا نُبقي قمامة فارغة
      else sessionStorage.setItem(FKEY, JSON.stringify(f));
    } catch { /* تجاهل */ }
  }, [FKEY, q, sort, sizesSel, colorsSel, offersOnly, stockOnly, page]);

  // الفئة و"عرض الكل" جزء من الرابط (search params) كي يحفظهما زرّ الرجوع:
  // تختار فئة ← تدخل منتج ← ترجع → ترجع لنفس الفئة وموضعها (بدل القفز للرئيسية).
  const [searchParams, setSearchParams] = useSearchParams();
  const cat = searchParams.get('cat') || 'all';
  const viewAll = searchParams.get('view') === 'all';
  // عرض عروض المتجر (?offers=1) — وجهة زرّ "العروض" بالشريط السفلي داخل المتجر،
  // كي لا يخرج الزبون لصفحة العروض العامة. يعرض شبكة المتجر بفلتر الخصومات مفعّلاً.
  const offersView = searchParams.get('offers') === '1';
  // عرض صفحة التصنيفات (?cats=1) — وجهة زرّ "التصنيفات" بالشريط السفلي داخل المتجر،
  // فتظهر فئات المتجر كصفحة كاملة بهيدر/فوتر المتجر بدل صفحة بازارا العامة أو درج.
  const catsView = searchParams.get('cats') === '1';
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

  // نُصفّر "عرض المزيد" عند تغيّر أي فلتر — لكن نتجاهل التشغيل الأول (التركيب) كي لا
  // نمسح الصفحة المُستعادة من الجلسة عند الرجوع للمتجر (وإلا لا يُستعاد موضع التمرير).
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) { firstFilterRun.current = false; return; }
    setPage(1);
  }, [cat, q, sort, sizesSel, colorsSel, offersOnly, stockOnly]);
  useEffect(() => { setStories(data?.stories || []); }, [data]); // مزامنة الستوريات
  // دخول عبر رابط العروض (?offers=1) يُفعّل فلتر الخصومات تلقائياً
  useEffect(() => { if (offersView) setOffersOnly(true); }, [offersView]);
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
    // بحث ذكي: تطبيع عربي (الهمزات/التاء المربوطة/أل التعريف) + يشمل الوصف —
    // "عبايه مطرزه" تلاقي "عباية مطرّزة" حتى لو الكلمة بالوصف مش بالاسم
    const nq = norm(q);
    let list = data.products.filter((p) => {
      const matchQ = !nq || norm(p.name).includes(nq) || (p.description && norm(p.description).includes(nq));
      const matchCat = cat === 'all' || p.category === cat;
      // مقاسات المنتج قد تكون متعدّدة (مفصولة بفواصل)
      const prodSizes = (p.size || '').split(',').map((s) => s.trim()).filter(Boolean);
      const matchSize = sizesSel.length === 0 || sizesSel.some((s) => prodSizes.includes(s));
      const matchColor = colorsSel.length === 0 || productColors(p).some((c) => colorsSel.includes(c));
      const matchOffers = !offersOnly || (p.oldPrice && p.oldPrice > p.price);
      const matchStock = !stockOnly || !isSoldOut(p);
      return matchQ && matchCat && matchSize && matchColor && matchOffers && matchStock;
    });
    const cmp = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
      popular: (a, b) => (b.soldCount || 0) - (a.soldCount || 0),
      discount: (a, b) => ((b.oldPrice > b.price ? 1 - b.price / b.oldPrice : 0) - (a.oldPrice > a.price ? 1 - a.price / a.oldPrice : 0)),
    }[sort];
    // المتوفّر أولاً دائماً، ثم الفرز المختار داخل كل مجموعة (المنتهي لأسفل)
    list = [...list].sort((a, b) => (isSoldOut(a) - isSoldOut(b)) || (cmp ? cmp(a, b) : 0));
    return list;
  }, [data, q, cat, sizesSel, colorsSel, offersOnly, stockOnly, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // تراكمي مع «عرض المزيد» (لا قصّ صفحة واحدة) — القطع السابقة تبقى ظاهرة بمكانها
  const pageItems = filtered.slice(0, page * PAGE_SIZE);

  // ألوان المتجر المتاحة (تُشتقّ من منتجاته المعروفة الدرجة) — لا يظهر فلتر اللون بدونها
  const storeColors = useMemo(() => {
    const map = new Map();
    for (const p of data?.products || []) {
      for (const c of productColors(p)) { if (!map.has(c)) { const css = colorToCss(c); if (css) map.set(c, css); } }
    }
    return [...map.entries()].map(([name, css]) => ({ name, css }));
  }, [data]);

  // هل يوفّر هذا المتجر مقاسها المعتاد؟ عندها نعرض اختصار «مقاسي» بشريط الفلاتر
  const storeHasMySize = useMemo(() => {
    if (!mySize) return false;
    return (data?.products || []).some((p) => String(p.size || '').split(/[,،/|]/).map((s) => s.trim()).includes(mySize));
  }, [data, mySize]);

  // متجر غير موجود/رابط خاطئ: بطاقة بمخرج واضح بدل نص عارٍ
  if (error) {
    return (
      <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <svg viewBox="0 0 24 24" className="h-12 w-12 text-wine/25" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7 6 3h12l2 4M4 7h16M4 7v13h16V7M9 20v-6h6v6" />
        </svg>
        <p className="text-stone-300">{error}</p>
        <Link
          to="/shop"
          className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
          style={{ background: 'linear-gradient(150deg, #3f2e22 0%, #2b1d12 60%, #1c1309 100%)' }}
        >
          {t('co.doneKeepShopping')}
        </Link>
      </div>
    );
  }
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
  const customCats = storeOnlyCats(store.customCategories, catKeys);
  const catNames = {};
  for (const c of catKeys) catNames[c] = (catMeta[c]?.name || '').trim();
  for (const cc of customCats) catNames[cc.key] = cc.name;
  const catLabel = (c) => catNames[c] || t(`categories.${c}`);
  // صورة كل فئة: الأصلية تستخدم أيقونتها الثابتة (إلا لو غيّرتها المالكة)؛
  // المخصّصة تستخدم صورة المالكة وإلا أول صورة منتج فيها.
  const catImages = {};
  for (const c of catKeys) { if (catMeta[c]?.image) catImages[c] = catMeta[c].image; }
  for (const cc of customCats) { if (cc.image) catImages[cc.key] = cc.image; }
  for (const p of data.products) {
    if (catKeys.includes(p.category) || catImages[p.category]) continue; // الأصلية لها أيقونتها الثابتة
    const im = p.imageUrl || (p.images && p.images[0]) || (p.videoUrl && cldVideoPoster(p.videoUrl));
    if (im) catImages[p.category] = im;
  }
  // قائمة الفئات للشبكة: الأصلية الخمس + المخصّصة
  const gridCats = [
    // نستثني الفئات الأصلية التي أخفتها المالكة من إعدادات المتجر
    ...catKeys.filter((k) => !catMeta[k]?.hidden).map((k) => ({ key: k, name: catNames[k], image: catImages[k], builtin: true })),
    ...customCats.map((cc) => ({ key: cc.key, name: cc.name, image: catImages[cc.key], builtin: false })),
  ];
  // عدّاد كل فئة وما فيها من عروض. البطاقة بلا رقم لا تقول إن كانت تخفي
  // أربعين قطعة أم اثنتين، والفئة الفارغة كانت تُعرض ثم تفتح على لا شيء.
  //
  // حسابٌ عادي لا useMemo عمداً: هذا الموضع يقع بعد `if (!data) return` أعلاه،
  // فخطّافٌ هنا يُستدعى في رسمةٍ ولا يُستدعى في أخرى — ويسقط التطبيق كلّه بشاشة
  // فارغة عند أول انتقال. المرور مرّةً على المنتجات أرخص من أي تذكير.
  const catCounts = {};
  for (const pr of data.products || []) {
    const k = pr.category || 'other';
    if (!catCounts[k]) catCounts[k] = { total: 0, sale: 0 };
    catCounts[k].total += 1;
    if (pr.oldPrice && pr.oldPrice > pr.price) catCounts[k].sale += 1;
  }
  const visibleCats = gridCats.filter((c) => (catCounts[c.key]?.total || 0) > 0);

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

      {catsView ? (
        /* صفحة التصنيفات — شبكة فئات المتجر بهوية المتجر (زرّ "التصنيفات" السفلي) */
        <>
          <nav className="mb-4 mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            {/* بيت الرئيسية › بطاقة التصنيفات بأيقونتها — أيقونات لا نصّاً مجرّداً */}
            <CrumbHome onClick={() => pickCategory('all')} label={t('nav.home')} />
            <Crumb />
            <CrumbHere icon={<GridGlyph className="h-[17px] w-[17px]" />} label={t('nav.categories')} text={t('nav.categories')} />
          </nav>
          {/* خلاصة: كم فئة وكم قطعة — الشبكة وحدها لا تقول حجم المتجر */}
          {visibleCats.length > 0 && (
            <p className="mb-3 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wine/10 px-3 py-1 text-xs font-bold text-wine ring-1 ring-wine/20">
                {t('store.catCount', { count: visibleCats.length })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wine/10 px-3 py-1 text-xs font-bold text-wine ring-1 ring-wine/20">
                {t('store.pieceCount', { count: data.products.length })}
              </span>
            </p>
          )}
          {/* بطاقات فاخرة (صورة + اسم + "تسوّقي الآن") — نفس تصميم بطاقات التصنيفات
              الموحّد بكل الحسابات، لكن الضغط يفتح فئة هذا المتجر (لا يخرج للعام) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {visibleCats.map((c, i) => {
              const src = c.image ? cldThumb(c.image, 400) : c.builtin ? `/categories/${c.key}.png` : '';
              const cnt = catCounts[c.key] || { total: 0, sale: 0 };
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pickCategory(c.key)}
                  className="glass group animate-fade-up relative flex flex-col items-center overflow-hidden p-4 text-center transition duration-300 hover:-translate-y-1.5 hover:shadow-glow"
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                >
                  <span className="dash-hairline absolute inset-x-0 top-0" />
                  {/* شارة العروض على الزاوية: توجّه الزائرة إلى حيث الخصم مباشرةً */}
                  {cnt.sale > 0 && (
                    <span
                      className="absolute end-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold text-cream ring-1 ring-[#e6c878]/40"
                      style={{ background: 'linear-gradient(150deg, #3f2e22 0%, #241708 100%)' }}
                    >
                      {t('store.catSale', { count: cnt.sale })}
                    </span>
                  )}
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden">
                    {src ? (
                      <img
                        src={src}
                        alt={catLabel(c.key)}
                        loading="eager"
                        decoding="async"
                        className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-wine/60" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 4a3 3 0 0 0 6 0" />
                        <path d="M12 4 4.5 9v3l3-1.5V20h9V10.5l3 1.5V9L12 4Z" />
                      </svg>
                    )}
                  </div>
                  <span className="mt-2 font-display text-sm font-bold text-wine">{catLabel(c.key)}</span>
                  <span className="mt-0.5 text-[11px] font-semibold text-wine/70">{t('store.pieceCount', { count: cnt.total })}</span>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-wine/25 px-3.5 py-1 text-[11px] font-bold text-wine transition group-hover:border-wine group-hover:bg-wine group-hover:text-cream">
                    {t('home.shopNow')}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : searching || cat !== 'all' || viewAll || offersView ? (
        /* عرض الشبكة: نتائج بحث / فئة / كل المنتجات / عروض المتجر */
        <>
          {searching ? (
            <nav className="mb-4 mt-2 flex items-center gap-2 text-sm">
              <CrumbHome onClick={clearSearch} label={t('nav.home')} />
              <Crumb />
              <CrumbHere icon={<SearchIcon className="h-[17px] w-[17px]" />} label={t('store.searchResults')} text={'«' + q.trim() + '»'} />
            </nav>
          ) : viewAll ? (
            <nav className="mb-4 mt-2 flex items-center gap-2 text-sm">
              <CrumbHome onClick={() => { setViewAll(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} label={t('nav.home')} />
              <Crumb />
              <CrumbHere icon={<GridIcon className="h-[17px] w-[17px]" />} label={t('store.allProducts')} text={t('store.allProducts')} />
            </nav>
          ) : offersView ? (
            <>
              {/* المسار بأيقونتين لا بصورة واسم: بيتٌ للرئيسية وبطاقة سعر
                  للعروض — نفس نمط مسار التصنيفات، فيبقى الشكل واحداً أينما
                  وقفتِ بدل صورة متجر ثم نصّ طويل. */}
              <nav className="mb-3 mt-2 flex items-center gap-2 text-sm">
                <CrumbHome onClick={() => pickCategory('all')} label={t('nav.home')} />
                <Crumb />
                <CrumbHere icon={<TagIcon className="h-[17px] w-[17px]" />} label={t('nav.offers')} text={t('nav.offers')} />
              </nav>
              {/* نفس خلاصة صفحة العروض العامّة: من يفتح العروض من الشريط
                  السفلي داخل متجر كان يصل إلى شبكة عارية بلا أي سياق. */}
              <OffersBar products={(data?.products || []).filter((p) => p.oldPrice && p.oldPrice > p.price)} />
            </>
          ) : (
            <nav className="mb-4 mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              {/* مسار متتابع بأيقونات دائرية (لوقوهات لا نصّ) — نفس نمط الموقع العام تماماً:
                  شعار المتجر (الرئيسية) › أيقونة التصنيفات › بطاقة الفئة المفتوحة بأيقونتها */}
              <CrumbHome onClick={() => pickCategory('all')} label={t('nav.home')} />
              <Crumb />
              <button
                type="button"
                onClick={() => { setSearchParams({ cats: '1' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                aria-label={t('nav.categories')}
                title={t('nav.categories')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
              >
                <GridGlyph className="h-[18px] w-[18px]" />
              </button>
              <Crumb />
              <span className="flex items-center gap-2 rounded-full bg-wine/10 px-2.5 py-1 font-display text-base font-bold text-wine">
                <CatThumb cat={cat} className="h-7 w-7" />
                {catLabel(cat)}
              </span>
            </nav>
          )}

          {/* شرائط الفلترة */}
          {data.products.length > 0 && (
            <div className="mb-4 -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max items-center gap-2">
                <Chip onClick={() => setOpenSheet('sort')}>{t('store.sortBy')}: {t(SORT_LABEL[sort] || 'store.sortDefault')}</Chip>
                {/* اختصار «مقاسي» — يظهر فقط إن كان هذا المتجر يوفّر مقاسها المعتاد */}
                {storeHasMySize && (
                  <Chip
                    onClick={() => setSizesSel((prev) => (prev.length === 1 && prev[0] === mySize ? [] : [mySize]))}
                    active={sizesSel.length === 1 && sizesSel[0] === mySize}
                  >
                    {t('filters.mySize', { size: sizeLabel(mySize, t) })}
                  </Chip>
                )}
                <Chip onClick={() => setOpenSheet('size')} active={sizesSel.length > 0}>{t('store.sizeLabel')}{sizesSel.length ? ` (${sizesSel.length})` : ''}</Chip>
                {storeColors.length >= 2 && (
                  <Chip onClick={() => setOpenSheet('color')} active={colorsSel.length > 0}>{t('store.colorLabel')}{colorsSel.length ? ` (${colorsSel.length})` : ''}</Chip>
                )}
                <Chip onClick={() => setOpenSheet('offers')} active={offersOnly}>{t('store.specialOffers')}</Chip>
                {/* تبديل مباشر (بلا شيت): يظهر فقط إن وُجدت قطعة منتهية فعلاً */}
                {data.products.some(isSoldOut) && (
                  <Chip onClick={() => setStockOnly((v) => !v)} active={stockOnly}>{t('filters.stockOnly')}</Chip>
                )}
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="glass relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center text-stone-400">
              <span className="dash-hairline absolute inset-x-0 top-0" />
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-wine/12 to-gold-400/15 text-wine ring-1 ring-gold-400/40">
                <BoltIcon className="h-8 w-8" />
              </span>
              <p className="max-w-sm text-sm">{data.products.length === 0 ? t('store.noProducts') : t('common.noResults')}</p>
              {/* عند وجود فلاتر نشطة نعطي مخرجاً بضغطة (بحث/فئة/مقاس/لون/عروض) */}
              {data.products.length > 0 && (q || cat !== 'all' || sizesSel.length || colorsSel.length || offersOnly || stockOnly) && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setSizesSel([]); setColorsSel([]); setOffersOnly(false); setStockOnly(false); setSearchParams({}); }}
                  className="rounded-full border border-wine/30 px-5 py-2 text-sm font-bold text-wine transition hover:bg-wine hover:text-cream"
                >
                  {t('filters.clear')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {pageItems.map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={wa} />)}
              </div>
              {/* «عرض المزيد» يراكم القطع بمكانها بدل ترقيم صفحات يقفز للأعلى — تصفّح
                  أسلس على الجوال، ولا تفقد الزبونة موضعها بين كل ثمانية منتجات */}
              {page < totalPages && (
                <div className="mt-8 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((n) => n + 1)}
                    className="rounded-full px-8 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
                    style={{ background: 'linear-gradient(150deg, #3f2e22 0%, #2b1d12 60%, #1c1309 100%)' }}
                  >
                    {t('store.loadMore')}
                  </button>
                  <span className="text-xs text-stone-400">{pageItems.length} / {filtered.length}</span>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* الصفحة الرئيسية للمتجر — بأسلوب خريف: هيرو + فئات + جديدنا + الأكثر مبيعاً + عرض الكل */
        <>
          <HeroSlider store={store} />

          {/* بانر عرض الفلاش — خصم متجر مؤقّت بعدّاد تنازلي ناري (إلحاح قوي للحملات) */}
          {store.flashPercent > 0 && store.flashEndsAt && new Date(store.flashEndsAt).getTime() > Date.now() && (
            <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-red-400/40 bg-gradient-to-r from-red-500/15 via-rose-500/10 to-red-500/15 px-4 py-3 text-center sm:flex-row sm:text-start">
              <p className="flex items-center gap-2 font-display text-lg font-extrabold text-red-500">
                <BoltIcon className="h-5 w-5 shrink-0" /> {t('store.flashBanner', { percent: store.flashPercent })}
              </p>
              <Countdown endsAt={store.flashEndsAt} variant="pill" className="shrink-0 !text-sm" />
            </div>
          )}

          {/* شريط نقاط الولاء — يشجّع الزبون على تكرار الشراء (يظهر فقط عند تفعيله) */}
          {store.loyaltyEvery >= 2 && store.loyaltyPercent > 0 && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-gold-400/30 bg-gradient-to-r from-gold-400/10 via-gold-400/5 to-gold-400/10 px-4 py-2.5 text-center text-sm font-semibold text-wine">
              <GiftIcon className="h-5 w-5 shrink-0 text-gold-500" />
              {t('store.loyaltyBadge', { every: store.loyaltyEvery, percent: store.loyaltyPercent })}
            </div>
          )}

          <Reveal>
            {/* مرساة زرّ «تسوّقي الآن» بالسلايدر — scroll-mt يترك مساحةً للرأس اللاصق */}
            <section id="cats" className="mb-16 mt-10 scroll-mt-24 sm:mb-20">
              <SectionTitle>{t('store.browseByCategory')}</SectionTitle>
              <CategoryGrid onSelect={pickCategory} active={cat} cats={gridCats} />
            </section>
          </Reveal>

          {/* مجموعات المتجر التحريرية (تسوّقي حسب المناسبة) — تحرّرها المالكة، وتفتح
              بحث هذا المتجر بكلمتها. تُخفى إن لم تُضف مجموعات */}
          {store.collections?.length > 0 && (
            <Reveal><CollectionsRow collections={store.collections} storeSlug={store.slug} /></Reveal>
          )}

          {/* قصة العلامة — كان وصف المتجر مدفوناً بالفوتر وحده. لمسة تحريرية تعرّف
              الزائرة بالمتجر قبل التصفّح (تظهر فقط إن كتبت المالكة وصفاً) */}
          {store.description && (
            <Reveal><section className="glass relative mb-16 overflow-hidden p-8 text-center sm:mb-20">
              <span className="dash-hairline absolute inset-x-0 top-0" />
              {store.logoUrl && (
                <img
                  src={cldThumb(store.logoUrl, 160)}
                  alt=""
                  loading="lazy"
                  className="mx-auto h-16 w-16 rounded-full bg-white object-cover shadow-md ring-2 ring-gold-400/50"
                />
              )}
              <div className="mt-4 flex items-center justify-center gap-2.5">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#c79a3a]/45" />
                <h2 className="bz-title font-display text-xl font-bold">{store.name}</h2>
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#c79a3a]/45" />
              </div>
              <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-stone-300">{store.description}</p>
            </section></Reveal>
          )}

          <ProductSection title={t('store.newArrivals')} products={newest} wa={wa} />
          <ProductSection title={t('store.bestSellers')} products={bestSellers} wa={wa} ranked />
          {onSale.length > 0 && <ProductSection title={t('store.saleSection')} products={onSale} wa={wa} />}

          {data.products.length > 0 && (
            <div className="mb-16 text-center sm:mb-20">
              <button
                onClick={() => { setViewAll(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="rounded-full px-10 py-3.5 font-bold text-cream ring-1 ring-[#e6c878]/35 transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
                style={{ background: 'linear-gradient(150deg, #3f2e22 0%, #2b1d12 60%, #1c1309 100%)', boxShadow: '0 16px 34px -14px rgba(20, 13, 7, 0.65)' }}
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
      {openSheet === 'color' && (
        <ColorSheet colors={storeColors} value={colorsSel} onClose={() => setOpenSheet(null)} onApply={(v) => { setColorsSel(v); setOpenSheet(null); }} />
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
  popular: 'store.sortPopular',
  discount: 'store.sortDiscount',
};

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
// زر بداية مسار التنقّل = شعار المتجر نفسه (بدل أيقونة بيت عامة + كلمة "المتجر")
// يعطي إحساس متجر خاص متناسق بكل صفحات الشبكة، والضغط يعود لرئيسية المتجر.
// أوّل المسار: بيتٌ يعود لرئيسية المتجر. كانت صورة المتجر تشغل مكانه، وهي
// هويّةٌ لا وجهةٌ — والزائرة تبحث عن «رجوع للرئيسية» لا عن شعار.
function CrumbHome({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label} title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
    >
      <HomeGlyph className="h-[18px] w-[18px]" />
    </button>
  );
}

// آخر المسار: أيقونة الوجهة الحالية بخلفية خمرية مصمتة (نصّ عاجي عليها يُقرأ
// في الوضعين) مع نصّ اختياري للحالات التي يهمّ فيها المحتوى كنتيجة البحث.
function CrumbHere({ icon, label, text }) {
  return (
    <>
      <span
        aria-label={label} title={label}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine text-cream shadow-sm ring-1 ring-[#e6c878]/40"
      >
        {icon}
      </span>
      {text ? <span className="min-w-0 truncate font-display text-lg font-bold text-wine">{text}</span> : null}
    </>
  );
}

// لوقو بيت أنيق (زر العودة للصفحة الرئيسية للمتجر)
function HomeGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 11.3 12 4l8.8 7.3" />
      <path d="M5.2 9.8V19a1 1 0 0 0 1 1h3.3v-4.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3.3a1 1 0 0 0 1-1V9.8" />
    </svg>
  );
}

// أيقونة التصنيفات (شبكة) — تظهر بمسار التنقّل كلوقو دائري لا نصّاً، مطابقة للموقع العام
function GridGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

// سهم تنقّل السلايدر (يشير لليسار افتراضياً؛ يُقلَب للتالي عبر -scale-x-100)
function ChevronGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

// عنوان قسم مركزي بزخرفة أنيقة (طبق المرجع — مطابق للصفحة الرئيسية)
function SectionTitle({ children }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2.5 sm:mb-10 sm:gap-3">
      <h2 className="bz-title whitespace-nowrap font-display text-xl font-bold sm:text-2xl">{children}</h2>
    </div>
  );
}

// قسم منتجات بعنوان مركزي (جديدنا / الأكثر مبيعاً)
// ranked: يرقّم أول ثلاث قطع (١·٢·٣) — أسلوب الاختيارات المنسّقة بالمتاجر العالمية.
// نقتصر على الثلاثة الأولى عمداً: الترقيم الكامل يزحم الشبكة ويفقد معناه.
function ProductSection({ title, products, wa, ranked = false }) {
  if (!products || products.length === 0) return null;
  return (
    <Reveal>
      <section className="mb-16 sm:mb-20">
        <SectionTitle>{title}</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} whatsapp={wa} rank={ranked && i < 3 ? i + 1 : 0} />
          ))}
        </div>
      </section>
    </Reveal>
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
  const opts = [['default', 'store.sortDefault'], ['newest', 'store.sortNewest'], ['popular', 'store.sortPopular'], ['priceAsc', 'store.sortPriceAsc'], ['priceDesc', 'store.sortPriceDesc'], ['discount', 'store.sortDiscount']];
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

// فلتر اللون: متعدّد الاختيار مع دائرة بدرجة اللون الفعلية (نفس روح swatches المنتج)
function ColorSheet({ colors, value, onClose, onApply }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState(value);
  const toggle = (c) => setSel((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  return (
    <FilterSheet title={t('store.colorLabel')} onClose={onClose} onReset={() => setSel([])} onApply={() => onApply(sel)}>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {colors.map(({ name, css }) => (
          <button key={name} onClick={() => toggle(name)} className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-[#2b2b2b] hover:bg-wine/5">
            <span className="flex items-center gap-2.5">
              <span className="h-6 w-6 rounded-full" style={{ background: css, boxShadow: '0 0 0 1px rgba(255,255,255,0.5), inset 0 0 0 1px rgba(0,0,0,0.12)' }} />
              {name}
            </span>
            <Check on={sel.includes(name)} />
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
// تمرير ناعم إلى قسم التصنيفات. لا نستعمل رابط «#cats» لأن الوجهة هي المسار
// نفسه، فلا يعيد React Router التوجيه ولا يقع تمرير — الزرّ يبدو معطّلاً.
function scrollToCats() {
  const el = document.getElementById('cats');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// زرّ شريحة السلايدر: تكتبه المالكة بمحرّر البانرات (نصّ + رابط).
// الرابط الخارجي يُفتح بتبويب جديد مع rel آمن، والداخلي عبر Link بلا إعادة تحميل،
// وإن تُرك فارغاً فالزرّ ينقل لتصنيفات المتجر — فلا يكون زرّاً بلا وجهة.
function SlideButton({ href, label, slug }) {
  const raw = String(href || '').trim();
  const cls = 'bz-hero-el mt-5 inline-flex items-center gap-2 rounded-full bg-cream/95 px-6 py-2.5 text-sm font-bold text-wine shadow-lg transition hover:brightness-105 sm:text-base';
  if (/^https?:\/\//i.test(raw)) {
    return <a href={raw} target="_blank" rel="noopener noreferrer nofollow" className={cls}>{label}</a>;
  }
  const to = raw.startsWith('/') ? raw : `/store/${slug}/#cats`;
  return <Link to={to} className={cls}>{label}</Link>;
}

// تشغيل تلقائي + سحب باللمس + نقاط تنقّل.
function HeroSlider({ store }) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const banners = Array.isArray(store.banners) ? store.banners.filter(Boolean) : [];
  // شعار المتجر: ما كتبته المالكة بلغة العرض (مع رجوعٍ للّغة الأخرى)، وإلا الجملة
  // العامة. السطر اللاتيني الصغير يظهر فقط مع الجملة العامة — لا معنى لترجمةٍ
  // لاتينية مخترَعة تحت شعارٍ خاصٍّ كتبته المالكة بنفسها.
  const ownTagline = (isEn ? (store.taglineEn || store.tagline) : (store.tagline || store.taglineEn)) || '';
  const heroTagline = ownTagline.trim() || t('storePage.defaultTagline');
  const heroTaglineSub = ownTagline.trim() ? '' : 'ELEGANCE · MODESTY · DISTINCTION';
  // شريحة اسم المتجر الذهبية تتصدّر دائماً (كشريحة Bazara بالموقع العام) — فيظهر اسم
  // كل متجر باللون الذهبي على سلايدره حتى لو أضاف المالك بانراته، ثم تتبعها بانراته.
  const slides = [{ fixed: true }, ...banners];
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

  // تشغيل ذكي لفيديوهات الشرائح (إصلاح تعليق): يعمل فيديو الشريحة الظاهرة فقط،
  // ويتوقف الكل عندما يخرج السلايدر عن الشاشة — كانت كل الفيديوهات تعمل معاً دائماً.
  const vidRefs = useRef({});
  const iRef = useRef(0);
  const visRef = useRef(true);
  const [heroVisible, setHeroVisible] = useState(true);
  iRef.current = i;
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([en]) => { visRef.current = en.isIntersecting; setHeroVisible(en.isIntersecting); }, { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    Object.entries(vidRefs.current).forEach(([idx, v]) => {
      if (!v) return;
      if (Number(idx) === i && heroVisible && !document.hidden) v.play().catch(() => {});
      else v.pause();
    });
  }, [i, heroVisible]);

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
    <section className="group relative mb-5">
      {/* لا نوقف التقدّم التلقائي عند مرور الماوس — على اللابتوب المؤشّر يبقى فوقه
          فكان «يضل واقف». يبقى الإيقاف أثناء السحب باللمس فقط. */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-3xl"
        style={{ touchAction: 'pan-y' }}
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
            const posterImg = isVideo ? cldThumb(cldVideoPoster(s.bgValue), 1600) : isImage ? cldThumb(s.bgValue, 1920) : '';
            // خلفية الحاوية = البوستر مخبوز فوقه تعتيم داكن (تدرّج ثابت) — فتظهر معتّمة
            // كخلفية واحدة من أول إطار، حتى قبل رسم الوسيط/الحجاب. هذا يمنع ومضة
            // "يضيء ثم يعتم" على شرائح الفيديو نهائياً (خلفية الحاوية المضيئة كانت تظهر لحظة).
            const style = isColor
              ? { background: s.bgValue }
              : posterImg
                ? { background: `linear-gradient(rgba(15,10,7,0.5), rgba(15,10,7,0.5)), url("${posterImg}") center/cover` }
                : undefined;
            return (
              <div key={idx} className="w-full shrink-0" dir="rtl">
                <div
                  // الارتفاع ينمو مع العرض: كان يتوقّف عند 340px فيبدو شريطاً رفيعاً
                  // (نسبة ~5:1) على الشاشات العريضة بعد توسيع الحاوية
                  // ارتفاع الجوال 300 لا 260: بعد إضافة زرّ «تسوّقي الآن» صار محتوى
                  // الشريحة الثابتة أطول من الصندوق، فانزاح الشعار لأعلى وخرج عن الإطار.
                  className={`relative isolate flex h-[300px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:h-[360px] lg:h-[430px] 2xl:h-[500px] ${idx === i ? 'bz-hero-active' : ''} ${custom ? 'bg-[#241712]' : 'bg-wine-dark pub-hero'}`}
                  style={style}
                >
                  {/* وسائط الشريحة (صورة أو فيديو) بنفس التعتيم تماماً — معتّمة من أول لحظة بلا وميض */}
                  {/* التعتيم مخبوز في الوسيط نفسه (filter) لا كطبقة منفصلة — الفيديو المُسرّع
                      على iOS قد يخترق أي طبقة فوقه فيظهر مضيئاً؛ تعتيمه من مصدره يمنع ذلك
                      تماماً. مع خلفية الحاوية المخبوزة داكنة = خلفية واحدة معتّمة بلا وميض. */}
                  {isImage && (
                    <img
                      src={cldThumb(s.bgValue, 1920)}
                      alt=""
                      aria-hidden="true"
                      decoding="async"
                      style={{ filter: 'brightness(0.6)' }}
                      className="bz-kenburns absolute inset-0 z-0 h-full w-full object-cover"
                    />
                  )}
                  {isVideo && (
                    <>
                      {/* صورة أول لقطة دائمة خلف الفيديو → لا سواد أبداً */}
                      <img src={posterImg} alt="" aria-hidden="true" loading={idx === 0 ? 'eager' : 'lazy'} style={{ filter: 'brightness(0.6)' }} className="bz-kenburns absolute inset-0 z-0 h-full w-full object-cover" />
                      <video
                        ref={(el) => { vidRefs.current[idx] = el; }}
                        src={cldVideoMp4(s.bgValue)}
                        poster={posterImg}
                        autoPlay={idx === 0}
                        muted
                        loop
                        playsInline
                        preload={idx === 0 ? 'auto' : 'metadata'}
                        onEnded={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); }}
                        onPause={(e) => { if (!document.hidden && iRef.current === idx && visRef.current) e.currentTarget.play().catch(() => {}); }}
                        onCanPlay={(e) => { e.currentTarget.style.opacity = '1'; }}
                        style={{ filter: 'brightness(0.6)', opacity: 0, transition: 'opacity .35s ease' }}
                        className="bz-kenburns absolute inset-0 z-[1] h-full w-full object-cover"
                      />
                    </>
                  )}
                  {/* الشريحة الثابتة (اسم المتجر): خلفية حيّة فاخرة — فقاعات ذهبية/عاجية
                      طافية بسرعات مختلفة + مسحة ضوء قطرية + إطار ذهبي بزوايا مضيئة */}
                  {!custom && (
                    <>
                      <div className="pointer-events-none absolute -top-16 start-[14%] h-48 w-48 animate-float rounded-full bg-gold-400/20 blur-3xl" style={{ animationDuration: '7s' }} />
                      <div className="pointer-events-none absolute -bottom-20 end-[8%] h-56 w-56 animate-float rounded-full bg-cream/12 blur-3xl" style={{ animationDuration: '9s', animationDelay: '1.2s' }} />
                      <div className="pointer-events-none absolute top-1/4 end-1/4 h-24 w-24 animate-float rounded-full bg-[#e6c25f]/15 blur-2xl" style={{ animationDuration: '6s', animationDelay: '.6s' }} />
                      {/* مسحة ضوء ذهبية قطرية تمرّ دورياً */}
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="bz-hero-sweep absolute inset-y-0 -inset-x-1/4 m-auto w-1/4 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                      </div>
                      {/* إطار ذهبي داخلي + زوايا مضيئة (خصائص منطقية تتبع اتجاه النص).
                          الأربع كلها: كانت اثنتين فقط (بداية-أعلى ونهاية-أسفل) فيبدو
                          الركنان الخاليان نقصاً لا تصميماً. */}
                      <div className="bz-hero-frame pointer-events-none absolute inset-3 rounded-2xl sm:inset-4" />
                      <span className="bz-hero-corner pointer-events-none absolute start-4 top-4 h-5 w-5 rounded-ss-lg border-s-2 border-t-2 sm:start-5 sm:top-5" />
                      <span className="bz-hero-corner pointer-events-none absolute end-4 top-4 h-5 w-5 rounded-se-lg border-e-2 border-t-2 sm:end-5 sm:top-5" />
                      <span className="bz-hero-corner pointer-events-none absolute start-4 bottom-4 h-5 w-5 rounded-es-lg border-s-2 border-b-2 sm:start-5 sm:bottom-5" />
                      <span className="bz-hero-corner pointer-events-none absolute end-4 bottom-4 h-5 w-5 rounded-ee-lg border-e-2 border-b-2 sm:end-5 sm:bottom-5" />
                    </>
                  )}

                  {/* النص فوق الفيديو دائماً (طبقة GPU مستقلة لتفادي اختفائه على iOS أثناء الانتقال) */}
                  <div className="relative z-10" style={{ transform: 'translateZ(0)' }}>
                    {s.fixed ? (
                      <>
                        {store.logoUrl && (
                          <div className="relative mx-auto mb-4 h-20 w-20 sm:h-24 sm:w-24">
                            {/* هالة ذهبية نابضة خلف الشعار */}
                            <span aria-hidden className="bz-logo-halo pointer-events-none absolute -inset-3 rounded-full blur-md" style={{ background: 'radial-gradient(circle, rgba(230,200,120,0.55), transparent 70%)' }} />
                            <img src={store.logoUrl} alt={store.name} className="bz-hero-el relative h-full w-full rounded-2xl border-2 border-[#e6c878]/70 object-cover shadow-[0_10px_30px_-8px_rgba(0,0,0,.7)] ring-1 ring-black/20" />
                          </div>
                        )}
                        <h1 className="bz-hero-el bz-gold-name font-display text-3xl font-extrabold sm:text-5xl">{store.name}</h1>
                        {/* شعار المتجر من إعداداته — وإن لم تكتبه المالكة فالجملة العامة.
                            كانت مكتوبةً بالكود فتظهر نفسها على كل المتاجر بلا استثناء. */}
                        <p className="bz-hero-el mt-3 font-display text-lg text-cream/90 sm:text-2xl">{heroTagline}</p>
                        {heroTaglineSub && (
                          <p className="bz-hero-el mt-1 text-xs tracking-[0.25em] text-cream/55 sm:text-sm">{heroTaglineSub}</p>
                        )}
                        <button
                          type="button"
                          onClick={scrollToCats}
                          className="bz-hero-el mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f3e2b4] to-[#d4af37] px-6 py-2.5 text-sm font-bold text-[#2a1c14] shadow-lg transition hover:brightness-110 sm:text-base"
                        >
                          {t('storePage.shopNow')}
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="bz-hero-el font-display text-3xl font-extrabold text-cream drop-shadow sm:text-5xl">{s.title}</h2>
                        {s.subtitle && <p className="bz-hero-el mx-auto mt-3 max-w-xl text-cream/90 drop-shadow sm:text-lg">{s.subtitle}</p>}
                        {/* زرّ الشريحة: تكتبه المالكة بمحرّر البانرات وكان لا يُعرض أبداً */}
                        {String(s.btnLabel || '').trim() && (
                          <SlideButton href={s.btnHref} label={s.btnLabel} slug={store.slug} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* أسهم تنقّل للديسكتوب — تظهر عند مرور الماوس (الجوال يعتمد السحب).
            يسار/يمين فيزيائيان ليطابقا اتجاه انزلاق المسار (LTR دائماً). */}
        {len > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(i - 1)}
              aria-label="previous slide"
              className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-cream opacity-0 ring-1 ring-cream/25 backdrop-blur-sm transition hover:bg-black/45 group-hover:opacity-100 md:flex"
            >
              <ChevronGlyph className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(i + 1)}
              aria-label="next slide"
              className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-cream opacity-0 ring-1 ring-cream/25 backdrop-blur-sm transition hover:bg-black/45 group-hover:opacity-100 md:flex"
            >
              <ChevronGlyph className="h-5 w-5 -scale-x-100" />
            </button>
          </>
        )}
      </div>

      {/* نقاط التنقّل — النشطة شريط يمتلئ ذهبياً كمؤقّت مرئي للانتقال التالي */}
      {len > 1 && (
        <div dir="ltr" className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => go(idx)}
              aria-label={`slide ${idx + 1}`}
              className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-500 ${idx === i ? 'w-8 bg-wine/20' : 'w-1.5 bg-wine/25 hover:bg-wine/40'}`}
            >
              {idx === i && (
                <span
                  key={i}
                  className="bz-dot-progress absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-400 to-wine"
                  style={{ animationPlayState: paused ? 'paused' : 'running' }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

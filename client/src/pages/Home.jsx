import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { StateCard, Act } from '../components/PageUI.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import FilteredProductGrid from '../components/FilteredProductGrid.jsx';
import CatThumb from '../components/CatThumb.jsx';
import ProductRail from '../components/ProductRail.jsx';
import CollectionsRow from '../components/CollectionsRow.jsx';
import OffersBar from '../components/OffersBar.jsx';
import { getRecent } from '../utils/recentlyViewed.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { cldVideoPoster, cldThumb, cldVideoMp4 } from '../utils/cloudinary.js';
import { GiftIcon, ForwardIcon, BoltIcon, FireIcon, SparkleIcon } from '../components/icons.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import StylistChat from '../components/StylistChat.jsx';
import InstallApp from '../components/InstallApp.jsx';
import FeaturesBar from '../components/FeaturesBar.jsx';
import AnnouncementBar from '../components/AnnouncementBar.jsx';
import NewsletterBox from '../components/NewsletterBox.jsx';
import LookbookSection from '../components/LookbookSection.jsx';
import Reveal from '../components/Reveal.jsx';
import useInViewOnce from '../hooks/useInViewOnce.js';
import ScrollProgress from '../components/ScrollProgress.jsx';
import StoriesRow from '../components/StoriesRow.jsx';
import { BAZARA_WHATSAPP } from '../config/site.js';
import { usePlatformCatKeys, platformCatKeys, storeOnlyCats } from '../utils/platformCategories.js';

export default function Home() {
  const { t, i18n } = useTranslation();
  const platformKeys = usePlatformCatKeys();
  const rtl = i18n.language !== 'en';
  const [data, setData] = useState(() => getCache('home') || null);
  const [loading, setLoading] = useState(() => !getCache('home'));
  const recent = getRecent();
  // الفئة المختارة جزء من رابط الرئيسية (?cat=) — فالضغط على فئة يبقيكِ بالرئيسية
  // (بازارا) ويعرض منتجاتها بمكانها بدل الانتقال لصفحة منفصلة تُخرجك من الرئيسية.
  const [searchParams, setSearchParams] = useSearchParams();
  const cat = searchParams.get('cat') || '';
  const pickCat = (c) => {
    setSearchParams(c && c !== 'all' ? { cat: c } : {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // الفئات المخصّصة المجمّعة من كل المتاجر (يعيدها /public/home) — تظهر بشبكة فئات
  // الرئيسية العامة كفئات بازارا الأصلية، والضغط عليها يفتح منتجاتها من كل المتاجر.
  const customCats = storeOnlyCats(data?.customCategories, platformKeys);
  // مفاتيح المنصّة من المصدر الموحّد لا من قائمةٍ مكتوبة هنا: كانت السبع مكرّرةً
  // بهذا الملف، فأي فئة يضيفها المدير للمنصّة لا تظهر بشبكة الرئيسية أبداً.
  const gridCats = [
    ...platformKeys.map((k) => ({ key: k, builtin: true })),
    ...customCats.map((c) => ({ key: c.key, name: c.name, image: c.image, builtin: false })),
  ];

  // "مقترحات لكِ": نتعلّم الفئة الأكثر مشاهدة من تصفّحها ونجلب منتجاتها (تخصيص محلي بلا حساب)
  const [forYou, setForYou] = useState(() => getCache('forYou') || []);
  useEffect(() => {
    const counts = {};
    recent.forEach((r) => { if (r.category) counts[r.category] = (counts[r.category] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    // مفاتيح المنصّة الحيّة لا قائمةً مكتوبة: كانت السبع مكرّرةً هنا أيضاً، فالفئة
    // التي يضيفها المدير لا تدخل «مقترحات لكِ» مهما تصفّحتها الزبونة.
    if (!top || !platformCatKeys().includes(top)) return;
    const seen = new Set(recent.map((r) => r.id));
    api.get(`/public/category/${top}`)
      .then((r) => {
        const list = (r.data.products || []).filter((p) => !seen.has(p.id)).slice(0, 10);
        setForYou(list);
        setCache('forYou', list);
      })
      .catch(() => { /* الريل اختياري — لا يكسر الرئيسية */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // بانرات الصفحة الرئيسية محفوظة محلياً → تظهر فوراً عند الفتح (لا وميض للسلايدر القديم)
  const persistedBanners = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('bz_home_banners') || 'null'); } catch { return null; }
  }, []);

  // الصفحة الرئيسية متاحة دائماً على الرابط / للجميع (بدون أي تحويل)
  // تبدأ من المخزّن المؤقّت (إن وُجد) فتظهر فوراً عند الرجوع، ثم تُحدَّث بالخلفية.
  useEffect(() => {
    api
      .get('/public/home')
      .then((res) => {
        setData(res.data);
        setCache('home', res.data);
        try { localStorage.setItem('bz_home_banners', JSON.stringify(res.data.homeBanners || [])); } catch { /* تجاهل */ }
      })
      .catch(() => setData((d) => d || { stores: [], featured: [], products: [] }))
      .finally(() => setLoading(false));
  }, []);

  // فئة مختارة → عرض شبكة منتجات الفئة (بكل المتاجر) داخل الرئيسية نفسها (بعد كل الـhooks)
  if (cat) return <HomeCategoryView cat={cat} custom={customCats} onHome={() => pickCat('all')} />;

  return (
    <>
      <Seo title={t('app.name')} description={t('home.heroDesc')} />
      <ScrollProgress />

      {/* شريط إعلان المنصّة (يتحكّم به المدير) — أعلى الصفحة كالمتاجر العالمية:
          توصيل مجاني/إرجاع/عروض. نفس مكوّن شريط المتاجر بعد استخراجه للمشترَك */}
      {(data?.announcement || data?.announcementEn) && (
        <AnnouncementBar ar={data.announcement} en={data.announcementEn} />
      )}

      {/* ستوريات المتاجر — تحت الهيدر وفوق السلايدر كما بإنستغرام.
          كان المكوّن موجوداً بلا أي استدعاء، فلم يكن يظهر إطلاقاً. */}
      <StoriesRow />

      {/* Hero — سلايدر يتحكّم به المدير. نعرض هيكل تحميل ريثما نعرف البانرات (بدل وميض
          السلايدر الافتراضي القديم)، ونستخدم البانرات المحفوظة محلياً لظهورٍ فوري.
          (مدخل البحث الشامل صار أيقونة داخل الهيدر — هيدر واحد بلا تكرار) */}
      {loading && !data && !(persistedBanners?.length) ? (
        <div className="skeleton h-[340px] rounded-3xl sm:h-[420px] lg:h-[500px] 2xl:h-[580px]" />
      ) : (
        <HomeHero banners={data ? data.homeBanners : persistedBanners || []} />
      )}

      {/* بطاقة تنزيل التطبيق (تظهر إن كان قابلاً للتثبيت وغير مثبّت) */}
      <InstallApp />

      {/* تصفّح حسب الفئة */}
      <Reveal>
        <section className="mt-16 sm:mt-20">
          <SectionTitle>{t('home.browseByCategory')}</SectionTitle>
          <CategoryGrid onSelect={pickCat} active={cat} cats={gridCats} />
        </section>
      </Reveal>

      {/* لوك بوك: إطلالة كاملة + قطعها — يُخفى بلا صورة */}
      <LookbookSection lookbook={data?.lookbook} />

      {/* شريط ترويجي (توصيل/دفع عند الاستلام) — طبق المرجع */}
      <PromoBanner />

      {/* المجموعات التحريرية — يحرّرها المدير من «سلايدر الموقع». تُخفى تماماً
          إن لم يُضف شيء، فلا حشو ولا بطاقات وهمية. */}
      {data?.collections?.length > 0 && (
        <Reveal><CollectionsRow collections={data.collections} /></Reveal>
      )}

      {/* صفقات اليوم — أعلى الخصومات عبر المنصّة (أسلوب المتاجر الكبرى) */}
      {data?.deals?.length > 0 && (
        <Reveal>
          <>
            <ProductRail
              title={t('home.deals')}
              icon={<BoltIcon className="h-5 w-5 shrink-0 text-gold-500" />}
              products={data.deals}
              action={
                <Link to="/offers" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-200 transition hover:opacity-80">
                  {t('store.viewAll')} <ForwardIcon className="h-4 w-4 rtl-flip" />
                </Link>
              }
            />
            {/* أعمق خصم وما يوشك على الانتهاء — الرفّ وحده لا يقول أيّهما يستحقّ العجلة */}
            <OffersBar products={data.deals} compact />
          </>
        </Reveal>
      )}

      {/* الأكثر مبيعاً — إثبات اجتماعي حقيقي من المبيعات المؤكّدة */}
      {data?.bestSellers?.length > 0 && <Reveal><ProductRail title={t('home.bestSellers')} icon={<FireIcon className="h-5 w-5 shrink-0 text-[#8a2438]" />} products={data.bestSellers} /></Reveal>}

      {/* مقترحات لكِ — تخصيص محلي من فئات ما شاهدته (يظهر فقط عند وجود ما يكفي) */}
      {forYou.length >= 3 && <ProductRail title={t('home.forYou')} icon={<SparkleIcon className="h-5 w-5 shrink-0 text-gold-500" />} products={forYou} />}

      {/* شاهدت مؤخراً */}
      {recent.length > 0 && <Reveal><ProductRail title={t('product.recentlyViewed')} products={recent} /></Reveal>}

      {loading ? (
        <section className="mt-16 sm:mt-20">
          <ProductGridSkeleton count={8} />
        </section>
      ) : (
        <>
          {/* منتجات مميّزة */}
          {data.featured?.length > 0 && (
            <Reveal>
              <section className="mt-16 sm:mt-20">
                <SectionTitle>{t('home.featuredProducts')}</SectionTitle>
                <div className="bz-cards">
                  {data.featured.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} />
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {/* متاجر مميزة */}
          <Reveal><section id="stores" className="mt-16 sm:mt-20">
            <SectionTitle>{t('home.featuredStores')}</SectionTitle>
            {data.stores.length === 0 ? (
              <EmptyState
                icon={<SparkleIcon className="h-8 w-8" />}
                text={t('home.emptyStores')}
                ctaLabel={t('home.ctaStart')}
                ctaTo="/register"
              />
            ) : (
              // بطاقة بوتيك بغلاف (نمط أدلّة المتاجر العالمية): غلاف المتجر من بنراته،
              // تدرّج سفلي ليُقرأ أي نص فوق أي صورة، والشعار يجلس على حدّ الغلاف بحلقة كريمية.
              // بلا غلاف نستخدم تدرّجاً خمرياً فاخراً — لا تظهر بطاقة فارغة أبداً.
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                {data.stores.map((s, i) => <StoreCard key={s.id} s={s} index={i} rtl={rtl} />)}
              </div>
            )}
          </section></Reveal>

          {/* أحدث المنتجات */}
          <Reveal>
            <section className="mt-16 sm:mt-20">
              <SectionTitle>{t('home.latestProducts')}</SectionTitle>
              {data.products.length === 0 ? (
                <EmptyState
                  icon={<BoltIcon className="h-8 w-8" />}
                  text={t('home.emptyProducts')}
                  ctaLabel={t('home.ctaExplore')}
                  ctaTo="/categories"
                />
              ) : (
                <div className="bz-cards">
                  {data.products.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} />
                  ))}
                </div>
              )}
            </section>
          </Reveal>
        </>
      )}

      {/* نشرة بازارا — قبل شريط المزايا مباشرةً بآخر الصفحة */}
      <Reveal><NewsletterBox /></Reveal>

      {/* شريط المزايا — بآخر الصفحة */}
      <FeaturesBar />

      <FloatingWhatsApp number={BAZARA_WHATSAPP} />
      <StylistChat marketplace />
    </>
  );
}

// أيقونة بيت (زر العودة للرئيسية)
function HomeGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 11.3 12 4l8.8 7.3" />
      <path d="M5.2 9.8V19a1 1 0 0 0 1 1h3.3v-4.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3.3a1 1 0 0 0 1-1V9.8" />
    </svg>
  );
}
// أيقونة التصنيفات (شبكة)
function GridGlyph({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}
// فاصل مسار التنقّل — يتبع اتجاه اللغة
function Crumb({ className = 'h-4 w-4' }) {
  const { i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0 text-wine/35`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

// عرض فئة داخل الرئيسية العامة (بازارا) — يبقيكِ بالرئيسية بلا انتقال لصفحة منفصلة.
// نفس شبكة/فلاتر صفحة الفئة، ومنتجات الفئة من كل المتاجر (بازارا خالصة).
function HomeCategoryView({ cat, onHome, custom = [] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // فئة مخصّصة؟ نأخذ اسمها وصورتها من القائمة المجمّعة (وإلا فئة أصلية باسمها المترجَم)
  const info = custom.find((c) => c.key === cat);
  const label = info ? info.name : t(`categories.${cat}`);
  const cacheKey = `cat:${cat}`;
  const [products, setProducts] = useState(() => getCache(cacheKey) || null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cached = getCache(cacheKey);
    setProducts(cached || null);
    setError('');
    api
      .get(`/public/category/${cat}`)
      .then((r) => { setProducts(r.data.products); setCache(cacheKey, r.data.products); })
      .catch((err) => { if (!cached) setError(getErrorMessage(err)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  return (
    <>
      <Seo title={label} />
      {/* مسار التنقّل: الرئيسية ← التصنيفات ← الفئة (أيقونات دائرية لا نصّاً) */}
      <nav className="mb-5 mt-1 flex flex-wrap items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={onHome}
          aria-label={t('nav.home')}
          title={t('nav.home')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
        >
          <HomeGlyph />
        </button>
        <Crumb />
        <button
          type="button"
          onClick={() => navigate('/categories')}
          aria-label={t('nav.categories')}
          title={t('nav.categories')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-wine/10 text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream"
        >
          <GridGlyph />
        </button>
        <Crumb />
        <span className="flex items-center gap-2 rounded-full bg-wine/10 px-2.5 py-1 font-display text-base font-bold text-wine">
          {info ? (
            info.image ? <img src={cldThumb(info.image, 96)} alt="" className="h-7 w-7 shrink-0 rounded object-contain" /> : null
          ) : (
            <CatThumb cat={cat} className="h-7 w-7" />
          )}
          {label}
          {products?.length > 0 && <span className="text-xs font-medium text-wine/50">· {products.length} {t('store.products')}</span>}
        </span>
      </nav>

      {error ? (
        <StateCard icon={<GridGlyph className="h-7 w-7" />} text={error}>
          <Act onClick={onHome}>{t('nav.home')}</Act>
        </StateCard>
      ) : !products ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <StateCard icon={<GridGlyph className="h-7 w-7" />} text={t('common.noResults')}>
          <Act onClick={onHome}>{t('nav.home')}</Act>
        </StateCard>
      ) : (
        <FilteredProductGrid products={products} />
      )}
    </>
  );
}

// سلايدر الـ Hero للصفحة الرئيسية: شريحة ثابتة + شريحتين, تحريك تلقائي + سحب باللمس
function HomeHero({ banners = [] }) {
  const { t } = useTranslation();
  // بانرات المدير (إن وُجدت) تطغى على الشرائح الافتراضية
  // الشرائح ذات الوسائط (فيديو/صورة/لون) تظهر أولاً → الفيديو أول ما يُرى
  const adminSlides = (banners || [])
    .filter((b) => b && (b.title || b.subtitle || b.bgValue))
    .sort((a, b) => (b.bgType && b.bgValue ? 1 : 0) - (a.bgType && a.bgValue ? 1 : 0));
  const useAdmin = adminSlides.length > 0;
  const slides = useAdmin
    ? adminSlides
    : [
        { eyebrow: 'LUXURY FASHION', title: t('home.heroTitle'), highlight: t('home.heroHighlight'), desc: t('home.heroDesc') },
        { eyebrow: 'BAZARA', title: t('home.s2Title'), desc: t('home.s2Desc') },
        { eyebrow: 'SEO • سيو', title: t('home.s3Title'), desc: t('home.s3Desc') },
      ];
  const len = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState(0); // إزاحة السحب الحيّة (px) — يتبع الإصبع
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const touch = useRef({ x: 0, y: 0, active: false, horiz: false });

  useEffect(() => { setI((p) => Math.min(p, len - 1)); }, [len]);
  useEffect(() => {
    if (len <= 1 || paused) return undefined;
    const id = setInterval(() => setI((p) => (p + 1) % len), 5000);
    return () => clearInterval(id);
  }, [len, paused]);

  // تشغيل ذكي لفيديوهات الشرائح (إصلاح تعليق): كانت كل الفيديوهات تعمل معاً بلا
  // توقف حتى خارج الشاشة. الآن يعمل فيديو الشريحة الظاهرة فقط، ويتوقف الكل
  // عندما يخرج السلايدر عن نافذة العرض أو تُخفى الصفحة.
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
  // لا نبدأ تنزيل/فك تشفير الفيديو أثناء إقلاع الصفحة (كان يزاحم الأكواد والبيانات
  // فيتقطّع الفتح) — البوستر ظاهر فوراً، والفيديو يبدأ بعد اكتمال التحميل بلحظة
  const [videoReady, setVideoReady] = useState(false);
  useEffect(() => {
    let id;
    const start = () => { id = setTimeout(() => setVideoReady(true), 250); };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => { clearTimeout(id); window.removeEventListener('load', start); };
  }, []);
  useEffect(() => {
    Object.entries(vidRefs.current).forEach(([idx, v]) => {
      if (!v) return;
      if (Number(idx) === i && heroVisible && videoReady && !document.hidden) v.play().catch(() => {});
      else v.pause();
    });
  }, [i, heroVisible, videoReady]);

  const go = (n) => setI(((n % len) + len) % len);

  // سحب لحظي يتبع الإصبع، ويستقر على شريحة واحدة فقط عند الإفلات
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onStart = (e) => {
      const tt = e.touches[0];
      touch.current = { x: tt.clientX, y: tt.clientY, active: true, horiz: false };
      setPaused(true);
    };
    const onMove = (e) => {
      if (!touch.current.active) return;
      const tt = e.touches[0];
      const dx = tt.clientX - touch.current.x;
      const dy = tt.clientY - touch.current.y;
      if (!touch.current.horiz && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
        touch.current.horiz = true;
        draggingRef.current = true;
      }
      if (touch.current.horiz) {
        e.preventDefault();
        let d = dx;
        if ((i === 0 && dx > 0) || (i === len - 1 && dx < 0)) d = dx / 3; // مقاومة عند الحواف
        setDrag(d);
      }
    };
    const onEnd = (e) => {
      if (!touch.current.active) return;
      const dx = e.changedTouches[0].clientX - touch.current.x;
      const w = el.offsetWidth || 1;
      const threshold = Math.min(70, w * 0.18);
      let next = i;
      if (touch.current.horiz && Math.abs(dx) > threshold) {
        next = dx < 0 ? i + 1 : i - 1;               // يتبع الإصبع
        next = Math.max(0, Math.min(len - 1, next));  // شريحة واحدة فقط
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
    <section className="relative">
      {/* لا نوقف التقدّم التلقائي عند مرور الماوس — على اللابتوب المؤشّر يبقى فوق الهيرو
          فكان «يضل واقف». يبقى الإيقاف أثناء السحب باللمس فقط (منطق onStart/onEnd). */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-3xl"
        style={{ touchAction: 'pan-y' }}
      >
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
            // شريحة المدير: خلفية صورة/فيديو/لون معتّمة (نص عاجي)، أو بلا وسائط (كريمي فخم بنص خمري)
            if (useAdmin) {
              const isColor = s.bgType === 'color' && s.bgValue;
              const isImage = s.bgType === 'image' && s.bgValue;
              const isVideo = s.bgType === 'video' && s.bgValue;
              const onMedia = isColor || isImage || isVideo; // وسائط داكنة → نص عاجي
              const vPoster = isVideo ? cldThumb(cldVideoPoster(s.bgValue), 1600) : ''; // poster عالي الدقة يملأ الهيرو العريض بلا تكبير مضبّب
              return (
                <div key={idx} className="w-full shrink-0" dir="rtl">
                  <div
                    className={`relative isolate flex h-[340px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:h-[420px] lg:h-[500px] 2xl:h-[580px] ${idx === i ? 'bz-hero-active' : ''} ${onMedia ? 'bg-[#241712]' : 'bg-gradient-to-br from-[#f6ecd9] via-[#efe1c6] to-[#f6ecd9]'}`}
                    style={isColor ? { background: s.bgValue } : isVideo ? { background: `linear-gradient(rgba(15,10,7,0.5), rgba(15,10,7,0.5)), url("${vPoster}") center/cover` } : undefined}
                  >
                    {/* التعتيم مخبوز في الوسيط (filter) لا كطبقة منفصلة — يمنع اختراق فيديو
                        iOS المُسرّع للطبقات، ومع خلفية الحاوية المخبوزة = خلفية واحدة معتّمة بلا وميض */}
                    {isImage && (
                      <img src={cldThumb(s.bgValue, 1920)} alt="" loading={idx === 0 ? 'eager' : 'lazy'} fetchpriority={idx === 0 ? 'high' : 'auto'} decoding="async" style={{ filter: 'brightness(0.6)' }} className="absolute inset-0 -z-10 h-full w-full object-cover" />
                    )}
                    {isVideo && (
                      <>
                        <img src={vPoster} alt="" aria-hidden loading={idx === 0 ? 'eager' : 'lazy'} fetchpriority={idx === 0 ? 'high' : 'auto'} decoding="async" style={{ filter: 'brightness(0.6)', zIndex: -2 }} className="absolute inset-0 h-full w-full object-cover" />
                        <video
                          ref={(el) => { vidRefs.current[idx] = el; }}
                          src={cldVideoMp4(s.bgValue)}
                          poster={vPoster}
                          muted loop playsInline
                          preload="metadata"
                          onEnded={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); }}
                          onPause={(e) => { if (!document.hidden && iRef.current === idx && visRef.current) e.currentTarget.play().catch(() => {}); }}
                          onCanPlay={(e) => { e.currentTarget.style.opacity = '1'; }}
                          style={{ filter: 'brightness(0.6)', opacity: 0, transition: 'opacity .35s ease', zIndex: -1 }}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </>
                    )}
                    {/* شارة ذهبية رفيعة تعطي إحساس دور الأزياء العالمية */}
                    <span className={`bz-hero-el bz-kicker mb-4 text-[11px] font-semibold uppercase sm:text-xs ${onMedia ? 'text-gold-200/90' : 'text-[#9a8463]'}`}>Bazara</span>
                    {s.title && <h1 className={`bz-hero-el font-display text-3xl font-extrabold leading-tight sm:text-5xl ${onMedia ? 'text-cream drop-shadow-lg' : 'text-[#5e4636]'}`}>{s.title}</h1>}
                    {s.subtitle && <p className={`bz-hero-el mx-auto mt-4 max-w-2xl sm:text-lg ${onMedia ? 'text-cream/85 drop-shadow' : 'text-[#6e5340]'}`}>{s.subtitle}</p>}
                    {s.btnLabel && s.btnHref && <div className="bz-hero-el"><SlideButton href={s.btnHref} label={s.btnLabel} onLight={!onMedia} /></div>}
                  </div>
                </div>
              );
            }
            // الشريحة الافتراضية (نصّية) — كريمي فخم بنص خمري (بلا البني)
            return (
              <div key={idx} className="w-full shrink-0" dir="rtl">
                <div className={`relative flex h-[340px] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#f6ecd9] via-[#efe1c6] to-[#f6ecd9] px-6 text-center sm:h-[420px] lg:h-[500px] 2xl:h-[580px] ${idx === i ? 'bz-hero-active' : ''}`}>
                  <div className="pointer-events-none absolute -top-12 start-1/4 h-44 w-44 animate-float rounded-full bg-wine/5 blur-3xl" />
                  <p className="bz-hero-el bz-kicker mb-4 text-[11px] font-semibold uppercase text-[#9a8463] sm:text-xs">{s.eyebrow}</p>
                  <h1 className="bz-hero-el font-display text-3xl font-extrabold leading-tight text-[#5e4636] sm:text-5xl">
                    {s.title}
                    {s.highlight && <> <span className="underline decoration-[#9c866a] decoration-2 underline-offset-8">{s.highlight}</span></>}
                  </h1>
                  <p className="bz-hero-el mx-auto mt-4 max-w-2xl text-[#6e5340] sm:text-lg">{s.desc}</p>
                  <div className="bz-hero-el mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Link to="/register" className="inline-flex items-center rounded-xl bg-wine px-6 py-2.5 text-base font-semibold text-cream shadow-lg transition hover:-translate-y-0.5 hover:bg-wine-dark">
                      {t('home.ctaStart')}
                    </Link>
                    <a href="#stores" className="inline-flex items-center rounded-xl border-2 border-wine/30 px-6 py-2.5 text-base font-semibold text-wine transition hover:bg-wine/5">
                      {t('home.ctaExplore')}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div dir="ltr" className="mt-6 flex items-center justify-center gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => go(idx)}
            aria-label={`slide ${idx + 1}`}
            className={`bz-dot h-1.5 rounded-full transition-all duration-500 ${idx === i ? 'bz-dot-on w-8' : 'w-1.5'}`}
          />
        ))}
      </div>
    </section>
  );
}

// زر شريحة السلايدر — يفتح رابطاً خارجياً (http) أو ينتقل لمسار داخلي بالموقع
function SlideButton({ href, label, onLight }) {
  const cls = onLight
    ? 'mt-6 inline-flex items-center rounded-xl bg-wine px-6 py-2.5 text-base font-semibold text-cream shadow-lg transition hover:-translate-y-0.5 hover:bg-wine-dark'
    : 'mt-6 inline-flex items-center rounded-xl bg-cream px-6 py-2.5 text-base font-semibold text-wine shadow-lg transition hover:-translate-y-0.5 hover:bg-white';
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
  }
  return <Link to={href.startsWith('/') ? href : `/${href}`} className={cls}>{label}</Link>;
}

// شريط ترويجي كريمي بأيقونة هدية + زر (طبق المرجع)
function PromoBanner() {
  const { t } = useTranslation();
  return (
    <Link to="/shop" className="bz-storecard group relative mt-10 flex items-center gap-4 overflow-hidden rounded-3xl p-4 transition hover:-translate-y-0.5 sm:p-5">
      {/* توهّج ذهبي خفيف يمسح البطاقة عند المرور — لمسة فخامة */}
      <span aria-hidden className="pointer-events-none absolute -inset-y-8 -start-24 w-24 -skew-x-12 bg-gradient-to-r from-transparent via-gold-400/20 to-transparent transition-all duration-700 group-hover:start-[110%]" />
      <span className="bz-softico flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"><GiftIcon className="h-7 w-7" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-wine sm:text-lg">{t('home.promoTitle')}</p>
        <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">{t('home.promoSub')}</p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-wine px-4 py-2 text-sm font-bold text-cream shadow-sm transition group-hover:bg-wine-dark sm:inline-flex">{t('home.shopNow')} <ForwardIcon className="h-3.5 w-3.5 rtl-flip transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></span>
      {/* على الجوال: سهم صغير يوضّح أن البطاقة قابلة للنقر (الزر الكامل مخفي) */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine sm:hidden"><ForwardIcon className="h-4 w-4 rtl-flip" /></span>
    </Link>
  );
}

// بطاقة متجر — تدخل بتتابع سينمائي عند التمرير إليها (كبطاقات المنتجات)، مع هالة
// ذهبية عند المرور وشارة «مميّز» للمتاجر التي يختارها المدير.
function StoreCard({ s, index = 0, rtl }) {
  const { t } = useTranslation();
  const [ref, inView] = useInViewOnce();
  return (
    <Link
      ref={ref}
      to={`/store/${s.slug}`}
      className={`bz-storecard group relative flex flex-col items-center overflow-hidden rounded-2xl p-5 text-center transition-[opacity,transform,box-shadow] duration-500 ease-out hover:!-translate-y-1.5 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} ${s.featured ? 'bz-storecard-top' : ''}`}
      style={{ transitionDelay: inView ? `${(index % 5) * 55}ms` : '0ms' }}
    >
      {s.featured && (
        <span className="absolute end-2 top-2 z-[2] inline-flex items-center gap-1 rounded-full bg-gold-400 px-2.5 py-1 text-[10px] font-extrabold text-ink-950 shadow-sm">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true"><path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 2h14v2H5z" /></svg>
          {t('product.featured')}
        </span>
      )}
      {/* هالة ذهبية ناعمة تتوهّج خلف الشعار عند المرور — لمسة بوتيك راقية */}
      <img
        src={cldThumb(s.logoUrl, 160) || 'https://placehold.co/80x80/f1e9dd/5e4636?text=%F0%9F%91%91'}
        alt={s.name}
        loading="lazy"
        className="bz-storecard-logo relative h-24 w-24 rounded-full bg-white object-cover transition duration-500 group-hover:scale-105"
      />
      <h3 className="mt-3 w-full truncate font-display font-bold text-stone-100">{s.name}</h3>
      <p className="mt-0.5 text-xs text-stone-400">{s.productsCount} {t('store.products')}</p>
      <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-wine/25 px-4 py-1.5 text-[11px] font-bold text-wine transition group-hover:border-wine group-hover:bg-wine group-hover:text-cream">
        {t('home.visitStore')}
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
        </svg>
      </span>
    </Link>
  );
}

// حالة فارغة — نفس بطاقة الحالة المستعملة بكلّ الموقع، لا بطاقةً خاصّةً بها.
// تظهر على المنصّة الناشئة فتبدو مقصودة لا ناقصة.
function EmptyState({ icon, text, ctaLabel, ctaTo }) {
  return (
    <StateCard icon={icon} text={text}>
      {ctaLabel && ctaTo && (
        <Act to={ctaTo}>{ctaLabel} <ForwardIcon className="h-3.5 w-3.5" /></Act>
      )}
    </StateCard>
  );
}

// عنوان قسم مركزي بزخرفة أنيقة (طبق المرجع)
function SectionTitle({ children }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2.5 sm:mb-10 sm:gap-3">
      <h2 className="bz-title whitespace-nowrap font-display text-xl font-bold sm:text-2xl">{children}</h2>
    </div>
  );
}

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
import { getRecent, productThumb } from '../utils/recentlyViewed.js';
import { productPath } from '../utils/links.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { cldVideoPoster, cldThumb, cldVideoMp4 } from '../utils/cloudinary.js';
import { GiftIcon, ForwardIcon, BoltIcon, FireIcon, SparkleIcon } from '../components/icons.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import StylistChat from '../components/StylistChat.jsx';
import InstallApp from '../components/InstallApp.jsx';
import FeaturesBar from '../components/FeaturesBar.jsx';
import NewsletterBox from '../components/NewsletterBox.jsx';
import LookbookSection from '../components/LookbookSection.jsx';
import Reveal from '../components/Reveal.jsx';
import useInViewOnce from '../hooks/useInViewOnce.js';
import ScrollProgress from '../components/ScrollProgress.jsx';
import StoriesRow from '../components/StoriesRow.jsx';
import { BAZARA_WHATSAPP } from '../config/site.js';
import { usePlatformCatKeys, platformCatKeys, storeOnlyCats } from '../utils/platformCategories.js';
import { phGlyph } from '../utils/imageFallback.js';

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
  // الفئات المخصّصة المجمّعة من كل المتاجر (يعيدها /public/home) — نستعملها
  // لعرض منتجاتها داخل الرئيسية عند اختيار فئة، لا لعرضها بصفّ الفئات.
  const customCats = storeOnlyCats(data?.customCategories, platformKeys);
  // صفُّ فئاتِ الرئيسيّةِ للمنصّةِ وحدَها: السبعُ المدمجةُ وما يضيفُه المديرُ
  // من لوحتِه بصورِه هو — لا ما ترفعُه المتاجر.
  //
  // كان الصفُّ يضمُّ كلَّ فئةٍ يضيفُها أيُّ تاجرٍ بصورتِه: فئةٌ مرسومةٌ بجانبِ
  // صورةٍ فوتوغرافيّةٍ بجانبِ لقطةِ جوّال، وكلُّ متجرٍ جديدٍ يزيدُ الخلط. والصفحةُ
  // الرئيسيّةُ صفحةُ المدير — لا يكتبُ عليها أحدٌ بلا إذنِه، كالهيرو والمجموعاتِ
  // والشرائطِ تماماً.
  //
  // ولا تُفقَدُ فئةُ التاجرةِ بذلك: تبقى بصفحةِ متجرِها، وبصفحةِ التصنيفاتِ
  // الكاملة، وبالبحث — تغيّرَ مكانُ عرضِها بالواجهةِ لا وجودُها.
  const gridCats = platformKeys.map((k) => ({ key: k, builtin: true }));

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


      {/* ستوريات المتاجر — تحت الهيدر وفوق السلايدر كما بإنستغرام.
          كان المكوّن موجوداً بلا أي استدعاء، فلم يكن يظهر إطلاقاً. */}
      <StoriesRow />

      {/* Hero — سلايدر يتحكّم به المدير. نعرض هيكل تحميل ريثما نعرف البانرات (بدل وميض
          السلايدر الافتراضي القديم)، ونستخدم البانرات المحفوظة محلياً لظهورٍ فوري.
          (مدخل البحث الشامل صار أيقونة داخل الهيدر — هيدر واحد بلا تكرار) */}
      {loading && !data && !(persistedBanners?.length) ? (
        <div className="bz-homehero skeleton" style={{ minHeight: "min(74svh, 620px)" }} />
      ) : (
        <HomeHero banners={data ? data.homeBanners : persistedBanners || []} />
      )}

      {/* بطاقة تنزيل التطبيق (تظهر إن كان قابلاً للتثبيت وغير مثبّت) */}
      <InstallApp />

      {/* تصفّح حسب الفئة */}
      <Reveal>
        <section className="bz-band bz-sec-gap">
          <div className="bz-inner">
            <SectionTitle eyebrow={t('home.eyebrowCats')}>{t('home.browseByCategory')}</SectionTitle>
            <CategoryGrid onSelect={pickCat} active={cat} cats={gridCats} />
          </div>
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
              eyebrow={t('home.eyebrowDeals')}
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
      {data?.bestSellers?.length > 0 && <Reveal><ProductRail ink eyebrow={t('home.eyebrowBest')} title={t('home.bestSellers')} icon={<FireIcon className="h-5 w-5 shrink-0 text-[#8a2438]" />} products={data.bestSellers} /></Reveal>}

      {loading ? (
        <section className="bz-sec-gap">
          <ProductGridSkeleton count={8} />
        </section>
      ) : (
        <>
          {/* منتجات مميّزة — رفٌّ لا شبكة: شبكتانِ كاملتانِ متتاليتانِ (هذه
              و«أحدثُ المنتجات») تُقرآنِ شبكةً واحدةً طويلة. تبقى الشبكةُ
              الكاملةُ للأحدثِ وحدَها — هي قسمُ التصفّحِ الحقيقيّ. */}
          {data.featured?.length > 0 && (
            <Reveal>
              <section className="bz-sec-gap">
                <SectionTitle eyebrow={t('landing.shelfEyebrow')}>{t('home.featuredProducts')}</SectionTitle>
                <div className="bz-cards-rail">
                  {(data.featured || []).map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} />
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {/* متاجر مميزة */}
          <Reveal><section id="stores" className="bz-band bz-sec-gap"><div className="bz-inner">
            <SectionTitle eyebrow={t('home.eyebrowStores')}>{t('home.featuredStores')}</SectionTitle>
            {(data.stores || []).length === 0 ? (
              <EmptyState
                icon={<SparkleIcon className="h-8 w-8" />}
                text={t('home.emptyStores')}
                ctaLabel={t('home.ctaStart')}
                ctaTo="/register"
              />
            ) : (
              // شبكةٌ بعددِ المتاجرِ لا بعددٍ ثابت: المنصّةُ اليومَ متجران، وشبكةُ
              // الأعمدةِ الخمسةِ كانت تتركُ ثلاثةَ أعمدةٍ فارغةٍ على جانبٍ واحدٍ،
              // فيبدو القسمُ ناقصاً لا مختاراً.
              // متجرُ الأسبوع: بطاقةٌ عريضةٌ بشريطٍ من قطعِه، والبقيّةُ بطاقاتٌ
              // عادية. كان القسمُ بطاقتَينِ صغيرتَينِ وسطَ بياضٍ واسع — أضعفَ
              // قسمٍ بالصفحةِ مع أنّه جوهرُ المنصّة.
              // الاختيارُ للمدير: الخادمُ يرتّبُ المميَّزَ أوّلاً ‎(featured DESC)
              // فلا يحتاجُ إعداداً جديداً. لكنّ المميَّزَ قد يكونُ بلا قطعٍ بعد،
              // والبطاقةُ العريضةُ الفارغةُ أسوأُ من الصغيرة — فنأخذُ أوّلَ متجرٍ
              // له قطعٌ تصلُ مع الصفحة، وإن لم يوجدْ بقيَ القسمُ شبكةً كما كان.
              (() => {
                const all = data.stores || [];
                const hero = all.find((s) => storeStrip(s, data).length >= 3) || null;
                const rest = hero ? all.filter((s) => s.id !== hero.id) : all;
                return (
                  <div className="space-y-6">
                    {hero && <FeaturedStoreCard s={hero} products={storeStrip(hero, data)} rtl={rtl} />}
                    {rest.length > 0 && (
                      <div
                        className={`mx-auto grid gap-4 ${
                          rest.length === 1 ? 'max-w-xs grid-cols-1'
                            : rest.length === 2 ? 'max-w-2xl grid-cols-2'
                              : rest.length === 3 ? 'max-w-4xl grid-cols-2 lg:grid-cols-3'
                                : 'grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5'
                        }`}
                      >
                        {rest.map((s, i) => <StoreCard key={s.id} s={s} index={i} rtl={rtl} />)}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div></section></Reveal>

          {/* أحدث المنتجات */}
          <Reveal>
            <section className="bz-sec-gap">
              <SectionTitle eyebrow={t('home.eyebrowLatest')}>{t('home.latestProducts')}</SectionTitle>
              {(data.products || []).length === 0 ? (
                <EmptyState
                  icon={<BoltIcon className="h-8 w-8" />}
                  text={t('home.emptyProducts')}
                  ctaLabel={t('home.ctaExplore')}
                  ctaTo="/categories"
                />
              ) : (
                <div className="bz-cards">
                  {(data.products || []).map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} />
                  ))}
                </div>
              )}
            </section>
          </Reveal>
        </>
      )}

      {/* كتلةٌ شخصيّةٌ واحدة: المقترحاتُ وما شوهِدَ مؤخّراً تحتَ رأسٍ واحدٍ بآخرِ
          الصفحة. كانا رفّينِ منفصلينِ بالأعلى بنفسِ شكلِ رفوفِ العرضِ تماماً —
          ومكانُهما الصحيحُ هنا: هذا تاريخُ تصفّحِها لا عرضٌ تجاريّ. */}
      {(forYou.length >= 3 || recent.length > 0) && (
        <Reveal>
          <section className="bz-band bz-sec-gap">
            <div className="bz-inner">
              <SectionTitle eyebrow={t('home.eyebrowPersonal')}>{t('home.personalTitle')}</SectionTitle>
              <div className="space-y-10">
                {forYou.length >= 3 && (
                  <ProductRail sub title={t('home.forYou')} icon={<SparkleIcon className="h-5 w-5 shrink-0 text-gold-500" />} products={forYou} />
                )}
                {recent.length > 0 && <ProductRail sub title={t('product.recentlyViewed')} products={recent} />}
              </div>
            </div>
          </section>
        </Reveal>
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
  const { t, i18n } = useTranslation();
  // اتّجاهُ حركةِ السلايدر يتبعُ اللغة: بالعربيّةِ تدخلُ الشريحةُ من اليمينِ
  // وتخرجُ يساراً، وبالإنجليزيّةِ العكس. كان الشريطُ مثبّتاً ‎ltr فيمشي باتّجاهٍ
  // واحدٍ مهما كانتِ اللغة.
  const rtl = i18n.language !== 'en';
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
  const [drag, setDrag] = useState(0); // إزاحة السحب الحيّة (px) — يتبع الإصبع
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const touch = useRef({ x: 0, y: 0, active: false, horiz: false });

  useEffect(() => { setI((p) => Math.min(p, len - 1)); }, [len]);
  // لا تقدّمَ تلقائيّاً: الشريحةُ تتبدّلُ بإصبعِ الزبونةِ أو بنقرِ النقطةِ فقط.
  // السلايدرُ الذي يمشي وحدَه يسحبُ الصورةَ من تحتِ عينِ من يقرأُ جملتَها،
  // ويُخرِجُ الزرَّ من تحتِ إصبعِها قبلَ أن تصلَه.

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

  // عرضُ إطارِ الهيرو بالبكسل — تُبنى عليه إزاحةُ الشريط. يُقاسُ عندَ التركيبِ
  // ويُتابَعُ بتغيّرِ المقاسِ (دورانُ الجوّالِ وتغيّرُ النافذة)، وإلّا بقيَ الشريطُ
  // على قياسٍ قديمٍ فتظهرُ شريحتانِ نصفَين.
  const [frameW, setFrameW] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const read = () => setFrameW(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // سحب لحظي يتبع الإصبع، ويستقر على شريحة واحدة فقط عند الإفلات
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onStart = (e) => {
      const tt = e.touches[0];
      touch.current = { x: tt.clientX, y: tt.clientY, active: true, horiz: false };
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
        // «التالي» يساراً بالعربيّةِ ويميناً بالإنجليزيّة. والمقاومةُ عندَ الطرفَين:
        // بالأولى حينَ يُسحَبُ للخلف، وبالأخيرةِ حينَ يُسحَبُ للأمام.
        const fwd = rtl ? dx < 0 : dx > 0;
        let d = dx;
        if ((i === 0 && !fwd) || (i === len - 1 && fwd)) d = dx / 3;
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
        // يتبعُ الإصبعَ باتّجاهِ اللغة: يساراً = التالي بالعربيّة، ويميناً = التالي
        // بالإنجليزيّة. كانت الإشارةُ ثابتةً فيُقلَبُ المعنى على الإنجليزيّة.
        const fwd = rtl ? dx < 0 : dx > 0;
        next = fwd ? i + 1 : i - 1;
        next = Math.max(0, Math.min(len - 1, next));  // شريحة واحدة فقط
      }
      draggingRef.current = false;
      touch.current.active = false;
      setDrag(0);
      setI(next);
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
      <div
        ref={containerRef}
        className="bz-homehero overflow-hidden"
        style={{ touchAction: 'pan-y' }}
      >
        {/* اتّجاهُ الحركةِ يتبعُ اللغة:
            ‏العربيّةُ — ‎row: الشريحةُ الأولى يساراً، والإزاحةُ سالبةٌ فيمشي الشريطُ
            يساراً وتدخلُ التاليةُ من اليمين. حركةٌ من اليمينِ إلى اليسار.
            ‏الإنجليزيّةُ — ‎row-reverse: الأولى يميناً، والإزاحةُ موجبةٌ فيمشي
            يميناً وتدخلُ التاليةُ من اليسار. والعكسُ صحيح.
            والسحبُ يُضافُ كما هو بالحالتَين: الإصبعُ يدفعُ الشريطَ بنفسِ جهتِه. */}
        <div
          className={`flex ${rtl ? '' : 'flex-row-reverse'}`}
          style={{
            // بالبكسلِ لا بالنسبة: نسبةُ ‎translateX تُحسَبُ من عرضِ العنصرِ نفسِه،
            // وهذا الشريطُ عرضُه عرضُ شريحةٍ واحدةٍ وأبناؤُه يفيضون عنه — فالنسبةُ
            // تصيرُ مرجعاً ملتبساً. عرضُ الإطارِ مقيسٌ ومضروبٌ بالفهرسِ لا يلتبس.
            transform: `translate3d(${(rtl ? -1 : 1) * i * frameW + drag}px, 0, 0)`,
            direction: 'ltr',
            transition: draggingRef.current ? 'none' : 'transform 480ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            willChange: 'transform',
          }}
        >
          {slides.map((s, idx) => {
            // شريحة المدير: خلفية صورة/فيديو/لون معتّمة، أو بلا وسائط — وكلتاهما
            // على حبرٍ عميقٍ الآن بنصٍّ عاجيّ، فلا تتبدّلُ لوحةُ الهيرو بتبدّلِ الشريحة
            if (useAdmin) {
              const isColor = s.bgType === 'color' && s.bgValue;
              const isImage = s.bgType === 'image' && s.bgValue;
              const isVideo = s.bgType === 'video' && s.bgValue;
              const onMedia = isColor || isImage || isVideo; // وسائط داكنة → نص عاجي
              // الهيرو صارَ بعرضِ الجهازِ كاملاً لا بطاقةً بحاوية، وعلى شاشةٍ بكثافةٍ
              // مضاعفةٍ يحتاجُ ضعفَ عرضِه بكسلاتٍ — ‎1600 كانت تكفي البطاقةَ لا الشاشة.
              const vPoster = isVideo ? cldThumb(cldVideoPoster(s.bgValue, 2600), 2600) : '';
              return (
                <div key={idx} className="w-full shrink-0" dir="rtl">
                  <div
                    className={`bz-homehero-slide ${idx === i ? 'bz-hero-active' : ''} ${onMedia ? 'bg-[#1C1B1A]' : 'bz-hero-plate'}`}
                    style={{
                      // نسبةُ التعتيمِ من لوحةِ المدير — رقمٌ واحدٌ لكلِّ شريحة،
                      // كما بصفحةِ الغلافِ تماماً ‎(--bz-dim).
                      '--bz-dim': (s.dim ?? 50) / 100,
                      ...(isColor ? { background: s.bgValue } : null),
                    }}
                  >
                    {/* التعتيمُ مخبوزٌ بالوسيطِ ‎(filter) لا طبقةً منفصلة: طبقةٌ فوقَ
                        فيديو iOS المُسرَّعِ يخترقُها الفيديو أحياناً فيظهرُ بلا تعتيم.
                        والشدّةُ تُقرأُ من المتغيّرِ نفسِه، فيبقى المقبضُ واحداً:
                        ‏‎0٪ ← بلا تعتيم · ‎50٪ ← 0.65 · ‎100٪ ← 0.30 */}
                    {isImage && (
                      <img src={cldThumb(s.bgValue, 1920)} alt="" loading={idx === 0 ? 'eager' : 'lazy'} fetchpriority={idx === 0 ? 'high' : 'auto'} decoding="async" style={{ filter: 'brightness(calc(1 - var(--bz-dim, 0.5) * 0.7))' }} className="absolute inset-0 -z-10 h-full w-full object-cover" />
                    )}
                    {isVideo && (
                      <>
                        <img src={vPoster} alt="" aria-hidden loading={idx === 0 ? 'eager' : 'lazy'} fetchpriority={idx === 0 ? 'high' : 'auto'} decoding="async" style={{ filter: 'brightness(calc(1 - var(--bz-dim, 0.5) * 0.7))', zIndex: -2 }} className="absolute inset-0 h-full w-full object-cover" />
                        <video
                          ref={(el) => { vidRefs.current[idx] = el; }}
                          src={cldVideoMp4(s.bgValue)}
                          poster={vPoster}
                          muted loop playsInline
                          preload="metadata"
                          onEnded={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); }}
                          onPause={(e) => { if (!document.hidden && iRef.current === idx && visRef.current) e.currentTarget.play().catch(() => {}); }}
                          onCanPlay={(e) => { e.currentTarget.style.opacity = '1'; }}
                          style={{ filter: 'brightness(calc(1 - var(--bz-dim, 0.5) * 0.7))', opacity: 0, transition: 'opacity .35s ease', zIndex: -1 }}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </>
                    )}
                    {/* كتلةُ النصّ: موضعُها من لوحةِ المدير — وسطاً أو إلى جهةٍ
                        كالشريطِ التحريريّ. وكلمةُ ما فوقَ العنوانِ صارت حقلاً
                        يملؤُه، بعدَ أن كانت «Bazara» مكتوبةً بالشيفرةِ بكلِّ شريحة. */}
                    <div className={`bz-homehero-text ${s.align === 'start' ? 'bz-ht-start' : s.align === 'end' ? 'bz-ht-end' : ''}`}>
                      <span className="bz-hero-el bz-kicker mb-3 block text-[11px] font-semibold uppercase text-[#BEBAB4] sm:text-xs">{s.eyebrow || 'Bazara'}</span>
                      {s.title && <h1 className="bz-hero-el font-display text-3xl font-extrabold leading-tight text-[#F6F5F3] drop-shadow-lg sm:text-5xl lg:text-6xl">{s.title}</h1>}
                      {s.subtitle && <p className="bz-hero-el mt-4 max-w-xl text-[#CFCCC7] drop-shadow sm:text-lg">{s.subtitle}</p>}
                      {/* أزرارُ الهيرو: زرُّ الشريحةِ إن وُضِعَ، ومعه دائماً بابانِ
                          للتسوّقِ — الهيرو بلا بابٍ يخرجُ منه لافتةٌ لا واجهة. */}
                      <div className="bz-hero-el mt-7 flex flex-wrap items-center gap-3">
                        {s.btnLabel && s.btnHref
                          ? <SlideButton href={s.btnHref} label={s.btnLabel} onLight={false} />
                          : <Link to="/categories" className="mt-6 inline-flex items-center rounded-xl bg-[#F6F5F3] px-6 py-2.5 text-base font-semibold text-[#1F1E1D] shadow-lg transition hover:-translate-y-0.5 hover:bg-white">{t('landing.shopNow')}</Link>}
                        <Link to="/offers" className="mt-6 inline-flex items-center rounded-xl border-2 border-[#F6F5F3]/35 px-6 py-2.5 text-base font-semibold text-[#F6F5F3] transition hover:bg-white/10">{t('nav.offers')}</Link>
                      </div>
                      {/* شرائطُ ثقةٍ تحتَ الأزرار: تُقرأُ قبلَ أوّلِ منتج — وهذا
                          ترتيبُ المتاجرِ التي تبيعُ لزائرةٍ لا تعرفُها بعد. */}
                      <ul className="bz-hero-el mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[#CFCCC7] sm:text-xs">
                        {[t('store.featDelivery'), t('store.featExchange'), t('store.featPrices')].map((f) => (
                          <li key={f} className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-[#A8A29B]" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            }
            // الشريحةُ الافتراضيّةُ (نصّيّة) — حبرٌ عميقٌ بنصٍّ عاجيّ
            return (
              <div key={idx} className="w-full shrink-0" dir="rtl">
                <div className={`bz-homehero-slide bz-hero-plate ${idx === i ? 'bz-hero-active' : ''}`}>
                  <div className="pointer-events-none absolute -top-12 start-1/4 h-44 w-44 animate-float rounded-full bg-white/[0.06] blur-3xl" />
                  <p className="bz-hero-el bz-kicker mb-4 text-[11px] font-semibold uppercase text-[#BEBAB4] sm:text-xs">{s.eyebrow}</p>
                  <h1 className="bz-hero-el font-display text-3xl font-extrabold leading-tight text-[#F6F5F3] sm:text-5xl lg:text-6xl">
                    {s.title}
                    {s.highlight && <> <span className="underline decoration-[#8C857C] decoration-2 underline-offset-8">{s.highlight}</span></>}
                  </h1>
                  <p className="bz-hero-el mx-auto mt-4 max-w-2xl text-[#CFCCC7] sm:text-lg">{s.desc}</p>
                  <div className="bz-hero-el mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Link to="/register" className="inline-flex items-center rounded-xl bg-[#F6F5F3] px-6 py-2.5 text-base font-semibold text-[#1F1E1D] shadow-lg transition hover:-translate-y-0.5 hover:bg-white">
                      {t('home.ctaStart')}
                    </Link>
                    <a href="#stores" className="inline-flex items-center rounded-xl border-2 border-[#F6F5F3]/30 px-6 py-2.5 text-base font-semibold text-[#F6F5F3] transition hover:bg-white/10">
                      {t('home.ctaExplore')}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* النقاطُ تتبعُ اتّجاهَ اللغةِ كالحركة: الأولى يميناً بالعربيّةِ ويساراً
          بالإنجليزيّة. كانت مثبّتةً ‎ltr فتبدأُ يساراً دائماً، فتمشي عكسَ الشريحة.
          وتُخفى بشريحةٍ واحدةٍ — نقطةٌ وحيدةٌ لا تدلُّ على شيءٍ ولا تُنقَر. */}
      {len > 1 && (
        <div dir={rtl ? 'rtl' : 'ltr'} className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => go(idx)}
              aria-label={`slide ${idx + 1}`}
              className={`bz-dot h-1.5 rounded-full transition-all duration-500 ${idx === i ? 'bz-dot-on w-8' : 'w-1.5'}`}
            />
          ))}
        </div>
      )}
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
    <Link to="/shop" className="bz-storecard bz-sec-gap group relative flex items-center gap-4 overflow-hidden rounded-3xl p-4 transition hover:-translate-y-0.5 sm:p-5">
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
// قطعُ متجرِ الأسبوعِ للشريط: تُلتقَطُ من الحُزَمِ التي وصلت أصلاً مع الصفحة
// ‏(المميّزة · الأحدث · الصفقات) بمطابقةِ ‎storeSlug — بلا طلبٍ إضافيٍّ للخادم.
function storeStrip(store, data) {
  if (!store || !data) return [];
  const pool = [...(data.featured || []), ...(data.products || []), ...(data.deals || [])];
  const seen = new Set();
  const out = [];
  for (const p of pool) {
    if (!p || p.storeSlug !== store.slug || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length === 8) break;
  }
  return out;
}

// بطاقةُ متجرِ الأسبوع: شعارٌ واسمٌ وسطرُ تعريفٍ وشريطُ قطعٍ وزرُّ زيارة.
// تُظهِرُ المتجرَ متجراً لا أيقونةً — وهذا ما يعطي المشتركةَ سبباً تستحقُّ
// الظهورَ عليه، ويعطي الزائرةَ سبباً تدخلُه.
function FeaturedStoreCard({ s, products = [], rtl }) {
  const { t } = useTranslation();
  if (!s) return null;
  return (
    <div className="bz-storecard bz-featstore overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-4 p-5 pb-4">
        <img
          src={cldThumb(s.logoUrl, 160) || phGlyph(80, 80, '👑')}
          alt={s.name}
          loading="lazy"
          className="bz-storecard-logo h-16 w-16 shrink-0 rounded-full bg-white object-cover sm:h-20 sm:w-20"
        />
        <div className="min-w-0 flex-1">
          <span className="bz-sec-eyebrow !mb-1">{t('home.eyebrowStores')}</span>
          <h3 className="truncate font-display text-xl font-bold text-stone-100 sm:text-2xl">{s.name}</h3>
          <p className="mt-0.5 truncate text-xs text-stone-400">
            {s.productsCount} {t('store.products')}
            {s.tagline ? <> · {s.tagline}</> : null}
          </p>
        </div>
        <Link
          to={`/store/${s.slug}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-wine px-5 py-2.5 text-xs font-bold text-cream transition hover:-translate-y-0.5 hover:bg-wine-dark"
        >
          {t('home.visitStore')}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
          </svg>
        </Link>
      </div>
      {products.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map((p) => (
            <Link
              key={p.id}
              to={productPath(p)}
              className="bz-pmedia relative block w-[84px] shrink-0 overflow-hidden rounded-xl transition hover:-translate-y-0.5 sm:w-[100px]"
            >
              <img
                src={cldThumb(productThumb(p), 300) || phGlyph(100, 133, '👗')}
                alt={p.name}
                loading="lazy"
                decoding="async"
                className="aspect-[3/4] w-full object-cover"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
        src={cldThumb(s.logoUrl, 160) || phGlyph(80, 80, '👑')}
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
function SectionTitle({ children, eyebrow }) {
  return (
    <div className="bz-sec-head">
      {eyebrow ? <span className="bz-sec-eyebrow">{eyebrow}</span> : null}
      <h2 className="bz-title bz-sec-h font-display">{children}</h2>
    </div>
  );
}

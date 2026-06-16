import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductRail from '../components/ProductRail.jsx';
import { getRecent } from '../utils/recentlyViewed.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { cldVideoPoster } from '../utils/cloudinary.js';
import CategoryGrid from '../components/CategoryGrid.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import InstallApp from '../components/InstallApp.jsx';
import FeaturesBar from '../components/FeaturesBar.jsx';
import { BAZARA_WHATSAPP } from '../config/site.js';

export default function Home() {
  const { t } = useTranslation();
  const [data, setData] = useState(() => getCache('home') || null);
  const [loading, setLoading] = useState(() => !getCache('home'));
  const recent = getRecent();
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

  return (
    <>
      <Seo title={t('app.name')} description={t('home.heroDesc')} />

      {/* Hero — سلايدر يتحكّم به المدير. نعرض هيكل تحميل ريثما نعرف البانرات (بدل وميض
          السلايدر الافتراضي القديم)، ونستخدم البانرات المحفوظة محلياً لظهورٍ فوري. */}
      {loading && !data && !(persistedBanners?.length) ? (
        <div className="skeleton h-[340px] rounded-3xl sm:h-[420px]" />
      ) : (
        <HomeHero banners={data ? data.homeBanners : persistedBanners || []} />
      )}

      {/* بطاقة تنزيل التطبيق (تظهر إن كان قابلاً للتثبيت وغير مثبّت) */}
      <InstallApp />

      {/* تصفّح حسب الفئة */}
      <section className="mt-12">
        <SectionTitle>{t('home.browseByCategory')}</SectionTitle>
        <CategoryGrid />
      </section>

      {/* شريط ترويجي (توصيل/دفع عند الاستلام) — طبق المرجع */}
      <PromoBanner />

      {/* شاهدت مؤخراً */}
      {recent.length > 0 && <ProductRail title={t('product.recentlyViewed')} products={recent} />}

      {loading ? (
        <section className="mt-14">
          <ProductGridSkeleton count={8} />
        </section>
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

      {/* شريط المزايا — بآخر الصفحة */}
      <FeaturesBar />

      <FloatingWhatsApp number={BAZARA_WHATSAPP} />
    </>
  );
}

// سلايدر الـ Hero للصفحة الرئيسية: شريحة ثابتة + شريحتين، تحريك تلقائي + سحب باللمس
function HomeHero({ banners = [] }) {
  const { t } = useTranslation();
  // بانرات المدير (إن وُجدت) تطغى على الشرائح الافتراضية
  const adminSlides = (banners || []).filter((b) => b && (b.title || b.subtitle || b.bgValue));
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
      <div
        ref={containerRef}
        className="overflow-hidden rounded-3xl"
        style={{ touchAction: 'pan-y' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
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
              return (
                <div key={idx} className="w-full shrink-0" dir="rtl">
                  <div
                    className={`relative isolate flex h-[340px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:h-[420px] ${onMedia ? 'bg-wine-dark' : 'bg-gradient-to-br from-[#f6ecd9] via-[#efe1c6] to-[#f6ecd9]'}`}
                    style={isColor ? { background: s.bgValue } : undefined}
                  >
                    {isImage && (
                      <img src={s.bgValue} alt="" loading={idx === 0 ? 'eager' : 'lazy'} style={{ filter: 'brightness(0.6)' }} className="absolute inset-0 -z-10 h-full w-full object-cover" />
                    )}
                    {isVideo && (
                      <video
                        src={s.bgValue}
                        poster={cldVideoPoster(s.bgValue)}
                        autoPlay muted loop playsInline preload="auto"
                        onEnded={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); }}
                        onPause={(e) => { if (!document.hidden) e.currentTarget.play().catch(() => {}); }}
                        style={{ filter: 'brightness(0.6)' }}
                        className="absolute inset-0 -z-10 h-full w-full object-cover"
                      />
                    )}
                    {s.title && <h1 className={`font-display text-3xl font-extrabold leading-tight sm:text-5xl ${onMedia ? 'text-cream drop-shadow-lg' : 'text-[#5e4636]'}`}>{s.title}</h1>}
                    {s.subtitle && <p className={`mx-auto mt-4 max-w-2xl sm:text-lg ${onMedia ? 'text-cream/85 drop-shadow' : 'text-[#6e5340]'}`}>{s.subtitle}</p>}
                    {s.btnLabel && s.btnHref && <SlideButton href={s.btnHref} label={s.btnLabel} onLight={!onMedia} />}
                  </div>
                </div>
              );
            }
            // الشريحة الافتراضية (نصّية) — كريمي فخم بنص خمري (بلا البني)
            return (
              <div key={idx} className="w-full shrink-0" dir="rtl">
                <div className="relative flex h-[340px] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#f6ecd9] via-[#efe1c6] to-[#f6ecd9] px-6 text-center sm:h-[420px]">
                  <div className="pointer-events-none absolute -top-12 start-1/4 h-44 w-44 animate-float rounded-full bg-wine/5 blur-3xl" />
                  <p className="mb-3 text-sm font-semibold tracking-[0.3em] text-[#6e5340]">{s.eyebrow}</p>
                  <h1 className="font-display text-3xl font-extrabold leading-tight text-[#5e4636] sm:text-5xl">
                    {s.title}
                    {s.highlight && <> <span className="underline decoration-[#c79a3a] decoration-2 underline-offset-8">{s.highlight}</span></>}
                  </h1>
                  <p className="mx-auto mt-4 max-w-2xl text-[#6e5340] sm:text-lg">{s.desc}</p>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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

      <div dir="ltr" className="mt-5 flex items-center justify-center gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => go(idx)}
            aria-label={`slide ${idx + 1}`}
            className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-wine' : 'w-2 bg-wine/30'}`}
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
    <Link to="/shop" className="mt-10 flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-wine/10 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cream text-3xl">🎁</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-wine sm:text-lg">{t('home.promoTitle')}</p>
        <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">{t('home.promoSub')}</p>
      </div>
      <span className="hidden shrink-0 rounded-full bg-wine px-4 py-2 text-sm font-bold text-cream sm:inline-block">{t('home.shopNow')} ←</span>
    </Link>
  );
}

// عنوان قسم مركزي بزخرفة أنيقة (طبق المرجع)
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

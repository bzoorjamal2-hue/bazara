import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductRail from '../components/ProductRail.jsx';
import { getRecent } from '../utils/recentlyViewed.js';
import CategoryGrid from '../components/CategoryGrid.jsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp.jsx';
import InstallApp from '../components/InstallApp.jsx';
import FeaturesBar from '../components/FeaturesBar.jsx';
import { BAZARA_WHATSAPP } from '../config/site.js';

export default function Home() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const recent = getRecent();

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

      {/* Hero — سلايدر بانرات (شريحة ثابتة + شريحتين) */}
      <HomeHero />

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
function HomeHero() {
  const { t } = useTranslation();
  const slides = [
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

  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => setI((p) => (p + 1) % len), 4000);
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
          {slides.map((s, idx) => (
            <div key={idx} className="w-full shrink-0" dir="rtl">
              <div className="pub-hero relative flex h-[340px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:h-[420px]">
                <div className="pointer-events-none absolute -top-12 start-1/4 h-44 w-44 animate-float rounded-full bg-cream/10 blur-3xl" />
                <p className="mb-3 text-sm font-semibold tracking-[0.3em] text-cream/70">{s.eyebrow}</p>
                <h1 className="font-display text-3xl font-extrabold leading-tight text-cream sm:text-5xl">
                  {s.title}
                  {s.highlight && <> <span className="underline decoration-cream/30 decoration-2 underline-offset-8">{s.highlight}</span></>}
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-cream/80 sm:text-lg">{s.desc}</p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Link to="/register" className="inline-flex items-center rounded-xl bg-cream px-6 py-2.5 text-base font-semibold text-wine shadow-lg transition hover:-translate-y-0.5 hover:bg-white">
                    {t('home.ctaStart')}
                  </Link>
                  <a href="#stores" className="inline-flex items-center rounded-xl border border-cream/40 px-6 py-2.5 text-base font-semibold text-cream transition hover:bg-cream/10">
                    {t('home.ctaExplore')}
                  </a>
                </div>
              </div>
            </div>
          ))}
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

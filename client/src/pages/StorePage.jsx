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
  const [sizesSel, setSizesSel] = useState([]); // مقاسات مختارة (متعدّد)
  const [offersOnly, setOffersOnly] = useState(false);
  const [openSheet, setOpenSheet] = useState(null); // 'sort' | 'size' | 'offers'
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get(`/public/store/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, t('errors.storeNotFound'))));
  }, [slug, t]);

  useEffect(() => setPage(1), [cat, q, sort, sizesSel, offersOnly]);

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
      const matchSize = sizesSel.length === 0 || sizesSel.includes((p.size || '').trim());
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
  if (!data) return <Spinner full />;

  const { store } = data;
  // واتساب المتجر: رقم الإعدادات إن وُجد، وإلا رقم المالك المُدخل عند التسجيل
  const wa = store.whatsapp || store.ownerPhone || '';
  const featured = data.products.filter((p) => p.featured);
  const pickCategory = (c) => { setCat(c); window.scrollTo({ top: 0, behavior: 'smooth' }); };

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

          {/* تصفّحي حسب الفئة */}
          <section className="mb-8 mt-7">
            <h2 className="mb-4 font-display text-xl font-bold gradient-text">{t('store.browseByCategory')}</h2>
            <CategoryGrid onSelect={pickCategory} active={cat} />
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

          <h2 className="mb-4 font-display text-xl font-bold gradient-text">{t('store.products')}</h2>
        </>
      ) : (
        /* صفحة الفئة المخصّصة: مسار التنقّل (🏠 ← المتجر ← الفئة) */
        <nav className="mb-4 mt-2 flex items-center gap-2 text-sm">
          <button onClick={() => pickCategory('all')} className="text-wine/70 hover:text-wine" aria-label="home">🏠</button>
          <span className="text-wine/40">←</span>
          <button onClick={() => pickCategory('all')} className="text-wine/70 hover:text-wine">{t('store.storeRoot')}</button>
          <span className="text-wine/40">←</span>
          <span className="font-display text-lg font-bold text-wine">{t(`categories.${cat}`)}</span>
        </nav>
      )}

      {/* ٣ شرايط فلترة (كل واحد يفتح نافذة سفلية) — أفقي قابل للسحب */}
      {data.products.length > 0 && (
        <div className="mb-4 -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2">
            <Chip onClick={() => setOpenSheet('sort')}>
              {t('store.sortBy')}: {t(SORT_LABEL[sort] || 'store.sortDefault')}
            </Chip>
            {sizes.length > 0 && (
              <Chip onClick={() => setOpenSheet('size')} active={sizesSel.length > 0}>
                {t('store.sizeLabel')}{sizesSel.length ? ` (${sizesSel.length})` : ''}
              </Chip>
            )}
            <Chip onClick={() => setOpenSheet('offers')} active={offersOnly}>
              {t('store.specialOffers')}
            </Chip>
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

      {/* النوافذ السفلية للفلاتر */}
      {openSheet === 'sort' && (
        <SortSheet value={sort} onClose={() => setOpenSheet(null)} onApply={(v) => { setSort(v); setOpenSheet(null); }} />
      )}
      {openSheet === 'size' && (
        <SizeSheet sizes={sizes} value={sizesSel} onClose={() => setOpenSheet(null)} onApply={(v) => { setSizesSel(v); setOpenSheet(null); }} />
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

// قالب النافذة السفلية
function FilterSheet({ title, onClose, onReset, onApply, children }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[80] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-sheet relative max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onReset} className="w-16 text-start text-sm font-medium text-wine/70 hover:text-wine">Reset</button>
          <h3 className="flex-1 text-center font-display text-lg font-bold text-[#2b2b2b]">{title}</h3>
          <button onClick={onClose} aria-label="close" className="w-16 text-end text-lg text-[#2b2b2b]">✕</button>
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
            <span>{s}</span>
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
  const banners = Array.isArray(store.banners) ? store.banners : [];
  const slides = [{ fixed: true }, ...banners];
  const len = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef(null);
  const touch = useRef({ x: 0, y: 0, active: false, horiz: false });

  useEffect(() => {
    if (len <= 1 || paused) return undefined;
    const id = setInterval(() => setI((p) => (p + 1) % len), 3500);
    return () => clearInterval(id);
  }, [len, paused]);

  const go = (n) => setI(((n % len) + len) % len);

  // السحب باللمس: نثبّت الصفحة عمودياً أثناء السحب الأفقي، واتجاه طبيعي (RTL)
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
      if (!touch.current.horiz && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) touch.current.horiz = true;
      if (touch.current.horiz) e.preventDefault(); // يمنع تمرير الصفحة عمودياً أثناء السحب الأفقي
    };
    const onEnd = (e) => {
      if (!touch.current.active) return;
      const dx = e.changedTouches[0].clientX - touch.current.x;
      if (touch.current.horiz && Math.abs(dx) > 40) {
        setI((p) => (((p + (dx < 0 ? -1 : 1)) % len) + len) % len); // سحب لليسار = السابق، لليمين = التالي
      }
      touch.current.active = false;
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
  }, [len]);

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

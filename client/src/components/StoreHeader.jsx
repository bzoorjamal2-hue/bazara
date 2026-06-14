import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import CatThumb from './CatThumb.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { MenuIcon, SearchIcon, CartIcon, HeartIcon } from './icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { cldThumb } from '../utils/cloudinary.js';
import { productThumb } from '../utils/recentlyViewed.js';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench'];

function MenuBtn({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      aria-label="menu"
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-wine shadow-sm ring-1 ring-wine/10 transition hover:bg-wine hover:text-cream"
    >
      <MenuIcon className="h-6 w-6" />
    </button>
  );
}

// هيدر صفحة المتجر — صف 1: شعار/اسم المتجر + قائمة (☰). صف 2: بحث + سلة (تحت زر القائمة تماماً).
// عند التمرير: الشعار يتقلّص بنعومة، ويظهر زر قائمة مُصغّر بحركة scale ناعمة (بلا قصّ ولا قفز).
export default function StoreHeader({ store, q, setQ, cat, setCat, products = [] }) {
  const { t, i18n } = useTranslation();
  const ltr = i18n.language !== 'ar';
  const { count, setOpen } = useCart();
  const { count: wishCount, setOpen: setWishOpen } = useWishlist();
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [focus, setFocus] = useState(false);

  // اقتراحات البحث الفوري: أول 6 منتجات يطابق اسمها ما يكتبه المستخدم
  const term = q.trim().toLowerCase();
  const suggestions = term ? products.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 6) : [];
  const logoWrapRef = useRef(null);
  const compactWrapRef = useRef(null);
  useScrollLock(drawer);

  useEffect(() => {
    const RANGE = 150;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smoothstep = (t) => t * t * (3 - 2 * t);
    let target = Math.min(Math.max(window.scrollY / RANGE, 0), 1);
    let cur = target;
    let raf = 0;
    let running = false;

    const draw = () => {
      cur += (target - cur) * (reduce ? 1 : 0.15);
      if (Math.abs(target - cur) < 0.0006) cur = target;
      const p = smoothstep(Math.min(Math.max(cur, 0), 1));
      const inv = 1 - p;

      const lw = logoWrapRef.current;
      if (lw) {
        lw.style.gridTemplateRows = inv + 'fr';
        lw.style.opacity = String(inv);
        lw.style.marginBottom = 12 * inv + 'px';
        lw.style.transform = `translate3d(0, ${-12 * p}px, 0)`;
      }
      // زر القائمة المُصغّر: ينمو بنعومة (scale = العرض) عند الطرف، والسلة تبقى على يمينه
      const cw = compactWrapRef.current;
      if (cw) {
        cw.style.width = 44 * p + 'px';
        cw.style.opacity = String(p);
        cw.style.marginInlineStart = 10 * p + 'px';
        cw.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
        const inner = cw.firstElementChild;
        if (inner) inner.style.transform = `scale(${p})`;
      }

      if (cur !== target) raf = requestAnimationFrame(draw);
      else { running = false; raf = 0; }
    };
    const tick = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    const onScroll = () => { target = Math.min(Math.max(window.scrollY / RANGE, 0), 1); tick(); };

    draw();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const pick = (c) => {
    setCat(c);
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMenu = () => setDrawer(true);

  return (
    <header className="app-navbar sticky top-0 z-50 -mx-4 -mt-5 mb-5 shadow-sm sm:-mx-6">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        {/* الصف الأول: اسم/شعار المتجر + زر القائمة (☰) — يتقلّص بنعومة مع التمرير */}
        <div ref={logoWrapRef} className="grid will-change-transform" style={{ gridTemplateRows: '1fr', marginBottom: '12px' }}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/store/${store.slug}`} onClick={() => setCat('all')} className="flex items-center gap-2.5">
                {store.logoUrl && (
                  <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-xl border border-wine/15 object-cover" />
                )}
                <span className="font-display text-2xl font-bold tracking-wide text-wine">{store.name}</span>
              </Link>
              <MenuBtn onOpen={openMenu} />
            </div>
          </div>
        </div>

        {/* صف البحث + السلة + (قائمة مُصغّرة تظهر بأقصى الشمال عند التمرير) */}
        <div className="flex items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-wine/50">
              <SearchIcon className="h-5 w-5" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 150)}
              placeholder={t('store.searchPlaceholder')}
              className="w-full rounded-full border-0 bg-white py-2.5 pe-4 ps-10 text-[#2b2b2b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-cream/50"
            />

            {/* اقتراحات البحث الفوري */}
            {focus && suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl border border-wine/10 bg-white shadow-2xl">
                {suggestions.map((p) => {
                  const img = cldThumb(productThumb(p), 120);
                  return (
                    <Link
                      key={p.id}
                      to={`/product/${p.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setFocus(false)}
                      className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-wine/5"
                    >
                      <img src={img} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#2b2b2b]">{p.name}</span>
                        <span className="text-sm font-bold text-wine">{t('common.currency')}{p.price}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* السلة — على يمين زر القائمة، وتكون بأقصى الحافة (تحت ☰) قبل التمرير */}
          <button
            data-cart-target
            onClick={() => setOpen(true)}
            aria-label="cart"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine/20 ms-2.5"
          >
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </button>

          {/* زر القائمة المُصغّر — يظهر بنعومة بأقصى الشمال (آخر عنصر)، والسلة على يمينه */}
          <div ref={compactWrapRef} className="flex shrink-0 items-center justify-center overflow-hidden" style={{ width: 0, opacity: 0 }}>
            <div className="will-change-transform"><MenuBtn onOpen={openMenu} /></div>
          </div>
        </div>
      </div>

      {/* الدرج الجانبي المنزلق — يُغلق بالضغط خارجه أو بزر ✕ */}
      {drawer && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50 animate-fade-up" onClick={() => setDrawer(false)} />
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-y-0 start-0 flex w-80 max-w-[85%] flex-col bg-wine-dark p-5 text-cream shadow-2xl ${ltr ? 'animate-slide-in-left' : 'animate-slide-in'}`}
          >
            <div className="flex items-center gap-2">
              {/* مسجّل الدخول (صاحب متجر) → لوحة التحكم. زائر → تسجيل الدخول. لا يوجد زر خروج داخل المتجر. */}
              <Link
                to={user ? '/dashboard' : '/login'}
                onClick={() => setDrawer(false)}
                className="flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-wine"
              >
                <UserGlyph /> {user ? t('nav.dashboard') : t('nav.login')}
              </Link>
              <button
                onClick={() => { setDrawer(false); setWishOpen(true); }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cream/15 text-cream"
                aria-label="wishlist"
              >
                <HeartIcon className="h-5 w-5" filled={wishCount > 0} />
              </button>
              <ThemeToggle className="bg-cream/15 text-cream hover:bg-cream/25" />
              <button
                onClick={() => setDrawer(false)}
                aria-label="close"
                className="ms-auto flex h-10 w-10 items-center justify-center rounded-full bg-cream text-lg font-bold text-wine transition hover:bg-white"
              >
                ✕
              </button>
            </div>

            <nav className="mt-6 space-y-1">
              <button
                onClick={() => pick('all')}
                className={`block w-full rounded-xl px-3 py-3 text-start text-lg font-bold transition hover:bg-cream/10 ${cat === 'all' ? 'text-cream' : 'text-cream/90'}`}
              >
                {t('store.allProducts')}
              </button>
              <div className="my-2 h-px bg-cream/15" />
              {CATS.map((c) => (
                <button
                  key={c}
                  onClick={() => pick(c)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-base transition hover:bg-cream/10 ${cat === c ? 'font-bold text-cream' : 'text-cream/85'}`}
                >
                  <CatThumb cat={c} className="h-9 w-9" />
                  {t(`categories.${c}`)}
                </button>
              ))}
            </nav>

            <div className="mt-auto flex items-center justify-between pt-4">
              <LanguageSwitcher onChanged={() => setDrawer(false)} />
              <Link to="/" onClick={() => setDrawer(false)} className="font-display text-xs text-cream/60 hover:text-cream">
                Bazara
              </Link>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}

function UserGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

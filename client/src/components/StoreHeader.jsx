import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { MenuIcon, SearchIcon, CartIcon, HeartIcon } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab'];

// هيدر صفحة المتجر — مستوحى من متاجر الأزياء الفاخرة:
// صف 1: اسم/شعار المتجر + قائمة (☰) — يتقلّص بنعومة عند التمرير.
// صف 2: بحث + سلة — ثابت. وعند التمرير يظهر زر قائمة مُصغّر بنعومة (بلا تشابك).
export default function StoreHeader({ store, q, setQ, cat, setCat }) {
  const { t, i18n } = useTranslation();
  const ltr = i18n.language !== 'ar';
  const { count, setOpen } = useCart();
  const { count: wishCount } = useWishlist();
  const [drawer, setDrawer] = useState(false);
  const logoWrapRef = useRef(null);
  const compactWrapRef = useRef(null);
  useScrollLock(drawer); // تجميد الخلفية عند فتح الدرج

  // انكماش الشعار مربوط بالتمرير مع تنعيم احترافي (lerp + smoothstep).
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
      // زر القائمة المُصغّر: ينمو بنعومة مربوطاً بالتمرير (scale = العرض) فيبقى دائرة كاملة بلا قصّ
      const cw = compactWrapRef.current;
      if (cw) {
        cw.style.width = 44 * p + 'px';
        cw.style.opacity = String(p);
        cw.style.marginInlineStart = 10 * p + 'px';
        const btn = cw.firstElementChild;
        if (btn) btn.style.transform = `scale(${p})`;
      }
      if (cur !== target) raf = requestAnimationFrame(draw);
      else { running = false; raf = 0; }
    };
    const tick = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    const onScroll = () => {
      target = Math.min(Math.max(window.scrollY / RANGE, 0), 1);
      tick();
    };

    draw();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const MenuBtn = ({ className = '' }) => (
    <button
      onClick={() => setDrawer(true)}
      aria-label="menu"
      className={`flex items-center justify-center rounded-full bg-cream text-wine shadow transition hover:bg-white ${className}`}
    >
      <MenuIcon className="h-6 w-6" />
    </button>
  );

  const pick = (c) => {
    setCat(c);
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 -mx-4 -mt-8 mb-5 bg-wine-dark shadow-lg sm:-mx-6">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        {/* الصف الأول: اسم/شعار المتجر + قائمة — يتقلّص بنعومة مع التمرير */}
        <div ref={logoWrapRef} className="grid will-change-transform" style={{ gridTemplateRows: '1fr', marginBottom: '12px' }}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/store/${store.slug}`} onClick={() => setCat('all')} className="flex items-center gap-2.5">
                {store.logoUrl && (
                  <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-xl border border-cream/30 object-cover" />
                )}
                <span className="font-display text-2xl font-bold tracking-wide text-cream">{store.name}</span>
              </Link>
              <MenuBtn className="h-11 w-11" />
            </div>
          </div>
        </div>

        {/* صف البحث: بحث + سلة + زر قائمة مُصغّر يظهر بنعومة عند التمرير */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-wine/50">
              <SearchIcon className="h-5 w-5" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('store.searchPlaceholder')}
              className="w-full rounded-full border-0 bg-white py-2.5 pe-4 ps-10 text-[#2b2b2b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-cream/50"
            />
          </div>
          <button
            onClick={() => setOpen(true)}
            aria-label="cart"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream/15 text-cream transition hover:bg-cream/25"
          >
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
          {/* زر القائمة المُصغّر — ينمو بنعومة مع التمرير (scale)، دائرة كاملة بلا قصّ */}
          <div ref={compactWrapRef} className="flex shrink-0 items-center justify-center overflow-hidden will-change-[width,opacity]" style={{ width: 0, opacity: 0 }}>
            <div className="will-change-transform">
              <MenuBtn className="h-11 w-11" />
            </div>
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
              <Link
                to="/login"
                onClick={() => setDrawer(false)}
                className="flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-wine"
              >
                <UserGlyph /> {t('nav.login')}
              </Link>
              <Link
                to="/wishlist"
                onClick={() => setDrawer(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cream/15 text-cream"
                aria-label="wishlist"
              >
                <HeartIcon className="h-5 w-5" filled={wishCount > 0} />
              </Link>
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
                  className={`block w-full rounded-xl px-3 py-3 text-start text-base transition hover:bg-cream/10 ${cat === c ? 'font-bold text-cream' : 'text-cream/85'}`}
                >
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

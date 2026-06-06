import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { MenuIcon, SearchIcon, CartIcon, HeartIcon } from './icons.jsx';

const CATS = ['abaya', 'set', 'dress', 'hijab'];

// هيدر صفحة المتجر العامة — مستوحى من متاجر الأزياء الفاخرة:
// صف 1: زر قائمة (☰) + اسم/شعار المتجر | صف 2: سلة + خانة بحث عريضة | درج جانبي للفئات.
export default function StoreHeader({ store, q, setQ, cat, setCat }) {
  const { t } = useTranslation();
  const { count, setOpen } = useCart();
  const { count: wishCount } = useWishlist();
  const [drawer, setDrawer] = useState(false);

  const pick = (c) => {
    setCat(c);
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 -mx-4 -mt-8 mb-5 bg-wine-dark shadow-lg sm:-mx-6">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        {/* الصف الأول: اسم/شعار المتجر (يمين) + قائمة ☰ (يسار) */}
        <div className="flex items-center justify-between gap-3">
          <Link to={`/store/${store.slug}`} onClick={() => setCat('all')} className="flex items-center gap-2.5">
            {store.logoUrl && (
              <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-xl border border-cream/30 object-cover" />
            )}
            <span className="font-display text-2xl font-bold tracking-wide text-cream">{store.name}</span>
          </Link>
          <button
            onClick={() => setDrawer(true)}
            aria-label="menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-wine shadow transition hover:bg-white"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>

        {/* الصف الثاني: بحث عريض (يمين) + سلة (يسار) */}
        <div className="mt-3 flex items-center gap-2.5">
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
        </div>
      </div>

      {/* الدرج الجانبي المنزلق */}
      {drawer && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-80 max-w-[85%] animate-slide-in flex-col bg-wine-dark p-5 text-cream shadow-2xl">
            {/* أزرار علوية: دخول + مفضّلة + إغلاق */}
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
                className="ms-auto flex h-10 w-10 items-center justify-center rounded-full bg-cream text-lg font-bold text-wine"
              >
                ✕
              </button>
            </div>

            {/* قائمة الفئات */}
            <nav className="mt-6 space-y-1">
              <button
                onClick={() => pick('all')}
                className={`block w-full rounded-xl px-3 py-3 text-end text-lg font-bold hover:bg-cream/10 ${cat === 'all' ? 'text-cream' : 'text-cream/90'}`}
              >
                {t('store.allProducts')}
              </button>
              <div className="my-2 h-px bg-cream/15" />
              {CATS.map((c) => (
                <button
                  key={c}
                  onClick={() => pick(c)}
                  className={`block w-full rounded-xl px-3 py-3 text-end text-base hover:bg-cream/10 ${cat === c ? 'font-bold text-cream' : 'text-cream/85'}`}
                >
                  {t(`categories.${c}`)}
                </button>
              ))}
            </nav>

            <div className="mt-auto flex items-center justify-between pt-4">
              <LanguageSwitcher />
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

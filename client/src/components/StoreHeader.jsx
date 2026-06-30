import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import CatThumb from './CatThumb.jsx';
import CloseButton from './CloseButton.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { MenuIcon, SearchIcon, CartIcon, HeartIcon, PackageIcon, GiftIcon } from './icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import StoryBar from './StoryBar.jsx';
import { cldThumb } from '../utils/cloudinary.js';
import { productThumb } from '../utils/recentlyViewed.js';

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

function MenuBtn({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      aria-label="menu"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-wine text-cream shadow-md ring-1 ring-wine/20 transition hover:bg-wine-dark"
    >
      <MenuIcon className="h-[18px] w-[18px]" />
    </button>
  );
}

// هيدر صفحة المتجر — صف 1: شعار/اسم المتجر + قائمة (☰). صف 2: بحث + سلة (تحت زر القائمة تماماً).
// عند التمرير: الشعار يتقلّص بنعومة، ويظهر زر قائمة مُصغّر بحركة scale ناعمة (بلا قصّ ولا قفز).
export default function StoreHeader({ store, q, setQ, cat, setCat, products = [], onShare, stories = [], isOwner = false, onStoryAdded, onStoryDeleted }) {
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
  const [collapsed, setCollapsed] = useState(false);
  useScrollLock(drawer);

  // طيّ الهيدر عند التمرير عبر تبديل حالة واحدة + انتقال CSS سلس (بدون تحريك التخطيط
  // كل فريم → بلا تعليق على كل الأجهزة). هيستيريسيس يمنع الرفرفة عند الحدّ.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setCollapsed((c) => (c ? y > 36 : y > 84));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const pick = (c) => {
    setCat(c);
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMenu = () => setDrawer(true);

  return (
    <header
      className="app-navbar sticky top-0 z-50 -mx-4 -mt-5 mb-5 shadow-sm sm:-mx-6"
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        {/* الصف الأول: اسم/شعار المتجر + زر القائمة (☰) — يتقلّص بانتقال CSS سلس */}
        <div
          className="grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: collapsed ? '0fr' : '1fr', opacity: collapsed ? 0 : 1, marginBottom: collapsed ? 0 : 8 }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* زر القائمة أقصى البداية (يمين بالعربي/يسار بالإنجليزي) */}
                <MenuBtn onOpen={openMenu} />
                {/* الشعار = دائرة الستوري (حلقة ذهبية إن وُجدت ستوريات، و(+) للمالكة) */}
                <StoryBar
                  compact
                  store={store}
                  stories={stories}
                  isOwner={isOwner}
                  products={products}
                  onAdded={onStoryAdded}
                  onDeleted={onStoryDeleted}
                />
                <Link to={`/store/${store.slug}`} onClick={() => setCat('all')} className="min-w-0">
                  <span className="block max-w-[46vw] truncate font-display text-base font-bold leading-tight tracking-wide text-wine sm:max-w-[22rem] sm:text-lg">{store.name}</span>
                </Link>
              </div>
              {/* زر تحويل اللغة ظاهر بالشريط (بلا فتح الدرج) */}
              <div className="flex shrink-0 items-center gap-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>

        {/* صف البحث: القائمة المُصغّرة (تظهر عند التمرير، جهة البداية) + البحث + السلة + المفضّلة */}
        <div className="flex items-center">
          {/* زر القائمة المُصغّر — يظهر بنعومة عند التمرير على يمين البحث (جهة البداية) */}
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden transition-[width,opacity,margin] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: collapsed ? 36 : 0, opacity: collapsed ? 1 : 0, marginInlineEnd: collapsed ? 10 : 0, pointerEvents: collapsed ? 'auto' : 'none' }}
          >
            <MenuBtn onOpen={openMenu} />
          </div>
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
              className="w-full rounded-full border-0 bg-white py-2 pe-4 ps-10 text-[#2b2b2b] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-cream/50"
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

          {/* السلة */}
          <button
            data-cart-target
            onClick={() => setOpen(true)}
            aria-label="cart"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream ms-2"
          >
            <CartIcon className="h-[18px] w-[18px]" />
            {count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </button>

          {/* المفضّلة — مكان زر القائمة القديم (جهة النهاية) */}
          <button
            onClick={() => setWishOpen(true)}
            aria-label="wishlist"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-wine shadow-sm ring-1 ring-wine/15 transition hover:bg-wine hover:text-cream ms-2"
          >
            <HeartIcon className="h-[18px] w-[18px]" />
            {wishCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {wishCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* الدرج الجانبي المنزلق — يُعرَض عبر Portal على مستوى الصفحة حتى لا يكون
          ابن الهيدر (المرفوع لطبقة عرض مستقلّة)، فيبقى تموضعه fixed سليماً */}
      {drawer && createPortal((
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50 animate-fade-up" onClick={() => setDrawer(false)} />
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-y-0 start-0 flex w-[17.5rem] max-w-[80%] flex-col bg-wine-dark px-5 pt-5 text-cream shadow-2xl ${ltr ? 'animate-slide-in-left' : 'animate-slide-in'}`}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
          >
            {/* رأس الدرج: إغلاق + أدوات متراصّة بنفس الحجم (40px) — بلا تخبيص */}
            <div className="flex items-center justify-between gap-2">
              <CloseButton onClick={() => setDrawer(false)} variant="cream" size="h-10 w-10" />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setDrawer(false); setWishOpen(true); }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-cream/15 text-cream transition hover:bg-cream/25"
                  aria-label="wishlist"
                >
                  <HeartIcon className="h-5 w-5" filled={wishCount > 0} />
                </button>
                <ThemeToggle size="h-10 w-10" className="bg-cream/15 text-cream hover:bg-cream/25" />
              </div>
            </div>

            {/* لوحة التحكم / دخول — زر بارز عريض (صاحب متجر → لوحة التحكم، زائر → دخول) */}
            <Link
              to={user ? '/dashboard' : '/login'}
              onClick={() => setDrawer(false)}
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-wine shadow-sm transition hover:bg-white"
            >
              <UserGlyph /> {user ? t('nav.dashboard') : t('nav.login')}
            </Link>

            <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain">
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
              <div className="my-2 h-px bg-cream/15" />
              {/* تتبّع الطلب */}
              <Link
                to="/track"
                onClick={() => setDrawer(false)}
                className="flex w-full items-center gap-3 rounded-xl border border-cream/25 bg-cream/10 px-3 py-3 text-start text-base font-bold text-cream transition hover:bg-cream/20"
              >
                <PackageIcon className="h-5 w-5 shrink-0" /> {t('nav.track')}
              </Link>
              {/* شاركي واربحي — يظهر فقط إن فعّل المتجر برنامج الإحالة */}
              {Number(store.referralPercent) > 0 && onShare && (
                <button
                  onClick={() => { setDrawer(false); onShare(); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-cream/25 bg-cream/10 px-3 py-3 text-start text-base font-bold text-cream transition hover:bg-cream/20"
                >
                  <GiftIcon className="h-5 w-5 shrink-0" /> {t('referral.shareTitle')}
                </button>
              )}
            </nav>

            <div className="flex shrink-0 items-center justify-between pt-4">
              <LanguageSwitcher onChanged={() => setDrawer(false)} />
              <Link to="/" onClick={() => setDrawer(false)} className="font-display text-xs text-cream/60 hover:text-cream">
                Bazara
              </Link>
            </div>
          </aside>
        </div>
      ), document.body)}
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

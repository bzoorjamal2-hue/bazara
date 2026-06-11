import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import Logo from './Logo.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { CartIcon, HeartIcon, MenuIcon } from './icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { isStandalone } from '../utils/pwa.js';

function Avatar({ user, size = 'h-8 w-8' }) {
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className={`${size} rounded-full border border-gold-400/40 object-cover`} />;
  }
  const initial = user?.name?.trim()?.[0] || '👤';
  return (
    <span className={`${size} flex items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/15 text-sm font-bold text-gold-200`}>
      {initial}
    </span>
  );
}

// أيقونات خطّية أنيقة لقائمة الحساب (بديل الإيموجي)
const I = (p) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p });
function GridIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></svg>);
}
function UserLineIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c0-3.7 3.4-5.6 7.5-5.6S19.5 16.3 19.5 20" /></svg>);
}
function StoreIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><path d="M4 9.5 5.2 5h13.6L20 9.5a2.4 2.4 0 0 1-4.8.3 2.4 2.4 0 0 1-4.8 0 2.4 2.4 0 0 1-4.8 0A2.4 2.4 0 0 1 4 9.5Z" /><path d="M5.5 11v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8" /><path d="M10 20v-4.5h4V20" /></svg>);
}
function BagIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><path d="M6.5 8h11l-.9 11.2a1.6 1.6 0 0 1-1.6 1.5H9a1.6 1.6 0 0 1-1.6-1.5L6.5 8Z" /><path d="M9.3 8V6.2a2.7 2.7 0 0 1 5.4 0V8" /></svg>);
}
function ReceiptIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><path d="M6.5 3h11v18l-2.2-1.4L13 21l-2.3-1.4L8.4 21l-1.9-1.4V3Z" /><path d="M9.5 7.5h5M9.5 11h5M9.5 14.5h3" /></svg>);
}
function UsersIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><circle cx="9" cy="8" r="3.2" /><path d="M3.2 19c0-3.2 3-4.8 5.8-4.8S14.8 15.8 14.8 19" /><path d="M16.2 5.4a3.1 3.1 0 0 1 0 5.7M17 14.4c2 .6 3.6 2 3.6 4.6" /></svg>);
}
function ShieldCheckIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><path d="M12 3l7.5 2.8v5.1c0 4.4-3 7.6-7.5 9.6-4.5-2-7.5-5.2-7.5-9.6V5.8L12 3z" /><path d="M9 12l2 2 4-4" /></svg>);
}
function LogoutIcon({ className = 'h-5 w-5' }) {
  return (<svg {...I({ className })}><path d="M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M9.5 8 5.5 12l4 4" /><path d="M5.5 12H15" /></svg>);
}

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const ltr = i18n.language !== 'ar';
  const { user, store, subscription, logout } = useAuth();
  const { count, setOpen } = useCart();
  const { count: wishCount } = useWishlist();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useScrollLock(menuOpen); // تجميد الخلفية عند فتح قائمة الحساب

  // عند التمرير: الشريط يلتصق بالأعلى بعرض كامل (بلا فراغ علوي) — وفوق يبقى طافياً
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled((prev) => (prev ? window.scrollY > 10 : window.scrollY > 40));
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // الشريط الخمري الفاخر على كل الموقع
  const pub = true;
  const standalone = isStandalone(); // داخل التطبيق المثبّت: الدخول من شاشة الترحيب فقط
  const isHome = pathname === '/'; // على الرئيسية نعرض اسم Bazara (مش اسم المتجر)

  const isAdmin = subscription?.isAdmin;
  // مسجّل دخول: اسم متجره — والمدير يظهر باسمه (حساب تحكّم) — وعلى الرئيسية نعرض Bazara
  const brandName = user && !isHome ? (isAdmin ? user.name || t('app.name') : store?.name || t('app.name')) : t('app.name');
  const brandTo = user && !isHome ? '/dashboard' : '/';

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  // أقسام لوحة التحكم (تظهر في قائمة المستخدم) — المدير: تحكّم فقط بلا بيع
  const sections = isAdmin
    ? [
        { key: 'subscribers', label: t('admin.subscribersNav'), Icon: UsersIcon },
        { key: 'admin', label: t('admin.nav'), Icon: ShieldCheckIcon },
        { key: 'profile', label: t('dashboard.profile'), Icon: UserLineIcon },
      ]
    : [
        { key: 'overview', label: t('dashboard.overview'), Icon: GridIcon },
        { key: 'profile', label: t('dashboard.profile'), Icon: UserLineIcon },
        { key: 'storeSettings', label: t('dashboard.storeSettings'), Icon: StoreIcon },
        { key: 'myProducts', label: t('dashboard.myProducts'), Icon: BagIcon },
        { key: 'myOrders', label: t('dashboard.myOrders'), Icon: ReceiptIcon },
      ];

  // أصناف ديناميكية حسب الثيم (خمري للصفحات العامة / داكن للوحة التحكم)
  const brandCls = pub ? 'text-cream' : 'gradient-text';
  const iconCls = pub ? 'text-cream/85 hover:text-cream' : 'text-stone-300 hover:text-gold-200';
  const linkCls = pub ? 'text-cream/85 hover:text-cream' : 'text-stone-200 hover:text-gold-200';
  const countCls = pub ? 'bg-red-500 text-white' : 'bg-gold-400 text-ink-950';

  return (
    <header className="sticky top-0 z-50">
      <nav className={`${pub ? 'pub-navbar' : 'glass-strong'} relative mx-auto flex items-center justify-between gap-1 px-2.5 py-3 transition-all duration-300 sm:gap-2 sm:px-6 ${scrolled ? 'mt-0 max-w-full rounded-none' : 'mt-4 max-w-6xl rounded-2xl'}`}>
        {/* للمستخدم: زر القائمة ☰ (مكان اللوجو) + اسم متجره. للزائر: شعار Bazara */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${pub ? 'border-cream/30 text-cream hover:bg-cream/10' : 'border-gold-400/30 text-gold-200 hover:bg-gold-400/10'}`}
                aria-label="menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <Link to={brandTo} className={`font-display text-xl font-bold tracking-wide ${brandCls}`}>
                {brandName}
              </Link>
            </>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-8 w-8 sm:h-9 sm:w-9" />
              <span className={`font-display text-base font-bold tracking-wide sm:text-xl ${brandCls}`}>{brandName}</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {!user && (
            <NavLink to="/" className={`hidden rounded-lg px-3 py-1.5 text-sm sm:block ${linkCls}`}>
              {t('nav.home')}
            </NavLink>
          )}

          <Link to="/wishlist" className={`relative hidden rounded-lg p-2 sm:block ${iconCls}`} title={t('nav.wishlist')}>
            <HeartIcon className="h-5 w-5" />
            {wishCount > 0 && (
              <span className={`absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${countCls}`}>{wishCount}</span>
            )}
          </Link>

          <button data-cart-target onClick={() => setOpen(true)} className={`relative rounded-lg p-1.5 sm:p-2 ${iconCls}`} title={t('nav.cart')}>
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className={`absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${countCls}`}>{count}</span>
            )}
          </button>

          <ThemeToggle className={iconCls} />

          {/* الدخول/التسجيل في المتصفّح فقط — داخل التطبيق يكون من شاشة الترحيب ليبقى التسوّق نظيفاً */}
          {!user && !standalone && (
            <>
              <NavLink to="/login" className={`whitespace-nowrap rounded-lg px-1 py-1.5 text-sm ${linkCls}`}>{t('nav.login')}</NavLink>
              {pub ? (
                <Link to="/register" className="inline-flex shrink-0 items-center whitespace-nowrap rounded-xl bg-cream px-2.5 py-1.5 text-sm font-semibold text-wine shadow-sm transition hover:bg-white">{t('nav.register')}</Link>
              ) : (
                <Link to="/register" className="btn-primary !px-4 !py-1.5 text-sm">{t('nav.register')}</Link>
              )}
            </>
          )}

          {/* زر اللغة بالشريط العلوي للزوّار فقط — المستخدم المسجّل يبدّلها من داخل القائمة */}
          {!user && <LanguageSwitcher />}
        </div>

      </nav>

      {/* قائمة الحساب — درج جانبي أنيق (مثل درج المتجر) */}
      {user && menuOpen && (
        <div className="fixed inset-0 z-[70]">
          {/* خلفية معتّمة — تُغلق الدرج بالضغط خارجه */}
          <div className="absolute inset-0 bg-black/50 animate-fade-up" onClick={() => setMenuOpen(false)} />
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-y-0 start-0 flex w-80 max-w-[85%] flex-col bg-wine-dark px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+92px)] text-cream shadow-2xl ${ltr ? 'animate-slide-in-left' : 'animate-slide-in'}`}
          >
            {/* أعلى: إغلاق + اللغة */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-lg font-bold text-wine transition hover:bg-white"
              >
                ✕
              </button>
              <LanguageSwitcher onChanged={() => setMenuOpen(false)} />
            </div>

            {/* الهوية — المدير يظهر باسمه وصورته (حساب تحكّم) */}
            <div className="mt-5 flex items-center gap-3 border-b border-cream/15 pb-4">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-full border border-cream/40 object-cover" />
              ) : !isAdmin && store?.logoUrl ? (
                <img src={store.logoUrl} alt={store.name} className="h-12 w-12 rounded-xl border border-cream/40 object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cream/40 bg-cream/15 text-lg font-bold text-cream">
                  {user.name?.[0] || '👤'}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-cream">
                  {isAdmin ? user.name : store?.name || t('app.name')}
                </p>
                <p className="truncate text-xs text-cream/60">{isAdmin ? user.email : user.name}</p>
              </div>
            </div>

            {/* الروابط — تأخذ المساحة وتتمرّر داخلياً ليبقى زر الخروج ظاهراً دائماً */}
            <nav className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
              {sections.map((s) => {
                const curTab = new URLSearchParams(search).get('tab') || (isAdmin ? 'subscribers' : 'overview');
                const active = pathname.startsWith('/dashboard') && curTab === s.key;
                return (
                  <Link
                    key={s.key}
                    to={`/dashboard?tab=${s.key}`}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base transition ${active ? 'bg-cream/15 font-bold text-cream' : 'text-cream/85 hover:bg-cream/10 hover:text-cream'}`}
                  >
                    <s.Icon className="h-5 w-5 shrink-0 text-cream/80" /> {s.label}
                  </Link>
                );
              })}
            </nav>

            {/* تسجيل الخروج — ثابت بأسفل القائمة دائماً */}
            <button
              onClick={handleLogout}
              className="mt-3 flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300/40 bg-red-500/15 px-3 py-3 text-base font-bold text-red-100 transition hover:bg-red-500/30"
            >
              <LogoutIcon className="h-5 w-5" /> {t('nav.logout')}
            </button>
          </aside>
        </div>
      )}
    </header>
  );
}

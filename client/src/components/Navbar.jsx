import { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import Logo from './Logo.jsx';
import { CartIcon, HeartIcon, MenuIcon } from './icons.jsx';

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

export default function Navbar() {
  const { t } = useTranslation();
  const { user, store, subscription, logout } = useAuth();
  const { count, setOpen } = useCart();
  const { count: wishCount } = useWishlist();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // الشريط الخمري الفاخر على كل الموقع
  const pub = true;
  const isHome = pathname === '/'; // على الرئيسية نعرض اسم Bazara (مش اسم المتجر)

  const isAdmin = subscription?.isAdmin;
  // مسجّل دخول: اسم متجره — إلا على الصفحة الرئيسية فنعرض Bazara
  const brandName = user && !isHome ? store?.name || t('app.name') : t('app.name');
  const brandTo = user && !isHome ? '/dashboard' : '/';

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  // أقسام لوحة التحكم (تظهر في قائمة المستخدم) — المدير: تحكّم فقط بلا بيع
  const sections = isAdmin
    ? [
        { key: 'subscribers', label: t('admin.subscribersNav'), icon: '👥' },
        { key: 'admin', label: t('admin.nav'), icon: '🛡️' },
        { key: 'profile', label: t('dashboard.profile'), icon: '👤' },
      ]
    : [
        { key: 'overview', label: t('dashboard.overview'), icon: '📊' },
        { key: 'profile', label: t('dashboard.profile'), icon: '👤' },
        { key: 'storeSettings', label: t('dashboard.storeSettings'), icon: '⚙️' },
        { key: 'myProducts', label: t('dashboard.myProducts'), icon: '🧺' },
        { key: 'myOrders', label: t('dashboard.myOrders'), icon: '🧾' },
      ];

  // أصناف ديناميكية حسب الثيم (خمري للصفحات العامة / داكن للوحة التحكم)
  const brandCls = pub ? 'text-cream' : 'gradient-text';
  const iconCls = pub ? 'text-cream/85 hover:text-cream' : 'text-stone-300 hover:text-gold-200';
  const linkCls = pub ? 'text-cream/85 hover:text-cream' : 'text-stone-200 hover:text-gold-200';
  const countCls = pub ? 'bg-red-500 text-white' : 'bg-gold-400 text-ink-950';

  return (
    <header className="sticky top-0 z-50">
      <nav className={`${pub ? 'pub-navbar' : 'glass-strong'} relative mx-auto mt-4 flex max-w-6xl items-center justify-between gap-1 rounded-2xl px-2.5 py-3 sm:gap-2 sm:px-6`}>
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

          <button onClick={() => setOpen(true)} className={`relative rounded-lg p-1.5 sm:p-2 ${iconCls}`} title={t('nav.cart')}>
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className={`absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${countCls}`}>{count}</span>
            )}
          </button>

          {!user && (
            <>
              <NavLink to="/login" className={`whitespace-nowrap rounded-lg px-1 py-1.5 text-sm ${linkCls}`}>{t('nav.login')}</NavLink>
              {pub ? (
                <Link to="/register" className="inline-flex shrink-0 items-center whitespace-nowrap rounded-xl bg-cream px-2.5 py-1.5 text-sm font-semibold text-wine shadow-sm transition hover:bg-white">{t('nav.register')}</Link>
              ) : (
                <Link to="/register" className="btn-primary !px-4 !py-1.5 text-sm">{t('nav.register')}</Link>
              )}
            </>
          )}

          <LanguageSwitcher />
        </div>

      </nav>

      {/* قائمة الحساب — درج جانبي أنيق (مثل درج المتجر) */}
      {user && menuOpen && (
        <div className="fixed inset-0 z-[70]">
          {/* خلفية معتّمة (لا تُغلق — الإغلاق بزر ✕) */}
          <div className="absolute inset-0 bg-black/50" />
          <aside dir="rtl" className="absolute inset-y-0 right-0 flex w-80 max-w-[85%] animate-slide-in flex-col bg-wine-dark p-5 text-cream shadow-2xl">
            {/* أعلى: إغلاق + اللغة */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-lg font-bold text-wine"
              >
                ✕
              </button>
              <LanguageSwitcher />
            </div>

            {/* الهوية */}
            <div className="mt-5 flex items-center gap-3 border-b border-cream/15 pb-4">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-full border border-cream/40 object-cover" />
              ) : store?.logoUrl ? (
                <img src={store.logoUrl} alt={store.name} className="h-12 w-12 rounded-xl border border-cream/40 object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cream/40 bg-cream/15 text-lg font-bold text-cream">
                  {user.name?.[0] || '👤'}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-cream">{store?.name || t('app.name')}</p>
                <p className="truncate text-xs text-cream/60">{user.name}</p>
              </div>
            </div>

            {/* الروابط */}
            <nav className="mt-3 space-y-1 overflow-y-auto">
              {sections.map((s) => (
                <Link
                  key={s.key}
                  to={`/dashboard?tab=${s.key}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-base text-cream/90 transition hover:bg-cream/10 hover:text-cream"
                >
                  <span className="w-5 text-center">{s.icon}</span> {s.label}
                </Link>
              ))}
              <div className="my-2 h-px bg-cream/15" />
              {store && !isAdmin && (
                <a
                  href={`/store/${store.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-base text-cream/90 transition hover:bg-cream/10 hover:text-cream"
                >
                  <span className="w-5 text-center">🔗</span> {t('dashboard.viewPublicStore')}
                </a>
              )}
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-base text-cream/90 transition hover:bg-cream/10 hover:text-cream"
              >
                <span className="w-5 text-center">🏠</span> {t('dashboard.viewHome')}
              </Link>
            </nav>

            {/* خروج */}
            <button
              onClick={handleLogout}
              className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-red-200 transition hover:bg-red-500/15"
            >
              <span className="w-5 text-center">🚪</span> {t('nav.logout')}
            </button>
          </aside>
        </div>
      )}
    </header>
  );
}

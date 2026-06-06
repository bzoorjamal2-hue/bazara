import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = subscription?.isAdmin;
  const brandName = user ? store?.name || t('app.name') : t('app.name');

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  // أقسام لوحة التحكم (تظهر في قائمة المستخدم)
  const sections = [
    { key: 'overview', label: t('dashboard.overview'), icon: '📊' },
    { key: 'profile', label: t('dashboard.profile'), icon: '👤' },
    { key: 'storeSettings', label: t('dashboard.storeSettings'), icon: '⚙️' },
    { key: 'myProducts', label: t('dashboard.myProducts'), icon: '🧺' },
    { key: 'myOrders', label: t('dashboard.myOrders'), icon: '🧾' },
    ...(isAdmin
      ? [
          { key: 'subscribers', label: t('admin.subscribersNav'), icon: '👥' },
          { key: 'admin', label: t('admin.nav'), icon: '🛡️' },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50">
      <nav className="glass-strong mx-auto mt-4 flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        {/* للمستخدم: زر القائمة ☰ (مكان اللوجو) + اسم متجره. للزائر: شعار Bazara */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold-400/30 text-gold-200 hover:bg-gold-400/10"
                aria-label="menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <Link to="/dashboard" className="font-display text-xl font-bold tracking-wide gradient-text">
                {brandName}
              </Link>
            </>
          ) : (
            <Link to="/" className="flex items-center gap-2.5">
              <Logo className="h-9 w-9" />
              <span className="font-display text-xl font-bold tracking-wide gradient-text">{brandName}</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!user && (
            <NavLink to="/" className="hidden rounded-lg px-3 py-1.5 text-sm text-stone-300 hover:text-gold-200 sm:block">
              {t('nav.home')}
            </NavLink>
          )}

          <Link to="/wishlist" className="relative rounded-lg p-2 text-stone-300 hover:text-gold-200" title={t('nav.wishlist')}>
            <HeartIcon className="h-5 w-5" />
            {wishCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-ink-950">{wishCount}</span>
            )}
          </Link>

          <button onClick={() => setOpen(true)} className="relative rounded-lg p-2 text-stone-300 hover:text-gold-200" title={t('nav.cart')}>
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-ink-950">{count}</span>
            )}
          </button>

          {!user && (
            <>
              <NavLink to="/login" className="rounded-lg px-3 py-1.5 text-sm text-stone-200 hover:text-gold-200">{t('nav.login')}</NavLink>
              <Link to="/register" className="btn-primary !px-4 !py-1.5 text-sm">{t('nav.register')}</Link>
            </>
          )}

          <LanguageSwitcher />
        </div>
      </nav>

      {/* قائمة المستخدم المنسدلة */}
      {user && menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="glass-strong absolute z-50 mt-2 w-60 overflow-hidden rounded-2xl p-2 start-4 sm:start-6" style={{ top: '100%' }}>
            <div className="flex items-center gap-3 border-b border-gold-400/15 p-3">
              <Avatar user={user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-100">{store?.name}</p>
                <p className="truncate text-xs text-stone-400">{user.name}</p>
              </div>
            </div>
            <div className="py-1">
              {sections.map((s) => (
                <Link
                  key={s.key}
                  to={`/dashboard?tab=${s.key}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-200 hover:bg-gold-400/10 hover:text-gold-100"
                >
                  <span>{s.icon}</span> {s.label}
                </Link>
              ))}
              {store && (
                <a
                  href={`/store/${store.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-200 hover:bg-gold-400/10 hover:text-gold-100"
                >
                  🔗 {t('dashboard.viewPublicStore')}
                </a>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10"
              >
                🚪 {t('nav.logout')}
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

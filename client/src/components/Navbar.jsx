import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { CartIcon, HeartIcon } from './icons.jsx';

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
  const { user, logout } = useAuth();
  const { count, setOpen } = useCart();
  const { count: wishCount } = useWishlist();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50">
      <nav className="glass-strong mx-auto mt-4 flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 text-lg text-ink-950 shadow-gold">
            👑
          </span>
          <span className="font-display text-lg font-bold gradient-text">{t('app.name')}</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <NavLink to="/" className="hidden rounded-lg px-3 py-1.5 text-sm text-stone-300 hover:text-gold-200 sm:block">
            {t('nav.home')}
          </NavLink>

          {/* المفضّلة */}
          <Link to="/wishlist" className="relative rounded-lg p-2 text-stone-300 hover:text-gold-200" title={t('nav.wishlist')}>
            <HeartIcon className="h-5 w-5" />
            {wishCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-ink-950">
                {wishCount}
              </span>
            )}
          </Link>

          {/* السلة */}
          <button onClick={() => setOpen(true)} className="relative rounded-lg p-2 text-stone-300 hover:text-gold-200" title={t('nav.cart')}>
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-ink-950">
                {count}
              </span>
            )}
          </button>

          {user ? (
            <>
              <Link to="/dashboard" className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-stone-200 hover:text-gold-200" title={t('nav.dashboard')}>
                <Avatar user={user} />
                <span className="hidden max-w-24 truncate sm:block">{user.name}</span>
              </Link>
              <button onClick={handleLogout} className="btn-ghost !px-3 !py-1.5 text-sm">
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="rounded-lg px-3 py-1.5 text-sm text-stone-200 hover:text-gold-200">
                {t('nav.login')}
              </NavLink>
              <Link to="/register" className="btn-primary !px-4 !py-1.5 text-sm">
                {t('nav.register')}
              </Link>
            </>
          )}

          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}

import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import api from '../api/client.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import { CartIcon, HeartIcon, MenuIcon, UserIcon, SearchIcon, MailIcon, InstagramIcon, GridIcon, StoreIcon, BagIcon, ReceiptIcon, UsersIcon, TicketIcon, ChartIcon, BellIcon, MegaphoneIcon, GearIcon } from './icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import NavBell from './NavBell.jsx';
import CloseButton from './CloseButton.jsx';
import { isStandalone } from '../utils/pwa.js';
import CatThumb from './CatThumb.jsx';
import { cldThumb } from '../utils/cloudinary.js';

// هوية الحساب أينما ظهرت (زرّ الشريط · القائمة المنبثقة · القائمة الجانبية):
// صورة الحساب إن وُجدت، وإلا شعار المتجر (للمشترك لا للمدير)، وإلا أول حرف الاسم.
// مصدر واحد للترتيب والشكل — كان زرّ الشريط يعرض الحرف بينما القائمة الجانبية
// تعرض شعار المتجر، فيبدوان هويتين مختلفتين لنفس الحساب.
function Avatar({ user, store, size = 'h-8 w-8' }) {
  if (user?.avatarUrl) {
    return <img src={cldThumb(user.avatarUrl, 140)} alt={user.name} loading="eager" decoding="async" className={`${size} rounded-full border border-gold-400/40 object-cover`} />;
  }
  if (store?.logoUrl) {
    // الشعار غالباً مربّع بهوامش — object-contain كي لا تُقصّ أطرافه داخل الدائرة
    return <img src={cldThumb(store.logoUrl, 140)} alt={store.name} loading="eager" decoding="async" className={`${size} rounded-full border border-gold-400/40 bg-cream/10 object-contain p-[3px]`} />;
  }
  const initial = user?.name?.trim()?.[0] || <UserIcon className="h-5 w-5" />;
  return (
    <span className={`${size} flex items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/15 text-sm font-bold text-gold-200`}>
      {initial}
    </span>
  );
}

// صفّ رابط داخل قائمة الحساب — بلاطة أيقونة ملوّنة أنيقة
function MenuRow({ to, onClick, Icon, label, danger }) {
  return (
    <Link to={to} onClick={onClick} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition ${danger ? 'text-red-600 hover:bg-red-500/10' : 'text-wine hover:bg-wine/5'}`}>
      <Icon className={`h-[17px] w-[17px] shrink-0 ${danger ? '' : 'text-wine/60'}`} /> {label}
    </Link>
  );
}

// قائمة الحساب المنبثقة من الأفاتار — مدمجة وأنيقة: هوية مصغّرة + حالة + روابط + خروج
function AccountMenu({ user, store, subscription, isAdmin, onClose, onLogout }) {
  const { t } = useTranslation();
  const active = subscription?.active;
  const days = subscription?.daysRemaining;
  const pill = isAdmin
    ? { cls: 'bg-gold-400/15 text-gold-300', text: t('nav.adminRole') }
    : active
      ? days != null && days <= 5
        ? { cls: 'bg-orange-400/15 text-orange-500', text: t('subscription.daysLeft', { count: days }) }
        : { cls: 'bg-emerald-500/15 text-emerald-600', text: t('subscription.active') }
      : { cls: 'bg-red-500/15 text-red-600', text: t('subscription.expired') };

  return (
    <>
      {/* خلفية شفافة تُغلق القائمة بالضغط خارجها */}
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div className="absolute end-0 top-[calc(100%+8px)] z-[60] w-[13rem] max-w-[72vw] origin-top-end animate-pop overflow-hidden rounded-2xl border border-gold-400/30 bg-white text-wine shadow-[0_16px_40px_-10px_rgba(94,70,54,0.45)]">
        {/* رأس فخم بتدرّج خمري + لمعة ذهبية */}
        <div className="relative overflow-hidden bg-gradient-to-br from-wine to-wine-dark px-3 py-3 text-cream">
          <span aria-hidden className="pointer-events-none absolute -end-5 -top-6 h-16 w-16 rounded-full bg-gold-400/25 blur-2xl" />
          <div className="relative flex items-center gap-2.5">
            <span className="shrink-0 rounded-full p-[2px] ring-1 ring-gold-300/60"><Avatar user={user} store={isAdmin ? null : store} size="h-9 w-9" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-cream">{user.name}</p>
              <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold ${pill.cls}`}>
                <span className="h-1 w-1 rounded-full bg-current" /> {pill.text}
              </span>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-gold-400/45 to-transparent" />

        <div className="p-1.5">
          {!isAdmin && store?.slug && <MenuRow to={`/store/${store.slug}`} onClick={onClose} Icon={StoreIcon} label={t('nav.openStore')} />}
          {isAdmin && <MenuRow to="/shop" onClick={onClose} Icon={StoreIcon} label={t('nav.home')} />}
          <MenuRow to="/dashboard" onClick={onClose} Icon={GridIcon} label={t('dashboard.title')} />
          <div className="my-1 h-px bg-wine/10" />
          <button
            onClick={() => { onClose(); onLogout(); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-bold text-red-600 transition hover:bg-red-500/10"
          >
            <LogoutIcon className="h-[17px] w-[17px] shrink-0" /> {t('nav.logout')}
          </button>
        </div>
      </div>
    </>
  );
}

const CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

// أيقونات خطّية أنيقة لقائمة الحساب (بديل الإيموجي).
// معظمها موحّد الآن باستيراد من icons.jsx — هنا فقط ما لا مقابل له فيه.
const I = (p) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p });
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
  const { count: wishCount, setOpen: setWishOpen } = useWishlist();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false); // قائمة الحساب المنبثقة (من الأفاتار)
  const [scrolled, setScrolled] = useState(false);
  const [noAnim, setNoAnim] = useState(false); // إلغاء حركة الهيدر لحظة تغيّر الصفحة
  const [newOrders, setNewOrders] = useState(0); // شارة الطلبات الجديدة داخل قائمة الحساب
  const [stockReady, setStockReady] = useState(0); // شارة طلبات التوفّر التي رجعت متوفّرة

  // نجلب عدد الطلبات الجديدة عند فتح القائمة → نُظهر شارة على "الطلبات" ليعرف المالك مصدر الإشعار
  useEffect(() => {
    if (!user || !store?.slug || subscription?.isAdmin) return undefined;
    const load = () => {
      api.get('/orders/new-count').then((r) => setNewOrders(r.data.count || 0)).catch(() => {});
      // طلبات التوفّر الجاهزة (رجعت متوفّرة) — شارة على تبويب "طلبات التوفّر"
      api.get('/stock-requests/counts').then((r) => setStockReady(r.data.ready || 0)).catch(() => {});
    };
    if (menuOpen) load();
    // تحديث فوري عند تأكيد/شحن طلب — الشارة تنقص مباشرةً بلا انتظار
    window.addEventListener('bz:orders-changed', load);
    return () => window.removeEventListener('bz:orders-changed', load);
  }, [menuOpen, user, store?.slug, subscription?.isAdmin]);
  useScrollLock(menuOpen); // تجميد الخلفية عند فتح قائمة الحساب

  // عند التمرير: الشريط يلتصق بالأعلى بعرض كامل (بلا فراغ علوي) — وفوق يبقى طافياً.
  // صف البحث تحت الشعار ينكمش عند النزول (زي هيدر متاجر المشتركين تماماً).
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        // قفل تمرير مفتوح (درج/نافذة)؟ لا نغيّر الحالة — وإلا "يقفز" الهيدر خلف الدرج
        if (document.body.style.position === 'fixed') { ticking = false; return; }
        setScrolled((prev) => (prev ? window.scrollY > 10 : window.scrollY > 40));
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // عند تغيّر الصفحة (خاصةً الرجوع مع استعادة موضع التمرير): الصفحة الجديدة تبدأ من 0
  // ثم يُستعاد الموضع، فكان الهيدر ينفرد ثم ينطوي بحركة 300ms أمام الزائر ("يتشكّل").
  // نلغي الحركة لنافذة قصيرة، فيتّخذ شكله النهائي فوراً ويبقى ثابتاً بصرياً.
  useLayoutEffect(() => {
    setNoAnim(true);
    const id = setTimeout(() => setNoAnim(false), 450);
    return () => clearTimeout(id);
  }, [pathname, search]);

  // صف البحث الشامل يظهر بصفحات التصفّح فقط (قائمة بيضاء) — كان يظهر بأماكن خاطئة
  // كالريلز وصفحة المنتج ويغطّي المحتوى أو يزاحمه
  const showSearchRow =
    pathname === '/' || pathname === '/shop' || pathname === '/categories' ||
    pathname.startsWith('/category/') || pathname === '/offers';

  // الشريط الخمري الفاخر على كل الموقع
  const standalone = isStandalone(); // داخل التطبيق المثبّت: الدخول من شاشة الترحيب فقط
  const isAdmin = subscription?.isAdmin;

  const handleLogout = () => {
    setMenuOpen(false);
    logout(); // يُفرِغ الجلسة محلياً فوراً (نداء الخادم بالخلفية) — لا ننتظره
    // بعد الخروج نذهب للصفحة العامة (بازارا) صراحةً — /shop تعرض الرئيسية العامة في
    // المتصفّح والتطبيق المثبّت معاً (بينما '/' في المثبّت تعرض شاشة الترحيب). replace كي
    // لا تبقى الصفحة المحمية "ميتة" في التاريخ. هكذا لا يعلق المشترك السابق داخل متجره.
    navigate('/shop', { replace: true });
  };

  // أقسام لوحة التحكم (تظهر في قائمة المستخدم) — المدير: تحكّم فقط بلا بيع
  const sections = isAdmin
    ? [
        { key: 'adminOverview', label: t('admin.ov.nav'), Icon: ChartIcon },
        { key: 'subscribers', label: t('admin.subscribersNav'), Icon: UsersIcon },
        { key: 'admin', label: t('admin.nav'), Icon: ShieldCheckIcon },
        { key: 'siteSliders', label: t('admin.siteSliders'), Icon: GridIcon },
        { key: 'newsletter', label: t('admin.newsletter'), Icon: MailIcon },
        { key: 'broadcast', label: t('admin.bc.nav'), Icon: MailIcon },
        { key: 'profile', label: t('dashboard.profile'), Icon: UserIcon },
      ]
    : [
        { key: 'overview', label: t('dashboard.overview'), Icon: GridIcon },
        { key: 'analytics', label: t('dashboard.analytics.title'), Icon: ChartIcon },
        { key: 'profile', label: t('dashboard.profile'), Icon: UserIcon },
        { key: 'storeSettings', label: t('dashboard.storeSettings'), Icon: GearIcon },
        { key: 'myProducts', label: t('dashboard.myProducts'), Icon: BagIcon },
        { key: 'instagram', label: t('dashboard.instagram.title'), Icon: InstagramIcon },
        { key: 'myOrders', label: t('dashboard.myOrders'), Icon: ReceiptIcon },
        { key: 'coupons', label: t('dashboard.coupons.title'), Icon: TicketIcon },
        { key: 'referrals', label: t('dashboard.referrals.title'), Icon: UserIcon },
        { key: 'campaign', label: t('campaign.title'), Icon: MegaphoneIcon },
        { key: 'stockRequests', label: t('dashboard.stockRequests.title'), Icon: BellIcon },
      ];

  return (
    <header className="sticky top-0 z-50">
      <nav
        className={`app-navbar relative flex w-full justify-center px-3 py-2.5 sm:px-6 ${noAnim ? 'transition-none' : 'transition-shadow duration-300'} ${scrolled ? 'shadow-md' : ''}`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)' }}
      >
        <div className="w-full max-w-6xl">
        <div className="relative flex h-12 w-full items-center justify-between">
          {/* القائمة + الوضع الليلي — جهة البداية (اليمين في العربية، اليسار في الإنجليزية) */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-wine shadow-sm ring-1 ring-wine/10 transition hover:bg-wine hover:text-cream"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <ThemeToggle className="rounded-full text-wine hover:bg-wine/10" />
            {/* أيقونة البحث تظهر فقط بالهيدر المدمج (بعد النزول) — وفوق تكون خانة البحث كاملة ظاهرة */}
            {scrolled && showSearchRow && (
              <Link to="/search" className="animate-fade-in rounded-full p-2 text-wine transition hover:bg-wine/10" title={t('searchPage.title')} aria-label={t('searchPage.title')}>
                <SearchIcon className="h-[21px] w-[21px]" />
              </Link>
            )}
          </div>

          {/* الشعار بالنص (في المنتصف تماماً) */}
          <Link
            to={user ? '/dashboard' : '/'}
            onClick={() => { if (pathname === (user ? '/dashboard' : '/')) window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="absolute start-1/2 flex -translate-x-1/2 flex-col items-center leading-none rtl:translate-x-1/2"
          >
            <span className="font-display text-2xl font-extrabold tracking-wide text-wine sm:text-[28px]">Bazara</span>
            <span className="mt-1 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.35em] text-wine/45">
              <span className="h-px w-4 bg-wine/25" /> بازارا <span className="h-px w-4 bg-wine/25" />
            </span>
          </Link>

          {/* أيقونات التسوّق — جهة النهاية. المدير لا يحتاج السلة/المفضلة */}
          <div className="flex items-center gap-0.5 sm:gap-1.5">
            {!isAdmin && (
              <>
                <button onClick={() => setWishOpen(true)} className="relative rounded-full p-2 text-wine transition hover:bg-wine/10" title={t('nav.wishlist')} aria-label={t('nav.wishlist')}>
                  <HeartIcon className="h-[22px] w-[22px]" />
                  {wishCount > 0 && (
                    <span className="absolute end-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-wine px-1 text-[10px] font-bold text-cream">{wishCount}</span>
                  )}
                </button>
                <button data-cart-target onClick={() => setOpen(true)} className="relative rounded-full p-2 text-wine transition hover:bg-wine/10" title={t('nav.cart')} aria-label={t('nav.cart')}>
                  <CartIcon className="h-[22px] w-[22px]" />
                  {count > 0 && (
                    <span className="absolute end-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-wine px-1 text-[10px] font-bold text-cream">{count}</span>
                  )}
                </button>
              </>
            )}

            {/* الحساب: أفاتار شخصي بقائمة منبثقة (للمسجّل) أو رابط دخول (للزائر) */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setAcctOpen((o) => !o)}
                  className="flex items-center justify-center rounded-full ring-2 ring-transparent transition hover:ring-wine/20"
                  title={t('nav.account')}
                  aria-label={t('nav.account')}
                  aria-expanded={acctOpen}
                >
                  <Avatar user={user} store={subscription?.isAdmin ? null : store} size="h-9 w-9" />
                </button>
                {acctOpen && (
                  <AccountMenu
                    user={user}
                    store={store}
                    subscription={subscription}
                    isAdmin={isAdmin}
                    onClose={() => setAcctOpen(false)}
                    onLogout={handleLogout}
                  />
                )}
              </div>
            ) : (
              <Link to="/login" className="rounded-full p-2 text-wine transition hover:bg-wine/10" title={t('nav.account')} aria-label={t('nav.account')}>
                <UserIcon className="h-[22px] w-[22px]" />
              </Link>
            )}
          </div>
        </div>

        {/* خانة البحث الشامل تحت الشعار — تنكمش بنعومة عند النزول (زي هيدر متاجر المشتركين) */}
        {showSearchRow && (
          <div className={`overflow-hidden ${noAnim ? 'transition-none' : 'transition-all duration-300 ease-out'} ${scrolled ? 'max-h-0 opacity-0' : 'max-h-14 pt-2 opacity-100'}`}>
            <Link
              to="/search"
              className="flex items-center gap-2.5 rounded-full border border-wine/15 bg-white px-4 py-2.5 text-sm text-stone-400 shadow-[0_6px_18px_-12px_rgba(94,70,54,0.35)] transition active:scale-[0.99]"
            >
              <SearchIcon className="h-[18px] w-[18px] shrink-0 text-wine/60" /> {t('searchPage.placeholder')}
            </Link>
          </div>
        )}
        </div>
      </nav>

      {/* قائمة الحساب — درج جانبي أنيق (مثل درج المتجر) */}
      {user && menuOpen && (
        <div className="fixed inset-0 z-[70]">
          {/* خلفية معتّمة — تُغلق الدرج بالضغط خارجه */}
          <div className="absolute inset-0 bg-black/50 animate-fade-up" onClick={() => setMenuOpen(false)} />
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-y-0 start-0 flex w-[17.5rem] max-w-[80%] flex-col bg-wine-dark px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] text-cream shadow-2xl ${ltr ? 'animate-slide-in-left' : 'animate-slide-in'}`}
          >
            {/* أعلى: إغلاق + اللغة */}
            <div className="flex items-center justify-between">
              <CloseButton onClick={() => setMenuOpen(false)} variant="cream" size="h-10 w-10" />
              <LanguageSwitcher onChanged={() => setMenuOpen(false)} />
            </div>

            {/* الهوية — المدير يظهر باسمه وصورته (حساب تحكّم) */}
            <div className="mt-5 flex items-center gap-3 border-b border-cream/15 pb-4">
              {/* نفس مكوّن الهوية المستخدم بزرّ الشريط — فلا يختلف الشعار بين الاثنين */}
              <Avatar user={user} store={isAdmin ? null : store} size="h-12 w-12" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-cream">
                  {isAdmin ? user.name : store?.name || t('app.name')}
                </p>
                <p className="truncate text-xs text-cream/60">{isAdmin ? user.email : user.name}</p>
              </div>
            </div>

            {/* الروابط — تأخذ المساحة وتتمرّر داخلياً. بطاقة الإشعارات أول عنصر داخل
                منطقة التمرير (لا ثابتة) حتى لا تسرق مساحة الأزرار السفلية */}
            <nav className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
              <NavBell variant="row" />
              {sections.map((s) => {
                const curTab = new URLSearchParams(search).get('tab') || (isAdmin ? 'adminOverview' : 'overview');
                const active = pathname.startsWith('/dashboard') && curTab === s.key;
                return (
                  <Link
                    key={s.key}
                    to={`/dashboard?tab=${s.key}`}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base transition ${active ? 'bg-cream/15 font-bold text-cream' : 'text-cream/85 hover:bg-cream/10 hover:text-cream'}`}
                  >
                    <s.Icon className="h-5 w-5 shrink-0 text-cream/80" />
                    <span className="flex-1">{s.label}</span>
                    {s.key === 'myOrders' && newOrders > 0 && (
                      <span className="relative flex h-6 min-w-6 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400/50" style={{ animationDuration: '1.8s' }} />
                        <span className="relative flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-extrabold text-wine-dark shadow-sm ring-1 ring-cream/50" style={{ background: 'linear-gradient(135deg, #f4e0a4 0%, #e6c878 55%, #d4af37 100%)' }}>{newOrders > 99 ? '99+' : newOrders}</span>
                      </span>
                    )}
                    {s.key === 'stockRequests' && stockReady > 0 && (
                      <span className="relative flex h-6 min-w-6 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" style={{ animationDuration: '1.8s' }} />
                        <span className="relative flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-extrabold text-white shadow-sm ring-1 ring-cream/50">{stockReady > 99 ? '99+' : stockReady}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* قائمة الزائر — تصفّح الفئات + روابط سريعة */}
      {!user && menuOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50 animate-fade-up" onClick={() => setMenuOpen(false)} />
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-y-0 start-0 flex w-[17.5rem] max-w-[80%] flex-col bg-wine-dark px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] text-cream shadow-2xl ${ltr ? 'animate-slide-in-left' : 'animate-slide-in'}`}
          >
            <div className="flex items-center justify-between">
              <CloseButton onClick={() => setMenuOpen(false)} variant="cream" size="h-10 w-10" />
              <LanguageSwitcher onChanged={() => setMenuOpen(false)} />
            </div>

            <Link to="/" onClick={() => setMenuOpen(false)} className="mt-5 font-display text-2xl font-extrabold tracking-wide text-cream">Bazara</Link>

            <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto">
              <Link to="/shop" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-base text-cream/90 transition hover:bg-cream/10 hover:text-cream"><GridIcon className="h-5 w-5 text-cream/80" /> {t('nav.home')}</Link>
              <div className="my-2 h-px bg-cream/15" />
              {CATS.map((c) => (
                <Link key={c} to={`/category/${c}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-base text-cream/85 transition hover:bg-cream/10 hover:text-cream">
                  <CatThumb cat={c} className="h-8 w-8" /> {t(`categories.${c}`)}
                </Link>
              ))}
              <div className="my-2 h-px bg-cream/15" />
              <button onClick={() => { setMenuOpen(false); setWishOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-base text-cream/90 transition hover:bg-cream/10 hover:text-cream"><HeartIcon className="h-5 w-5 text-cream/80" /> {t('nav.wishlist')}</button>
            </nav>

            {!standalone && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-xl border border-cream/30 py-2.5 text-center font-semibold text-cream transition hover:bg-cream/10">{t('nav.login')}</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="rounded-xl bg-cream py-2.5 text-center font-bold text-wine transition hover:bg-white">{t('nav.register')}</Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </header>
  );
}

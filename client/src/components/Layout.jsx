import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import CartDrawer from './CartDrawer.jsx';
import WishlistDrawer from './WishlistDrawer.jsx';
import CartReminder from './CartReminder.jsx';
import OfflineBanner from './OfflineBanner.jsx';
import BottomNav from './BottomNav.jsx';
import ScrollToTopButton from './ScrollToTopButton.jsx';
import PullToRefresh from './PullToRefresh.jsx';
import { isStandalone } from '../utils/pwa.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { WhatsAppIcon, InstagramIcon, FacebookIcon } from './icons.jsx';
import { BAZARA_WHATSAPP, BAZARA_INSTAGRAM, BAZARA_FACEBOOK } from '../config/site.js';

// الهوية الخمرية/العاجية الفاخرة مطبّقة على كل الموقع (متجر عام + لوحة تحكم لكل المشتركين).
export default function Layout({ children }) {
  const { pathname } = useLocation();
  // صفحات المتجر العامة لها هيدر وفوتر خاص بالمتجر بدل شريط/فوتر Bazara العام
  const isStorePage = /^\/store\//.test(pathname);
  // شاشة افتتاح التطبيق المثبّت (الجذر) — بلا شريط/فوتر ليبدو كتطبيق كامل
  const isAppWelcome = pathname === '/' && isStandalone();
  // صفحات الحساب — تصميم بملء الشاشة (هيرو + نموذج) بلا شريط/فوتر
  const isAuthFull = ['/login', '/register', '/forgot-password', '/reset'].includes(pathname);
  // الريلز = ملء الشاشة (كتيك توك) — الهيدر كان يظهر فوقها ويغطي المحتوى
  const isReels = pathname === '/reels';
  const hideChrome = isStorePage || isAppWelcome || isAuthFull || isReels;
  // شريط التنقّل السفلي يظهر داخل التطبيق المثبّت على كل الصفحات (بما فيها المتجر) عدا الترحيب/الدخول
  // الشريط السفلي يظهر على كل الأجهزة (جوال/آيباد/كمبيوتر) عدا شاشات الترحيب/الدخول
  const showBottomNav = !isAppWelcome && !isAuthFull;

  // إغلاق لوحة المفاتيح فور بدء التمرير (سحب الشاشة) — يمنع تعليق الشاشة والقفز
  // أثناء فتح أي شريط بحث، ويعطي إحساس التطبيقات الأصلية. يطبَّق على كل الموقع.
  useEffect(() => {
    const dismiss = () => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
          !['button', 'submit', 'checkbox', 'radio', 'range', 'file', 'color', 'image'].includes(el.type)) {
        el.blur();
      }
    };
    window.addEventListener('touchmove', dismiss, { passive: true });
    window.addEventListener('wheel', dismiss, { passive: true });
    return () => { window.removeEventListener('touchmove', dismiss); window.removeEventListener('wheel', dismiss); };
  }, []);

  return (
    <div className="app-bg theme-pub flex min-h-screen flex-col">
      <PullToRefresh />
      {!hideChrome && <Navbar />}
      <main className={`mx-auto w-full max-w-6xl flex-1 px-4 pt-5 sm:px-6 ${showBottomNav ? 'pb-bottomnav' : 'pb-8'}`}>{children}</main>
      {!hideChrome && !showBottomNav && <PublicFooter />}
      <CartDrawer />
      <WishlistDrawer />
      {/* لا نُظهر تذكير السلة على صفحات الحساب/الترحيب (يغطّي النموذج) */}
      {!isAuthFull && !isAppWelcome && <CartReminder />}
      <OfflineBanner />
      {!isReels && <ScrollToTopButton />}
      {showBottomNav && <BottomNav />}
    </div>
  );
}

function PublicFooter() {
  const { t } = useTranslation();
  return (
    <footer className="pub-footer mt-12">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 text-center sm:px-6">
        <Link to="/" className="font-display text-2xl font-bold tracking-wide text-cream">
          {t('app.name')}
        </Link>
        <p className="mt-2 text-sm text-cream/70">{t('app.tagline')}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          {[
            BAZARA_WHATSAPP && { label: 'WhatsApp', href: buildWhatsappLink(BAZARA_WHATSAPP), icon: <WhatsAppIcon className="h-5 w-5" /> },
            BAZARA_INSTAGRAM && { label: 'Instagram', href: `https://instagram.com/${BAZARA_INSTAGRAM.replace(/^@/, '')}`, icon: <InstagramIcon className="h-5 w-5" /> },
            BAZARA_FACEBOOK && {
              label: 'Facebook',
              href: /^https?:\/\//.test(BAZARA_FACEBOOK) ? BAZARA_FACEBOOK : `https://facebook.com/${BAZARA_FACEBOOK.replace(/^@/, '')}`,
              icon: <FacebookIcon className="h-5 w-5" />,
            },
          ]
            .filter(Boolean)
            .map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/25 text-cream/90 transition hover:bg-cream/10"
              >
                {s.icon}
              </a>
            ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-cream/80">
          <Link to="/track" className="hover:text-cream">{t('nav.track')}</Link>
          <span className="text-cream/30">•</span>
          <Link to="/wishlist" className="hover:text-cream">{t('nav.wishlist')}</Link>
          <span className="text-cream/30">•</span>
          <Link to="/" className="hover:text-cream">{t('nav.home')}</Link>
        </div>

        <div className="mx-auto mt-7 h-px max-w-md bg-cream/15" />
        <p className="mt-5 text-xs text-cream/60">
          © {new Date().getFullYear()} {t('app.name')} — {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}


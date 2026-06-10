import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import CartDrawer from './CartDrawer.jsx';
import OfflineBanner from './OfflineBanner.jsx';
import BottomNav from './BottomNav.jsx';
import { isStandalone } from '../utils/pwa.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { BAZARA_WHATSAPP, BAZARA_INSTAGRAM, BAZARA_FACEBOOK } from '../config/site.js';

// الهوية الخمرية/العاجية الفاخرة مطبّقة على كل الموقع (متجر عام + لوحة تحكم لكل المشتركين).
export default function Layout({ children }) {
  const { pathname } = useLocation();
  // صفحات المتجر العامة لها هيدر وفوتر خاص بالمتجر بدل شريط/فوتر Bazara العام
  const isStorePage = /^\/store\//.test(pathname);
  // شاشة افتتاح التطبيق المثبّت (الجذر) — بلا شريط/فوتر ليبدو كتطبيق كامل
  const isAppWelcome = pathname === '/' && isStandalone();
  // صفحة تسجيل الدخول — تصميم بملء الشاشة (هيرو + نموذج) بلا شريط/فوتر
  const isAuthFull = pathname === '/login';
  const hideChrome = isStorePage || isAppWelcome || isAuthFull;
  // شريط التنقّل السفلي يظهر داخل التطبيق المثبّت فقط (وليس على شاشة الترحيب أو المتجر أو الدخول)
  const showBottomNav = isStandalone() && !isAppWelcome && !isStorePage && !isAuthFull;

  return (
    <div className="app-bg theme-pub flex min-h-screen flex-col">
      {!hideChrome && <Navbar />}
      <main className={`mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 ${showBottomNav ? 'pb-24' : ''}`}>{children}</main>
      {!hideChrome && !showBottomNav && <PublicFooter />}
      <CartDrawer />
      <OfflineBanner />
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
            BAZARA_WHATSAPP && { label: 'WhatsApp', href: buildWhatsappLink(BAZARA_WHATSAPP), icon: <WhatsAppGlyph /> },
            BAZARA_INSTAGRAM && { label: 'Instagram', href: `https://instagram.com/${BAZARA_INSTAGRAM.replace(/^@/, '')}`, icon: <InstagramGlyph /> },
            BAZARA_FACEBOOK && {
              label: 'Facebook',
              href: /^https?:\/\//.test(BAZARA_FACEBOOK) ? BAZARA_FACEBOOK : `https://facebook.com/${BAZARA_FACEBOOK.replace(/^@/, '')}`,
              icon: <FacebookGlyph />,
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

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6v1.9H16l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}
function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648 3.973-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}

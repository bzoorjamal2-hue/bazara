import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from './Logo.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

// شاشة افتتاح التطبيق المثبّت (standalone) — تصميم أنيق فخم بألوان Bazara.
// تظهر فقط داخل التطبيق؛ الموقع في المتصفح يبقى كما هو.
export default function AppWelcome() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-wine-dark text-cream">
      {/* توهّجات خلفية ناعمة */}
      <div className="pointer-events-none absolute -top-24 start-1/4 h-72 w-72 animate-float rounded-full bg-cream/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 end-0 h-80 w-80 rounded-full bg-[#7a2238]/40 blur-3xl" />

      {/* شريط علوي بسيط */}
      <div className="relative flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
        <LanguageSwitcher />
        <span className="font-display text-sm tracking-[0.3em] text-cream/60">ELEGANCE</span>
      </div>

      {/* المنتصف: الشعار + الاسم */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-cream/10 blur-2xl" />
          <Logo className="h-28 w-28 drop-shadow-2xl sm:h-32 sm:w-32" />
        </div>
        <h1 className="mt-7 font-display text-4xl font-extrabold tracking-wide text-cream sm:text-5xl">Bazara</h1>
        <p className="mt-3 font-display text-lg text-cream/85 sm:text-xl">{t('app.tagline')}</p>
        <p className="mt-1 text-xs tracking-[0.25em] text-cream/45">ELEGANCE · MODESTY · DISTINCTION</p>
      </div>

      {/* الأزرار */}
      <div className="relative space-y-3 px-7 pb-[max(env(safe-area-inset-bottom),28px)]">
        <Link
          to="/shop"
          className="block w-full rounded-2xl bg-cream py-4 text-center font-bold text-wine shadow-xl transition active:scale-[0.98]"
        >
          🛍️ {t('appWelcome.browse')}
        </Link>
        <Link
          to="/login"
          className="block w-full rounded-2xl border border-cream/35 py-3.5 text-center font-semibold text-cream transition hover:bg-cream/10 active:scale-[0.98]"
        >
          {t('nav.login')}
        </Link>
        <Link to="/register" className="block pt-1 text-center text-sm text-cream/75 transition hover:text-cream">
          {t('appWelcome.openStore')} ←
        </Link>
      </div>
    </div>
  );
}

import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Logo from './Logo.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

// ===== أيقونات الحقول =====
export function MailIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}
export function LockIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}
export function EyeIcon({ off, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m3 3 18 18" />}
    </svg>
  );
}
export function UserIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
export function ShopIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h16l-1-4H5L4 9Z" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M9 20v-5h6v5" />
    </svg>
  );
}
export function PhoneIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L17 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z" />
    </svg>
  );
}
export function KeyIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l2 2M14 9l2 2" />
    </svg>
  );
}

// حقل بأيقونة بادئة وعنصر لاحق اختياري (مثل زر إظهار كلمة المرور)
export const Field = forwardRef(function Field({ icon, trailing, className = '', ...props }, ref) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-wine/45">{icon}</span>
      )}
      <input
        ref={ref}
        className={`input !rounded-2xl !py-4 !text-base ${icon ? '!ps-12' : ''} ${trailing ? '!pe-12' : ''} ${className}`}
        {...props}
      />
      {trailing && <div className="absolute inset-y-0 end-3 flex items-center">{trailing}</div>}
    </div>
  );
});

// بلا حركة دخول للعناصر — الصفحة كلها تظهر بتلاشٍ واحد ناعم عبر انتقال المسار،
// فلا يوجد أي حركة لكل عنصر قد تتعارض وتسبب "القفز/الفصل".
const rise = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
};
export { rise };

// قشرة موحّدة لصفحات الحساب: شريط علوي + هيرو بنّي بالشعار + عنوان/وصف + المحتوى
export default function AuthShell({ title, subtitle, children, back = '/', compactHero = false }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  return (
    <div className="mx-auto -my-8 flex min-h-[calc(100vh-1px)] w-full max-w-md flex-col">
      {/* شريط علوي: رجوع + اللغة */}
      <div className="flex items-center justify-between py-4">
        <Link
          to={back}
          aria-label={t('common.back')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine/20"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
          </svg>
        </Link>
        <LanguageSwitcher />
      </div>

      {/* الهيرو */}
      <motion.div
        custom={0}
        variants={rise}
        initial="hidden"
        animate="show"
        className={`pub-hero relative overflow-hidden rounded-3xl px-6 text-center shadow-lg ${compactHero ? 'py-6' : 'py-9'}`}
      >
        <div className="pointer-events-none absolute -top-10 start-1/3 h-40 w-40 rounded-full bg-cream/10 blur-3xl" />
        <div className="relative mx-auto inline-block">
          <motion.div
            className="absolute inset-[-14px] -z-0 rounded-full"
            style={{ background: 'conic-gradient(from 0deg, transparent, rgba(212,175,55,0.5), transparent 60%)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative rounded-full bg-wine-dark/30 p-1">
            <Logo className={compactHero ? 'h-16 w-16 drop-shadow-xl' : 'h-20 w-20 drop-shadow-xl'} />
          </div>
        </div>
        <h1
          className={`mt-4 font-display font-extrabold ${compactHero ? 'text-3xl' : 'text-4xl'}`}
          style={{ background: 'linear-gradient(180deg,#f7ecd2 0%,#e6c878 70%,#d4af37 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
        >
          Bazara
        </h1>
        <p className="mt-1 text-sm text-cream/85">{t('app.tagline')}</p>
      </motion.div>

      {/* المحتوى */}
      <div className="flex-1 px-1 pt-6">
        <motion.h2 custom={1} variants={rise} initial="hidden" animate="show" className="mb-1 font-display text-xl font-bold text-wine">
          {title}
        </motion.h2>
        {subtitle && (
          <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="mb-5 text-sm text-stone-400">
            {subtitle}
          </motion.p>
        )}
        {children}
      </div>
    </div>
  );
}

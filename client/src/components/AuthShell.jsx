import { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { goBack } from '../utils/nav.js';
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

// حقل بأيقونة بادئة وعنصر لاحق اختياري (مثل زر إظهار كلمة المرور) — حبّي فاخر
export const Field = forwardRef(function Field({ icon, trailing, className = '', ...props }, ref) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-wine/45">{icon}</span>
      )}
      <input
        ref={ref}
        className={`input !rounded-full !py-4 !text-base ${icon ? '!ps-12' : ''} ${trailing ? '!pe-12' : ''} ${className}`}
        {...props}
      />
      {trailing && <div className="absolute inset-y-0 end-4 flex items-center">{trailing}</div>}
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

// قشرة موحّدة لصفحات الحساب — تصميم بوتيك فاخر:
// هيرو بنّي عميق بلمعة ذهبية (الرجوع/اللغة داخله) + بطاقة النموذج بيضاء "عائمة" فوقه
export default function AuthShell({ title, subtitle, children, back = '/', compactHero = false }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();
  return (
    // ملء الشاشة الحقيقي: نلغي حواف/حشوات غلاف الصفحة (px-4 pt-5 pb-8) بهوامش سالبة
    // فيمتد الهيرو البنّي من حافة لحافة وتطلع الصفحة البيضاء من تحته حتى أسفل الشاشة —
    // قطعة واحدة متصلة بلا أي إطار كريمي حولها.
    <div className="-mx-4 -mb-8 -mt-5 flex min-h-[100dvh] flex-col sm:-mx-6">
      {/* الهيرو الفاخر — من حافة الشاشة للحافة */}
      <motion.div
        custom={0}
        variants={rise}
        initial="hidden"
        animate="show"
        className={`dash-hero relative overflow-hidden rounded-none px-5 text-center ${compactHero ? 'pb-16' : 'pb-20'}`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.85rem)' }}
      >
        <div className="pointer-events-none absolute -top-10 start-1/3 h-44 w-44 rounded-full bg-[#e6c878]/15 blur-3xl" />

        <div className="mx-auto w-full max-w-md">
          {/* شريط علوي داخل الهيرو: رجوع + اللغة */}
          <div className="relative mb-3 flex items-center justify-between">
            {/* رجوع للصفحة السابقة الفعلية (والمسار الثابت احتياط عند الفتح المباشر) */}
            <button
              type="button"
              onClick={() => goBack(navigate, back)}
              aria-label={t('common.back')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4EDE2]/10 text-[#F4EDE2] ring-1 ring-[#e6c878]/30 transition hover:bg-[#F4EDE2]/20"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
              </svg>
            </button>
            <LanguageSwitcher />
          </div>

          {/* الشعار بحلقة ذهبية دوّارة */}
          <div className="relative mx-auto inline-block">
            <motion.div
              className="absolute inset-[-14px] -z-0 rounded-full"
              style={{ background: 'conic-gradient(from 0deg, transparent, rgba(212,175,55,0.55), transparent 60%)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative rounded-full bg-black/25 p-1 ring-1 ring-[#e6c878]/40">
              <Logo className={compactHero ? 'h-14 w-14 drop-shadow-xl' : 'h-20 w-20 drop-shadow-xl'} />
            </div>
          </div>
          <h1
            className={`mt-3 font-display font-extrabold ${compactHero ? 'text-3xl' : 'text-4xl'}`}
            style={{ background: 'linear-gradient(180deg,#f7ecd2 0%,#e6c878 70%,#d4af37 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
          >
            Bazara
          </h1>
          <p className="mt-1 text-sm text-[#F4EDE2]/85">{t('app.tagline')}</p>
          {/* زخرفة ماسية ذهبية */}
          <div className="mt-3 flex items-center justify-center gap-2 text-[#e6c878]/60">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#e6c878]/50" />
            <span aria-hidden className="text-[10px]">❖</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#e6c878]/50" />
          </div>
        </div>
      </motion.div>

      {/* الصفحة البيضاء تطلع فوق الهيرو وتمتد حتى أسفل الشاشة — قطعة واحدة */}
      <div
        className="relative z-10 -mt-12 flex-1 rounded-t-[2rem] bg-white px-5 pt-6 shadow-[0_-18px_44px_-26px_rgba(46,33,24,0.45)] sm:px-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.75rem)' }}
      >
        <span className="dash-hairline absolute inset-x-0 top-0" />
        <div className="mx-auto w-full max-w-md">
          <motion.h2 custom={1} variants={rise} initial="hidden" animate="show" className="mb-1 text-center font-display text-2xl font-bold text-wine">
            {title}
          </motion.h2>
          {subtitle && (
            <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="mb-5 text-center text-sm text-stone-400">
              {subtitle}
            </motion.p>
          )}
          {!subtitle && <div className="mb-4" />}
          {children}
        </div>
      </div>
    </div>
  );
}

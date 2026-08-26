import { forwardRef, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
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

// ───────────────── حقل بتسمية وتلميح ─────────────────
//
// كانت الحقول نائبَ نصٍّ (placeholder) وحده: يختفي أوّل ما تكتب، فتنسى صاحبة
// المتجر ما هذا الحقل وهي بمنتصف تعبئته — وأسوأ منه أن ما لا تعرفه (صيغة
// الهاتف، ما اسم المتجر أصلاً) لا مكان يقوله. صار لكلّ حقل تسمية ثابتة فوقه
// وتلميحٌ تحته عند الحاجة.
export const Field = forwardRef(function Field(
  { icon, trailing, label, hint, error, required, className = '', id, ...props },
  ref
) {
  const auto = useId();
  const inputId = id || auto;
  const hintId = hint || error ? `${inputId}-h` : undefined;
  return (
    <div className="bz-af">
      {label && (
        <label htmlFor={inputId} className="bz-af-label">
          {label}
          {required && <span className="bz-af-req" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="bz-af-box">
        {icon && <span className="bz-af-ico" aria-hidden="true">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          className={`bz-af-input ${icon ? 'has-ico' : ''} ${trailing ? 'has-trail' : ''} ${className}`}
          {...props}
        />
        {trailing && <span className="bz-af-trail">{trailing}</span>}
      </div>
      {(hint || error) && (
        <p id={hintId} className={error ? 'bz-af-err' : 'bz-af-hint'}>{error || hint}</p>
      )}
    </div>
  );
});

// بلا حركة دخول لكل عنصر — الصفحة تظهر بتلاشٍ واحد عبر انتقال المسار
const rise = { hidden: { opacity: 1 }, show: { opacity: 1 } };
export { rise };

// ───────────────── قشرة صفحات الحساب ─────────────────
//
// كانت هيرو بنّياً بحلقةٍ ذهبية دوّارة ونصٍّ متدرّج، تحته ورقة بيضاء — وعلى
// الكمبيوتر عمودٌ ضيّق وسط فراغٍ واسع.
//
// صارت بهوية صفحة المنصّة نفسها: إسبريسو عميق وذهبٌ أثرٌ لا حشوة. وعلى
// الشاشات الواسعة لوحان — لوحُ هويةٍ يحمل الصورة والوعد، وإلى جانبه النموذج
// — فيُستعمل عرض الشاشة بدل أن يُهدر.
export default function AuthShell({ title, subtitle, children, back = '/', compactHero = false }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();

  // خلفية لوح الهوية: نفس صورة الهيرو التي يضعها المدير — فتتّسق الصفحتان
  // مع الواجهة بلا إعدادٍ ثانٍ.
  const [bg, setBg] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('bz_landing') || 'null')?.landing?.hero || null; } catch { return null; }
  });
  useEffect(() => {
    if (bg) return;
    api.get('/public/site-info')
      .then((r) => setBg(r.data?.landing?.hero || {}))
      .catch(() => { /* التدرّج وحده يكفي */ });
  }, [bg]);

  const ticks = [t('landing.chip1'), t('landing.chip2'), t('landing.chip3')];

  return (
    <div className="bz-auth" style={{ '--bz-dim': (bg?.dim ?? 62) / 100 }}>
      {/* ── لوح الهوية ── */}
      <aside className="bz-auth-brand">
        {bg?.image && <span className="bz-auth-img" style={{ backgroundImage: `url(${bg.image})` }} aria-hidden="true" />}
        <span className="bz-hero-veil" aria-hidden="true" />

        <div className="bz-auth-brand-in">
          <div className="bz-auth-top">
            <button
              type="button"
              // وجهةٌ ثابتة لا رجوعٌ بالتاريخ: كان navigate(-1) يعيد الزائرة
              // إلى الصفحة السابقة — وهي غالباً لوحةُ المتجر الذي خرجت منه
              // للتوّ. فيبدو الخروج كأنّه لم يحدث. الزرّ يعني «الرئيسية» فليذهب
              // إليها. وreplace كي لا يعيدها زرّ رجوع المتصفّح إلى الدخول.
              onClick={() => navigate(back, { replace: true })}
              aria-label={t('common.back')}
              className="bz-nav-burger"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
              </svg>
            </button>
            <LanguageSwitcher />
          </div>

          <div className="bz-auth-brand-body">
            <Logo className={`bz-auth-logo ${compactHero ? 'h-14 w-14' : 'h-16 w-16'}`} />
            <p className="bz-auth-name">{t('app.name')}</p>
            <p className="bz-auth-tag">{t('app.tagline')}</p>

            {/* الوعد وعلامات الثقة — تظهران على الشاشات الواسعة حيث المساحة */}
            <p className="bz-auth-promise">{t('landing.title')}</p>
            <ul className="bz-auth-ticks">
              {ticks.filter(Boolean).map((x) => (
                <li key={x}><span className="bz-tick-b"><CheckGlyph /></span>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* ── لوح النموذج ── */}
      <main className="bz-auth-form">
        <div className="bz-auth-card">
          <h1 className="bz-auth-title">{title}</h1>
          {subtitle && <p className="bz-auth-sub">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

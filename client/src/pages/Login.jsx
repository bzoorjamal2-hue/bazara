import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

// أيقونات صغيرة داخل الحقول
function MailIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}
function LockIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}
function EyeIcon({ off, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m3 3 18 18" />}
    </svg>
  );
}

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.06 * i, type: 'spring', stiffness: 110, damping: 18 } }),
};

export default function Login() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const { login, loginWithCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.registered;
  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsCode, setNeedsCode] = useState(false); // اشتراك منتهٍ: يطلب كود التجديد
  const [code, setCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const emailRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const email = (form.email || emailRef.current?.value || '').trim();
    if (!email || !form.password) {
      setError(t('errors.invalidEmail'));
      return;
    }
    setBusy(true);
    try {
      const data = await login(email, form.password);
      if (data?.subscription && !data.subscription.active) navigate('/subscribe');
      else navigate('/dashboard');
    } catch (err) {
      if (err?.response?.status === 403 && err?.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setNeedsCode(true);
        setError('');
      } else {
        setError(getErrorMessage(err, t('errors.generic')));
      }
    } finally {
      setBusy(false);
    }
  };

  const renew = async (e) => {
    e.preventDefault();
    setError('');
    const email = (form.email || emailRef.current?.value || '').trim();
    if (!code.trim()) { setError(t('subscription.enterCode')); return; }
    setBusy(true);
    try {
      await loginWithCode(email, form.password, code.trim());
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto -my-8 flex min-h-[calc(100vh-1px)] w-full max-w-md flex-col">
      <Seo title={t('auth.loginTitle')} />

      {/* شريط علوي: رجوع + اللغة */}
      <div className="flex items-center justify-between py-4">
        <Link
          to="/"
          aria-label={t('common.back')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine/20"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
          </svg>
        </Link>
        <LanguageSwitcher />
      </div>

      {/* الهيرو: شعار + اسم + تاغلاين على تدرّج بنّي فاخر */}
      <motion.div
        custom={0}
        variants={rise}
        initial="hidden"
        animate="show"
        className="pub-hero relative overflow-hidden rounded-3xl px-6 py-9 text-center shadow-lg"
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
            <Logo className="h-20 w-20 drop-shadow-xl" />
          </div>
        </div>
        <h1
          className="mt-4 font-display text-4xl font-extrabold"
          style={{ background: 'linear-gradient(180deg,#f7ecd2 0%,#e6c878 70%,#d4af37 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
        >
          Bazara
        </h1>
        <p className="mt-1 text-sm text-cream/85">{t('app.tagline')}</p>
      </motion.div>

      {/* النموذج */}
      <div className="flex-1 px-1 pt-6">
        <motion.h2 custom={1} variants={rise} initial="hidden" animate="show" className="mb-1 font-display text-xl font-bold text-wine">
          {t('auth.loginTitle')}
        </motion.h2>
        <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="mb-5 text-sm text-stone-400">
          {t('auth.loginSubtitle')}
        </motion.p>

        {justRegistered && (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <p className="font-bold text-emerald-700">{t('auth.registeredTitle')}</p>
            <p className="mt-1 text-emerald-700/80">{t('auth.registeredDesc')}</p>
          </div>
        )}
        {needsCode && (
          <div className="mb-4 rounded-2xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm">
            <p className="font-bold text-wine">{t('auth.expiredTitle')}</p>
            <p className="mt-1 text-wine/80">{t('auth.expiredDesc')}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={needsCode ? renew : submit} className="space-y-3.5">
          {/* البريد/الهاتف */}
          <motion.div custom={2} variants={rise} initial="hidden" animate="show" className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-wine/45">
              <MailIcon />
            </span>
            <input
              ref={emailRef}
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              aria-label={t('auth.emailOrPhone')}
              placeholder={t('auth.emailOrPhone')}
              className="input !rounded-2xl !py-4 !ps-12 !text-base"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </motion.div>

          {/* كلمة المرور */}
          <motion.div custom={3} variants={rise} initial="hidden" animate="show" className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-wine/45">
              <LockIcon />
            </span>
            <input
              type={showPass ? 'text' : 'password'}
              required
              aria-label={t('auth.password')}
              placeholder={t('auth.password')}
              className="input !rounded-2xl !py-4 !ps-12 !pe-12 !text-base"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              aria-label={t('auth.showPassword')}
              className="absolute inset-y-0 end-3 flex items-center text-wine/45 transition hover:text-wine"
            >
              <EyeIcon off={showPass} />
            </button>
          </motion.div>

          {/* تذكرني */}
          {!needsCode && (
            <motion.label custom={4} variants={rise} initial="hidden" animate="show" className="flex cursor-pointer items-center gap-2.5 ps-1 text-sm text-stone-500">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
              <span className="flex h-5 w-5 items-center justify-center rounded-md border border-wine/30 text-[11px] text-cream transition peer-checked:border-wine peer-checked:bg-wine">
                {remember && '✓'}
              </span>
              {t('auth.rememberMe')}
            </motion.label>
          )}

          {/* كود التجديد للاشتراك المنتهي */}
          {needsCode && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-wine">🔑 {t('auth.renewCodeLabel')}</label>
              <input
                type="text"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                className="input !rounded-2xl !py-4 text-center text-2xl font-bold tracking-[0.5em]"
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          )}

          <motion.button
            custom={5}
            variants={rise}
            initial="hidden"
            animate="show"
            type="submit"
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            className="mt-1 w-full rounded-2xl bg-wine py-4 text-center font-bold text-cream shadow-lg transition hover:bg-wine-dark disabled:opacity-60"
          >
            {busy ? t('common.loading') : needsCode ? t('auth.renewBtn') : t('auth.submitLogin')}
          </motion.button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/forgot-password" className="text-sm font-medium text-wine/70 transition hover:text-wine">
            {t('auth.forgotLink')}
          </Link>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
          <span className="h-px flex-1 bg-wine/15" />
          <span>{rtl ? 'أو' : 'OR'}</span>
          <span className="h-px flex-1 bg-wine/15" />
        </div>

        <p className="pb-6 text-center text-sm text-stone-500">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-bold text-wine underline-offset-4 hover:underline">
            {t('auth.registerNow')}
          </Link>
        </p>
      </div>
    </div>
  );
}

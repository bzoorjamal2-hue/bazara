import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import AuthShell, { Field, MailIcon, LockIcon, EyeIcon, rise } from '../components/AuthShell.jsx';

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
    <>
      <Seo title={t('auth.loginTitle')} />
      <AuthShell title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')} back="/">
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
          <motion.div custom={2} variants={rise} initial="hidden" animate="show">
            <Field
              ref={emailRef}
              icon={<MailIcon />}
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              aria-label={t('auth.emailOrPhone')}
              placeholder={t('auth.emailOrPhone')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </motion.div>

          <motion.div custom={3} variants={rise} initial="hidden" animate="show">
            <Field
              icon={<LockIcon />}
              type={showPass ? 'text' : 'password'}
              required
              aria-label={t('auth.password')}
              placeholder={t('auth.password')}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              trailing={
                <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={t('auth.showPassword')} className="text-wine/45 transition hover:text-wine">
                  <EyeIcon off={showPass} />
                </button>
              }
            />
          </motion.div>

          {!needsCode && (
            <motion.label custom={4} variants={rise} initial="hidden" animate="show" className="flex cursor-pointer items-center gap-2.5 ps-1 text-sm text-stone-500">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
              <span className="flex h-5 w-5 items-center justify-center rounded-md border border-wine/30 text-[11px] text-cream transition peer-checked:border-wine peer-checked:bg-wine">
                {remember && '✓'}
              </span>
              {t('auth.rememberMe')}
            </motion.label>
          )}

          {needsCode && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-wine">🔑 {t('auth.renewCodeLabel')}</label>
              <Field
                type="text"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                className="text-center text-2xl font-bold tracking-[0.5em]"
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
      </AuthShell>
    </>
  );
}

import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import AuthShell, { Field, MailIcon, LockIcon, EyeIcon, KeyIcon, rise } from '../components/AuthShell.jsx';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const emailRef = useRef(null);
  const [step, setStep] = useState(1); // 1: البريد | 2: الكود + كلمة المرور
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const em = (email || emailRef.current?.value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    setEmail(em);
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: em });
      setMsg(t('auth.codeSentHint'));
      setStep(2);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim() || newPassword.length < 8) {
      setError(t('errors.generic'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { email, token: code.trim(), newPassword });
      setMsg(t('auth.resetDone'));
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Seo title={t('auth.forgotTitle')} />
      <AuthShell title={t('auth.forgotTitle')} subtitle={step === 1 ? t('auth.forgotDesc') : t('auth.codeSentHint')} back="/login" compactHero>
        {error && <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{error}</div>}
        {msg && <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700">{msg}</div>}

        {step === 1 ? (
          <form onSubmit={sendCode} className="space-y-3.5">
            <motion.div custom={2} variants={rise} initial="hidden" animate="show">
              <Field ref={emailRef} icon={<MailIcon />} type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" aria-label={t('auth.email')} placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </motion.div>
            <motion.button custom={3} variants={rise} initial="hidden" animate="show" type="submit" disabled={busy} whileTap={{ scale: 0.97 }}
              className="w-full rounded-2xl bg-wine py-4 text-center font-bold text-cream shadow-lg transition hover:bg-wine-dark disabled:opacity-60">
              {busy ? t('common.loading') : t('auth.sendCode')}
            </motion.button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-3.5">
            <Field icon={<KeyIcon />} type="text" inputMode="numeric" dir="ltr" maxLength={6} className="text-center text-2xl tracking-[0.4em]" aria-label={t('auth.codeLabel')} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />
            <div>
              <Field
                icon={<LockIcon />}
                type={showPass ? 'text' : 'password'}
                aria-label={t('auth.newPassword')}
                placeholder={t('auth.newPassword')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                trailing={
                  <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={t('auth.showPassword')} className="text-wine/45 transition hover:text-wine">
                    <EyeIcon off={showPass} />
                  </button>
                }
              />
              <PasswordStrength password={newPassword} />
              <p className="mt-1.5 ps-1 text-xs text-stone-400">{t('auth.passwordHint')}</p>
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-2xl bg-wine py-4 text-center font-bold text-cream shadow-lg transition hover:bg-wine-dark disabled:opacity-60">
              {busy ? t('common.loading') : t('auth.resetSubmit')}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs text-stone-400 hover:text-wine">
              {t('auth.backToLogin')}
            </button>
          </form>
        )}

        <p className="mt-5 pb-6 text-center text-sm">
          <Link to="/login" className="font-bold text-wine underline-offset-4 hover:underline">{t('auth.backToLogin')}</Link>
        </p>
      </AuthShell>
    </>
  );
}

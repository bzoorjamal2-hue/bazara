import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const emailRef = useRef(null);
  const [step, setStep] = useState(1); // 1: البريد | 2: الكود + كلمة المرور
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    // نقرأ القيمة من الحالة أو مباشرة من الحقل (لتفادي مشاكل الإكمال التلقائي بالآيفون)
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
    <div className="mx-auto max-w-md">
      <Seo title={t('auth.forgotTitle')} />
      <div className="glass-strong animate-fade-up p-7 sm:p-9">
        <h1 className="mb-3 font-display text-2xl font-bold gradient-text">{t('auth.forgotTitle')}</h1>

        {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
        {msg && <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}

        {step === 1 ? (
          <>
            <p className="mb-5 text-sm text-stone-400">{t('auth.forgotDesc')}</p>
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <label className="label">{t('auth.email')}</label>
                <input
                  ref={emailRef}
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  dir="ltr"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@email.com"
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? t('common.loading') : t('auth.sendCode')}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={reset} className="space-y-4">
            <div>
              <label className="label">{t('auth.codeLabel')}</label>
              <input type="text" inputMode="numeric" dir="ltr" maxLength={6}
                className="input text-center text-2xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" />
            </div>
            <div>
              <label className="label">{t('auth.newPassword')}</label>
              <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              <PasswordStrength password={newPassword} />
              <p className="mt-1.5 text-xs text-stone-400">{t('auth.passwordHint')}</p>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t('common.loading') : t('auth.resetSubmit')}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs text-stone-400 hover:text-gold-200">
              {t('auth.backToLogin') /* رجوع لإدخال البريد */}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm">
          <Link to="/login" className="font-semibold text-gold-300 hover:text-gold-200">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}

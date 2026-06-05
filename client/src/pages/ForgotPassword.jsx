import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
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

        {sent ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {t('auth.resetSent')}
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-stone-400">{t('auth.forgotDesc')}</p>
            {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">{t('auth.email')}</label>
                <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="email" />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? t('common.loading') : t('auth.sendResetLink')}
              </button>
            </form>
          </>
        )}

        <p className="mt-5 text-center text-sm">
          <Link to="/login" className="font-semibold text-gold-300 hover:text-gold-200">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}

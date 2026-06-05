import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { email, token, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Seo title={t('auth.resetTitle')} />
      <div className="glass-strong animate-fade-up p-7 sm:p-9">
        <h1 className="mb-5 font-display text-2xl font-bold gradient-text">{t('auth.resetTitle')}</h1>

        {done ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {t('auth.resetDone')}
          </div>
        ) : (
          <>
            {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">{t('auth.newPassword')}</label>
                <input type="password" required className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                <PasswordStrength password={newPassword} />
                <p className="mt-1.5 text-xs text-stone-400">{t('auth.passwordHint')}</p>
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? t('common.loading') : t('auth.resetSubmit')}
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

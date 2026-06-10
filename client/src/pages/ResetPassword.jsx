import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import AuthShell, { Field, LockIcon, EyeIcon, rise } from '../components/AuthShell.jsx';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
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
    <>
      <Seo title={t('auth.resetTitle')} />
      <AuthShell title={t('auth.resetTitle')} back="/login" compactHero>
        {done ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            {t('auth.resetDone')}
          </div>
        ) : (
          <>
            {error && <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{error}</div>}
            <form onSubmit={submit} className="space-y-3.5">
              <motion.div custom={2} variants={rise} initial="hidden" animate="show">
                <Field
                  icon={<LockIcon />}
                  type={showPass ? 'text' : 'password'}
                  required
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
              </motion.div>
              <motion.button custom={3} variants={rise} initial="hidden" animate="show" type="submit" disabled={busy} whileTap={{ scale: 0.97 }}
                className="w-full rounded-2xl bg-wine py-4 text-center font-bold text-cream shadow-lg transition hover:bg-wine-dark disabled:opacity-60">
                {busy ? t('common.loading') : t('auth.resetSubmit')}
              </motion.button>
            </form>
          </>
        )}

        <p className="mt-5 pb-6 text-center text-sm">
          <Link to="/login" className="font-bold text-wine underline-offset-4 hover:underline">{t('auth.backToLogin')}</Link>
        </p>
      </AuthShell>
    </>
  );
}

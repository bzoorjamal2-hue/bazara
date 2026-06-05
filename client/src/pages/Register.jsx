import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', storeName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      // لا دخول تلقائي: نرجع لصفحة الدخول ليسجّل المستخدم ويدخل متجره
      navigate('/login', { state: { registered: true, email: form.email } });
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-md">
      <Seo title={t('auth.registerTitle')} />
      <div className="glass-strong animate-fade-up p-7 sm:p-9">
        <h1 className="mb-6 font-display text-2xl font-bold gradient-text">{t('auth.registerTitle')}</h1>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">{t('auth.name')}</label>
            <input type="text" required className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">{t('auth.storeName')}</label>
            <input
              type="text"
              required
              className="input"
              placeholder={t('auth.storeNameHint')}
              value={form.storeName}
              onChange={set('storeName')}
            />
          </div>
          <div>
            <label className="label">{t('auth.email')}</label>
            <input type="email" required className="input" value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          <div>
            <label className="label">{t('auth.password')}</label>
            <input
              type="password"
              required
              className="input"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
            <PasswordStrength password={form.password} />
            <p className="mt-1.5 text-xs text-stone-400">{t('auth.passwordHint')}</p>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('common.loading') : t('auth.submitRegister')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-gold-300 hover:text-gold-200">
            {t('auth.loginNow')}
          </Link>
        </p>
      </div>
    </div>
  );
}

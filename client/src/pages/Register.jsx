import { useRef, useState } from 'react';
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
  const [form, setForm] = useState({ name: '', email: '', password: '', storeName: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // نقرأ الإيميل من الحالة أو من الحقل مباشرة (لتفادي مشاكل الإكمال التلقائي بالآيفون)
    const email = (form.email || emailRef.current?.value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    setBusy(true);
    try {
      const data = await register({ ...form, email });
      // إن كان مفعّلاً (مثلاً مدير) للوحة التحكم، وإلا لصفحة الدفع/الاشتراك
      if (data?.subscription?.active) navigate('/dashboard');
      else navigate('/subscribe');
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
            <label className="label">{t('auth.phone')}</label>
            <input type="tel" required dir="ltr" className="input" placeholder="+970590000000" value={form.phone} onChange={set('phone')} autoComplete="tel" />
            <p className="mt-1 text-xs text-stone-400">{t('auth.phoneHint')}</p>
          </div>
          <div>
            <label className="label">{t('auth.email')}</label>
            <input ref={emailRef} type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" dir="ltr" className="input" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@email.com" />
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

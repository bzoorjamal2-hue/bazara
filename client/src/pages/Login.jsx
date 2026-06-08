import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';

export default function Login() {
  const { t } = useTranslation();
  const { login, loginWithCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.registered;
  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsCode, setNeedsCode] = useState(false); // اشتراك منتهٍ: يطلب كود التجديد
  const [code, setCode] = useState('');
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
      // غير المشترك يُوجَّه لصفحة الاشتراك لتفعيل متجره
      if (data?.subscription && !data.subscription.active) navigate('/subscribe');
      else navigate('/dashboard');
    } catch (err) {
      // اشتراك منتهٍ → نُظهر خانة كود التجديد بدل رسالة خطأ عامة
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
    <div className="mx-auto max-w-md">
      <Seo title={t('auth.loginTitle')} />
      <div className="glass-strong animate-fade-up p-7 sm:p-9">
        <h1 className="mb-6 font-display text-2xl font-bold gradient-text">{t('auth.loginTitle')}</h1>

        {justRegistered && (
          <div className="mb-4 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-gold-100">
            <p className="font-bold">{t('auth.registeredTitle')}</p>
            <p className="mt-1 text-gold-200/80">{t('auth.registeredDesc')}</p>
          </div>
        )}

        {needsCode && (
          <div className="mb-4 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-gold-100">
            <p className="font-bold">{t('auth.expiredTitle')}</p>
            <p className="mt-1 text-gold-200/80">{t('auth.expiredDesc')}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={needsCode ? renew : submit} className="space-y-4">
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
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">{t('auth.password')}</label>
            <input
              type="password"
              required
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
            />
          </div>
          {needsCode && (
            <div>
              <label className="label">🔑 {t('auth.renewCodeLabel')}</label>
              <input
                type="text"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                className="input text-center text-2xl font-bold tracking-[0.5em]"
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('common.loading') : needsCode ? t('auth.renewBtn') : t('auth.submitLogin')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="text-stone-400 hover:text-gold-200">{t('auth.forgotLink')}</Link>
        </p>

        <p className="mt-5 text-center text-sm text-stone-400">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-gold-300 hover:text-gold-200">
            {t('auth.registerNow')}
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import AuthShell, { Field, MailIcon, LockIcon, EyeIcon, UserIcon, ShopIcon, PhoneIcon, rise } from '../components/AuthShell.jsx';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', storeName: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
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
    <>
      <Seo title={t('auth.registerTitle')} />
      <AuthShell title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')} back="/login" compactHero>
        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-3.5">
          <motion.div custom={2} variants={rise} initial="hidden" animate="show">
            <Field icon={<UserIcon />} type="text" required aria-label={t('auth.name')} placeholder={t('auth.name')} value={form.name} onChange={set('name')} />
          </motion.div>

          <motion.div custom={2.5} variants={rise} initial="hidden" animate="show">
            <Field icon={<ShopIcon />} type="text" required aria-label={t('auth.storeName')} placeholder={t('auth.storeNameHint')} value={form.storeName} onChange={set('storeName')} />
          </motion.div>

          <motion.div custom={3} variants={rise} initial="hidden" animate="show">
            <Field icon={<PhoneIcon />} type="tel" required dir="ltr" aria-label={t('auth.phone')} placeholder="+970590000000" value={form.phone} onChange={set('phone')} autoComplete="tel" />
            <p className="mt-1 ps-1 text-xs text-stone-400">{t('auth.phoneHint')}</p>
          </motion.div>

          <motion.div custom={3.5} variants={rise} initial="hidden" animate="show">
            <Field ref={emailRef} icon={<MailIcon />} type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" aria-label={t('auth.email')} placeholder="you@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
          </motion.div>

          <motion.div custom={4} variants={rise} initial="hidden" animate="show">
            <Field
              icon={<LockIcon />}
              type={showPass ? 'text' : 'password'}
              required
              aria-label={t('auth.password')}
              placeholder={t('auth.password')}
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              trailing={
                <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={t('auth.showPassword')} className="text-wine/45 transition hover:text-wine">
                  <EyeIcon off={showPass} />
                </button>
              }
            />
            <PasswordStrength password={form.password} />
            <p className="mt-1.5 ps-1 text-xs text-stone-400">{t('auth.passwordHint')}</p>
          </motion.div>

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
            {busy ? t('common.loading') : t('auth.submitRegister')}
          </motion.button>
        </form>

        <p className="py-6 text-center text-sm text-stone-500">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-bold text-wine underline-offset-4 hover:underline">
            {t('auth.loginNow')}
          </Link>
        </p>
      </AuthShell>
    </>
  );
}

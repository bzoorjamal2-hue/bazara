import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import FacebookButton from '../components/FacebookButton.jsx';
import AuthShell, { Field, MailIcon, LockIcon, EyeIcon, UserIcon, ShopIcon, PhoneIcon, rise } from '../components/AuthShell.jsx';

export default function Register() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const { register, googleLogin, facebookLogin, socialRegister } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // بعد زرّ جوجل/فيسبوك لحسابٍ جديد: الاسم والبريد جاءا من المزوّد، وينقص المتجر والجوال
  const [social, setSocial] = useState(location.state?.social || null);
  const [form, setForm] = useState({ name: location.state?.social?.name || '', email: '', password: '', storeName: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const emailRef = useRef(null);

  const goNext = (data) => navigate(data?.subscription?.active ? '/dashboard' : '/subscribe');

  const socialSignUp = (fn) => async (token) => {
    setError('');
    setBusy(true);
    try {
      const data = await fn(token);
      if (data?.needsSignup) {
        setSocial(data);
        setForm((f) => ({ ...f, name: f.name || data.name || '' }));
      } else goNext(data);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const submitSocial = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      goNext(await socialRegister({ signupToken: social.signupToken, name: form.name, storeName: form.storeName, phone: form.phone }));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

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
      goNext(await register({ ...form, email }));
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

        {social && (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <p className="font-bold text-emerald-700">{t('auth.socialStepTitle')}</p>
            <p className="mt-1 text-emerald-700/80">{t('auth.socialStepDesc', { email: social.email, provider: social.provider === 'facebook' ? t('auth.facebook') : t('auth.google') })}</p>
          </div>
        )}

        <form onSubmit={social ? submitSocial : submit} className="space-y-3.5">
          <motion.div custom={2} variants={rise} initial="hidden" animate="show">
            <Field icon={<UserIcon />} type="text" required label={t('auth.name')} hint={t('auth.nameHint')} placeholder={t('auth.namePh')} value={form.name} onChange={set('name')} />
          </motion.div>

          <motion.div custom={2.5} variants={rise} initial="hidden" animate="show">
            <Field icon={<ShopIcon />} type="text" required label={t('auth.storeName')} hint={t('auth.storeHint2')} placeholder={t('auth.storeNameHint')} value={form.storeName} onChange={set('storeName')} />
          </motion.div>

          <motion.div custom={3} variants={rise} initial="hidden" animate="show">
            <Field icon={<PhoneIcon />} type="tel" required dir="ltr" label={t('auth.phone')} hint={t('auth.phoneHint')} placeholder="+970590000000" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          </motion.div>

          {!social && (<>
          <motion.div custom={3.5} variants={rise} initial="hidden" animate="show">
            <Field ref={emailRef} icon={<MailIcon />} type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" label={t('auth.email')} hint={t('auth.emailHint2')} placeholder="you@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
          </motion.div>

          <motion.div custom={4} variants={rise} initial="hidden" animate="show">
            <Field
              icon={<LockIcon />}
              type={showPass ? 'text' : 'password'}
              required
              label={t('auth.password')}
              placeholder="••••••••"
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
            <p className="bz-af-hint">{t('auth.passwordHint')}</p>
          </motion.div>
          </>)}

          <motion.button
            custom={5}
            variants={rise}
            initial="hidden"
            animate="show"
            type="submit"
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            className="auth-submit mt-1"
          >
            {busy ? t('common.loading') : t('auth.submitRegister')}
          </motion.button>
        </form>

        {social ? (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setSocial(null)} className="text-sm font-medium text-wine/70 transition hover:text-wine">
              {t('auth.socialUseEmail')}
            </button>
          </div>
        ) : (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
              <span className="h-px flex-1 bg-wine/15" />
              <span>{rtl ? 'أو' : 'OR'}</span>
              <span className="h-px flex-1 bg-wine/15" />
            </div>
            <div className="space-y-3">
              <GoogleButton onCredential={socialSignUp(googleLogin)} text="signup_with" />
              <FacebookButton onToken={socialSignUp(facebookLogin)} disabled={busy} />
            </div>
          </>
        )}

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

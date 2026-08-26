import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { getErrorMessage } from '../../api/client.js';
import ImageInput from '../../components/ImageInput.jsx';
import PasswordStrength from '../../components/PasswordStrength.jsx';
import { SaveIcon, KeyIcon, MailIcon, UserIcon, EyeIcon, EyeOffIcon, CheckIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Field } from '../../components/FormField.jsx';
import { cldThumb } from '../../utils/cloudinary.js';

// حقل كلمة سر بزرّ إظهار/إخفاء — الكتابة العمياء أكبر سبب لخطأ «كلمة المرور غير صحيحة»
function PasswordField({ value, onChange, autoComplete, id }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        required
        className="input pe-11"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={t(show ? 'dashboard.security.hidePassword' : 'dashboard.security.showPassword')}
        title={t(show ? 'dashboard.security.hidePassword' : 'dashboard.security.showPassword')}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-stone-400 transition hover:text-gold-300"
      >
        {show ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile, refresh } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', avatarUrl: user?.avatarUrl || '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // تغيير كلمة المرور
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // تغيير البريد
  const [emForm, setEmForm] = useState({ currentPassword: '', newEmail: '' });
  const [emMsg, setEmMsg] = useState('');
  const [emErr, setEmErr] = useState('');
  const [emBusy, setEmBusy] = useState(false);

  // هل تغيّر شيء عن المحفوظ؟ — نعطّل زرّ الحفظ بلا داعٍ ونُظهر تنبيهاً عند وجود تعديل
  const dirty = form.name !== (user?.name || '') || form.avatarUrl !== (user?.avatarUrl || '');

  const submit = async (e) => {
    e.preventDefault();
    setMsg(''); setError(''); setBusy(true);
    try {
      await updateProfile(form);
      setMsg(t('dashboard.profileSection.saved'));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  // حفظ الصورة فوراً
  const saveAvatar = async () => {
    setMsg(''); setError('');
    try {
      await updateProfile({ name: form.name || user?.name || '', avatarUrl: form.avatarUrl });
      setMsg(t('image.imageSaved'));
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwMsg(''); setPwErr(''); setPwBusy(true);
    try {
      await api.put('/auth/password', pwForm);
      setPwMsg(t('dashboard.security.passwordChanged'));
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setPwErr(getErrorMessage(err, t('errors.generic')));
    } finally {
      setPwBusy(false);
    }
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    setEmMsg(''); setEmErr(''); setEmBusy(true);
    try {
      await api.put('/auth/email', emForm);
      await refresh();
      setEmMsg(t('dashboard.security.emailChanged'));
      setEmForm({ currentPassword: '', newEmail: '' });
    } catch (err) {
      setEmErr(getErrorMessage(err, t('errors.generic')));
    } finally {
      setEmBusy(false);
    }
  };

  const Alert = ({ ok, children }) =>
    children ? (
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-400' : 'border-red-400/30 bg-red-500/10 text-red-300'}`}>
        {ok && <CheckIcon className="h-4 w-4 shrink-0" />}
        <span className="min-w-0">{children}</span>
      </div>
    ) : null;

  // نفس هيكل بقية تبويبات اللوحة
  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
  const jumpToEmail = () => document.getElementById('p-email')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-5">
      <PageHead icon={<UserIcon className="h-6 w-6" />} title={t('dashboard.profileSection.title')} hint={t('dashboard.profileSection.hint')} />

      {/* بياناتك */}
      <form onSubmit={submit} className={CARD}>
        <SectionHead icon={<UserIcon className="h-5 w-5" />} title={t('dashboard.profileSection.identity')} desc={t('dashboard.profileSection.identityHint')} />

        {/* معاينة حيّة: هيك بيظهر حسابك بالقائمة الجانبية وشريط الحساب */}
        <div className="dash-preview flex items-center gap-3 rounded-2xl p-3">
          <span className="dash-avatar grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full">
            {form.avatarUrl
              ? <img src={cldThumb(form.avatarUrl, 160)} alt="" className="h-full w-full object-cover" />
              : <span className="font-display text-xl font-bold text-gold-300">{(form.name || user?.name || '؟').trim()[0]}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold text-stone-100">{form.name || t('auth.name')}</p>
            <p className="truncate text-[11px] text-stone-400" dir="ltr">{user?.email || ''}</p>
          </div>
        </div>

        <Alert ok>{msg}</Alert>
        <Alert>{error}</Alert>

        <div>
          <ImageInput
            label={t('dashboard.profileSection.avatar')}
            value={form.avatarUrl}
            onChange={(v) => setForm({ ...form, avatarUrl: v })}
            round
            hint={t('dashboard.profileSection.avatarHint')}
          />
          <button type="button" onClick={saveAvatar} className="btn-ghost mt-2.5 gap-1.5 !py-1.5 text-sm"><SaveIcon className="h-4 w-4" /> {t('image.saveImage')}</button>
        </div>

        <Field label={t('auth.name')} tip={t('dashboard.profileSection.nameTip')} max={60} value={form.name} required>
          <input type="text" required maxLength={60} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>

        <Field label={t('auth.email')} tip={t('dashboard.profileSection.emailTip')}>
          <input type="email" disabled className="input opacity-60" value={user?.email || ''} dir="ltr" />
          {/* بدل جملة «استخدم القسم بالأسفل»: زرّ ينقلك للقسم مباشرةً */}
          <button type="button" onClick={jumpToEmail} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-gold-300 transition hover:text-gold-200">
            <MailIcon className="h-3.5 w-3.5" /> {t('dashboard.security.changeEmail')}
          </button>
        </Field>

        <button type="submit" disabled={busy || !dirty} className="btn-primary disabled:cursor-not-allowed">
          {busy ? t('common.loading') : t('common.save')}
        </button>
      </form>

      {/* كلمة المرور */}
      <form onSubmit={submitPassword} className={CARD}>
        <SectionHead icon={<KeyIcon className="h-5 w-5" />} title={t('dashboard.security.changePassword')} desc={t('dashboard.security.changePasswordHint')} />
        <Alert ok>{pwMsg}</Alert>
        <Alert>{pwErr}</Alert>

        <Field label={t('dashboard.security.currentPassword')} tip={t('dashboard.security.currentPasswordTip')} required>
          <PasswordField value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} autoComplete="current-password" />
        </Field>

        <Field label={t('dashboard.security.newPassword')} tip={t('dashboard.security.newPasswordTip')} required>
          <PasswordField value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} autoComplete="new-password" />
          <PasswordStrength password={pwForm.newPassword} />
        </Field>

        <button type="submit" disabled={pwBusy} className="btn-primary">{pwBusy ? t('common.loading') : t('dashboard.security.savePassword')}</button>
      </form>

      {/* البريد الإلكتروني */}
      <form id="p-email" onSubmit={submitEmail} className={`${CARD} scroll-mt-[calc(env(safe-area-inset-top,0px)+5rem)]`}>
        <SectionHead icon={<MailIcon className="h-5 w-5" />} title={t('dashboard.security.changeEmail')} desc={t('dashboard.security.changeEmailHint')} />
        <Alert ok>{emMsg}</Alert>
        <Alert>{emErr}</Alert>

        <Field label={t('dashboard.security.newEmail')} tip={t('dashboard.security.newEmailTip')} required>
          <input type="email" required className="input" dir="ltr" value={emForm.newEmail} onChange={(e) => setEmForm({ ...emForm, newEmail: e.target.value })} autoComplete="email" />
        </Field>

        <Field label={t('dashboard.security.currentPassword')} tip={t('dashboard.security.currentPasswordTip')} required>
          <PasswordField value={emForm.currentPassword} onChange={(e) => setEmForm({ ...emForm, currentPassword: e.target.value })} autoComplete="current-password" />
        </Field>

        <button type="submit" disabled={emBusy} className="btn-primary">{emBusy ? t('common.loading') : t('dashboard.security.saveEmail')}</button>
      </form>
    </div>
  );
}

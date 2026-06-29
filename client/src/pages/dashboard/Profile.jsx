import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { getErrorMessage } from '../../api/client.js';
import ImageInput from '../../components/ImageInput.jsx';
import PasswordStrength from '../../components/PasswordStrength.jsx';
import { SaveIcon, KeyIcon, MailIcon } from '../../components/icons.jsx';

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
      <div className={`rounded-xl border px-4 py-2.5 text-sm ${ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/10 text-red-200'}`}>
        {children}
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.profileSection.title')}</h1>

      {/* الملف الشخصي */}
      <form onSubmit={submit} className="glass space-y-5 p-6">
        <Alert ok>{msg}</Alert>
        <Alert>{error}</Alert>
        <div>
          <ImageInput label={t('dashboard.profileSection.avatar')} value={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} round />
          <button type="button" onClick={saveAvatar} className="btn-ghost mt-3 gap-1.5 text-sm"><SaveIcon className="h-4 w-4" /> {t('image.saveImage')}</button>
        </div>
        <div>
          <label className="label">{t('auth.name')}</label>
          <input type="text" required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('auth.email')}</label>
          <input type="email" disabled className="input opacity-60" value={user?.email || ''} dir="ltr" />
          <p className="mt-1 text-xs text-stone-400">{t('dashboard.profileSection.emailNote')}</p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
      </form>

      {/* الأمان */}
      <h2 className="font-display text-xl font-bold gradient-text">{t('dashboard.security.title')}</h2>

      {/* تغيير كلمة المرور */}
      <form onSubmit={submitPassword} className="glass space-y-4 p-6">
        <h3 className="flex items-center gap-1.5 font-semibold text-stone-100"><KeyIcon className="h-4 w-4" /> {t('dashboard.security.changePassword')}</h3>
        <Alert ok>{pwMsg}</Alert>
        <Alert>{pwErr}</Alert>
        <div>
          <label className="label">{t('dashboard.security.currentPassword')}</label>
          <input type="password" required className="input" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} autoComplete="current-password" />
        </div>
        <div>
          <label className="label">{t('dashboard.security.newPassword')}</label>
          <input type="password" required className="input" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} autoComplete="new-password" />
          <PasswordStrength password={pwForm.newPassword} />
        </div>
        <button type="submit" disabled={pwBusy} className="btn-primary">{pwBusy ? t('common.loading') : t('dashboard.security.savePassword')}</button>
      </form>

      {/* تغيير البريد */}
      <form onSubmit={submitEmail} className="glass space-y-4 p-6">
        <h3 className="flex items-center gap-1.5 font-semibold text-stone-100"><MailIcon className="h-4 w-4" /> {t('dashboard.security.changeEmail')}</h3>
        <Alert ok>{emMsg}</Alert>
        <Alert>{emErr}</Alert>
        <div>
          <label className="label">{t('dashboard.security.newEmail')}</label>
          <input type="email" required className="input" dir="ltr" value={emForm.newEmail} onChange={(e) => setEmForm({ ...emForm, newEmail: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('dashboard.security.currentPassword')}</label>
          <input type="password" required className="input" value={emForm.currentPassword} onChange={(e) => setEmForm({ ...emForm, currentPassword: e.target.value })} autoComplete="current-password" />
        </div>
        <button type="submit" disabled={emBusy} className="btn-primary">{emBusy ? t('common.loading') : t('dashboard.security.saveEmail')}</button>
      </form>
    </div>
  );
}

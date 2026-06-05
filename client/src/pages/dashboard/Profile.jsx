import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { getErrorMessage } from '../../api/client.js';
import ImageInput from '../../components/ImageInput.jsx';

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', avatarUrl: user?.avatarUrl || '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    setBusy(true);
    try {
      await updateProfile(form);
      setMsg(t('dashboard.profileSection.saved'));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.profileSection.title')}</h1>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      <form onSubmit={submit} className="glass space-y-5 p-6">
        <ImageInput
          label={t('dashboard.profileSection.avatar')}
          value={form.avatarUrl}
          onChange={(v) => setForm({ ...form, avatarUrl: v })}
          round
        />
        <div>
          <label className="label">{t('auth.name')}</label>
          <input type="text" required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('auth.email')}</label>
          <input type="email" disabled className="input opacity-60" value={user?.email || ''} dir="ltr" />
          <p className="mt-1 text-xs text-stone-400">{t('dashboard.profileSection.emailNote')}</p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? t('common.loading') : t('common.save')}
        </button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { MailIcon, UsersIcon, MegaphoneIcon } from '../../components/icons.jsx';
import { PageHead } from '../../components/FormField.jsx';

// رسالة جماعية للمدير — بريد إعلاني لكل أصحاب المتاجر أو مشتركي النشرة.
export default function BroadcastManager() {
  const { t } = useTranslation();
  const [audience, setAudience] = useState('subscribers'); // subscribers | newsletter
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const send = async () => {
    setMsg(''); setErr(''); setBusy(true);
    try {
      const r = await api.post('/subscription/broadcast', { audience, subject: subject.trim(), body: body.trim() });
      setMsg(t('admin.bc.sent', { count: r.data.queued }));
      setSubject(''); setBody(''); setConfirm(false);
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const ready = subject.trim() && body.trim();
  const audiences = [
    { key: 'subscribers', label: t('admin.bc.audStores'), Icon: UsersIcon },
    { key: 'newsletter', label: t('admin.bc.audNewsletter'), Icon: MailIcon },
  ];

  return (
    <div className="space-y-5">
      <PageHead icon={<MegaphoneIcon className="h-6 w-6" />} title={t('admin.bc.title')} hint={t('admin.bc.hint')} />
      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {err && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{err}</div>}

      <div className="glass space-y-4 p-6">
        {/* الجمهور */}
        <div className="grid grid-cols-2 gap-2">
          {audiences.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setAudience(key)}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${audience === key ? 'bg-gold-400 text-ink-950 shadow-sm' : 'border border-gold-400/25 text-stone-300 hover:bg-gold-400/10'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={160}
          placeholder={t('admin.bc.subject')}
          className="input w-full"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={5000}
          placeholder={t('admin.bc.body')}
          className="input w-full"
        />

        {confirm ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-stone-300">{t('admin.bc.confirmAsk')}</span>
            <button onClick={send} disabled={busy} className="btn-primary">
              {busy ? t('common.loading') : t('admin.bc.confirmYes')}
            </button>
            <button onClick={() => setConfirm(false)} className="text-sm text-stone-400 hover:text-stone-200">{t('common.cancel')}</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} disabled={!ready} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            <MailIcon className="h-5 w-5" /> {t('admin.bc.review')}
          </button>
        )}
      </div>
    </div>
  );
}

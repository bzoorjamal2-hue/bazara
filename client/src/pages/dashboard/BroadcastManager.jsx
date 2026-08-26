import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { MailIcon, UsersIcon, MegaphoneIcon, WarnIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Field, Tip } from '../../components/FormField.jsx';

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

      <div className="dash-section glass space-y-4 p-5 sm:p-6">
        <SectionHead icon={<MegaphoneIcon className="h-5 w-5" />} title={t('admin.bc.compose')} desc={t('admin.bc.composeDesc')} />

        <Field label={t('admin.bc.audience')} tip={t('admin.bc.audienceTip')} required>
          <div className="grid grid-cols-2 gap-2">
            {audiences.map(({ key, label, Icon }) => {
              const on = audience === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAudience(key)}
                  aria-pressed={on}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${on ? 'shadow-sm' : 'border border-gold-400/25 text-stone-300 hover:bg-gold-400/10'}`}
                  // لونان صريحان للحالة النشطة: أصناف الذهب تنقلب بنّية نهاراً
                  style={on ? { background: '#b09a7e', color: '#2a1c10' } : undefined}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={t('admin.bc.subject')} tip={t('admin.bc.subjectTip')} required max={160} value={subject}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={160}
            placeholder={t('admin.bc.subjectPlaceholder')}
            className="input w-full"
          />
        </Field>

        <Field label={t('admin.bc.body')} tip={t('admin.bc.bodyTip')} required max={5000} value={body}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            maxLength={5000}
            placeholder={t('admin.bc.bodyPlaceholder')}
            className="input w-full resize-none"
          />
        </Field>

        {/* لا تراجع بعد الإرسال: البريد يغادر ولا يُستدعى */}
        {confirm ? (
          <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-3">
            <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-400">
              <WarnIcon className="mt-px h-3.5 w-3.5 shrink-0" /> {t('admin.bc.noUndo')}
            </p>
            <p className="text-sm text-stone-200">{t('admin.bc.confirmAsk')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={send} disabled={busy} className="btn-primary">
                {busy ? t('common.loading') : t('admin.bc.confirmYes')}
              </button>
              <button onClick={() => setConfirm(false)} className="text-sm text-stone-400 hover:text-stone-200">{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} disabled={!ready} className="btn-primary w-full gap-2 disabled:opacity-50">
            <MailIcon className="h-5 w-5" /> {t('admin.bc.review')}
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

function fmt(d) {
  return d ? new Date(d).toLocaleString() : '—';
}

function SubRow({ s }) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(s.plan || 'monthly');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const send = async () => {
    setMsg(''); setErr(''); setBusy(true);
    try {
      await api.post('/subscription/send-code', { email: s.email, plan });
      setMsg(`${t('admin.codeSentTo')} ${s.email}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = s.isAdmin
    ? <span className="badge bg-gold-400/20 text-gold-200">مدير</span>
    : s.active
      ? <span className="badge bg-emerald-500/20 text-emerald-200">{t('admin.subActive')}</span>
      : <span className="badge bg-red-500/20 text-red-200">{t('admin.subExpired')}</span>;

  return (
    <div className="glass p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-100">{s.name}</span>
            {statusBadge}
          </div>
          <p className="mt-1 text-xs text-stone-400" dir="ltr">{s.email}</p>
        </div>
        <a href={`/store/${s.storeSlug}`} target="_blank" rel="noreferrer" className="text-xs text-gold-300 hover:text-gold-200">🔗 {t('admin.subStore')}</a>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-400 sm:grid-cols-3">
        <div><span className="text-stone-500">{t('admin.subPlan')}:</span> {s.plan ? t(`subscription.${s.plan}`) : t('admin.subNone')}</div>
        <div><span className="text-stone-500">{t('admin.subStarted')}:</span> {fmt(s.startedAt)}</div>
        <div><span className="text-stone-500">{t('admin.subExpires')}:</span> {fmt(s.currentPeriodEnd)}</div>
      </div>

      {msg && <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">{msg}</div>}
      {err && <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{err}</div>}

      {!s.isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input !w-auto !py-1.5 text-sm">
            <option value="monthly" className="bg-ink-800">{t('subscription.monthly')} ($10)</option>
            <option value="yearly" className="bg-ink-800">{t('subscription.yearly')} ($100)</option>
          </select>
          <button onClick={send} disabled={busy} className="btn-primary !py-1.5 text-sm">
            {busy ? t('common.loading') : `✉️ ${t('admin.sendCodeBtn')}`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SubscribersManager() {
  const { t } = useTranslation();
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/subscription/subscribers').then((r) => setSubs(r.data.subscribers)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (subs === null && !error) return <Spinner />;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('admin.subscribersTitle')}</h1>
      <p className="text-sm text-stone-400">{t('admin.subscribersHint')}</p>
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {subs && subs.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('admin.noSubscribers')}</div>
      ) : (
        <div className="space-y-3">{subs?.map((s) => <SubRow key={s.email} s={s} />)}</div>
      )}
    </div>
  );
}

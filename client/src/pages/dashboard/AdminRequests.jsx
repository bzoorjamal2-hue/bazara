import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

export default function AdminRequests() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/subscription/requests');
      setRequests(data.requests);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    setMsg(''); setError('');
    try {
      await api.post(`/subscription/requests/${id}/${action}`);
      setMsg(t('admin.done'));
      setTimeout(() => setMsg(''), 1500);
      load();
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    }
  };

  if (requests === null) return <Spinner />;

  const statusBadge = (s) => {
    const map = {
      pending: 'bg-orange-500/20 text-orange-200',
      approved: 'bg-emerald-500/20 text-emerald-200',
      rejected: 'bg-red-500/20 text-red-200',
    };
    return <span className={`badge ${map[s] || ''}`}>{t(`admin.${s}`)}</span>;
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('admin.title')}</h1>
      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {requests.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('admin.noRequests')}</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-stone-100">{r.userName}</span>
                  <span className="text-xs text-stone-400" dir="ltr">{r.userEmail}</span>
                  {statusBadge(r.status)}
                </div>
                <p className="mt-1 text-sm text-stone-400">
                  🏪 {r.storeName || '—'} · 📦 {t(`subscription.${r.plan}`)}
                  {r.method ? ` · 💳 ${r.method}` : ''}
                </p>
                {r.reference && <p className="mt-1 text-xs text-stone-500">{t('admin.reference')}: {r.reference}</p>}
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => act(r.id, 'approve')} className="btn-primary !px-3 !py-1.5 text-xs">✓ {t('admin.approve')}</button>
                  <button onClick={() => act(r.id, 'reject')} className="btn-danger !px-3 !py-1.5 text-xs">✕ {t('admin.reject')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { getErrorMessage } from '../../api/client.js';
import { MegaphoneIcon, UsersIcon, CheckIcon } from '../../components/icons.jsx';

// حملة إشعارات المتجر — صاحب المتجر يبعث Push لكل متابِعي متجره (وصل جديد/خصم).
// الجمهور = من فعّلوا "إشعارات المتجر" من صفحة المتجر (زوّار وزبائن، حتى بلا حساب).
export default function CampaignManager() {
  const { t } = useTranslation();
  const { store } = useAuth();
  const [status, setStatus] = useState(null); // { enabled, followers, last, readyAt }
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dest, setDest] = useState('store'); // store | offers
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.get('/push/campaign').then((r) => setStatus(r.data)).catch(() => setStatus({ enabled: false, followers: 0 }));
  useEffect(() => { load(); }, []);

  const url = dest === 'offers' ? '/offers' : (store ? `/store/${store.slug}` : '/');
  const ready = title.trim() && body.trim() && !busy;
  // فترة تهدئة نشطة؟
  const cooldownMins = status?.readyAt ? Math.max(0, Math.ceil((new Date(status.readyAt).getTime() - Date.now()) / 60000)) : 0;

  const send = async () => {
    setMsg(''); setErr(''); setBusy(true);
    try {
      const r = await api.post('/push/campaign', { title: title.trim(), body: body.trim(), url });
      setMsg(t('campaign.sent', { count: r.data.sent }));
      setTitle(''); setBody(''); setConfirm(false);
      load();
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const followers = status?.followers ?? 0;
  const dests = [
    { key: 'store', label: t('campaign.linkStore') },
    { key: 'offers', label: t('campaign.linkOffers') },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text"><MegaphoneIcon className="h-6 w-6" /> {t('campaign.title')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('campaign.hint')}</p>
      </div>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {err && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{err}</div>}

      {status && !status.enabled && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">{t('campaign.disabled')}</div>
      )}

      {/* عدد المتابِعين */}
      <div className="glass flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-300"><UsersIcon className="h-5 w-5" /></span>
        <div>
          <div className="font-display text-2xl font-bold text-stone-100">{followers}</div>
          <div className="text-xs text-stone-400">{t('campaign.followers')}</div>
        </div>
      </div>

      {status?.last && (
        <p className="text-xs text-stone-400">{t('campaign.lastSent', { title: status.last.title, count: status.last.sentCount })}</p>
      )}

      {/* المؤلّف */}
      <div className="glass space-y-4 p-6">
        <div>
          <label className="mb-1 block text-xs text-stone-400">{t('campaign.notifTitle')}</label>
          <input className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="✨ وصل جديد!" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-stone-400">{t('campaign.notifBody')}</label>
          <textarea className="input" rows={3} maxLength={160} value={body} onChange={(e) => setBody(e.target.value)} placeholder="تشكيلة الخريف صارت متوفّرة — تسوّقي قبل ما تخلص 🍂" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-stone-400">{t('campaign.link')}</label>
          <div className="grid grid-cols-2 gap-2">
            {dests.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDest(d.key)}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${dest === d.key ? 'bg-gold-400 text-ink-950 shadow-sm' : 'border border-gold-400/25 text-stone-300 hover:bg-gold-400/10'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {!confirm ? (
          <button
            disabled={!ready || followers === 0 || cooldownMins > 0 || (status && !status.enabled)}
            onClick={() => setConfirm(true)}
            className="btn-primary w-full gap-2 disabled:opacity-50"
          >
            <MegaphoneIcon className="h-5 w-5" /> {t('campaign.send')}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-sm text-stone-300">{t('campaign.confirm')}</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={send} className="btn-primary flex-1 gap-2 disabled:opacity-60">
                <CheckIcon className="h-5 w-5" /> {busy ? t('campaign.sending') : t('campaign.send')}
              </button>
              <button disabled={busy} onClick={() => setConfirm(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
            </div>
          </div>
        )}

        {followers === 0 && status?.enabled && <p className="text-xs text-stone-500">{t('campaign.noFollowers')}</p>}
        {cooldownMins > 0 && <p className="text-center text-xs text-amber-300">{t('campaign.cooldown', { mins: cooldownMins })}</p>}
      </div>
    </div>
  );
}

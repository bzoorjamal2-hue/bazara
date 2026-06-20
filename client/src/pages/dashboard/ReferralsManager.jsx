import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

// لوحة الإحالات لصاحب المتجر: من أحال ومن، وكم زبونة جاءت عبر كل كود.
export default function ReferralsManager() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/referrals').then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (error) return <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-700">{error}</div>;
  if (!data) return <Spinner />;

  const list = data.referrals || [];

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-bold gradient-text">🎁 {t('dashboard.referrals.title')}</h2>
      <p className="mb-5 text-sm text-stone-400">{t('dashboard.referrals.subtitle')}</p>

      {/* ملخّص */}
      <div className="glass mb-5 flex items-center justify-between p-4">
        <span className="text-sm text-stone-400">{t('dashboard.referrals.totalReferred')}</span>
        <span className="font-display text-3xl font-extrabold text-gold-300">{data.totalReferred || 0}</span>
      </div>

      {list.length === 0 ? (
        <div className="glass p-8 text-center text-sm text-stone-400">{t('dashboard.referrals.empty')}</div>
      ) : (
        <div className="space-y-2.5">
          {list.map((r) => (
            <div key={r.code} className="glass flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-100">{r.name || t('dashboard.referrals.noName')}</p>
                <p className="truncate text-xs text-stone-400" dir="ltr">{r.phone} · {r.code}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-700 ring-1 ring-emerald-500/20">
                {r.uses} <span className="text-xs font-medium">{t('referral.uses')}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

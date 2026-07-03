import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { TruckIcon, CheckIcon, LinkIcon } from './icons.jsx';
import VillageSearch from './VillageSearch.jsx';

// بطاقة ربط حساب شركة التوصيل gobox (نظام LogesTechs، company 15) — بنفس تجربة EPS:
// قبل الربط بريد/كلمة سر فقط، وبعد الربط تظهر إعدادات الاستلام (قرية + عنوان).
// gobox يعتمد القرى (villages) فقرية الاستلام تحمل region+city+village معاً.
export default function GoboxConnect() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null); // {connected, email, region, city, village, address}
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [village, setVillage] = useState(null); // { region, city, village, label }
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/gobox/status').then((r) => {
      setStatus(r.data);
      setAddress(r.data.address || '');
      // لو محفوظ سابقاً نعرضه كنصّ في الحقل (بلا إعادة بحث) — الاختيار يبقى صالحاً
      if (r.data.village) setVillage({ region: r.data.region, city: r.data.city, village: r.data.village, label: '' });
    }).catch(() => setStatus({ connected: false }));
  }, []);

  const connect = async () => {
    setMsg(''); setError('');
    if (!email.trim() || !password) { setError(t('dashboard.gobox.needCreds')); return; }
    setBusy(true);
    try {
      const r = await api.post('/gobox/connect', { email: email.trim(), password });
      setStatus({ connected: true, email: r.data.email, region: '', city: '', village: '', address: '' });
      setPassword('');
      setMsg(t('dashboard.gobox.connected'));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.post('/gobox/disconnect');
      setStatus({ connected: false, email: '', region: '', city: '', village: '', address: '' });
      setEmail(''); setVillage(null); setAddress('');
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  // حفظ قرية/عنوان الاستلام (بعد الربط) — مطلوبان قبل إرسال أول شحنة
  const saveOrigin = async () => {
    setMsg(''); setError('');
    if (!village?.village || !address.trim()) { setError(t('dashboard.gobox.needOrigin')); return; }
    setBusy(true);
    try {
      await api.put('/gobox/origin', { region: village.region, city: village.city, village: village.village, address: address.trim() });
      setStatus((s) => ({ ...s, region: village.region, city: village.city, village: village.village, address: address.trim() }));
      setMsg(t('dashboard.gobox.originSaved'));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <div className="glass space-y-4 p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow">
          <TruckIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-stone-100">{t('dashboard.gobox.title')}</h2>
          <p className="text-xs text-stone-400">{t('dashboard.gobox.subtitle')}</p>
        </div>
        {status.connected && (
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
            <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.gobox.active')}
          </span>
        )}
      </div>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* مربوط — إعدادات الاستلام */}
      {status.connected && (
        <div className="space-y-3">
          <p className="text-sm text-stone-300">
            {t('dashboard.gobox.connectedAs')} <span dir="ltr" className="font-bold text-stone-100">{status.email}</span>
          </p>
          {(!status.village || !status.address) && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {t('dashboard.gobox.setOriginHint')}
            </div>
          )}
          <div>
            <label className="label">{t('dashboard.gobox.originVillage')}</label>
            <VillageSearch value={village?.label || ''} onPick={setVillage} placeholder={t('dashboard.gobox.villagePh')} />
          </div>
          <div>
            <label className="label">{t('dashboard.gobox.originAddress')}</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('dashboard.gobox.originAddressPh')} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={saveOrigin} disabled={busy} className="btn-primary !py-2 !px-4 text-sm">
              {busy ? t('common.loading') : t('dashboard.gobox.saveOrigin')}
            </button>
            <button type="button" onClick={disconnect} disabled={busy} className="btn-ghost gap-1.5 text-sm text-red-300">
              {t('dashboard.gobox.disconnect')}
            </button>
          </div>
        </div>
      )}

      {/* غير مربوط — نموذج الدخول (بريد + كلمة سر فقط) */}
      {!status.connected && (
        <div className="space-y-3">
          <p className="text-sm text-stone-300">{t('dashboard.gobox.howto')}</p>
          <div>
            <label className="label">{t('dashboard.gobox.email')}</label>
            <input type="email" dir="ltr" className="input" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">{t('dashboard.gobox.password')}</label>
            <input type="password" dir="ltr" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <p className="text-xs text-stone-400">{t('dashboard.gobox.privacy')}</p>
          <button type="button" onClick={connect} disabled={busy} className="btn-primary gap-1.5">
            <LinkIcon className="h-4 w-4" /> {busy ? t('common.loading') : t('dashboard.gobox.connectBtn')}
          </button>
        </div>
      )}
    </div>
  );
}

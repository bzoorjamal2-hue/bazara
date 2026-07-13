import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { TruckIcon, CheckIcon, LinkIcon } from './icons.jsx';

// بطاقة ربط حساب شركة التوصيل EPS (نظام LogesTechs) — بنفس تجربة بطاقة أوبتيموس:
// قبل الربط بريد/كلمة سر فقط، وبعد الربط تظهر إعدادات الاستلام (المدينة والعنوان
// مطلوبان لأن نظامهم يشترط عنوان المصدر بكل شحنة). كلمة السر تُخزّن مشفّرة لدى الخادم.
export default function EpsConnect() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null); // {connected, email, city, address}
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cityId, setCityId] = useState('');
  const [address, setAddress] = useState('');
  const [cities, setCities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/eps/status').then((r) => {
      setStatus(r.data);
      setCityId(r.data.city || '');
      setAddress(r.data.address || '');
      if (r.data.connected) api.get('/eps/cities').then((c) => setCities(c.data.cities || [])).catch(() => {});
    }).catch(() => setStatus({ connected: false }));
  }, []);

  const connect = async () => {
    setMsg(''); setError('');
    if (!email.trim() || !password) { setError(t('dashboard.eps.needCreds')); return; }
    setBusy(true);
    try {
      const r = await api.post('/eps/connect', { email: email.trim(), password });
      setStatus({ connected: true, email: r.data.email, city: '', address: '' });
      setPassword('');
      setMsg(t('dashboard.eps.connected'));
      api.get('/eps/cities').then((c) => setCities(c.data.cities || [])).catch(() => {});
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.post('/eps/disconnect');
      setStatus({ connected: false, email: '', city: '', address: '' });
      setEmail(''); setCityId(''); setAddress('');
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  // حفظ مدينة/عنوان الاستلام (بعد الربط) — مطلوبان قبل إرسال أول شحنة
  const saveOrigin = async () => {
    setMsg(''); setError('');
    if (!cityId || !address.trim()) { setError(t('dashboard.eps.needOrigin')); return; }
    setBusy(true);
    try {
      await api.put('/eps/origin', { city: cityId, address: address.trim() });
      setStatus((s) => ({ ...s, city: cityId, address: address.trim() }));
      setMsg(t('dashboard.eps.originSaved'));
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
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow">
          <TruckIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-stone-100">{t('dashboard.eps.title')}</h2>
          <p className="text-xs text-stone-400">{t('dashboard.eps.subtitle')}</p>
        </div>
        {status.connected && (
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
            <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.eps.active')}
          </span>
        )}
      </div>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* مربوط — إعدادات الاستلام */}
      {status.connected && (
        <div className="space-y-3">
          <p className="text-sm text-stone-300">
            {t('dashboard.eps.connectedAs')} <span dir="ltr" className="font-bold text-stone-100">{status.email}</span>
          </p>
          {(!status.city || !status.address) && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {t('dashboard.eps.setOriginHint')}
            </div>
          )}
          <div>
            <label className="label">{t('dashboard.eps.originCity')}</label>
            <select className="input" value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value="">{t('dashboard.eps.choose')}</option>
              {cities.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('dashboard.eps.originAddress')}</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('dashboard.eps.originAddressPh')} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={saveOrigin} disabled={busy} className="btn-primary !py-2 !px-4 text-sm">
              {busy ? t('common.loading') : t('dashboard.eps.saveOrigin')}
            </button>
            <button type="button" onClick={disconnect} disabled={busy} className="btn-ghost gap-1.5 text-sm text-red-300">
              {t('dashboard.eps.disconnect')}
            </button>
          </div>
        </div>
      )}

      {/* غير مربوط — نموذج الدخول (بريد + كلمة سر فقط، مثل أوبتيموس) */}
      {!status.connected && (
        <div className="space-y-3">
          <p className="text-sm text-stone-300">{t('dashboard.eps.howto')}</p>
          <div>
            <label className="label">{t('dashboard.eps.email')}</label>
            <input type="email" dir="ltr" className="input" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">{t('dashboard.eps.password')}</label>
            <input type="password" dir="ltr" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <p className="text-xs text-stone-400">{t('dashboard.eps.privacy')}</p>
          <button type="button" onClick={connect} disabled={busy} className="btn-primary gap-1.5">
            <LinkIcon className="h-4 w-4" /> {busy ? t('common.loading') : t('dashboard.eps.connectBtn')}
          </button>
        </div>
      )}
    </div>
  );
}

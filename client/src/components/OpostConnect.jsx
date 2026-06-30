import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { TruckIcon, CheckIcon, LinkIcon } from './icons.jsx';

// بطاقة ربط حساب شركة التوصيل أوبتيموس (Opost) — لكل متجر حسابه الخاص.
// مستقلّة بحالتها واستدعاءاتها (خارج فورم الإعدادات حتى لا يتعارض الإرسال).
export default function OpostConnect() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null); // {enabled, connected, email, businessAddress}
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [addresses, setAddresses] = useState([]); // عناوين الاستلام لو أكثر من واحد
  const [types, setTypes] = useState([]); // أنواع الشحن لاختيار الافتراضي
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/opost/status').then((r) => {
      setStatus(r.data);
      if (r.data.connected) api.get('/opost/shipment-types').then((t2) => setTypes(t2.data.types || [])).catch(() => {});
    }).catch(() => setStatus({ enabled: false, connected: false }));
  }, []);

  const setShipmentType = async (id) => {
    setStatus((s) => ({ ...s, shipmentType: id }));
    try { await api.put('/opost/shipment-type', { shipmentType: id }); } catch { /* غير حرج */ }
  };

  const connect = async () => {
    setMsg(''); setError('');
    if (!email.trim() || !password) { setError(t('dashboard.opost.needCreds')); return; }
    setBusy(true);
    try {
      const r = await api.post('/opost/connect', { email: email.trim(), password });
      setStatus((s) => ({ ...s, connected: true, email: r.data.email, businessAddress: r.data.businessAddress }));
      setAddresses(Array.isArray(r.data.addresses) ? r.data.addresses : []);
      setPassword('');
      setMsg(t('dashboard.opost.connected'));
      api.get('/opost/shipment-types').then((t2) => setTypes(t2.data.types || [])).catch(() => {});
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.post('/opost/disconnect');
      setStatus((s) => ({ ...s, connected: false, email: '', businessAddress: '' }));
      setAddresses([]); setEmail('');
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const setAddress = async (id) => {
    setStatus((s) => ({ ...s, businessAddress: id }));
    try { await api.put('/opost/address', { businessAddress: id }); } catch { /* غير حرج */ }
  };

  if (!status) return null;

  return (
    <div className="glass space-y-4 p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow">
          <TruckIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-stone-100">{t('dashboard.opost.title')}</h2>
          <p className="text-xs text-stone-400">{t('dashboard.opost.subtitle')}</p>
        </div>
        {status.connected && (
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
            <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.opost.active')}
          </span>
        )}
      </div>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* المنصّة لم تُفعّل الربط بعد (مفاتيح التطبيق غير مضبوطة) */}
      {!status.enabled && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {t('dashboard.opost.notEnabled')}
        </div>
      )}

      {/* مربوط */}
      {status.enabled && status.connected && (
        <div className="space-y-3">
          <p className="text-sm text-stone-300">
            {t('dashboard.opost.connectedAs')} <span dir="ltr" className="font-bold text-stone-100">{status.email}</span>
          </p>
          {addresses.length > 1 && (
            <div>
              <label className="label">{t('dashboard.opost.pickupAddress')}</label>
              <select className="input" value={status.businessAddress || ''} onChange={(e) => setAddress(e.target.value)}>
                {addresses.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {types.length > 0 && (
            <div>
              <label className="label">{t('dashboard.opost.defaultType')}</label>
              <select className="input" value={status.shipmentType || ''} onChange={(e) => setShipmentType(e.target.value)}>
                <option value="">{t('dashboard.opost.choose')}</option>
                {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-stone-400">{t('dashboard.opost.defaultTypeHint')}</p>
            </div>
          )}
          <button type="button" onClick={disconnect} disabled={busy} className="btn-ghost gap-1.5 text-sm text-red-300">
            {t('dashboard.opost.disconnect')}
          </button>
        </div>
      )}

      {/* غير مربوط — نموذج الدخول */}
      {status.enabled && !status.connected && (
        <div className="space-y-3">
          <p className="text-sm text-stone-300">{t('dashboard.opost.howto')}</p>
          <div>
            <label className="label">{t('dashboard.opost.email')}</label>
            <input type="email" dir="ltr" className="input" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">{t('dashboard.opost.password')}</label>
            <input type="password" dir="ltr" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <p className="text-xs text-stone-400">{t('dashboard.opost.privacy')}</p>
          <button type="button" onClick={connect} disabled={busy} className="btn-primary gap-1.5">
            <LinkIcon className="h-4 w-4" /> {busy ? t('common.loading') : t('dashboard.opost.connectBtn')}
          </button>
        </div>
      )}
    </div>
  );
}

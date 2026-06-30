import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Select from './Select.jsx';
import { TruckIcon, CheckIcon } from './icons.jsx';

// تخزين مؤقّت لمناطق كل مدينة (مشترك بين كل الطلبات) — يقلّل استدعاءات الـ API
const areaCache = new Map();

// زر "إرسال لأوبتيموس" لطلب واحد + لوحة اختيار المدينة/المنطقة/نوع الشحنة.
// props: order, cities[], types[], onSent(orderId, tracking)
export default function OpostSend({ order, cities = [], types = [], onSent }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cityId, setCityId] = useState('');
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState('');
  const [typeId, setTypeId] = useState(types[0]?.id ? String(types[0].id) : '');
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(order.opostTracking || '');

  // أُرسل مسبقاً → نعرض رقم التتبّع فقط
  if (tracking) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
        <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.opost.tracked')}: <span dir="ltr">{tracking}</span>
      </span>
    );
  }

  const pickCity = async (id) => {
    setCityId(id); setAreaId(''); setAreas([]); setError('');
    if (!id) return;
    if (areaCache.has(id)) { setAreas(areaCache.get(id)); return; }
    setLoadingAreas(true);
    try {
      const r = await api.get('/opost/areas', { params: { city: id } });
      const list = r.data.areas || [];
      areaCache.set(id, list);
      setAreas(list);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoadingAreas(false);
    }
  };

  const send = async () => {
    setError('');
    if (!cityId || !areaId) { setError(t('dashboard.opost.pickCityArea')); return; }
    setBusy(true);
    try {
      const r = await api.post(`/opost/orders/${order.id}/send`, { city: cityId, area: areaId, shipmentType: typeId });
      setTracking(r.data.tracking || '✓');
      setOpen(false);
      onSent?.(order.id, r.data.tracking);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-xl border border-violet-400/40 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/10"
      >
        <TruckIcon className="inline h-4 w-4" /> {t('dashboard.opost.sendBtn')}
      </button>
    );
  }

  return (
    <div className="mt-1 w-full space-y-2 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
      <p className="text-xs font-semibold text-violet-200">{t('dashboard.opost.sendTitle')}</p>
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{error}</div>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.opost.city')}</label>
          <Select value={cityId} onChange={pickCity} placeholder={t('dashboard.opost.choose')}
            options={cities.map((c) => ({ value: String(c.id), label: c.name }))} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.opost.area')}</label>
          <Select value={areaId} onChange={setAreaId} placeholder={loadingAreas ? t('common.loading') : t('dashboard.opost.choose')}
            options={areas.map((a) => ({ value: String(a.id), label: a.name }))} />
        </div>
        {types.length > 0 && (
          <div>
            <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.opost.type')}</label>
            <Select value={typeId} onChange={setTypeId} placeholder={t('dashboard.opost.choose')}
              options={types.map((ty) => ({ value: String(ty.id), label: ty.name }))} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={send} disabled={busy} className="btn-primary !py-1.5 !px-3 gap-1.5 text-xs">
          {busy ? t('common.loading') : <><TruckIcon className="h-4 w-4" /> {t('dashboard.opost.confirmSend')}</>}
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost !py-1.5 !px-3 text-xs">{t('common.cancel')}</button>
      </div>
    </div>
  );
}

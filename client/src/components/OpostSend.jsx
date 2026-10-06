import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Select from './Select.jsx';
import { TruckIcon, CheckIcon } from './icons.jsx';
import { opostAreas, opostAuto, opostDetail } from '../utils/courierAuto.js';

// زر "إرسال لأوبتيموس" — يطابق المدينة/المنطقة تلقائياً من الطلب ويبعت بضغطة،
// ويفتح الاختيار اليدوي فقط لو ما قدر يطابق. props: order, cities[], types[], onSent
// big: زرٌّ رئيسيٌّ عريضٌ بشريطِ الحالة · autoStart: يبدأُ الإرسالَ الذكيَّ فورَ ظهوره
export default function OpostSend({ order, cities = [], types = [], defaultType = '', onSent, big = false, autoStart = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cityId, setCityId] = useState('');
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState('');
  const [typeId, setTypeId] = useState(String(defaultType || types[0]?.id || ''));
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [tracking, setTracking] = useState(order.opostTracking || '');

  // «ابعتي لـ…» من الصفّ المطويّ: يبدأُ الإرسالُ فورَ فتحِ البطاقة، مرّةً واحدة.
  // الخطّافاتُ قبلَ أيِّ رجوعٍ مبكّر — والدالّةُ تُقرَأُ من مرجعٍ يُملأُ أدناه.
  const started = useRef(false);
  const smartRef = useRef(null);
  useEffect(() => {
    if (autoStart && !started.current && !tracking) { started.current = true; smartRef.current?.(); }
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // أُرسل مسبقاً → نعرض رقم التتبّع فقط
  if (tracking) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
        <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.opost.tracked')}: <span dir="ltr">{tracking}</span>
      </span>
    );
  }

  const loadAreas = async (id) => {
    setLoadingAreas(true);
    try {
      const list = await opostAreas(id);
      setAreas(list);
      return list;
    } catch (e) {
      setError(getErrorMessage(e));
      return [];
    } finally {
      setLoadingAreas(false);
    }
  };

  const pickCity = async (id) => {
    setCityId(id); setAreaId(''); setAreas([]); setError('');
    if (id) await loadAreas(id);
  };

  // العنوان التفصيلي = عنوان الزبون بعد إزالة اسم المدينة والقرية (اللي راحوا لحقلَي
  // المدينة والمنطقة) — يبقى الوصف الإضافي فقط بلا تكرار. اسم القرية نمرّره لتنظيفه.
  const detailFor = (areaName) => opostDetail(order, areaName);

  const doSend = async (c, a, ty, detail) => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/opost/orders/${order.id}/send`, { city: c, area: a, shipmentType: ty, address: detail ?? '' });
      setTracking(r.data.tracking || '✓');
      setOpen(false);
      onSent?.(order.id, r.data.tracking);
    } catch (e) {
      setError(getErrorMessage(e));
      setOpen(true); // عند الفشل افتح الاختيار اليدوي
    } finally {
      setBusy(false);
    }
  };

  // الضغطة الأساسية: مطابقة تلقائية عالية الدقّة ثم إرسال مباشر بضغطة واحدة.
  // نطابق المحافظة من مدينة الزبون (ثم عنوانه)، ونطابق القرية/المنطقة من العنوان
  // بمطابقة قائمة على الكلمات (bestMatchScored). عند ثقة كافية نُرسل فوراً؛ وإلا
  // نفتح اللوحة مع أفضل ترشيح لتأكيد سريع — حتى لا تروح شحنة بمنطقة غلط.
  const handleSmartSend = async () => {
    setError(''); setHint('');
    setBusy(true);
    let a;
    try { a = await opostAuto(order, { cities, shipmentType: typeId }); } catch (e) { setError(getErrorMessage(e)); setBusy(false); setOpen(true); return; }
    // ثقة كافية → إرسال مباشر بلا فتح اللوحة (utils/courierAuto.js)
    if (a.ok) { await doSend(a.body.city, a.body.area, a.body.shipmentType, a.body.address); return; }
    // غير مؤكّد: نفتح اللوحة مع أفضل ترشيح لتأكيد بضغطة
    if (a.cityId) { setCityId(a.cityId); setAreas(a.areas || []); }
    setAreaId(a.areaId || '');
    setHint(t(a.reason === 'verifyArea' ? 'dashboard.opost.verifyArea' : 'dashboard.opost.pickAreaHint'));
    setBusy(false);
    setOpen(true);
  };

  smartRef.current = handleSmartSend;

  // الزر الرئيسي (قبل فتح اللوحة)
  if (!open) {
    return (
      <button
        onClick={handleSmartSend}
        disabled={busy}
        className={big
          ? 'bz-ost-next bz-st-shipped flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:opacity-60'
          : 'inline-flex items-center gap-1 rounded-xl bg-wine px-3 py-1.5 text-xs font-semibold text-cream shadow-sm transition hover:bg-wine-dark disabled:opacity-60'}
      >
        <TruckIcon className={big ? 'h-[18px] w-[18px]' : 'inline h-4 w-4'} /> {busy ? t('common.loading') : t('dashboard.opost.sendBtn')}
      </button>
    );
  }

  // اللوحة اليدوية (عند تعذّر المطابقة التلقائية أو فشل الإرسال)
  return (
    <div className="mt-1 w-full space-y-2 rounded-xl border border-gold-400/20 bg-gold-400/5 p-3">
      <p className="text-xs font-semibold text-gold-200">{t('dashboard.opost.sendTitle')}</p>
      {hint && <div className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">{hint}</div>}
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
        <button
          onClick={() => { if (!cityId || !areaId) { setError(t('dashboard.opost.pickCityArea')); return; } doSend(cityId, areaId, typeId, detailFor(areas.find((x) => String(x.id) === String(areaId))?.name)); }}
          disabled={busy}
          className="btn-primary !py-1.5 !px-3 gap-1.5 text-xs"
        >
          {busy ? t('common.loading') : <><TruckIcon className="h-4 w-4" /> {t('dashboard.opost.confirmSend')}</>}
        </button>
        <button onClick={() => { setOpen(false); setHint(''); setError(''); }} className="btn-ghost !py-1.5 !px-3 text-xs">{t('common.cancel')}</button>
      </div>
    </div>
  );
}

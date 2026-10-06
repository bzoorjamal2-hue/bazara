import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Select from './Select.jsx';
import { TruckIcon, CheckIcon, ReceiptIcon } from './icons.jsx';
import { epsAuto } from '../utils/courierAuto.js';

// زر "إرسال لـ EPS" — نظام LogesTechs يعتمد المدينة فقط (بلا مناطق):
// يطابق مدينة الزبون تلقائياً ويبعت بضغطة عند التطابق المؤكّد، وإلا يفتح الاختيار اليدوي.
// props: order, cities[], onSent
export default function EpsSend({ order, cities = [], onSent, big = false, autoStart = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cityId, setCityId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [tracking, setTracking] = useState(order.epsTracking || '');
  const [awbBusy, setAwbBusy] = useState(false);

  // فتح بوليصة الشحن PDF (بعد الإرسال)
  const openAwb = async () => {
    setAwbBusy(true);
    try {
      const r = await api.get(`/eps/orders/${order.id}/awb`);
      if (r.data.url) window.open(r.data.url, '_blank', 'noopener');
    } catch { /* غير حرج */ } finally {
      setAwbBusy(false);
    }
  };

  // «ابعتي لـ…» من الصفّ المطويّ: يبدأُ الإرسالُ فورَ فتحِ البطاقة، مرّةً واحدة
  const started = useRef(false);
  const smartRef = useRef(null);
  useEffect(() => {
    if (autoStart && !started.current && !tracking) { started.current = true; smartRef.current?.(); }
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // أُرسل مسبقاً → رقم التتبّع + زر البوليصة
  if (tracking) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
          <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.eps.tracked')}: <span dir="ltr">{tracking}</span>
        </span>
        <button onClick={openAwb} disabled={awbBusy} title={t('dashboard.eps.awb')}
          className="inline-flex items-center gap-1 rounded-xl border border-stone-500/30 px-2.5 py-1.5 text-xs font-semibold text-stone-300 transition hover:bg-stone-500/10 disabled:opacity-60">
          <ReceiptIcon className="h-3.5 w-3.5" /> {awbBusy ? '…' : t('dashboard.eps.awb')}
        </button>
      </span>
    );
  }

  const doSend = async (c) => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/eps/orders/${order.id}/send`, { city: c });
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

  // الضغطة الأساسية: مطابقة تلقائية للمدينة. نرسل مباشرة فقط عند التطابق التام
  // مع مدينة الزبون المكتوبة — غير هيك نفتح اللوحة للتأكيد (الدقّة أهمّ).
  const handleSmartSend = () => {
    setError(''); setHint('');
    const a = epsAuto(order, cities); // utils/courierAuto.js
    if (a.ok) { doSend(a.body.city); return; }
    if (a.cityId) setCityId(a.cityId);
    setHint(t(a.reason === 'verifyCity' ? 'dashboard.eps.verifyCity' : 'dashboard.eps.pickCityHint'));
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
        <TruckIcon className={big ? 'h-[18px] w-[18px]' : 'inline h-4 w-4'} /> {busy ? t('common.loading') : t('dashboard.eps.sendBtn')}
      </button>
    );
  }

  // اللوحة اليدوية (عند تعذّر المطابقة أو فشل الإرسال)
  return (
    <div className="mt-1 w-full space-y-2 rounded-xl border border-gold-400/25 bg-gold-400/10 p-3">
      <p className="text-xs font-semibold text-gold-200">{t('dashboard.eps.sendTitle')}</p>
      {hint && <div className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">{hint}</div>}
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{error}</div>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.eps.city')}</label>
          <Select value={cityId} onChange={setCityId} placeholder={t('dashboard.eps.choose')}
            options={cities.map((c) => ({ value: String(c.id), label: c.name }))} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (!cityId) { setError(t('dashboard.eps.pickCity')); return; } doSend(cityId); }}
          disabled={busy}
          className="btn-primary !py-1.5 !px-3 gap-1.5 text-xs"
        >
          {busy ? t('common.loading') : <><TruckIcon className="h-4 w-4" /> {t('dashboard.eps.confirmSend')}</>}
        </button>
        <button onClick={() => { setOpen(false); setHint(''); setError(''); }} className="btn-ghost !py-1.5 !px-3 text-xs">{t('common.cancel')}</button>
      </div>
    </div>
  );
}

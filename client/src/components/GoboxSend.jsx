import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { TruckIcon, CheckIcon, ReceiptIcon } from './icons.jsx';
import VillageSearch from './VillageSearch.jsx';

// زر "إرسال لـ gobox" — نظام LogesTechs يعتمد القرى (villages) الدقيقة، والقرية الواحدة
// تحمل region+city+village معاً. لأنها دقيقة جداً (لا يمكن تخمينها من اسم المدينة)،
// نفتح لوحة بحث مُعبّأة بمدينة الزبون ليختار المالك القرية الصحيحة ثم يرسل.
// props: order, onSent
export default function GoboxSend({ order, onSent }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [village, setVillage] = useState(null); // { region, city, village, label }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(order.goboxTracking || '');
  const [awbBusy, setAwbBusy] = useState(false);

  const openAwb = async () => {
    setAwbBusy(true);
    try {
      const r = await api.get(`/gobox/orders/${order.id}/awb`);
      if (r.data.url) window.open(r.data.url, '_blank', 'noopener');
    } catch { /* غير حرج */ } finally {
      setAwbBusy(false);
    }
  };

  // أُرسل مسبقاً → رقم التتبّع + زر البوليصة
  if (tracking) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
          <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.gobox.tracked')}: <span dir="ltr">{tracking}</span>
        </span>
        <button onClick={openAwb} disabled={awbBusy} title={t('dashboard.gobox.awb')}
          className="inline-flex items-center gap-1 rounded-xl border border-stone-500/30 px-2.5 py-1.5 text-xs font-semibold text-stone-300 transition hover:bg-stone-500/10 disabled:opacity-60">
          <ReceiptIcon className="h-3.5 w-3.5" /> {awbBusy ? '…' : t('dashboard.gobox.awb')}
        </button>
      </span>
    );
  }

  const doSend = async () => {
    if (!village?.village) { setError(t('dashboard.gobox.pickVillage')); return; }
    setBusy(true); setError('');
    try {
      const r = await api.post(`/gobox/orders/${order.id}/send`, {
        region: village.region, city: village.city, village: village.village,
      });
      setTracking(r.data.tracking || '✓');
      setOpen(false);
      onSent?.(order.id, r.data.tracking);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // الزر الرئيسي (قبل فتح اللوحة)
  if (!open) {
    return (
      <button
        onClick={() => { setError(''); setOpen(true); }}
        className="inline-flex items-center gap-1 rounded-xl bg-orange-700 px-3 py-1.5 text-xs font-semibold text-cream shadow-sm transition hover:bg-orange-800"
      >
        <TruckIcon className="inline h-4 w-4" /> {t('dashboard.gobox.sendBtn')}
      </button>
    );
  }

  // لوحة اختيار القرية — مُعبّأة بمدينة الزبون
  return (
    <div className="mt-1 w-full space-y-2 rounded-xl border border-orange-400/20 bg-orange-400/5 p-3">
      <p className="text-xs font-semibold text-orange-200">{t('dashboard.gobox.sendTitle')}</p>
      <div className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">{t('dashboard.gobox.pickVillageHint')}</div>
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{error}</div>}
      <div>
        <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.gobox.village')}</label>
        <VillageSearch value="" onPick={setVillage} initialQuery={order.city || ''} placeholder={t('dashboard.gobox.villagePh')} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={doSend}
          disabled={busy}
          className="btn-primary !py-1.5 !px-3 gap-1.5 text-xs"
        >
          {busy ? t('common.loading') : <><TruckIcon className="h-4 w-4" /> {t('dashboard.gobox.confirmSend')}</>}
        </button>
        <button onClick={() => { setOpen(false); setError(''); }} className="btn-ghost !py-1.5 !px-3 text-xs">{t('common.cancel')}</button>
      </div>
    </div>
  );
}

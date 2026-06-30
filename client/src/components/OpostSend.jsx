import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Select from './Select.jsx';
import { TruckIcon, CheckIcon } from './icons.jsx';

// تخزين مؤقّت لمناطق كل مدينة (مشترك بين كل الطلبات) — يقلّل استدعاءات الـ API
const areaCache = new Map();

// تطبيع نص عربي للمطابقة: إزالة التشكيل/أل التعريف/الفواصل وتوحيد الألف والياء والتاء المربوطة
const norm = (s) =>
  String(s || '')
    .replace(/[ً-ْ]/g, '')
    .replace(/\(.*?\)/g, ' ') // إزالة اسم المدينة بين قوسين بأسماء المناطق: "عابا الغربية (جنين)"
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\bال/g, '')
    .replace(/[-_،,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// أفضل تطابق بالاسم بين نص حرّ وقائمة {id,name} — بعتبة تمنع المطابقة الخاطئة
function bestMatch(text, list) {
  const nt = norm(text);
  if (!nt || !Array.isArray(list)) return null;
  let best = null;
  for (const it of list) {
    const nn = norm(it.name);
    if (nn.length < 3) continue;
    let score = 0;
    if (nt === nn) score = 100;
    else if (nt.includes(nn)) score = 50 + nn.length;
    else if (nn.includes(nt)) score = 40 + nt.length;
    if (score > (best?.score || 0)) best = { it, score };
  }
  return best && best.score >= 43 ? best.it : null;
}

// زر "إرسال لأوبتيموس" — يطابق المدينة/المنطقة تلقائياً من الطلب ويبعت بضغطة،
// ويفتح الاختيار اليدوي فقط لو ما قدر يطابق. props: order, cities[], types[], onSent
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
  const [hint, setHint] = useState('');
  const [tracking, setTracking] = useState(order.opostTracking || '');

  // أُرسل مسبقاً → نعرض رقم التتبّع فقط
  if (tracking) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
        <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.opost.tracked')}: <span dir="ltr">{tracking}</span>
      </span>
    );
  }

  const loadAreas = async (id) => {
    if (areaCache.has(id)) { setAreas(areaCache.get(id)); return areaCache.get(id); }
    setLoadingAreas(true);
    try {
      const r = await api.get('/opost/areas', { params: { city: id } });
      const list = r.data.areas || [];
      areaCache.set(id, list);
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

  const doSend = async (c, a, ty) => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/opost/orders/${order.id}/send`, { city: c, area: a, shipmentType: ty });
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

  // الضغطة الأساسية: مطابقة تلقائية. لا نرسل تلقائياً إلا عند تطابق المنطقة
  // المؤكّد (مطابقة تامّة)؛ غير هيك نفتح اللوحة بالمدينة معبّأة لتأكيد المنطقة
  // قبل الإرسال — حتى لا يروح طلب بمنطقة غلط (الدقّة أهمّ).
  const handleSmartSend = async () => {
    setError(''); setHint('');
    const city = bestMatch(order.city, cities) || bestMatch(order.address, cities);
    if (!city) { setOpen(true); return; } // لا مدينة مطابقة → اختيار يدوي
    setBusy(true);
    const list = await loadAreas(String(city.id));
    setCityId(String(city.id));
    const area = bestMatch(order.address, list);
    const nad = norm(order.address);
    // تطابق "مؤكّد" = اسم المنطقة مطابق تماماً للعنوان أو العنوان يبدأ به
    const exact = area && (norm(area.name) === nad || nad.startsWith(norm(area.name) + ' '));
    if (exact) { await doSend(String(city.id), String(area.id), typeId); return; }
    // غير مؤكّد: نفتح اللوحة. إن وُجد ترشيح نختاره ونطلب التأكيد، وإلا يختار يدوياً
    if (area) { setAreaId(String(area.id)); setHint(t('dashboard.opost.verifyArea')); }
    else { setAreaId(''); setHint(t('dashboard.opost.pickAreaHint')); }
    setBusy(false);
    setOpen(true);
  };

  // الزر الرئيسي (قبل فتح اللوحة)
  if (!open) {
    return (
      <button
        onClick={handleSmartSend}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-xl bg-wine px-3 py-1.5 text-xs font-semibold text-cream shadow-sm transition hover:bg-wine-dark disabled:opacity-60"
      >
        <TruckIcon className="inline h-4 w-4" /> {busy ? t('common.loading') : t('dashboard.opost.sendBtn')}
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
          onClick={() => { if (!cityId || !areaId) { setError(t('dashboard.opost.pickCityArea')); return; } doSend(cityId, areaId, typeId); }}
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

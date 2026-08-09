import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { buildWhatsappLink, waCandidates } from '../../utils/whatsapp.js';
import { BellIcon, WhatsAppIcon, TrashIcon, BagIcon, PinIcon, NoteIcon } from '../../components/icons.jsx';
import { sizeLabel } from '../../utils/sizes.js';
import { useCouriers, syncCourierStatuses, courierOf, CourierLock, CourierSend } from '../../components/couriers.jsx';
import { cldThumb } from '../../utils/cloudinary.js';

const FLOW = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const BADGE = {
  new: 'bg-amber-500/20 text-amber-700',
  confirmed: 'bg-gold-400/20 text-gold-200',
  shipped: 'bg-wine/10 text-wine',
  delivered: 'bg-emerald-500/20 text-emerald-200',
  cancelled: 'bg-red-500/20 text-red-200',
};

export default function StockRequestsManager() {
  const { t } = useTranslation();
  const [reqs, setReqs] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openForm, setOpenForm] = useState(''); // id طلب التوفّر المفتوح نموذج تحويله
  const [busy, setBusy] = useState('');
  // مناطق التوصيل وأجورها (نفس ما يراه الزبون بالسلة) — تُجلب عند أول فتح لنموذج التحويل
  const [zones, setZones] = useState(null);
  // شركات التوصيل (نفس صفحة الطلبات تماماً) — حالة الربط والمدن مرّة واحدة
  const couriers = useCouriers();

  const load = () => api.get('/stock-requests').then(async (r) => {
    const list = r.data.requests;
    setReqs(list);
    // حالات الشحنات الحيّة للطلبات المُحوَّلة والمُرسلة لشركة توصيل
    const patch = await syncCourierStatuses(list.map((x) => x.order));
    if (patch) {
      setReqs((prev) => prev.map((x) => (x.order && patch[x.order.id] ? { ...x, order: { ...x.order, ...patch[x.order.id] } } : x)));
    }
  }).catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const toggleForm = (id) => {
    setOpenForm((cur) => (cur === id ? '' : id));
    if (zones === null) {
      setZones([]); // لا نكرّر الجلب
      api.get('/stores/me').then((r) => setZones(Array.isArray(r.data.store?.deliveryZones) ? r.data.store.deliveryZones : [])).catch(() => {});
    }
  };

  const patchReq = (id, patch) => setReqs((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const patchOrder = (orderId, patch) =>
    setReqs((prev) => prev.map((x) => (x.order?.id === orderId ? { ...x, order: { ...x.order, ...patch } } : x)));

  const remove = async (id) => {
    setReqs((prev) => prev.filter((x) => x.id !== id));
    try { await api.delete(`/stock-requests/${id}`); } catch (e) { setError(getErrorMessage(e)); load(); }
  };

  // تحويل طلب التوفّر إلى طلب حقيقي بالمتجر (يُدار ويُشحن من هنا)
  const convert = async (r, form) => {
    if (!form.name.trim()) { setError(t('dashboard.stockRequests.needName')); return; }
    setBusy(r.id); setError('');
    try {
      const res = await api.post(`/stock-requests/${r.id}/convert`, form);
      patchReq(r.id, { order: res.data.order });
      setOpenForm('');
      try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const setStatus = async (orderId, status) => {
    patchOrder(orderId, { status }); // تفاؤلي
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
    } catch (e) { setError(getErrorMessage(e)); }
  };

  // أُرسل لشركة توصيل → رقم التتبّع + الحالة تصير مُقفلة (تُدار من عندهم)
  const markSent = (orderId, tracking, courier) => {
    const field = courier === 'eps' ? 'epsTracking' : courier === 'gobox' ? 'goboxTracking' : 'opostTracking';
    patchOrder(orderId, { [field]: tracking || '✓', status: 'shipped' });
    try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
  };

  if (reqs === null && !error) return <Spinner />;

  const counts = {
    all: reqs?.length || 0,
    ready: (reqs || []).filter((r) => r.inStock && !r.order).length,
    waiting: (reqs || []).filter((r) => !r.inStock && !r.order).length,
    converted: (reqs || []).filter((r) => r.order).length,
  };
  const term = q.trim().toLowerCase();
  const termDigits = term.replace(/\D/g, '');
  const visible = (reqs || []).filter((r) => {
    if (filter === 'ready' && !(r.inStock && !r.order)) return false;
    if (filter === 'waiting' && !(!r.inStock && !r.order)) return false;
    if (filter === 'converted' && !r.order) return false;
    if (!term) return true;
    return (
      (r.productName || '').toLowerCase().includes(term) ||
      (termDigits.length >= 3 && (r.phone || '').replace(/\D/g, '').includes(termDigits))
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text"><BellIcon className="h-6 w-6" /> {t('dashboard.stockRequests.title')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('dashboard.stockRequests.hint')}</p>
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* بحث وفلترة — للوصول لأي طلب توفّر بثوانٍ عندما تكثر */}
      {counts.all > 3 && (
        <div className="glass space-y-2.5 p-3">
          <input className="input" placeholder={t('dashboard.stockRequests.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {['all', 'ready', 'waiting', 'converted'].map((s) => {
              if (s !== 'all' && !counts[s]) return null;
              const on = filter === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    on ? 'bg-gold-400 text-wine-dark shadow-sm' : 'bg-white/5 text-stone-300 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {s === 'all' ? t('common.all') : t(`dashboard.stockRequests.filters.${s}`)}
                  <span className={`rounded-full px-1.5 text-[10px] font-bold ${on ? 'bg-wine/15 text-wine-dark' : 'bg-white/10 text-stone-400'}`}>{counts[s]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {reqs && reqs.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.stockRequests.empty')}</div>
      ) : !visible.length ? (
        <div className="glass p-8 text-center text-sm text-stone-400">{t('dashboard.stockRequests.noResults')}</div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              zones={zones || []}
              couriers={couriers}
              busy={busy === r.id}
              formOpen={openForm === r.id}
              onToggleForm={() => toggleForm(r.id)}
              onConvert={(form) => convert(r, form)}
              onStatus={setStatus}
              onSent={markSent}
              onRemove={() => remove(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ r, zones, couriers, busy, formOpen, onToggleForm, onConvert, onStatus, onSent, onRemove }) {
  const { t } = useTranslation();
  const variant = [r.color, r.size ? sizeLabel(r.size, t) : ''].filter(Boolean).join(' · ');
  const link = `${window.location.origin}/share/product/${r.productId}`;
  const waMsg = t('dashboard.stockRequests.waMsg', { name: r.productName, variant: variant ? ` (${variant})` : '', link });
  const nums = waCandidates(r.phone);
  const o = r.order;
  const img = r.productImage ? cldThumb(r.productImage, 160) : '';

  return (
    <div className={`glass p-4 ${!o && r.inStock ? 'ring-1 ring-emerald-400/40' : ''}`}>
      {/* رأس البطاقة: صورة المنتج + اسمه + حالته */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {img ? (
            <img src={img} alt="" loading="lazy" className="h-16 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
          ) : (
            <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5 text-stone-500"><BagIcon className="h-5 w-5" /></div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-stone-100">{r.productName}</p>
              {o ? (
                <span className={`badge ${BADGE[o.status] || ''}`}>{t(`dashboard.ordersSection.${o.status}`)}</span>
              ) : (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  r.inStock ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25' : 'bg-stone-500/10 text-stone-400'
                }`}>
                  {r.inStock ? t('dashboard.stockRequests.inStockNow') : t('dashboard.stockRequests.stillOut')}
                </span>
              )}
            </div>
            {variant && <p className="mt-0.5 text-xs text-gold-200">{variant}</p>}
            <p className="mt-0.5 text-xs text-stone-400">
              <a href={`tel:${String(r.phone).replace(/\s/g, '')}`} dir="ltr" className="underline-offset-2 hover:text-gold-200 hover:underline">{r.phone}</a>
              {' · '}{new Date(r.createdAt).toLocaleDateString()}
              {r.price != null && <> · <span className="text-gold-300">{t('common.currency')}{r.price.toFixed(0)}</span></>}
            </p>
          </div>
        </div>
        <button onClick={onRemove} aria-label={t('common.remove')} className="rounded-lg p-2 text-stone-400 transition hover:text-red-300"><TrashIcon className="h-4 w-4" /></button>
      </div>

      {/* ملخّص الطلب بعد التحويل (عنوان + إجمالي) */}
      {o && (
        <div className="mt-3 border-t border-white/5 pt-2 text-xs text-stone-400">
          <p><span className="text-stone-300">{o.customerName}</span>{o.city ? <> · <PinIcon className="inline h-3.5 w-3.5" /> {o.city}</> : null}{o.address ? ` — ${o.address}` : ''}</p>
          {o.notes && <p className="mt-1 flex items-center gap-1"><NoteIcon className="h-3.5 w-3.5 shrink-0" /> {o.notes}</p>}
          <p className="mt-1">
            {(o.items || []).map((it) => `${it.name} ×${it.qty}`).join(' · ')}
            {' — '}
            <span className="font-display text-sm font-bold text-gold-300">{t('common.currency')}{Number(o.total).toFixed(2)}</span>
          </p>
        </div>
      )}

      {/* الأزرار: تواصل + تحويل لطلب، وبعد التحويل الحالة والشحن لشركة التوصيل */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {nums[0] && (
          <a
            href={buildWhatsappLink(r.phone, waMsg)}
            target="_blank"
            rel="noreferrer"
            className={`btn-whatsapp gap-1.5 !px-3 !py-1.5 text-xs ${!o && r.inStock ? 'ring-2 ring-emerald-400/50' : ''}`}
          >
            <WhatsAppIcon className="h-4 w-4" /> {r.inStock ? t('dashboard.stockRequests.notifyReady') : t('dashboard.stockRequests.notify')}
          </a>
        )}
        {nums[1] && (
          <a href={`https://wa.me/${nums[1]}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer" title={t('dashboard.ordersSection.waAltHint')} className="btn-whatsapp gap-1 !px-2.5 !py-1.5 text-xs opacity-80">
            <WhatsAppIcon className="h-4 w-4" /> <span dir="ltr">+{nums[1].slice(0, 3)}</span>
          </a>
        )}

        {!o && (
          <button
            onClick={onToggleForm}
            className="inline-flex items-center gap-1 rounded-xl bg-gold-400 px-3 py-1.5 text-xs font-bold text-wine-dark shadow-sm transition hover:bg-gold-300"
          >
            <BagIcon className="h-4 w-4" /> {formOpen ? t('common.cancel') : t('dashboard.stockRequests.convert')}
          </button>
        )}

        {o && (
          <>
            <span className="text-xs text-stone-400">{t('dashboard.ordersSection.updateStatus')}:</span>
            {courierOf(o) ? (
              <CourierLock order={o} fallbackLabel={t(`dashboard.ordersSection.${FLOW.includes(o.status) ? o.status : 'shipped'}`)} />
            ) : (
              <div className="min-w-[140px]">
                <Select
                  value={FLOW.includes(o.status) ? o.status : 'new'}
                  onChange={(v) => onStatus(o.id, v)}
                  options={FLOW.map((s) => ({ value: s, label: t(`dashboard.ordersSection.${s}`) }))}
                />
              </div>
            )}
            <CourierSend order={o} couriers={couriers} onSent={onSent} />
          </>
        )}
      </div>

      {formOpen && !o && <ConvertForm r={r} zones={zones} busy={busy} onSubmit={onConvert} />}
    </div>
  );
}

// نموذج التحويل: بيانات التوصيل فقط (الاسم مطلوب) — الباقي مُعبّأ مسبقاً من المنتج/المتجر
function ConvertForm({ r, zones, busy, onSubmit }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    name: '',
    city: '',
    address: '',
    qty: 1,
    price: r.price != null ? String(r.price) : '',
    deliveryFee: '',
    notes: '',
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  // اختيار منطقة توصيل معرّفة بالمتجر يملأ المدينة وأجرتها تلقائياً (نفس حساب السلة)
  const pickZone = (name) => {
    const z = zones.find((x) => x.name === name);
    setF((p) => ({ ...p, city: name, deliveryFee: z?.fee != null && z.fee !== '' ? String(z.fee) : p.deliveryFee }));
  };
  const total = (Number(f.price) || 0) * (Math.max(1, parseInt(f.qty, 10) || 1)) + (Number(f.deliveryFee) || 0);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gold-400/20 bg-gold-400/5 p-3">
      <p className="text-xs font-semibold text-gold-200">{t('dashboard.stockRequests.convertTitle')}</p>
      <p className="text-[11px] text-stone-400">{t('dashboard.stockRequests.convertHint')}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.ordersSection.customer')}</label>
          <input className="input" value={f.name} onChange={set('name')} placeholder={t('dashboard.stockRequests.namePlaceholder')} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.ordersSection.deliveryTo')}</label>
          {zones.length > 0 ? (
            <Select value={f.city} onChange={pickZone} placeholder={t('dashboard.opost.choose')} options={zones.map((z) => ({ value: z.name, label: `${z.name}${z.fee ? ` — ${t('common.currency')}${z.fee}` : ''}` }))} />
          ) : (
            <input className="input" value={f.city} onChange={set('city')} />
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.ordersSection.address')}</label>
          <input className="input" value={f.address} onChange={set('address')} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <div>
            <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.stockRequests.qty')}</label>
            <input className="input" type="number" min="1" inputMode="numeric" value={f.qty} onChange={set('qty')} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.stockRequests.unitPrice')}</label>
            <input className="input" type="number" min="0" step="0.5" inputMode="decimal" value={f.price} onChange={set('price')} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.ordersSection.delivery')}</label>
            <input className="input" type="number" min="0" step="0.5" inputMode="decimal" value={f.deliveryFee} onChange={set('deliveryFee')} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-stone-400">{t('dashboard.ordersSection.notes')}</label>
          <input className="input" value={f.notes} onChange={set('notes')} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => onSubmit(f)} disabled={busy} className="btn-primary gap-1.5 !px-3 !py-1.5 text-xs">
          {busy ? t('common.loading') : <><BagIcon className="h-4 w-4" /> {t('dashboard.stockRequests.createOrder')}</>}
        </button>
        <span className="text-xs text-stone-400">
          {t('dashboard.ordersSection.total')}: <span className="font-display text-sm font-bold text-gold-300">{t('common.currency')}{total.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}

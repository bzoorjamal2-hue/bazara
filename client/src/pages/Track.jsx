import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';

const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];
const BADGE = {
  new: 'bg-sky-500/15 text-sky-600 ring-sky-500/25',
  confirmed: 'bg-gold-400/20 text-wine ring-gold-400/30',
  shipped: 'bg-indigo-500/15 text-indigo-600 ring-indigo-500/25',
  delivered: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/25',
  cancelled: 'bg-red-500/15 text-red-600 ring-red-500/25',
};

export default function Track() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true); setError(''); setOrders(null);
    try {
      const r = await api.post('/public/track', { phone: phone.trim() });
      setOrders(r.data.orders);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Seo title={t('track.title')} />
      <div className="mx-auto w-full max-w-2xl">
        {/* رجوع + عنوان */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine hover:text-cream"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} /></svg>
          </button>
          <h1 className="font-display text-2xl font-bold text-wine">📦 {t('track.title')}</h1>
        </div>

        <p className="mb-4 text-sm text-stone-500">{t('track.hint')}</p>

        {/* نموذج البحث */}
        <form onSubmit={search} className="flex gap-2">
          <input
            dir="ltr"
            inputMode="tel"
            className="flex-1 rounded-2xl border border-wine/15 bg-white px-4 py-3 text-end text-[#2b2b2b] placeholder:text-stone-400 focus:border-wine/40 focus:outline-none"
            placeholder={t('track.phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button type="submit" disabled={busy} className="shrink-0 rounded-2xl bg-wine px-6 font-bold text-cream transition hover:bg-wine-dark disabled:opacity-60">
            {busy ? '…' : t('track.search')}
          </button>
        </form>

        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {/* النتائج */}
        {orders && (
          orders.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-white p-8 text-center text-stone-400 shadow-sm ring-1 ring-wine/10">{t('track.notFound')}</div>
          ) : (
            <div className="mt-6 space-y-4">
              {orders.map((o) => {
                const cancelled = o.status === 'cancelled';
                const stepIdx = STEPS.indexOf(o.status);
                return (
                  <div key={o.reference} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-wine/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-wine">{o.storeName}</span>
                        <span className="ms-2 font-mono text-xs text-stone-400" dir="ltr">{o.reference}</span>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${BADGE[o.status] || ''}`}>
                        {t(`dashboard.ordersSection.${o.status}`)}
                      </span>
                    </div>

                    {/* شريط تتبّع الحالة */}
                    {!cancelled && (
                      <div className="mt-4 flex items-center" dir={rtl ? 'rtl' : 'ltr'}>
                        {STEPS.map((s, i) => (
                          <div key={s} className="flex flex-1 items-center last:flex-none">
                            <div className="flex flex-col items-center">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= stepIdx ? 'bg-wine text-cream' : 'bg-wine/10 text-wine/40'}`}>
                                {i <= stepIdx ? '✓' : i + 1}
                              </span>
                              <span className={`mt-1 text-[10px] ${i <= stepIdx ? 'font-bold text-wine' : 'text-stone-400'}`}>{t(`dashboard.ordersSection.${s}`)}</span>
                            </div>
                            {i < STEPS.length - 1 && <span className={`mx-1 h-0.5 flex-1 ${i < stepIdx ? 'bg-wine' : 'bg-wine/15'}`} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* المنتجات */}
                    <ul className="mt-3 space-y-0.5 border-t border-wine/10 pt-3 text-sm text-stone-600">
                      {(o.items || []).map((it, i) => (
                        <li key={i}>• {it.name}{it.color ? ` - ${it.color}` : ''}{it.size ? ` (${it.size})` : ''} ×{it.qty}</li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-xs text-stone-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                      <span className="font-bold text-wine">{t('common.currency')}{o.total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
}

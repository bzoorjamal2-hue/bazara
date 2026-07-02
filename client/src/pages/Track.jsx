import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { PackageIcon, CheckIcon, SearchIcon } from '../components/icons.jsx';

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
        {/* رجوع + عنوان مزخرف مركزي (بنفس روح عناوين المتجر) */}
        <div className="mb-2 flex items-center">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine hover:text-cream"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} /></svg>
          </button>
        </div>
        <div className="mb-1 flex items-center justify-center gap-2 text-wine sm:gap-2.5">
          <span aria-hidden className="text-sm text-wine/40">❖</span>
          <span className="h-px w-5 bg-gradient-to-r from-transparent to-wine/30 sm:w-8" />
          <h1 className="flex items-center gap-2 whitespace-nowrap font-display text-xl font-bold sm:text-2xl">
            <PackageIcon className="h-5 w-5 sm:h-6 sm:w-6" /> {t('track.title')}
          </h1>
          <span className="h-px w-5 bg-gradient-to-l from-transparent to-wine/30 sm:w-8" />
          <span aria-hidden className="text-sm text-wine/40">❖</span>
        </div>
        <p className="mb-5 text-center text-sm text-stone-500">{t('track.hint')}</p>

        {/* نموذج البحث — بطاقة فاخرة بحقل حبّي وزر خمري ناري */}
        <form onSubmit={search} className="glass relative overflow-hidden p-4">
          <span className="dash-hairline absolute inset-x-0 top-0" />
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-wine/40" />
              <input
                dir="ltr"
                inputMode="tel"
                className="w-full rounded-full border border-wine/15 bg-white py-3 pe-4 ps-10 text-end text-[#2b2b2b] placeholder:text-stone-400 focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15"
                placeholder={t('track.phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-full px-6 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)', boxShadow: '0 12px 26px -12px rgba(74, 19, 34, 0.6)' }}
            >
              {busy ? '…' : t('track.search')}
            </button>
          </div>
        </form>

        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {/* النتائج */}
        {orders && (
          orders.length === 0 ? (
            <div className="glass mt-6 flex flex-col items-center gap-3 p-10 text-center text-stone-400">
              <PackageIcon className="h-12 w-12 text-wine/30" />
              {t('track.notFound')}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {orders.map((o) => {
                const cancelled = o.status === 'cancelled';
                const stepIdx = STEPS.indexOf(o.status);
                return (
                  <div key={o.reference} className="glass relative overflow-hidden p-5">
                    <span className="dash-hairline absolute inset-x-0 top-0" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-display text-lg font-bold text-wine">{o.storeName}</span>
                        <span className="ms-2 rounded-full bg-wine/5 px-2 py-0.5 font-mono text-[11px] text-stone-400" dir="ltr">{o.reference}</span>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${BADGE[o.status] || ''}`}>
                        {t(`dashboard.ordersSection.${o.status}`)}
                      </span>
                    </div>

                    {/* الخط الزمني الفاخر: منجز = خمري بعلامة ✓، الحالي ينبض بهالة ذهبية، القادم باهت */}
                    {!cancelled && (
                      <div className="mt-5 flex items-center" dir={rtl ? 'rtl' : 'ltr'}>
                        {STEPS.map((s, i) => {
                          const done = i <= stepIdx;
                          const current = i === stepIdx;
                          return (
                            <div key={s} className="flex flex-1 items-center last:flex-none">
                              <div className="flex flex-col items-center">
                                <span className="relative flex h-9 w-9 items-center justify-center">
                                  {current && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e6c878]/50" style={{ animationDuration: '1.8s' }} />}
                                  <span
                                    className={`relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition ${
                                      done ? 'text-cream shadow-md' : 'border border-wine/20 bg-wine/5 text-wine/40'
                                    } ${current ? 'ring-2 ring-[#e6c878]/70' : ''}`}
                                    style={done ? { background: 'linear-gradient(135deg, #6e5340 0%, #5e4636 55%, #3f2e22 100%)' } : undefined}
                                  >
                                    {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                                  </span>
                                </span>
                                <span className={`mt-1.5 text-[10px] ${done ? 'font-bold text-wine' : 'text-stone-400'}`}>{t(`dashboard.ordersSection.${s}`)}</span>
                              </div>
                              {i < STEPS.length - 1 && (
                                <span
                                  className="mx-1 h-[3px] flex-1 rounded-full"
                                  style={{
                                    background: i < stepIdx
                                      ? 'linear-gradient(90deg, #5e4636, #b8932c)'
                                      : 'rgba(94, 70, 54, 0.12)',
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* المنتجات */}
                    <ul className="mt-4 space-y-1 border-t border-wine/10 pt-3 text-sm text-stone-600">
                      {(o.items || []).map((it, i) => (
                        <li key={i} className="flex items-baseline gap-1.5">
                          <span aria-hidden className="text-[8px] text-wine/40">◆</span>
                          <span className="min-w-0 flex-1">{it.name}{it.color ? ` - ${it.color}` : ''}{it.size ? ` (${it.size})` : ''} ×{it.qty}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-stone-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                      <span className="font-display text-lg font-bold gradient-text">{t('common.currency')}{o.total.toFixed(2)}</span>
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

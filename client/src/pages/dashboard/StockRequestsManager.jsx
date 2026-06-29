import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { buildWhatsappLink } from '../../utils/whatsapp.js';
import { BellIcon, WhatsAppIcon, TrashIcon } from '../../components/icons.jsx';
import { sizeLabel } from '../../utils/sizes.js';

export default function StockRequestsManager() {
  const { t } = useTranslation();
  const [reqs, setReqs] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/stock-requests').then((r) => setReqs(r.data.requests)).catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    setReqs((prev) => prev.filter((x) => x.id !== id));
    try { await api.delete(`/stock-requests/${id}`); } catch (e) { setError(getErrorMessage(e)); load(); }
  };

  if (reqs === null && !error) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text"><BellIcon className="h-6 w-6" /> {t('dashboard.stockRequests.title')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('dashboard.stockRequests.hint')}</p>
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {reqs && reqs.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.stockRequests.empty')}</div>
      ) : (
        <div className="space-y-3">
          {reqs?.map((r) => {
            const variant = [r.color, r.size ? sizeLabel(r.size, t) : ''].filter(Boolean).join(' · ');
            // رسالة واتساب جاهزة + رابط المنتج (يظهر بمعاينة عند المشاركة)
            const link = `${window.location.origin}/share/product/${r.productId}`;
            const waMsg = t('dashboard.stockRequests.waMsg', { name: r.productName, variant: variant ? ` (${variant})` : '', link });
            return (
              <div
                key={r.id}
                className={`glass flex flex-wrap items-center justify-between gap-3 p-4 ${r.inStock ? 'ring-1 ring-emerald-400/40' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-stone-100">{r.productName}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        r.inStock ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25' : 'bg-stone-500/10 text-stone-400'
                      }`}
                    >
                      {r.inStock ? t('dashboard.stockRequests.inStockNow') : t('dashboard.stockRequests.stillOut')}
                    </span>
                  </div>
                  {variant && <p className="mt-0.5 text-xs text-gold-200">{variant}</p>}
                  <p className="mt-0.5 text-xs text-stone-400" dir="ltr">{r.phone} · {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={buildWhatsappLink(r.phone, waMsg)}
                    target="_blank"
                    rel="noreferrer"
                    className={`btn-whatsapp !px-3 !py-1.5 text-xs ${r.inStock ? 'ring-2 ring-emerald-400/50' : ''}`}
                  >
                    <WhatsAppIcon className="inline h-4 w-4" /> {r.inStock ? t('dashboard.stockRequests.notifyReady') : t('dashboard.stockRequests.notify')}
                  </a>
                  <button onClick={() => remove(r.id)} aria-label="remove" className="rounded-lg p-2 text-stone-400 hover:text-red-300"><TrashIcon className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

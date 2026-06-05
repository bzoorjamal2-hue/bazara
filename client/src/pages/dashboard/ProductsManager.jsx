import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import ProductForm from './ProductForm.jsx';

const PH = 'https://placehold.co/48x48/121214/d4af37?text=%F0%9F%91%97';

export default function ProductsManager({ onCount }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.products);
      onCount?.(data.products.length);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 1800); };

  const handleSaved = (m) => { setModal(null); flash(m); load(); };

  const remove = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await api.delete(`/products/${id}`);
      flash(t('dashboard.product.deleted'));
      load();
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    }
  };

  if (products === null) return <Spinner />;

  const Badges = ({ p }) => (
    <span className="ms-2 inline-flex gap-1 align-middle">
      {p.featured && <span className="badge bg-gold-400/20 text-gold-200">★</span>}
      {p.oldPrice > p.price && <span className="badge bg-red-500/80 text-white">%</span>}
      {p.stock === 0 && <span className="badge bg-ink-700 text-stone-300">{t('product.outOfStock')}</span>}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.myProducts')}</h1>
        <button onClick={() => setModal({})} className="btn-primary">＋ {t('dashboard.addProduct')}</button>
      </div>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {products.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.product.empty')}</div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="hidden w-full text-start text-sm sm:table">
            <thead className="border-b border-gold-400/15 text-stone-400">
              <tr>
                <th className="p-4 text-start font-medium">{t('dashboard.product.name')}</th>
                <th className="p-4 text-start font-medium">{t('dashboard.product.category')}</th>
                <th className="p-4 text-start font-medium">{t('dashboard.product.price')}</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={p.imageUrl || (p.images?.[0]) || PH} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                      <span className="font-medium text-stone-100">{p.name}<Badges p={p} /></span>
                    </div>
                  </td>
                  <td className="p-4 text-stone-300">{t(`categories.${p.category}`)}</td>
                  <td className="p-4 font-semibold text-gold-300">{t('common.currency')}{p.price}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setModal(p)} className="btn-ghost !px-3 !py-1.5 text-xs">{t('common.edit')}</button>
                      <button onClick={() => remove(p.id)} className="btn-danger !px-3 !py-1.5 text-xs">{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divide-y divide-white/5 sm:hidden">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-4">
                <img src={p.imageUrl || (p.images?.[0]) || PH} alt={p.name} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-100">{p.name}</p>
                  <p className="text-xs text-stone-400">{t(`categories.${p.category}`)} · <span className="text-gold-300">{t('common.currency')}{p.price}</span></p>
                </div>
                <button onClick={() => setModal(p)} className="btn-ghost !px-2.5 !py-1.5 text-xs">{t('common.edit')}</button>
                <button onClick={() => remove(p.id)} className="btn-danger !px-2.5 !py-1.5 text-xs">{t('common.delete')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal !== null && (
        <ProductForm initial={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

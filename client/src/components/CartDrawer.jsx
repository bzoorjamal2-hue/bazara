import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { buildWhatsappOrder } from '../utils/whatsapp.js';
import useScrollLock from '../hooks/useScrollLock.js';

export default function CartDrawer() {
  const { t, i18n } = useTranslation();
  const { items, open, setOpen, remove, setQty, total, clear } = useCart();
  useScrollLock(open); // تجميد الخلفية عند فتح السلة

  if (!open) return null;

  // طلب عبر واتساب (مجمّع حسب رقم المتجر)
  const orderWhatsapp = () => {
    const groups = {};
    items.forEach((i) => {
      const key = i.whatsapp || 'none';
      (groups[key] = groups[key] || []).push(i);
    });
    Object.entries(groups).forEach(([wa, groupItems]) => {
      window.open(buildWhatsappOrder(wa === 'none' ? '' : wa, groupItems, i18n.language), '_blank');
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md animate-slide-in flex-col border-s border-gold-400/20 bg-ink-900">
        <div className="flex items-center justify-between border-b border-gold-400/15 p-4">
          <h2 className="font-display text-xl font-bold gradient-text">🛒 {t('cart.title')}</h2>
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-stone-400 hover:text-gold-200">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-stone-400">
            <span className="text-5xl">🛍️</span>
            {t('cart.empty')}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {items.map((i) => (
                <div key={i.id} className="glass flex gap-3 p-3">
                  <img src={i.imageUrl || 'https://placehold.co/120x120/f1e9dd/5c1a2e?text=%F0%9F%91%97'} alt={i.name} className="h-16 w-16 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-100">{i.name}</p>
                    <p className="text-xs text-stone-400">{i.storeName}</p>
                    <p className="mt-1 font-bold text-gold-300">{t('common.currency')}{i.price}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => remove(i.id)} className="text-stone-500 hover:text-red-300">✕</button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(i.id, i.qty - 1)} className="h-6 w-6 rounded-md border border-gold-400/30 text-gold-200">−</button>
                      <span className="w-5 text-center text-sm">{i.qty}</span>
                      <button onClick={() => setQty(i.id, i.qty + 1)} className="h-6 w-6 rounded-md border border-gold-400/30 text-gold-200">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gold-400/15 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-stone-300">{t('cart.total')}</span>
                <span className="font-display text-2xl font-bold gradient-text">{t('common.currency')}{total.toFixed(2)}</span>
              </div>
              <button onClick={orderWhatsapp} className="btn-whatsapp w-full">💬 {t('cart.orderWhatsapp')}</button>
              <button onClick={clear} className="mt-2 w-full text-center text-xs text-stone-400 hover:text-red-300">{t('cart.clear')}</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

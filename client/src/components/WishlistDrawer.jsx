import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import CloseButton from './CloseButton.jsx';
import { cldThumb } from '../utils/cloudinary.js';

const PH = 'https://placehold.co/120x120/f1e9dd/5e4636?text=%F0%9F%91%97';

// درج المفضّلة الجانبي — بنفس أسلوب درج السلة وميزاته (صورة + اسم + سعر + إضافة للسلة + حذف).
export default function WishlistDrawer() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language !== 'en';
  const { items, open, setOpen, remove } = useWishlist();
  const { add } = useCart();
  const navigate = useNavigate();
  useScrollLock(open);

  if (!open) return null;

  const close = () => setOpen(false);

  // إضافة منتج المفضّلة للسلة (يفتح درج السلة تلقائياً) — نُغلق درج المفضّلة كي يظهر درج السلة بوضوح
  const addToCart = (p) => { close(); add(p); };
  const addAll = () => {
    items.forEach((p) => add(p));
    close();
  };
  const goFull = () => { close(); navigate('/wishlist'); };

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-black/60 p-3 backdrop-blur-sm sm:p-4" onClick={close}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md animate-slide-in flex-col overflow-hidden rounded-3xl border border-gold-400/20 bg-ink-900 shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* الرأس */}
        <div className="flex items-center justify-between border-b border-gold-400/15 p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold gradient-text">
            ❤️ {t('wishlist.title')}
            {items.length > 0 && <span className="text-sm font-normal text-stone-400">({items.length})</span>}
          </h2>
          <CloseButton onClick={close} variant="wine" label={ar ? 'إغلاق' : 'close'} />
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-stone-400">
            <span className="text-5xl">🤍</span>
            {t('wishlist.empty')}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, x: ar ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {items.map((p) => (
                <div key={p.id} className="glass flex gap-3 p-3">
                  <button onClick={() => { close(); navigate(`/product/${p.id}`); }} className="shrink-0">
                    <img src={p.imageUrl ? cldThumb(p.imageUrl, 160) : PH} alt={p.name} className="h-16 w-16 rounded-lg object-cover" onError={(e) => (e.currentTarget.src = PH)} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => { close(); navigate(`/product/${p.id}`); }} className="block truncate text-start text-sm font-semibold text-stone-100">{p.name}</button>
                    <p className="mt-1 flex items-center gap-2">
                      <span className="font-bold text-gold-300">{t('common.currency')}{p.price}</span>
                      {p.oldPrice > p.price && <span className="text-xs text-stone-500 line-through">{t('common.currency')}{p.oldPrice}</span>}
                    </p>
                    <button onClick={() => addToCart(p)} className="mt-2 rounded-full bg-wine px-3 py-1.5 text-xs font-bold text-cream transition hover:bg-wine-dark">
                      🛒 {t('product.addToCart')}
                    </button>
                  </div>
                  <button onClick={() => remove(p.id)} aria-label={ar ? 'حذف' : 'remove'} className="self-start text-stone-500 hover:text-red-300">✕</button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-gold-400/15 p-4">
              <button onClick={addAll} className="w-full rounded-2xl bg-wine py-3.5 font-bold text-cream shadow-lg transition hover:bg-wine-dark">
                🛒 {t('wishlist.addAllToCart')}
              </button>
              <button onClick={goFull} className="w-full text-center text-xs text-stone-400 hover:text-gold-200">{t('wishlist.viewAll')} ←</button>
            </div>
          </motion.div>
        )}
      </aside>
    </div>
  );
}

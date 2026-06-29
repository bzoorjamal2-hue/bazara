import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { HeartIcon, CartIcon, HandIcon } from './icons.jsx';
import { cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { flyToCart } from '../utils/flyToCart.js';
import useScrollLock from '../hooks/useScrollLock.js';
import { sizeLabel } from '../utils/sizes.js';
import SizeGuideModal from './SizeGuideModal.jsx';
import CloseButton from './CloseButton.jsx';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="%23f1e9dd"/><text x="50%" y="50%" fill="%235c1a2e" font-size="48" text-anchor="middle" dy=".35em">👗</text></svg>'
  );

// نافذة "نظرة سريعة" — تفاصيل المنتج دون مغادرة الصفحة.
export default function QuickViewModal({ product, whatsapp = '', onClose }) {
  const { t } = useTranslation();
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const imgRef = useRef(null);
  useScrollLock(true);

  const gallery = [product.imageUrl, ...(product.images || [])].filter(Boolean);
  const poster = product.videoUrl ? cldVideoPoster(product.videoUrl) : '';
  if (gallery.length === 0 && poster) gallery.push(poster);
  if (gallery.length === 0) gallery.push(PLACEHOLDER);

  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const colorStock = product.colorStock && typeof product.colorStock === 'object' ? product.colorStock : {};
  const hasColorStock = Object.keys(colorStock).length > 0;
  const sizes = (product.size || '').split(',').map((s) => s.trim()).filter(Boolean);
  const colors = hasColorStock ? Object.keys(colorStock) : (product.color || '').split(',').map((s) => s.trim()).filter(Boolean);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [err, setErr] = useState('');
  const [sizeGuide, setSizeGuide] = useState(false);
  // النمر المتاحة وكميتها حسب اللون المختار (عند المخزون لكل لون)
  const sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {};
  const availSizes = hasColorStock ? (color ? Object.keys(colorStock[color] || {}) : []) : sizes;
  const qtyFor = (s) => (hasColorStock ? (color ? colorStock[color]?.[s] : undefined) : sizeStock[s]);
  const sizeSoldOut = (s) => qtyFor(s) === 0;

  const outOfStock = product.stock === 0;
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const liked = has(product.id);

  const hasVideo = !!product.videoUrl;

  const onAdd = () => {
    if (outOfStock) return;
    if (hasColorStock) {
      if (!color) { setErr(t('product.pickColorFirst')); return; }
      if (!size) { setErr(t('product.pickSize')); return; }
      if (sizeSoldOut(size)) { setErr(t('product.sizeSoldOut')); return; }
    } else {
      if (sizes.length && !size) { setErr(t('product.pickSize')); return; }
      if (colors.length && !color) { setErr(t('product.pickColor')); return; }
    }
    flyToCart(imgRef.current, hasVideo ? (poster || gallery[active]) : gallery[active]);
    add({ ...product, whatsapp, size, color }, qty);
    onClose();
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* خلفية معتمة بضبابية */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

      <motion.div
        className="relative z-10 grid max-h-[90vh] w-full max-w-3xl overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl bg-white shadow-2xl sm:grid-cols-2"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر الإغلاق */}
        <CloseButton onClick={onClose} variant="dark" className="absolute end-3 top-3 z-20" />

        {/* الوسائط — فيديو يشتغل تلقائياً أو صورة، بحجمها الطبيعي 9:16 (بلا قصّ) */}
        <div className="bg-[#f3ece0] p-3">
          <div ref={imgRef} className="relative mx-auto aspect-[9/16] max-h-[56vh] w-full overflow-hidden rounded-2xl bg-[#594335]">
            {hasVideo ? (
              <video
                src={product.videoUrl}
                poster={poster}
                autoPlay
                loop
                playsInline
                controls
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src={cldThumb(gallery[active], 800)}
                alt={product.name}
                decoding="async"
                onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                className="h-full w-full object-contain"
              />
            )}
            {hasDiscount && (
              <span className="absolute start-3 top-3 z-10 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">-{discountPct}%</span>
            )}
          </div>
          {!hasVideo && gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${i === active ? 'border-wine' : 'border-transparent opacity-70'}`}
                >
                  <img src={cldThumb(g, 150)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = PLACEHOLDER)} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col p-5 text-[#2b2b2b]">
          <h3 className="font-display text-xl font-bold leading-snug text-wine">{product.name}</h3>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-wine">{t('common.currency')}{product.price}</span>
            {hasDiscount && <span className="text-sm text-stone-400 line-through">{t('common.currency')}{product.oldPrice}</span>}
          </div>

          {product.description && (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600">{product.description}</p>
          )}

          {/* اللون أولاً */}
          {colors.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-semibold text-stone-700">{t('dashboard.product.color')}</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); if (hasColorStock) setSize(''); setErr(''); }}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${color === c ? 'border-wine bg-wine text-cream' : 'border-wine/25 text-wine hover:bg-wine/5'}`}
                  >
                    <span className="h-3 w-3 rounded-full border border-current/40" style={{ background: c }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* المقاس (حسب اللون عند المخزون لكل لون) */}
          {(hasColorStock ? colors.length > 0 : sizes.length > 0) && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-stone-700">{t('store.sizeLabel')}</p>
                <button
                  type="button"
                  onClick={() => setSizeGuide(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-wine/30 px-3 py-1 text-xs font-bold text-wine transition hover:bg-wine hover:text-cream"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="8" width="19" height="8" rx="1.6" /><path d="M7 8v3M12 8v4M17 8v3" />
                  </svg>
                  {t('product.sizeGuide')}
                </button>
              </div>
              {hasColorStock && !color ? (
                <p className="flex items-center gap-1.5 rounded-xl bg-wine/5 px-3 py-2 text-sm font-medium text-wine/70"><HandIcon className="h-4 w-4 shrink-0" /> {t('product.pickColorFirst')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availSizes.map((s) => {
                    const soldOut = sizeSoldOut(s);
                    const qty = typeof qtyFor(s) === 'number' ? qtyFor(s) : null;
                    const on = size === s;
                    return (
                      <button
                        key={s}
                        disabled={soldOut}
                        onClick={() => { setSize(s); setErr(''); }}
                        className={`flex min-w-[3.5rem] flex-col items-center rounded-xl border px-3 py-1.5 text-center transition ${on ? 'border-wine bg-wine text-cream' : 'border-wine/25 text-wine hover:bg-wine/5'} ${soldOut ? 'cursor-not-allowed border-stone-300/50 text-stone-400 opacity-60' : ''}`}
                      >
                        <span className={`text-sm font-bold leading-none ${soldOut ? 'line-through' : ''}`}>{sizeLabel(s, t)}</span>
                        {qty != null && (
                          <span className={`mt-1 text-[10px] font-medium leading-none ${on ? 'text-cream/80' : soldOut ? 'text-red-500' : 'text-wine/55'}`}>
                            {soldOut ? t('product.soldOutShort') : t('product.leftShort', { count: qty })}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {sizeGuide && (
            <SizeGuideModal
              sizes={hasColorStock ? [...new Set(Object.values(colorStock).flatMap((sz) => Object.keys(sz)))] : sizes}
              chart={product.storeSizeChart}
              onClose={() => setSizeGuide(false)}
            />
          )}

          {/* الكمية */}
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-semibold text-stone-700">{t('product.quantity')}</p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-wine/20 px-2 py-1">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-wine hover:bg-wine/10">−</button>
              <span className="min-w-6 text-center font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-wine hover:bg-wine/10">+</button>
            </div>
          </div>

          {err && <p className="mt-3 text-sm font-medium text-red-500">{err}</p>}

          <div className="mt-3 flex items-center gap-2">
            <motion.button
              onClick={onAdd}
              disabled={outOfStock}
              whileTap={{ scale: 0.96 }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-wine py-3 font-semibold text-cream transition hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CartIcon className="h-5 w-5" />
              {outOfStock ? t('product.outOfStock') : t('product.addToCart')}
            </motion.button>
            <motion.button
              onClick={() => toggle(product)}
              whileTap={{ scale: 0.85 }}
              aria-label="wishlist"
              className={`flex h-12 w-12 items-center justify-center rounded-xl border transition ${liked ? 'border-red-400 bg-red-50 text-red-500' : 'border-wine/25 text-wine hover:bg-wine/5'}`}
            >
              <HeartIcon className="h-5 w-5" filled={liked} />
            </motion.button>
          </div>

          <Link
            to={`/product/${product.id}`}
            onClick={onClose}
            className="mt-3 text-center text-sm font-medium text-wine/70 underline-offset-4 transition hover:text-wine hover:underline"
          >
            {t('product.viewDetails')} ←
          </Link>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

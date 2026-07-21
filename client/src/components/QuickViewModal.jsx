import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { HeartIcon, CartIcon, BagIcon, HandIcon, ForwardIcon } from './icons.jsx';
import { cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { flyToCart } from '../utils/flyToCart.js';
import useScrollLock from '../hooks/useScrollLock.js';
import { sizeLabel } from '../utils/sizes.js';
import Strike from './Strike.jsx';
import ColorSwatches from './ColorSwatches.jsx';
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
  const { add, buyNow } = useCart();
  const { has, toggle } = useWishlist();
  const imgRef = useRef(null);
  const qvTouch = useRef(null); // بداية لمسة السحب بين الصور
  useScrollLock(true);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const gallery = [product.imageUrl, ...(product.images || [])].filter(Boolean);
  const poster = product.videoUrl ? cldVideoPoster(product.videoUrl) : '';
  if (gallery.length === 0 && poster) gallery.push(poster);
  if (gallery.length === 0) gallery.push(PLACEHOLDER);

  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const colorStock = product.colorStock && typeof product.colorStock === 'object' ? product.colorStock : {};
  const colorImages = product.colorImages && typeof product.colorImages === 'object' ? product.colorImages : {};
  const hasColorStock = Object.keys(colorStock).length > 0;
  const sizes = (product.size || '').split(',').map((s) => s.trim()).filter(Boolean);
  const colors = hasColorStock ? Object.keys(colorStock) : (product.color || '').split(',').map((s) => s.trim()).filter(Boolean);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { setQty(1); }, [color, size]); // لون/نمرة جديدة → كمية 1 (المتبقي يختلف)
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

  // تحقّق موحّد من اختيار اللون/المقاس قبل الإضافة أو الشراء
  const validate = () => {
    if (outOfStock) return false;
    if (hasColorStock) {
      if (!color) { setErr(t('product.pickColorFirst')); return false; }
      if (!size) { setErr(t('product.pickSize')); return false; }
      if (sizeSoldOut(size)) { setErr(t('product.sizeSoldOut')); return false; }
    } else {
      if (sizes.length && !size) { setErr(t('product.pickSize')); return false; }
      if (colors.length && !color) { setErr(t('product.pickColor')); return false; }
    }
    return true;
  };
  const onAdd = () => {
    if (!validate()) return;
    flyToCart(imgRef.current, hasVideo ? (poster || gallery[active]) : gallery[active]);
    add({ ...product, whatsapp, size, color }, qty);
    onClose();
  };
  const onBuy = () => {
    if (!validate()) return;
    buyNow({ ...product, whatsapp, size, color }, qty);
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

        {/* الوسائط — فيديو يشتغل تلقائياً أو صورة، بحجمها الطبيعي 9:16 (بلا قصّ).
            الخلفية كريمية مطابقة للغلاف — بلا إطار بنّي حول الفيديو */}
        <div className="bg-[#f3ece0] p-3">
          <div
            ref={imgRef}
            className="relative mx-auto aspect-[9/16] max-h-[56vh] w-full overflow-hidden rounded-2xl bg-[#f3ece0]"
            style={{ touchAction: 'pan-y' }}
            onTouchStart={(e) => { const t0 = e.touches[0]; qvTouch.current = { x: t0.clientX, y: t0.clientY }; }}
            onTouchEnd={(e) => {
              // سحب أفقي يبدّل الصور (نفس سلوك صفحة المنتج وعارض الصور) — للصور فقط لا الفيديو
              const s = qvTouch.current; qvTouch.current = null;
              if (!s || hasVideo || gallery.length < 2) return;
              const dx = e.changedTouches[0].clientX - s.x;
              const dy = e.changedTouches[0].clientY - s.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                const rtl = document.documentElement.dir !== 'ltr';
                const d = dx < 0 ? (rtl ? -1 : 1) : (rtl ? 1 : -1);
                setActive((p) => (p + d + gallery.length) % gallery.length);
              }
            }}
          >
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
              <span className="absolute start-3 top-3 z-10 rounded-full bg-[#8a2438] px-2.5 py-0.5 text-xs font-semibold text-[#F4EDE2] shadow-sm">-{discountPct}%</span>
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
            {hasDiscount && <Strike className="text-sm text-stone-400">{t('common.currency')}{product.oldPrice}</Strike>}
          </div>

          {product.description && (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600">{product.description}</p>
          )}

          {/* اللون أولاً */}
          {colors.length > 0 && (
            <div className="mt-4">
              <ColorSwatches
                colors={colors}
                colorImages={colorImages}
                colorStock={colorStock}
                value={color}
                onChange={(c) => { setColor(c); if (hasColorStock) setSize(''); setErr(''); }}
                label={t('dashboard.product.color')}
                tone="light"
              />
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
                        <span className={`text-sm font-bold leading-none ${soldOut ? 'strike' : ''}`}>{sizeLabel(s, t)}</span>
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

          {/* الكمية — مقفولة حتى يكتمل اختيار اللون/النمرة، ثم تتقيّد بمتبقي النمرة */}
          {(() => {
            const pickDone = hasColorStock
              ? (color && size && !sizeSoldOut(size))
              : ((!sizes.length || size) && (!colors.length || color));
            const maxQ = typeof qtyFor(size) === 'number' ? qtyFor(size) : 99;
            return (
              <div className={`mt-4 transition ${pickDone ? '' : 'opacity-45'}`}>
                <p className="mb-1.5 text-sm font-semibold text-stone-700">{t('product.quantity')}</p>
                <div className="inline-flex items-center gap-3 rounded-xl border border-wine/20 px-2 py-1">
                  <button disabled={!pickDone || qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-wine hover:bg-wine/10 disabled:opacity-30">−</button>
                  <span className="min-w-6 text-center font-semibold">{qty}</span>
                  <button disabled={!pickDone || qty >= maxQ} onClick={() => setQty((q) => Math.min(maxQ, q + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-wine hover:bg-wine/10 disabled:opacity-30">+</button>
                </div>
              </div>
            );
          })()}

          {err && <p className="mt-3 text-sm font-medium text-red-500">{err}</p>}

          {/* أزرار الشراء — نفس الزوج الموحّد في صفحة المنتج (اطلبي الآن + أضيفي للسلة) */}
          <div className="mt-3 flex items-center gap-2">
            <motion.button onClick={onBuy} disabled={outOfStock} whileTap={{ scale: 0.96 }} className="btn-buy flex-1 py-3.5 text-sm">
              <BagIcon className="h-5 w-5" /> {outOfStock ? t('product.outOfStock') : t('product.buyNow')}
            </motion.button>
            <motion.button onClick={onAdd} disabled={outOfStock} whileTap={{ scale: 0.96 }} className="btn-cart flex-1 py-3.5 text-sm">
              <CartIcon className="h-5 w-5" /> {t('product.addToCart')}
            </motion.button>
            <motion.button
              onClick={() => toggle(product)}
              whileTap={{ scale: 0.85 }}
              aria-label="wishlist"
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition ${liked ? 'border-red-400 bg-red-50 text-red-500' : 'border-wine/25 text-wine hover:bg-wine/5'}`}
            >
              <HeartIcon className="h-5 w-5" filled={liked} />
            </motion.button>
          </div>

          <Link
            to={`/product/${product.id}${color ? `?color=${encodeURIComponent(color)}` : ''}`}
            onClick={onClose}
            className="mt-3 inline-flex items-center justify-center gap-1 self-center text-center text-sm font-medium text-wine/70 underline-offset-4 transition hover:text-wine hover:underline"
          >
            {t('product.viewDetails')} <ForwardIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

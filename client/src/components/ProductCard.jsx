import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import StarRating from './StarRating.jsx';
import { HeartIcon, CartIcon } from './icons.jsx';
import { cldVideoPoster } from '../utils/cloudinary.js';
import { flyToCart } from '../utils/flyToCart.js';

const MotionLink = motion.create(Link);

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="%23f1e9dd"/><text x="50%" y="50%" fill="%235c1a2e" font-size="48" text-anchor="middle" dy=".35em">👗</text></svg>'
  );

export default function ProductCard({ product, index = 0, whatsapp = '' }) {
  const { t } = useTranslation();
  const { add, setOpen } = useCart();
  const { has, toggle } = useWishlist();
  const imgRef = useRef(null);

  const hasImage = product.imageUrl || (product.images && product.images[0]);
  const videoPoster = product.videoUrl ? cldVideoPoster(product.videoUrl) : '';
  const cover = hasImage || videoPoster || PLACEHOLDER;
  const outOfStock = product.stock === 0;
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const liked = has(product.id);
  const isNew = product.createdAt && Date.now() - new Date(product.createdAt).getTime() < 14 * 86400000;

  const onAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    flyToCart(imgRef.current, cover); // طيران صورة المنتج إلى السلة
    add({ ...product, whatsapp });
    setOpen(true); // يفتح السلة فوراً (إحساس "اشترِ الآن")
  };
  const onLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product);
  };

  return (
    <MotionLink
      to={`/product/${product.id}`}
      className="group glass relative animate-fade-up overflow-hidden transition-shadow duration-300 hover:shadow-glow"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
    >
      {/* شارات */}
      <div className="absolute start-2 top-2 z-10 flex flex-col gap-1">
        {isNew && <span className="badge bg-emerald-500 text-white">{t('product.new')}</span>}
        {product.featured && <span className="badge bg-gold-400 text-ink-950">★ {t('product.featured')}</span>}
        {hasDiscount && <span className="badge bg-red-500 text-white">-{discountPct}%</span>}
        {outOfStock && <span className="badge bg-ink-700 text-stone-300">{t('product.outOfStock')}</span>}
      </div>

      {/* مفضّلة */}
      <motion.button
        onClick={onLike}
        whileTap={{ scale: 0.8 }}
        animate={liked ? { scale: [1, 1.35, 1] } : {}}
        transition={{ duration: 0.35 }}
        className={`absolute end-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors ${
          liked ? 'bg-red-500/90 text-white' : 'bg-black/40 text-white hover:bg-black/60'
        }`}
        aria-label="wishlist"
      >
        <HeartIcon className="h-4 w-4" filled={liked} />
      </motion.button>

      <div className="relative aspect-[3/4] overflow-hidden bg-ink-800">
        <img
          ref={imgRef}
          src={cover}
          alt={product.name}
          loading="lazy"
          onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${outOfStock ? 'opacity-50' : ''}`}
        />
        {product.videoUrl && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/50 backdrop-blur-sm">
              <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[1px] fill-white drop-shadow" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}
      </div>

      <div className="p-3.5 text-center">
        <h3 className="line-clamp-1 font-semibold text-stone-100">{product.name}</h3>

        <div className="mt-1.5 flex items-baseline justify-center gap-2">
          <span className="font-display text-lg font-bold text-wine">{t('common.currency')}{product.price}</span>
          {hasDiscount && <span className="text-xs text-stone-500 line-through">{t('common.currency')}{product.oldPrice}</span>}
        </div>

        <motion.button
          onClick={onAdd}
          disabled={outOfStock}
          whileTap={{ scale: 0.94 }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-wine/30 py-2 text-sm font-semibold text-wine transition-colors hover:bg-wine hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CartIcon className="h-4 w-4" />
          {outOfStock ? t('product.outOfStock') : t('product.shopNow')}
        </motion.button>
      </div>
    </MotionLink>
  );
}

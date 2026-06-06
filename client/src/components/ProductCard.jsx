import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import StarRating from './StarRating.jsx';
import { HeartIcon, CartIcon } from './icons.jsx';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="%23f1e9dd"/><text x="50%" y="50%" fill="%235c1a2e" font-size="48" text-anchor="middle" dy=".35em">👗</text></svg>'
  );

export default function ProductCard({ product, index = 0, whatsapp = '' }) {
  const { t } = useTranslation();
  const { add } = useCart();
  const { has, toggle } = useWishlist();

  const cover = product.imageUrl || (product.images && product.images[0]) || PLACEHOLDER;
  const outOfStock = product.stock === 0;
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const liked = has(product.id);
  const isNew = product.createdAt && Date.now() - new Date(product.createdAt).getTime() < 14 * 86400000;

  const onAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!outOfStock) add({ ...product, whatsapp });
  };
  const onLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product);
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group glass relative animate-fade-up overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* شارات */}
      <div className="absolute start-2 top-2 z-10 flex flex-col gap-1">
        {isNew && <span className="badge bg-emerald-500 text-white">{t('product.new')}</span>}
        {product.featured && <span className="badge bg-gold-400 text-ink-950">★ {t('product.featured')}</span>}
        {hasDiscount && <span className="badge bg-red-500 text-white">-{discountPct}%</span>}
        {outOfStock && <span className="badge bg-ink-700 text-stone-300">{t('product.outOfStock')}</span>}
      </div>

      {/* مفضّلة */}
      <button
        onClick={onLike}
        className={`absolute end-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition ${
          liked ? 'bg-red-500/90 text-white' : 'bg-black/40 text-white hover:bg-black/60'
        }`}
        aria-label="wishlist"
      >
        <HeartIcon className="h-4 w-4" filled={liked} />
      </button>

      <div className="relative aspect-square overflow-hidden bg-ink-800">
        <img
          src={cover}
          alt={product.name}
          loading="lazy"
          onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${outOfStock ? 'opacity-50' : ''}`}
        />
        {product.videoUrl && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-lg text-white backdrop-blur-sm">▶</span>
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="badge bg-gold-400/10 text-gold-200">{t(`categories.${product.category}`)}</span>
          {product.ratingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <StarRating value={Math.round(product.ratingAvg)} size="text-xs" /> ({product.ratingCount})
            </span>
          )}
        </div>

        <h3 className="line-clamp-1 font-semibold text-stone-100">{product.name}</h3>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-bold text-gold-300">{t('common.currency')}{product.price}</span>
            {hasDiscount && <span className="text-xs text-stone-500 line-through">{t('common.currency')}{product.oldPrice}</span>}
          </div>
          <button
            onClick={onAdd}
            disabled={outOfStock}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200 transition hover:bg-gold-400 hover:text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
            title={t('product.addToCart')}
          >
            <CartIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </Link>
  );
}

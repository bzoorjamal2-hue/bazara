import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Seo from '../components/Seo.jsx';
import Strike from '../components/Strike.jsx';
import { cldThumb } from '../utils/cloudinary.js';
import { HeartIcon, CartIcon, XIcon } from '../components/icons.jsx';
import { goBack } from '../utils/nav.js';

const PH = 'https://placehold.co/300x300/f1e9dd/5e4636?text=%F0%9F%91%97';

export default function Wishlist() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const { items, remove } = useWishlist();
  const { add } = useCart();
  const navigate = useNavigate();

  return (
    <>
      <Seo title={t('wishlist.title')} />
      {/* رجوع للتسوّق + العنوان */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => goBack(navigate, '/shop')}
          aria-label={t('common.back')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine hover:text-cream"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} /></svg>
        </button>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text"><HeartIcon className="h-6 w-6" filled /> {t('wishlist.title')}</h1>
      </div>

      {items.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('wishlist.empty')}</div>
      ) : (
        // بطاقات editorial مطابقة لبطاقات المتجر: صورة مدوّرة بلا صندوق + زر سلة عائم + حذف فوق الصورة
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <div key={p.id} className="group animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink-800 shadow-[0_14px_30px_-16px_rgba(46,33,24,0.45)] ring-1 ring-black/5">
                <Link to={`/product/${p.id}`} className="block h-full w-full">
                  <img src={p.imageUrl ? cldThumb(p.imageUrl, 400) : PH} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" onError={(e) => (e.currentTarget.src = PH)} />
                </Link>
                <button
                  onClick={() => remove(p.id)}
                  aria-label={t('common.remove')}
                  className="absolute end-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-red-500/80"
                >
                  <XIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => add(p)}
                  aria-label={t('product.addToCart')}
                  title={t('product.addToCart')}
                  className="absolute bottom-2.5 end-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#5e4636] text-[#F4EDE2] shadow-[0_10px_22px_-8px_rgba(46,33,24,0.7)] ring-1 ring-[#F4EDE2]/25 transition hover:bg-[#3f2e22]"
                >
                  <CartIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="px-1 pt-2.5">
                <Link to={`/product/${p.id}`} className="line-clamp-1 font-display font-semibold text-stone-100 hover:text-gold-200">{p.name}</Link>
                <p className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-display text-lg font-bold text-wine">{t('common.currency')}{p.price}</span>
                  {p.oldPrice > p.price && <Strike className="text-xs text-stone-500">{t('common.currency')}{p.oldPrice}</Strike>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

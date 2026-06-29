import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Seo from '../components/Seo.jsx';
import { cldThumb } from '../utils/cloudinary.js';
import { HeartIcon, CartIcon, XIcon } from '../components/icons.jsx';

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
          onClick={() => navigate('/shop')}
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <div key={p.id} className="glass animate-fade-up overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
              <Link to={`/product/${p.id}`} className="block aspect-[3/4] overflow-hidden bg-ink-800">
                <img src={p.imageUrl ? cldThumb(p.imageUrl, 400) : PH} alt={p.name} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" onError={(e) => (e.currentTarget.src = PH)} />
              </Link>
              <div className="p-3">
                <Link to={`/product/${p.id}`} className="line-clamp-1 font-semibold text-stone-100 hover:text-gold-200">{p.name}</Link>
                <p className="mt-1 font-display font-bold text-gold-300">{t('common.currency')}{p.price}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => add(p)} className="btn-primary flex-1 gap-1.5 !px-2 !py-1.5 text-xs"><CartIcon className="h-4 w-4" /> {t('product.addToCart')}</button>
                  <button onClick={() => remove(p.id)} aria-label={t('common.remove')} className="btn-ghost !px-2.5 !py-1.5 text-xs"><XIcon className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

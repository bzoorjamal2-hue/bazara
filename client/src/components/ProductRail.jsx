import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cldThumb } from '../utils/cloudinary.js';
import { productThumb } from '../utils/recentlyViewed.js';

const PH =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="%23f1e9dd"/><text x="50%" y="50%" fill="%235e4636" font-size="48" text-anchor="middle" dy=".35em">👗</text></svg>'
  );

// شريط أفقي من بطاقات منتجات مصغّرة (شاهدت مؤخراً / قد يعجبك أيضاً).
export default function ProductRail({ title, products, currentId }) {
  const { t } = useTranslation();
  const list = (products || []).filter((p) => p && p.id !== currentId);
  if (list.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 font-display text-xl font-bold text-wine">{title}</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {list.map((p) => {
          const hasDiscount = p.oldPrice && p.oldPrice > p.price;
          const thumb = productThumb(p);
          const img = thumb ? cldThumb(thumb, 300) : PH;
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="glass w-36 shrink-0 overflow-hidden transition hover:-translate-y-1 hover:shadow-glow sm:w-40">
              <div className="aspect-[3/4] overflow-hidden bg-ink-800">
                <img src={img} alt={p.name} loading="lazy" decoding="async" onError={(e) => (e.currentTarget.src = PH)} className="h-full w-full object-cover" />
              </div>
              <div className="p-2.5 text-center">
                <p className="line-clamp-1 text-sm font-semibold text-stone-100">{p.name}</p>
                <div className="mt-1 flex items-baseline justify-center gap-1.5">
                  <span className="font-bold text-wine">{t('common.currency')}{p.price}</span>
                  {hasDiscount && <span className="text-xs text-stone-500 line-through">{t('common.currency')}{p.oldPrice}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

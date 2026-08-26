import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import ProductCard from './ProductCard.jsx';
import { cldThumb, cldSrcSet } from '../utils/cloudinary.js';

// لوك بوك: صورة إطلالة كاملة + القطع المستخدمة فيها قابلة للشراء مباشرةً.
// هذا ما يفعله المتجر العالمي: يعرض الإحساس أولاً ثم يتيح شراءه بلا بحث.
// نجلب القطع بطلب واحد (نقطة الدفعة)، والمحذوف منها يُتجاهل بهدوء.
export default function LookbookSection({ lookbook }) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const ids = (lookbook?.productIds || []).join(',');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!ids) { setItems([]); return undefined; }
    let alive = true;
    api.get(`/public/products?ids=${ids}`)
      .then((r) => { if (alive) setItems(r.data.products || []); })
      .catch(() => { /* القطع اختيارية — الصورة وحدها تبقى ملهِمة */ });
    return () => { alive = false; };
  }, [ids]);

  if (!lookbook?.image) return null;
  const title = (isEn ? (lookbook.titleEn || lookbook.title) : lookbook.title) || t('home.lookbook');

  return (
    <section className="mt-14">
      <div className="mb-6 flex items-center justify-center gap-2.5 text-wine sm:gap-3">
        <span className="h-px w-7 bg-gradient-to-r from-transparent to-wine/30 sm:w-12" />
        <h2 className="whitespace-nowrap font-display text-xl font-bold sm:text-2xl">{title}</h2>
        <span className="h-px w-7 bg-gradient-to-l from-transparent to-wine/30 sm:w-12" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="overflow-hidden rounded-2xl bg-wine/10 shadow-sm ring-1 ring-wine/10">
          <img
            src={cldThumb(lookbook.image, 900)}
            srcSet={cldSrcSet(lookbook.image, [400, 700, 900, 1200])}
            sizes="(min-width: 1024px) 45vw, 100vw"
            alt={title}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.srcset = ''; e.currentTarget.style.display = 'none'; }}
            className="h-full w-full object-cover"
          />
        </div>
        {/* القطع المستخدمة — الصورة وحدها تبقى ظاهرة إن لم تصل أو حُذفت كلها */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 self-start sm:grid-cols-3">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} whatsapp={p.storeWhatsapp} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

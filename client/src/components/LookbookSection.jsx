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
  // صورةٌ ساقطة = قسمٌ يختفي. كانت الصورةُ حين تسقطُ تُستبدَلُ ببديلِ الحارسِ
  // العامّ داخلَ حاويةٍ بلا ارتفاعٍ ثابت، فتبقى بالصفحةِ الرئيسيّةِ فجوةٌ بيضاءُ
  // تحتَ عنوانِ «إطلالة الأسبوع» بلا شيءٍ فيها.
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!ids) { setItems([]); return undefined; }
    let alive = true;
    api.get(`/public/products?ids=${ids}`)
      .then((r) => { if (alive) setItems(r.data.products || []); })
      .catch(() => { /* القطع اختيارية — الصورة وحدها تبقى ملهِمة */ });
    return () => { alive = false; };
  }, [ids]);

  // الصورةُ نصٌّ أو لا قسم: صفوفٌ قديمةٌ تحملُ image كائناً فارغاً، والكائنُ
  // صادقٌ منطقيّاً فكان القسمُ يظهرُ عنواناً فوقَ فراغٍ بلا صورة.
  if (typeof lookbook?.image !== 'string' || !lookbook.image.trim() || broken) return null;
  const title = (isEn ? (lookbook.titleEn || lookbook.title) : lookbook.title) || t('home.lookbook');

  return (
    <section className="bz-sec-gap">
      <div className="bz-sec-head">
        <span className="bz-sec-eyebrow">{t('home.eyebrowLookbook')}</span>
        <h2 className="bz-title bz-sec-h font-display text-wine">{title}</h2>
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
            onError={() => setBroken(true)}
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

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
  // القطعةُ المُبرَزةُ الآن — تربطُ النقطةَ على الصورةِ ببطاقتِها بالجانب
  const [hot, setHot] = useState('');
  // مواضعُ النقاطِ تأتي من اللوحة: {id, x, y} بالنسبةِ المئويّةِ من الصورة.
  // نقبلُ فقط ما له قطعةٌ وصلت فعلاً — فنقطةُ منتجٍ محذوفٍ لا تطفو بلا وجهة.
  const points = (Array.isArray(lookbook?.points) ? lookbook.points : [])
    .filter((pt) => pt && items.some((p) => p.id === pt.id));
  const itemName = (id) => (items.find((p) => p.id === id) || {}).name || '';

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
        <div className="bz-look-img relative overflow-hidden rounded-2xl bg-wine/10 shadow-sm ring-1 ring-wine/10">
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
          {/* نقاطٌ مرقّمةٌ على الصورةِ تربطُ القطعةَ بموضعِها من الإطلالة.
              بلا هذا الربطِ تبقى الصورةُ مُلهِمةً والقطعُ مجهولةَ المكان: أيُّ
              فستانٍ هذا وأيُّ حجابٍ ذاك؟ تمريرُ النقطةِ يُبرِزُ بطاقتَها، وضغطُها
              يفتحُ قطعتَها. وتُعرَضُ فقط لمن وُضِعَ لها موضعٌ من اللوحة. */}
          {points.map((pt, n) => (
            <a
              key={pt.id}
              href={`#look-${pt.id}`}
              onMouseEnter={() => setHot(pt.id)}
              onMouseLeave={() => setHot('')}
              onFocus={() => setHot(pt.id)}
              onBlur={() => setHot('')}
              aria-label={itemName(pt.id) || `${n + 1}`}
              title={itemName(pt.id)}
              className={`bz-look-dot ${hot === pt.id ? 'is-on' : ''}`}
              style={{ insetInlineStart: `${pt.x}%`, top: `${pt.y}%` }}
            >
              {n + 1}
            </a>
          ))}
        </div>
        {/* القطع المستخدمة — الصورة وحدها تبقى ظاهرة إن لم تصل أو حُذفت كلها */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 self-start sm:grid-cols-3">
            {items.map((p, i) => {
              const n = points.findIndex((pt) => pt.id === p.id);
              return (
                <div
                  key={p.id}
                  id={`look-${p.id}`}
                  className={`relative scroll-mt-24 transition ${hot === p.id ? 'bz-look-lit' : ''}`}
                  onMouseEnter={() => setHot(p.id)}
                  onMouseLeave={() => setHot('')}
                >
                  {/* رقمُ القطعةِ على بطاقتِها — هو نفسُه رقمُ نقطتِها بالصورة */}
                  {n >= 0 && <span className="bz-look-num" aria-hidden="true">{n + 1}</span>}
                  <ProductCard product={p} index={i} whatsapp={p.storeWhatsapp} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cldThumb, cldSrcSet } from '../utils/cloudinary.js';

// مجموعات تحريرية بالرئيسية («تسوّقي حسب المناسبة») — يحرّرها المدير.
// كل بطاقة: صورة أجواء + عنوان فوقها، تفتح نتائج البحث بكلمتها.
// لا نقبل روابط حرّة من الإدارة: نبني /search بأنفسنا من كلمة البحث (q) فلا يمكن
// حقن رابط خارجي. ويُخفى القسم كلّه إن لم تُضف مجموعات — لا حشو ولا بطاقات وهمية.
// storeSlug: عند تمريره تفتح البطاقة بحث هذا المتجر فقط (?store=slug) بدل البحث الشامل.
export default function CollectionsRow({ collections, storeSlug = '' }) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const list = (collections || []).filter((c) => c && c.title && c.q);
  if (list.length === 0) return null;
  const linkFor = (q) => `/search?q=${encodeURIComponent(q)}${storeSlug ? `&store=${encodeURIComponent(storeSlug)}` : ''}`;

  return (
    <section className="mt-14 mb-16 sm:mb-20">
      <div className="mb-6 flex items-center justify-center gap-2.5 text-wine sm:gap-3">
        <span aria-hidden className="text-sm text-wine/40">❖</span>
        <span className="h-px w-7 bg-gradient-to-r from-transparent to-wine/30 sm:w-12" />
        <h2 className="whitespace-nowrap font-display text-xl font-bold sm:text-2xl">{t('home.shopByOccasion')}</h2>
        <span className="h-px w-7 bg-gradient-to-l from-transparent to-wine/30 sm:w-12" />
        <span aria-hidden className="text-sm text-wine/40">❖</span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {list.map((c, i) => {
          const title = (isEn ? (c.titleEn || c.title) : c.title) || '';
          return (
            <Link
              key={`${c.q}-${i}`}
              to={linkFor(c.q)}
              className="group animate-fade-up relative aspect-[4/3] overflow-hidden rounded-2xl bg-wine/10 shadow-sm ring-1 ring-wine/10 transition duration-300 hover:-translate-y-1 hover:shadow-glow"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {c.image ? (
                <img
                  src={cldThumb(c.image, 700)}
                  srcSet={cldSrcSet(c.image, [300, 500, 700, 900])}
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.currentTarget.srcset = ''; e.currentTarget.style.display = 'none'; }}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                // بلا صورة: تدرّج خمري فاخر — لا تظهر بطاقة فارغة أبداً
                <span className="block h-full w-full" style={{ background: 'linear-gradient(135deg, #8a6a4f 0%, #5e4636 55%, #3f2e22 100%)' }} />
              )}
              {/* تدرّج سفلي ليُقرأ العنوان فوق أي صورة مهما كانت فاتحة */}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-4 text-center">
                <span className="font-display text-lg font-bold text-white drop-shadow-lg sm:text-xl">{title}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

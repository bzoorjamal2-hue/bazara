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

      {/* صفٌّ يُسحب بالإصبع. التمرير أفقيّ أصليّ لا محاكاةً بجافاسكربت.
          snap-proximity لا mandatory عمداً: الإجباريّ يخطف الصفّ إلى أقرب بطاقة
          فور رفع الإصبع، فيبدو قفزاتٍ لا انسياباً — واللطيف يترك الحركة تكمل
          بزخمها وتستقرّ وحدها إن قاربت بطاقة. عرض البطاقة نسبةٌ من الشاشة
          فتتناسب مع كل جهاز تلقائياً. */}
      <div
        className="-mx-4 flex snap-x snap-proximity gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:gap-4 sm:px-0"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', scrollBehavior: 'auto' }}
      >
        {list.map((c, i) => {
          const title = (isEn ? (c.titleEn || c.title) : c.title) || '';
          return (
            <Link
              key={`${c.q}-${i}`}
              to={linkFor(c.q)}
              className="group animate-fade-up relative aspect-square w-[52%] shrink-0 snap-start overflow-hidden rounded-[1.25rem] bg-wine/10 shadow-[0_10px_28px_-12px_rgba(94,70,54,0.5)] ring-1 ring-[#e6c878]/30 transition duration-300 active:scale-[0.98] hover:-translate-y-1 sm:w-[34%] lg:w-[23%] xl:w-[18%]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {c.image ? (
                <img
                  src={cldThumb(c.image, 700)}
                  srcSet={cldSrcSet(c.image, [300, 500, 700, 900])}
                  sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 23vw, (min-width: 640px) 34vw, 52vw"
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
              {/* تدرّج أعمق من الأسفل: العنوان يُقرأ فوق أي صورة مهما كانت فاتحة */}
              <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(30,18,12,0.88) 0%, rgba(30,18,12,0.45) 34%, rgba(30,18,12,0.05) 62%, transparent 100%)' }} />
              {/* خيط ذهبي داخليّ — نفس لغة بطاقات الموقع الفاخرة */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-1 ring-inset ring-white/10" />

              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-bold leading-tight text-white drop-shadow-md sm:text-base">{title}</span>
                  {/* دعوة صغيرة تحت العنوان: البطاقة رابطٌ لا صورةَ زينة */}
                  <span className="mt-0.5 block text-[10px] font-semibold text-white/75">{t('home.shopNow')}</span>
                </span>
                {/* سهم دائريّ يميل مع اتجاه اللغة */}
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#2a1c10] transition group-hover:scale-110"
                  style={{ background: '#e6c878' }}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 rtl-flip" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

import { useRef , Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { productPath } from '../utils/links.js';
import { cldThumb } from '../utils/cloudinary.js';
import { productThumb } from '../utils/recentlyViewed.js';
import Strike from './Strike.jsx';

const PH =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="%23F1F1F0"/><text x="50%" y="50%" fill="%23B5B1AB" font-size="48" text-anchor="middle" dy=".35em">👗</text></svg>'
  );

// شريط أفقي من بطاقات منتجات مصغّرة (شاهدت مؤخراً / قد يعجبك أيضاً).
export default function ProductRail({ title, products, currentId, icon = null, action = null, band = false, eyebrow = null, sub = false }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const railRef = useRef(null);
  const list = (products || []).filter((p) => p && p.id !== currentId);
  if (list.length === 0) return null;

  // أسهم تمرير للكمبيوتر (تظهر من md فأعلى — الجوال يسحب باللمس)، تتبع اتجاه اللغة
  const scrollRail = (dir) => {
    const el = railRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * dir * (rtl ? -1 : 1);
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // band: يُلبِسُ الرفَّ شريطَ قسمٍ ممتدّاً — نُناوبُه بين الرفوفِ كي لا تتشابهَ
  const Wrap = band ? 'div' : Fragment;
  const wrapProps = band ? { className: 'bz-inner' } : {};
  // sub: رفٌّ داخلَ كتلةٍ لها رأسُها — بلا فاصلٍ علويٍّ وبعنوانٍ أصغرَ درجةً
  const H = sub ? 'h3' : 'h2';
  return (
    <section className={sub ? '' : band ? 'bz-band bz-sec-gap' : 'bz-sec-gap'}>
      <Wrap {...wrapProps}>
      <div className={`flex items-end gap-3 ${sub ? 'mb-4' : 'mb-5'}`}>
        <div className="min-w-0">
          {eyebrow ? <span className="bz-sec-eyebrow">{eyebrow}</span> : null}
          <H className={`bz-title !inline-flex items-center gap-2 font-display font-bold ${sub ? 'text-lg sm:text-xl' : 'bz-sec-h'}`}>
            {icon}{title}
          </H>
        </div>
        <span className="ms-auto flex shrink-0 items-center gap-2 pb-1.5">
          {action}
          <span className="hidden items-center gap-1.5 md:flex">
            <button type="button" onClick={() => scrollRail(-1)} aria-label="prev" className="flex h-8 w-8 items-center justify-center rounded-full border border-wine/20 text-wine transition hover:bg-wine hover:text-cream">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} /></svg>
            </button>
            <button type="button" onClick={() => scrollRail(1)} aria-label="next" className="flex h-8 w-8 items-center justify-center rounded-full border border-wine/20 text-wine transition hover:bg-wine hover:text-cream">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg>
            </button>
          </span>
        </span>
      </div>
      <div ref={railRef} className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {list.map((p) => {
          const hasDiscount = p.oldPrice && p.oldPrice > p.price;
          const thumb = productThumb(p);
          const img = thumb ? cldThumb(thumb, 300) : PH;
          const isVideo = Boolean(p.videoUrl);
          return (
            <Link key={p.id} to={productPath(p)} className="glass w-36 shrink-0 overflow-hidden transition hover:-translate-y-1 hover:shadow-glow sm:w-40 lg:w-44 2xl:w-48">
              <div className="relative aspect-[3/4] overflow-hidden bg-ink-800">
                <img src={img} alt={p.name} loading="lazy" decoding="async" onError={(e) => (e.currentTarget.src = PH)} className="h-full w-full object-cover" />
                {/* مؤشّر الفيديو — زر تشغيل واضح ليُعرف أنه منتج فيديو (مثل البطاقات) */}
                {isVideo && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/50">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-[1px] fill-white drop-shadow" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                )}
                {hasDiscount && (
                  <span className="badge absolute start-2 top-2 bg-[#8a2438] text-[#F9F9F8] shadow-sm">-{Math.round((1 - p.price / p.oldPrice) * 100)}%</span>
                )}
              </div>
              <div className="p-2.5 text-center">
                <p className="line-clamp-1 text-sm font-semibold text-stone-100">{p.name}</p>
                <div className="mt-1 flex items-baseline justify-center gap-1.5">
                  <span className="font-bold text-wine">{t('common.currency')}{p.price}</span>
                  {hasDiscount && <Strike className="bz-oldprice text-sm">{t('common.currency')}{p.oldPrice}</Strike>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      </Wrap>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cldThumb, cldSrcSet, cldVideoMp4, cldVideoPoster } from '../utils/cloudinary.js';
import Lightbox from './Lightbox.jsx';

// صورة بديلة حين لا يرفع المتجرُ أيَّ وسيطة
export const MEDIA_PH =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="100%" height="100%" fill="#F1F1F0"/><text x="50%" y="50%" fill="#B5B1AB" font-size="72" text-anchor="middle" dy=".35em">👗</text></svg>'
  );

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// صورُ المنتجِ العامّة (الغلافُ ثمّ البقيّة) بلا تكرار
function generalImages(product) {
  return [...new Set([product?.imageUrl, ...arr(product?.images)].filter(Boolean))];
}

/**
 * وسائطُ المنتجِ قائمةً واحدةً مرتَّبة: الصورُ ثمّ الفيديو.
 *
 * كان الفيديو يُرسَم كتلةً منفصلةً تحتَ المعرض، والصورُ معرضاً فوقه. فحين ترفعُ
 * التاجرةُ فيديو فقط (وهي حالُ كلِّ منتجات المنصّة اليوم) ثمّ تضيفُ صوراً لكلِّ
 * لون، كان اختيارُ اللونِ يُنشئُ كتلةَ المعرضِ فجأةً فوقَ الفيديو فيهبطُ الفيديو
 * ٦٥٠ بكسل وتقفزُ الصفحةُ كلُّها تحتَ إصبعِ الزبونة. الآن كلُّ وسيطةٍ عنصرٌ في
 * معرضٍ واحد: اختيارُ اللونِ يبدّلُ الصورَ داخلَ الإطارِ نفسِه، والفيديو يبقى
 * مكانَه آخرَ العناصرِ بمصغّرةٍ عليها علامةُ تشغيل.
 *
 * لونٌ له صورٌ → صورُه وحدَها (هذا معنى «صورةٌ لكلِّ لون»)، وإلا فالصورُ العامّة.
 */
export function productMedia(product, color = '') {
  if (!product) return [];
  const colorImgs = color ? arr(obj(product.colorImages)[color]) : [];
  const imgs = colorImgs.length ? colorImgs : generalImages(product);
  const list = imgs.map((src) => ({ type: 'image', src }));
  if (product.videoUrl) {
    list.push({ type: 'video', src: product.videoUrl, poster: videoPoster(product) });
  }
  if (!list.length) list.push({ type: 'image', src: MEDIA_PH });
  return list;
}

// غلافُ الفيديو: لقطتُه من محرّكِنا أو كلاوديناري، وإلا فصورةُ المنتجِ الأولى.
// فيديو من رابطٍ خارجيٍّ (بلا لقطةٍ جاهزة) كان يظهرُ رماديّاً فارغاً على الآيفون:
// سفاري لا يرسمُ أوّلَ إطارٍ قبلَ التشغيلِ حين لا يكونُ للفيديو غلاف.
export function videoPoster(product) {
  return cldVideoPoster(product?.videoUrl || '') || generalImages(product)[0] || '';
}

// بلا غلاف: ‎#t=0.1 يجعلُ سفاري يُحمِّلُ أوّلَ إطارٍ ويرسمُه بدلَ المستطيلِ الرماديّ
const withFirstFrame = (src) => (src && !src.includes('#') ? `${src}#t=0.1` : src);

// الصورةُ الممثِّلةُ لوسيطةٍ (لطيرانِ السلّة وبطاقاتِ المشاركة): لقطةُ الفيديو للفيديو
export const mediaCover = (m, width) => (m?.type === 'video'
  ? ((width && cldVideoPoster(m.src, width)) || m.poster || '')
  : m?.src || '');

/**
 * نسبةُ إطارِ العرض. تُحسَبُ من وسائطِ المنتجِ كلِّها (الصورُ العامّة + صورُ كلِّ
 * الألوان) لا من المعروضِ الآن — وإلا تغيّرت النسبةُ عند اختيارِ لونٍ فقفزت
 * الصفحة، وهو عينُ العطبِ الذي نُصلحه. منتجٌ بلا صورٍ إطلاقاً (فيديو فقط) يأخذُ
 * ٩:١٦ فيبقى الفيديو بملئِه كما اعتادت التاجرات؛ وما إن تدخلَ صورةٌ واحدةٌ حتى
 * يصيرَ الإطارُ ٤:٥ — إطارُ متاجرِ الأزياءِ المعتاد — فتتّسعُ فيه الصورُ والفيديو معاً.
 */
export function mediaRatio(product) {
  const anyImage =
    generalImages(product).length > 0 ||
    Object.values(obj(product?.colorImages)).some((v) => arr(v).length > 0);
  return anyImage ? '4 / 5' : '9 / 16';
}

/**
 * النسبةُ الحقيقيّةُ لأوّلِ وسيطة (صورةِ الغلافِ أو لقطةِ الفيديو)، محصورةً بين ٩:١٦ و١:١.
 * الإطارُ الثابتُ ٤:٥ كان يضعُ صورةَ الجوّالِ الطوليّة (٩:١٦ — أغلبُ صورِ التاجرات) «contain»
 * بفراغٍ أبيضَ على الجنبين فتبدو القطعةُ صغيرةً ضائعة. نقيسُها مرّةً ونحفظُها للمنتج، فالزيارةُ
 * التالية تُرسَمُ بالنسبةِ الصحيحةِ من أوّلِ إطار بلا قفزة. تُقاسُ الأولى وحدَها لا المعروضة،
 * فاختيارُ لونٍ لا يغيّرُ الإطار (وهو ما يحميه mediaRatio أصلاً).
 */
const RATIO_KEY = 'bz_media_ratio';
const readRatios = () => { try { return JSON.parse(localStorage.getItem(RATIO_KEY) || '{}'); } catch { return {}; } };
function useNaturalRatio(product) {
  const id = product?.id || '';
  const [r, setR] = useState(() => (id ? readRatios()[id] || null : null));
  useEffect(() => {
    if (!id) return undefined;
    const first = productMedia(product, '')[0];
    const src = first?.type === 'video' ? cldVideoPoster(first.src) : first?.src;
    if (!src || src === MEDIA_PH) return undefined;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live || !img.naturalWidth || !img.naturalHeight) return;
      const v = Math.min(1, Math.max(9 / 16, img.naturalWidth / img.naturalHeight));
      const n = Math.round(v * 1000) / 1000;
      setR(n);
      try { const all = readRatios(); all[id] = n; const ks = Object.keys(all); if (ks.length > 300) delete all[ks[0]]; localStorage.setItem(RATIO_KEY, JSON.stringify(all)); } catch { /* ممتلئ */ }
    };
    img.src = first.type === 'video' ? src : cldThumb(src, 400);
    return () => { live = false; };
  }, [id, product]);
  return r;
}

function PlayBadge({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72c0 .78.85 1.26 1.52.86l11.14-6.86a1 1 0 0 0 0-1.72L9.52 4.28A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

/**
 * معرضُ وسائطِ المنتج — إطارٌ واحدٌ ثابتُ المقاسِ وشريطُ مصغّرات.
 *
 * الإطارُ لا يتغيّرُ مهما تبدّلت الوسيطةُ (صورةٌ طوليّةٌ أو عرضيّةٌ أو فيديو) ولا
 * مهما تبدّل اللون، فلا يقفزُ شيءٌ تحتَ الإصبع.
 */
export default function ProductMedia({
  product,
  color = '',
  variant = 'page', // page: صفحةُ المنتج (تكبيرٌ وعارض) — quick: النظرةُ السريعة
  badge = null, // شارةٌ فوقَ الإطار (نسبةُ الخصم)
  stageRef = null, // مرجعُ الإطار (لطيرانِ الصورةِ إلى السلّة)
  onCover = null, // يُبلّغُ الأبَ بصورةِ الوسيطةِ المعروضة
}) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const page = variant === 'page';
  const list = useMemo(() => productMedia(product, color), [product, color]);
  // الوسيطةُ المختارةُ مربوطةٌ بالمنتجِ واللونِ معاً: تبديلُ اللونِ يعودُ بنا إلى أوّلِ
  // صورةٍ لحظةَ الرسمِ نفسَها لا بمؤثِّرٍ بعدَ الرسم — وإلا ظهرَ إطارٌ واحدٌ بالصورةِ
  // القديمةِ قبلَ أن يُصحّحَ المؤثِّرُ الفهرس.
  const listKey = `${product?.id || ''}|${color}`;
  const [sel, setSel] = useState({ key: listKey, i: 0 });
  const i = sel.key === listKey ? sel.i : 0;
  const setI = (v) => setSel({ key: listKey, i: typeof v === 'function' ? v(i) : v });
  const [lightbox, setLightbox] = useState(false);
  const touch = useRef(null);
  const videoRef = useRef(null);
  const thumbsRef = useRef(null);
  const zoomRef = useRef(null);

  // المعروضُ الآن: نقصُّ الفهرسَ في الرسمِ نفسِه لا بمؤثِّرٍ لاحق — لونٌ صورُه أقلُّ
  // من سابقِه كان يترك الفهرسَ خارجَ القائمةِ إطاراً كاملاً فتظهرُ صورةٌ مكسورة.
  const idx = Math.min(i, list.length - 1);
  const cur = list[idx] || list[0];
  const images = useMemo(() => list.filter((m) => m.type === 'image').map((m) => m.src), [list]);
  const natural = useNaturalRatio(product);
  // الإطارُ بنسبةِ الوسيطة، وعرضُه يضيقُ مع سقفِ الارتفاع — وإلا حصرَ max-height الارتفاعَ وبقيَ
  // العرضُ كاملاً فعادت الأشرطةُ البيضاءُ على الجنبين
  const cap = page ? 'min(74svh, 640px)' : 'min(52svh, 460px)';
  const stageStyle = natural
    ? { aspectRatio: String(natural), maxWidth: `min(100%, calc(${cap} * ${natural}))` }
    : { aspectRatio: mediaRatio(product) };

  // الانتقالُ عن الفيديو يوقفه — كان يظلُّ يعملُ بصوتِه خلفَ صورةٍ ساكنة
  useEffect(() => {
    const v = videoRef.current;
    if (v && cur?.type !== 'video') { try { v.pause(); } catch { /* تجاهل */ } }
  }, [idx, cur?.type]);

  // إبلاغُ الأبِ بالصورةِ الممثِّلة (طيرانُ السلّة يحتاجُ صورةً لا فيديو)
  useEffect(() => { onCover?.(mediaCover(cur)); }, [cur, onCover]);

  // المصغّرةُ النشطةُ تبقى مرئيّةً بالشريط. نحرّكُ الشريطَ وحدَه بفارقِ المركزين
  // (scrollBy يصلحُ للاتجاهين) لا بـscrollIntoView: تلك تُمرّرُ الصفحةَ نفسَها حين
  // تكونُ المصغّرةُ خارجَ الشاشة، فتقفزُ الصفحةُ عند فتحِ المنتج.
  const firstPaint = useRef(true);
  useEffect(() => {
    if (firstPaint.current) { firstPaint.current = false; return; }
    const wrap = thumbsRef.current;
    const el = wrap?.children?.[idx];
    if (!wrap || !el) return;
    const wr = wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const delta = (er.left + er.width / 2) - (wr.left + wr.width / 2);
    if (Math.abs(delta) > 4) wrap.scrollBy({ left: delta, behavior: 'smooth' });
  }, [idx]);

  if (!list.length) return null;
  const many = list.length > 1;
  const go = (d) => setI((p) => (p + d + list.length) % list.length);

  // تكبيرٌ بحركةِ المؤشّرِ على أجهزةِ الماوس (أجهزةُ اللمسِ لها العارض)
  const canHoverZoom =
    page && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onZoomMove = (e) => {
    const el = zoomRef.current;
    if (!el || !canHoverZoom) return;
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    el.style.transform = 'scale(2.2)';
  };
  const onZoomLeave = () => {
    const el = zoomRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.transformOrigin = '';
  };

  return (
    <div>
      <div
        ref={stageRef}
        className={`bz-stage ${page ? '' : 'bz-stage-sm'} group relative mx-auto flex w-full max-w-full items-center justify-center overflow-hidden rounded-2xl`}
        style={{ ...stageStyle, touchAction: 'pan-y' }}
        onTouchStart={(e) => {
          // اللمسُ على الفيديو للتحكّمِ به لا للسحبِ بين الوسائط
          if (e.target instanceof Element && e.target.closest('video')) { touch.current = null; return; }
          const p0 = e.touches[0];
          touch.current = { x: p0.clientX, y: p0.clientY };
        }}
        onTouchEnd={(e) => {
          const s = touch.current; touch.current = null;
          if (!s || !many) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? (rtl ? -1 : 1) : (rtl ? 1 : -1));
        }}
      >
        {/* الفيديو يبقى مركَّباً ويُخفى حين لا يكونُ المعروض: إعادةُ تركيبِه مع كلِّ
            تنقّلٍ تعني تنزيلَ ترويسته من جديدٍ كلَّ مرّة (وباقةُ الوسائطِ محدودة) */}
        {product?.videoUrl && (
          <video
            ref={videoRef}
            src={videoPoster(product) ? cldVideoMp4(product.videoUrl) : withFirstFrame(cldVideoMp4(product.videoUrl))}
            poster={videoPoster(product) || undefined}
            controls
            playsInline
            preload="metadata"
            className={`bz-shot max-h-full max-w-full rounded-2xl ${cur?.type === 'video' ? '' : 'hidden'}`}
          />
        )}

        {cur?.type === 'image' && (
          <span
            className="flex h-full w-full items-center justify-center overflow-hidden"
            onMouseMove={onZoomMove}
            onMouseLeave={onZoomLeave}
          >
            <img
              key={cur.src}
              ref={zoomRef}
              src={cldThumb(cur.src, 900)}
              srcSet={cldSrcSet(cur.src, [400, 600, 900, 1200])}
              sizes={page ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 640px) 45vw, 92vw'}
              alt={product?.name || ''}
              decoding="async"
              onClick={() => page && setLightbox(true)}
              className={`bz-shot max-h-full max-w-full rounded-2xl object-contain animate-fade-in [animation-duration:350ms] [transition:transform_.18s_ease-out] ${page ? 'cursor-zoom-in' : ''}`}
              onError={(e) => { e.currentTarget.srcset = ''; e.currentTarget.src = MEDIA_PH; }}
            />
          </span>
        )}

        {badge}

        {/* تكبير — للصورِ وحدَها (الفيديو له مشغّله) */}
        {page && cur?.type === 'image' && (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label={t('product.zoom')}
            className="absolute end-3 top-3 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>
          </button>
        )}

        {/* سهما التنقّل — لأجهزةِ الماوس (على اللمسِ يُسحَب) */}
        {many && (
          <>
            <button type="button" onClick={() => go(rtl ? 1 : -1)} aria-label={t('common.prev')} className="bz-stage-nav start-2">‹</button>
            <button type="button" onClick={() => go(rtl ? -1 : 1)} aria-label={t('common.next')} className="bz-stage-nav end-2">›</button>
          </>
        )}

        {/* عدّادُ الموضع — يقولُ للزبونةِ إنّ ثمّة المزيد */}
        {many && (
          <span dir="ltr" className="pointer-events-none absolute bottom-2.5 start-2.5 z-[2] rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            {idx + 1}/{list.length}
          </span>
        )}
      </div>

      {/* المصغّرات — الفيديو منها بعلامةِ تشغيلٍ على لقطته. حشوةُ الشريطِ (p-1) تفسحُ
          لحلقةِ المختارة: الحلقةُ خارجَ حدودِ المصغّرة، وشريطُ التمريرِ كان يقصُّها */}
      {many && (
        <div ref={thumbsRef} className="-mx-1 mt-2 flex gap-2 overflow-x-auto p-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((m, k) => (
            <button
              key={`${m.type}-${m.src}-${k}`}
              type="button"
              onClick={() => setI(k)}
              aria-label={m.type === 'video' ? t('product.videoThumb') : `${k + 1}`}
              aria-current={k === idx}
              className={`bz-thumb relative h-16 w-16 shrink-0 overflow-hidden rounded-xl transition duration-300 ${k === idx ? 'bz-thumb-on' : 'opacity-60 hover:opacity-100'}`}
            >
              {m.type === 'video' && !m.poster ? (
                // فيديو بلا غلاف: أوّلُ إطارٍ منه مصغّرةً (صامتاً، لا يُشغَّل)
                <video
                  src={withFirstFrame(m.src)}
                  muted
                  playsInline
                  preload="metadata"
                  tabIndex={-1}
                  className="pointer-events-none h-full w-full object-cover"
                />
              ) : (
                <img
                  src={m.type === 'video' ? m.poster : cldThumb(m.src, 160)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.src = MEDIA_PH; }}
                />
              )}
              {m.type === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                  <PlayBadge className="h-5 w-5 drop-shadow" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {page && lightbox && images.length > 0 && (
        <Lightbox
          images={images}
          index={Math.max(0, images.indexOf(cur?.src))}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import StarRating from './StarRating.jsx';
import Countdown from './Countdown.jsx';
import { HeartIcon, CartIcon, XIcon, StarIcon } from './icons.jsx';
import { cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { flyToCart } from '../utils/flyToCart.js';
import { productColorDots } from '../utils/colorDot.js';
import QuickViewModal from './QuickViewModal.jsx';


const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="%23f1e9dd"/><text x="50%" y="50%" fill="%235c1a2e" font-size="48" text-anchor="middle" dy=".35em">👗</text></svg>'
  );

export default function ProductCard({ product, index = 0, whatsapp = '' }) {
  const { t } = useTranslation();
  const { add, setOpen } = useCart();
  const { has, toggle } = useWishlist();
  const imgRef = useRef(null);
  const [quickOpen, setQuickOpen] = useState(false);
  // ظهور ناعم للصورة: هيكل لامع ريثما تُحمّل ثم تتلاشى للداخل (بلا "طفرة")
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => { if (imgRef.current?.complete) setImgLoaded(true); }, []);
  const [hovering, setHovering] = useState(false); // كمبيوتر: معاينة فيديو عند مرور الماوس
  const [showVideo, setShowVideo] = useState(false); // جوال: ضغطة مطوّلة → فيديو بالصوت
  const pressTimer = useRef(null);
  const longPressed = useRef(false);

  // نظرة سريعة واحدة فقط على مستوى الصفحة كلها: فتح أي بطاقة يُغلق أي نافذة أخرى مفتوحة
  // (منتجات مكرّرة بأقسام متعددة كانت تسمح بتراكب نافذتين فوق بعض)
  const qvToken = useRef({});
  useEffect(() => {
    if (!quickOpen) return;
    window.dispatchEvent(new CustomEvent('bz:quickview', { detail: qvToken.current }));
    const closeIfOther = (e) => { if (e.detail !== qvToken.current) setQuickOpen(false); };
    window.addEventListener('bz:quickview', closeIfOther);
    return () => window.removeEventListener('bz:quickview', closeIfOther);
  }, [quickOpen]);

  const hasImage = product.imageUrl || (product.images && product.images[0]);
  const videoPoster = product.videoUrl ? cldVideoPoster(product.videoUrl) : '';
  const cover = cldThumb(hasImage || videoPoster || PLACEHOLDER, 500);
  const outOfStock = product.stock === 0;
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const liked = has(product.id);
  const isNew = product.createdAt && Date.now() - new Date(product.createdAt).getTime() < 14 * 86400000;
  // نقاط الألوان المتوفرة (تظهر فقط عند لونين أو أكثر معروفَي الدرجة)
  const colorDots = productColorDots(product);

  // هل للمنتج خيارات (مقاس/لون)؟ عندها نفتح النظرة السريعة لاختيارها بدل الإضافة المباشرة
  const hasOptions = Boolean((product.size && product.size.trim()) || (product.color && product.color.trim()));

  const onAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    if (hasOptions) { setQuickOpen(true); return; } // اختيار المقاس/اللون أولاً
    flyToCart(imgRef.current, cover); // طيران صورة المنتج إلى السلة
    add({ ...product, whatsapp });
    setOpen(true); // يفتح السلة فوراً (إحساس "اشترِ الآن")
  };
  const onLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product);
  };
  const onQuickView = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickOpen(true);
  };

  // ضغطة مطوّلة على الجوال (≈0.45s) → تشغيل الفيديو بالصوت دون مغادرة الصفحة
  const startPress = () => {
    if (!product.videoUrl) return;
    longPressed.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setShowVideo(true);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 450);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);
  // إن كانت ضغطة مطوّلة، نمنع الانتقال للصفحة بعد رفع الإصبع
  const onClickCapture = (e) => {
    if (longPressed.current) { e.preventDefault(); e.stopPropagation(); longPressed.current = false; }
  };
  const closeVideo = (e) => { if (e) e.stopPropagation(); setShowVideo(false); };

  return (
    <>
    <Link
      to={`/product/${product.id}`}
      className="group relative block animate-fade-up transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1.5 active:scale-[0.99]"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      onMouseEnter={() => product.videoUrl && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onClickCapture={onClickCapture}
    >
      {/* تصميم editorial بوتيك: الصورة وحدها ببطاقة مدوّرة، والنص تحتها على خلفية الصفحة */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink-800 shadow-[0_14px_30px_-16px_rgba(46,33,24,0.45)] ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-[0_22px_44px_-18px_rgba(46,33,24,0.55)]">
        {/* هيكل لامع حتى تجهز الصورة — يُزال بعد التحميل (فلا يبقى أي أنيميشن يعمل) */}
        {!imgLoaded && <div className="skeleton absolute inset-0" aria-hidden="true" />}
        <img
          ref={imgRef}
          src={cover}
          alt={product.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={(e) => { e.currentTarget.src = PLACEHOLDER; setImgLoaded(true); }}
          className={`h-full w-full object-cover transition-[transform,opacity] duration-500 group-hover:scale-110 ${outOfStock ? 'opacity-50' : imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* شارات — ألوان بوتيك هادئة معتمة (بلا backdrop-blur: يسبّب تعليق تمرير على iOS مع كثرة البطاقات) */}
        <div className="absolute start-2 top-2 z-10 flex flex-col gap-1">
          {isNew && <span className="badge bg-[#3f2e22] text-[#F4EDE2] shadow-sm">{t('product.new')}</span>}
          {product.featured && <span className="badge flex items-center gap-0.5 bg-gold-400 text-ink-950 shadow-sm"><StarIcon className="h-3 w-3" /> {t('product.featured')}</span>}
          {hasDiscount && <span className="badge bg-[#8a2438] text-[#F4EDE2] shadow-sm">-{discountPct}%</span>}
          {outOfStock && <span className="badge bg-ink-700 text-stone-300">{t('product.outOfStock')}</span>}
        </div>

        {/* مفضّلة */}
        <button
          onClick={onLike}
          className={`absolute end-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${
            liked ? 'bg-red-500/90 text-white' : 'bg-black/45 text-white hover:bg-black/60'
          }`}
          aria-label="wishlist"
        >
          <HeartIcon className="h-4 w-4" filled={liked} />
        </button>

        {/* نظرة سريعة — تفتح نافذة بدون مغادرة الصفحة */}
        <button
          onClick={onQuickView}
          className="absolute end-2 top-[3.25rem] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/60 active:scale-90"
          aria-label={t('product.quickView')}
          title={t('product.quickView')}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        {/* معاينة الفيديو عند مرور الماوس (كمبيوتر) — صامتة وناعمة */}
        {product.videoUrl && hovering && (
          <video
            src={product.videoUrl}
            poster={videoPoster}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 z-[1] h-full w-full animate-fade-in object-cover"
          />
        )}
        {/* عدّاد العرض المحدود */}
        {product.saleEndsAt && (
          <span className="absolute bottom-2 start-2 z-[3]">
            <Countdown endsAt={product.saleEndsAt} />
          </span>
        )}
        {product.videoUrl && (
          <span className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/50 transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[1px] fill-white drop-shadow" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}

        {/* زر سلة دائري عائم على الصورة — بنّي عميق بنص عاجي (ثابت بالوضعين) */}
        <button
          onClick={onAdd}
          disabled={outOfStock}
          className="absolute bottom-2.5 end-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#5e4636] text-[#F4EDE2] shadow-[0_10px_22px_-8px_rgba(46,33,24,0.7)] ring-1 ring-[#F4EDE2]/25 transition hover:bg-[#3f2e22] active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t('product.addToCart')}
          title={t('product.addToCart')}
        >
          <CartIcon className="h-5 w-5" />
        </button>
      </div>

      {/* الاسم والسعر تحت الصورة مباشرة — بلا صندوق (editorial) */}
      <div className="px-1 pt-2.5 text-start">
        <h3 className="line-clamp-1 font-display font-semibold leading-snug text-stone-100">{product.name}</h3>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-display text-lg font-bold text-wine">{t('common.currency')}{product.price}</span>
          {hasDiscount && <span className="strike text-xs text-stone-500">{t('common.currency')}{product.oldPrice}</span>}
        </div>
        {/* دليل اجتماعي (أسلوب المتاجر الكبرى): تقييم بنجمة + عدد المبيعات بسطر واحد */}
        {(product.ratingCount > 0 || product.soldCount > 0) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {product.ratingCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-gold-200">
                <StarIcon className="h-3 w-3" /> {product.ratingAvg} <span className="font-normal text-stone-500">({product.ratingCount})</span>
              </span>
            )}
            {product.soldCount > 0 && (
              <span className="text-[11px] font-medium text-emerald-700">{t('product.soldCount', { count: product.soldCount })}</span>
            )}
          </div>
        )}
        {/* نقاط الألوان المتوفرة — لمحة سريعة عن التشكيلة دون فتح المنتج */}
        {colorDots.length >= 2 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {colorDots.slice(0, 4).map((d) => (
              <span
                key={d.name}
                title={d.name}
                className="h-3 w-3 rounded-full"
                style={{ background: d.css, boxShadow: '0 0 0 1px rgba(255,255,255,0.4), inset 0 0 0 1px rgba(0,0,0,0.12)' }}
              />
            ))}
            {colorDots.length > 4 && <span className="text-[10px] font-medium text-stone-500">+{colorDots.length - 4}</span>}
          </div>
        )}
      </div>
    </Link>

    <AnimatePresence>
      {quickOpen && (
        <QuickViewModal product={product} whatsapp={whatsapp} onClose={() => setQuickOpen(false)} />
      )}
    </AnimatePresence>

    {/* ضغطة مطوّلة (جوال) → الفيديو بالصوت في عارض ملء الشاشة */}
    {showVideo && product.videoUrl && createPortal(
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 animate-fade-in" onClick={closeVideo}>
        <button onClick={closeVideo} aria-label="close" className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"><XIcon className="h-5 w-5" /></button>
        <video
          src={product.videoUrl}
          poster={videoPoster}
          autoPlay
          loop
          playsInline
          controls
          onClick={(e) => e.stopPropagation()}
          className="max-h-[85vh] w-auto max-w-full rounded-2xl shadow-2xl"
        />
      </div>,
      document.body
    )}
    </>
  );
}

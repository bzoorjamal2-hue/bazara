import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductDetailsSkeleton } from '../components/Skeleton.jsx';
import StarRating from '../components/StarRating.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ProductRail from '../components/ProductRail.jsx';
import Strike from '../components/Strike.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { pushRecent, getRecent, removeRecent } from '../utils/recentlyViewed.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { sizeLabel } from '../utils/sizes.js';
import ColorSwatches from '../components/ColorSwatches.jsx';
import Countdown from '../components/Countdown.jsx';
import { HeartIcon, BagIcon, CartIcon, BellIcon, SparkleIcon, FireIcon, HandIcon } from '../components/icons.jsx';
import { goBack } from '../utils/nav.js';
import SizeGuideModal from '../components/SizeGuideModal.jsx';
import ImageInput from '../components/ImageInput.jsx';
import { initPixels, trackPixel } from '../utils/pixels.js';

const PH = 'https://placehold.co/600x600/121214/d4af37?text=%F0%9F%91%97';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const { add, buyNow } = useCart();
  const { has, toggle, remove: removeWish } = useWishlist();
  const [product, setProduct] = useState(() => getCache(`product:${id}`)?.product || null);
  const [reviews, setReviews] = useState(() => getCache(`product:${id}`)?.reviews || []);
  const [related, setRelated] = useState([]);
  const [complementary, setComplementary] = useState([]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [selSize, setSelSize] = useState('');
  const [selColor, setSelColor] = useState('');
  const [pickErr, setPickErr] = useState('');
  const [qty, setQty] = useState(1); // كمية الشراء (كانت بالنظرة السريعة فقط)
  useEffect(() => { setQty(1); }, [id, selColor, selSize]); // منتج/لون/نمرة جديدة → كمية 1

  // لون محدّد مسبقاً من الرابط (?color=) — نقرة نقطة اللون على البطاقة تفتح المنتج به
  useEffect(() => {
    if (!product) return;
    const c = new URLSearchParams(window.location.search).get('color');
    if (!c) return;
    const cs = product.colorStock && typeof product.colorStock === 'object' ? product.colorStock : {};
    const list = Object.keys(cs).length ? Object.keys(cs) : String(product.color || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (list.includes(c)) setSelColor(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);
  const [lightbox, setLightbox] = useState(false);
  const [descExp, setDescExp] = useState(false); // طيّ الوصف الطويل بـ«اقرأ المزيد»
  const [sizeGuide, setSizeGuide] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifySent, setNotifySent] = useState(false);
  // شريط الشراء الثابت: يظهر عند التمرير تحت زر الشراء الأساسي (يحلّ محلّ شريط التنقّل)
  const ctaRef = useRef(null);
  const [showBuyBar, setShowBuyBar] = useState(false);
  const pickRef = useRef(null); // قسم اختيار اللون/المقاس — ننزلق إليه عند الضغط بلا اختيار
  const galTouch = useRef(null); // بداية لمسة معرض الصور (للسحب بين الصور)

  // بكسلات تمويل المتجر: تُحقن عند الهبوط المباشر من إعلان + حدث "مشاهدة منتج"
  useEffect(() => {
    if (!product?.id) return;
    initPixels(product);
    trackPixel('ViewContent', { value: Number(product.price) || 0, content_name: product.name, content_ids: [product.id], content_type: 'product' });
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // نُظهر شريط الشراء عندما يمرّ زر الشراء الأساسي بالكامل فوق حافة الشاشة (المستخدم تحته)
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return undefined;
    const onScroll = () => setShowBuyBar(el.getBoundingClientRect().bottom < 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [product?.id]);

  // إشعار BottomNav ليختفي حين يظهر شريط الشراء (يحلّ محلّه)، والعودة عند المغادرة/الإخفاء
  useEffect(() => { window.dispatchEvent(new CustomEvent('bz:buybar', { detail: showBuyBar })); }, [showBuyBar]);
  useEffect(() => () => window.dispatchEvent(new CustomEvent('bz:buybar', { detail: false })), []);

  // الضغط على مساحة فاضية خارج منطقة الاختيار يلغي اللون المختار ويطوي نمره —
  // مع استثناء كل العناصر التفاعلية (أزرار/روابط/حقول/صور/الشريط الثابت) كي لا
  // يضيع الاختيار أثناء الإضافة للسلة أو تصفّح المعرض
  useEffect(() => {
    if (!selColor) return undefined;
    const onDocClick = (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest('[data-pick-zone]')) return; // داخل قسمي الألوان/النمر
      if (el.closest('button, a, input, textarea, select, label, img, video, [role="button"], .fixed')) return;
      setSelColor(''); setSelSize(''); setPickErr('');
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [selColor]);

  const [shared, setShared] = useState(false);

  // مشاركة المنتج: نشارك رابط /share/ الذي يعرض صورة المنتج الحقيقية بمعاينة واتساب
  // (يحوّل تلقائياً لصفحة المنتج عند الفتح). واجهة المشاركة الأصلية إن توفّرت، وإلا نسخ الرابط.
  const shareProduct = async () => {
    const url = product?.id ? `${window.location.origin}/share/product/${product.id}` : window.location.href;
    // نص مشاركة مغرٍ: مع خصم → النسبة والسعر القديم (مشاركات السوشال تجيب زبائن أكثر)
    const deal = product?.oldPrice && product.oldPrice > product.price;
    const text = deal
      ? t('product.shareTextDeal', { name: product.name, price: product.price, oldPrice: product.oldPrice, pct: Math.round((1 - product.price / product.oldPrice) * 100) })
      : t('product.shareText', { name: product?.name || '', price: product?.price || '' });
    if (navigator.share) {
      try { await navigator.share({ title: product?.name, text, url }); return; } catch { /* أُلغيت */ }
    }
    try { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1800); } catch { /* تجاهل */ }
  };

  // دليل اجتماعي حقيقي: عدد من شاهدوا المنتج خلال آخر 30 دقيقة (يحسبه الخادم
  // فعلياً بالذاكرة) — بدل الرقم الثابت التقديري السابق المشتق من معرّف المنتج.
  const [viewers, setViewers] = useState(0);

  const fetchData = () => {
    api
      .get(`/public/product/${id}`)
      .then((res) => {
        const p = res.data.product;
        setProduct(p);
        setViewers(Number(res.data.viewing) || 0);
        setReviews(res.data.reviews || []);
        setActive(0);
        pushRecent(p);
        setRecent(getRecent());
        setCache(`product:${id}`, res.data); // للرجوع الفوري لاحقاً
        fetchRelated(p);
      })
      .catch((err) => {
        // لا نستبدل منتجاً معروضاً (من المخزّن) بصفحة خطأ بسبب تعثّر شبكة لحظي —
        // الخطأ يظهر فقط إن لم يكن لدينا ما نعرضه أصلاً
        if (!getCache(`product:${id}`)?.product) setError(getErrorMessage(err, t('errors.notFound')));
        // منتج محذوف (404): نزيله من "شاهدت مؤخراً" والمفضّلة كي لا يظل يظهر ويقود لخطأ
        if (err?.response?.status === 404) { removeRecent(id); removeWish(id); }
      });
  };

  // منتجات من نفس المتجر: "قد يعجبك" (نفس الفئة) + "أكملي إطلالتك" (فئة مختلفة)
  const fetchRelated = (p) => {
    if (!p?.storeSlug) return;
    const apply = (data) => {
      const all = (data.products || [])
        .filter((x) => x.id !== p.id)
        .map((x) => ({ ...x, storeSlug: p.storeSlug }));
      setRelated(all.filter((x) => x.category === p.category).slice(0, 10));
      setComplementary(all.filter((x) => x.category !== p.category).slice(0, 10));
    };
    const cached = getCache(`store:${p.storeSlug}`);
    if (cached) apply(cached); // عرض فوري من المخزّن ثم تحديث بالخلفية
    api
      .get(`/public/store/${p.storeSlug}`)
      .then((res) => { setCache(`store:${p.storeSlug}`, res.data); apply(res.data); })
      .catch(() => { if (!cached) { setRelated([]); setComplementary([]); } });
  };

  useEffect(() => {
    const cached = getCache(`product:${id}`);
    if (cached) {
      setProduct(cached.product);
      setReviews(cached.reviews || []);
      pushRecent(cached.product);
      setRecent(getRecent());
      fetchRelated(cached.product);
    } else {
      setProduct(null);
    }
    fetchData(); // تحديث بالخلفية دائماً
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // منتج محذوف/رابط قديم: بطاقة أنيقة بمخرج واضح بدل نص عارٍ يترك الزائرة عالقة
  if (error) {
    return (
      <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <BagIcon className="h-12 w-12 text-wine/25" />
        <p className="text-stone-300">{error}</p>
        <Link
          to="/shop"
          className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
        >
          {t('co.doneKeepShopping')}
        </Link>
      </div>
    );
  }
  if (!product) return <ProductDetailsSkeleton />;

  // صور اللون المختار (Color Swatches) تطغى على المعرض العام عند اختيار لون له صور
  const colorImages = product.colorImages && typeof product.colorImages === 'object' ? product.colorImages : {};
  const activeColorImgs = selColor && Array.isArray(colorImages[selColor]) ? colorImages[selColor].filter(Boolean) : [];
  const gallery = activeColorImgs.length
    ? activeColorImgs
    : [...new Set([product.imageUrl, ...(product.images || [])].filter(Boolean))];
  const hasImages = gallery.length > 0;
  if (!hasImages && !product.videoUrl) gallery.push(PH); // عنصر بديل فقط لو ما في صور ولا فيديو
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const liked = has(product.id);

  // المخزون لكل لون ثم نمرة (النموذج الجديد): { "أسود": {"38": 3}, ... }
  const colorStock = product.colorStock && typeof product.colorStock === 'object' ? product.colorStock : {};
  const hasColorStock = Object.keys(colorStock).length > 0;

  const sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {};
  const sizes = (product.size || '').split(',').map((s) => s.trim()).filter(Boolean);
  const colors = hasColorStock ? Object.keys(colorStock) : (product.color || '').split(',').map((s) => s.trim()).filter(Boolean);

  // النمر المتاحة وكميتها — عند المخزون لكل لون تعتمد على اللون المختار
  const availSizes = hasColorStock ? (selColor ? Object.keys(colorStock[selColor] || {}) : []) : sizes;
  const qtyFor = (s) => (hasColorStock ? (selColor ? colorStock[selColor]?.[s] : undefined) : sizeStock[s]);
  const sizeSoldOut = (s) => qtyFor(s) === 0;
  const hasSizeStock = hasColorStock ? true : (sizes.length > 0 && sizes.some((s) => typeof sizeStock[s] === 'number'));
  // عند تتبّع كميات لكل نمرة نعرض المتبقّي على كل نمرة (بدل حبّة المخزون العامة) لتفادي تعدّد الصيغ
  const perSize = hasColorStock || hasSizeStock;
  // نفد المنتج: المخزون العام = 0، أو كل الكميات = 0
  const allSoldOut = hasColorStock
    ? Object.values(colorStock).every((sz) => Object.values(sz).every((q) => q === 0))
    : (hasSizeStock && sizes.every((s) => sizeStock[s] === 0));
  const outOfStock = product.stock === 0 || allSoldOut;
  // الكمية المتبقّية للمقاس المختار (إن وُجدت)
  const selSizeQty = (() => { const q = qtyFor(selSize); return typeof q === 'number' ? q : null; })();

  const cartProduct = { ...product, whatsapp: product.storeWhatsapp, size: selSize, color: selColor };

  // التحقق من اختيار اللون/المقاس قبل الإضافة أو الشراء
  const validatePick = () => {
    if (hasColorStock) {
      if (!selColor) { setPickErr(t('product.pickColorFirst')); return false; }
      if (!selSize) { setPickErr(t('product.pickSize')); return false; }
      if (sizeSoldOut(selSize)) { setPickErr(t('product.sizeSoldOut')); return false; }
    } else {
      if (sizes.length && !selSize) { setPickErr(t('product.pickSize')); return false; }
      if (selSize && sizeSoldOut(selSize)) { setPickErr(t('product.sizeSoldOut')); return false; }
      if (colors.length && !selColor) { setPickErr(t('product.pickColor')); return false; }
    }
    setPickErr('');
    return true;
  };
  // عند نقص الاختيار: ننزلق لقسم اللون/المقاس ليرى المشتري المطلوب (خصوصاً من الشريط الثابت بالأسفل).
  // نحسب الموضع ونستخدم window.scrollTo (أوثق من scrollIntoView smooth على iOS القديم)
  const scrollToPick = () => {
    const el = pickRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + el.offsetHeight / 2;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };
  // الكمية تُقصّ على المتبقي من المقاس المختار (قد تتغيّر بعد ضبط العدّاد)
  const buyQty = Math.max(1, Math.min(qty, selSizeQty ?? qty));
  const handleAdd = () => { if (outOfStock) return; if (!validatePick()) { scrollToPick(); return; } add(cartProduct, buyQty); };
  const handleBuy = () => { if (outOfStock) return; if (!validatePick()) { scrollToPick(); return; } buyNow(cartProduct, buyQty); };

  // تنبيه التوفّر: يظهر عند نفاد المنتج كلياً أو نفاد المقاس المختار
  const showNotify = outOfStock || (selSize && sizeSoldOut(selSize));
  const submitNotify = async () => {
    if (notifyPhone.replace(/\D/g, '').length < 6) { setPickErr(t('product.notifyInvalid')); return; }
    setNotifyBusy(true); setPickErr('');
    try {
      await api.post('/public/stock-request', { productId: product.id, color: selColor, size: selSize, phone: notifyPhone.trim() });
      setNotifySent(true);
    } catch (err) {
      setPickErr(getErrorMessage(err, t('errors.generic')));
    } finally {
      setNotifyBusy(false);
    }
  };

  // بيانات Schema.org للمنتج → نتائج Google الغنية (سعر/توفّر/تقييم/علامة المتجر)
  const productLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    ...(gallery.length ? { image: gallery } : {}),
    description: product.description || product.name,
    ...(product.storeName ? { brand: { '@type': 'Brand', name: product.storeName } } : {}),
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'ILS',
      availability: outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      ...(typeof window !== 'undefined' ? { url: window.location.href } : {}),
    },
    ...(product.ratingCount > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount } }
      : {}),
  };

  return (
    <>
      <Seo title={product.name} description={product.description || product.name} image={gallery[0]} type="product" jsonLd={productLd} />

      {/* رجوع للصفحة السابقة (الفئة/المتجر/البحث) — وإن لم يوجد سجلّ نرجع للمتجر */}
      <button
        onClick={() => goBack(navigate, `/store/${product.storeSlug}`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gold-300 transition hover:text-gold-200"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
        </svg>
        {t('common.back')}
      </button>

      <div className="glass-strong grid gap-8 overflow-hidden p-6 md:grid-cols-2">
        {/* معرض الصور */}
        <div>
          {hasImages && (
          <div
            className="relative mx-auto w-fit"
            style={{ touchAction: 'pan-y' }}
            onTouchStart={(e) => { const t0 = e.touches[0]; galTouch.current = { x: t0.clientX, y: t0.clientY }; }}
            onTouchEnd={(e) => {
              // سحب أفقي يبدّل صورة المعرض (نفس سلوك عارض الصور) — يتبع اتجاه اللغة
              const s = galTouch.current; galTouch.current = null;
              if (!s || gallery.length < 2) return;
              const dx = e.changedTouches[0].clientX - s.x;
              const dy = e.changedTouches[0].clientY - s.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                const d = dx < 0 ? (rtl ? -1 : 1) : (rtl ? 1 : -1);
                setActive((p) => (p + d + gallery.length) % gallery.length);
              }
            }}
          >
            {/* الصورة تظهر بحجمها الطبيعي (مثل الفيديو) بلا قص — نقر للتكبير */}
            <img
              key={gallery[active]}
              src={cldThumb(gallery[active], 900)}
              alt={product.name}
              decoding="async"
              onClick={() => setLightbox(true)}
              className="media-cap block w-auto max-w-full cursor-zoom-in rounded-2xl bg-ink-800 object-contain animate-fade-in [animation-duration:350ms]"
              onError={(e) => (e.currentTarget.src = PH)}
            />
            {hasDiscount && <span className="badge absolute start-3 top-3 bg-[#8a2438] text-[#F4EDE2] shadow-sm">-{Math.round((1 - product.price / product.oldPrice) * 100)}%</span>}
            {/* أيقونة تكبير */}
            <button onClick={() => setLightbox(true)} aria-label="zoom" className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>
            </button>
          </div>
          )}
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border ${i === active ? 'border-gold-400' : 'border-transparent opacity-60'}`}
                >
                  <img src={cldThumb(g, 160)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* فيديو المنتج — يتأقلم مع مقاسه (9:16) بلا سواد حوله */}
          {product.videoUrl && (
            <video
              src={product.videoUrl}
              poster={cldVideoPoster(product.videoUrl)}
              controls
              playsInline
              preload="metadata"
              className="media-cap mx-auto mt-3 block w-auto max-w-full rounded-2xl bg-ink-900"
            />
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <span className="badge bg-gold-400/10 text-gold-200">{t(`categories.${product.category}`)}</span>
            <div className="flex items-center gap-2">
              {/* مشاركة المنتج */}
              <div className="relative">
                <button
                  onClick={shareProduct}
                  aria-label={t('product.share')}
                  title={t('product.share')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-400/30 text-wine transition hover:bg-gold-400/10"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                  </svg>
                </button>
                {shared && (
                  <span className="absolute -bottom-8 end-0 z-10 whitespace-nowrap rounded-lg bg-wine px-2.5 py-1 text-xs font-semibold text-cream shadow-lg">
                    {t('product.shareCopied')}
                  </span>
                )}
              </div>
              <button
                onClick={() => toggle(product)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${liked ? 'border-red-400 bg-red-500/20' : 'border-gold-400/30 hover:bg-gold-400/10'}`}
              >
                <HeartIcon className="h-6 w-6" filled={liked} />
              </button>
            </div>
          </div>

          <h1 className="mt-2 font-display text-3xl font-extrabold text-stone-100">{product.name}</h1>

          {product.ratingCount > 0 && (
            <button
              type="button"
              onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-2 flex items-center gap-2 text-sm text-stone-400 transition hover:text-gold-200"
            >
              <StarRating value={Math.round(product.ratingAvg)} /> {product.ratingAvg} <span className="underline underline-offset-2">({product.ratingCount})</span>
            </button>
          )}

          {/* عدّاد المبيعات الحقيقي — دليل اجتماعي يطمئن الزبونة (يزيد عند تأكيد كل طلب) */}
          {product.soldCount > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {t('product.soldCount', { count: product.soldCount })}
            </p>
          )}

          {/* بلوك السعر الفاخر: سعر ضخم + القديم مشطوباً بالمنتصف + شارة توفير خمرية */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* الرقمان الجديد والقديم في مجموعة items-baseline → يقفان على نفس خط الأساس */}
            <span className="flex items-baseline gap-x-3">
              <span className="font-display text-4xl font-extrabold gradient-text">{t('common.currency')}{product.price}</span>
              {hasDiscount && <Strike className="text-lg text-stone-500">{t('common.currency')}{product.oldPrice}</Strike>}
            </span>
            {hasDiscount && (
              <span className="rounded-full bg-[#8a2438] px-2.5 py-1 text-xs font-bold text-[#F4EDE2] shadow-sm">
                {t('product.savePct', { pct: Math.round((1 - product.price / product.oldPrice) * 100) })}
              </span>
            )}
            {hasDiscount && (
              <span className="text-xs font-semibold text-[#8a2438]">
                {t('product.saveAmount', { amount: `${t('common.currency')}${(product.oldPrice - product.price).toFixed(2).replace(/\.00$/, '')}` })}
              </span>
            )}
          </div>

          {/* دليل اجتماعي: مشاهدات حقيقية خلال آخر 30 دقيقة (من الخادم) — يظهر من مشاهدَين فأكثر */}
          {!outOfStock && viewers >= 2 && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-wine/60">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t('product.viewingNow', { count: viewers })}
            </p>
          )}

          {/* عدّاد العرض المحدود — تصميم فخم */}
          {product.saleEndsAt && (
            <div className="mt-4">
              <Countdown endsAt={product.saleEndsAt} variant="boxes" />
            </div>
          )}

          {/* مؤشّر المخزون العام — يظهر فقط للمنتجات بلا كميات لكل نمرة (تفادياً لتعدّد الصيغ) */}
          {!perSize && (
            <div className="mt-3">
              <StockBadge outOfStock={outOfStock} selSize={selSize} selSizeQty={selSizeQty} stock={product.stock} t={t} />
            </div>
          )}
          {/* للمنتجات بكميات لكل نمرة: لو نفد كلياً نعرض تنبيهاً واحداً واضحاً */}
          {perSize && outOfStock && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-bold text-red-700 ring-1 ring-red-500/25">
                <span className="h-2 w-2 rounded-full bg-red-500" /> {t('product.outOfStock')}
              </span>
            </div>
          )}

          {product.description && (
            <div className="mt-5">
              <p className={`whitespace-pre-line leading-relaxed text-stone-300 ${!descExp && product.description.length > 240 ? 'line-clamp-4' : ''}`}>{product.description}</p>
              {product.description.length > 240 && (
                <button type="button" onClick={() => setDescExp((v) => !v)} className="mt-1.5 text-sm font-semibold text-wine transition hover:text-wine/70">
                  {descExp ? t('common.showLess') : t('common.showMore')}
                </button>
              )}
            </div>
          )}

          {/* اللون — يُختار أولاً عند تتبّع المخزون لكل لون */}
          {colors.length > 0 && (
            <div ref={colors.length ? pickRef : null} data-pick-zone className="mt-6">
              <ColorSwatches
                colors={colors}
                colorImages={colorImages}
                colorStock={colorStock}
                value={selColor}
                onChange={(c) => { setSelColor(c); if (hasColorStock) setSelSize(''); setPickErr(''); setActive(0); }}
                label={t('product.selectColor')}
                tone="dark"
              />
            </div>
          )}

          {/* المقاس (النمرة) — عند المخزون لكل لون تظهر نمر اللون المختار فقط */}
          {(hasColorStock ? colors.length > 0 : sizes.length > 0) && (
            <div ref={colors.length ? null : pickRef} data-pick-zone className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-stone-300">{t('product.selectSize')}</p>
                <button
                  type="button"
                  onClick={() => setSizeGuide(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-wine/30 px-3 py-1 text-xs font-bold text-wine transition hover:bg-wine hover:text-cream"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="8" width="19" height="8" rx="1.6" /><path d="M7 8v3M12 8v4M17 8v3" />
                  </svg>
                  {t('product.sizeGuide')}
                </button>
              </div>
              {hasColorStock && !selColor ? (
                <p className="flex items-center gap-1.5 rounded-xl bg-wine/5 px-3 py-2 text-sm font-medium text-wine/70"><HandIcon className="h-4 w-4 shrink-0" /> {t('product.pickColorFirst')}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {availSizes.map((s) => {
                      const soldOut = sizeSoldOut(s);
                      const qty = typeof qtyFor(s) === 'number' ? qtyFor(s) : null;
                      const on = selSize === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={soldOut}
                          onClick={() => { setSelSize(s); setPickErr(''); }}
                          className={`flex min-w-[3.75rem] flex-col items-center rounded-xl border px-3 py-1.5 text-center transition ${
                            on ? 'border-wine bg-wine text-cream' : 'border-wine/30 text-wine hover:bg-wine/10'
                          } ${soldOut ? 'cursor-not-allowed border-stone-300/50 bg-transparent text-stone-400 opacity-60' : ''}`}
                        >
                          <span className={`text-sm font-bold leading-none ${soldOut ? 'strike' : ''}`}>{sizeLabel(s, t)}</span>
                          {/* المتبقّي بنفس التنسيق لكل النمر: رمادي = متوفّر، أحمر = نفد */}
                          {qty != null && (
                            <span className={`mt-1 text-[10px] font-medium leading-none ${on ? 'text-cream/80' : soldOut ? 'text-red-500' : 'text-wine/55'}`}>
                              {soldOut ? t('product.soldOutShort') : t('product.leftShort', { count: qty })}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {pickErr && <p className="mt-4 text-sm font-medium text-red-500">{pickErr}</p>}

          {/* تنبيه التوفّر عند نفاد المنتج/المقاس */}
          {showNotify && (
            <div className="mt-6 rounded-2xl border border-wine/15 bg-wine/5 p-4">
              {notifySent ? (
                <p className="text-center text-sm font-semibold text-emerald-600">{t('product.notifySent')}</p>
              ) : (
                <>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-wine"><BellIcon className="h-4 w-4" /> {t('product.notifyTitle')}</p>
                  <div className="flex gap-2">
                    <input
                      dir="ltr"
                      inputMode="tel"
                      autoComplete="tel"
                      className="input flex-1 !rounded-xl text-end"
                      placeholder={t('product.notifyPhonePlaceholder')}
                      value={notifyPhone}
                      onChange={(e) => setNotifyPhone(e.target.value)}
                    />
                    <button onClick={submitNotify} disabled={notifyBusy} className="shrink-0 rounded-xl bg-wine px-5 font-bold text-cream transition hover:bg-wine-dark disabled:opacity-60">
                      {notifyBusy ? '…' : t('product.notifySend')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* أزرار الشراء — "اطلبي الآن" شراء فوري (يفتح إتمام الطلب مباشرةً) — حبوب فاخرة بهالة ذهبية */}
          {/* الكمية — عدّاد حبّي: مقفول حتى يكتمل اختيار اللون/النمرة (فلا كمية قبل معرفة المتبقي)،
              وبعدها يتقيّد بالمتبقي من نمرة اللون المختار */}
          {!outOfStock && !showNotify && (() => {
            const pickDone = hasColorStock
              ? (selColor && selSize && !sizeSoldOut(selSize))
              : ((!sizes.length || selSize) && (!colors.length || selColor));
            return (
              <div className={`mt-5 flex items-center justify-between transition ${pickDone ? '' : 'opacity-45'}`}>
                <span className="text-sm font-semibold text-stone-300">{t('product.quantity')}</span>
                <div className="flex items-center gap-0.5 rounded-full border border-wine/25 px-1.5 py-1">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={!pickDone || qty <= 1} aria-label="-" className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-wine transition hover:bg-wine/10 disabled:opacity-30">−</button>
                  <span className="w-7 text-center font-bold text-stone-100">{qty}</span>
                  <button type="button" onClick={() => { if (!pickDone) { validatePick(); scrollToPick(); return; } setQty((q) => Math.min(selSizeQty ?? 99, q + 1)); }} disabled={pickDone && selSizeQty != null && qty >= selSizeQty} aria-label="+" className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-wine transition hover:bg-wine/10 disabled:opacity-30">+</button>
                </div>
              </div>
            );
          })()}

          <div ref={ctaRef} className={`mt-auto flex flex-col gap-3 pt-6 sm:flex-row ${showNotify ? 'hidden' : ''}`}>
            <button onClick={handleBuy} disabled={outOfStock} className="btn-buy flex-1 py-4 text-base">
              <BagIcon className="h-5 w-5" /> {t('product.buyNow')}
            </button>
            <button onClick={handleAdd} disabled={outOfStock} className="btn-cart flex-1 py-4 text-base">
              <CartIcon className="h-5 w-5" /> {t('product.addToCart')}
            </button>
          </div>

          {/* صف الثقة — يطمئن الزبونة قبل الشراء (توصيل · دفع عند الاستلام · تبديل سهل) */}
          {!showNotify && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: t('product.trustDelivery'), d: <><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" /></> },
                { label: t('product.trustCod'), d: <><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.3" /></> },
                { label: t('product.trustExchange'), d: <path d="M4 9h13l-3-3M20 15H7l3 3" /> },
              ].map((it, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl border border-wine/12 bg-wine/[0.03] px-2 py-3 text-center">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-wine" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{it.d}</svg>
                  <span className="text-[11px] font-semibold leading-tight text-stone-300">{it.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* سياسة الإرجاع والتبديل — تطمئن الزبونة قبل الشراء */}
      <ReturnPolicy policy={product.storeReturnPolicy} />

      {lightbox && hasImages && <Lightbox images={gallery} index={active} onClose={() => setLightbox(false)} />}

      {/* دليل المقاسات — نمر هذا المنتج فقط */}
      {sizeGuide && (
        <SizeGuideModal
          sizes={hasColorStock ? [...new Set(Object.values(colorStock).flatMap((sz) => Object.keys(sz)))] : sizes}
          chart={product.storeSizeChart}
          onClose={() => setSizeGuide(false)}
        />
      )}

      {/* أكملي إطلالتك — قطع مكمّلة من المتجر (فئة مختلفة) */}
      <ProductRail title={t('product.completeLook')} icon={<SparkleIcon className="h-5 w-5" />} products={complementary} currentId={product.id} />

      {/* قد يعجبك أيضاً */}
      <ProductRail title={t('product.youMayLike')} products={related} currentId={product.id} />

      {/* التقييمات */}
      <Reviews productId={product.id} reviews={reviews} onAdded={fetchData} />

      {/* شاهدت مؤخراً */}
      <ProductRail title={t('product.recentlyViewed')} products={recent} currentId={product.id} />

      {/* شريط الشراء الثابت — يظهر عند التمرير تحت زر الشراء ويحلّ محلّ شريط التنقّل (أسلوب المتاجر العالمية) */}
      {showBuyBar && !outOfStock && (
        <div className="fixed inset-x-0 bottom-0 z-[78] animate-fade-up border-t border-wine/10 bg-white/95 pb-[max(env(safe-area-inset-bottom),8px)] pt-2.5 shadow-[0_-6px_20px_rgba(94,70,54,0.14)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold text-stone-100">{product.name}</p>
              <p className="font-display text-base font-bold text-wine">{t('common.currency')}{product.price}</p>
            </div>
            <button onClick={handleAdd} aria-label={t('product.addToCart')} title={t('product.addToCart')} className="btn-cart h-11 w-11 shrink-0">
              <CartIcon className="h-5 w-5" />
            </button>
            <button onClick={handleBuy} className="btn-buy shrink-0 px-6 py-2.5 text-sm">
              <BagIcon className="h-4 w-4" /> {t('product.buyNow')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// مؤشّر مخزون عصري: نفد (أحمر) · كمية منخفضة (تدرّج ناري + نبضة) · متوفّر (أخضر)
function StockBadge({ outOfStock, selSize, selSizeQty, stock, t }) {
  const remaining = selSizeQty != null ? selSizeQty : (typeof stock === 'number' ? stock : null);

  if (outOfStock || remaining === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-bold text-red-700 ring-1 ring-red-500/25">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        {selSize ? t('product.sizeSoldOut') : t('product.outOfStock')}
      </span>
    );
  }
  if (remaining != null && remaining <= 5) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-red-500 px-3.5 py-1.5 text-sm font-extrabold text-white shadow-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <FireIcon className="h-4 w-4" /> {t('product.lastFew', { count: remaining })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-bold text-emerald-600 ring-1 ring-emerald-500/25">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {remaining != null ? t('product.stockLeft', { count: remaining }) : t('product.available')}
    </span>
  );
}

// سياسة الإرجاع والتبديل — بطاقة قابلة للطيّ. نص المتجر إن وُجد، وإلا نص افتراضي مطمئن.
function ReturnPolicy({ policy }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const text = (policy && policy.trim()) || t('product.returnPolicyDefault');
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-wine/15 bg-wine/[0.03]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wine/10 text-wine">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l7.5 2.8v5.1c0 4.4-3 7.6-7.5 9.6-4.5-2-7.5-5.2-7.5-9.6V5.8L12 3z" /><path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <span className="flex-1 font-display text-base font-bold text-wine">{t('product.returnPolicy')}</span>
        <svg viewBox="0 0 24 24" className={`h-5 w-5 text-wine/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <p className="whitespace-pre-line px-4 pb-4 text-sm leading-relaxed text-wine/75">{text}</p>}
    </div>
  );
}

function Reviews({ productId, reviews, onAdded }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ authorName: '', rating: 0, comment: '', imageUrl: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(''); // صورة تقييم مُكبّرة
  const photos = reviews.filter((r) => r.imageUrl); // صور الزبائن — شريط بارز أعلى المراجعات

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    if (!form.rating) { setError(t('product.yourRating')); return; }
    setBusy(true);
    try {
      await api.post(`/public/product/${productId}/reviews`, form);
      setForm({ authorName: '', rating: 0, comment: '', imageUrl: '' });
      setMsg(t('product.reviewAdded'));
      onAdded();
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="reviews" className="mt-8 grid scroll-mt-20 gap-6 lg:grid-cols-[1fr_360px]">
      {/* قائمة المراجعات */}
      <div className="glass p-6">
        <h2 className="mb-4 font-display text-xl font-bold gradient-text">{t('product.reviews')}</h2>
        {/* صور الزبائن — دليل اجتماعي بصري بارز (أسلوب المتاجر العالمية) */}
        {photos.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-bold text-stone-400">{t('product.customerPhotos')} ({photos.length})</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((r) => (
                <button key={r.id} type="button" onClick={() => setZoom(r.imageUrl)} className="shrink-0 overflow-hidden rounded-xl border border-wine/15 transition hover:opacity-90">
                  <img src={r.imageUrl} alt="" loading="lazy" className="h-20 w-20 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
        {reviews.length === 0 ? (
          <p className="text-sm text-stone-400">{t('product.noReviews')}</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-white/5 pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-100">{r.authorName}</span>
                  <StarRating value={r.rating} size="text-sm" />
                </div>
                {r.comment && <p className="mt-1 text-sm text-stone-300">{r.comment}</p>}
                {r.imageUrl && (
                  <button type="button" onClick={() => setZoom(r.imageUrl)} className="mt-2 block overflow-hidden rounded-xl border border-wine/15">
                    <img src={r.imageUrl} alt="" loading="lazy" className="h-24 w-24 object-cover transition hover:opacity-90" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نموذج إضافة تقييم */}
      <div className="glass h-fit p-6">
        <h3 className="mb-4 font-display text-lg font-bold text-stone-100">{t('product.writeReview')}</h3>
        {msg && <div className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{msg}</div>}
        {error && <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">{t('product.yourName')}</label>
            <input type="text" required className="input" value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('product.yourRating')}</label>
            <StarRating value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} size="text-2xl" />
          </div>
          <div>
            <label className="label">{t('product.yourComment')}</label>
            <textarea rows={3} className="input resize-none" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          </div>
          <ImageInput label={t('product.reviewPhoto')} value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('common.loading') : t('product.submitReview')}
          </button>
        </form>
      </div>

      {zoom && <Lightbox images={[zoom]} index={0} onClose={() => setZoom('')} />}
    </section>
  );
}

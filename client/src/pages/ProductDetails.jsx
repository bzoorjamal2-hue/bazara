import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductDetailsSkeleton } from '../components/Skeleton.jsx';
import StarRating from '../components/StarRating.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ProductRail from '../components/ProductRail.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { cldVideoPoster } from '../utils/cloudinary.js';
import { pushRecent, getRecent } from '../utils/recentlyViewed.js';
import { sizeLabel } from '../utils/sizes.js';
import Countdown from '../components/Countdown.jsx';
import SizeGuideModal from '../components/SizeGuideModal.jsx';
import ImageInput from '../components/ImageInput.jsx';

const PH = 'https://placehold.co/600x600/121214/d4af37?text=%F0%9F%91%97';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const { add, buyNow } = useCart();
  const { has, toggle } = useWishlist();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [complementary, setComplementary] = useState([]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [selSize, setSelSize] = useState('');
  const [selColor, setSelColor] = useState('');
  const [pickErr, setPickErr] = useState('');
  const [lightbox, setLightbox] = useState(false);
  const [sizeGuide, setSizeGuide] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifySent, setNotifySent] = useState(false);

  const fetchData = () => {
    api
      .get(`/public/product/${id}`)
      .then((res) => {
        const p = res.data.product;
        setProduct(p);
        setReviews(res.data.reviews || []);
        setActive(0);
        pushRecent(p);
        setRecent(getRecent());
        fetchRelated(p);
      })
      .catch((err) => setError(getErrorMessage(err, t('errors.notFound'))));
  };

  // منتجات من نفس المتجر: "قد يعجبك" (نفس الفئة) + "أكملي إطلالتك" (فئة مختلفة)
  const fetchRelated = (p) => {
    if (!p?.storeSlug) return;
    api
      .get(`/public/store/${p.storeSlug}`)
      .then((res) => {
        const all = (res.data.products || [])
          .filter((x) => x.id !== p.id)
          .map((x) => ({ ...x, storeSlug: p.storeSlug }));
        setRelated(all.filter((x) => x.category === p.category).slice(0, 10));
        setComplementary(all.filter((x) => x.category !== p.category).slice(0, 10));
      })
      .catch(() => { setRelated([]); setComplementary([]); });
  };

  useEffect(() => {
    setProduct(null);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="glass p-10 text-center text-stone-300">{error}</div>;
  if (!product) return <ProductDetailsSkeleton />;

  const gallery = [...new Set([product.imageUrl, ...(product.images || [])].filter(Boolean))];
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
  const handleAdd = () => { if (outOfStock || !validatePick()) return; add(cartProduct); };
  const handleBuy = () => { if (outOfStock || !validatePick()) return; buyNow(cartProduct); };

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

  const chipCls = (on) =>
    `min-w-11 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-wine bg-wine text-cream' : 'border-wine/30 text-wine hover:bg-wine/10'}`;

  return (
    <>
      <Seo title={product.name} description={product.description || product.name} image={gallery[0]} type="product" />

      {/* رجوع للصفحة السابقة (الفئة/المتجر/البحث) — وإن لم يوجد سجلّ نرجع للمتجر */}
      <button
        onClick={() => { if (window.history.length > 2) navigate(-1); else navigate(`/store/${product.storeSlug}`); }}
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
          <div className="relative mx-auto w-fit">
            {/* الصورة تظهر بحجمها الطبيعي (مثل الفيديو) بلا قص — نقر للتكبير */}
            <img
              src={gallery[active]}
              alt={product.name}
              onClick={() => setLightbox(true)}
              className="block max-h-[75vh] w-auto max-w-full cursor-zoom-in rounded-2xl bg-ink-800 object-contain"
              onError={(e) => (e.currentTarget.src = PH)}
            />
            {hasDiscount && <span className="badge absolute start-3 top-3 bg-red-500 text-white">-{Math.round((1 - product.price / product.oldPrice) * 100)}%</span>}
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
                  <img src={g} alt="" className="h-full w-full object-cover" />
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
              className="mx-auto mt-3 block max-h-[75vh] w-auto max-w-full rounded-2xl bg-ink-900"
            />
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <span className="badge bg-gold-400/10 text-gold-200">{t(`categories.${product.category}`)}</span>
            <button
              onClick={() => toggle(product)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${liked ? 'border-red-400 bg-red-500/20' : 'border-gold-400/30 hover:bg-gold-400/10'}`}
            >
              {liked ? '❤️' : '🤍'}
            </button>
          </div>

          <h1 className="mt-2 font-display text-3xl font-extrabold text-stone-100">{product.name}</h1>

          {product.ratingCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm text-stone-400">
              <StarRating value={Math.round(product.ratingAvg)} /> {product.ratingAvg} ({product.ratingCount})
            </div>
          )}

          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold gradient-text">{t('common.currency')}{product.price}</span>
            {hasDiscount && <span className="text-lg text-stone-500 line-through">{t('common.currency')}{product.oldPrice}</span>}
          </div>

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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-bold text-red-500 ring-1 ring-red-500/25">
                <span className="h-2 w-2 rounded-full bg-red-500" /> {t('product.outOfStock')}
              </span>
            </div>
          )}

          {product.description && <p className="mt-5 leading-relaxed text-stone-300">{product.description}</p>}

          {/* اللون — يُختار أولاً عند تتبّع المخزون لكل لون */}
          {colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-stone-300">{t('product.selectColor')}</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setSelColor(c); if (hasColorStock) setSelSize(''); setPickErr(''); }}
                    className={`flex items-center gap-2 ${chipCls(selColor === c)}`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border border-current/40" style={{ background: c }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* المقاس (النمرة) — عند المخزون لكل لون تظهر نمر اللون المختار فقط */}
          {(hasColorStock ? colors.length > 0 : sizes.length > 0) && (
            <div className="mt-5">
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
                <p className="rounded-xl bg-wine/5 px-3 py-2 text-sm font-medium text-wine/70">👆 {t('product.pickColorFirst')}</p>
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
                          <span className={`text-sm font-bold leading-none ${soldOut ? 'line-through' : ''}`}>{sizeLabel(s, t)}</span>
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
                  <p className="mb-2 text-sm font-bold text-wine">🔔 {t('product.notifyTitle')}</p>
                  <div className="flex gap-2">
                    <input
                      dir="ltr"
                      inputMode="tel"
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

          {/* أزرار الشراء — "اطلب الآن" شراء فوري (يفتح إتمام الطلب مباشرةً) */}
          <div className={`mt-auto flex flex-col gap-3 pt-6 sm:flex-row ${showNotify ? 'hidden' : ''}`}>
            <button
              onClick={handleBuy}
              disabled={outOfStock}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-wine to-wine-dark py-3.5 font-bold text-cream shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🛍️ {t('product.buyNow')}
            </button>
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-wine/40 py-3.5 font-bold text-wine transition hover:bg-wine/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🛒 {t('product.addToCart')}
            </button>
          </div>
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
      <ProductRail title={`✨ ${t('product.completeLook')}`} products={complementary} currentId={product.id} />

      {/* قد يعجبك أيضاً */}
      <ProductRail title={t('product.youMayLike')} products={related} currentId={product.id} />

      {/* التقييمات */}
      <Reviews productId={product.id} reviews={reviews} onAdded={fetchData} />

      {/* شاهدت مؤخراً */}
      <ProductRail title={t('product.recentlyViewed')} products={recent} currentId={product.id} />
    </>
  );
}

// مؤشّر مخزون عصري: نفد (أحمر) · كمية منخفضة (تدرّج ناري + نبضة) · متوفّر (أخضر)
function StockBadge({ outOfStock, selSize, selSizeQty, stock, t }) {
  const remaining = selSizeQty != null ? selSizeQty : (typeof stock === 'number' ? stock : null);

  if (outOfStock || remaining === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-bold text-red-500 ring-1 ring-red-500/25">
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
        🔥 {t('product.lastFew', { count: remaining })}
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
    <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* قائمة المراجعات */}
      <div className="glass p-6">
        <h2 className="mb-4 font-display text-xl font-bold gradient-text">{t('product.reviews')}</h2>
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

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
import StarRating from '../components/StarRating.jsx';
import OrderOptions from '../components/OrderOptions.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { cldVideoPoster } from '../utils/cloudinary.js';

const PH = 'https://placehold.co/600x600/121214/d4af37?text=%F0%9F%91%97';

export default function ProductDetails() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);

  const fetchData = () => {
    api
      .get(`/public/product/${id}`)
      .then((res) => {
        setProduct(res.data.product);
        setReviews(res.data.reviews || []);
        setActive(0);
      })
      .catch((err) => setError(getErrorMessage(err, t('errors.notFound'))));
  };

  useEffect(() => {
    setProduct(null);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="glass p-10 text-center text-stone-300">{error}</div>;
  if (!product) return <Spinner full />;

  const gallery = [product.imageUrl, ...(product.images || [])].filter(Boolean);
  const hasImages = gallery.length > 0;
  if (!hasImages && !product.videoUrl) gallery.push(PH); // عنصر بديل فقط لو ما في صور ولا فيديو
  const outOfStock = product.stock === 0;
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const liked = has(product.id);

  const cartProduct = { ...product, whatsapp: product.storeWhatsapp };
  const orderStore = {
    whatsapp: product.storeWhatsapp,
    instagram: product.storeInstagram,
    phone: product.storePhone,
  };
  const orderItems = [{ name: product.name, price: product.price, qty: 1 }];

  return (
    <>
      <Seo title={product.name} description={product.description || product.name} image={gallery[0]} type="product" />

      <Link to={`/store/${product.storeSlug}`} className="mb-4 inline-block text-sm text-gold-300 hover:text-gold-200">
        ← {product.storeName}
      </Link>

      <div className="glass-strong grid gap-8 overflow-hidden p-6 md:grid-cols-2">
        {/* معرض الصور */}
        <div>
          {hasImages && (
          <div className="relative mx-auto w-fit">
            {/* الصورة تظهر بحجمها الطبيعي (مثل الفيديو) بلا قص */}
            <img src={gallery[active]} alt={product.name} className="block max-h-[75vh] w-auto max-w-full rounded-2xl bg-ink-800 object-contain" onError={(e) => (e.currentTarget.src = PH)} />
            {hasDiscount && <span className="badge absolute start-3 top-3 bg-red-500 text-white">-{Math.round((1 - product.price / product.oldPrice) * 100)}%</span>}
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

          {/* حالة المخزون */}
          <p className={`mt-2 text-sm font-semibold ${outOfStock ? 'text-red-300' : 'text-emerald-300'}`}>
            {outOfStock ? '✕ ' + t('product.outOfStock') : '✓ ' + (product.stock > 0 ? t('product.stockLeft', { count: product.stock }) : t('product.available'))}
          </p>

          {product.description && <p className="mt-5 leading-relaxed text-stone-300">{product.description}</p>}

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {product.size && (
              <div className="glass p-3"><dt className="text-stone-400">{t('dashboard.product.size')}</dt><dd className="font-semibold text-stone-100">{product.size}</dd></div>
            )}
            {product.color && (
              <div className="glass p-3"><dt className="text-stone-400">{t('dashboard.product.color')}</dt><dd className="font-semibold text-stone-100">{product.color}</dd></div>
            )}
          </dl>

          {/* أزرار الشراء */}
          <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
            <button onClick={() => add(cartProduct)} disabled={outOfStock} className="btn-primary flex-1">
              🛒 {t('product.addToCart')}
            </button>
            <button onClick={() => setOrderOpen(true)} disabled={outOfStock} className="btn-ghost flex-1">
              🛍️ {t('product.buyNow')}
            </button>
          </div>
        </div>
      </div>

      {orderOpen && <OrderOptions store={orderStore} items={orderItems} onClose={() => setOrderOpen(false)} />}

      {/* التقييمات */}
      <Reviews productId={product.id} reviews={reviews} onAdded={fetchData} />
    </>
  );
}

function Reviews({ productId, reviews, onAdded }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ authorName: '', rating: 0, comment: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    if (!form.rating) { setError(t('product.yourRating')); return; }
    setBusy(true);
    try {
      await api.post(`/public/product/${productId}/reviews`, form);
      setForm({ authorName: '', rating: 0, comment: '' });
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
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('common.loading') : t('product.submitReview')}
          </button>
        </form>
      </div>
    </section>
  );
}

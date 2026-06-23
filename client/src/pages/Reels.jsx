import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { cldOptimized, cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { HeartIcon, CartIcon } from '../components/icons.jsx';
import CloseButton from '../components/CloseButton.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import Spinner from '../components/Spinner.jsx';
import { sizeLabel } from '../utils/sizes.js';

// تصفّح عمودي لفيديوهات المنتجات (Reels) — ملء الشاشة، تشغيل تلقائي للظاهر فقط،
// تحميل مسبق للتالي، شريط تقدّم + انتقال تلقائي، دبل-تاب لايك، وإضافة للسلة مباشرة.
export default function Reels() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();
  const { slug } = useParams(); // /store/:slug/reels → ريلز متجر واحد
  const [items, setItems] = useState(null);
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(0);
  const feedRef = useRef(null);
  useScrollLock(true);

  useEffect(() => {
    let on = true;
    setItems(null);
    api.get(`/public/reels${slug ? `?store=${encodeURIComponent(slug)}` : ''}`)
      .then((r) => { if (on) setItems(r.data.products || []); })
      .catch(() => { if (on) setItems([]); });
    return () => { on = false; };
  }, [slug]);

  // تتبّع الشريحة الفعّالة (تشغيل/تحميل مسبق/تقدّم/انتقال تلقائي)
  useEffect(() => {
    const root = feedRef.current;
    if (!root || !items || items.length === 0) return undefined;
    const slides = Array.from(root.children);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = slides.indexOf(e.target);
            if (idx >= 0) setActive(idx);
          }
        });
      },
      { root, threshold: [0.6] }
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  const goNext = (i) => {
    const root = feedRef.current;
    if (root && root.children[i + 1]) root.children[i + 1].scrollIntoView({ behavior: 'smooth' });
  };
  const goBack = () => (slug ? navigate(`/store/${slug}`) : window.history.length > 1 ? navigate(-1) : navigate('/shop'));

  return (
    <div className="fixed inset-0 z-[90] bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
        <div className="pointer-events-auto"><CloseButton onClick={goBack} variant="ghost" size="h-10 w-10" label="back" /></div>
        <span className="pointer-events-none select-none font-display text-lg font-bold text-white/90 drop-shadow">🎬 {t('reels.title')}</span>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'unmute' : 'mute'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60">
          {muted ? <MutedIcon /> : <SoundIcon />}
        </button>
      </div>

      {items === null ? (
        <div className="flex h-full items-center justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white/80">
          <span className="text-5xl">🎬</span>
          <p className="text-lg font-semibold">{t('reels.empty')}</p>
          <button onClick={goBack} className="rounded-full bg-white/15 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">{t('reels.back')}</button>
        </div>
      ) : (
        <div ref={feedRef}
          className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {items.map((p, i) => (
            <ReelSlide
              key={p.id}
              p={p}
              muted={muted}
              rtl={rtl}
              t={t}
              hint={i === 0}
              isActive={i === active}
              preload={i === active || i === active + 1}
              isLast={i === items.length - 1}
              onUnmute={() => setMuted(false)}
              onEnded={() => goNext(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReelSlide({ p, muted, rtl, t, hint, isActive, preload, isLast, onUnmute, onEnded }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const liked = has(p.id);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [burst, setBurst] = useState(0);
  const [pick, setPick] = useState(false);
  const [selSize, setSelSize] = useState('');
  const [selColor, setSelColor] = useState('');
  const vidRef = useRef(null);
  const tapRef = useRef({ t: 0, timer: null });
  const poster = cldVideoPoster(p.videoUrl) || p.imageUrl || '';

  const sizes = (p.size || '').split(',').map((s) => s.trim()).filter(Boolean);
  const colors = (p.color || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hasDiscount = p.oldPrice && p.oldPrice > p.price;
  const discountPct = hasDiscount ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  // تشغيل/إيقاف حسب كونها الشريحة الفعّالة
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return;
    if (isActive) vid.play().catch(() => {});
    else { vid.pause(); vid.currentTime = 0; setProgress(0); }
  }, [isActive]);

  useEffect(() => { if (vidRef.current) vidRef.current.muted = muted; }, [muted]);

  const onTimeUpdate = () => {
    const v = vidRef.current;
    if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
  };
  const onVidEnded = () => {
    if (isLast) { const v = vidRef.current; if (v) { v.currentTime = 0; v.play().catch(() => {}); } }
    else onEnded(); // انتقال تلقائي للتالي
  };

  const doLike = () => { if (!liked) toggle(p); setBurst((b) => b + 1); };

  // نقرة مفردة = كتم/تشغيل | نقرة مزدوجة = لايك (نافذة 350ms لموثوقية iOS)
  const onTap = () => {
    const now = Date.now();
    if (now - tapRef.current.t < 350) {
      clearTimeout(tapRef.current.timer);
      tapRef.current.t = 0;
      doLike();
    } else {
      tapRef.current.t = now;
      tapRef.current.timer = setTimeout(() => { if (muted) onUnmute(); tapRef.current.t = 0; }, 350);
    }
  };

  const share = async (e) => {
    e?.stopPropagation?.();
    const url = `${window.location.origin}/share/product/${p.id}`;
    const data = { title: p.name, text: `${p.name} — ${t('common.currency')}${p.price}`, url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt(t('reels.copyPrompt'), url); }
  };

  const quickAdd = () => {
    if (sizes.length || colors.length) { setPick(true); return; }
    add({ ...p, whatsapp: p.storeWhatsapp, size: '', color: '' });
  };
  const confirmAdd = () => {
    add({ ...p, whatsapp: p.storeWhatsapp, size: selSize, color: selColor });
    setPick(false);
  };
  const canConfirm = (!sizes.length || selSize) && (!colors.length || selColor);

  return (
    <section className="relative flex h-[100dvh] w-full snap-start snap-always justify-center bg-black">
      <div className="relative h-full w-full sm:max-w-[480px]">
        {/* شريط التقدّم */}
        <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/20">
          <div className="h-full bg-white/90 transition-[width] duration-150 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        <video
          ref={vidRef}
          src={cldOptimized(p.videoUrl, 'video')}
          poster={poster}
          muted={muted}
          playsInline
          preload={preload ? 'auto' : 'none'}
          onTimeUpdate={onTimeUpdate}
          onEnded={onVidEnded}
          style={{ touchAction: 'pan-y' }}
          className="h-full w-full object-cover"
        />

        {/* طبقة لمس فوق الفيديو (تحت الأزرار z-10/20): نقرة = كتم، نقرة مزدوجة = لايك.
            تسمح بالتمرير العمودي (pan-y) وتلتقط النقرات بدقة بدل الاعتماد على الفيديو. */}
        <div className="absolute inset-0 z-[5]" style={{ touchAction: 'pan-y' }} onClick={onTap} />

        {/* انفجار قلب الدبل-تاب */}
        {burst > 0 && (
          <div key={burst} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="animate-heart-pop h-28 w-28 fill-white drop-shadow-2xl" aria-hidden="true">
              <path d="M12 21C12 21 4 15 4 8.5A4.5 4.5 0 0 1 12 6 A4.5 4.5 0 0 1 20 8.5C20 15 12 21 12 21Z" />
            </svg>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {hint && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex animate-bounce justify-center text-white/70">
            <span className="rounded-full bg-black/30 px-3 py-1 text-xs backdrop-blur">{t('reels.swipeHint')} ↑</span>
          </div>
        )}

        {copied && (
          <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center">
            <span className="rounded-full bg-black/75 px-4 py-2 text-xs font-semibold text-white backdrop-blur">{t('reels.copied')}</span>
          </div>
        )}

        {/* شارات: خصم + عدد المبيعات */}
        <div className="absolute start-3 z-20 flex flex-col items-start gap-2" style={{ top: 'calc(env(safe-area-inset-top,0px) + 64px)' }}>
          {hasDiscount && <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-extrabold text-white shadow">-{discountPct}%</span>}
          {p.soldCount > 0 && <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{t('product.soldCount', { count: p.soldCount })}</span>}
        </div>

        {/* شريط الإجراءات (مفضّلة + مشاركة) — z-20 فوق المعلومات */}
        <div className="absolute bottom-40 end-3 z-20 flex flex-col items-center gap-4">
          <button type="button" onClick={() => toggle(p)} aria-label="wishlist"
            className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition active:scale-90 ${liked ? 'bg-red-500/90 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}>
            <HeartIcon className="h-6 w-6" filled={liked} />
          </button>
          <button type="button" onClick={share} aria-label="share"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 active:scale-90">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" /></svg>
          </button>
        </div>

        {/* معلومات المنتج + أزرار */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 p-4 pe-16 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-white">
          <Link to={`/store/${p.storeSlug}`} className="inline-flex max-w-fit items-center gap-2 text-sm font-semibold text-white drop-shadow">
            {p.storeLogo ? (
              <img src={cldThumb(p.storeLogo, 80)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/50" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">🏪</span>
            )}
            <span className="truncate">{p.storeName}</span>
          </Link>
          <h2 className="line-clamp-2 text-lg font-bold leading-snug drop-shadow-lg">{p.name}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-black/35 px-2.5 py-1 font-display text-lg font-extrabold text-gold-200 backdrop-blur-sm">{t('common.currency')}{p.price}</span>
            {hasDiscount && <span className="text-sm text-white/70 line-through">{t('common.currency')}{p.oldPrice}</span>}
          </div>
          <div className="mt-1 flex items-stretch gap-2">
            <button onClick={quickAdd}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold text-wine shadow-lg transition active:scale-[0.98]">
              <CartIcon className="h-5 w-5" /> {t('reels.add')}
            </button>
            <Link to={`/product/${p.id}`}
              className="flex items-center justify-center rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold text-white backdrop-blur transition active:scale-95">
              {t('reels.view')}
            </Link>
          </div>
        </div>

        {/* شيت اختيار المقاس/اللون قبل الإضافة */}
        {pick && (
          <div className="absolute inset-0 z-40 flex items-end" onClick={() => setPick(false)}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
            <div className="relative w-full rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-wine" onClick={(e) => e.stopPropagation()}>
              <p className="mb-3 line-clamp-1 font-bold">{p.name}</p>
              {colors.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-medium text-stone-500">{t('reels.color')}</p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <button key={c} onClick={() => setSelColor(c)}
                        className={`rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition ${selColor === c ? 'border-wine bg-wine text-cream' : 'border-wine/30 text-wine hover:bg-wine/10'}`}>{c}</button>
                    ))}
                  </div>
                </div>
              )}
              {sizes.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-medium text-stone-500">{t('reels.size')}</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button key={s} onClick={() => setSelSize(s)}
                        className={`min-w-11 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition ${selSize === s ? 'border-wine bg-wine text-cream' : 'border-wine/30 text-wine hover:bg-wine/10'}`}>{sizeLabel(s, t)}</button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={confirmAdd} disabled={!canConfirm}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-wine py-3 font-bold text-cream transition active:scale-[0.98] disabled:opacity-40">
                <CartIcon className="h-5 w-5" /> {t('reels.add')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MutedIcon() {
  return (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>);
}
function SoundIcon() {
  return (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>);
}

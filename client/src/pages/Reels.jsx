import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import { cldOptimized, cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { HeartIcon } from '../components/icons.jsx';
import CloseButton from '../components/CloseButton.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import Spinner from '../components/Spinner.jsx';

// تصفّح عمودي لفيديوهات المنتجات (Reels) — ملء الشاشة، سحب لفوق للتالي،
// تشغيل تلقائي للفيديو الظاهر فقط (أداء)، وكتم/تشغيل صوت عام بضغطة.
export default function Reels() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();
  const { slug } = useParams(); // مسار /store/:slug/reels → ريلز متجر واحد فقط
  const [items, setItems] = useState(null);
  const [muted, setMuted] = useState(true);
  useScrollLock(true); // تجميد الخلفية + إخفاء الشريط السفلي (immersive)

  useEffect(() => {
    let on = true;
    setItems(null);
    api.get(`/public/reels${slug ? `?store=${encodeURIComponent(slug)}` : ''}`)
      .then((r) => { if (on) setItems(r.data.products || []); })
      .catch(() => { if (on) setItems([]); });
    return () => { on = false; };
  }, [slug]);

  const goBack = () => (slug ? navigate(`/store/${slug}`) : window.history.length > 1 ? navigate(-1) : navigate('/shop'));

  return (
    <div className="fixed inset-0 z-[90] bg-black">
      {/* رأس عائم: رجوع + كتم الصوت */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 10px)' }}>
        <div className="pointer-events-auto">
          <CloseButton onClick={goBack} variant="ghost" size="h-10 w-10" label="back" />
        </div>
        <span className="pointer-events-none select-none font-display text-lg font-bold text-white/90 drop-shadow">🎬 {t('reels.title')}</span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'unmute' : 'mute'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
        >
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
        <div
          className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((p, i) => (
            <ReelSlide key={p.id} p={p} muted={muted} rtl={rtl} t={t} hint={i === 0} onUnmute={() => setMuted(false)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReelSlide({ p, muted, rtl, t, hint, onUnmute }) {
  const { has, toggle } = useWishlist();
  const liked = has(p.id);
  const secRef = useRef(null);
  const vidRef = useRef(null);
  const poster = cldVideoPoster(p.videoUrl) || p.imageUrl || '';

  // شغّل الفيديو فقط عندما يكون ظاهراً (>60%)، وأوقف الباقي → أداء وسلاسة
  useEffect(() => {
    const sec = secRef.current;
    const vid = vidRef.current;
    if (!sec || !vid) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio > 0.6) vid.play().catch(() => {});
        else { vid.pause(); }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(sec);
    return () => io.disconnect();
  }, []);

  // مزامنة حالة الكتم العامة
  useEffect(() => { if (vidRef.current) vidRef.current.muted = muted; }, [muted]);

  const share = async () => {
    const url = `${window.location.origin}/share/product/${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); }
    } catch { /* أُلغيت */ }
  };

  return (
    <section ref={secRef} className="relative flex h-[100dvh] w-full snap-start snap-always justify-center bg-black">
      <div className="relative h-full w-full sm:max-w-[480px]">
        <video
          ref={vidRef}
          src={cldOptimized(p.videoUrl, 'video')}
          poster={poster}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onClick={() => muted && onUnmute()}
          className="h-full w-full object-cover"
        />

        {/* تدرّج سفلي لوضوح النص */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* تلميح السحب (أول فيديو فقط) */}
        {hint && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex animate-bounce justify-center text-white/70">
            <span className="rounded-full bg-black/30 px-3 py-1 text-xs backdrop-blur">{t('reels.swipeHint')} ↑</span>
          </div>
        )}

        {/* شريط الإجراءات الجانبي (المفضّلة + مشاركة) */}
        <div className="absolute bottom-28 end-3 z-10 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => toggle(p)}
            aria-label="wishlist"
            className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition active:scale-90 ${liked ? 'bg-red-500/90 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}
          >
            <HeartIcon className="h-6 w-6" filled={liked} />
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="share"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" /></svg>
          </button>
        </div>

        {/* معلومات المنتج + زر العرض — مرتّبة بمسافات واضحة، ومساحة جانبية للأزرار */}
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
            {p.oldPrice && p.oldPrice > p.price && (
              <span className="text-sm text-white/70 line-through">{t('common.currency')}{p.oldPrice}</span>
            )}
          </div>
          <Link
            to={`/product/${p.id}`}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold text-wine shadow-lg transition active:scale-[0.98]"
          >
            🛍️ {t('reels.view')}
            <span aria-hidden>{rtl ? '‹' : '›'}</span>
          </Link>
        </div>
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

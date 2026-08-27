import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { cldVideoPoster, cldThumb } from '../utils/cloudinary.js';
import { HeartIcon, CartIcon, BagIcon, VideoIcon, SpeakerIcon, StoreIcon } from '../components/icons.jsx';
import { colorToCss } from '../utils/colorDot.js';
import CloseButton from '../components/CloseButton.jsx';
import useScrollLock from '../hooks/useScrollLock.js';
import Spinner from '../components/Spinner.jsx';
import Seo from '../components/Seo.jsx';
import Strike from '../components/Strike.jsx';
import { sizeLabel } from '../utils/sizes.js';
import { getMySize, setMySize } from '../utils/mySize.js';
import { goBack } from '../utils/nav.js';

const MUTE_KEY = 'bz_reels_muted';

// نسخة فيديو أخف للريلز (أبعاد محدودة + جودة موفّرة) → تحميل أسرع بكثير
// ───── محرك فيديو الريلز (أسلوب انستغرام) ─────
// المشكلة المكتشفة: روابط الفيديو المخزّنة تحمل تحويلات قديمة داخلها (f_auto,q_auto…)
// فأي تحويل نضيفه يصير "متسلسلاً" فوقها ويعاد الترميز مرتين ويُلغى ما طلبناه.
// الحل: نفكّك الرابط ونبني تحويلاً نظيفاً واحداً من الصفر.
// - HLS متكيّف (sp_auto): 5 دقات يبدّل بينها المشغّل حسب سرعة النت لحظياً —
//   على شبكة ضعيفة ينزل 360p بدل ما يعلق، وعلى واي فاي 720p واضحة. (مؤكّد
//   حياً أن حساب كلاودينري يدعمه). iOS يشغّله أصلياً، وأندرويد عبر hls.js.
// - احتياط MP4 نظيف (H.264 عتادي 720p) لو فشل HLS لأي سبب.
function cldVideoParts(url) {
  const m = String(url || '').match(/^(https?:\/\/[^/]+\/[^/]+\/video\/upload\/)(.+)$/);
  if (!m) return null;
  const segs = m[2].split('/');
  let vi = segs.findIndex((s) => /^v\d+$/.test(s)); // جزء الإصدار v123... — ما قبله تحويلات قديمة نتجاهلها
  if (vi === -1) vi = segs.length - 1;
  return { base: m[1], rest: segs.slice(vi).join('/').replace(/\.[a-z0-9]+(\?.*)?$/i, '') };
}
// متصفحات التطبيقات الداخلية (فيسبوك/انستغرام/تيك توك…) تتعثر مع HLS — زوار الإعلانات
// الممولة يفتحون منها، فنعطيهم MP4 تقدّمياً مباشرة (الأكثر توافقاً، بلا انحشار).
const IN_APP_BROWSER = typeof navigator !== 'undefined'
  && /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Threads|TikTok|Snapchat|Line\//i.test(navigator.userAgent);
// كان HLS المتكيّف (sp_auto) هو المصدر الأساسي، لكنه على الريلز القصيرة يبدأ بدقة
// منخفضة ولا "يرتقي" قبل انتهاء المقطع (جودة رديئة)، وكلاودينري يولّد نسخه عند أول
// طلب (بطء تحميل). نعطّله ونعتمد MP4 تقدّمياً بجودة كاملة يبدأ العرض فوراً.
// (الدالة تُبقي توقيعها لتفادي تغيير المستدعين.)
const reelHls = () => '';
// MP4 بجودة عالية (1080p) — الريلز قصيرة فلا وقت للبث المتكيّف كي "يرتقي" بالدقة،
// وكانت النتيجة مشاهدة معظم الريل بدقة متدنية. q_auto:good عند 1080 حادّ وواضح.
const reelMp4 = (url) => { const p = cldVideoParts(url); return p ? `${p.base}f_mp4,vc_h264,q_auto:good,w_1080,c_limit/${p.rest}.mp4` : url; };
// سفاري/iOS يشغّل HLS أصلياً (بلا hls.js) — نكشفه مرة واحدة على مستوى الوحدة
const NATIVE_HLS = typeof document !== 'undefined' && !!document.createElement('video').canPlayType('application/vnd.apple.mpegurl');

// ═══════════════════════════════════════════════════════════════════════════
// معمارية «عنصر فيديو واحد» (single-video): بدل عنصر <video> لكل شريحة، يوجد
// مشغّل واحد ثابت (ReelPlayer) لا يُفكَّك أبداً، يُعاد استخدامه للريل النشط بتبديل
// مصدره. بما أن نفس العنصر فُتح بالصوت مرّة (بإيماءة)، يبقى «مفتوحاً» عند iOS —
// فالصوت لا يُكتَم من جديد كل ريل (كان السبب الجذري لقطع الصوت عند التمرير).
// الشرائح صارت خلفيات بوستر خفيفة للتمرير فقط، والمشغّل يطفو فوق الشريحة النشطة.
// ═══════════════════════════════════════════════════════════════════════════
export default function Reels() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [items, setItems] = useState(null);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) !== '0'; } catch { return true; }
  });
  const [active, setActive] = useState(0);
  const [soundHint, setSoundHint] = useState(true);
  const [mySize] = useState(getMySize); // مقاس الزائرة المعتاد — لاختصار فلترة الريلز
  const [sizeOnly, setSizeOnly] = useState(false); // فلتر "مقاسي" مفعّل؟
  const feedRef = useRef(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const videoElRef = useRef(null); // عنصر الفيديو الوحيد — يمسكه الأب ليفتحه داخل إيماءة الزر
  useScrollLock(true);

  // عناصر شرائح البوستر فقط (نستثني طبقة المشغّل الطافية من الحسابات)
  const slideEls = () => (feedRef.current ? Array.from(feedRef.current.querySelectorAll('[data-reel-slide]')) : []);

  const setMutedPersist = (v) => {
    setMuted((m) => {
      const next = typeof v === 'function' ? v(m) : v;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* تجاهل */ }
      return next;
    });
  };

  const reelsUrl = (off) => `/public/reels?offset=${off}${slug ? `&store=${encodeURIComponent(slug)}` : ''}${sizeOnly && mySize ? `&size=${encodeURIComponent(mySize)}` : ''}`;

  // نتذكّر آخر ريل وصلته الزائرة (لكل متجر على حدة) — الخروج والرجوع يكمل من مكانها.
  const posKey = `bz_reels_pos:${slug || 'all'}`;
  const initialPosRef = useRef(null);
  if (initialPosRef.current === null) {
    try { initialPosRef.current = parseInt(sessionStorage.getItem(posKey) || '0', 10) || 0; } catch { initialPosRef.current = 0; }
  }
  useEffect(() => {
    try { sessionStorage.setItem(posKey, String(active)); } catch { /* تجاهل */ }
  }, [active, posKey]);
  useEffect(() => {
    if (!items || items.length === 0) return;
    const saved = initialPosRef.current;
    initialPosRef.current = 0; // تُستهلك مرة واحدة
    const feed = feedRef.current;
    const els = slideEls();
    if (saved > 0 && saved < items.length && feed && els[saved]) {
      feed.scrollTop = saved * feed.clientHeight; // قفزة فورية (snap) بلا حركة
      setActive(saved);
    }
    // عند أول تحميل للقائمة فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items === null]);

  useEffect(() => {
    let on = true;
    setItems(null);
    offsetRef.current = 0; hasMoreRef.current = true; loadingRef.current = false;
    setActive(0); // فلتر جديد يبدأ من أول ريل
    api.get(reelsUrl(0))
      .then((r) => {
        if (!on) return;
        const list = r.data.products || [];
        setItems(list);
        offsetRef.current = list.length;
        hasMoreRef.current = !!r.data.hasMore;
      })
      .catch(() => { if (on) setItems([]); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sizeOnly]);

  const loadMore = () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    api.get(reelsUrl(offsetRef.current))
      .then((r) => {
        const list = r.data.products || [];
        setItems((prev) => [...(prev || []), ...list]);
        offsetRef.current += list.length;
        hasMoreRef.current = !!r.data.hasMore;
      })
      .catch(() => {})
      .finally(() => { loadingRef.current = false; });
  };

  // تتبّع الشريحة الفعّالة + تحميل المزيد قرب النهاية
  useEffect(() => {
    const root = feedRef.current;
    if (!root || !items || items.length === 0) return undefined;
    const slides = slideEls();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = slides.indexOf(e.target);
            if (idx >= 0) {
              setActive(idx);
              if (idx >= items.length - 3) loadMore();
            }
          }
        });
      },
      { root, threshold: [0.6] }
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // إخفاء تلميح الصوت تلقائياً، وفور تشغيل الصوت
  useEffect(() => { if (!muted) setSoundHint(false); }, [muted]);
  useEffect(() => { const id = setTimeout(() => setSoundHint(false), 4200); return () => clearTimeout(id); }, []);

  const goNext = (i) => {
    const els = slideEls();
    if (els[i + 1]) els[i + 1].scrollIntoView({ behavior: 'smooth' });
  };
  // يرجع للصفحة السابقة الفعلية (متجر/رئيسية/فئة...) بدل فرض صفحة المتجر
  const goBackFn = () => goBack(navigate, slug ? `/store/${slug}` : '/shop');

  return (
    <>
    {/* الصفحة الوحيدة التي كانت بلا وسوم بحث — فتُفهرَس بعنوان index.html */}
    <Seo title={t('reels.title')} description={t('reels.seoDesc')} />
    <div
      className="fixed inset-0 z-[90] select-none bg-black"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
        <div className="pointer-events-auto"><CloseButton onClick={goBackFn} variant="ghost" size="h-10 w-10" label="back" /></div>
        <span className="pointer-events-none inline-flex select-none items-center gap-2 font-display text-lg font-bold text-white/90 drop-shadow"><VideoIcon className="h-5 w-5" /> {t('reels.title')}</span>
        {/* تشغيل/كتم الصوت: نطبّق التغيير على العنصر مباشرةً داخل الإيماءة (قبل setState)
            — تأجيله لتأثير React يُخرجه من نافذة التفعيل فيرفضه iOS ويعيد الكتم. */}
        <button type="button"
          onClick={() => {
            const v = videoElRef.current;
            const next = !muted;
            if (v) {
              v.muted = next;
              if (!next) v.play().catch(() => {}); // فتح العنصر للصوت داخل الإيماءة
            }
            setMutedPersist(next);
          }}
          aria-label={muted ? 'unmute' : 'mute'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 transition hover:bg-black/65">
          {muted ? <MutedIcon /> : <SoundIcon />}
        </button>
      </div>

      {/* فلتر «مقاسي» — يظهر فقط إن كان للزائرة مقاس معتاد */}
      {mySize && items && (
        <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ top: 'calc(env(safe-area-inset-top,0px) + 54px)' }}>
          <button
            type="button"
            onClick={() => setSizeOnly((v) => !v)}
            aria-pressed={sizeOnly}
            className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 backdrop-blur-sm transition active:scale-95 ${
              sizeOnly ? 'bg-[#cdbda4] text-[#3f2e22] ring-[#cdbda4]' : 'bg-black/50 text-white ring-white/20 hover:bg-black/65'
            }`}
          >
            <RulerGlyph className="h-3.5 w-3.5" />
            {t('filters.mySize', { size: sizeLabel(mySize, t) })}
          </button>
        </div>
      )}

      {/* تلميح الصوت */}
      {items && items.length > 0 && soundHint && muted && (
        <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ top: `calc(env(safe-area-inset-top,0px) + ${mySize ? 98 : 60}px)` }}>
          <span className="inline-flex animate-toast-top items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white"><SpeakerIcon className="h-4 w-4" /> {t('reels.soundHint')}</span>
        </div>
      )}

      {items === null ? (
        <div className="flex h-full items-center justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white/80">
          <VideoIcon className="h-14 w-14 text-white/50" />
          <p className="text-lg font-semibold">{sizeOnly ? t('reels.noSizeMatch', { size: sizeLabel(mySize, t) }) : t('reels.empty')}</p>
          {sizeOnly ? (
            <button onClick={() => setSizeOnly(false)} className="rounded-full bg-[#cdbda4] px-5 py-2 text-sm font-bold text-[#3f2e22] transition hover:brightness-105">{t('filters.clear')}</button>
          ) : (
            <button onClick={goBackFn} className="rounded-full bg-white/15 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">{t('reels.back')}</button>
          )}
        </div>
      ) : (
        <>
          <div ref={feedRef}
            className="relative h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
            {items.map((p, i) => (
              <PosterSlide key={`${p.id}-${i}`} p={p} />
            ))}

            {/* المشغّل الواحد الثابت — يطفو فوق الشريحة النشطة (يتحرّك بمقدار active شريحة) */}
            {items[active] && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-[2] mx-auto h-[100dvh] w-full sm:max-w-[480px]"
                style={{ transform: `translateY(${active * 100}dvh)` }}
              >
                <div className="pointer-events-auto h-full w-full">
                  <ReelPlayer
                    product={items[active]}
                    muted={muted}
                    t={t}
                    videoRef={videoElRef}
                    onUnmute={() => setMutedPersist(false)}
                    onEnded={() => goNext(active)}
                    isLast={active === items.length - 1}
                    showHint={active === 0}
                  />
                </div>
              </div>
            )}
          </div>

          {/* تسخين الريلين التاليين: عناصر مخفية تحمّل مصادرها مسبقاً فيبدأ الريل فوراً
              عند الوصول إليه بلا عجلة تحميل (لا تُشغَّل ولا تصدر صوتاً — المشغّل الوحيد
              أعلاه هو من يعرض). هذا ما يعطي إحساس الانتقال الفوري بالتطبيقات العالمية. */}
          {[1, 2].map((d) => items[active + d] && (
            <video
              key={items[active + d].id}
              src={reelMp4(items[active + d].videoUrl)}
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none absolute h-px w-px opacity-0"
            />
          ))}

          {/* مؤشّر موضع عمودي — مقبض ذهبي يتحرّك على مسار حسب الريل الحالي */}
          {items.length > 1 && (
            <div className="pointer-events-none absolute start-2 top-1/2 z-30 h-32 w-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
              <div
                className="absolute inset-x-0 h-6 rounded-full bg-gradient-to-b from-[#cdbda4] to-white/90 transition-[top] duration-300 ease-out"
                style={{ top: `${(active / Math.max(1, items.length - 1)) * (128 - 24)}px` }}
              />
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

// شريحة خلفية خفيفة (بوستر فقط) — تحدّد ارتفاع التمرير وتُظهر معاينة المنتج أثناء
// الانزلاق. الفيديو والواجهة التفاعلية يوفّرهما المشغّل الواحد الطافي فوق النشطة.
function PosterSlide({ p }) {
  const poster = cldVideoPoster(p.videoUrl) || p.imageUrl || '';
  return (
    <section data-reel-slide className="relative flex h-[100dvh] w-full snap-start snap-always justify-center bg-black">
      <div className="relative h-full w-full sm:max-w-[480px]">
        <img src={cldThumb(poster, 720)} alt={p.name} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      </div>
    </section>
  );
}

// المشغّل الواحد الثابت: يحمل عنصر الفيديو الوحيد وكل منطق التشغيل (HLS/الصوت/الحراسة)
// والواجهة التفاعلية للريل النشط. يبقى مركّباً عبر تغيّر الريلز (يتغيّر product فقط).
function ReelPlayer({ product: p, muted, t, onUnmute, onEnded, isLast, showHint, videoRef }) {
  const { add, buyNow } = useCart();
  const { has, toggle } = useWishlist();
  const liked = has(p.id);
  const [copied, setCopied] = useState(false);
  const [descOpen, setDescOpen] = useState(false); // توسيع وصف المنتج
  const [wishMsg, setWishMsg] = useState(''); // توست إضافة/إزالة المفضّلة
  const progressRef = useRef(null); // شريط التقدّم يُحدَّث بالـDOM مباشرة (بلا re-render كل timeupdate)
  const [burst, setBurst] = useState(0);
  // عجلة التحميل تظهر فقط إن طال الانتظار فعلاً (لا عند كل تلعثم لحظي) — البوستر خلف
  // الفيديو يغطّي الأجزاء القصيرة، فالانتقال يبدو فورياً كالتطبيقات العالمية.
  const [buffering, setBuffering] = useState(false);
  const bufTimerRef = useRef(null);
  const showBuffering = () => {
    if (bufTimerRef.current) return;
    bufTimerRef.current = setTimeout(() => { bufTimerRef.current = null; setBuffering(true); }, 700);
  };
  const hideBuffering = () => {
    if (bufTimerRef.current) { clearTimeout(bufTimerRef.current); bufTimerRef.current = null; }
    setBuffering(false);
  };
  useEffect(() => () => { if (bufTimerRef.current) clearTimeout(bufTimerRef.current); }, []);
  const [errored, setErrored] = useState(false);
  const [pick, setPick] = useState(false);
  const [pickMode, setPickMode] = useState('add'); // 'add' | 'buy'
  const [selSize, setSelSize] = useState('');
  const [selColor, setSelColor] = useState('');
  const [mySize] = useState(getMySize);
  const vidRef = videoRef; // مرجع مرفوع من الأب — كي يفتحه زر الصوت داخل الإيماءة
  const hlsRef = useRef(null); // مشغّل hls.js (أندرويد/كروم) — iOS يشغّل HLS أصلياً
  const [useMp4, setUseMp4] = useState(false); // فشل HLS؟ → احتياط MP4 نظيف
  const tapRef = useRef({ t: 0 });
  // كتم مؤقّت لهذا الريل عند رفض iOS التشغيل بالصوت — يرجع بأول إيماءة تالية.
  const forcedMuteRef = useRef(false);
  const soundRestoreRef = useRef(null); // مستمِع إيماءة عام لإعادة الصوت بعد كتم مؤقّت
  const holdRef = useRef({ timer: null, held: false, x: 0, y: 0, moved: false, swallow: false });
  const poster = cldVideoPoster(p.videoUrl) || p.imageUrl || '';

  // ── استعادة الصوت بعد كتم مؤقّت ─────────────────────────────────────────────
  const restoreSoundIfForced = () => {
    const v = vidRef.current;
    if (v && forcedMuteRef.current && !muted) {
      forcedMuteRef.current = false;
      v.muted = false;
      v.play().catch(() => {});
    }
  };
  // أول إيماءة تالية في أي مكان (بما فيها استمرار التمرير) تُعيد الصوت تلقائياً.
  const armGlobalSoundRestore = () => {
    if (soundRestoreRef.current) return;
    const restore = () => {
      window.removeEventListener('pointerdown', restore, true);
      window.removeEventListener('touchstart', restore, true);
      soundRestoreRef.current = null;
      restoreSoundIfForced();
    };
    soundRestoreRef.current = restore;
    window.addEventListener('pointerdown', restore, { capture: true, passive: true });
    window.addEventListener('touchstart', restore, { capture: true, passive: true });
  };
  const disarmGlobalSoundRestore = () => {
    if (soundRestoreRef.current) {
      window.removeEventListener('pointerdown', soundRestoreRef.current, true);
      window.removeEventListener('touchstart', soundRestoreRef.current, true);
      soundRestoreRef.current = null;
    }
  };
  useEffect(() => disarmGlobalSoundRestore, []); // تنظيف عند التفكيك

  // ── فتح العنصر للصوت (iOS unlock) — جوهر إصلاح «كل ريل لازم كبسة» ───────────
  // سياسة WebKit: كل عنصر <video> يبقى «مقفلاً» للصوت حتى ينجح play() مرّة واحدة
  // داخل إيماءة مستخدم. بما أن المشغّل هنا عنصر واحد لا يُفكَّك، يكفي فتحه مرّة
  // فيبقى مفتوحاً لكل الريلز التالية مهما تبدّل المصدر. نفتحه استباقياً بأول إيماءة
  // في أي مكان (لمسة/سحبة) بدل انتظار فشل التشغيل ثم الكتم.
  const unlockedRef = useRef(false);
  useEffect(() => {
    if (unlockedRef.current) return undefined;
    const onGesture = () => {
      const v = vidRef.current;
      if (!v || unlockedRef.current) return;
      if (!muted) v.muted = false; // الفتح يتم بمحاولة تشغيل بالصوت داخل الإيماءة
      v.play().then(() => { unlockedRef.current = true; }).catch(() => { /* نعيد المحاولة بالإيماءة التالية */ });
    };
    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('touchstart', onGesture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // ── ريل جديد: صفّر الحالة المتعلّقة به ───────────────────────────────────────
  useEffect(() => {
    setUseMp4(false); setErrored(false); setSelSize(''); setSelColor(''); setDescOpen(false); setPick(false);
    hideBuffering(); // لا نورّث عجلة الريل السابق
    disarmGlobalSoundRestore();
    const v = vidRef.current;
    if (v) { try { v.currentTime = 0; } catch { /* تجاهل */ } }
    if (progressRef.current) progressRef.current.style.width = '0%';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  // ── تعليق مصدر الفيديو للريل النشط: HLS متكيّف أولاً، وعند فشل قاتل → MP4 نظيف ─
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return undefined;
    const hlsUrl = reelHls(p.videoUrl);
    const mp4Url = reelMp4(p.videoUrl);
    // iOS/سفاري: HLS أصلي (بلا hls.js)
    if (NATIVE_HLS) {
      const src = (!hlsUrl || useMp4) ? mp4Url : hlsUrl;
      if (vid.getAttribute('src') !== src) { vid.src = src; try { vid.load(); } catch { /* تجاهل */ } }
      return undefined;
    }
    // أندرويد/كروم عبر hls.js
    if (!hlsUrl || useMp4) { vid.src = mp4Url; return undefined; }
    let hls; let cancelled = false;
    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { vid.src = mp4Url; return; }
        hls = new Hls({ maxBufferLength: 30, autoStartLoad: false, startLevel: -1, abrEwmaDefaultEstimate: 5000000 });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data && data.fatal) { try { hls.destroy(); } catch { /* تجاهل */ } hlsRef.current = null; setUseMp4(true); }
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(vid);
        hls.startLoad(-1);
      })
      .catch(() => { if (!cancelled) vid.src = mp4Url; });
    return () => {
      cancelled = true;
      if (hls) { try { hls.destroy(); } catch { /* تجاهل */ } if (hlsRef.current === hls) hlsRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, useMp4]);

  // ── تشغيل الريل النشط: محاولة فورية + إعادات تلتقط تفعيل الإيماءة لاستعادة الصوت ─
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return undefined;
    if (hlsRef.current) { try { hlsRef.current.startLoad(-1); } catch { /* تجاهل */ } }
    if (!muted && forcedMuteRef.current) { forcedMuteRef.current = false; vid.muted = false; }
    let alive = true;
    let blockedTries = 0;
    const tryPlay = () => {
      if (!alive || vid.ended || !vid.paused || holdRef.current.held || document.hidden) return;
      vid.play().catch((err) => {
        if (!alive || !err || err.name !== 'NotAllowedError' || vid.muted) return;
        blockedTries += 1;
        if (blockedTries >= 4) {
          forcedMuteRef.current = true;
          vid.muted = true;
          vid.play().catch(() => {});
          armGlobalSoundRestore();
        }
      });
    };
    tryPlay();
    vid.addEventListener('loadeddata', tryPlay);
    vid.addEventListener('canplay', tryPlay);
    const quick = [130, 300, 520].map((ms) => setTimeout(tryPlay, ms));
    const iv = setInterval(tryPlay, 800);
    return () => {
      alive = false;
      clearInterval(iv);
      quick.forEach(clearTimeout);
      vid.removeEventListener('loadeddata', tryPlay);
      vid.removeEventListener('canplay', tryPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  // ── تغيّر تفضيل الكتم صراحةً ──────────────────────────────────────────────────
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return;
    forcedMuteRef.current = false;
    vid.muted = muted;
    if (!muted) ensurePlaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // ── حارس الانحشار: لو توقّف تقدّم الوقت ~6ث نعيد التحميل من نفس الموضع ──────────
  const stuckRef = useRef({ t: -1, count: 0 });
  useEffect(() => {
    stuckRef.current = { t: -1, count: 0 };
    const id = setInterval(() => {
      const v = vidRef.current;
      if (!v || v.paused || v.ended || holdRef.current.held || document.hidden) return;
      if (v.currentTime === stuckRef.current.t) {
        stuckRef.current.count += 1;
        if (stuckRef.current.count >= 2) {
          stuckRef.current.count = 0;
          const pos = v.currentTime;
          try {
            if (hlsRef.current) {
              hlsRef.current.startLoad(pos);
              v.play().catch(() => {});
            } else {
              v.load();
              const seek = () => { try { v.currentTime = pos; } catch { /* تجاهل */ } v.play().catch(() => {}); };
              v.addEventListener('loadedmetadata', seek, { once: true });
            }
          } catch { /* تجاهل */ }
        }
      } else {
        stuckRef.current.t = v.currentTime;
        stuckRef.current.count = 0;
      }
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  // ── إيقاف عند إخفاء التطبيق، وإفراغ المصدر عند مغادرة الريلز ─────────────────
  useEffect(() => {
    const onVis = () => {
      const v = vidRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else if (!holdRef.current.held) v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      const v = vidRef.current;
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* تجاهل */ } }
    };
  }, []);

  const onTimeUpdate = () => {
    const v = vidRef.current;
    if (v && v.duration && progressRef.current) progressRef.current.style.width = `${(v.currentTime / v.duration) * 100}%`;
  };
  const ensurePlaying = () => {
    const v = vidRef.current;
    if (v && !holdRef.current.held && !document.hidden && v.paused && !v.ended) {
      v.play().catch((err) => {
        if (err && err.name === 'NotAllowedError' && !v.muted) {
          forcedMuteRef.current = true;
          v.muted = true;
          v.play().catch(() => {});
          armGlobalSoundRestore();
        }
      });
    }
  };
  const onVidEnded = () => {
    if (isLast) { const v = vidRef.current; if (v) { v.currentTime = 0; v.play().catch(() => {}); } }
    else onEnded();
  };

  const doLike = () => {
    if (!liked) toggle(p);
    setBurst((b) => b + 1);
    if (navigator.vibrate) navigator.vibrate(18);
  };

  // نقرة = إزالة كتم (+استئناف) | نقرة مزدوجة = لايك
  const onTap = () => {
    const v = vidRef.current;
    if (v && v.paused && !v.ended) v.play().catch(() => {});
    const now = Date.now();
    if (now - tapRef.current.t < 350) {
      tapRef.current.t = 0;
      doLike();
    } else {
      tapRef.current.t = now;
      if (muted) { if (v) v.muted = false; onUnmute(); }
    }
  };

  // ضغط مطوّل = إيقاف مؤقّت (يُلغى إن صار تمرير)
  const onDown = (e) => {
    const v = vidRef.current;
    if (v && v.paused && !v.ended) v.play().catch(() => {});
    restoreSoundIfForced();
    holdRef.current = { ...holdRef.current, held: false, moved: false, x: e.clientX || 0, y: e.clientY || 0 };
    holdRef.current.timer = setTimeout(() => {
      if (!holdRef.current.moved) { holdRef.current.held = true; vidRef.current?.pause(); }
    }, 350);
  };
  const onMove = (e) => {
    if (Math.abs((e.clientX || 0) - holdRef.current.x) > 10 || Math.abs((e.clientY || 0) - holdRef.current.y) > 10) {
      holdRef.current.moved = true;
      clearTimeout(holdRef.current.timer);
    }
  };
  const endHold = (resume) => {
    clearTimeout(holdRef.current.timer);
    if (holdRef.current.held) {
      holdRef.current.swallow = true;
      holdRef.current.held = false;
      if (resume) ensurePlaying();
    }
  };
  const onUp = () => endHold(true);
  const onCancel = () => endHold(true);
  const onLayerClick = () => {
    if (holdRef.current.swallow) { holdRef.current.swallow = false; return; }
    onTap();
  };

  const share = async (e) => {
    e?.stopPropagation?.();
    const url = `${window.location.origin}/share/product/${p.id}`;
    const data = { title: p.name, url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt(t('reels.copyPrompt'), url); }
  };

  // المتغيّرات بوعي مخزون الألوان (النموذج الجديد)
  const colorStock = p.colorStock && typeof p.colorStock === 'object' ? p.colorStock : {};
  const hasCS = Object.keys(colorStock).length > 0;
  const sizeStock = p.sizeStock && typeof p.sizeStock === 'object' ? p.sizeStock : {};
  const sizes = hasCS
    ? (selColor ? Object.entries(colorStock[selColor] || {}).filter(([, q]) => q !== 0).map(([s]) => s) : [])
    : (p.size || '').split(',').map((s) => s.trim()).filter(Boolean).filter((s) => sizeStock[s] !== 0);
  const colors = hasCS ? Object.keys(colorStock) : (p.color || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hasDiscount = p.oldPrice && p.oldPrice > p.price;
  const discountPct = hasDiscount ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const detailedQty = hasCS
    ? Object.values(colorStock).flatMap((sz) => Object.values(sz || {})).filter((q) => typeof q === 'number')
    : Object.values(sizeStock).filter((q) => typeof q === 'number');
  const soldOut = p.stock === 0 || (detailedQty.length > 0 && detailedQty.reduce((a, b) => a + b, 0) === 0);

  const quickAdd = () => {
    if (sizes.length || colors.length) { setPickMode('add'); setPick(true); return; }
    add({ ...p, whatsapp: p.storeWhatsapp, size: '', color: '' });
  };
  const quickBuy = () => {
    if (sizes.length || colors.length) { setPickMode('buy'); setPick(true); return; }
    buyNow({ ...p, whatsapp: p.storeWhatsapp, size: '', color: '' });
  };
  const confirmAdd = () => {
    const doIt = pickMode === 'buy' ? buyNow : add;
    doIt({ ...p, whatsapp: p.storeWhatsapp, size: selSize, color: selColor });
    setPick(false);
  };
  const canConfirm = (!colors.length || selColor) && (!sizes.length || selSize) && !(hasCS && selColor && sizes.length === 0);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* شريط التقدّم — يُحدَّث بالـDOM مباشرة */}
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/20">
        <div ref={progressRef} className="h-full bg-white/90 transition-[width] duration-150 ease-linear" style={{ width: '0%' }} />
      </div>

      {/* بوستر خلف الفيديو دائماً → لا سواد عند تبديل الريل */}
      <img src={cldThumb(poster, 720)} alt={p.name} className="absolute inset-0 z-0 h-full w-full object-cover" />
      {!errored && (
        <video
          ref={vidRef}
          poster={poster}
          muted={muted}
          playsInline
          preload="auto"
          onTimeUpdate={onTimeUpdate}
          onEnded={onVidEnded}
          onPause={ensurePlaying}
          onWaiting={showBuffering}
          onPlaying={hideBuffering}
          onCanPlay={() => { hideBuffering(); ensurePlaying(); }}
          onError={() => { if (!useMp4) setUseMp4(true); else setErrored(true); }}
          style={{ touchAction: 'pan-y' }}
          className="absolute inset-0 z-[1] h-full w-full object-cover"
        />
      )}

      {/* مؤشّر تحميل الفيديو */}
      {buffering && !errored && (
        <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
        </div>
      )}

      {/* طبقة لمس: نقرة=كتم، مزدوجة=لايك، ضغط مطوّل=إيقاف (تسمح بالتمرير) */}
      <div
        className="absolute inset-0 z-[5]"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onClick={onLayerClick}
      />

      {/* انفجار القلب الأحمر (دبل-تاب) */}
      {burst > 0 && (
        <div key={burst} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="animate-heart-pop h-28 w-28 drop-shadow-2xl" style={{ fill: '#ff2d55' }} aria-hidden="true">
            <path d="M12 21C12 21 4 15 4 8.5A4.5 4.5 0 0 1 12 6 A4.5 4.5 0 0 1 20 8.5C20 15 12 21 12 21Z" />
          </svg>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {showHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-56 flex animate-bounce flex-col items-center gap-1 text-white/80">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm ring-1 ring-white/15">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
            {t('reels.swipeHint')}
          </span>
        </div>
      )}

      {copied && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center">
          <span className="rounded-full bg-black/75 px-4 py-2 text-xs font-semibold text-white">{t('reels.copied')}</span>
        </div>
      )}

      {/* توست المفضّلة */}
      {wishMsg && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center">
          <span className="animate-toast-top rounded-full bg-black/75 px-4 py-2 text-xs font-semibold text-white">{wishMsg}</span>
        </div>
      )}

      {/* شارة الخصم */}
      {hasDiscount && (
        <div className="absolute start-3 z-20 flex flex-col items-start gap-2" style={{ top: 'calc(env(safe-area-inset-top,0px) + 64px)' }}>
          <span className="rounded-full bg-[#8a2438] px-2.5 py-1 text-xs font-extrabold text-[#F4EDE2] shadow">-{discountPct}%</span>
        </div>
      )}

      {/* مفضّلة + مشاركة */}
      <div className="absolute bottom-40 end-3 z-20 flex flex-col items-center gap-4">
        <button type="button"
          onClick={() => {
            const willSave = !liked;
            if (willSave && navigator.vibrate) navigator.vibrate(18);
            toggle(p);
            setWishMsg(willSave ? t('reels.saved') : t('reels.removed'));
            setTimeout(() => setWishMsg(''), 1600);
          }}
          aria-label="wishlist"
          className={`flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-white/20 transition active:scale-90 ${liked ? 'bg-red-500/90 text-white' : 'bg-black/50 text-white hover:bg-black/65'}`}>
          <HeartIcon className={`h-6 w-6 transition-transform ${liked ? 'scale-110' : ''}`} filled={liked} />
        </button>
        <button type="button" onClick={share} aria-label="share"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 transition hover:bg-black/65 active:scale-90">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" /></svg>
        </button>
      </div>

      {/* معلومات المنتج + أزرار */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 pe-16 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-white">
        <Link to={`/store/${p.storeSlug}`} className="inline-flex max-w-fit items-center gap-2 text-sm font-semibold text-white drop-shadow">
          {p.storeLogo ? (
            <img src={cldThumb(p.storeLogo, 80)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-[#cdbda4]/70" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white"><StoreIcon className="h-4 w-4" /></span>
          )}
          <span className="truncate">{p.storeName}</span>
        </Link>
        <h2 className="line-clamp-2 font-display text-lg font-bold leading-snug drop-shadow-lg">{p.name}</h2>
        {p.description && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDescOpen((o) => !o); }}
            className="max-w-full text-start"
          >
            <span className={`block text-xs leading-relaxed text-white/80 drop-shadow ${descOpen ? '' : 'line-clamp-1'}`}>{p.description}</span>
            {p.description.length > 55 && (
              <span className="text-[11px] font-bold text-gold-200 drop-shadow">{descOpen ? t('reels.less') : `… ${t('reels.more')}`}</span>
            )}
          </button>
        )}
        <div className="flex items-baseline gap-2">
          <span className="rounded-full bg-black/60 px-3 py-1 text-lg font-extrabold text-white ring-1 ring-[#cdbda4]/30">{t('common.currency')}{p.price}</span>
          {hasDiscount && <Strike className="bz-oldprice-light text-base">{t('common.currency')}{p.oldPrice}</Strike>}
          {hasDiscount && <span className="rounded-full bg-emerald-600/85 px-2 py-0.5 text-[11px] font-bold text-white drop-shadow">{t('product.saveAmount', { amount: `${t('common.currency')}${(p.oldPrice - p.price).toFixed(2).replace(/\.00$/, '')}` })}</span>}
        </div>
        <div className="mt-1 flex items-stretch gap-2">
          <button onClick={quickBuy} disabled={soldOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-wine shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100">
            <BagIcon className="h-5 w-5" /> {soldOut ? t('product.outOfStock') : t('product.buyNow')}
          </button>
          <button onClick={quickAdd} disabled={soldOut} aria-label={t('reels.add')} title={t('reels.add')}
            className="flex w-12 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/25 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100">
            <CartIcon className="h-5 w-5" />
          </button>
          <Link to={`/product/${p.id}${selColor ? `?color=${encodeURIComponent(selColor)}` : ''}`}
            className="flex items-center justify-center rounded-full bg-white/20 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/25 transition active:scale-95">
            {t('reels.view')}
          </Link>
        </div>
      </div>

      {/* شيت اختيار المقاس/اللون */}
      {pick && (
        <div className="absolute inset-0 z-40 flex items-end" onClick={() => setPick(false)}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
          <div className="relative w-full rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-wine" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 line-clamp-1 font-bold">{p.name}</p>
            {colors.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-medium text-stone-500">{t('reels.color')}</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => {
                    const css = colorToCss(c);
                    return (
                      <button key={c} onClick={() => { setSelColor(selColor === c ? '' : c); if (hasCS) setSelSize(''); }}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${selColor === c ? 'border-wine bg-wine text-cream' : 'border-wine/30 text-wine hover:bg-wine/10'}`}>
                        {css && <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: css, boxShadow: '0 0 0 1px rgba(255,255,255,0.55), inset 0 0 0 1px rgba(0,0,0,0.15)' }} />}
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {hasCS && !selColor ? (
              <p className="mb-4 rounded-xl bg-wine/5 px-3 py-2 text-sm font-medium text-wine/70">{t('product.pickColorFirst')}</p>
            ) : sizes.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-medium text-stone-500">{t('reels.size')}</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const q = hasCS ? colorStock[selColor]?.[s] : sizeStock[s];
                    const on = selSize === s;
                    return (
                      <button key={s} onClick={() => { setSelSize(s); setMySize(s); }}
                        title={!on && mySize === s ? t('product.mySize') : undefined}
                        className={`flex min-w-11 flex-col items-center rounded-xl border px-3.5 py-1.5 transition ${on ? 'border-wine bg-wine text-cream' : 'border-wine/30 text-wine hover:bg-wine/10'} ${!on && mySize === s ? 'ring-2 ring-gold-400/70 ring-offset-1' : ''}`}>
                        <span className="text-sm font-semibold leading-none">{sizeLabel(s, t)}</span>
                        {typeof q === 'number' && <span className={`mt-1 text-[10px] font-medium leading-none ${on ? 'text-cream/80' : 'text-wine/55'}`}>{t('product.leftShort', { count: q })}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button onClick={confirmAdd} disabled={!canConfirm}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-wine py-3 font-bold text-cream transition active:scale-[0.98] disabled:opacity-40">
              {pickMode === 'buy' ? <BagIcon className="h-5 w-5" /> : <CartIcon className="h-5 w-5" />}
              {pickMode === 'buy' ? t('product.buyNow') : t('reels.add')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// أيقونة مسطرة (فلتر المقاس)
function RulerGlyph({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5 8.5 3 21 15.5 15.5 21 3 8.5Z" /><path d="M7 9.5 8.5 11M10 6.5 12 8.5M13 3.5 14.5 5" />
    </svg>
  );
}

function MutedIcon() {
  return (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>);
}
function SoundIcon() {
  return (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>);
}

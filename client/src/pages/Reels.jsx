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
const reelHls = (url) => { if (IN_APP_BROWSER) return ''; const p = cldVideoParts(url); return p ? `${p.base}sp_auto/${p.rest}.m3u8` : ''; };
// MP4 بجودة عالية (1080p) — الريلز قصيرة فلا وقت للبث المتكيّف كي "يرتقي" بالدقة،
// وكانت النتيجة مشاهدة معظم الريل بدقة متدنية. q_auto:good عند 1080 حادّ وواضح.
const reelMp4 = (url) => { const p = cldVideoParts(url); return p ? `${p.base}f_mp4,vc_h264,q_auto:good,w_1080,c_limit/${p.rest}.mp4` : url; };
// سفاري/iOS يشغّل HLS أصلياً (بلا hls.js) — نكشفه مرة واحدة على مستوى الوحدة
const NATIVE_HLS = typeof document !== 'undefined' && !!document.createElement('video').canPlayType('application/vnd.apple.mpegurl');

// تصفّح عمودي لفيديوهات المنتجات (Reels) — ملء الشاشة، تشغيل تلقائي للظاهر فقط،
// تحميل مسبق + تحميل المزيد، شريط تقدّم/انتقال تلقائي، ضغط مطوّل للإيقاف،
// دبل-تاب لايك (قلب أحمر) مع اهتزاز، تلميح صوت، ومؤشّر تحميل + حماية من فشل الفيديو.
export default function Reels() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();
  const { slug } = useParams();
  const [items, setItems] = useState(null);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) !== '0'; } catch { return true; }
  });
  const [active, setActive] = useState(0);
  const [soundHint, setSoundHint] = useState(true);
  const feedRef = useRef(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  useScrollLock(true);

  const setMutedPersist = (v) => {
    setMuted((m) => {
      const next = typeof v === 'function' ? v(m) : v;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* تجاهل */ }
      return next;
    });
  };

  const reelsUrl = (off) => `/public/reels?offset=${off}${slug ? `&store=${encodeURIComponent(slug)}` : ''}`;

  // نتذكّر آخر ريل وصلته الزائرة (لكل متجر على حدة) — الخروج والرجوع يكمل من مكانها.
  // نقرأ الموضع المحفوظ وقت أول render (قبل أي تأثير) كي لا يدهسه تأثير الحفظ بـ0
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
    if (saved > 0 && saved < items.length && feed && feed.children[saved]) {
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
  }, [slug]);

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
    const slides = Array.from(root.children);
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
  }, [items]);

  // إخفاء تلميح الصوت تلقائياً، وفور تشغيل الصوت
  useEffect(() => { if (!muted) setSoundHint(false); }, [muted]);
  useEffect(() => { const id = setTimeout(() => setSoundHint(false), 4200); return () => clearTimeout(id); }, []);

  const goNext = (i) => {
    const root = feedRef.current;
    if (root && root.children[i + 1]) root.children[i + 1].scrollIntoView({ behavior: 'smooth' });
  };
  // يرجع للصفحة السابقة الفعلية (متجر/رئيسية/فئة...) بدل فرض صفحة المتجر
  const goBackFn = () => goBack(navigate, slug ? `/store/${slug}` : '/shop');

  return (
    <div
      className="fixed inset-0 z-[90] select-none bg-black"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
        <div className="pointer-events-auto"><CloseButton onClick={goBackFn} variant="ghost" size="h-10 w-10" label="back" /></div>
        <span className="pointer-events-none inline-flex select-none items-center gap-2 font-display text-lg font-bold text-white/90 drop-shadow"><VideoIcon className="h-5 w-5" /> {t('reels.title')}</span>
        <button type="button" onClick={() => setMutedPersist((m) => !m)} aria-label={muted ? 'unmute' : 'mute'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 transition hover:bg-black/65">
          {muted ? <MutedIcon /> : <SoundIcon />}
        </button>
      </div>

      {/* تلميح الصوت */}
      {items && items.length > 0 && soundHint && muted && (
        <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ top: 'calc(env(safe-area-inset-top,0px) + 60px)' }}>
          <span className="inline-flex animate-toast-top items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white"><SpeakerIcon className="h-4 w-4" /> {t('reels.soundHint')}</span>
        </div>
      )}

      {items === null ? (
        <div className="flex h-full items-center justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white/80">
          <VideoIcon className="h-14 w-14 text-white/50" />
          <p className="text-lg font-semibold">{t('reels.empty')}</p>
          <button onClick={goBackFn} className="rounded-full bg-white/15 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">{t('reels.back')}</button>
        </div>
      ) : (
        <div ref={feedRef}
          className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {items.map((p, i) => (
            <ReelSlide
              key={`${p.id}-${i}`}
              p={p}
              muted={muted}
              rtl={rtl}
              t={t}
              hint={i === 0}
              isActive={i === active}
              preload={i === active || i === active + 1}
              isLast={i === items.length - 1}
              onUnmute={() => setMutedPersist(false)}
              onEnded={() => goNext(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReelSlide({ p, muted, rtl, t, hint, isActive, preload, isLast, onUnmute, onEnded }) {
  const { add, buyNow } = useCart();
  const { has, toggle } = useWishlist();
  const liked = has(p.id);
  const [copied, setCopied] = useState(false);
  const progressRef = useRef(null); // شريط التقدّم يُحدَّث بالـDOM مباشرة (بلا re-render كل timeupdate = تعليق)
  const [burst, setBurst] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [errored, setErrored] = useState(false);
  const [pick, setPick] = useState(false);
  const [pickMode, setPickMode] = useState('add'); // 'add' | 'buy' — أي زر فتح شيت الاختيار
  const [selSize, setSelSize] = useState('');
  const [selColor, setSelColor] = useState('');
  const [mySize] = useState(getMySize); // نميّز مقاسها المعتاد كصفحة المنتج
  const vidRef = useRef(null);
  const hlsRef = useRef(null); // مشغّل hls.js (أندرويد/كروم) — iOS يشغّل HLS أصلياً
  const [useMp4, setUseMp4] = useState(false); // فشل HLS؟ → احتياط MP4 نظيف
  const tapRef = useRef({ t: 0 });
  // كتم مؤقّت لهذا الريل فقط عند رفض iOS التشغيل بالصوت — لا نلمس التفضيل العام
  // (كان يُكتَم الإعداد العام للأبد فيصمت كل الريلز التالية = "كل كم فيديو ينكتم").
  // يرجع الصوت تلقائياً بأول لمسة/سحبة، والأيقونة تبقى صحيحة (صوت مفعّل).
  const forcedMuteRef = useRef(false);
  const holdRef = useRef({ timer: null, held: false, x: 0, y: 0, moved: false, swallow: false });
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const poster = cldVideoPoster(p.videoUrl) || p.imageUrl || '';

  // تعليق مصدر الفيديو: HLS متكيّف أولاً، وعند أي فشل قاتل → MP4 نظيف (بلا شاشة سوداء).
  // أندرويد/كروم: عبر hls.js (يُحمَّل عند الحاجة) مع تحكّم كامل بالتحميل (stopLoad للتالية).
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid || !preload || NATIVE_HLS) return undefined;
    const hlsUrl = reelHls(p.videoUrl);
    const mp4Url = reelMp4(p.videoUrl);
    let cancelled = false;
    if (!hlsUrl || useMp4) { vid.src = mp4Url; return undefined; }
    let hls;
    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { vid.src = mp4Url; return; }
        // مخزون 30 ثانية بدل 15 — على شبكات الجوّال الضعيفة (جمهور الإعلانات) كان
        // المخزون القصير ينفد فيقف الفيديو كل شوي.
        // جودة عالية للريلز القصيرة:
        // - startLevel:-1 + تقدير نطاق مبدئي عالٍ (5Mbps): يبدأ بأعلى دقة فوراً بدل أدنى
        //   دقة "احتياطاً" (الريل القصير كان يخلص قبل ارتقاء الدقة = جودة زفتة).
        // - أزلنا capLevelToPlayerSize: كان يقيّد الدقة بعرض المشغّل بالبكسل المنطقي
        //   (~400px) فيختار ~480p رغم شاشة retina — سبب مباشر لضبابية الصورة.
        // - ولو الشبكة فعلاً ضعيفة، ABR ينزل تلقائياً فلا تعليق.
        hls = new Hls({ maxBufferLength: 30, autoStartLoad: false, startLevel: -1, abrEwmaDefaultEstimate: 5000000 });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data && data.fatal) { try { hls.destroy(); } catch { /* تجاهل */ } hlsRef.current = null; setUseMp4(true); }
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(vid);
        if (activeRef.current) hls.startLoad(-1);
      })
      .catch(() => { if (!cancelled) vid.src = mp4Url; });
    return () => {
      cancelled = true;
      if (hls) { try { hls.destroy(); } catch { /* تجاهل */ } if (hlsRef.current === hls) hlsRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload, useMp4]);

  // iOS/سفاري (HLS أصلي): لا سيطرة على تحميله — فيديوان معلّقان يتنافسان على الشبكة
  // (لهذا كان الكمبيوتر سلساً والآيفون/الآيباد يتلعثم). الحل: نعلّق المصدر للشريحة
  // النشطة فقط، ونفصله عند مغادرتها — البوستر يغطي الشرائح المجاورة.
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid || !NATIVE_HLS || !preload) return undefined;
    const hlsUrl = reelHls(p.videoUrl);
    const mp4Url = reelMp4(p.videoUrl);
    const src = (!hlsUrl || useMp4) ? mp4Url : hlsUrl;
    if (isActive) {
      if (vid.getAttribute('src') !== src) { vid.src = src; try { vid.load(); } catch { /* تجاهل */ } }
    } else if (vid.getAttribute('src')) {
      try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch { /* تجاهل */ }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, preload, useMp4]);

  // المتغيّرات بوعي مخزون الألوان (النموذج الجديد): الألوان من colorStock إن وُجد،
  // والنمر المتاحة تتبع اللون المختار (تُستثنى المنفدة) — فلا تُضاف تشكيلة غير متوفرة
  const colorStock = p.colorStock && typeof p.colorStock === 'object' ? p.colorStock : {};
  const hasCS = Object.keys(colorStock).length > 0;
  // منتجات مخزون النمر العادي: نستثني المنفدة (كمية 0) أيضاً — نفس منطق مخزون الألوان
  const sizeStock = p.sizeStock && typeof p.sizeStock === 'object' ? p.sizeStock : {};
  const sizes = hasCS
    ? (selColor ? Object.entries(colorStock[selColor] || {}).filter(([, q]) => q !== 0).map(([s]) => s) : [])
    : (p.size || '').split(',').map((s) => s.trim()).filter(Boolean).filter((s) => sizeStock[s] !== 0);
  const colors = hasCS ? Object.keys(colorStock) : (p.color || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hasDiscount = p.oldPrice && p.oldPrice > p.price;
  const discountPct = hasDiscount ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  // نفد كلياً؟ (صفر عام أو نفاد كل كميات الألوان/النمر) — بدونها كان شيت الاختيار
  // يُفتح فارغاً بلا نمرة قابلة للاختيار فتحتار الزبونة
  const detailedQty = hasCS
    ? Object.values(colorStock).flatMap((sz) => Object.values(sz || {})).filter((q) => typeof q === 'number')
    : Object.values(sizeStock).filter((q) => typeof q === 'number');
  const soldOut = p.stock === 0 || (detailedQty.length > 0 && detailedQty.reduce((a, b) => a + b, 0) === 0);

  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return undefined;
    if (!isActive) {
      vid.pause();
      vid.currentTime = 0;
      if (progressRef.current) progressRef.current.style.width = '0%';
      if (hlsRef.current) { try { hlsRef.current.stopLoad(); } catch { /* تجاهل */ } } // الشريحة التالية لا تزاحم تحميل النشطة
      return undefined;
    }
    if (hlsRef.current) { try { hlsRef.current.startLoad(-1); } catch { /* تجاهل */ } }
    // عنصر الفيديو يُركّب عند الاقتراب فقط، فقد لا يكون جاهزاً لحظة التفعيل —
    // أمر تشغيل واحد كان يفشل بصمت ويبقى الفيديو واقفاً حتى كبسة المستخدم.
    // الآن: محاولة فورية + إعادة عند جاهزية البيانات + محاولات مجدولة قليلة
    // (لا نقاوم الإيقاف المتعمّد بالضغط المطوّل).
    let alive = true;
    let blockedTries = 0; // مرات رفض التشغيل بالصوت — نعيد المحاولة ضمن نافذة تفعيل السحبة قبل الكتم
    const tryPlay = () => {
      if (!alive || vid.ended || !vid.paused || holdRef.current.held || document.hidden) return;
      vid.play().catch((err) => {
        if (!alive || !err || err.name !== 'NotAllowedError' || vid.muted) return;
        // رُفض التشغيل بالصوت. iOS يسمح بالصوت خلال ثوانٍ قليلة من أي إيماءة، والسحبة
        // التي جاءت بنا لهذا الريل هي إيماءة — فنعيد المحاولة بالصوت عدة مرات سريعة،
        // تنجح غالباً فيبقى الصوت تلقائياً بلا أي كبسة. وإن فشلت كلها (تفعيل منتهٍ،
        // كالتقدّم التلقائي بعد انتهاء الريل) نكتم مؤقّتاً كي لا يتجمّد، والصوت يعود
        // بأول لمسة/سحبة تالية. (كان يكتم من أول رفضة ولا يعيد المحاولة أبداً = سبب
        // "كل كم مقطع يروح الصوت ولازم أكبس".)
        blockedTries += 1;
        if (blockedTries >= 4) {
          forcedMuteRef.current = true;
          vid.muted = true;
          vid.play().catch(() => {});
        }
      });
    };
    tryPlay();
    vid.addEventListener('loadeddata', tryPlay);
    vid.addEventListener('canplay', tryPlay);
    // إعادات سريعة تلتقط تفعيل السحبة (خلال ~½ثانية) لاستعادة الصوت تلقائياً،
    // ثم حارس كل 800ms يضمن ألا يبقى الفيديو واقفاً أبداً مهما كان السبب.
    const quick = [130, 300, 520].map((ms) => setTimeout(tryPlay, ms));
    const iv = setInterval(tryPlay, 800);
    return () => {
      alive = false;
      clearInterval(iv);
      quick.forEach(clearTimeout);
      vid.removeEventListener('loadeddata', tryPlay);
      vid.removeEventListener('canplay', tryPlay);
    };
  }, [isActive]);

  // iOS يوقف الفيديو تلقائياً لو أُزيل الكتم خارج إيماءة مستخدم مباشرة (سياسة WebKit
  // الموثّقة) — لهذا بعد تطبيق الكتم نستأنف فوراً، ولو رُفض بالصوت يُعاد مكتوماً (لا يجمد أبداً).
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return;
    forcedMuteRef.current = false; // تفضيل جديد صريح من المستخدم يلغي أي كتم مؤقّت
    vid.muted = muted;
    if (!muted) ensurePlaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // استعادة الصوت داخل أي إيماءة (لمسة/بداية سحب): لو كان هذا الريل مكتوماً مؤقّتاً
  // (رفض iOS التشغيل بالصوت تلقائياً) والمستخدم مفضّلٌ الصوت عاماً، نرجّعه فوراً —
  // فالصوت يعود بلا كبسة مقصودة (أول تفاعل يكفي)، دون أي تجمّد.
  const restoreSoundIfForced = () => {
    const v = vidRef.current;
    if (v && forcedMuteRef.current && !muted) {
      forcedMuteRef.current = false;
      v.muted = false;
      v.play().catch(() => {});
    }
  };

  // حارس الانحشار (زي مشغّلات الريلز الكبيرة): لو صار الفيديو "شغّال" لكن وقته لا
  // يتقدّم ~6 ثوانٍ (تخزين معلّق/شبكة انقطعت لحظة/جلسة iOS انحشرت) نعيد تحميل
  // المصدر ونكمل من نفس المكان تلقائياً — بدل ما يظل واقفاً حتى تدخّل المستخدم.
  const stuckRef = useRef({ t: -1, count: 0 });
  useEffect(() => {
    if (!isActive) return undefined;
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
              // مع hls.js: إعادة إقلاع التحميل من نفس الموضع (لا نلمس v.load مع MSE)
              hlsRef.current.startLoad(pos);
              v.play().catch(() => {});
            } else {
              v.load(); // إعادة فتح المصدر (يتخطى المخزّن المنحشر)
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
  }, [isActive]);

  // إيقاف الفيديو عند قفل الشاشة/تصغير التطبيق، وإيقافه وإفراغ مصدره عند مغادرة الريلز.
  // كان صوت الريل يظل يعمل بمشغّل الوسائط على شاشة القفل (iOS PWA) وكأنه "معلّق".
  useEffect(() => {
    const onVis = () => {
      const v = vidRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else if (activeRef.current && !holdRef.current.held) v.play().catch(() => {});
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
  // الفيديو النشط يجب أن يظل يعمل دائماً. أي توقّف غير متعمّد (سباق أثناء التمرير،
  // تعليق iOS، عودة من الخلفية) يُستأنف فوراً — هذا يصلح "الفيديو بيقطع وما بيشتغل
  // إلا بكبسة مطوّلة": لم تكن هناك إعادة تشغيل بعد انتهاء مؤقّتات التفعيل الأولى.
  const ensurePlaying = () => {
    const v = vidRef.current;
    if (v && isActive && !holdRef.current.held && !document.hidden && v.paused && !v.ended) {
      v.play().catch((err) => {
        // رُفض بالصوت؟ نكتم هذا العنصر مؤقّتاً ونشغّل — يظل يعمل بلا كبسة وبلا كتم عام
        if (err && err.name === 'NotAllowedError' && !v.muted) {
          forcedMuteRef.current = true;
          v.muted = true;
          v.play().catch(() => {});
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
    if (navigator.vibrate) navigator.vibrate(18); // اهتزاز خفيف (أندرويد)
  };

  // نقرة = إزالة كتم (+استئناف لو واقف) | نقرة مزدوجة = لايك
  // كل شيء يتنفّذ فوراً داخل الإيماءة نفسها — كان تأخير إزالة الكتم بمؤقّت 350ms
  // يُخرجها من نافذة إيماءة المستخدم، فيوقف iOS الفيديو (سياسة WebKit: إزالة الكتم
  // بلا إيماءة = إيقاف) ثم تُرفض كل محاولات التشغيل التلقائية إلى أن يضغط المستخدم
  // ضغطاً مطوّلاً — هذا كان سبب "الريل بوقف وما برضى يشتغل إلا بضغطة طويلة".
  const onTap = () => {
    const v = vidRef.current;
    if (v && v.paused && !v.ended) v.play().catch(() => {});
    const now = Date.now();
    if (now - tapRef.current.t < 350) {
      tapRef.current.t = 0;
      doLike();
    } else {
      tapRef.current.t = now;
      if (muted) { if (v) v.muted = false; onUnmute(); } // الكتم يُزال داخل الإيماءة مباشرة — iOS ما بيوقف الفيديو
    }
  };

  // ضغط مطوّل = إيقاف مؤقّت (مع إلغائه إن صار تمرير)
  const onDown = (e) => {
    // أول لمسة إيماءة حقيقية: لو الفيديو واقف (توفير طاقة/رفض تشغيل) نستأنفه فوراً —
    // حتى السحب للتمرير يكفي، فلا يحتاج المستخدم أي كبسة مقصودة. ونرجّع الصوت إن كان
    // مكتوماً مؤقّتاً — هذه الإيماءة تسمح لـ iOS بالصوت، فيعود تلقائياً.
    const v = vidRef.current;
    if (v && activeRef.current && v.paused && !v.ended) v.play().catch(() => {});
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
  // إنهاء الضغط المطوّل من أي مسار (رفع الإصبع أو خطف التمرير للمسة عبر pointercancel).
  // المهم: نصفّر held دائماً — كان يبقى عالقاً عند التمرير (لا يصل click يصفّره)
  // فترفض إعادة التشغيل التلقائية تشغيل الفيديو "الموقوف عمداً" إلى الأبد،
  // وهذا سبب توقّف الفيديو عند التصفّح لتحت حتى كبسة المستخدم.
  const endHold = (resume) => {
    clearTimeout(holdRef.current.timer);
    if (holdRef.current.held) {
      holdRef.current.swallow = true; // نبلع النقرة القادمة (كانت ضغطاً مطوّلاً لا نقرة)
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
    // بلا text: عند اختيار "نسخ" من ورقة المشاركة يدمج النظام النص مع الرابط فيخرج
    // ملوّثاً بكلام — ورابط /share/ يعرض صورة المنتج وسعره كمعاينة أصلاً
    const data = { title: p.name, url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt(t('reels.copyPrompt'), url); }
  };

  const quickAdd = () => {
    if (sizes.length || colors.length) { setPickMode('add'); setPick(true); return; }
    add({ ...p, whatsapp: p.storeWhatsapp, size: '', color: '' });
  };
  // شراء فوري من الريل: نفس تدفّق الاختيار، ثم تفتح السلة على إتمام الطلب مباشرة
  const quickBuy = () => {
    if (sizes.length || colors.length) { setPickMode('buy'); setPick(true); return; }
    buyNow({ ...p, whatsapp: p.storeWhatsapp, size: '', color: '' });
  };
  const confirmAdd = () => {
    const doIt = pickMode === 'buy' ? buyNow : add;
    doIt({ ...p, whatsapp: p.storeWhatsapp, size: selSize, color: selColor });
    setPick(false);
  };
  // اللون أولاً (إن وُجد)، ثم النمرة من المتاح — ولون نفدت كل نمره لا يُؤكَّد
  const canConfirm = (!colors.length || selColor) && (!sizes.length || selSize) && !(hasCS && selColor && sizes.length === 0);

  return (
    <section className="relative flex h-[100dvh] w-full snap-start snap-always justify-center bg-black">
      <div className="relative h-full w-full sm:max-w-[480px]">
        {/* شريط التقدّم — يُحدَّث بالـDOM مباشرة (بلا إعادة رسم البطاقة) */}
        <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/20">
          <div ref={progressRef} className="h-full bg-white/90 transition-[width] duration-150 ease-linear" style={{ width: '0%' }} />
        </div>

        {/* الشرائح البعيدة تعرض الصورة فقط (لا عنصر فيديو) → تمرير أسلس وأسرع بلا تعليق.
            الفيديو يُحمّل للنشطة والتالية فقط. */}
        {(!preload || errored) ? (
          <img src={cldThumb(poster, 720)} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <video
            ref={vidRef}
            poster={poster}
            muted={muted}
            playsInline
            preload={isActive ? 'auto' : 'metadata'}
            onTimeUpdate={onTimeUpdate}
            onEnded={onVidEnded}
            onPause={ensurePlaying}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onCanPlay={() => { setBuffering(false); ensurePlaying(); }}
            onError={() => { if (!useMp4) setUseMp4(true); else setErrored(true); }}
            style={{ touchAction: 'pan-y' }}
            className="h-full w-full object-cover"
          />
        )}

        {/* مؤشّر تحميل الفيديو */}
        {buffering && isActive && !errored && (
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

        {hint && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex animate-bounce justify-center text-white/70">
            <span className="rounded-full bg-black/45 px-3 py-1 text-xs">{t('reels.swipeHint')} ↑</span>
          </div>
        )}

        {copied && (
          <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center">
            <span className="rounded-full bg-black/75 px-4 py-2 text-xs font-semibold text-white">{t('reels.copied')}</span>
          </div>
        )}

        {/* شارات: خصم + عدد المبيعات */}
        <div className="absolute start-3 z-20 flex flex-col items-start gap-2" style={{ top: 'calc(env(safe-area-inset-top,0px) + 64px)' }}>
          {hasDiscount && <span className="rounded-full bg-[#8a2438] px-2.5 py-1 text-xs font-extrabold text-[#F4EDE2] shadow">-{discountPct}%</span>}
          {p.soldCount > 0 && <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">{t('product.soldCount', { count: p.soldCount })}</span>}
        </div>

        {/* مفضّلة + مشاركة */}
        <div className="absolute bottom-40 end-3 z-20 flex flex-col items-center gap-4">
          <button type="button" onClick={() => { if (!liked && navigator.vibrate) navigator.vibrate(18); toggle(p); }} aria-label="wishlist"
            className={`flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-white/20 transition active:scale-90 ${liked ? 'bg-red-500/90 text-white' : 'bg-black/50 text-white hover:bg-black/65'}`}>
            <HeartIcon className="h-6 w-6" filled={liked} />
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
              <img src={cldThumb(p.storeLogo, 80)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-[#e6c878]/70" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white"><StoreIcon className="h-4 w-4" /></span>
            )}
            <span className="truncate">{p.storeName}</span>
          </Link>
          {/* اسم بخط العرض الفاخر + سعر ذهبي بحبة عصرية (بلا blur — تمرير أسلس) */}
          <h2 className="line-clamp-2 font-display text-lg font-bold leading-snug drop-shadow-lg">{p.name}</h2>
          {p.description && <p className="line-clamp-1 text-xs text-white/75 drop-shadow">{p.description}</p>}
          <div className="flex items-baseline gap-2">
            <span className="rounded-full bg-black/50 px-3 py-1 font-display text-lg font-extrabold text-gold-200 ring-1 ring-[#e6c878]/30">{t('common.currency')}{p.price}</span>
            {hasDiscount && <Strike className="text-sm text-white/70">{t('common.currency')}{p.oldPrice}</Strike>}
            {hasDiscount && <span className="rounded-full bg-emerald-600/85 px-2 py-0.5 text-[11px] font-bold text-white drop-shadow">{t('product.saveAmount', { amount: `${t('common.currency')}${(p.oldPrice - p.price).toFixed(2).replace(/\.00$/, '')}` })}</span>}
          </div>
          <div className="mt-1 flex items-stretch gap-2">
            {/* شراء فوري من الريل — الزر الأساسي (يفتح إتمام الطلب مباشرة بعد الاختيار) */}
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
              {/* مع مخزون الألوان: النمر تظهر بعد اختيار اللون (المتاح فقط) */}
              {hasCS && !selColor ? (
                <p className="mb-4 rounded-xl bg-wine/5 px-3 py-2 text-sm font-medium text-wine/70">{t('product.pickColorFirst')}</p>
              ) : sizes.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-medium text-stone-500">{t('reels.size')}</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => {
                      // المتبقّي من هذه النمرة (نفس عرض صفحة المنتج) — طمأنة وندرة بنفس الوقت
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
    </section>
  );
}

function MutedIcon() {
  return (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>);
}
function SoundIcon() {
  return (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>);
}

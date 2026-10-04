import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import {
  BackIcon, BagIcon, CameraIcon, ImageIcon, TrashIcon, XIcon, MicIcon, SparkleIcon,
  SendIcon, ReplyIcon, CopyIcon, ClockIcon, CheckIcon, ArrowDownIcon, InstagramIcon, FacebookIcon,
  LinkOutIcon, WarnIcon, VideoIcon, TagIcon, SearchIcon,
} from '../../components/icons.jsx';
import { cloudinaryEnabled, cldThumb, cldBlur, cldOptimized, cldVideoPoster } from '../../utils/cloudinary.js';
import { uploadMedia } from '../../utils/media.js';
import { Avatar, ConvertForm } from '../../components/OrderComposer.jsx';
import {
  buildItems, guessKind, findMobile, cldAudioMp3, sameDay,
  replyWindow, lastInboundAt, matchQuick, linkify, hostOf, shortUrl, normalizeAr,
} from '../../utils/chat.js';
import { useNotifications } from '../../context/NotificationsContext.jsx';
import { clearDelivered } from '../../utils/push.js';
import * as cache from '../../utils/chatCache.js';
import { StatusBadge } from '../../components/OrderStatus.jsx';

// شاشةُ المحادثةِ تُرسَمُ على ‎document.body، فتخرجُ من ‎.theme-pub — وكلُّ قواعدِ
// الوضعِ النهاريِّ مكتوبةٌ ‎.theme-pub .x. فكانت الحقولُ والأزرارُ والنصوصُ داخلَها
// تسقطُ إلى قيمِها الليليّةِ فوقَ صفحةٍ نهاريّة: خاناتٌ رماديّةٌ داكنةٌ بنصٍّ أبيضَ
// على بياض. نرسمُ داخلَ ‎.theme-pub كما تفعلُ بقيّةُ النوافذِ بالمشروع.
const bzPortalRoot = () => (typeof document !== 'undefined' && (document.querySelector('.theme-pub') || document.body)) || null;

// معرّفُ الرسالةِ عند ميتا. المرفقاتُ الإضافيّةُ في رسالةٍ واحدةٍ تُحفَظُ بمعرّفٍ مشتقٍّ
// (‎mid#2‎)، والردُّ والتفاعلُ يذهبان إلى الرسالةِ الأصليّةِ نفسِها.
const metaMid = (mid) => String(mid || '').split('#')[0];

// المسودّةُ لكلِّ محادثة: الخروجُ لمراجعةِ طلبٍ أو سعرٍ لا يمسحُ ما كُتب نصفُه.
const draftKey = (id) => `bz-ig-draft:${id}`;
const readDraft = (id) => { try { return localStorage.getItem(draftKey(id)) || ''; } catch { return ''; } };
const writeDraft = (id, v) => {
  try { if (v) localStorage.setItem(draftKey(id), v); else localStorage.removeItem(draftKey(id)); } catch { /* تخزينٌ محجوب */ }
};

// ═════════ شاشةُ محادثةٍ واحدة ═════════
// المحادثةُ صفحةٌ قائمةٌ بذاتها تُرسَمُ على body: رأسٌ في الأعلى، ورسائلٌ تملأُ ما
// بينهما، وصندوقُ كتابةٍ ملتصقٌ بالأسفل — كما في كلِّ تطبيقِ محادثة.

// العارض: الصورةُ تكبرُ في مكانِها والفيديو يُشغَّلُ بملءِ الشاشة. في تطبيقٍ مثبَّتٍ
// (PWA) لا تبويبَ يُفتَح، فكان فتحُ الرابطِ يبدو كأنّ الصورةَ لا تفتح.
function MediaViewer({ media, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="bz-chat-viewer fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={onClose}>
      {media.kind === 'video' ? (
        <video
          src={cldOptimized(media.url, 'video')}
          controls
          autoPlay
          playsInline
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl"
        />
      ) : (
        <img src={cldOptimized(media.url)} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
      )}
      {/* زرُّ الإغلاقِ قرصٌ داكنٌ بحلقةٍ بيضاءَ فوقَ الصورة — يُقرأُ على أيِّ صورةٍ كانت */}
      <button
        onClick={onClose}
        className="absolute end-3 top-[max(env(safe-area-inset-top),14px)] z-10 rounded-full bg-black/55 p-2.5 text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-black/75"
        aria-label={t('common.close', { defaultValue: 'إغلاق' })}
      >
        <XIcon className="h-5 w-5" />
      </button>
    </div>,
    bzPortalRoot() || document.body
  );
}

const fmtSecs = (s) => {
  const n = Number.isFinite(s) ? Math.max(0, Math.round(s)) : 0;
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

// الرسالةُ الصوتيّة: كان مشغّلُ المتصفّحِ الخامَ بأزرارِه الرماديّةِ وشريطِه العريض —
// غريباً عن المحادثةِ ويتغيّرُ شكلُه بين جهازٍ وآخر. صار زرَّ تشغيلٍ وخطَّ تقدّمٍ ومدّةً
// كما في إنستغرام وواتساب.
function VoiceNote({ url, out }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [broken, setBroken] = useState(false);
  const toggle = (e) => {
    e.stopPropagation();
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setBroken(true)); else a.pause();
  };
  if (broken) {
    return <audio src={url} controls className="w-[220px] max-w-full" />;
  }
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  return (
    <div className="flex w-[220px] max-w-full items-center gap-2.5 px-1 py-0.5" dir="ltr">
      <button
        type="button"
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${out ? 'bz-voice-btn-out' : 'bz-voice-btn'}`}
        aria-label={playing ? 'pause' : 'play'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ms-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M7 4.5 L19 12 L7 19.5 Z" /></svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="bz-voice-track relative h-1 overflow-hidden rounded-full">
          <span className="bz-voice-fill absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span className="bz-chat-time mt-1 block text-[10px] tabular-nums">
          {fmtSecs(playing || pos ? pos : dur)}
        </span>
      </div>
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onDurationChange={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }}
        onError={() => setBroken(true)}
        className="hidden"
      />
    </div>
  );
}

// ما نوعُ المرفقِ للعرض: الريلز فيديو، والمنشورُ المشارَكُ وذكرُ الستوري صورتان بوسم.
function mediaKind(url, type) {
  if (type === 'ig_reel' || type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  if (type === 'sticker') return 'sticker';
  if (type === 'file') return 'file';
  if (type === 'share' || type === 'story_mention' || type === 'image') return 'image';
  return guessKind(url) || 'image';
}

// المرفقُ يظهرُ بصورتِه: صورةٌ تُعرَضُ وتكبر، وفيديو يُشغَّل، وصوتٌ يُسمَعُ في مكانه.
// الصورُ منسوخةٌ عندنا، فنطلبُ مقاسَ العرضِ لا الأصلَ الكامل — وخلفَها نسخةٌ ضبابيّةٌ
// تصلُ في أجزاءٍ من الثانية بدل مربّعٍ فارغٍ يقفزُ حين تجهزُ الصورة.
function Attachment({ url, type, out, onOpen }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const kind = mediaKind(url, type);
  // وسمٌ صغيرٌ فوقَ ما ليس صورةً عاديّة: منشورٌ مشارَك، ريلز، ذكرٌ في ستوري
  const badge = type === 'share' ? t('dashboard.instagram.sharedPost')
    : type === 'ig_reel' ? t('dashboard.instagram.reel')
    : type === 'story_mention' ? t('dashboard.instagram.storyMention')
    : '';

  if (!broken && kind === 'sticker') {
    return <img src={cldThumb(url, 240)} alt="" onError={() => setBroken(true)} className="block h-[110px] w-[110px] object-contain" />;
  }

  if (!broken && kind === 'image') {
    const blur = cldBlur(url);
    // إطارٌ ثابتُ المقاس: لو تُرك الارتفاعُ للصورةِ لقفزت القائمةُ تحت الإصبعِ كلّما
    // جهزت واحدة. وبلا `loading="lazy"` عمداً — الشاشةُ ترسمُ أربعين رسالةً لا مئتين،
    // والتحميلُ الكسولُ يعني فكَّ ترميزِ الصورةِ أثناءَ السحبِ نفسِه.
    return (
      <button
        type="button"
        onClick={() => onOpen({ url, kind: 'image' })}
        style={blur ? { backgroundImage: `url(${blur})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        className={`relative block w-[220px] max-w-full overflow-hidden rounded-[16px] ${type === 'story_mention' ? 'h-[300px] w-[170px]' : 'h-[220px]'}`}
      >
        <img
          src={cldThumb(url, 480)}
          alt=""
          decoding="async"
          onError={() => setBroken(true)}
          className="block h-full w-full object-cover"
        />
        {badge && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            {type === 'share' ? <LinkOutIcon className="h-3 w-3" /> : <InstagramIcon className="h-3 w-3" />}
            {badge}
          </span>
        )}
      </button>
    );
  }
  if (!broken && kind === 'video') {
    return (
      <div className="relative w-[220px] max-w-full">
        <video
          src={cldOptimized(url, 'video')}
          controls
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
          className={`block w-full rounded-[16px] bg-black object-cover ${type === 'ig_reel' ? 'h-[340px]' : 'h-[220px]'}`}
        />
        {badge && (
          <span className="pointer-events-none absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <VideoIcon className="h-3 w-3" /> {badge}
          </span>
        )}
        <button
          type="button"
          onClick={() => onOpen({ url, kind: 'video' })}
          className="absolute end-2 top-2 rounded-full bg-black/55 p-1.5 text-white backdrop-blur"
          aria-label={t('dashboard.instagram.fullscreen')}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 9 V4 H9 M20 9 V4 H15 M4 15 V20 H9 M20 15 V20 H15" /></svg>
        </button>
      </div>
    );
  }
  if (!broken && kind === 'audio') {
    return <VoiceNote url={url} out={out} />;
  }
  // ملفٌّ أو مرفقٌ تعذّر عرضُه: بطاقةٌ تُفتَحُ لا رابطٌ مكتوبٌ عليه «مرفق»
  return (
    <a href={url} target="_blank" rel="noreferrer" className="bz-chat-linkcard flex w-[220px] max-w-full items-center gap-2.5 rounded-xl px-3 py-2.5">
      <span className="text-lg" aria-hidden>📎</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t('dashboard.instagram.attachment')}</span>
      <LinkOutIcon className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}

// النصُّ بروابطِه وأرقامِه: الرابطُ يُفتَحُ والرقمُ يُتّصلُ به، وتحتَ أوّلِ رابطٍ بطاقةٌ
// باسمِ الموقع — كي تعرفَ التاجرةُ إلى أين يأخذُها قبلَ أن تضغط.
function RichText({ text, media }) {
  const { t } = useTranslation();
  const parts = useMemo(() => linkify(text), [text]);
  const firstUrl = parts.find((p) => p.type === 'url');
  const host = firstUrl ? hostOf(firstUrl.href) : '';
  const stop = (e) => e.stopPropagation();
  return (
    <>
      <p className={`whitespace-pre-wrap break-words text-[14.5px] leading-[1.45] ${media ? 'px-2 pb-1 pt-1.5' : ''}`}>
        {parts.map((p, i) => (p.type === 'text'
          ? <span key={i}>{p.value}</span>
          : (
            <a
              key={i}
              href={p.href}
              target={p.type === 'url' ? '_blank' : undefined}
              rel="noreferrer"
              dir="ltr"
              onClick={stop}
              className="bz-chat-link break-all font-medium underline decoration-1 underline-offset-2"
            >
              {p.type === 'url' ? shortUrl(p.value) : p.value}
            </a>
          )))}
      </p>
      {firstUrl && host && (
        <a
          href={firstUrl.href}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          className="bz-chat-linkcard mb-0.5 mt-1.5 flex items-center gap-2 rounded-xl px-2.5 py-2"
        >
          <span className="bz-chat-linkicon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            {/instagram\.com$/.test(host) ? <InstagramIcon className="h-4 w-4" />
              : /facebook\.com$|fb\.com$|fb\.me$/.test(host) ? <FacebookIcon className="h-4 w-4" />
              : <LinkOutIcon className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[12.5px] font-bold" dir="ltr">{host}</span>
            <span className="bz-chat-time block truncate text-[10.5px]">{t('dashboard.instagram.openLink')}</span>
          </span>
        </a>
      )}
    </>
  );
}

// ═════════ ملفُّ الزبونة برأسِ المحادثة ═════════
// من رقمِها (من طلبِها المحوَّلِ أو ممّا كتبَتْه بالمحادثة) نعرفُ إن كانت زبونةً راجعة:
// كم طلبت وكم صرفت وآخرُ طلباتِها بحالاتِها — فتردُّ التاجرةُ على من تعرفُها بنبرةِ من
// تعرفُها، وتجدُ طلبَها السابقَ بضغطةٍ بدل البحثِ عنه.
function CustomerStrip({ phone }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cust, setCust] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setCust(null);
    if (!phone) return undefined;
    let on = true;
    api.get('/orders/customer', { params: { phone } })
      .then((r) => { if (on) setCust(r.data?.customer || null); })
      .catch(() => {});
    return () => { on = false; };
  }, [phone]);
  if (!cust) return null;
  // البحثُ في قائمةِ الطلباتِ يُحفَظُ بذاكرةِ الجلسة (useSessionState) — نضعُ فيه الرقم
  // فتُفتَحُ الطلباتُ مصفّاةً على هذه الزبونةِ وحدَها.
  const openOrders = (q) => {
    try { sessionStorage.setItem('bz_ss:orders:q', JSON.stringify(q)); } catch { /* تصفّحٌ خاصّ */ }
    navigate('/dashboard?tab=myOrders');
  };
  return (
    <div className="bz-chat-bar shrink-0 border-b">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-start">
        <span className="bz-cust-chip is-back inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold">
          {cust.orders > 1 ? t('dashboard.instagram.custBack') : t('dashboard.instagram.custKnown')}
        </span>
        <span className="bz-chat-muted min-w-0 flex-1 truncate text-[11.5px] font-semibold">
          {t('dashboard.instagram.custStats', { count: cust.orders })}
          {cust.spent > 0 && ` · ${t('dashboard.instagram.custSpent', { total: Math.round(cust.spent) })}`}
        </span>
        <svg className={`bz-chat-muted h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="space-y-1 px-3 pb-2.5">
          {cust.recent.map((o) => (
            <button key={o.id} onClick={() => openOrders(o.reference || cust.phone)} className="bz-chat-row flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-start">
              <StatusBadge status={o.status} />
              <span dir="ltr" className="text-[11.5px] font-bold">{o.reference}</span>
              <span className="bz-chat-muted ms-auto text-[11px] tabular-nums">₪{Math.round(o.total)} · {new Date(o.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
          {cust.orders > cust.recent.length && (
            <button onClick={() => openOrders(cust.phone.replace(/^5/, '05'))} className="bz-chat-muted w-full py-1 text-center text-[11px] font-semibold underline underline-offset-2">
              {t('dashboard.instagram.custAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════ «أرسلي منتجاً» ═════════
// لوحةٌ من أسفلِ الشاشةِ بمنتجاتِ المتجرِ وبحث: الضغطةُ على قطعةٍ تبعثُ صورتَها وسطراً
// باسمِها وسعرِها ورابطِها. كانت التاجرةُ تخرجُ إلى متجرِها لتنسخَ الرابطَ وتعودَ.
function ProductSheet({ onPick, onClose }) {
  const { t } = useTranslation();
  const [list, setList] = useState(() => cache.getProducts());
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/products')
      .then((r) => {
        const items = (r.data.products || []).filter((p) => !p.hidden);
        cache.setProducts(items);
        setList(items);
      })
      .catch((e) => { if (!cache.getProducts()) setError(getErrorMessage(e)); });
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const term = normalizeAr(q);
  const shown = (list || []).filter((p) => !term || normalizeAr(p.name).includes(term));
  const thumb = (p) => {
    const raw = p.imageUrl || p.images?.[0] || '';
    return raw ? cldThumb(raw, 240) : (p.videoUrl ? cldVideoPoster(p.videoUrl, 240) : '');
  };
  return (
    <div className="fixed inset-0 z-[105] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label={t('common.close', { defaultValue: 'إغلاق' })} onClick={onClose} className="bz-sheet-backdrop absolute inset-0" />
      <div className="bz-sheet relative flex max-h-[78%] flex-col rounded-t-3xl pb-[max(env(safe-area-inset-bottom),12px)]">
        <span className="bz-sheet-grip mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full" aria-hidden />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <p className="flex-1 text-[15px] font-bold">{t('dashboard.instagram.sendProduct')}</p>
          <button onClick={onClose} className="bz-chat-icon rounded-full p-1.5" aria-label={t('common.close', { defaultValue: 'إغلاق' })}>
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="relative shrink-0 px-4 pb-3">
          <SearchIcon className="bz-chat-muted pointer-events-none absolute start-7 top-1/2 h-4 w-4 -translate-y-[calc(50%+6px)]" />
          <input
            className="bz-chat-input w-full !ps-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('dashboard.instagram.searchProduct')}
          />
        </div>
        <div className="min-h-[160px] overflow-y-auto overscroll-contain px-4 pb-2">
          {error ? (
            <p className="bz-chat-err rounded-xl px-3 py-2 text-xs">{error}</p>
          ) : list === null ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : shown.length === 0 ? (
            <p className="bz-chat-muted py-10 text-center text-sm">{t('dashboard.instagram.noProducts')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {shown.map((p) => {
                const img = thumb(p);
                const sale = p.oldPrice && Number(p.oldPrice) > Number(p.price);
                return (
                  <button key={p.id} onClick={() => onPick(p)} className="bz-sheet-item group flex min-w-0 flex-col overflow-hidden rounded-2xl text-start transition">
                    <span className="bz-sheet-img relative block aspect-square w-full overflow-hidden">
                      {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><BagIcon className="h-6 w-6 opacity-40" /></span>}
                      {sale && <span className="absolute start-1.5 top-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{t('dashboard.instagram.sale')}</span>}
                    </span>
                    <span className="block px-2 pb-2 pt-1.5">
                      <span className="line-clamp-2 block text-[11.5px] font-semibold leading-snug">{p.name}</span>
                      <span className="mt-0.5 block text-[12px] font-extrabold tabular-nums">₪{Number(p.price).toFixed(0)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════ مقياسٌ للتشخيص ═════════
// يُفتَحُ بثلاثِ نقراتٍ على صورةِ الزبونِ في الرأس. سببُه أنّ وصفَ «يتقطّع» لا يكفي
// لتحديدِ المكان: الأرقامُ تفصلُ بين ثلاثِ عللٍ مختلفةٍ تماماً —
//   fps منخفضٌ مع مهامٍّ طويلة  → جافاسكربت يشغلُ الخيطَ الرئيسيّ.
//   fps عالٍ والسحبُ يبدو ثقيلاً → المسألةُ في مسارِ اللمسِ لا في الرسم.
//   move/s كبيرٌ باللمسةِ الواحدةِ وصفرٌ بالاثنتين → مستمعُ لمسٍ يعترضُ الطريق.
function PerfHud() {
  const [s, setS] = useState({ fps: 0, moves: 0, long: 0, longMax: 0 });
  useEffect(() => {
    let frames = 0, moves = 0, long = 0, longMax = 0, raf = 0, stopped = false;
    const tick = () => { frames += 1; if (!stopped) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const onMove = () => { moves += 1; };
    document.addEventListener('touchmove', onMove, { passive: true });
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) { long += 1; longMax = Math.max(longMax, Math.round(e.duration)); }
      });
      po.observe({ entryTypes: ['longtask'] });
    } catch { /* غير مدعوم على سفاري القديم */ }
    const timer = setInterval(() => {
      setS({ fps: frames, moves, long, longMax });
      frames = 0; moves = 0;
    }, 1000);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      document.removeEventListener('touchmove', onMove);
      if (po) po.disconnect();
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),8px)] z-[120] mx-auto w-fit rounded-full bg-black/75 px-3 py-1 font-mono text-[11px] text-white" dir="ltr">
      fps {s.fps} · move/s {s.moves} · long {s.long}/{s.longMax}ms
    </div>
  );
}

export default function InstagramChat() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshCount } = useNotifications();
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // محادثةٌ فُتحت قبلُ تُرسَمُ فوراً ممّا حفظناه، والخادمُ يُحدّثُها فوقَه بصمت
  const [data, setData] = useState(() => cache.getChat(id)); // { conversation, messages }
  const [serverMore, setServerMore] = useState(() => Boolean(cache.getChat(id)?.hasMore)); // عند الخادمِ أقدمُ ممّا جلبنا
  const [text, setTextRaw] = useState(() => readDraft(id));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showConvert, setShowConvert] = useState(false);
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [progress, setProgress] = useState(0);
  const [viewing, setViewing] = useState(null); // { url, kind }
  const dataRef = useRef(null);
  dataRef.current = data;
  const [quick, setQuick] = useState([]);
  const [editQuick, setEditQuick] = useState(false);
  const [newQuick, setNewQuick] = useState('');
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recRef = useRef(null);
  const [hud, setHud] = useState(false);
  const [toast, setToast] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const taps = useRef([]);
  // ثلاثُ نقراتٍ على الصورةِ خلالَ ثانيةٍ تفتحُ المقياسَ وتغلقُه — بابٌ خفيٌّ لأنّه
  // للتشخيصِ لا للتاجرة، ولا يحتاجُ عنوانَ صفحةٍ يُكتَبُ في تطبيقٍ بلا شريطِ عنوان.
  const tapAvatar = () => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((x) => now - x < 1000);
    if (taps.current.length >= 3) { taps.current = []; setHud((v) => !v); }
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  };

  // فتحُ المحادثةِ يُطفئُ إشعارَها: الخادمُ يقرؤه ويُعيدُ العددَ الجديد، فنحدّثُ الجرسَ
  // والشارة، ونُغلقُ إشعارتَها من شريطِ الهاتفِ أيضاً.
  const afterRead = (badge, always = false) => {
    const changed = badge !== null && badge !== undefined;
    if (changed) refreshCount();
    if (changed || always) clearDelivered(`ig-${id}`, `/dashboard/instagram/${id}`);
  };

  const load = () => {
    setError('');
    return api.get(`/instagram/conversations/${id}/messages`)
      .then((r) => {
        // ما كتبَتْه التاجرةُ في الأثناءِ (والمحفوظُ معروضٌ) يبقى فوقَ ما جاء
        setData((d) => ({
          ...r.data,
          messages: [...(r.data?.messages || []), ...((d?.messages || []).filter((m) => String(m.id).startsWith('tmp-')))],
        }));
        setServerMore(Boolean(r.data?.hasMore));
        cache.markConvRead(id);
        afterRead(r.data?.badge, true);
      })
      .catch((e) => setError(getErrorMessage(e)));
  };
  // كلُّ ما وصلَ من الخادمِ يُحفَظُ لفتحةِ المحادثةِ القادمة
  useEffect(() => {
    if (data) cache.setChat(id, { ...data, hasMore: serverMore });
  }, [data, serverMore]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setData(cache.getChat(id));
    setServerMore(Boolean(cache.getChat(id)?.hasMore));
    setTextRaw(readDraft(id));
    setReplyTo(null);
    setLimit(40);
    lastSeenId.current = null;
    mounted.current = null;
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // كلُّ نشرةِ كودٍ تُعيدُ تشغيلَ الخادم، وخلالَها تبقى الطلباتُ معلّقةً نحوَ نصفِ
  // دقيقة. ودوّامةٌ صامتةٌ طوالَ ذلك تبدو عطلاً دائماً لا انتظاراً مؤقّتاً — فبعد ثمانِ
  // ثوانٍ نقولُ ما يجري ونعرضُ زرَّ إعادةِ المحاولة.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (data) { setSlow(false); return undefined; }
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [data, id]);

  // الردودُ الجاهزةُ تخصُّ المتجرَ لا الجهاز، فتُحفَظُ عند الخادمِ وتتبعُ صاحبتَها
  // إلى أيِّ هاتفٍ فتحت منه.
  useEffect(() => {
    api.get('/instagram/quick-replies')
      .then((r) => setQuick(Array.isArray(r.data?.replies) ? r.data.replies : []))
      .catch(() => {});
  }, []);
  const saveQuick = async (list) => {
    setQuick(list);
    try { await api.put('/instagram/quick-replies', { replies: list }); }
    catch (e) { setError(getErrorMessage(e)); }
  };
  const addQuick = () => {
    const v = newQuick.trim();
    if (!v) return;
    setNewQuick('');
    saveQuick([...quick, v].slice(0, 20));
  };

  // ═════════ الإرسال: طابورٌ لا قفل ═════════
  // كان الإرسالُ يقفلُ الصندوقَ حتّى يعودَ الخادم، فالتاجرةُ التي تكتبُ ثلاثَ رسائلَ
  // متتاليةً تنتظرُ بين كلِّ واحدةٍ وأختِها. صارت كلُّ رسالةٍ تظهرُ فوراً بساعةٍ صغيرة،
  // وتُرسَلُ بالترتيبِ من طابور، والفاشلةُ تبقى في مكانِها بزرِّ «إعادة» بدل أن تختفي.
  const queue = useRef(Promise.resolve());
  const inflight = useRef(0);
  const patchMsg = (tmpId, patch) => setData((d) => (d ? {
    ...d,
    messages: (d.messages || []).map((m) => (m.id === tmpId ? { ...m, ...patch } : m)),
  } : d));
  const deliver = (tmpId, payload) => {
    inflight.current += 1;
    queue.current = queue.current.then(async () => {
      patchMsg(tmpId, { status: 'sending' });
      try {
        await api.post(`/instagram/conversations/${id}/reply`, payload);
        patchMsg(tmpId, { status: 'sent' });
      } catch (e) {
        const msg = getErrorMessage(e);
        patchMsg(tmpId, { status: 'failed', error: msg });
        setError(msg);
      } finally {
        inflight.current -= 1;
      }
    });
  };
  const retry = (m) => {
    setError('');
    deliver(m.id, m.payload);
  };
  const discard = (m) => setData((d) => ({ ...d, messages: (d?.messages || []).filter((x) => x.id !== m.id) }));

  // ═════════ التحديثُ اللحظيّ ═════════
  // نسألُ الخادمَ عمّا **بعدَ** آخرِ رسالةٍ عندنا فقط (لا المحادثةَ كلَّها)، ونتوقّفُ
  // حين يغيبُ التطبيقُ عن الشاشة — فلا سؤالَ ولا بطاريّةَ تُستهلَكُ وهو في الجيب.
  // ولا نسألُ أثناءَ الإرسال: الرسالةُ التفاؤليّةُ ما زالت بلا رقمٍ من الخادم.
  const pace = useRef(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden || inflight.current > 0 || !dataRef.current) return;
      const msgs = dataRef.current?.messages || [];
      const last = msgs.filter((m) => !String(m.id).startsWith('tmp-')).slice(-1)[0];
      try {
        // بلا رسالةٍ سابقةٍ لا معنى لـ`after`: نجلبُ المحادثةَ كاملةً — وإلّا بقيت
        // المحادثةُ الفارغةُ فارغةً أبداً ولو وصلتها رسالة.
        const r = await api.get(`/instagram/conversations/${id}/messages`,
          last ? { params: { after: last.created_at } } : undefined);
        if (stop) return;
        afterRead(r.data?.badge);
        const fresh = r.data?.messages || [];
        if (!fresh.length) { pace.current?.slacken(); return; }
        pace.current?.quicken();
        setData((d) => {
          const have = new Set((d?.messages || []).map((m) => m.id));
          const add = fresh.filter((m) => !have.has(m.id));
          if (!add.length) return d;
          // نُسقطُ التفاؤليّاتِ التي وصلت فعلاً وعادت من الخادم — بنصِّها أو بمرفقِها —
          // وإلّا ظهرت مرّتين. الفاشلةُ تبقى: لم تصل أصلاً.
          const outTexts = new Set(add.filter((m) => m.direction === 'out' && m.text).map((m) => m.text));
          const outMedia = new Set(add.filter((m) => m.direction === 'out' && m.attachment_url).map((m) => m.attachment_url));
          const kept = (d?.messages || []).filter((m) => {
            if (!String(m.id).startsWith('tmp-') || m.status === 'failed') return true;
            if (m.attachment_url) return !outMedia.has(m.attachment_url);
            return !outTexts.has(m.text || '');
          });
          return { ...d, conversation: r.data?.conversation || d.conversation, messages: [...kept, ...add] };
        });
      } catch { /* شبكةٌ متقطّعة — نُعيد في النبضةِ التالية */ }
    };
    // نبضةٌ تتراجع: ستُّ ثوانٍ ما دام هناك جديد، وتتباعدُ حتّى نصفِ دقيقةٍ حين
    // يهدأُ الحديث — أربعُ ثوانٍ ثابتةً كانت تبلغُ حدَّ الطلباتِ فيردُّ الخادمُ ٤٢٩.
    let gap = 6000;
    let timer = setTimeout(function run() {
      tick();
      timer = setTimeout(run, gap);
    }, gap);
    const quicken = () => { gap = 6000; };
    const slacken = () => { gap = Math.min(30000, Math.round(gap * 1.5)); };
    pace.current = { quicken, slacken };
    // نبضاتُ التحديثِ تقولُ للخادم «التاجرةُ على هذه المحادثة» فلا يبعثُ إشعاراً برسالةٍ
    // تراها أمامَها. وحين تغادرُها أو تُخفي التطبيقَ نقولُها صراحةً، فتعودُ الإشعاراتُ
    // فوراً بدل انتظارِ انقضاءِ المهلةِ على الخادم.
    const leave = () => { api.post(`/instagram/conversations/${id}/leave`).catch(() => {}); };
    const onVisible = () => {
      if (document.hidden) leave();
      else { quicken(); tick(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible);
      leave();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // لوحةُ المفاتيح تُقلّصُ النافذةَ المرئيّةَ ولا تُقلّصُ inset-0، فيغرقُ صندوقُ الكتابةِ
  // تحتها. الحسابُ حشوةٌ سفليّةٌ بقدرِ ما تحجبُه اللوحة لا ضبطُ ارتفاعِ الشاشة: أيُّ
  // قياسٍ خاطئٍ أو حدثٍ ضائعٍ (كالعودةِ من الخلفيّة) كان يتركُ الشاشةَ منكمشةً في أعلى
  // الجهاز. أسوأُ ما يقعُ الآن عند خطأِ القياسِ حشوةٌ زائدةٌ لا انهيارُ تخطيط.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = rootRef.current;
    if (!vv || !el) return undefined;
    let raf = 0;
    let last = -1;
    const apply = () => {
      raf = 0;
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      if (kb === last) return;
      last = kb;
      el.style.paddingBottom = kb ? `${kb}px` : '';
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    // ومرّةً ثانيةً بعد ثلثِ ثانية: عند العودةِ من الخلفيّةِ تكونُ قياساتُ iOS عابرةً
    // في اللحظةِ الأولى، فتبقى حشوةٌ لا لوحةَ تحتَها حتّى تُلمَسَ الشاشة.
    const scheduleTwice = () => { schedule(); setTimeout(schedule, 300); };
    apply();
    vv.addEventListener('resize', schedule);
    window.addEventListener('focus', scheduleTwice);
    document.addEventListener('visibilitychange', scheduleTwice);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('resize', schedule);
      window.removeEventListener('focus', scheduleTwice);
      document.removeEventListener('visibilitychange', scheduleTwice);
      el.style.paddingBottom = '';
    };
  }, []);

  // الصنفُ يُخفي شريطَ التبويباتِ السفليَّ ويمنعُ الصفحةَ تحتَنا من التمرير — وبلا
  // المنعِ كان هيدرُ الموقعِ يظهرُ من فوقِ المحادثةِ كلّما تحرّكت الصفحةُ خلفَها.
  useEffect(() => {
    document.body.classList.add('bz-chat-open');
    return () => document.body.classList.remove('bz-chat-open');
  }, []);

  // لا نرسمُ المحادثةَ كلَّها: مئتا رسالةٍ تعني مئتَي عنصرٍ في الصفحة، وهاتفٌ متوسّطٌ
  // يتقطّعُ سحبُه تحتها. نرسمُ الأحدثَ فقط ونُنزلُ الأقدمَ بطلبٍ صريح. والزرُّ صريحٌ
  // لا تحميلٌ عند بلوغِ الأعلى، لأنّ الإدراجَ في الأعلى أثناءَ السحبِ يقفزُ بالمكان.
  const [limit, setLimit] = useState(40);
  // صفوفٌ قديمةٌ حُفظت بلا نصٍّ ولا مرفقٍ (قبل أن نمنعَ ذلك) تظهرُ فقاعاتٍ فارغة
  const all = useMemo(
    () => (data?.messages || []).filter((m) => (m.text || '').trim() || m.attachment_url),
    [data?.messages],
  );
  const shown = useMemo(() => (limit >= all.length ? all : all.slice(all.length - limit)), [all, limit]);
  const hasOlder = all.length > shown.length || serverMore;
  const items = useMemo(() => buildItems(shown), [shown]);

  // خريطةُ المعرّفاتِ لعرضِ المقتبَس: الردُّ يحملُ معرّفَ المردودِ عليه لا نصَّه.
  const byMid = useMemo(() => {
    const map = new Map();
    for (const m of all) if (m.mid) map.set(m.mid, m);
    return map;
  }, [all]);

  // ═════════ التمرير ═════════
  // آخرُ رسالةٍ هي المقصودةُ عند الفتحِ وبعد كلِّ إرسال. لكن رسالةُ الزبونِ الجديدةُ
  // لا تسحبُ الشاشةَ من تحتِ تاجرةٍ تقرأُ رسائلَ أقدم: يظهرُ لها زرُّ «رسائل جديدة»
  // بعددِها، وتنزلُ حين تشاء.
  const atBottom = useRef(true);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (near !== atBottom.current) {
      atBottom.current = near;
      setAway(!near);
      if (near) setUnseen(0);
    }
  };
  const toBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnseen(0);
  };
  const lastSeenId = useRef(null);
  useLayoutEffect(() => {
    const last = all[all.length - 1];
    if (!last) return;
    const prev = lastSeenId.current;
    if (prev === last.id) return;
    lastSeenId.current = last.id;
    if (prev === null) { toBottom(false); return; }
    // ما بعدَ آخرِ ما رأيناه هو الجديد: الإدراجُ في الأعلى (رسائلُ أقدم) لا يغيّرُ الأخيرة
    const idx = all.findIndex((m) => m.id === prev);
    const added = idx >= 0 ? all.slice(idx + 1) : [last];
    const mine = added.some((m) => m.direction === 'out' && String(m.id).startsWith('tmp-'));
    if (mine || atBottom.current) toBottom(true);
    else setUnseen((n) => n + added.filter((m) => m.direction === 'in').length);
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps

  // إنزالُ الأقدمِ يُبقي ما تقرؤه في مكانِه: نقيسُ الطولَ قبلَ الزيادةِ وبعدَها ونعوّضُ
  // الفرق، وإلّا قفزت الشاشةُ إلى أوّلِ المحادثةِ فجأة.
  const keepScroll = useRef(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadOlder = async () => {
    const el = scrollRef.current;
    keepScroll.current = el ? el.scrollHeight - el.scrollTop : 0;
    if (all.length > shown.length) { setLimit((n) => n + 60); return; }
    // ما في اليدِ نفدَ — نسألُ الخادمَ عن الصفحةِ التي قبلَه
    const first = all.find((m) => !String(m.id).startsWith('tmp-'));
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const r = await api.get(`/instagram/conversations/${id}/messages`, { params: { before: first.created_at } });
      const older = r.data?.messages || [];
      setServerMore(Boolean(r.data?.hasMore));
      setData((d) => {
        const have = new Set((d?.messages || []).map((m) => m.id));
        return { ...d, messages: [...older.filter((m) => !have.has(m.id)), ...(d?.messages || [])] };
      });
      setLimit((n) => n + older.length);
    } catch (e) {
      keepScroll.current = 0;
      setError(getErrorMessage(e));
    } finally {
      setLoadingOlder(false);
    }
  };
  // بعد أن يرسمَ React الزيادةَ فعلاً — لا في الإطارِ التالي رجماً بالغيب
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !keepScroll.current) return;
    el.scrollTop = el.scrollHeight - keepScroll.current;
    keepScroll.current = 0;
  }, [limit, all.length]);

  // الضغطُ على المقتبَسِ يأخذُ إلى الرسالةِ الأصليّةِ ويُومضُها — كما في إنستغرام.
  const [flashId, setFlashId] = useState('');
  const jumpTo = (mid) => {
    const target = byMid.get(mid);
    if (!target) return;
    const go = () => {
      const el = scrollRef.current?.querySelector(`[data-msg="${CSS.escape(String(target.id))}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFlashId(target.id);
      setTimeout(() => setFlashId(''), 1400);
    };
    if (!shown.some((m) => m.id === target.id)) {
      setLimit(all.length);
      requestAnimationFrame(() => requestAnimationFrame(go));
    } else {
      go();
    }
  };

  // ردٌّ على رسالةٍ بعينِها، وتفاعلٌ عليها، ونسخُها.
  const [activeId, setActiveId] = useState('');
  const openedAt = useRef(0);
  const [replyTo, setReplyTo] = useState(null); // { mid, text, out }

  const react = async (m) => {
    if (!m.mid) return;
    const next = m.reaction ? '' : 'love';
    setActiveId('');
    setData((d) => ({
      ...d,
      messages: (d?.messages || []).map((x) => (x.id === m.id ? { ...x, reaction: next } : x)),
    }));
    if (next && navigator.vibrate) navigator.vibrate(8);
    try {
      await api.post(`/instagram/conversations/${id}/react`, { mid: metaMid(m.mid), reaction: next });
    } catch (e) {
      setError(getErrorMessage(e));
      setData((d) => ({
        ...d,
        messages: (d?.messages || []).map((x) => (x.id === m.id ? { ...x, reaction: m.reaction || '' } : x)),
      }));
    }
  };

  // نصٌّ مختصرٌ للمقتبَس: المرفقُ بلا نصٍّ يُوصَفُ بكلمةٍ بدل أن يظهرَ فارغاً
  const quoteText = (m) => {
    const body = (m?.text || '').trim();
    if (body) return body;
    if (!m?.attachment_url) return '…';
    const k = mediaKind(m.attachment_url, m.attachment_type);
    return k === 'audio' ? `🎤 ${t('dashboard.instagram.voice')}` : k === 'video' ? '🎬' : '📷';
  };

  const startReply = (m) => {
    if (!m.mid) return;
    setReplyTo({ mid: metaMid(m.mid), text: quoteText(m), out: m.direction === 'out' });
    setActiveId('');
    inputRef.current?.focus();
  };

  const copy = async (m) => {
    setActiveId('');
    try {
      await navigator.clipboard.writeText(m.text || m.attachment_url || '');
      flash(t('dashboard.instagram.copied'));
    } catch { /* المتصفّحُ رفض */ }
  };

  // الضغطةُ المطوّلةُ تفتحُ لوحةَ الرسالة، والنقرتانِ تضعان ❤️، والسحبُ جانباً يردُّ
  // عليها — الإيماءاتُ الثلاثُ التي اعتادتها يدُ من يستعملُ إنستغرام. والضغطةُ العابرةُ
  // لا تفعلُ شيئاً: كانت تفتحُ اللوحةَ بالخطأ كلّما لمستَ الشاشةَ وأنت تقرأ.
  const pressTimer = useRef(0);
  const lastTap = useRef({ id: '', at: 0 });
  const touched = useRef(false);
  const touchReset = useRef(0);
  const swipe = useRef(null);
  const SWIPE_AT = 56;
  const pressProps = (m) => {
    const skip = (e) => Boolean(e.target.closest('button, a, video, audio'));
    const start = (e) => {
      if (skip(e)) return;
      clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        setActiveId(m.id);
        openedAt.current = Date.now();
        lastTap.current = { id: '', at: 0 };
        if (navigator.vibrate) navigator.vibrate(10);
      }, 420);
    };
    // النقرتانِ نحسبُهما بأنفسِنا: `dblclick` على iOS غيرُ موثوقٍ مع اللمس.
    const tapEnd = (e) => {
      clearTimeout(pressTimer.current);
      if (skip(e)) return;
      const now = Date.now();
      if (lastTap.current.id === m.id && now - lastTap.current.at < 320) {
        lastTap.current = { id: '', at: 0 };
        react(m);
      } else {
        lastTap.current = { id: m.id, at: now };
      }
    };
    const endSwipe = () => {
      const s = swipe.current;
      swipe.current = null;
      if (!s || s.lock !== 'x') return false;
      s.el.style.transition = 'transform 0.18s ease-out';
      s.el.style.transform = '';
      if (Math.abs(s.dx) >= SWIPE_AT) startReply(m);
      return true;
    };
    return {
      onTouchStart: (e) => {
        touched.current = true;
        clearTimeout(touchReset.current);
        // نُعيدُ السماحَ للفأرةِ بعد ثانية: جهازٌ يحملُ لمساً وفأرةً معاً كان يفقدُ
        // الفأرةَ إلى الأبدِ بعد أوّلِ لمسة.
        touchReset.current = setTimeout(() => { touched.current = false; }, 1000);
        const tp = e.touches[0];
        swipe.current = m.mid && !skip(e)
          ? { el: e.currentTarget, x0: tp.clientX, y0: tp.clientY, dx: 0, lock: null, buzzed: false }
          : null;
        start(e);
      },
      // السحبُ يحرّكُ الفقاعةَ مباشرةً بالأسلوب لا بالحالة: لا إعادةَ رسمٍ مع كلِّ إطار.
      onTouchMove: (e) => {
        clearTimeout(pressTimer.current);
        const s = swipe.current;
        if (!s) return;
        const tp = e.touches[0];
        const dx = tp.clientX - s.x0;
        const dy = tp.clientY - s.y0;
        if (!s.lock && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) s.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
        if (s.lock !== 'x') return;
        s.dx = Math.max(-80, Math.min(80, dx));
        s.el.style.transition = 'none';
        s.el.style.transform = `translateX(${s.dx}px)`;
        if (!s.buzzed && Math.abs(s.dx) >= SWIPE_AT) { s.buzzed = true; if (navigator.vibrate) navigator.vibrate(8); }
      },
      onTouchEnd: (e) => { if (!endSwipe()) tapEnd(e); else clearTimeout(pressTimer.current); },
      onTouchCancel: () => { endSwipe(); clearTimeout(pressTimer.current); },
      onMouseDown: (e) => { if (!touched.current) start(e); },
      onMouseUp: (e) => { if (!touched.current) tapEnd(e); },
      onMouseLeave: () => clearTimeout(pressTimer.current),
      onContextMenu: (e) => e.preventDefault(),
    };
  };

  // «منذ كم» ومهلةُ الردِّ تتجمّدان على رقمِهما ما لم يُعَد الرسم: نبضةٌ كلَّ دقيقة.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  // «منذ كم» بالعربيّة: الساعةُ وحدَها لا تقولُ كم مضى، والفارقُ هو المقصود.
  const relTime = (iso) => {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return t('dashboard.instagram.justNow');
    if (min < 60) return t('dashboard.instagram.minsAgo', { count: min });
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return t('dashboard.instagram.hoursAgo', { count: hrs });
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  // ما قاله الزبونُ نفسُه: منه نلتقطُ رقمَه ومنتجاتِه ومكانَه لنملأَ نموذجَ الطلب.
  // كلامُ التاجرةِ لا يدخلُ هنا — رقمُها هي ليس رقمَ الزبون.
  const custText = useMemo(
    () => all.filter((m) => m.direction === 'in').map((m) => m.text || '').join(' \n '),
    [all],
  );
  const guessedPhone = useMemo(() => findMobile(custText), [custText]);

  // مهلةُ الردّ: تُرى قبلَ الكتابةِ لا بعد رفضِ الرسالة.
  const win = replyWindow(lastInboundAt(all));
  const winHours = Math.floor(win.msLeft / 3600000);
  const winMins = Math.max(1, Math.ceil((win.msLeft % 3600000) / 60000));

  // الحركةُ للرسالةِ الجديدةِ وحدَها: تشغيلُ مئةِ حركةٍ دفعةً واحدةً عند الفتحِ ثقيلٌ
  // بلا فائدة — فلا أحدَ ينتظرُ ظهورَ رسالةٍ عمرُها يومان.
  const mounted = useRef(null);
  if (mounted.current === null && all.length) mounted.current = new Set(all.map((m) => m.id));
  const isNew = (mid) => Boolean(mounted.current && !mounted.current.has(mid));

  // الكتابة: المسودّةُ تُحفَظ، و«عم تكتب…» تصلُ الزبونَ مرّةً كلَّ ثماني ثوانٍ على
  // الأكثر — إشارةٌ تطمئنُه أنّ أحداً يردّ، لا سيلُ طلباتٍ مع كلِّ حرف.
  const lastTyping = useRef(0);
  const setText = (v) => {
    setTextRaw(v);
    writeDraft(id, v);
    if (v.trim() && win.open && Date.now() - lastTyping.current > 8000) {
      lastTyping.current = Date.now();
      api.post(`/instagram/conversations/${id}/typing`, { on: true }).catch(() => {});
    }
  };

  // الصندوقُ يكبرُ مع النصِّ حتّى خمسةِ أسطرٍ ثمّ يُمرَّر — سطرٌ واحدٌ ثابتٌ كان يُخفي
  // ما كُتب فوقَه في الرسائلِ الطويلة.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text, recording]);

  const pick = (file) => {
    if (!file) return;
    setError('');
    setPhoto((old) => {
      if (old?.preview) URL.revokeObjectURL(old.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  };
  const dropPhoto = () => setPhoto((old) => {
    if (old?.preview) URL.revokeObjectURL(old.preview);
    return null;
  });

  // لصقُ صورةٍ في الصندوقِ يُرفقُها — من لقطةِ شاشةٍ أو صورةٍ منسوخة.
  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file && cloudinaryEnabled) { e.preventDefault(); pick(file); }
  };

  const enqueue = (msg, payload) => {
    setData((d) => ({ ...d, messages: [...(d?.messages || []), { ...msg, status: 'sending', payload }] }));
    deliver(msg.id, payload);
  };

  // ═════════ رسالةٌ صوتيّة ═════════
  // تُسجَّلُ في المتصفّح، تُرفَعُ (إنستغرام تطلبُ رابطاً عامّاً تجلبُه بنفسِها، لا ملفّاً
  // نرسلُه)، ثمّ تُرسَلُ مرفقاً من نوع audio — ولو أُرسلت صورةً رُفضت.
  const startRec = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        clearInterval(recRef.current?.timer);
        setRecording(false);
        setRecSecs(0);
        if (!recRef.current?.keep || !chunks.length) return;
        const type = mr.mimeType || 'audio/mp4';
        const ext = type.includes('webm') ? 'webm' : 'm4a';
        const file = new File([new Blob(chunks, { type })], `voice.${ext}`, { type });
        setUploading(true);
        try {
          // إنستغرام لا تقبلُ webm: المحرّكُ يحوّلُه MP3 على الخادم، وكلاوديناري بتحويلِ الرابط
          const raw = await uploadMedia(file, 'audio', setProgress);
          if (!raw) throw new Error(t('video.noUploader'));
          const url = cldAudioMp3(raw);
          enqueue(
            { id: `tmp-aud-${Date.now()}`, direction: 'out', text: '', attachment_url: url, attachment_type: 'audio', created_at: new Date().toISOString() },
            { attachmentUrl: url, attachmentType: 'audio' },
          );
        } catch (e) {
          setError(getErrorMessage(e));
        } finally {
          setUploading(false); setProgress(0);
        }
      };
      recRef.current = { mr, keep: false, timer: setInterval(() => setRecSecs((v) => v + 1), 1000) };
      mr.start();
      setRecSecs(0);
      setRecording(true);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  const stopRec = (keep) => {
    if (!recRef.current?.mr) return;
    recRef.current.keep = keep;
    try { recRef.current.mr.stop(); } catch { /* أُوقف مسبقاً */ }
  };

  // المنتجُ المختارُ: الخادمُ يُجهّزُ صورةً تقبلُها ميتا وسطرَ الاسمِ والسعرِ والرابط،
  // ثمّ يمضيانِ في طابورِ الإرسالِ كأيِّ رسالةٍ فيظهرانِ فوراً بحالتِهما.
  const sendProduct = async (p) => {
    setShowProducts(false);
    setPreparing(true);
    setError('');
    try {
      const r = await api.post('/instagram/product-card', { productId: p.id });
      const stamp = Date.now();
      const now = new Date().toISOString();
      if (r.data?.image) {
        enqueue(
          { id: `tmp-pimg-${stamp}`, direction: 'out', text: '', attachment_url: r.data.image, attachment_type: 'image', created_at: now },
          { attachmentUrl: r.data.image },
        );
      }
      if (r.data?.text) {
        enqueue(
          { id: `tmp-ptxt-${stamp}`, direction: 'out', text: r.data.text, created_at: now },
          { text: r.data.text },
        );
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPreparing(false);
    }
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !photo) || uploading) return;
    setError('');

    // الصورةُ تُرفَعُ أوّلاً لأنّ إنستغرام تطلبُ رابطاً عامّاً تجلبُه بنفسها. وفشلُ الرفعِ
    // يوقفُ كلَّ شيءٍ قبل أن نُظهرَ رسالةً لم تُرسَل.
    let uploaded = '';
    if (photo) {
      setUploading(true);
      try {
        setProgress(1);
        // jpeg إجباريّ: ميتا تجلبُ المرفقَ بنفسها ولا تقبلُ WebP
        uploaded = await uploadMedia(photo.file, 'image', setProgress, { jpeg: true });
        if (!uploaded) throw new Error(t('video.noUploader'));
      } catch (e) {
        setError(getErrorMessage(e));
        setUploading(false); setProgress(0);
        return;
      }
      setUploading(false); setProgress(0);
    }

    const stamp = Date.now();
    const now = new Date().toISOString();
    const reply = replyTo?.mid || '';
    setTextRaw(''); writeDraft(id, ''); dropPhoto(); setReplyTo(null);
    if (uploaded) {
      enqueue(
        { id: `tmp-img-${stamp}`, direction: 'out', text: '', attachment_url: uploaded, attachment_type: 'image', created_at: now },
        { attachmentUrl: uploaded },
      );
    }
    if (body) {
      enqueue(
        { id: `tmp-txt-${stamp}`, direction: 'out', text: body, reply_to_mid: reply, created_at: now },
        { text: body, replyToMid: reply },
      );
    }
    inputRef.current?.focus();
  };

  const c = data?.conversation || {};
  const name = c.customer_name || (c.customer_username ? `@${c.customer_username}` : t('dashboard.instagram.customer'));
  const converted = Boolean(c.order_id);
  const messenger = c.channel === 'messenger';
  const seenAt = c.seen_at;
  // آخرُ رسالةٍ صادرةٍ وصلت الخادم — تحتَها وحدَها تُكتَبُ «شوهدت»
  const lastOutId = useMemo(() => {
    for (let i = all.length - 1; i >= 0; i -= 1) if (all[i].direction === 'out') return all[i].id;
    return '';
  }, [all]);
  const dayLabel = (at) => {
    const today = new Date();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    if (sameDay(at, today)) return t('common.today', { defaultValue: locale === 'ar' ? 'اليوم' : 'Today' });
    if (sameDay(at, yest)) return t('common.yesterday', { defaultValue: locale === 'ar' ? 'أمس' : 'Yesterday' });
    return at.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const timeOf = (m) => new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // «/» في أوّلِ الصندوقِ تفتحُ الردودَ الجاهزةَ مصفّاةً بما يُكتَبُ بعدَها
  const slash = matchQuick(quick, text);
  const canSend = Boolean(text.trim() || photo) && !uploading;

  // ضغطةٌ في أيِّ مكانٍ خارجَ لوحةِ الرسالةِ تغلقُها. ونتجاهلُ النقرةَ التي تلي الضغطةَ
  // المطوّلةَ نفسَها، وإلّا فُتحت اللوحةُ وأُغلقت في اللحظةِ ذاتِها.
  const onScrollAreaClick = (e) => {
    if (!activeId || Date.now() - openedAt.current < 500) return;
    if (!e.target.closest('[data-panel]')) setActiveId('');
  };

  return createPortal(
    <div ref={rootRef} className="bz-chat fixed inset-0 z-[95] flex flex-col">
      {/* رأسُ المحادثة */}
      <header className="bz-chat-bar flex shrink-0 items-center gap-2.5 border-b px-2 pb-2 pt-[max(env(safe-area-inset-top),10px)]">
        <button onClick={() => navigate('/dashboard?tab=instagram')} className="bz-chat-icon rounded-full p-2 transition" aria-label={t('common.back')}>
          <BackIcon className="h-5 w-5" />
        </button>
        <button type="button" onClick={tapAvatar} className="relative shrink-0" aria-hidden>
          <Avatar url={c.customer_avatar} name={name} className="h-10 w-10 text-xs" />
          {data && (
            <span className={`bz-chat-chan absolute -bottom-0.5 -end-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ${messenger ? 'bz-chan-fb' : 'bz-chan-ig'}`}>
              {messenger ? <FacebookIcon className="h-2.5 w-2.5" /> : <InstagramIcon className="h-2.5 w-2.5" />}
            </span>
          )}
        </button>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-bold">{name}</span>
          <span className="bz-chat-muted flex items-center gap-1 truncate text-[11px]">
            {c.customer_username
              ? <span dir="ltr" className="truncate">@{c.customer_username}</span>
              : <span>{messenger ? t('dashboard.instagram.messenger') : t('dashboard.instagram.instagram')}</span>}
          </span>
        </span>
        {c.customer_username && !messenger && (
          <a
            href={`https://instagram.com/${encodeURIComponent(c.customer_username)}`}
            target="_blank"
            rel="noreferrer"
            className="bz-chat-icon shrink-0 rounded-full p-2 transition"
            title={t('dashboard.instagram.openProfile')}
            aria-label={t('dashboard.instagram.openProfile')}
          >
            <InstagramIcon className="h-5 w-5" />
          </a>
        )}
        {converted ? (
          <span className="bz-chat-ok shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">{t('dashboard.instagram.hasOrder')}</span>
        ) : (
          <button onClick={() => setShowConvert((v) => !v)} className="btn-primary shrink-0 !gap-1 !rounded-full !px-3 !py-1.5 text-xs">
            <BagIcon className="h-4 w-4" /> {showConvert ? t('common.cancel') : t('dashboard.instagram.toOrder')}
          </button>
        )}
      </header>

      {/* مهلةُ الرد: تحذيرٌ حين تقتربُ نهايتُها، وشرحٌ حين تنتهي — بدل رسالةٍ تُرفَضُ بلا تفسير */}
      {data && win.known && (!win.open || win.msLeft < 4 * 3600000) && (
        <div className={`flex shrink-0 items-center gap-2 px-3 py-2 text-[11.5px] font-semibold ${win.open ? 'bz-chat-warn' : 'bz-chat-err'}`}>
          {win.open ? <ClockIcon className="h-4 w-4 shrink-0" /> : <WarnIcon className="h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1 leading-snug">
            {win.open
              ? t('dashboard.instagram.windowLeft', {
                time: winHours > 0
                  ? t('dashboard.instagram.hoursShort', { count: winHours })
                  : t('dashboard.instagram.minShort', { count: winMins }),
              })
              : t('dashboard.instagram.windowClosed')}
          </span>
        </div>
      )}

      {data && <CustomerStrip phone={c.order_phone || guessedPhone} />}

      {showConvert && !converted && (
        <div className="bz-chat-bar max-h-[60%] shrink-0 overflow-y-auto border-b">
          <ConvertForm
            convId={id}
            defaultName={c.customer_name || ''}
            defaultPhone={guessedPhone}
            hintText={custText}
            onDone={(orderId) => { setShowConvert(false); setData((d) => ({ ...d, conversation: { ...d.conversation, order_id: orderId } })); }}
          />
        </div>
      )}

      {/* الرسائل */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          onClick={onScrollAreaClick}
          className="bz-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3"
        >
          {!data ? (
            <div className="my-auto flex flex-col items-center gap-3">
              <Spinner />
              {slow && (
                <>
                  <p className="bz-chat-muted max-w-[16rem] text-center text-xs leading-relaxed">
                    {t('dashboard.instagram.waking')}
                  </p>
                  <button onClick={load} className="bz-chat-day rounded-full px-4 py-1.5 text-[11px] font-semibold">
                    {t('common.retry', { defaultValue: 'إعادة المحاولة' })}
                  </button>
                </>
              )}
            </div>
          ) : items.length === 0 ? (
            <div className="my-auto flex flex-col items-center gap-3 text-center">
              <Avatar url={c.customer_avatar} name={name} className="h-20 w-20 text-2xl" />
              <p className="text-base font-bold">{name}</p>
              <p className="bz-chat-muted text-sm">{t('dashboard.instagram.noMessages')}</p>
            </div>
          ) : (
            <div className="mt-auto">
              {/* بطاقةُ التعريفِ في أوّلِ المحادثة: من هذا ومن أين — كما يفتحُ إنستغرام كلَّ محادثة */}
              {!hasOlder && (
                <div className="mb-5 mt-2 flex flex-col items-center gap-1.5 text-center">
                  <Avatar url={c.customer_avatar} name={name} className="h-16 w-16 text-xl" />
                  <p className="mt-1 text-[15px] font-bold">{name}</p>
                  {c.customer_username && <p dir="ltr" className="bz-chat-muted text-xs">@{c.customer_username}</p>}
                  <span className="bz-chat-muted inline-flex items-center gap-1 text-[11px]">
                    {messenger ? <FacebookIcon className="h-3 w-3" /> : <InstagramIcon className="h-3 w-3" />}
                    {messenger ? t('dashboard.instagram.messenger') : t('dashboard.instagram.instagram')}
                  </span>
                </div>
              )}
              {hasOlder && (
                <button onClick={loadOlder} disabled={loadingOlder} className="bz-chat-day mx-auto mb-3 flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold disabled:opacity-60">
                  {loadingOlder && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                  {t('dashboard.instagram.older')}
                </button>
              )}
              {items.map((it) => {
                if (it.type === 'day') {
                  return (
                    <div key={it.key} className="my-4 flex justify-center">
                      <span className="bz-chat-day rounded-full px-3 py-1 text-[11px] font-semibold">{dayLabel(it.at)}</span>
                    </div>
                  );
                }
                const m = it.m;
                const out = m.direction === 'out';
                const media = Boolean(m.attachment_url);
                const kind = media ? mediaKind(m.attachment_url, m.attachment_type) : '';
                // الصورةُ والفيديو والملصقُ بلا نصٍّ يُعرَضون بلا فقاعةٍ حولَهم — كما في إنستغرام
                const bare = media && !m.text && kind !== 'audio' && kind !== 'file' && !m.story_url && !(m.reply_to_mid && byMid.get(m.reply_to_mid));
                const failed = m.status === 'failed';
                const sending = m.status === 'sending';
                const quoted = m.reply_to_mid ? byMid.get(m.reply_to_mid) || byMid.get(metaMid(m.reply_to_mid)) : null;
                // زوايا الفقاعةِ داخلَ الدفقة: الطرفُ الملاصقُ لأختِها أقلُّ استدارة
                const shape = out
                  ? `${it.first ? '' : 'bz-join-top-out'} ${it.last ? '' : 'bz-join-bottom-out'}`
                  : `${it.first ? '' : 'bz-join-top-in'} ${it.last ? '' : 'bz-join-bottom-in'}`;
                return (
                  <div
                    key={it.key}
                    data-msg={m.id}
                    className={`flex items-end gap-1.5 ${out ? 'justify-start' : 'justify-end'} ${m.reaction ? 'mb-4' : it.last ? 'mb-2.5' : 'mb-[3px]'}`}
                  >
                    <div className={`flex min-w-0 max-w-[78%] flex-col ${out ? 'items-start' : 'items-end'}`}>
                      <div
                        {...pressProps(m)}
                        className={`bz-swipe relative select-none rounded-[20px] ${shape} ${isNew(m.id) ? 'bz-bubble' : ''} ${flashId === m.id ? 'bz-flash' : ''} ${bare ? 'bz-chat-bare' : `${out ? 'bz-chat-out' : 'bz-chat-in'} ${media ? 'p-1' : 'px-3.5 py-2'}`} ${sending ? 'opacity-70' : ''} ${failed ? 'bz-chat-failed' : ''}`}
                      >
                        {/* ردٌّ على ستوري: صورتُها فوقَ الردّ. بدونها يصلُ «حلوة» بلا ما
                            يقولُ على أيِّ شيءٍ قالها — وهو أكثرُ ما يصلُ من الستوريات. */}
                        {m.story_url && (
                          <button type="button" onClick={() => setViewing({ url: m.story_url, kind: 'image' })} className={`mb-1 flex items-center gap-2 ${media ? 'px-2 pt-1.5' : ''}`}>
                            <img src={cldThumb(m.story_url, 160)} alt="" className="h-16 w-11 rounded-lg object-cover" />
                            <span className="bz-chat-time text-[11px] font-semibold">{t('dashboard.instagram.storyReply')}</span>
                          </button>
                        )}

                        {/* المقتبَس: ردٌّ بلا ما رُدَّ عليه نصفُ كلام. والضغطُ عليه يأخذُ إليه */}
                        {quoted && (
                          <button
                            type="button"
                            onClick={() => jumpTo(quoted.mid)}
                            className={`bz-chat-quote mb-1 block w-full truncate rounded-lg px-2 py-1 text-start text-[11.5px] ${media ? 'mx-1 mt-1 w-[calc(100%-0.5rem)]' : ''}`}
                          >
                            <span className="block text-[10px] font-bold opacity-80">
                              {quoted.direction === 'out' ? t('dashboard.instagram.you') : name}
                            </span>
                            {quoteText(quoted)}
                          </button>
                        )}
                        {media && <Attachment url={m.attachment_url} type={m.attachment_type} out={out} onOpen={setViewing} />}
                        {m.text && <RichText text={m.text} media={media} />}
                        {/* التفاعلُ يجلسُ على حافّةِ الفقاعةِ كما في تطبيقاتِ المحادثة */}
                        {m.reaction && (
                          <span className="bz-chat-react absolute -bottom-3 end-2.5 rounded-full px-1.5 py-0.5 text-[12px] leading-none">❤️</span>
                        )}
                      </div>

                      {/* السطرُ تحت آخرِ الدفقة: الوقتُ، ووسمُ الردِّ الآليّ، وحالةُ الإرسال */}
                      {(it.last || failed) && (
                        <span className={`bz-chat-muted mt-1 flex items-center gap-1 px-1 text-[10.5px] leading-none ${m.reaction ? 'mt-3.5' : ''}`}>
                          {/* ما كتبَتْه البائعةُ الآليّةُ يُوسَمُ صراحةً: بلا الوسمِ تقرأُ التاجرةُ
                              ردّاً لا تذكرُ أنّها كتبَتْه، فلا تعرفُ ما وُعِدَت به زبونتُها. */}
                          {m.ai && <span className="inline-flex items-center gap-1 font-bold"><SparkleIcon className="h-3 w-3" />{t('dashboard.instagram.aiReply')} ·</span>}
                          {failed ? (
                            <span className="bz-chat-fail-text inline-flex items-center gap-1.5 font-semibold">
                              <WarnIcon className="h-3.5 w-3.5" />
                              {t('dashboard.instagram.failed')}
                              <button onClick={() => retry(m)} className="underline underline-offset-2">{t('dashboard.instagram.retry')}</button>
                              <span aria-hidden>·</span>
                              <button onClick={() => discard(m)} className="underline underline-offset-2">{t('common.delete')}</button>
                            </span>
                          ) : (
                            <>
                              <span className="tabular-nums">{timeOf(m)}</span>
                              {out && sending && <ClockIcon className="h-3 w-3" />}
                              {out && m.status === 'sent' && <CheckIcon className="h-3 w-3" />}
                            </>
                          )}
                        </span>
                      )}

                      {/* لوحةُ الرسالة: تُفتَحُ بالضغطةِ المطوّلة */}
                      {activeId === m.id && (
                        <div data-panel className={`bz-chat-panel mt-1.5 flex items-center gap-0.5 rounded-full p-1 ${out ? 'self-start' : 'self-end'}`}>
                          <button onClick={() => startReply(m)} disabled={!m.mid} className="bz-chat-icon inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40">
                            <ReplyIcon className="h-4 w-4" /> {t('dashboard.instagram.reply')}
                          </button>
                          <button onClick={() => react(m)} disabled={!m.mid} className="bz-chat-icon rounded-full px-2.5 py-1.5 text-[15px] leading-none disabled:opacity-40" aria-label="❤️">
                            {m.reaction ? '💔' : '❤️'}
                          </button>
                          <button onClick={() => copy(m)} className="bz-chat-icon inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold">
                            <CopyIcon className="h-4 w-4" /> {t('dashboard.instagram.copy')}
                          </button>
                        </div>
                      )}

                      {/* «تم فتح الرسالة · منذ …» تحت آخرِ ما أرسلناه فقط — تكرارُها تحت كلِّ
                          رسالةٍ ضجيج. والوقتُ نسبيٌّ لأنّ «١٧:٤٤» لا تقولُ كم مضى. */}
                      {out && it.last && m.id === lastOutId && seenAt && new Date(seenAt) >= new Date(m.created_at) && (
                        <span className="bz-chat-muted mt-0.5 block px-1 text-[10.5px] font-semibold">
                          {t('dashboard.instagram.seen')} · {relTime(seenAt)}
                        </span>
                      )}
                    </div>
                    {/* صورةُ الزبونِ مرّةً واحدةً في آخرِ دفقتِه — لا مع كلِّ سطر. والمكانُ
                        محجوزٌ في باقي الدفقةِ لتبقى الفقاعاتُ مصطفّة. */}
                    {!out && (it.last
                      ? <Avatar url={c.customer_avatar} name={name} className="mb-5 h-7 w-7 text-[10px]" />
                      : <span className="h-7 w-7 shrink-0" />)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* زرُّ النزولِ لآخرِ المحادثة، ومعه عددُ ما وصلَ وأنتِ تقرئين فوق */}
        {away && data && (
          <button
            onClick={() => toBottom(true)}
            className="bz-chat-fab absolute bottom-3 end-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold"
            aria-label={t('dashboard.instagram.newMessages')}
          >
            {unseen > 0 && <span>{t('dashboard.instagram.newCount', { count: unseen })}</span>}
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        )}

        {toast && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
            <span className="rounded-full bg-black/75 px-3.5 py-1.5 text-[12px] font-semibold text-white">{toast}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bz-chat-err mx-3 mb-2 flex shrink-0 items-start gap-2 rounded-xl px-3 py-2 text-xs">
          <span className="min-w-0 flex-1">{error}</span>
          <button onClick={() => setError('')} className="shrink-0 opacity-70" aria-label={t('common.close', { defaultValue: 'إغلاق' })}>
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* المقتبَسُ فوقَ صندوقِ الكتابة: يجبُ أن يرى المرسِلُ على ماذا يردّ */}
      {replyTo && (
        <div className="bz-chat-bar flex shrink-0 items-center gap-2.5 border-t px-3 py-2">
          <ReplyIcon className="bz-chat-muted h-4 w-4 shrink-0" />
          <span className="bz-chat-replybar min-w-0 flex-1 ps-2.5">
            <span className="block text-[11px] font-bold">
              {t('dashboard.instagram.replyingTo')} {replyTo.out ? t('dashboard.instagram.yourself') : name}
            </span>
            <span className="bz-chat-muted block truncate text-xs">{replyTo.text}</span>
          </span>
          <button onClick={() => setReplyTo(null)} className="bz-chat-icon shrink-0 rounded-full p-1" aria-label={t('common.cancel')}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* معاينةُ الصورةِ قبل الإرسال — لا تُرسَلُ صورةٌ لم يرَها المُرسِل */}
      {photo && (
        <div className="bz-chat-bar flex shrink-0 items-center gap-3 border-t px-3 py-2">
          <img src={photo.preview} alt="" className="h-14 w-14 rounded-xl object-cover" />
          <span className="bz-chat-muted min-w-0 flex-1 text-xs">
            {uploading && progress > 0 ? `${t('dashboard.instagram.uploading')} ${progress}%` : t('dashboard.instagram.photoReady')}
          </span>
          <button onClick={dropPhoto} disabled={uploading} className="bz-chat-icon rounded-full p-1.5 transition hover:text-red-400 disabled:opacity-40" aria-label={t('common.delete')}>
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* «/» تفتحُ قائمةَ الردودِ الجاهزةِ مصفّاةً — والضغطةُ تضعُ النصَّ في الصندوق */}
      {!recording && slash && (
        <div className="bz-chat-bar max-h-48 shrink-0 overflow-y-auto border-t py-1">
          {slash.length ? slash.map((qr, i) => (
            <button
              key={`s-${qr}-${i}`}
              onClick={() => { setText(qr); inputRef.current?.focus(); }}
              className="bz-chat-row block w-full truncate px-4 py-2 text-start text-[13px]"
            >
              {qr}
            </button>
          )) : (
            <p className="bz-chat-muted px-4 py-2 text-xs">
              {quick.length ? t('dashboard.instagram.noQuickMatch') : t('dashboard.instagram.noQuickYet')}
            </p>
          )}
        </div>
      )}

      {/* الردودُ الجاهزة: «متوفّر» و«السعر» تُكتَبان عشرين مرّةً في اليوم. شريطٌ يمرّرُ
          أفقيّاً فوقَ صندوقِ الكتابة، والضغطةُ تضعُ النصَّ في الصندوقِ لا تُرسلُه —
          فيبقى للتاجرةِ أن تُضيفَ كلمةً قبل الإرسال. */}
      {!recording && !slash && (quick.length > 0 || editQuick) && (
        <div className="bz-chat-bar shrink-0 border-t px-2 pt-2">
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {quick.map((qr, i) => (
              <button
                key={`${qr}-${i}`}
                onClick={() => { setText(text ? `${text} ${qr}` : qr); setEditQuick(false); }}
                className="bz-chat-day shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-semibold"
              >
                {qr}
              </button>
            ))}
            <button
              onClick={() => setEditQuick((v) => !v)}
              className="bz-chat-icon shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
              title={t('dashboard.instagram.editQuick')}
            >
              ✎
            </button>
          </div>

          {editQuick && (
            <div className="bz-chat-in mb-2 space-y-2 rounded-2xl p-2.5">
              <div className="flex gap-1.5">
                <input
                  className="bz-chat-input min-h-[36px] flex-1"
                  value={newQuick}
                  onChange={(e) => setNewQuick(e.target.value)}
                  placeholder={t('dashboard.instagram.quickPlaceholder')}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuick(); } }}
                />
                <button onClick={addQuick} disabled={!newQuick.trim()} className="btn-primary shrink-0 !rounded-full !px-3 !py-1.5 text-xs disabled:opacity-40">
                  {t('common.add', { defaultValue: 'إضافة' })}
                </button>
              </div>
              {quick.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {quick.map((qr, i) => (
                    <button
                      key={`del-${qr}-${i}`}
                      onClick={() => saveQuick(quick.filter((_, j) => j !== i))}
                      className="bz-chat-day inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]"
                    >
                      {qr} <XIcon className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              <p className="bz-chat-muted text-[10.5px]">{t('dashboard.instagram.slashHint')}</p>
            </div>
          )}
        </div>
      )}

      {/* شريطُ التسجيل: يحلُّ محلَّ صندوقِ الكتابةِ ما دام الصوتُ يُسجَّل */}
      {recording && (
        <div className="bz-chat-bar flex shrink-0 items-center gap-3 border-t px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-3">
          <button onClick={() => stopRec(false)} className="bz-chat-icon shrink-0 rounded-full p-2" aria-label={t('common.cancel')}>
            <TrashIcon className="h-5 w-5" />
          </button>
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          <span className="flex-1 font-mono text-sm tabular-nums" dir="ltr">{String(Math.floor(recSecs / 60)).padStart(2, '0')}:{String(recSecs % 60).padStart(2, '0')}</span>
          <button onClick={() => stopRec(true)} className="bz-send-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-label={t('dashboard.instagram.send')}>
            <SendIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* صندوقُ الكتابة */}
      {!recording && (
        <div className="bz-chat-bar flex shrink-0 items-end gap-1 border-t px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
          {cloudinaryEnabled && (
            <>
              {/* زرّان لا واحد: المعرضُ يفتحُ الصورَ المحفوظة، والكاميرا تفتحُ العدسةَ
                  مباشرةً على الجوّال (capture) — وهو ما يتوقّعه من اعتاد إنستغرام. */}
              <label className="bz-chat-icon mb-0.5 shrink-0 cursor-pointer rounded-full p-2 transition sm:hidden" title={t('dashboard.instagram.takePhoto')}>
                <CameraIcon className="h-[22px] w-[22px]" />
                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading}
                  onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <label className="bz-chat-icon mb-0.5 shrink-0 cursor-pointer rounded-full p-2 transition" title={t('dashboard.instagram.attachPhoto')}>
                <ImageIcon className="h-[22px] w-[22px]" />
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </>
          )}
          <button
            onClick={() => setShowProducts(true)}
            disabled={preparing}
            className="bz-chat-icon mb-0.5 shrink-0 rounded-full p-2 transition disabled:opacity-40"
            title={t('dashboard.instagram.sendProduct')}
            aria-label={t('dashboard.instagram.sendProduct')}
          >
            {preparing
              ? <span className="block h-[22px] w-[22px] animate-spin rounded-full border-2 border-current border-t-transparent" />
              : <TagIcon className="h-[22px] w-[22px]" />}
          </button>
          <textarea
            ref={inputRef}
            className="bz-chat-input bz-chat-compose min-h-[42px] flex-1 resize-none"
            rows={1}
            placeholder={win.known && !win.open ? t('dashboard.instagram.windowClosedShort') : t('dashboard.instagram.replyPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (slash && slash.length === 1) { setText(slash[0]); return; }
                send();
              }
            }}
          />
          {/* الميكروفون يظهرُ ما دام الصندوقُ فارغاً — كما في إنستغرام: إمّا تكتبُ أو تُسجّل */}
          {!text.trim() && !photo ? (
            <button onClick={startRec} disabled={uploading} className="bz-chat-icon mb-0.5 shrink-0 rounded-full p-2 transition disabled:opacity-40" title={t('dashboard.instagram.voice')} aria-label={t('dashboard.instagram.voice')}>
              <MicIcon className="h-[22px] w-[22px]" />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!canSend}
              className="bz-send-btn mb-0.5 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full transition disabled:opacity-40"
              aria-label={t('dashboard.instagram.send')}
            >
              {uploading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <SendIcon className="h-[18px] w-[18px]" />}
            </button>
          )}
        </div>
      )}

      {hud && <PerfHud />}
      {viewing && <MediaViewer media={viewing} onClose={() => setViewing(null)} />}
      {showProducts && <ProductSheet onPick={sendProduct} onClose={() => setShowProducts(false)} />}
    </div>,
    bzPortalRoot() || document.body
  );
}

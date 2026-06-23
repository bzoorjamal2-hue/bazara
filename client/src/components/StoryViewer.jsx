import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { cldOptimized, cldThumb } from '../utils/cloudinary.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import CloseButton from './CloseButton.jsx';
import useScrollLock from '../hooks/useScrollLock.js';

const IMG_MS = 5000; // مدة عرض الصورة

// عارض ستوري بأسلوب إنستغرام: أشرطة تقدّم، انتقال تلقائي، نقر يمين/يسار،
// ضغط مطوّل للإيقاف، وحذف للمالك. الفيديو يعتمد مدته، والصورة ٥ ثوانٍ.
export default function StoryViewer({ stories, store, startIndex = 0, isOwner = false, onClose, onDeleted, onSeen }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const vidRef = useRef(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  const holdRef = useRef({ timer: null, held: false });
  useScrollLock(true);

  const cur = stories[idx];
  const isVideo = cur?.mediaType === 'video';

  const goNext = () => { setIdx((i) => (i >= stories.length - 1 ? (onClose(), i) : i + 1)); };
  const goPrev = () => setIdx((i) => Math.max(0, i - 1));

  useEffect(() => { setProgress(0); elapsedRef.current = 0; }, [idx]);

  // تسجيل مشاهدة (مرة لكل ستوري) + تعليم كمُشاهَدة
  const viewedRef = useRef(new Set());
  useEffect(() => {
    if (!cur) return;
    onSeen?.(cur.id);
    if (!viewedRef.current.has(cur.id)) {
      viewedRef.current.add(cur.id);
      api.post(`/public/story/${cur.id}/view`).catch(() => {});
    }
  }, [idx, cur]);

  // تقدّم سلس (60fps) عبر requestAnimationFrame لكلٍّ من الصورة (مؤقّت) والفيديو (currentTime)
  useEffect(() => {
    if (paused || !cur) return undefined;
    const v = vidRef.current;
    startRef.current = Date.now() - elapsedRef.current;
    const tick = () => {
      if (isVideo) {
        if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
      } else {
        const el = Date.now() - startRef.current;
        elapsedRef.current = el;
        const pct = Math.min(100, (el / IMG_MS) * 100);
        setProgress(pct);
        if (pct >= 100) { goNext(); return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [idx, isVideo, paused, cur]);

  // الفيديو: تشغيل/إيقاف حسب الإيقاف المؤقّت
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }, [paused, idx]);

  // لوحة المفاتيح (كمبيوتر)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') (rtl ? goPrev : goNext)();
      else if (e.key === 'ArrowLeft') (rtl ? goNext : goPrev)();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rtl, idx, stories.length]);

  const onDownZone = () => {
    holdRef.current.held = false;
    holdRef.current.timer = setTimeout(() => { holdRef.current.held = true; setPaused(true); }, 220);
  };
  const onUpZone = (where) => {
    clearTimeout(holdRef.current.timer);
    if (holdRef.current.held) { holdRef.current.held = false; setPaused(false); return; }
    // نقرة: الجهة المنطقية تتبع اللغة (في RTL يمين=السابق)
    if (where === 'prev') (rtl ? goNext : goPrev)();
    else (rtl ? goPrev : goNext)();
  };

  const del = async () => {
    if (!cur) return;
    try { await api.delete(`/stories/${cur.id}`); } catch { /* تجاهل */ }
    onDeleted?.(cur.id);
    onClose();
  };

  // إرسال ردّ الزبونة لواتساب المتجر: نصّها + رابط المنتج (يظهر بصورته بالمعاينة)
  const sendReply = () => {
    const text = reply.trim();
    const body = text || t('story.replyMsg', { name: store?.name });
    const productLink = cur?.productId ? `${window.location.origin}/share/product/${cur.productId}` : '';
    const msg = productLink ? `${body}\n${productLink}` : body;
    window.open(buildWhatsappLink(store.whatsapp, msg), '_blank');
    setReply('');
  };

  const ago = (() => {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(cur?.createdAt).getTime()) / 60000));
    if (mins < 60) return t('story.minsAgo', { count: mins });
    return t('story.hrsAgo', { count: Math.floor(mins / 60) });
  })();

  if (!cur) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex select-none justify-center bg-black"
      dir="ltr"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="relative h-full w-full sm:max-w-[480px]">
        {/* أشرطة التقدّم */}
        <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-2.5" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 8px)' }}>
          {stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{ width: `${i < idx ? 100 : i === idx ? progress : 0}%` }} />
            </div>
          ))}
        </div>

        {/* رأس: شعار المتجر + الاسم + الوقت + حذف/إغلاق */}
        <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 px-3 pt-5" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 20px)' }} dir={rtl ? 'rtl' : 'ltr'}>
          {store?.logoUrl
            ? <img src={cldThumb(store.logoUrl, 80)} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/60" />
            : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm text-white">🏪</span>}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-white drop-shadow">{store?.name}</p>
            <p className="text-[11px] text-white/70">{ago}</p>
          </div>
          {isOwner && (
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              {cur.views ?? 0}
            </span>
          )}
          {isOwner && (
            <button onClick={del} aria-label="delete" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-red-500/70">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
            </button>
          )}
          <CloseButton onClick={onClose} variant="ghost" size="h-9 w-9" />
        </div>

        {/* الوسائط */}
        {isVideo ? (
          <video
            ref={vidRef}
            src={cldOptimized(cur.mediaUrl, 'video')}
            autoPlay
            playsInline
            onEnded={goNext}
            className="h-full w-full bg-black object-cover"
          />
        ) : (
          <img src={cldOptimized(cur.mediaUrl, 'image')} alt="" className="h-full w-full bg-black object-cover" />
        )}

        {/* أسفل العارض (أسلوب إنستغرام): تعليق + زر اطلبي الآن + شريط ردّ */}
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-3 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)]" dir={rtl ? 'rtl' : 'ltr'}>
          {cur.caption && (
            <p className="mx-auto max-w-[92%] text-center text-[15px] font-semibold leading-snug text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">{cur.caption}</p>
          )}
          {cur.productId && (
            <Link to={`/product/${cur.productId}`} onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-wine shadow-lg transition active:scale-[0.98]">
              🛍️ {t('story.shopNow')}
            </Link>
          )}
          {store?.whatsapp && (
            <form
              onSubmit={(e) => { e.preventDefault(); sendReply(); }}
              className="flex items-center gap-2 rounded-full border border-white/40 bg-white/10 ps-4 pe-1.5 py-1.5 backdrop-blur"
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                placeholder={t('story.replyPlaceholder')}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white placeholder:text-white/55 focus:outline-none"
              />
              <button type="submit" aria-label="send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-wine transition active:scale-90">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
              </button>
            </form>
          )}
        </div>

        {/* مناطق اللمس: يسار (٣٠٪) سابق، يمين (٧٠٪) تالي، ضغط مطوّل = إيقاف */}
        <button aria-label="prev" className="absolute inset-y-0 start-0 z-20 w-[30%]"
          onPointerDown={onDownZone} onPointerUp={() => onUpZone('prev')} onPointerCancel={() => onUpZone('prev')} />
        <button aria-label="next" className="absolute inset-y-0 end-0 z-20 w-[70%]"
          onPointerDown={onDownZone} onPointerUp={() => onUpZone('next')} onPointerCancel={() => onUpZone('next')} />
      </div>
    </div>,
    document.body
  );
}

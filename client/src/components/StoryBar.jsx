import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { uploadToCloudinary, cldThumb } from '../utils/cloudinary.js';
import { getSeenSet, markSeen } from '../utils/storySeen.js';
import { clearCachePrefixes } from '../utils/apiCache.js';
import useScrollLock from '../hooks/useScrollLock.js';
import Select from './Select.jsx';
import StoryViewer from './StoryViewer.jsx';
import { StoreIcon, SparkleIcon } from './icons.jsx';

// ستوري المتجر على الشعار (إنستغرام): حلقة ذهبية = ستوريات غير مُشاهَدة، رمادية = مُشاهَدة/لا شيء.
// المالكة ترى (+) لإضافة ستوري (مع تعليق + ربط منتج). compact = الشعار داخل الهيدر.
export default function StoryBar({ store, stories, isOwner, onAdded, onDeleted, compact = false, products = [] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => getSeenSet());
  const [err, setErr] = useState('');
  // النشر (compose)
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [prod, setProd] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);
  useScrollLock(!!file); // تجميد الخلفية أثناء شيت النشر (لا تتحرك الشاشة تحته)

  const hasStories = stories.length > 0;
  const hasUnseen = stories.some((s) => !seen.has(s.id));
  const goldRing = hasStories && hasUnseen;

  const pick = () => fileRef.current?.click();
  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setCaption(''); setProd('');
  };
  const closeCompose = () => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(''); };

  const publish = async () => {
    if (!file) return;
    const mediaType = file.type.startsWith('video') ? 'video' : 'image';
    setBusy(true); setProgress(0); setErr('');
    try {
      const url = await uploadToCloudinary(file, mediaType, setProgress);
      const { data } = await api.post('/stories', { mediaUrl: url, mediaType, caption: caption.trim(), productId: prod });
      clearCachePrefixes(['storepage:', 'home']); // الستوري الجديدة تظهر فوراً (الستوريات ضمن كاش صفحة المتجر)
      onAdded(data.story);
      closeCompose();
    } catch {
      setErr(t('story.uploadFail'));
      setTimeout(() => setErr(''), 3000);
    } finally {
      setBusy(false);
    }
  };

  const onSeen = (id) => { markSeen(id); setSeen(getSeenSet()); };
  const onCircle = () => { if (hasStories) setOpen(true); else if (isOwner) pick(); };

  if (!compact && !isOwner && !hasStories) return null;

  const logoSize = compact ? 'h-8 w-8' : 'h-16 w-16';
  const ringPad = compact ? 'p-[2px]' : 'p-[3.5px]';
  const plusSize = compact ? 'h-4 w-4' : 'h-6 w-6';
  const plusIcon = compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';
  const plusPos = compact ? 'bottom-0 end-0' : '-bottom-0.5 -end-0.5';

  return (
    <div className={compact ? 'inline-flex' : 'mb-5 flex items-center gap-4'}>
      <div className="flex flex-col items-center gap-1.5">
        <button onClick={onCircle} className="relative shrink-0 active:scale-95" aria-label="story">
          <span className={`block rounded-full ${ringPad} ${goldRing ? 'bz-story-ring' : 'bz-story-ring-seen'}`}>
            <span className="bz-story-gap block rounded-full p-[2px]">
              {store.logoUrl
                ? <img src={cldThumb(store.logoUrl, 160)} alt={store.name} className={`${logoSize} rounded-full object-cover`} />
                : <span className={`flex ${logoSize} items-center justify-center rounded-full bg-cream text-wine`}><StoreIcon className="h-5 w-5" /></span>}
            </span>
          </span>
          {isOwner && (
            <span role="button" onClick={(e) => { e.stopPropagation(); pick(); }} aria-label="add"
              className={`absolute ${plusPos} flex ${plusSize} items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#cdbda4] to-[#8a7657] text-[#2a1c14] shadow-md`}>
              <svg viewBox="0 0 24 24" className={plusIcon} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          )}
        </button>
        {!compact && <span className="max-w-[5rem] truncate text-xs font-medium text-wine">{isOwner ? t('story.yours') : store.name}</span>}
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} className="hidden" />
      {err && !compact && <span className="text-xs font-medium text-red-600">{err}</span>}

      {open && (
        <StoryViewer stories={stories} store={store} isOwner={isOwner} onClose={() => setOpen(false)} onDeleted={onDeleted} onSeen={onSeen} />
      )}

      {/* شيت النشر: معاينة + تعليق + ربط منتج — Portal على مستوى الصفحة كي لا يتأثّر
          بالهيدر (will-change/transform) الذي يجعل fixed نسبةً له فيتكسّر */}
      {file && createPortal(
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" onClick={() => !busy && closeCompose()}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
          <div className="bz-sheet relative w-full max-w-md rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            {/* مقبض السحب — إشارةٌ بصريّة أن الشيت يُغلق بالسحب/النقر خارجه */}
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-current opacity-20 sm:hidden" />
            <h3 className="mb-3 font-display text-lg font-bold">{t('story.newStory')}</h3>

            {/* المعاينة بنسبة الستوري نفسها (9:16) وأطول من قبل — كانت max-h-64
                فتظهر اللقطة العمودية شريطاً صغيراً لا يُقيَّم منه شيء. */}
            <div className="relative mb-3 overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '9 / 16', maxHeight: '46vh' }}>
              {file.type.startsWith('video')
                ? <video src={preview} className="h-full w-full object-contain" muted autoPlay loop playsInline />
                : <img src={preview} alt="" className="h-full w-full object-contain" />}
              {/* تغيير اللقطة بلا إلغاء الشيت وإعادة فتحه */}
              {!busy && (
                <button type="button" onClick={pick}
                  className="absolute end-2 top-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/75">
                  {t('story.changeMedia')}
                </button>
              )}
              {/* شريط رفعٍ حقيقي فوق المعاينة — كان الرقم وحده على الزرّ */}
              {busy && (
                <div className="absolute inset-x-0 bottom-0 bg-black/55 p-3 backdrop-blur-sm">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-white">
                    <span>{t('story.uploading')}</span><span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#b09a7e] to-[#fff6da] transition-[width] duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="relative mb-3">
              <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder={t('story.captionPlaceholder')}
                className="bz-sheet-input pe-14" />
              <span className="bz-sheet-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums">{caption.length}/200</span>
            </div>

            {products.length > 0 && (
              <div className="mb-4">
                <p className="bz-sheet-muted mb-1.5 text-xs font-medium">{t('story.linkProduct')}</p>
                <Select value={prod} onChange={setProd} placeholder={t('story.noProduct')}
                  options={[{ value: '', label: t('story.noProduct') }, ...products.map((p) => ({ value: p.id, label: p.name }))]} />
              </div>
            )}
            {err && <p className="mb-2 text-sm font-medium text-red-500">{err}</p>}
            <div className="flex gap-2">
              <button onClick={publish} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#eee6d8] via-[#cdbda4] to-[#b09a7e] py-3 font-extrabold text-[#2a1c14] shadow-[0_8px_22px_-8px_rgba(176, 154, 126, .9)] transition active:scale-[0.98] disabled:opacity-50">
                {busy ? `${progress}%` : <span className="inline-flex items-center gap-1.5"><SparkleIcon className="h-4 w-4" /> {t('story.publish')}</span>}
              </button>
              <button onClick={closeCompose} disabled={busy} className="bz-sheet-ghost rounded-2xl px-5 font-semibold transition disabled:opacity-50">{t('common.cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { uploadToCloudinary, cldThumb } from '../utils/cloudinary.js';
import { getSeenSet, markSeen } from '../utils/storySeen.js';
import Select from './Select.jsx';
import StoryViewer from './StoryViewer.jsx';

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

  const logoSize = compact ? 'h-10 w-10' : 'h-16 w-16';
  const ringPad = compact ? 'p-[2px]' : 'p-[3px]';
  const plusSize = compact ? 'h-[18px] w-[18px]' : 'h-6 w-6';
  const plusIcon = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const plusPos = compact ? 'bottom-0 end-0' : '-bottom-0.5 -end-0.5';

  return (
    <div className={compact ? 'inline-flex' : 'mb-5 flex items-center gap-4'}>
      <div className="flex flex-col items-center gap-1.5">
        <button onClick={onCircle} className="relative shrink-0 active:scale-95" aria-label="story">
          <span className={`block rounded-full ${ringPad} ${goldRing ? 'bg-gradient-to-tr from-gold-400 via-wine to-gold-300' : 'bg-wine/20'}`}>
            <span className="block rounded-full bg-white p-[2px]">
              {store.logoUrl
                ? <img src={cldThumb(store.logoUrl, 160)} alt={store.name} className={`${logoSize} rounded-full object-cover`} />
                : <span className={`flex ${logoSize} items-center justify-center rounded-full bg-cream text-xl`}>🏪</span>}
            </span>
          </span>
          {isOwner && (
            <span role="button" onClick={(e) => { e.stopPropagation(); pick(); }} aria-label="add"
              className={`absolute ${plusPos} flex ${plusSize} items-center justify-center rounded-full border-2 border-white bg-wine text-cream shadow`}>
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
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-wine sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-lg font-bold">{t('story.newStory')}</h3>
            <div className="mb-3 overflow-hidden rounded-2xl bg-black">
              {file.type.startsWith('video')
                ? <video src={preview} className="mx-auto max-h-64 w-auto" muted autoPlay loop playsInline />
                : <img src={preview} alt="" className="mx-auto max-h-64 w-auto object-contain" />}
            </div>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder={t('story.captionPlaceholder')}
              className="input mb-3 w-full" />
            {products.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-medium text-stone-500">{t('story.linkProduct')}</p>
                <Select value={prod} onChange={setProd} placeholder={t('story.noProduct')}
                  options={[{ value: '', label: t('story.noProduct') }, ...products.map((p) => ({ value: p.id, label: p.name }))]} />
              </div>
            )}
            {err && <p className="mb-2 text-sm font-medium text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button onClick={publish} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-wine py-3 font-bold text-cream transition active:scale-[0.98] disabled:opacity-50">
                {busy ? `${progress}%` : `✨ ${t('story.publish')}`}
              </button>
              <button onClick={closeCompose} disabled={busy} className="rounded-2xl border border-wine/30 px-5 font-semibold text-wine disabled:opacity-50">{t('common.cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

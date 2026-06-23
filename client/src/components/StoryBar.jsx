import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { uploadToCloudinary, cldThumb } from '../utils/cloudinary.js';
import StoryViewer from './StoryViewer.jsx';

// دائرة ستوري المتجر (أسلوب إنستغرام): حلقة ذهبية إن وُجدت ستوريات، والمالكة
// ترى زر (+) لإضافة ستوري من جهازها. الزائر يراها فقط إن وُجدت ستوريات فعّالة.
export default function StoryBar({ store, stories, isOwner, onAdded, onDeleted }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const hasStories = stories.length > 0;

  const pick = () => fileRef.current?.click();
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const mediaType = file.type.startsWith('video') ? 'video' : 'image';
    setErr(''); setUploading(true); setProgress(0);
    try {
      const url = await uploadToCloudinary(file, mediaType, setProgress);
      const { data } = await api.post('/stories', { mediaUrl: url, mediaType });
      onAdded(data.story);
    } catch {
      setErr(t('story.uploadFail'));
      setTimeout(() => setErr(''), 3000);
    } finally {
      setUploading(false);
    }
  };

  const onCircle = () => { if (hasStories) setOpen(true); else if (isOwner) pick(); };

  if (!isOwner && !hasStories) return null; // الزائر بلا ستوريات → لا نعرض شيئاً

  return (
    <div className="mb-5 flex items-center gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <button onClick={onCircle} className="relative active:scale-95" aria-label="story">
          <span className={`block rounded-full p-[3px] ${hasStories ? 'bg-gradient-to-tr from-gold-400 via-wine to-gold-300' : 'bg-wine/20'}`}>
            <span className="block rounded-full bg-white p-[2px]">
              {store.logoUrl
                ? <img src={cldThumb(store.logoUrl, 160)} alt={store.name} className="h-16 w-16 rounded-full object-cover" />
                : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cream text-2xl">🏪</span>}
            </span>
          </span>
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-xs font-bold text-white">{progress}%</span>
          )}
          {isOwner && !uploading && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); pick(); }}
              aria-label="add"
              className="absolute -bottom-0.5 -end-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-wine text-cream shadow"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          )}
        </button>
        <span className="max-w-[5rem] truncate text-xs font-medium text-wine">{isOwner ? t('story.yours') : store.name}</span>
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} className="hidden" />
      {err && <span className="text-xs font-medium text-red-600">{err}</span>}

      {open && (
        <StoryViewer stories={stories} store={store} isOwner={isOwner} onClose={() => setOpen(false)} onDeleted={onDeleted} />
      )}
    </div>
  );
}

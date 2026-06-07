import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadToCloudinary, cldOptimized, cloudinaryEnabled } from '../utils/cloudinary.js';

// حقل فيديو موحّد: رفع مباشر من الجهاز (Cloudinary) أو لصق رابط.
export default function VideoInput({ value, onChange, label }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(cloudinaryEnabled ? 'upload' : 'url');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { setErr(t('video.notVideo')); return; }
    setErr('');
    setBusy(true);
    setProgress(0);
    try {
      const link = await uploadToCloudinary(file, 'video', setProgress);
      onChange(cldOptimized(link, 'video'));
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {label && <label className="label">{label}</label>}

      {cloudinaryEnabled && (
        <div className="mb-2 flex gap-1 rounded-xl bg-black/30 p-1 text-sm">
          <button type="button" onClick={() => setTab('upload')} className={`flex-1 rounded-lg py-1.5 transition ${tab === 'upload' ? 'bg-gold-400/20 text-gold-200' : 'text-stone-400'}`}>
            ⬆️ {t('image.upload')}
          </button>
          <button type="button" onClick={() => setTab('url')} className={`flex-1 rounded-lg py-1.5 transition ${tab === 'url' ? 'bg-gold-400/20 text-gold-200' : 'text-stone-400'}`}>
            🔗 {t('image.url')}
          </button>
        </div>
      )}

      {tab === 'upload' && cloudinaryEnabled ? (
        <div>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost w-full text-sm">
            {busy ? `${t('video.uploading')} ${progress}%` : `🎬 ${t('video.chooseFile')}`}
          </button>
          {busy && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/30">
              <div className="h-full bg-gold-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      ) : (
        <input
          type="url"
          dir="ltr"
          className="input"
          placeholder="https://...mp4"
          value={value && value.startsWith('http') ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {value && (
        <div className="mt-2">
          <video src={value} controls playsInline className="max-h-48 w-full rounded-xl bg-black/40" />
          <button type="button" onClick={() => onChange('')} className="mt-1 text-xs text-stone-400 hover:text-red-300">
            {t('image.remove')}
          </button>
        </div>
      )}

      {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
    </div>
  );
}

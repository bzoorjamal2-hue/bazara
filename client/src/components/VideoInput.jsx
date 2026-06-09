import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadToCloudinary, cldOptimized, cloudinaryEnabled } from '../utils/cloudinary.js';

function UploadIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
function LinkIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
function VideoGlyph({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="14" height="14" rx="3" />
      <path d="M22 8l-6 4 6 4V8z" />
    </svg>
  );
}

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

  const tabBtn = (key, Icon, text) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition ${
        tab === key ? 'bg-white text-wine shadow-sm' : 'text-stone-500 hover:text-wine'
      }`}
    >
      <Icon /> {text}
    </button>
  );

  return (
    <div>
      {label && <label className="label">{label}</label>}

      {cloudinaryEnabled && (
        <div className="mb-2 flex gap-1 rounded-xl bg-wine/5 p-1 text-sm">
          {tabBtn('upload', UploadIcon, t('image.upload'))}
          {tabBtn('url', LinkIcon, t('image.url'))}
        </div>
      )}

      {tab === 'upload' && cloudinaryEnabled ? (
        <div>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-wine/25 bg-wine/[0.03] px-4 py-6 text-wine transition hover:border-wine/40 hover:bg-wine/[0.06] disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-wine/10 text-wine">
              <VideoGlyph />
            </span>
            <span className="text-sm font-semibold">
              {busy ? `${t('video.uploading')} ${progress}%` : t('video.chooseFile')}
            </span>
            {!busy && <span className="text-xs text-stone-400">MP4 · MOV</span>}
          </button>
          {busy && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-wine/10">
              <div className="h-full rounded-full bg-wine transition-all" style={{ width: `${progress}%` }} />
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
        <div className="mt-3">
          {/* معاينة تتكرر تلقائياً */}
          <video src={value} autoPlay loop muted playsInline controls className="max-h-52 w-full rounded-2xl bg-black/30" />
          <button type="button" onClick={() => onChange('')} className="mt-1.5 text-xs text-stone-400 transition hover:text-red-400">
            {t('image.remove')}
          </button>
        </div>
      )}

      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
    </div>
  );
}

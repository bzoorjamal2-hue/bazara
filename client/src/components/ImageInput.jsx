import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resizeImageFile } from '../utils/image.js';
import { uploadToCloudinary, cldOptimized, cloudinaryEnabled } from '../utils/cloudinary.js';
import { UploadIcon, LinkIcon, ImageIcon } from './icons.jsx';

// حقل صورة موحّد: رفع من الجهاز أو لصق رابط. القيمة سلسلة نصية (رابط أو data URL).
export default function ImageInput({ value, onChange, round = false, label }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('upload');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      if (cloudinaryEnabled) {
        // رفع بجودة عالية إلى Cloudinary (بدون ضغط يقلّل الدقة)
        const url = await uploadToCloudinary(file, 'image');
        onChange(cldOptimized(url, 'image'));
      } else {
        const dataUrl = await resizeImageFile(file);
        onChange(dataUrl);
      }
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="mb-2 flex gap-1 rounded-xl bg-black/30 p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex-1 rounded-lg py-1.5 transition ${tab === 'upload' ? 'bg-gold-400/20 text-gold-200' : 'text-stone-400'}`}
        >
          <UploadIcon className="inline h-4 w-4" /> {t('image.upload')}
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`flex-1 rounded-lg py-1.5 transition ${tab === 'url' ? 'bg-gold-400/20 text-gold-200' : 'text-stone-400'}`}
        >
          <LinkIcon className="inline h-4 w-4" /> {t('image.url')}
        </button>
      </div>

      <div className="flex items-center gap-4">
        {value ? (
          <img
            src={value}
            alt="preview"
            className={`h-20 w-20 flex-shrink-0 border border-gold-400/30 object-cover ${round ? 'rounded-full' : 'rounded-xl'}`}
            onError={(e) => (e.currentTarget.style.opacity = '0.3')}
          />
        ) : (
          <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center border border-dashed border-gold-400/30 text-stone-600 ${round ? 'rounded-full' : 'rounded-xl'}`}>
            <ImageIcon className="h-7 w-7" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {tab === 'upload' ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost w-full text-sm" disabled={busy}>
                {busy ? t('common.loading') : t('image.chooseFile')}
              </button>
              {value && (
                <button type="button" onClick={() => onChange('')} className="mt-2 text-xs text-stone-400 hover:text-red-300">
                  {t('image.remove')}
                </button>
              )}
            </>
          ) : (
            <input
              type="url"
              dir="ltr"
              className="input"
              placeholder="https://..."
              value={value && value.startsWith('http') ? value : ''}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
        </div>
      </div>
    </div>
  );
}

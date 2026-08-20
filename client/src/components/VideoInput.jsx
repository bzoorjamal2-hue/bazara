import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadToCloudinary, cldOptimized, cldVideoMp4, cloudinaryEnabled } from '../utils/cloudinary.js';
import { LinkIcon, VideoIcon, TrashIcon, CheckIcon } from './icons.jsx';
import { isKind, droppedUrl } from '../utils/dropFile.js';

// حقل فيديو موحّد: سحب وإفلات، رفع مباشر من الجهاز (Cloudinary)، أو لصق رابط.
// بنفس لغة حقل الصورة (ImageInput) — تجربة واحدة متّسقة عبر كل النماذج.
//   hint: سطر إرشادي تحت الحقل (المدّة/المقاس المقترح).
export default function VideoInput({ value, onChange, label, hint = '' }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);
  const [urlMode, setUrlMode] = useState(!cloudinaryEnabled);
  // معاينة محلّية من الجهاز — تظهر فوراً بلا انتظار معالجة السحابة (يشغّلها المتصفّح مباشرة)
  const [localPreview, setLocalPreview] = useState('');
  const fileRef = useRef(null);

  // تحرير رابط المعاينة المحلّية عند تغييره أو تفكيك المكوّن (منع تسريب الذاكرة)
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);

  const upload = async (file) => {
    if (!file) return;
    if (!isKind(file, 'video')) { setErr(t('video.notVideo')); return; }
    // نعرض الفيديو من الجهاز مباشرة — تظهر المعاينة قبل انتهاء الرفع وبلا اعتماد على التحويل السحابي
    setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setErr(''); setPct(0); setBusy(true);
    try {
      const link = await uploadToCloudinary(file, 'video', setPct);
      onChange(cldOptimized(link, 'video'));
      setDone(true);
    } catch (er) {
      setErr(er.message);
      setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
    } finally {
      setBusy(false); setPct(0);
    }
  };

  const handleFile = (e) => { upload(e.target.files?.[0]); e.target.value = ''; };
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    setErr(''); // إفلاتٌ جديد يبدأ بصفحة نظيفة
    const file = e.dataTransfer?.files?.[0];
    if (file) { upload(file); return; }
    const url = droppedUrl(e.dataTransfer);
    if (url) { onChange(url); return; }
    setErr(t('video.notVideo'));
  };
  const clear = () => {
    setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
    onChange('');
  };

  const preview = localPreview || (value ? cldVideoMp4(value) : '');

  return (
    <div>
      {label && <label className="label">{label}</label>}

      <div
        onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`rounded-2xl border border-dashed p-2.5 transition ${drag ? 'border-gold-400/70 bg-gold-400/10' : 'border-gold-400/20 bg-black/15'}`}
      >
        {preview ? (
          <div className="relative mb-2.5">
            <video
              key={preview}
              src={preview}
              autoPlay loop muted playsInline controls
              // خلفية داكنة ثابتة خلف الفيديو بالوضعين — الفيديو يغطّيها والأشرطة السوداء
              // على جوانبه تبدو مقصودة بدل مربّع فاتح غريب
              className="max-h-52 w-full rounded-xl bg-[#1a1410]"
            />
            {busy && (
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 rounded-b-xl bg-black/70 px-2.5 py-1.5 text-[11px] font-bold text-gold-200">
                {t('video.uploading')} {pct}%
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full rounded-full bg-gold-400 transition-all" style={{ width: `${pct || 6}%` }} />
                </span>
              </span>
            )}
            {done && !busy && (
              <span className="absolute top-2 end-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                <CheckIcon className="h-3 w-3" /> {t('video.uploaded')}
              </span>
            )}
          </div>
        ) : (
          // الحالة الفارغة: بلاطة مرتّبة قابلة للضغط — أيقونة فيديو داخل دائرة ذهبية
          // متمركزة تماماً + الصيغ المدعومة، بألوان تتبع الوضع النهاري/الليلي
          <button
            type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="mb-2.5 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-gold-400/20 bg-black/20 transition hover:border-gold-400/45 hover:bg-gold-400/10 disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/25">
              <VideoIcon className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-stone-400">MP4 · MOV</span>
          </button>
        )}

        <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />

        {urlMode ? (
          <div className="flex items-center gap-1.5">
            <input
              type="url" dir="ltr" className="input !py-2 text-sm" placeholder="https://...mp4"
              value={value && value.startsWith('http') ? value : ''}
              onChange={(e) => onChange(e.target.value)}
            />
            {cloudinaryEnabled && (
              <button type="button" onClick={() => setUrlMode(false)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-stone-400 hover:text-gold-200">
                {t('common.ok')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button" disabled={busy} onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-400/20 disabled:opacity-50"
            >
              <VideoIcon className="h-3.5 w-3.5" />
              {busy ? `${t('video.uploading')} ${pct}%` : preview ? t('video.change') : t('video.chooseFile')}
            </button>
            <button
              type="button" onClick={() => setUrlMode(true)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-stone-400 transition hover:text-gold-200"
            >
              <LinkIcon className="h-3.5 w-3.5" /> {t('image.url')}
            </button>
            {preview && (
              <button
                type="button" onClick={clear}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-stone-400 transition hover:text-red-300"
              >
                <TrashIcon className="h-3.5 w-3.5" /> {t('video.remove')}
              </button>
            )}
          </div>
        )}

        <p className="mt-1.5 text-[11px] leading-snug text-stone-400">{hint || t('video.dropHint')}</p>
        {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
      </div>
    </div>
  );
}

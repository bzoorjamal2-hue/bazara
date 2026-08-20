import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resizeImageFile } from '../utils/image.js';
import { uploadToCloudinary, cldOptimized, cloudinaryEnabled } from '../utils/cloudinary.js';
import { LinkIcon, CameraIcon, TrashIcon, CheckIcon, ImageIcon } from './icons.jsx';
import { isKind, droppedUrl } from '../utils/dropFile.js';

// حقل صورة موحّد: سحب وإفلات، لصق من الحافظة، رفع من الجهاز، أو لصق رابط.
// القيمة سلسلة نصية (رابط أو data URL).
//   placeholderImg: صورة افتراضية تُعرَض عند عدم وجود قيمة (لإظهار اللوقو الحالي للفئة).
//   contain: يُظهر الصورة كاملة بلا قصّ (للوقوهات بلا خلفية) بدل قصّها (object-cover).
//   hint: سطر إرشادي تحت الحقل (المقاس المقترح مثلاً) — يساعد المالكة تختار صورة صحيحة.
export default function ImageInput({ value, onChange, round = false, label, placeholderImg = '', contain = false, hint = '' }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);       // نسبة تقدّم الرفع — تُطمئن المالكة أن الصورة تُرفع فعلاً
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false); // إبراز منطقة الإفلات أثناء سحب صورة فوقها
  const [done, setDone] = useState(false); // علامة ✓ خاطفة بعد نجاح الرفع
  const [urlMode, setUrlMode] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);

  const upload = async (file) => {
    if (!file) return;
    if (!isKind(file, 'image')) { setErr(t('image.notImage')); return; }
    setErr(''); setPct(0); setBusy(true);
    try {
      if (cloudinaryEnabled) {
        // رفع بجودة عالية إلى Cloudinary (بدون ضغط يقلّل الدقة)
        const url = await uploadToCloudinary(file, 'image', setPct);
        onChange(cldOptimized(url, 'image'));
      } else {
        const dataUrl = await resizeImageFile(file);
        onChange(dataUrl);
      }
      setDone(true);
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy(false); setPct(0);
    }
  };

  const handleFile = (e) => { upload(e.target.files?.[0]); e.target.value = ''; };
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    setErr(''); // إفلاتٌ جديد يبدأ بصفحة نظيفة: كان خطأ محاولة سابقة يبقى معلّقاً
    const file = e.dataTransfer?.files?.[0];
    if (file) { upload(file); return; }
    // لا ملف: صورة مسحوبة من صفحة ويب أخرى تصل كرابط لا كملف
    const url = droppedUrl(e.dataTransfer);
    if (url) { onChange(url); setDone(true); return; }
    setErr(t('image.notImage'));
  };
  // لصق صورة من الحافظة (لقطة شاشة أو نسخ صورة من متصفّح) مباشرة داخل الحقل
  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type?.startsWith('image/'));
    if (item) { e.preventDefault(); upload(item.getAsFile()); }
  };

  const shape = round ? 'rounded-full' : 'rounded-2xl';
  const hasImg = Boolean(value);

  return (
    <div>
      {label && <label className="label">{label}</label>}

      <div
        onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={-1}
        className={`flex items-center gap-3 rounded-2xl border border-dashed p-2.5 transition focus:outline-none ${
          drag ? 'border-gold-400/70 bg-gold-400/10' : 'border-gold-400/20 bg-black/15'
        }`}
      >
        {/* المعاينة — الصورة الحالية أو الافتراضية أو مربّع فارغ. قابلة للضغط:
            أسرع طريق لتبديل الصورة هو الضغط على الصورة نفسها */}
        <button
          type="button" disabled={busy} onClick={() => fileRef.current?.click()}
          aria-label={hasImg ? t('image.change') : t('image.chooseFile')}
          className={`group relative h-20 w-20 shrink-0 overflow-hidden border border-gold-400/25 bg-black/30 transition hover:border-gold-400/60 ${shape}`}
        >
          {hasImg ? (
            <img
              src={value}
              alt=""
              className={`h-full w-full ${contain ? 'object-contain p-1.5' : 'object-cover'}`}
              onError={(e) => (e.currentTarget.style.opacity = '0.3')}
            />
          ) : placeholderImg ? (
            // اللوقو الافتراضي الحالي — يظهر كاملاً حتى تعرف المالكة الشكل قبل تغييره
            <img src={placeholderImg} alt="" className="h-full w-full object-contain p-1.5 opacity-70" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-stone-600"><ImageIcon className="h-7 w-7" /></span>
          )}

          {/* طبقة تقدّم الرفع فوق المعاينة */}
          {busy && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 text-[11px] font-bold text-gold-200">
              {pct > 0 ? `${pct}%` : '…'}
              <span className="h-1 w-12 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-gold-400 transition-all" style={{ width: `${pct || 8}%` }} />
              </span>
            </span>
          )}
          {done && !busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 text-white">
              <CheckIcon className="h-8 w-8 drop-shadow" />
            </span>
          )}
          {/* عند مرور الماوس: أيقونة كاميرا تشير أن الصورة نفسها زرّ تبديل */}
          {!busy && !done && (
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/45 text-cream opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
              <CameraIcon className="h-6 w-6" />
            </span>
          )}
        </button>

        {/* الإجراءات */}
        <div className="min-w-0 flex-1">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

          {urlMode ? (
            <div className="flex items-center gap-1.5">
              <input
                type="url" dir="ltr" autoFocus className="input !py-2 text-sm" placeholder="https://..."
                value={value && value.startsWith('http') ? value : ''}
                onChange={(e) => onChange(e.target.value)}
              />
              <button type="button" onClick={() => setUrlMode(false)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-stone-400 hover:text-gold-200">
                {t('common.ok')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-400/20 disabled:opacity-50"
              >
                <CameraIcon className="h-3.5 w-3.5" />
                {busy ? t('common.loading') : hasImg ? t('image.change') : t('image.chooseFile')}
              </button>
              <button
                type="button" onClick={() => setUrlMode(true)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-stone-400 transition hover:text-gold-200"
              >
                <LinkIcon className="h-3.5 w-3.5" /> {t('image.url')}
              </button>
              {hasImg && (
                <button
                  type="button" onClick={() => onChange('')}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-stone-400 transition hover:text-red-300"
                >
                  <TrashIcon className="h-3.5 w-3.5" /> {t('image.remove')}
                </button>
              )}
            </div>
          )}

          {/* تلميح الاستخدام: السحب/اللصق — ما بيعرفها المالكة إلا إذا انكتبت */}
          <p className="mt-1.5 text-[11px] leading-snug text-stone-400">{hint || t('image.dropHint')}</p>
          {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
        </div>
      </div>
    </div>
  );
}

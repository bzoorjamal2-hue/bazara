import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon, CopyIcon, ArrowUpIcon, ArrowDownIcon } from './icons.jsx';

// عناصر إدخال مشتركة لكل نماذج لوحة التحكّم — مصدر واحد فتبقى كل الواجهات
// (إعدادات المتجر، محرّر الشرايح، نماذج المدير المستقبلية) بنفس الشكل والسلوك.

// تلميح منبثق: زر «؟» صغير بجانب التسمية يشرح الخانة عند الضغط — شرح وافٍ بلا زحمة بصرية
export function Tip({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`inline-flex h-[17px] w-[17px] items-center justify-center rounded-full border text-[10px] font-bold leading-none transition ${
          open ? 'border-gold-400 bg-gold-400/25 text-gold-200' : 'border-gold-400/40 text-gold-300/70 hover:border-gold-400 hover:text-gold-200'
        }`}
      >
        ؟
      </button>
      {open && (
        <span className="glass-strong absolute top-[22px] z-30 w-60 max-w-[70vw] p-2.5 text-[11px] font-normal leading-relaxed text-stone-200 start-0">
          {text}
        </span>
      )}
    </span>
  );
}

// خانة موحّدة: تسمية + تلميح منبثق + عدّاد أحرف + سطر إرشادي تحتها
export function Field({ label, tip, hint, icon, max, value = '', required = false, children }) {
  const len = String(value || '').length;
  return (
    <div>
      {(label || max) && (
        <div className="mb-1.5 flex items-end justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-stone-300">
            {icon}
            {label}
            {required && <span className="text-red-400/70">*</span>}
            <Tip text={tip} />
          </span>
          {max ? (
            <span className={`shrink-0 text-[10px] tabular-nums ${len > max * 0.88 ? 'text-amber-400' : 'text-stone-500'}`}>{len}/{max}</span>
          ) : null}
        </div>
      )}
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-stone-400">{hint}</p>}
    </div>
  );
}

// أدوات صفّ داخل قائمة (شريحة، فئة، مجموعة): ترتيب لأعلى/لأسفل، نسخ، حذف.
// الترتيب هنا هو ترتيب الظهور بالمتجر، فنُبقي الأدوات نفسها بكل القوائم.
//   onMove(dir) اختياري — تُخفى أسهم الترتيب إن لم يُمرَّر.
//   onDuplicate اختياري — يُعطَّل تلقائياً عند بلوغ الحد الأقصى (canDuplicate=false).
export function RowTools({ index, count, onMove, onDuplicate, onRemove, canDuplicate = true }) {
  const { t } = useTranslation();
  const btn = 'rounded-lg p-1.5 text-stone-400 transition disabled:pointer-events-none disabled:opacity-25';
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onMove && (
        <>
          <button
            type="button" onClick={() => onMove(-1)} disabled={index === 0}
            title={t('dashboard.store.moveUp')} aria-label={t('dashboard.store.moveUp')}
            className={`${btn} hover:bg-gold-400/10 hover:text-gold-200`}
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
          <button
            type="button" onClick={() => onMove(1)} disabled={index === count - 1}
            title={t('dashboard.store.moveDown')} aria-label={t('dashboard.store.moveDown')}
            className={`${btn} hover:bg-gold-400/10 hover:text-gold-200`}
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        </>
      )}
      {onDuplicate && (
        <button
          type="button" onClick={onDuplicate} disabled={!canDuplicate}
          title={t('dashboard.store.duplicate')} aria-label={t('dashboard.store.duplicate')}
          className={`${btn} hover:bg-gold-400/10 hover:text-gold-200`}
        >
          <CopyIcon className="h-4 w-4" />
        </button>
      )}
      <button
        type="button" onClick={onRemove}
        title={t('common.delete')} aria-label={t('common.delete')}
        className={`${btn} hover:bg-red-500/10 hover:text-red-300`}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// رأس قسم موحّد: بلاطة أيقونة ذهبية متدرّجة + عنوان + وصف + علامة اكتمال
export function SectionHead({ icon, title, desc, done }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400/25 to-gold-400/5 text-gold-300 ring-1 ring-gold-400/25">
        {icon}
        {done && (
          <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        )}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold leading-tight text-stone-100">{title}</h2>
        {desc && <p className="mt-1 text-xs leading-relaxed text-stone-400">{desc}</p>}
      </div>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon, CopyIcon, ArrowUpIcon, ArrowDownIcon, HelpIcon, XIcon } from './icons.jsx';

// عناصر إدخال مشتركة لكل نماذج لوحة التحكّم — مصدر واحد فتبقى كل الواجهات
// (إعدادات المتجر، محرّر الشرايح، نماذج المدير المستقبلية) بنفس الشكل والسلوك.

// تلميح منبثق: زر «؟» صغير بجانب التسمية يشرح الخانة عند الضغط — شرح وافٍ بلا زحمة بصرية
export function Tip({ text }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0); // إزاحة أفقية تُبقي النافذة داخل الشاشة
  const popRef = useRef(null);
  const wrapRef = useRef(null); // الزرّ والنافذة معاً — ما دونه يُعدّ «خارجاً»

  // الإغلاق بالضغط خارج التلميح أو بمفتاح Escape. كان معلّقاً على blur الزرّ
  // وحده: لا يصل دائماً على اللمس فتبقى النافذة مفتوحة، وكان يُغلقها لحظة
  // الضغط على نصّها فيتعذّر تحديده أو قراءته بإصبع عليه.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    // pointerdown في طور الالتقاط: يُغلق فور ملامسة الإصبع ولا يبتلعه عنصر
    // آخر يوقف انتشار الحدث (نافذة منبثقة، قائمة، بطاقة قابلة للضغط).
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // التلميح عرضه ثابت وينفتح من جهة البداية، فإن كان الزرّ قرب حافّة الشاشة
  // خرجت النافذة خارجها وانقصّت. نقيسها بعد الفتح ونزيحها للداخل بالقدر اللازم.
  useLayoutEffect(() => {
    if (!open) { setShift(0); return; }
    const el = popRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect(); // shift = 0 عند الفتح، فالقياس صافٍ
    const pad = 8;
    if (r.left < pad) setShift(Math.round(pad - r.left));
    else if (r.right > window.innerWidth - pad) setShift(Math.round(window.innerWidth - pad - r.right));
  }, [open]);

  if (!text) return null;
  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0 align-middle">
      {/* الأيقونة SVG لا حرفاً: تتمركز تماماً مع سطر التسمية بأي خط أو حجم
          (حرف «؟» كان ينزل عن السطر ويختلف وزنه بين الأجهزة) */}
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        // ذهبي صريح بنمط مباشر: أصناف gold تنقلب بنّية نهاراً، والنمط المباشر
        // يضمن اللون الذهبي بالوضعين ولا تُبطله أي قاعدة أخرى.
        className="inline-flex shrink-0 self-center rounded-full transition"
        style={open
          ? { color: '#cdbda4', background: 'rgba(176, 154, 126, 0.22)', boxShadow: '0 0 0 1px #b09a7e' }
          : { color: '#b09a7e' }}
      >
        <HelpIcon className="bz-help-glyph h-[15px] w-[15px] block" />
      </button>
      {open && (
        <span
          ref={popRef}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          className="glass-strong absolute top-[22px] z-30 w-60 max-w-[85vw] p-2.5 text-[11px] font-normal leading-relaxed text-stone-200 start-0 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

// خانة موحّدة: تسمية + تلميح منبثق + عدّاد أحرف + سطر إرشادي تحتها
export function Field({ label, tip, hint, icon, max, value = '', required = false, optional = false, children }) {
  const { t } = useTranslation();
  const len = String(value || '').length;
  return (
    <div>
      {(label || max) && (
        <div className="mb-1.5 flex items-end justify-between gap-2">
          {/* flex بلا wrap: التسمية تلتفّ داخل حيّزها والتلميح يبقى بجانبها
              متمركزاً معها رأسياً على كل المقاسات — كان flex-wrap يُنزله سطراً
              وحده على الشاشات الضيّقة. */}
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-stone-300">
            {icon}
            <span className="min-w-0">
              {label}
              {required && <span className="text-red-400">*</span>}
            </span>
            <Tip text={tip} />
            {/* «اختياري» علامةٌ على الحقل، مكانها بجانب اسمه لا سطراً تحت
                محتواه — هناك كانت تُقرأ وكأنها تصف ما فوقها. */}
            {optional && <span className="shrink-0 text-[10px] font-normal text-stone-400">({t('common.optional')})</span>}
          </span>
          {max ? (
            <span className={`shrink-0 text-[10px] tabular-nums ${len > max * 0.88 ? 'text-amber-400' : 'text-stone-400'}`}>{len}/{max}</span>
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

// رأس صفحة موحّد لكل تبويبات لوحة التحكّم: بلاطة أيقونة متدرّجة + عنوان ذهبي
// + سطر تعريفي. مصدر واحد كي تبدو كل التبويبات من عائلة واحدة، وأي تعديل
// على شكل الرأس ينطبق عليها جميعاً مرّةً واحدة.
// خانة تاريخ بزرّ مسح. خانة التاريخ الأصلية لا تتيح إفراغها بعد اختيار يوم على
// أغلب المتصفّحات والجوالات، فيبقى التاريخ لصيقاً رغماً عن المستخدمة. كان الزرّ
// مكتوباً داخل شاشة الكوبونات وحدها بينما بقيت ثلاث خانات تواريخ أخرى بلا مخرج.
export function DateInput({ value, onChange, type = 'date', clearLabel, className = '', ...rest }) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <input
        {...rest}
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`input ${value ? 'pe-10' : ''} ${className}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title={clearLabel || t('common.clearDate')}
          aria-label={clearLabel || t('common.clearDate')}
          className="absolute inset-y-0 end-2 my-auto grid h-7 w-7 place-items-center rounded-lg text-stone-400 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function PageHead({ icon, title, hint, action }) {
  const { t } = useTranslation();
  const hintRef = useRef(null);
  const [open, setOpen] = useState(false);   // التلميح الطويل مطويّ على الجوال
  const [long, setLong] = useState(false);   // هل يتجاوز السطرين أصلاً؟

  // نقيس بعد الرسم وعند تغيّر العرض: تلميح الطلبات فقرة كاملة تصير أسطراً
  // كثيرة على الجوال فتدفن العنوان، بينما هو سطر واحد على الحاسوب. لا نقيس
  // وهو مفتوح لأن الارتفاعين يتساويان حينها فيختفي زرّ الطيّ.
  useLayoutEffect(() => {
    const el = hintRef.current;
    if (!el || open) return undefined;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hint, open]);

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
      <span className="dash-ico flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12">
        {icon}
      </span>
      {/* items-start لا items-center: توسيط البلاطة أمام كتلة (عنوان + تلميح)
          يُنزلها مع طول التلميح، فبالطلبات ابتعدت ٣٢px عن عنوانها وبدت معلّقة
          أمام الفقرة. الآن تُحاذي سطر العنوان مهما طال ما تحته. */}
      {/* basis-0 مع flex-1: الكتلة تأخذ ما تبقّى من السطر ولا تُقاس بمحتواها */}
      <div className="min-w-0 flex-1 basis-0">
        <h1 className="gradient-text font-display text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
        {hint && (
          <>
            <p
              ref={hintRef}
              className={`mt-0.5 text-xs leading-relaxed text-stone-400 ${open ? '' : 'line-clamp-2 sm:line-clamp-none'}`}
            >
              {hint}
            </p>
            {long && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-0.5 text-[11px] font-semibold text-gold-300 underline-offset-2 hover:underline sm:hidden"
              >
                {open ? t('common.less') : t('common.more')}
              </button>
            )}
          </>
        )}
      </div>
      {/* الزرّ يأخذ سطراً كاملاً على الجوال بدل أن يسحق العنوان، ويعود لجانبه
          على الحاسوب. كان shrink-0 يُبقيه بالسطر الأول فينضغط النص إلى ٦٠px
          ويتحوّل التلميح إلى ١٤ سطراً. وإن كانت الإجراءات أكثر من واحد تتراصّ
          عمودياً على الجوال: اقتسام السطر يجعل التسمية الطويلة تلتفّ فيختلف
          ارتفاع الزرّين. */}
      {action && (
        <div className="w-full sm:w-auto sm:shrink-0 [&>*]:w-full sm:[&>*]:w-auto [&>span]:flex [&>span]:flex-col [&>span]:items-stretch sm:[&>span]:flex-row sm:[&>span]:items-center [&>span>*]:flex-1 sm:[&>span>*]:flex-none">
          {action}
        </div>
      )}
    </div>
  );
}

// رأس قسم موحّد: بلاطة أيقونة هادئة + عنوان + وصف + علامة اكتمال
export function SectionHead({ icon, title, desc, done }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="dash-ico-sec relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
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

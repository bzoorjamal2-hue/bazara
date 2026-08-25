import { useTranslation } from 'react-i18next';

// شريط إعلانات متحرّك (News Ticker) فخم وهادئ — خلفية شامبين/كريمية بنص خمري ونجمة
// ذهبية فاصلة. يقبل عدّة إعلانات (كل سطر إعلان) ويعرضها بتتابع متّصل سلس بلا تقطّع
// (نسختان متطابقتان من القائمة + سرعة تتناسب تلقائياً مع عدد الإعلانات).
export default function AnnouncementBar({ ar, en }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const rtl = !isEn;
  // نص الشريط يتبع اللغة: إنجليزي عند en (مع رجوع للعربي إن كان فارغاً) والعكس
  const text = (isEn ? (en || ar) : (ar || en)) || '';
  const items = String(text).split('\n').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return null;

  // نكرّر بعدد كافٍ ثابت (≥12 عنصر بكل مجموعة) فيتجاوز المسار أي شاشة دائماً → بلا
  // قياس وبلا فراغ/اختفاء. مجموعتان متطابقتان + translateX(-50%) = التفاف سلس متصل.
  const reps = Math.max(1, Math.ceil(12 / items.length));
  const groupCount = reps * items.length;
  // المدة تتناسب مع طول النص الكلي → سرعة طبيعية ثابتة مهما طال الإعلان أو قصُر
  const charLen = items.join('  ').length || 8;
  const dur = Math.min(140, Math.max(28, reps * charLen * 0.5));
  const Group = ({ hidden }) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {Array.from({ length: groupCount }).map((_, k) => (
        <span key={k} className="ann-text flex items-center gap-2.5 whitespace-nowrap px-6 text-[13px] font-extrabold tracking-wide" dir="auto">
          <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-[#f4dc93] drop-shadow-[0_0_5px_rgba(224,194,95,.75)]" />
          {items[k % items.length]}
        </span>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="group relative -mx-4 mb-5 overflow-hidden border-y border-gold-400/60 bg-gradient-to-r from-[#1f130d] via-[#3f2a19] to-[#1f130d] py-2 shadow-[0_3px_14px_rgba(0,0,0,.4),inset_0_1px_0_rgba(224,194,95,.22),inset_0_-1px_0_rgba(0,0,0,.4)] sm:-mx-6">
      {/* خطّ ذهبي رفيع علوي وسفلي — يعطي حدّاً مزدوجاً فاخراً */}
      <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#f0d488]/70 to-transparent" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-[#f0d488]/45 to-transparent" />
      {/* توهّج دافئ خفيف بمنتصف الشريط خلف النص */}
      <span className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(80%_140%_at_50%_50%,rgba(224,194,95,.14),transparent_70%)]" />
      {/* لمعة ذهبية تمسح الشريط تلقائياً — تعطيه إحساس المعدن الفاخر */}
      <span className="animate-ann-shine pointer-events-none absolute inset-y-0 z-20 w-1/3 bg-[linear-gradient(105deg,transparent,rgba(255,244,210,.34)_50%,transparent)]" />
      <div
        className="relative z-[5] flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${dur}s`, animationDirection: rtl ? 'normal' : 'reverse' }}
      >
        <Group />
        <Group hidden />
      </div>
      {/* تلاشٍ ناعم عند الحوافّ ليبدو أكثر أناقة */}
      <span className="pointer-events-none absolute inset-y-0 left-0 z-20 w-14 bg-gradient-to-r from-[#1f130d] to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 z-20 w-14 bg-gradient-to-l from-[#1f130d] to-transparent" />
    </div>
  );
}

// نجمة لامعة أنيقة (فاصل الشريط)
function SparkleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2c.5 3.8 2.2 5.5 6 6-3.8.5-5.5 2.2-6 6-.5-3.8-2.2-5.5-6-6 3.8-.5 5.5-2.2 6-6Z" />
    </svg>
  );
}

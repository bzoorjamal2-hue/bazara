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
        <span key={k} className="flex items-center gap-2 whitespace-nowrap px-5 text-xs font-semibold tracking-wide text-[#5e4636]" dir="auto">
          <SparkleIcon className="h-3 w-3 shrink-0 text-[#c79a3a]" />
          {items[k % items.length]}
        </span>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="relative -mx-4 mb-5 overflow-hidden border-y border-gold-400/40 bg-gradient-to-r from-[#f5ead6] via-[#efe1c6] to-[#f5ead6] py-1.5 shadow-sm sm:-mx-6">
      <div
        className="flex w-max animate-marquee"
        style={{ animationDuration: `${dur}s`, animationDirection: rtl ? 'normal' : 'reverse' }}
      >
        <Group />
        <Group hidden />
      </div>
      {/* تلاشٍ ناعم عند الحوافّ ليبدو أكثر أناقة */}
      <span className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#f5ead6] to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#f5ead6] to-transparent" />
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

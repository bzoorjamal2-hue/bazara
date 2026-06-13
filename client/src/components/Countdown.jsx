import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// صيغة كلمة "يوم" حسب العدد (عربي: يوم/يومين/أيام)
function dayWord(n, t) {
  if (n === 1) return t('offer.dayOne');
  if (n === 2) return t('offer.dayTwo');
  if (n >= 3 && n <= 10) return t('offer.dayMany');
  return t('offer.dayOne');
}

function useTimeLeft(target) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const left = target - now;
  if (left <= 0) return null;
  const s = Math.floor(left / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = (n) => String(n).padStart(2, '0');

// عدّاد تنازلي لعرض بوقت محدود — يختفي تلقائياً عند انتهاء الوقت.
// variant: 'pill' (مدمج للبطاقات) | 'boxes' (فخم لصفحة المنتج)
export default function Countdown({ endsAt, variant = 'pill', className = '' }) {
  const { t } = useTranslation();
  const target = endsAt ? new Date(endsAt).getTime() : 0;
  const left = useTimeLeft(target);
  if (!left) return null;

  if (variant === 'boxes') {
    const Box = ({ value, label }) => (
      <div className="flex flex-col items-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b from-wine to-wine-dark font-display text-xl font-extrabold tabular-nums text-cream shadow-md ring-1 ring-gold-400/30 sm:h-14 sm:w-14 sm:text-2xl">
          {pad(value)}
        </span>
        <span className="mt-1 text-[10px] font-semibold text-wine/60">{label}</span>
      </div>
    );
    return (
      <div className={`inline-flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-red-500/10 to-rose-500/5 p-3 ring-1 ring-red-400/20 ${className}`}>
        <span className="flex items-center gap-1.5 text-xs font-bold text-red-500">🔥 {t('offer.endsIn')}</span>
        <div className="flex items-center gap-1.5" dir="ltr">
          {left.d > 0 && (<><Box value={left.d} label={dayWord(left.d, t)} /><span className="self-start pt-3 font-bold text-wine/30">:</span></>)}
          <Box value={left.h} label={t('offer.hours')} />
          <span className="self-start pt-3 font-bold text-wine/30">:</span>
          <Box value={left.m} label={t('offer.minutes')} />
          <span className="self-start pt-3 font-bold text-wine/30">:</span>
          <Box value={left.s} label={t('offer.seconds')} />
        </div>
      </div>
    );
  }

  // pill مدمج للبطاقات
  const time = left.d > 0
    ? `${left.d} ${dayWord(left.d, t)} ${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`
    : `${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm ${className}`}>
      <span aria-hidden>⏱️</span>
      <span dir="ltr" className="tabular-nums tracking-wide">{time}</span>
    </span>
  );
}

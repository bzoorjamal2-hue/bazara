import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// عدّاد تنازلي حيّ لعرض بوقت محدود — يختفي تلقائياً عند انتهاء الوقت.
export default function Countdown({ endsAt, className = '', label = false }) {
  const { t } = useTranslation();
  const target = endsAt ? new Date(endsAt).getTime() : 0;
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
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const time = d > 0 ? `${d}${t('offer.day')} ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm ${className}`}>
      <span aria-hidden>⏱️</span>
      {label && <span>{t('offer.endsIn')}</span>}
      <span dir="ltr" className="tabular-nums tracking-wide">{time}</span>
    </span>
  );
}

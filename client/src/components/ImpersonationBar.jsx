import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { impersonationInfo, stopImpersonation } from '../utils/impersonation.js';
import { EyeIcon, XIcon } from './icons.jsx';

// شريط جلسة «التصفّح كصاحبة المتجر».
//
// لا يُخفى ولا يُطوى بقصد: الخطر الحقيقيّ في هذه الميزة أن تنسى المديرة أنّها
// داخل حساب غيرها فتحسب طلباتها طلباتِها أو تعدّل إعداداً ظنّاً أنّه إعدادها.
// فالشريط ثابت فوق كل شيء، ويحمل اسم المتجر والوقت المتبقّي وزرّ خروجٍ واحد.
export default function ImpersonationBar() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(impersonationInfo);
  const [left, setLeft] = useState('');

  useEffect(() => {
    if (!info) return undefined;
    const tick = () => {
      const ms = (info.until || 0) - Date.now();
      if (ms <= 0) { stopImpersonation(); return; } // انتهت المهلة: نخرج بأنفسنا
      const m = Math.floor(ms / 60000);
      setLeft(m >= 1 ? t('admin.impLeftMin', { n: m }) : t('admin.impLeftSoon'));
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [info, t]);

  useEffect(() => { setInfo(impersonationInfo()); }, []);
  if (!info) return null;

  return (
    <div className="bz-imp-bar" role="status">
      <span className="bz-imp-ico" aria-hidden="true"><EyeIcon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-extrabold leading-tight">
          {t('admin.impNow', { name: info.storeName || info.name || info.email })}
        </span>
        <span className="block truncate text-[10.5px] leading-tight opacity-85">
          {t('admin.impNote')} · {left}
        </span>
      </span>
      <button type="button" onClick={stopImpersonation} className="bz-imp-exit app-tap">
        <XIcon className="h-3.5 w-3.5" /> {t('admin.impExit')}
      </button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { pushSupported, enablePush, disablePush, pushStatus } from '../utils/push.js';

// زر جرس الإشعارات بالشريط العلوي (للمشترك فقط): مضيء عند التفعيل، نقرة تبدّل الحالة.
export default function NavBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [status, setStatus] = useState('off'); // on | off | denied | unsupported
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) pushStatus().then(setStatus); }, [user]);

  if (!user || !pushSupported()) return null;
  const on = status === 'on';

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) { await disablePush(); setStatus('off'); }
      else { await enablePush(); setStatus('on'); }
    } catch { /* الإذن مرفوض أو غير مهيّأ — نتجاهل بهدوء */ }
    finally { setBusy(false); }
  };

  return (
    <button
      onClick={toggle}
      aria-label={t('push.title')}
      title={on ? t('push.on') : t('push.enable')}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
        on ? 'bg-gold-400/20 text-gold-500 shadow-[0_0_12px_-2px_rgba(212,175,55,0.7)]' : 'text-wine hover:bg-wine/10'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {on && <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-cream" />}
    </button>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { pushSupported, enablePush, disablePush, pushStatus } from '../utils/push.js';

// زر جرس الإشعارات (للمشترك فقط): مضيء عند التفعيل، نقرة تبدّل الحالة.
// variant='drawer' → نمط كريمي يليق بالدرج الخمري (بحد زر اللغة).
export default function NavBell({ variant = 'bar' }) {
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

  const drawer = variant === 'drawer';
  const base = 'relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 disabled:opacity-60';
  const look = drawer
    ? (on
        ? 'bg-gold-400 text-wine-dark ring-1 ring-gold-200/70'
        : 'bg-cream/15 text-cream hover:bg-cream/25')
    : (on
        ? 'bg-gold-400/20 text-gold-500'
        : 'text-wine hover:bg-wine/10');

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={t('push.title')}
      aria-pressed={on}
      title={on ? t('push.on') : t('push.enable')}
      className={`${base} ${look}`}
    >
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {/* نقطة حيّة خضراء ثابتة عند التفعيل (بلا وميض) */}
      {on && <span className={`absolute end-1 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ${drawer ? 'ring-wine-dark' : 'ring-cream'}`} />}
    </button>
  );
}

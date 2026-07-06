import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { pushSupported, enablePush, disablePush, pushStatus } from '../utils/push.js';

// أيقونة الجرس (تهتزّ لحظة التفعيل عبر كلاس bell-swing)
function BellGlyph({ on, ringing }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-[22px] w-[22px] ${ringing ? 'bell-swing' : ''}`}
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

// زر إشعارات التطبيق (للمشترك فقط).
// variant='row'    → بطاقة عصرية بمفتاح تبديل (iOS-style) داخل درج القائمة: أيقونة
//                    متوهّجة ذهبياً عند التفعيل + عنوان + حالة + سويتش منزلق ناعم.
// variant='drawer' → زر دائري كريمي مضغوط (للصفوف الضيقة).
// variant='bar'    → زر دائري خمري لشريط علوي فاتح.
export default function NavBell({ variant = 'bar' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [status, setStatus] = useState('off'); // on | off | denied | unsupported
  const [busy, setBusy] = useState(false);
  const [ringing, setRinging] = useState(false); // رنّة قصيرة لحظة التفعيل

  useEffect(() => { if (user) pushStatus().then(setStatus); }, [user]);

  if (!user || !pushSupported()) return null;
  const on = status === 'on';
  const denied = status === 'denied';

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setStatus('off');
      } else {
        await enablePush();
        setStatus('on');
        setRinging(true);
        setTimeout(() => setRinging(false), 800);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    } catch {
      // الإذن مرفوض أو غير مهيّأ — نعيد قراءة الحالة لعرض الإرشاد الصحيح
      pushStatus().then(setStatus);
    } finally {
      setBusy(false);
    }
  };

  // ───── البطاقة العصرية بمفتاح التبديل (داخل درج القائمة) ─────
  if (variant === 'row') {
    const subtitle = denied ? t('push.denied') : on ? t('push.rowOn') : t('push.rowOff');
    return (
      <div className={`mb-1 flex items-center gap-2.5 rounded-2xl p-2.5 ring-1 transition-colors duration-300 ${on ? 'bg-gold-400/15 ring-gold-400/40' : 'bg-cream/10 ring-cream/15'}`}>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            on
              ? 'bg-gradient-to-br from-gold-200 to-gold-400 text-wine-dark shadow-[0_0_20px_rgba(230,200,120,0.5)]'
              : 'bg-cream/15 text-cream'
          }`}
        >
          <BellGlyph on={on} ringing={ringing} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-cream">{t('push.rowTitle')}</p>
          <p className={`mt-0.5 line-clamp-1 text-[11px] leading-snug ${denied ? 'text-amber-300' : on ? 'text-gold-200' : 'text-cream/60'}`}>{subtitle}</p>
        </div>
        {/* مفتاح تبديل منزلق — أخضر ذهبي عند التفعيل، بحركة ناعمة */}
        <button
          role="switch"
          aria-checked={on}
          aria-label={t('push.title')}
          onClick={toggle}
          disabled={busy}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-60 ${
            on ? 'bg-gradient-to-r from-gold-300 to-gold-400 shadow-[0_0_12px_rgba(230,200,120,0.45)]' : 'bg-cream/20'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${
              on ? 'start-[calc(100%-1.625rem)]' : 'start-0.5'
            }`}
          >
            {/* علامة ✓ صغيرة داخل المقبض عند التفعيل */}
            {on && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-3.5 w-3.5 text-gold-500" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 13 4 4L19 7" />
              </svg>
            )}
          </span>
        </button>
      </div>
    );
  }

  // ───── الأزرار الدائرية المضغوطة (شريط علوي / صفوف ضيقة) ─────
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
      <BellGlyph on={on} ringing={ringing} />
      {on && <span className={`absolute end-1 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ${drawer ? 'ring-wine-dark' : 'ring-cream'}`} />}
    </button>
  );
}

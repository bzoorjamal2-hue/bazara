import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// تنبيه أنيق يظهر من الأعلى عند فقدان الاتصال، ويختفي تلقائياً بعد ثوانٍ.
export default function OfflineBanner() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const goOffline = () => setShow(true);
    const goOnline = () => setShow(false);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setShow(true);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // يختفي تلقائياً بعد ٤ ثوانٍ
  useEffect(() => {
    if (!show) return undefined;
    const id = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(id);
  }, [show]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="animate-toast-top flex items-center gap-2.5 rounded-2xl border border-gold-400/30 bg-wine-dark/95 px-4 py-2.5 text-sm font-medium text-cream shadow-2xl ring-1 ring-cream/10 backdrop-blur">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gold-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
        </svg>
        <span>{t('offline.message')}</span>
      </div>
    </div>
  );
}

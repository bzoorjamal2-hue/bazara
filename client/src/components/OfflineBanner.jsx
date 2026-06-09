import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// شريط أنيق يظهر عند فقدان الاتصال بالإنترنت — يذكّر المستخدم أن التصفّح الكامل يحتاج اتصالاً.
export default function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="animate-fade-up flex items-center gap-2.5 rounded-2xl bg-wine-dark/95 px-4 py-2.5 text-sm font-medium text-cream shadow-2xl ring-1 ring-cream/15 backdrop-blur">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cream/80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
        </svg>
        <span>{t('offline.message')}</span>
      </div>
    </div>
  );
}

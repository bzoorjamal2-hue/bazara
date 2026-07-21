import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// زر «العودة للأعلى» عائم — يظهر بعد التمرير لأسفل بمسافة كافية على الصفحات الطويلة.
// موضعه على جهة البداية (start) كي لا يتصادم مع زر واتساب العائم (end)، ومرفوع فوق
// الشريط السفلي. تصميم هادئ يطابق هوية الموقع.
export default function ScrollToTopButton() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // بلا requestAnimationFrame: لا يعمل بالتبويبات الخلفية، و React يتجاهل نفس القيمة
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      className="fixed start-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-wine/90 text-cream shadow-lg ring-1 ring-cream/20 transition hover:bg-wine hover:scale-110 active:scale-95 animate-fade-in"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}

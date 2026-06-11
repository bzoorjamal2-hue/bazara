import { useLocation } from 'react-router-dom';
import { WhatsAppIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { isStandalone } from '../utils/pwa.js';

// زر واتساب عائم (يظهر في صفحات المتجر العامة)
export default function FloatingWhatsApp({ number, message = '' }) {
  const { pathname } = useLocation();
  if (!number) return null;
  // داخل التطبيق المثبّت يظهر شريط تنقّل سفلي على الصفحات غير المتجر → نرفع الزر فوقه كي لا يُقصّ
  const isStore = /^\/store\//.test(pathname);
  const raised = isStandalone() && !isStore;
  return (
    <a
      href={buildWhatsappLink(number, message)}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className="fixed end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110"
      style={{
        background: 'linear-gradient(135deg,#25d366,#1da851)',
        bottom: raised ? 'calc(env(safe-area-inset-bottom, 0px) + 78px)' : 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

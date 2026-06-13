import { WhatsAppIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { isStandalone } from '../utils/pwa.js';

// زر واتساب عائم (يظهر في صفحات المتجر العامة)
export default function FloatingWhatsApp({ number, message = '' }) {
  if (!number) return null;
  // داخل التطبيق المثبّت يظهر شريط تنقّل سفلي → نرفع الزر فوقه بمسافة مريحة كي لا يبدو لاصقاً به
  const raised = isStandalone();
  return (
    <div
      className="fixed end-5 z-40 h-14 w-14 wa-bob"
      style={{ bottom: raised ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)' : 'calc(env(safe-area-inset-bottom, 0px) + 22px)' }}
    >
      {/* حلقتان نابضتان تجذبان الانتباه */}
      <span className="absolute inset-0 rounded-full bg-[#25d366] opacity-60 animate-ping" />
      <span className="absolute inset-0 rounded-full bg-[#25d366]/40 wa-pulse" />
      <a
        href={buildWhatsappLink(number, message)}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110"
        style={{ background: 'linear-gradient(135deg,#25d366,#1da851)' }}
      >
        <WhatsAppIcon className="h-7 w-7 transition-transform duration-300 group-hover:rotate-[8deg]" />
      </a>
    </div>
  );
}

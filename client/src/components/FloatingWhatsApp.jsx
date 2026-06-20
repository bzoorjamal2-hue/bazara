import { WhatsAppIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';

// زر واتساب عائم (يظهر في صفحات المتجر العامة) — مرفوع فوق الشريط السفلي دائماً
export default function FloatingWhatsApp({ number, message = '' }) {
  if (!number) return null;
  return (
    <div
      className="fixed end-5 z-40 h-14 w-14 fab-float"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {/* هالة ضوئية ناعمة تتنفّس خلف الزر */}
      <span className="fab-aura pointer-events-none absolute -inset-1.5 rounded-full bg-[#25d366] blur-lg" />
      <a
        href={buildWhatsappLink(number, message)}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full text-white ring-1 ring-white/25 transition-all duration-300 hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(150deg,#34e07a,#1da851)', boxShadow: '0 10px 26px -8px rgba(29,168,81,0.7)' }}
      >
        <WhatsAppIcon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
      </a>
    </div>
  );
}

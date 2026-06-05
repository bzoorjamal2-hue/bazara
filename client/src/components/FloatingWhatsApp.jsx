import { WhatsAppIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';

// زر واتساب عائم (يظهر في صفحات المتجر العامة)
export default function FloatingWhatsApp({ number, message = '' }) {
  if (!number) return null;
  return (
    <a
      href={buildWhatsappLink(number, message)}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110"
      style={{ background: 'linear-gradient(135deg,#25d366,#1da851)' }}
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

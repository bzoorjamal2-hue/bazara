import { WhatsAppIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';

// زر واتساب عائم (يظهر في صفحات المتجر العامة) — مرفوع فوق الشريط السفلي دائماً.
// تصميم هادئ فخم بلا وميض/طفو: ظل ناعم + تكبير خفيف عند اللمس فقط.
export default function FloatingWhatsApp({ number, message = '' }) {
  if (!number) return null;
  return (
    <a
      href={buildWhatsappLink(number, message)}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className="bz-fab-pos bz-fab-wa fixed end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--bz-fab-bottom))' }}
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

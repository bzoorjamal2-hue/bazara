import { WhatsAppIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { useTheme } from '../context/ThemeContext.jsx';

// زر واتساب عائم (يظهر في صفحات المتجر العامة) — مرفوع فوق الشريط السفلي دائماً.
// تصميم هادئ فخم بلا وميض/طفو: ظل ناعم + تكبير خفيف عند اللمس فقط.
export default function FloatingWhatsApp({ number, message = '' }) {
  const { dark } = useTheme();
  if (!number) return null;
  const grad = dark ? 'linear-gradient(150deg,#2f9d63,#15623d)' : 'linear-gradient(150deg,#34e07a,#1da851)';
  const shadow = dark
    ? '0 10px 24px -10px rgba(34,120,78,0.6), 0 2px 6px -2px rgba(0,0,0,0.3)'
    : '0 12px 28px -10px rgba(29,168,81,0.55), 0 2px 6px -2px rgba(0,0,0,0.18)';
  return (
    <a
      href={buildWhatsappLink(number, message)}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className="group fixed end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white ring-1 ring-white/25 transition-transform duration-300 hover:scale-110 active:scale-95"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)', background: grad, boxShadow: shadow }}
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

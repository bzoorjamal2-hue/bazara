import { WhatsAppIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { useTheme } from '../context/ThemeContext.jsx';

// زر واتساب عائم (يظهر في صفحات المتجر العامة) — مرفوع فوق الشريط السفلي دائماً.
// ألوان هادئة فخمة تتأقلم مع الوضعين: أخضر زمرّدي عميق ليلاً، أخضر حيوي نهاراً.
export default function FloatingWhatsApp({ number, message = '' }) {
  const { dark } = useTheme();
  if (!number) return null;
  const grad = dark ? 'linear-gradient(150deg,#2f9d63,#15623d)' : 'linear-gradient(150deg,#34e07a,#1da851)';
  const shadow = dark ? '0 8px 22px -10px rgba(34,120,78,0.55)' : '0 10px 26px -8px rgba(29,168,81,0.65)';
  const aura = dark ? '#2c8a5a' : '#25d366';
  return (
    <div
      className="fixed end-5 z-40 h-14 w-14 fab-float"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {/* هالة ضوئية ناعمة تتنفّس خلف الزر — أخفت ليلاً */}
      <span
        className="fab-aura pointer-events-none absolute -inset-1.5 rounded-full blur-lg"
        style={{ backgroundColor: aura, opacity: dark ? 0.5 : 1 }}
      />
      <a
        href={buildWhatsappLink(number, message)}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full text-white ring-1 ring-white/20 transition-all duration-300 hover:scale-105 active:scale-95"
        style={{ background: grad, boxShadow: shadow }}
      >
        <WhatsAppIcon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
      </a>
    </div>
  );
}

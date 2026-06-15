// زر إغلاق موحّد بأيقونة X متمركزة تماماً — يوحّد شكل الإغلاق بكل قوائم الموقع
// ويحلّ مشكلة رمز ✕ النصّي الذي يظهر مرتفعاً/غير متمركز.
const LOOKS = {
  cream: 'bg-cream text-wine hover:bg-white shadow-sm',          // على الأدراج الخمرية الداكنة
  wine: 'bg-wine/10 text-wine hover:bg-wine hover:text-cream',   // على النوافذ البيضاء/الفاتحة
  ghost: 'bg-white/15 text-white hover:bg-white/25 backdrop-blur', // فوق الصور/الفيديو الداكن
  dark: 'bg-black/40 text-white hover:bg-black/60 backdrop-blur',
};

export default function CloseButton({ onClick, variant = 'wine', size = 'h-9 w-9', className = '', label = 'close' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex ${size} shrink-0 items-center justify-center rounded-full transition ${LOOKS[variant] || LOOKS.wine} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

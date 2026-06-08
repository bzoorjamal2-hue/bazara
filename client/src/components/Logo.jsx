// شعار Bazara: دائرة عاجية أنيقة بحلقة ذهبية + حرف B خمري + قوس ذهبي ناعم.
export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bazaraGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6c878" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#b8932c" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#F8F3EC" stroke="url(#bazaraGold)" strokeWidth="3" />
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Playfair Display', serif"
        fontWeight="800"
        fontSize="50"
        fill="#5C1A2E"
      >
        B
      </text>
      <path d="M33 70 Q50 78 67 70" fill="none" stroke="url(#bazaraGold)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// شعار Bazara — ختم بوتيك فاخر: قرص عاجي بتدرّج ناعم، حلقتان ذهبيتان (كريست)،
// حرف B خمري "منقوش" بظل ذهبي خلفه، قوس ذهبي سفلي بماستين صغيرتين.
// أشكال جريئة تبقى واضحة حتى بالمقاس الصغير (شريط التنقّل h-9).
export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bazaraGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6c878" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#b8932c" />
        </linearGradient>
        <radialGradient id="bazaraIvory" cx="0.38" cy="0.3" r="0.95">
          <stop offset="0" stopColor="#FFFDF7" />
          <stop offset="1" stopColor="#F0E7D5" />
        </radialGradient>
      </defs>

      {/* القرص العاجي بحلقة ذهبية خارجية + حلقة داخلية رفيعة (كريست) */}
      <circle cx="50" cy="50" r="47" fill="url(#bazaraIvory)" stroke="url(#bazaraGold)" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="url(#bazaraGold)" strokeWidth="1" opacity="0.75" />

      {/* B منقوشة: نسخة ذهبية مزاحة خلف الخمرية — إحساس نقش مطبعي فاخر */}
      {/* وزن 700 (المُحمّل فعلاً من غوغل — 800 غير موجود فكان يصطنع/يتأخر) + سلسلة
          بدائل serif نظامية فيظهر حرف B أنيقاً فوراً قبل وصول الخط، بلا "شعار يتأخر" */}
      <text
        x="51.8"
        y="53.8"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="46"
        fill="url(#bazaraGold)"
        opacity="0.85"
      >
        B
      </text>
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="46"
        fill="#4a3628"
      >
        B
      </text>

      {/* قوس ذهبي سفلي بماستين صغيرتين على طرفيه */}
      <path d="M32 69 Q50 77.5 68 69" fill="none" stroke="url(#bazaraGold)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M26.5 64.6 l2 2 -2 2 -2 -2 Z" fill="url(#bazaraGold)" />
      <path d="M73.5 64.6 l2 2 -2 2 -2 -2 Z" fill="url(#bazaraGold)" />
    </svg>
  );
}

// شعار Bazara: حرف B بخط سيرف فاخر داخل شارة ذهبية متدرّجة مع حلقة رفيعة.
export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <span
      className={`${className} relative inline-flex items-center justify-center rounded-xl shadow-gold`}
      style={{ background: 'linear-gradient(135deg,#f6edcf 0%,#e0c25f 40%,#b8932c 100%)' }}
    >
      {/* حلقة داخلية رفيعة للعمق */}
      <span className="pointer-events-none absolute inset-[3px] rounded-[8px] border border-ink-950/25" />
      <span
        className="relative font-extrabold leading-none text-ink-950"
        style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.15em' }}
      >
        B
      </span>
    </span>
  );
}

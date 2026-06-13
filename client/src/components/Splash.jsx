// شاشة افتتاح خفيفة بهوية بازارا — تظهر أثناء التحقق من جلسة محفوظة كي لا يومض
// المستخدم على شاشة الترحيب قبل الدخول للوحة التحكم.
export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: '#F4EDE2' }}>
      <div className="flex flex-col items-center">
        <span className="font-display text-5xl font-extrabold tracking-wide text-wine">Bazara</span>
        <span className="mt-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.35em] text-wine/45">
          <span className="h-px w-5 bg-wine/25" /> بازارا <span className="h-px w-5 bg-wine/25" />
        </span>
        <span className="mt-6 h-7 w-7 animate-spin rounded-full border-2 border-wine/20 border-t-wine" />
      </div>
    </div>
  );
}

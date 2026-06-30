import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// قائمة منسدلة مخصّصة وأنيقة بثيم الموقع (بديل عن <select> الأصلي القبيح).
// تُرسَم القائمة عبر Portal على مستوى الصفحة بموضع ثابت محسوب من زر الفتح،
// فلا تقصّها ولا تغطّيها أي حاوية فيها overflow (نوافذ/بطاقات) — تظهر دائماً كاملة وفوق كل شيء.
// options: [{ value, label }] — onChange يُمرّر القيمة المختارة.
export default function Select({ value, onChange, options, className = '', placeholder = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { left, width, top, bottom, dropUp }
  const ref = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  const computePos = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // تفتح للأعلى إن لم تكفِ المساحة بالأسفل وكانت المساحة فوقها أوسع
    const dropUp = window.innerHeight - r.bottom < 280 && r.top > window.innerHeight - r.bottom;
    setPos({ left: r.left, width: r.width, top: r.bottom, bottom: window.innerHeight - r.top, dropUp });
  };

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) computePos();
      return next;
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    // عند التمرير/تغيير الحجم نعيد حساب موضع القائمة لتتبع الزر (بدل إغلاقها)،
    // ونغلق فقط إذا خرج الزر نفسه عن الشاشة. هذا يسمح بالتمرير داخل القائمة أو
    // داخل النوافذ المنبثقة دون أن تُغلق القائمة. (التمرير داخل القائمة نفسها لا يحرّك الزر)
    const reposition = (e) => {
      if (menuRef.current && e?.target && menuRef.current.contains(e.target)) return; // تمرير داخل القائمة ذاتها
      if (!ref.current) { setOpen(false); return; }
      const r = ref.current.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) { setOpen(false); return; }
      computePos();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true); // capture: يلتقط تمرير الحاويات الداخلية
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`input flex items-center justify-between gap-2 ${className}`}
      >
        <span className={selected ? '' : 'text-stone-400'}>{selected ? selected.label : placeholder}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-wine/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="animate-pop fixed z-[120] max-h-64 overflow-auto rounded-2xl border border-wine/15 bg-white p-1.5 shadow-2xl"
          style={{
            left: pos.left,
            width: pos.width,
            ...(pos.dropUp ? { bottom: pos.bottom + 6 } : { top: pos.top + 6 }),
          }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-start text-sm transition ${
                  active ? 'bg-wine/10 font-semibold text-wine' : 'text-[#2b2b2b] hover:bg-wine/5'
                }`}
              >
                <span className="min-w-0 break-words">{o.label}</span>
                {active && (
                  <svg className="h-4 w-4 shrink-0 text-wine" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

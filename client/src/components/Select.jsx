import { useEffect, useRef, useState } from 'react';

// قائمة منسدلة مخصّصة وأنيقة بثيم الموقع (بديل عن <select> الأصلي القبيح).
// options: [{ value, label }] — onChange يُمرّر القيمة المختارة.
export default function Select({ value, onChange, options, className = '', placeholder = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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

      {open && (
        <div className="animate-pop absolute z-[60] mt-1.5 max-h-64 w-full min-w-max overflow-auto rounded-2xl border border-wine/15 bg-white p-1.5 shadow-2xl">
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
                <span className="whitespace-nowrap">{o.label}</span>
                {active && (
                  <svg className="h-4 w-4 shrink-0 text-wine" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

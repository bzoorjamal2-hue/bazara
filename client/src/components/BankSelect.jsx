import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import BANKS from '../utils/banks.js';

export default function BankSelect({ value, onChange }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const selected = BANKS.find((b) => b.code === value);

  const filtered = search
    ? BANKS.filter((b) => {
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.nameAr.includes(q) || b.code.toLowerCase().includes(q);
      })
    : BANKS;

  const computePos = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dropUp = window.innerHeight - r.bottom < 340 && r.top > window.innerHeight - r.bottom;
    setPos({ left: r.left, width: r.width, top: r.bottom, bottom: window.innerHeight - r.top, dropUp });
  };

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) { computePos(); setSearch(''); }
      return next;
    });
  };

  const pick = (bank) => {
    onChange(bank);
    setOpen(false);
    setSearch('');
  };

  useEffect(() => {
    if (!open) return undefined;
    requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const reposition = (e) => {
      if (menuRef.current && e?.target && menuRef.current.contains(e.target)) return;
      if (!ref.current) { setOpen(false); return; }
      const r = ref.current.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) { setOpen(false); return; }
      computePos();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, { capture: true });
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="input flex items-center justify-between gap-2"
      >
        <span className={selected ? '' : 'text-stone-400'} dir="ltr">
          {selected ? `${selected.name}${isAr ? ` — ${selected.nameAr}` : ''}` : (isAr ? 'اختاري البنك…' : 'Select bank…')}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="bz-select-menu animate-pop fixed z-[120] overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            left: pos.left,
            width: pos.width,
            ...(pos.dropUp ? { bottom: pos.bottom + 6 } : { top: pos.top + 6 }),
          }}
        >
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              className="input w-full text-sm"
              placeholder={isAr ? 'ابحثي عن البنك…' : 'Search bank…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              dir="auto"
            />
          </div>
          <div className="max-h-60 overflow-auto p-1.5 pt-0">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-stone-400">{isAr ? 'لا نتائج' : 'No results'}</p>
            )}
            {filtered.map((b) => {
              const active = b.code === value;
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => pick(b)}
                  className={`bz-select-opt flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition ${active ? 'is-active' : ''}`}
                >
                  <span className="min-w-0" dir="ltr">
                    <span className="font-medium">{b.name}</span>
                    {isAr && <span className="ms-2 text-stone-400 dark:text-stone-500 text-xs">({b.nameAr})</span>}
                  </span>
                  {active && (
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import { useState } from 'react';

// عرض النجوم (للقراءة) أو اختيارها (تفاعلي عند تمرير onChange)
export default function StarRating({ value = 0, onChange, size = 'text-base', count = 5 }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === 'function';
  const active = hover || value;

  return (
    <div className={`inline-flex ${size}`} dir="ltr">
      {Array.from({ length: count }).map((_, i) => {
        const n = i + 1;
        const filled = n <= active;
        return interactive ? (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className={`px-0.5 transition ${filled ? 'star-on' : 'star-off'} hover:scale-110`}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ) : (
          <span key={n} className={filled ? 'star-on' : 'star-off'}>
            ★
          </span>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function ShieldIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 3v5c0 4.5-3 7.8-8 10-5-2.2-8-5.5-8-10V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function TruckIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </svg>
  );
}
function ExchangeIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h13l-3-3M20 15H7l3 3" />
    </svg>
  );
}
function TagIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12l9-9 9 9-9 9-9-9z" opacity="0" />
      <path d="M20.5 13.5l-7 7a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1-.5-1.3V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l6.1 6.1a2 2 0 0 1 0 2.8z" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function StarBoxIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.6 3.2 3.4.5-2.5 2.4.6 3.4L12 11.9 8.9 12.5l.6-3.4L7 6.7l3.4-.5L12 3z" />
      <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </svg>
  );
}

// شريط مزايا المتجر — يظهر بآخر الصفحة، أنيق ومنسّق بألوان المتجر.
export default function FeaturesBar() {
  const { t } = useTranslation();
  const items = [
    { Icon: ShieldIcon, title: t('store.featSecurity') },
    { Icon: TruckIcon, title: t('store.featDelivery') },
    { Icon: ExchangeIcon, title: t('store.featExchange') },
    { Icon: TagIcon, title: t('store.featPrices') },
    { Icon: StarBoxIcon, title: t('store.featExclusive') },
  ];

  const PER = 2; // ميزتان بنفس الوقت
  const [page, setPage] = useState(0);
  const pages = Math.ceil(items.length / PER);
  const shown = items.slice(page * PER, page * PER + PER);
  const go = (d) => setPage((p) => (p + d + pages) % pages);

  const Arrow = ({ dir, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'next' ? 'next' : 'prev'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wine/20 bg-white text-wine shadow-sm transition hover:bg-wine hover:text-cream"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'next' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  );

  return (
    <section className="mt-12">
      <div className="mx-auto flex max-w-xl items-center gap-2 sm:gap-3">
        <Arrow dir="prev" onClick={() => go(-1)} />
        <div className="flex flex-1 justify-center gap-3">
          {shown.map(({ Icon, title }, i) => (
            <div
              key={i}
              className="flex w-full max-w-[210px] flex-col items-center gap-2 rounded-2xl border border-wine/10 bg-white p-4 text-center shadow-sm sm:p-5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-wine/10 text-wine">
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-bold leading-snug text-[#2b2b2b]">{title}</span>
            </div>
          ))}
          {/* عنصر فارغ لموازنة الصفحة الأخيرة (ميزة واحدة) */}
          {shown.length < PER && <div className="w-full max-w-[210px]" aria-hidden="true" />}
        </div>
        <Arrow dir="next" onClick={() => go(1)} />
      </div>

      {/* نقاط التنقّل */}
      <div className="mt-4 flex justify-center gap-1.5">
        {Array.from({ length: pages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            aria-label={`page ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === page ? 'w-5 bg-wine' : 'w-1.5 bg-wine/25'}`}
          />
        ))}
      </div>
    </section>
  );
}

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
  return (
    <section className="mt-12 -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-3 sm:justify-center">
        {items.map(({ Icon, title }, i) => (
          <div
            key={i}
            className="flex min-w-[108px] flex-1 flex-col items-center gap-2 rounded-2xl border border-wine/10 bg-white p-4 text-center shadow-sm sm:min-w-0 sm:max-w-[160px]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-wine/10 text-wine">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-xs font-bold leading-snug text-[#2b2b2b]">{title}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

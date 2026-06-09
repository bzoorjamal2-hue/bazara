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

// شريط مزايا المتجر (أمان · توصيل · تبديل) — بطاقات أنيقة.
export default function FeaturesBar() {
  const { t } = useTranslation();
  const items = [
    { Icon: ShieldIcon, title: t('store.featSecurity'), desc: t('store.featSecurityDesc') },
    { Icon: TruckIcon, title: t('store.featDelivery'), desc: t('store.featDeliveryDesc') },
    { Icon: ExchangeIcon, title: t('store.featExchange'), desc: t('store.featExchangeDesc') },
  ];
  return (
    <section className="mb-9 grid grid-cols-3 gap-3 sm:gap-4">
      {items.map(({ Icon, title, desc }, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-2 rounded-2xl border border-wine/10 bg-white p-3 text-center shadow-sm sm:p-5"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wine/10 text-wine sm:h-12 sm:w-12">
            <Icon className="h-6 w-6" />
          </span>
          <span className="text-xs font-bold text-[#2b2b2b] sm:text-sm">{title}</span>
          <span className="hidden text-[11px] leading-snug text-stone-400 sm:block">{desc}</span>
        </div>
      ))}
    </section>
  );
}

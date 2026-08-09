import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GiftIcon } from './icons.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';

// فوتر المتجر: هوية المتجر + أيقونات تواصل مربوطة بحسابات المشترك + تتبّع الطلب/شاركي واربحي.
// مشترَك بين صفحة المتجر وصفحة المنتج كي تبقى الهوية خاصّة بالمتجر (لا فوتر بازارا العام).
export default function StoreFooter({ store, wa, onShare }) {
  const { t, i18n } = useTranslation();
  const ltr = i18n.language === 'en';
  const ig = store.instagram ? `https://instagram.com/${store.instagram.replace(/^@/, '')}` : '';
  const fb = store.facebook ? (/^https?:\/\//.test(store.facebook) ? store.facebook : `https://facebook.com/${store.facebook.replace(/^@/, '')}`) : '';
  const waLink = wa ? buildWhatsappLink(wa) : '';
  const socials = [
    waLink && { label: 'WhatsApp', href: waLink, icon: <WAGlyph /> },
    ig && { label: 'Instagram', href: ig, icon: <IGGlyph /> },
    fb && { label: 'Facebook', href: fb, icon: <FBGlyph /> },
  ].filter(Boolean);

  return (
    <footer className="pub-footer relative -mx-4 -mb-8 mt-16 overflow-hidden sm:-mx-6 sm:mt-20">
      {/* توهّج ذهبي ناعم بأعلى الفوتر — انتقال أنيق من المحتوى (كفوتر المنصّة) */}
      <span aria-hidden className="pointer-events-none absolute -top-24 start-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-gold-400/10 blur-3xl" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 text-center sm:px-6">
        <p className="font-display text-2xl font-bold text-cream">{store.name}</p>
        {store.description && <p className="mx-auto mt-2 max-w-md text-sm text-cream/70">{store.description}</p>}
        {socials.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/25 text-cream/90 transition duration-300 hover:-translate-y-0.5 hover:border-gold-400/60 hover:bg-cream/10 hover:text-gold-200"
              >
                {s.icon}
              </a>
            ))}
          </div>
        )}
        {/* تتبّع الطلب — بنفس نمط "شاركي واربحي" (شفّاف بنص كريمي واضح بالوضعين).
            نحمل نطاق المتجر (?store=) كي تبقى صفحة التتبّع بهوية المتجر لا الموقع العام. */}
        <Link
          to={`/track?store=${store.slug}`}
          className="group mx-auto mt-7 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-cream/30 px-5 py-3.5 text-start text-cream transition hover:-translate-y-0.5 hover:bg-cream/10"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream/15 text-cream">
            <TruckGlyph />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold leading-snug">{t('nav.track')}</span>
            <span className="mt-1 line-clamp-2 text-xs leading-snug text-cream/70">{t('track.hint')}</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cream/60 transition group-hover:text-cream" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ltr ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </Link>
        {/* شاركي واربحي — يظهر فقط إن فعّل المتجر برنامج الإحالة */}
        {Number(store.referralPercent) > 0 && onShare && (
          <button
            type="button"
            onClick={onShare}
            className="group mx-auto mt-3 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-cream/30 px-5 py-3.5 text-start text-cream transition hover:-translate-y-0.5 hover:bg-cream/10"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream/15" aria-hidden="true"><GiftIcon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-bold leading-snug">{t('referral.shareTitle')}</span>
              <span className="mt-1 line-clamp-2 text-xs leading-snug text-cream/70">{t('referral.shareDesc', { percent: Number(store.referralPercent) })}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cream/60 transition group-hover:text-cream" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ltr ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
            </svg>
          </button>
        )}
        <div className="mx-auto mt-7 h-px max-w-md bg-cream/15" />
        <p className="mt-5 text-xs text-cream/60">© {new Date().getFullYear()} {store.name} — {t('footer.rights')}</p>
      </div>
    </footer>
  );
}

// شاحنة توصيل أنيقة (لزر تتبّع الطلب)
function TruckGlyph({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H14a1 1 0 0 1 1 1v9H3.5A.5.5 0 0 1 3 14.5Z" />
      <path d="M15 8h3.2a1 1 0 0 1 .8.4l2 2.7a1 1 0 0 1 .2.6V15h-6Z" />
      <circle cx="7.5" cy="17.5" r="1.9" />
      <circle cx="17" cy="17.5" r="1.9" />
      <path d="M9.4 17.5h5.7" />
    </svg>
  );
}

function WAGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648 3.973-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}
function IGGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FBGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6v1.9H16l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

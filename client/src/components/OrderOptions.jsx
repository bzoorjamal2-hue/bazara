import { useTranslation } from 'react-i18next';
import { buildWhatsappOrder } from '../utils/whatsapp.js';
import useScrollLock from '../hooks/useScrollLock.js';
import { XIcon, WhatsAppIcon, InstagramIcon, PhoneIcon } from './icons.jsx';

// نافذة تتيح للزبون اختيار طريقة الطلب (واتساب / إنستغرام / هاتف)
export default function OrderOptions({ store, items, onClose }) {
  const { t, i18n } = useTranslation();
  useScrollLock(true); // مفتوحة دائماً عند التركيب
  const { whatsapp, instagram, phone } = store || {};
  const hasAny = whatsapp || instagram || phone;

  const orderWhatsapp = () => {
    window.open(buildWhatsappOrder(whatsapp, items, i18n.language), '_blank');
    onClose();
  };
  const orderInstagram = () => {
    window.open(`https://instagram.com/${instagram}`, '_blank');
    onClose();
  };
  const callPhone = () => {
    window.location.href = `tel:${phone}`;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-strong w-full max-w-sm animate-fade-up p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold gradient-text">{t('order.choose')}</h3>
          <button onClick={onClose} aria-label={t('common.close')} className="text-stone-400 hover:text-gold-200"><XIcon className="h-5 w-5" /></button>
        </div>

        {!hasAny ? (
          <p className="text-sm text-stone-400">{t('order.noChannels')}</p>
        ) : (
          <div className="space-y-3">
            {whatsapp && (
              <button onClick={orderWhatsapp} className="btn-whatsapp w-full gap-2"><WhatsAppIcon className="h-5 w-5" /> {t('order.whatsapp')}</button>
            )}
            {instagram && (
              <button onClick={orderInstagram} className="btn w-full gap-2 text-white" style={{ background: 'linear-gradient(135deg,#feda75,#d62976 45%,#962fbf)' }}>
                <InstagramIcon className="h-5 w-5" /> {t('order.instagram')}
              </button>
            )}
            {phone && (
              <button onClick={callPhone} className="btn-ghost w-full gap-2" dir="ltr"><PhoneIcon className="h-5 w-5" /> {phone}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

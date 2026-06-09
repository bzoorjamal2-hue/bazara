import { useTranslation } from 'react-i18next';
import { buildWhatsappOrder } from '../utils/whatsapp.js';
import useScrollLock from '../hooks/useScrollLock.js';

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
          <button onClick={onClose} className="text-stone-400 hover:text-gold-200">✕</button>
        </div>

        {!hasAny ? (
          <p className="text-sm text-stone-400">{t('order.noChannels')}</p>
        ) : (
          <div className="space-y-3">
            {whatsapp && (
              <button onClick={orderWhatsapp} className="btn-whatsapp w-full">💬 {t('order.whatsapp')}</button>
            )}
            {instagram && (
              <button onClick={orderInstagram} className="btn w-full text-white" style={{ background: 'linear-gradient(135deg,#feda75,#d62976 45%,#962fbf)' }}>
                📸 {t('order.instagram')}
              </button>
            )}
            {phone && (
              <button onClick={callPhone} className="btn-ghost w-full" dir="ltr">📞 {phone}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

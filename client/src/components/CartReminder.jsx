import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { isStandalone } from '../utils/pwa.js';

// تذكير لطيف بالسلة المتروكة: إن عادت الزبونة وعندها قطع بالسلة، نُظهر تنبيهاً
// مرة واحدة في الجلسة يدعوها لإكمال الطلب.
export default function CartReminder() {
  const { t } = useTranslation();
  const { items, open, setOpen } = useCart();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!items.length) return undefined;
    try { if (sessionStorage.getItem('cart_reminded')) return undefined; } catch { /* ignore */ }
    const id = setTimeout(() => { if (!open) setShow(true); }, 1500);
    return () => clearTimeout(id);
    // مرّة واحدة عند الإقلاع
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show || !items.length) return null;
  const count = items.reduce((s, i) => s + i.qty, 0);
  const dismiss = () => { try { sessionStorage.setItem('cart_reminded', '1'); } catch { /* ignore */ } setShow(false); };
  const openCart = () => { dismiss(); setOpen(true); };

  return (
    <div
      className="animate-fade-up fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-wine/15 bg-white p-3 shadow-xl ring-1 ring-wine/5"
      style={{ bottom: isStandalone() ? 'calc(env(safe-area-inset-bottom,0px) + 86px)' : 'calc(env(safe-area-inset-bottom,0px) + 18px)' }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine/10 text-xl">🛍️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-wine">{t('cart.reminderTitle')}</p>
          <p className="text-xs text-stone-500">{t('cart.reminderText', { count })}</p>
        </div>
        <button onClick={openCart} className="shrink-0 rounded-full bg-wine px-4 py-2 text-xs font-bold text-cream transition hover:bg-wine-dark">
          {t('cart.reminderCta')}
        </button>
        <button onClick={dismiss} aria-label="close" className="shrink-0 p-1 text-stone-400 hover:text-stone-600">✕</button>
      </div>
    </div>
  );
}

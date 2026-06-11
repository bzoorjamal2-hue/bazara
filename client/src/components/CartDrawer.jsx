import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { buildWhatsappCheckout } from '../utils/whatsapp.js';
import useScrollLock from '../hooks/useScrollLock.js';
import Select from './Select.jsx';

// مناطق التوصيل ورسومها (قابلة للتعديل): مدن الضفة 20₪ · القدس 35₪ · مدن الداخل 70₪
const AREAS = [
  // مدن الضفة الغربية — 20₪
  { ar: 'رام الله والبيرة', en: 'Ramallah & Al-Bireh', fee: 25 },
  { ar: 'نابلس', en: 'Nablus', fee: 25 },
  { ar: 'الخليل', en: 'Hebron', fee: 25 },
  { ar: 'بيت لحم', en: 'Bethlehem', fee: 25 },
  { ar: 'جنين', en: 'Jenin', fee: 25 },
  { ar: 'طولكرم', en: 'Tulkarm', fee: 25 },
  { ar: 'قلقيلية', en: 'Qalqilya', fee: 25 },
  { ar: 'سلفيت', en: 'Salfit', fee: 25 },
  { ar: 'أريحا', en: 'Jericho', fee: 25 },
  { ar: 'طوباس', en: 'Tubas', fee: 25 },
  // القدس — 35₪
  { ar: 'القدس', en: 'Jerusalem', fee: 35 },
  // مدن الداخل (أراضي 48) — 70₪
  { ar: 'حيفا', en: 'Haifa', fee: 80 },
  { ar: 'يافا', en: 'Jaffa', fee: 80 },
  { ar: 'عكا', en: 'Acre', fee: 80 },
  { ar: 'الناصرة', en: 'Nazareth', fee: 80 },
  { ar: 'أم الفحم', en: 'Umm al-Fahm', fee: 80 },
  { ar: 'الطيبة', en: 'Tayibe', fee: 80 },
  { ar: 'الطيرة', en: 'Tira', fee: 80 },
  { ar: 'اللد', en: 'Lod', fee: 80 },
  { ar: 'الرملة', en: 'Ramla', fee: 80 },
  { ar: 'سخنين', en: 'Sakhnin', fee: 80 },
  { ar: 'شفاعمرو', en: 'Shefa-Amr', fee: 80 },
  { ar: 'باقة الغربية', en: 'Baqa al-Gharbiyye', fee: 80 },
  { ar: 'كفر قاسم', en: 'Kafr Qasim', fee: 80 },
  { ar: 'رهط', en: 'Rahat', fee: 80 },
  { ar: 'طمرة', en: 'Tamra', fee: 80 },
  { ar: 'عرابة', en: 'Arraba', fee: 80 },
  { ar: 'كفر كنا', en: 'Kafr Kanna', fee: 80 },
  { ar: 'المغار', en: 'Maghar', fee: 80 },
  // غير ذلك — يحدّده المتجر
  { ar: 'أخرى', en: 'Other', fee: 0 },
];

export default function CartDrawer() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language !== 'en';
  const { items, open, setOpen, remove, setQty, total, clear } = useCart();
  const [view, setView] = useState('cart'); // 'cart' | 'checkout'
  const [cust, setCust] = useState({ name: '', phone: '', city: '', address: '', notes: '' });
  const [err, setErr] = useState('');
  useScrollLock(open);

  if (!open) return null;

  const close = () => { setOpen(false); setView('cart'); setErr(''); };
  const cityOpt = AREAS.find((a) => (ar ? a.ar : a.en) === cust.city);
  const delivery = cityOpt ? cityOpt.fee : 0;
  const grand = total + delivery;

  const confirmOrder = () => {
    if (!cust.name.trim() || !cust.phone.trim() || !cust.city) { setErr(t('co.required')); return; }
    const wa = items[0]?.whatsapp || '';
    window.open(buildWhatsappCheckout(wa, items, { ...cust, delivery }, i18n.language), '_blank');
    clear();
    close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onClick={close}>
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md animate-slide-in flex-col border-s border-gold-400/20 bg-ink-900">
        {/* الرأس */}
        <div className="flex items-center justify-between border-b border-gold-400/15 p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold gradient-text">
            {view === 'checkout' && (
              <button onClick={() => setView('cart')} aria-label={t('co.back')} className="text-wine/70 hover:text-wine">
                {ar ? '→' : '←'}
              </button>
            )}
            {view === 'cart' ? `🛒 ${t('cart.title')}` : t('co.title')}
          </h2>
          <button onClick={close} className="rounded-lg p-2 text-stone-400 hover:text-gold-200">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-stone-400">
            <span className="text-5xl">🛍️</span>
            {t('cart.empty')}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {view === 'cart' ? (
              <motion.div key="cart" initial={{ opacity: 0, x: ar ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: ar ? 16 : -16 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {items.map((i) => (
                    <div key={i.key} className="glass flex gap-3 p-3">
                      <img src={i.imageUrl || 'https://placehold.co/120x120/f1e9dd/5c1a2e?text=%F0%9F%91%97'} alt={i.name} className="h-16 w-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-100">{i.name}</p>
                        {(i.size || i.color) && (
                          <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-stone-400">
                            {i.size && <span className="rounded bg-wine/10 px-1.5 py-0.5 text-wine">{t('store.sizeLabel')}: {i.size}</span>}
                            {i.color && <span className="rounded bg-wine/10 px-1.5 py-0.5 text-wine">{i.color}</span>}
                          </p>
                        )}
                        <p className="mt-1 font-bold text-gold-300">{t('common.currency')}{i.price}</p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button onClick={() => remove(i.key)} className="text-stone-500 hover:text-red-300">✕</button>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQty(i.key, i.qty - 1)} className="h-6 w-6 rounded-md border border-gold-400/30 text-gold-200">−</button>
                          <span className="w-5 text-center text-sm">{i.qty}</span>
                          <button onClick={() => setQty(i.key, i.qty + 1)} className="h-6 w-6 rounded-md border border-gold-400/30 text-gold-200">+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gold-400/15 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-stone-300">{t('cart.total')}</span>
                    <span className="font-display text-2xl font-bold gradient-text">{t('common.currency')}{total.toFixed(2)}</span>
                  </div>
                  <button onClick={() => { setErr(''); setView('checkout'); }} className="w-full rounded-2xl bg-wine py-3.5 font-bold text-cream shadow-lg transition hover:bg-wine-dark">
                    {t('cart.proceed')} ←
                  </button>
                  <button onClick={clear} className="mt-2 w-full text-center text-xs text-stone-400 hover:text-red-300">{t('cart.clear')}</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="checkout" initial={{ opacity: 0, x: ar ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: ar ? 16 : -16 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {/* بيانات التوصيل */}
                  <div>
                    <h3 className="mb-2 text-sm font-bold text-wine">📍 {t('co.customer')}</h3>
                    <div className="space-y-2.5">
                      <input className="input !rounded-2xl" placeholder={t('co.name')} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
                      <input className="input !rounded-2xl" dir="ltr" inputMode="tel" placeholder={t('co.phone')} value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
                      <Select
                        value={cust.city}
                        onChange={(v) => setCust({ ...cust, city: v })}
                        placeholder={t('co.selectCity')}
                        className="!rounded-2xl"
                        options={AREAS.map((a) => ({ value: ar ? a.ar : a.en, label: `${ar ? a.ar : a.en}${a.fee ? ` — ₪${a.fee}` : ''}` }))}
                      />
                      <input className="input !rounded-2xl" placeholder={t('co.address')} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                      <textarea className="input !rounded-2xl" rows={2} placeholder={t('co.notes')} value={cust.notes} onChange={(e) => setCust({ ...cust, notes: e.target.value })} />
                    </div>
                  </div>

                  {/* ملخّص الطلب */}
                  <div className="glass p-3.5">
                    <h3 className="mb-2 text-sm font-bold text-wine">🧾 {t('co.summary')}</h3>
                    <div className="space-y-1.5 text-sm">
                      {items.map((i) => (
                        <div key={i.key} className="flex items-center justify-between text-stone-300">
                          <span className="truncate pe-2">{i.name}{i.size ? ` (${i.size})` : ''}{i.color ? ` - ${i.color}` : ''} ×{i.qty}</span>
                          <span className="shrink-0">{t('common.currency')}{(i.price * i.qty).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="my-2 h-px bg-wine/10" />
                      <div className="flex justify-between text-stone-400"><span>{t('co.subtotal')}</span><span>{t('common.currency')}{total.toFixed(2)}</span></div>
                      <div className="flex justify-between text-stone-400"><span>{t('co.delivery')}</span><span>{t('common.currency')}{delivery.toFixed(2)}</span></div>
                      <div className="mt-1 flex justify-between font-bold text-wine"><span>{t('co.grandTotal')}</span><span className="font-display text-lg">{t('common.currency')}{grand.toFixed(2)}</span></div>
                    </div>
                    <p className="mt-2 text-[11px] text-stone-400">* {t('co.deliveryNote')}</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 py-2.5 text-sm font-medium text-emerald-700">
                    💵 {t('co.cod')}
                  </div>
                </div>

                <div className="border-t border-gold-400/15 p-4">
                  {err && <p className="mb-2 text-center text-xs text-red-500">{err}</p>}
                  <button onClick={confirmOrder} className="btn-whatsapp w-full">💬 {t('co.confirm')}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </aside>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { buildWhatsappCheckout } from '../utils/whatsapp.js';
import useScrollLock from '../hooks/useScrollLock.js';
import Select from './Select.jsx';
import CloseButton from './CloseButton.jsx';
import api from '../api/client.js';
import { sizeLabel } from '../utils/sizes.js';
import { getRef, clearRef } from '../utils/referral.js';

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
  const { items, open, setOpen, remove, setQty, total, clear, checkoutIntent, setCheckoutIntent } = useCart();
  const [view, setView] = useState('cart'); // 'cart' | 'checkout'
  const [cust, setCust] = useState({ name: '', phone: '', city: '', address: '', notes: '' });
  const [err, setErr] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, discount } بعد التحقّق
  const [couponMsg, setCouponMsg] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [placing, setPlacing] = useState(false); // جارٍ حفظ الطلب
  const [storeZones, setStoreZones] = useState(null); // مناطق المتجر المخصّصة (إن وُجدت)
  const [freeOver, setFreeOver] = useState(0); // شحن مجاني فوق هذا المبلغ (0 = معطّل)
  const [referral, setReferral] = useState(null); // { code, percent, referrerName } خصم إحالة تلقائي
  useScrollLock(open);

  const storeSlug = items[0]?.storeSlug || '';
  // الشراء الفوري: افتح السلة مباشرة على شاشة إتمام الطلب
  useEffect(() => {
    if (open && checkoutIntent) { setView('checkout'); setCheckoutIntent(false); }
  }, [open, checkoutIntent, setCheckoutIntent]);
  // نجلب إعدادات التوصيل الخاصة بالمتجر عند فتح السلة
  useEffect(() => {
    if (!open || !storeSlug) return;
    api.get(`/public/store/${storeSlug}/checkout`)
      .then((r) => {
        setStoreZones(Array.isArray(r.data.deliveryZones) ? r.data.deliveryZones : []);
        setFreeOver(Number(r.data.freeShippingOver) || 0);
      })
      .catch(() => { setStoreZones([]); setFreeOver(0); });
  }, [open, storeSlug]);

  // خصم الإحالة التلقائي: إن وصلت الزبونة عبر رابط إحالة محفوظ لهذا المتجر
  useEffect(() => {
    if (!open || !storeSlug) { return; }
    const code = getRef(storeSlug);
    if (!code) { setReferral(null); return; }
    api.get(`/public/referral/${encodeURIComponent(code)}?store=${encodeURIComponent(storeSlug)}`)
      .then((r) => {
        if (r.data.valid) setReferral({ code: r.data.code, percent: Number(r.data.percent) || 0, referrerName: r.data.referrerName || '' });
        else { setReferral(null); clearRef(storeSlug); }
      })
      .catch(() => setReferral(null));
  }, [open, storeSlug]);

  if (!open) return null;

  const close = () => { setOpen(false); setView('cart'); setErr(''); };
  // قائمة المناطق: مناطق المتجر المخصّصة إن وُجدت، وإلا القائمة الافتراضية
  const areaList = (storeZones && storeZones.length)
    ? storeZones.map((z) => ({ name: z.name, fee: Number(z.fee) || 0 }))
    : AREAS.map((a) => ({ name: ar ? a.ar : a.en, fee: a.fee }));
  const cityOpt = areaList.find((z) => z.name === cust.city);
  // خصم الإحالة (يُحسب من نسبة المتجر) — يُطبَّق فقط إن لم يُستخدم كوبون (لا نجمع خصمين)
  const refDiscount = (!coupon && referral && referral.percent > 0)
    ? Math.round((total * referral.percent) / 100 * 100) / 100
    : 0;
  const discount = coupon ? coupon.discount : refDiscount;
  const afterDiscount = Math.max(0, total - discount);
  const freeShip = freeOver > 0 && afterDiscount >= freeOver;
  const delivery = freeShip ? 0 : (cityOpt ? cityOpt.fee : 0);
  const grand = afterDiscount + delivery;

  // التحقّق من كوبون الخصم مع الخادم
  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true); setCouponMsg('');
    try {
      const r = await api.post('/public/coupon/validate', { slug: storeSlug, code, subtotal: total });
      if (r.data.valid) {
        setCoupon({ code: r.data.code, discount: r.data.discount });
        setCouponMsg('');
      } else {
        setCoupon(null);
        const reason = r.data.reason === 'min' ? t('coupon.min', { total: r.data.minTotal })
          : r.data.reason === 'expired' ? t('coupon.expired')
          : r.data.reason === 'maxed' ? t('coupon.maxed')
          : t('coupon.invalid');
        setCouponMsg(reason);
      }
    } catch {
      setCouponMsg(t('coupon.invalid'));
    } finally {
      setCouponBusy(false);
    }
  };
  const removeCoupon = () => { setCoupon(null); setCouponInput(''); setCouponMsg(''); };

  const confirmOrder = async () => {
    if (!cust.name.trim() || !cust.phone.trim() || !cust.city) { setErr(t('co.required')); return; }
    if (placing) return;
    setErr('');
    const wa = items[0]?.whatsapp || '';
    const activeCode = coupon?.code || (refDiscount > 0 ? referral?.code : '') || '';
    const waLink = buildWhatsappCheckout(wa, items, { ...cust, delivery, discount, couponCode: activeCode }, i18n.language);
    // نفتح نافذة فارغة فوراً (ضمن لمسة المستخدم) كي لا تُحجب بعد الانتظار
    let waWin = null;
    try { waWin = window.open('', '_blank'); } catch { waWin = null; }
    setPlacing(true);
    // نحفظ الطلب أولاً ونتأكّد من اكتماله — هنا يُخصم المخزون من اللون/النمرة
    try {
      await api.post('/orders/cod', {
        items: items.map((i) => ({ id: i.id, qty: i.qty, size: i.size, color: i.color })),
        customer: { name: cust.name, phone: cust.phone, city: cust.city, address: cust.address, notes: cust.notes, deliveryFee: delivery },
        coupon: coupon ? { code: coupon.code } : undefined,
        referralCode: (!coupon && refDiscount > 0) ? referral?.code : undefined,
      });
    } catch { /* تجاهل — نكمل لواتساب على أي حال */ }
    setPlacing(false);
    clear();
    // ثم نفتح واتساب (نوجّه النافذة المفتوحة، أو ننتقل إن تعذّر فتحها)
    if (waWin && !waWin.closed) {
      try { waWin.location.href = waLink; } catch { window.location.href = waLink; }
    } else {
      window.location.href = waLink;
    }
    close();
  };

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-black/60 p-3 backdrop-blur-sm sm:p-4" onClick={close}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md animate-slide-in flex-col overflow-hidden rounded-3xl border border-gold-400/20 bg-ink-900 shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
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
          <CloseButton onClick={close} variant="wine" />
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
                            {i.size && <span className="rounded bg-wine/10 px-1.5 py-0.5 text-wine">{t('store.sizeLabel')}: {sizeLabel(i.size, t)}</span>}
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
                        options={areaList.map((z) => ({ value: z.name, label: `${z.name}${z.fee ? ` — ₪${z.fee}` : ''}` }))}
                      />
                      <input className="input !rounded-2xl" placeholder={t('co.address')} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                      <textarea className="input !rounded-2xl" rows={2} placeholder={t('co.notes')} value={cust.notes} onChange={(e) => setCust({ ...cust, notes: e.target.value })} />
                    </div>
                  </div>

                  {/* خصم الإحالة التلقائي (إن وصلت عبر رابط إحالة ولم تستخدم كوبوناً) */}
                  {!coupon && refDiscount > 0 && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm font-semibold text-emerald-700">
                      🎁 {referral?.referrerName
                        ? t('referral.welcomeFrom', { name: referral.referrerName, percent: referral.percent })
                        : t('referral.welcome', { percent: referral.percent })}
                    </div>
                  )}

                  {/* كوبون الخصم */}
                  <div>
                    <h3 className="mb-2 text-sm font-bold text-wine">🎟️ {t('coupon.title')}</h3>
                    {coupon ? (
                      <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
                        <span className="text-sm font-semibold text-emerald-700">✓ {coupon.code} — −{t('common.currency')}{discount.toFixed(2)}</span>
                        <button onClick={removeCoupon} className="text-xs text-stone-400 hover:text-red-400">{t('coupon.remove')}</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          className="input !rounded-2xl flex-1 uppercase"
                          placeholder={t('coupon.placeholder')}
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                        />
                        <button onClick={applyCoupon} disabled={couponBusy || !couponInput.trim()} className="shrink-0 rounded-2xl bg-wine px-4 text-sm font-bold text-cream transition hover:bg-wine-dark disabled:opacity-40">
                          {couponBusy ? '…' : t('coupon.apply')}
                        </button>
                      </div>
                    )}
                    {couponMsg && <p className="mt-1.5 text-xs font-medium text-red-500">{couponMsg}</p>}
                  </div>

                  {/* ملخّص الطلب */}
                  <div className="glass p-3.5">
                    <h3 className="mb-2 text-sm font-bold text-wine">🧾 {t('co.summary')}</h3>
                    <div className="space-y-1.5 text-sm">
                      {items.map((i) => (
                        <div key={i.key} className="flex items-center justify-between text-stone-300">
                          <span className="truncate pe-2">{i.name}{i.size ? ` (${sizeLabel(i.size, t)})` : ''}{i.color ? ` - ${i.color}` : ''} ×{i.qty}</span>
                          <span className="shrink-0">{t('common.currency')}{(i.price * i.qty).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="my-2 h-px bg-wine/10" />
                      <div className="flex justify-between text-stone-400"><span>{t('co.subtotal')}</span><span>{t('common.currency')}{total.toFixed(2)}</span></div>
                      {discount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>{coupon ? `${t('coupon.discount')} (${coupon.code})` : t('referral.discountLine')}</span>
                          <span>−{t('common.currency')}{discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-400">
                        <span>{t('co.delivery')}</span>
                        {freeShip
                          ? <span className="font-bold text-emerald-600">{t('co.freeShipping')} 🎉</span>
                          : <span>{t('common.currency')}{delivery.toFixed(2)}</span>}
                      </div>
                      <div className="mt-1 flex justify-between font-bold text-wine"><span>{t('co.grandTotal')}</span><span className="font-display text-lg">{t('common.currency')}{grand.toFixed(2)}</span></div>
                    </div>
                    {/* تحفيز للشحن المجاني: كم باقي ليصير التوصيل مجاناً */}
                    {freeOver > 0 && !freeShip && (
                      <p className="mt-2 rounded-xl bg-wine/5 px-3 py-2 text-center text-xs font-semibold text-wine">
                        🚚 {t('co.freeShippingHint', { amount: (freeOver - afterDiscount).toFixed(2) })}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-stone-400">* {t('co.deliveryNote')}</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 py-2.5 text-sm font-medium text-emerald-700">
                    💵 {t('co.cod')}
                  </div>
                </div>

                <div className="border-t border-gold-400/15 p-4">
                  {err && <p className="mb-2 text-center text-xs text-red-500">{err}</p>}
                  <button onClick={confirmOrder} disabled={placing} className="btn-whatsapp w-full disabled:opacity-60">
                    {placing ? t('common.loading') : `💬 ${t('co.confirm')}`}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </aside>
    </div>
  );
}

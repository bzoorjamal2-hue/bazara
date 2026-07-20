import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { buildWhatsappCheckout } from '../utils/whatsapp.js';
import useScrollLock from '../hooks/useScrollLock.js';
import Select from './Select.jsx';
import CloseButton from './CloseButton.jsx';
import { CartIcon, BagIcon, XIcon, PinIcon, GiftIcon, TicketIcon, CheckIcon, ReceiptIcon, PartyIcon, TruckIcon, CashIcon, WhatsAppIcon, ForwardIcon, BackIcon, CopyIcon } from './icons.jsx';
import api from '../api/client.js';
import { sizeLabel } from '../utils/sizes.js';
import { getRef, clearRef } from '../utils/referral.js';
import { trackPixel } from '../utils/pixels.js';

// بيانات الزبون المحفوظة محلياً — تعبّئ شاشة الإتمام تلقائياً بالطلبات القادمة
const CUSTOMER_KEY = 'bz_customer_v1';
const loadCustomer = () => {
  try { return { name: '', phone: '', city: '', address: '', notes: '', ...JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '{}'), notes: '' }; }
  catch { return { name: '', phone: '', city: '', address: '', notes: '' }; }
};
const saveCustomer = (c) => {
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: c.name, phone: c.phone, city: c.city, address: c.address })); }
  catch { /* تجاهل */ }
};

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
  const [view, setView] = useState('cart'); // 'cart' | 'checkout' | 'done'
  const [doneRef, setDoneRef] = useState(''); // رقم الطلب (المرجع) بعد النجاح
  const [refCopied, setRefCopied] = useState(false); // نُسخ رقم الطلب؟
  const [cust, setCust] = useState(loadCustomer); // مسبقة التعبئة من آخر طلب (إن وُجد)
  const [loyalty, setLoyalty] = useState(null); // { percent } خصم ولاء مستحق لهذا الطلب
  const [flash, setFlash] = useState(null); // { percent, endsAt } عرض فلاش فعّال بالمتجر
  const [err, setErr] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, discount } بعد التحقّق
  const [couponMsg, setCouponMsg] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [placing, setPlacing] = useState(false); // جارٍ حفظ الطلب
  const [invalid, setInvalid] = useState({}); // الحقول الناقصة/الخاطئة — لتمييزها بإطار أحمر
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
        // عرض الفلاش الفعّال (الخادم يرجّعه فقط ما دام لم ينتهِ) — للعرض؛ الخادم هو الحكم
        setFlash(Number(r.data.flashPercent) > 0 ? { percent: Number(r.data.flashPercent), endsAt: r.data.flashEndsAt } : null);
      })
      .catch(() => { setStoreZones([]); setFreeOver(0); setFlash(null); });
  }, [open, storeSlug]);

  // إنقاذ السلة المتروكة: بعد إدخال رقم هاتف صالح بشاشة الإتمام، نحفظ مسودة الطلب
  // عند الخادم (تُحدَّث مع كل تعديل بمهلة قصيرة). لو ما أكّدت الزبونة، يراها صاحب
  // المتجر بقائمة "طلبات لم تكتمل" ويتابعها — وتُحذف تلقائياً عند إتمام الطلب فعلياً.
  useEffect(() => {
    if (view !== 'checkout' || !storeSlug || !items.length) return undefined;
    if (cust.phone.replace(/\D/g, '').length < 9) return undefined;
    const id = setTimeout(() => {
      api.post('/public/abandoned', {
        slug: storeSlug,
        customer: { name: cust.name, phone: cust.phone, city: cust.city, address: cust.address },
        items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, size: i.size || '', color: i.color || '' })),
        total, // مجموع القطع (بلا توصيل/خصم — تقديري يكفي للمتابعة)
      }).catch(() => { /* صامت — ميزة مساعدة لا توقف الشراء */ });
    }, 1200);
    return () => clearTimeout(id);
  }, [view, storeSlug, items, cust, total]);

  // حدث بكسل التمويل: بدء إتمام الطلب (مرة عند فتح الشاشة)
  useEffect(() => {
    if (open && view === 'checkout' && items.length) {
      trackPixel('InitiateCheckout', { value: total, num_items: items.reduce((s, i) => s + i.qty, 0) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  // خصم الولاء: بعد إدخال رقم صالح نسأل الخادم إن كان هذا الطلب يستحق خصم ولاء
  // (كل N طلبات مؤكّدة → خصم % يحدّدهما المتجر). الخادم يعيد الحساب عند الإنشاء.
  useEffect(() => {
    if (view !== 'checkout' || !storeSlug) return undefined;
    const digits = cust.phone.replace(/\D/g, '');
    if (digits.length < 9) { setLoyalty(null); return undefined; }
    const id = setTimeout(() => {
      api.post('/public/loyalty', { slug: storeSlug, phone: cust.phone })
        .then((r) => setLoyalty(Number(r.data.percent) > 0 ? { percent: Number(r.data.percent) } : null))
        .catch(() => setLoyalty(null));
    }, 600);
    return () => clearTimeout(id);
  }, [view, storeSlug, cust.phone]);

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

  const close = () => { setOpen(false); setView('cart'); setErr(''); setDoneRef(''); };
  // قائمة المناطق: مناطق المتجر المخصّصة إن وُجدت، وإلا القائمة الافتراضية
  const areaList = (storeZones && storeZones.length)
    ? storeZones.map((z) => ({ name: z.name, fee: Number(z.fee) || 0 }))
    : AREAS.map((a) => ({ name: ar ? a.ar : a.en, fee: a.fee }));
  const cityOpt = areaList.find((z) => z.name === cust.city);
  // الأولوية (لا تُجمع الخصومات): كوبون > فلاش > إحالة > ولاء — نفس ترتيب الخادم (الحكم)
  const flashActive = flash && flash.percent > 0 && flash.endsAt && new Date(flash.endsAt).getTime() > Date.now();
  const flashDiscount = (!coupon && flashActive)
    ? Math.round((total * flash.percent) / 100 * 100) / 100
    : 0;
  // خصم الإحالة (يُحسب من نسبة المتجر) — يُطبَّق فقط إن لم يُستخدم كوبون/فلاش
  const refDiscount = (!coupon && !flashDiscount && referral && referral.percent > 0)
    ? Math.round((total * referral.percent) / 100 * 100) / 100
    : 0;
  // خصم الولاء — أدنى أولوية، ولا تُجمع الخصومات
  const loyaltyDiscount = (!coupon && !flashDiscount && !refDiscount && loyalty?.percent > 0)
    ? Math.round((total * loyalty.percent) / 100 * 100) / 100
    : 0;
  const discount = coupon ? coupon.discount : (flashDiscount || refDiscount || loyaltyDiscount);
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
    // تحقّق حقلي واضح: نميّز الحقل الناقص بإطار أحمر، ونتأكّد أن الهاتف أرقام كافية
    const bad = {};
    if (!cust.name.trim()) bad.name = true;
    if (cust.phone.replace(/\D/g, '').length < 9) bad.phone = true;
    if (!cust.city) bad.city = true;
    if (Object.keys(bad).length) {
      setInvalid(bad);
      setErr(bad.phone && cust.phone.trim() && !bad.name && !bad.city ? t('co.phoneInvalid') : t('co.required'));
      return;
    }
    setInvalid({});
    if (placing) return;
    setErr('');
    const wa = items[0]?.whatsapp || '';
    const activeCode = coupon?.code || (refDiscount > 0 ? referral?.code : '') || '';
    const waLink = buildWhatsappCheckout(wa, items, { ...cust, delivery, discount, couponCode: activeCode }, i18n.language);
    // نفتح نافذة فارغة فوراً (ضمن لمسة المستخدم) كي لا تُحجب بعد الانتظار
    let waWin = null;
    try { waWin = window.open('', '_blank'); } catch { waWin = null; }
    setPlacing(true);
    // نتذكّر بيانات الزبون محلياً — الطلب القادم يتعبّأ تلقائياً
    saveCustomer(cust);
    // نحفظ الطلب أولاً ونتأكّد من اكتماله — هنا يُخصم المخزون من اللون/النمرة
    let reference = '';
    try {
      const r = await api.post('/orders/cod', {
        items: items.map((i) => ({ id: i.id, qty: i.qty, size: i.size, color: i.color })),
        customer: { name: cust.name, phone: cust.phone, city: cust.city, address: cust.address, notes: cust.notes, deliveryFee: delivery },
        coupon: coupon ? { code: coupon.code } : undefined,
        referralCode: (!coupon && refDiscount > 0) ? referral?.code : undefined,
      });
      reference = r.data?.reference || '';
      // حدث بكسل التمويل: شراء مكتمل (أهم حدث لقياس الإعلانات)
      trackPixel('Purchase', { value: grand, num_items: items.reduce((s, i) => s + i.qty, 0), content_ids: items.map((i) => i.id), content_type: 'product' });
    } catch { /* تجاهل — نكمل لواتساب على أي حال */ }
    setPlacing(false);
    clear();
    // ثم نفتح واتساب (نوجّه النافذة المفتوحة، أو ننتقل إن تعذّر فتحها)
    if (waWin && !waWin.closed) {
      try { waWin.location.href = waLink; } catch { window.location.href = waLink; }
    } else {
      window.location.href = waLink;
    }
    // شاشة تأكيد النجاح: رقم الطلب + تتبّع — بدل ما كانت السلة تختفي بصمت
    // والزبونة لا تعرف رقم طلبها ولا أن الطلب انحفظ فعلاً
    setDoneRef(reference);
    setView('done');
  };

  return (
    // z-[95]: فوق صفحة الريلز (z-90) — الإضافة/الشراء من الريل كانت تفتح السلة خلفها فلا تُرى
    <div className="fixed inset-0 z-[95] flex justify-end bg-black/60 p-3 backdrop-blur-sm sm:p-4" onClick={close}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md animate-slide-in flex-col overflow-hidden rounded-3xl border border-gold-400/20 bg-ink-900 shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* الرأس */}
        <div className="flex items-center justify-between border-b border-gold-400/15 p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold gradient-text">
            {view === 'checkout' && (
              <button onClick={() => setView('cart')} aria-label={t('co.back')} className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/10 text-cream/80 transition hover:bg-cream/20 hover:text-cream">
                <BackIcon className="h-4 w-4" />
              </button>
            )}
            {view === 'cart' ? <><CartIcon className="h-5 w-5" /> {t('cart.title')}</> : view === 'done' ? t('co.doneTitle') : t('co.title')}
          </h2>
          <CloseButton onClick={close} variant="wine" />
        </div>

        {view === 'done' ? (
          /* شاشة نجاح الطلب: تأكيد واضح + رقم الطلب + تتبّع (السلة كانت تختفي بصمت) */
          <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/40">
              <CheckIcon className="h-10 w-10 text-emerald-300" />
            </span>
            <p className="text-sm leading-relaxed text-stone-300">{t('co.doneMsg')}</p>
            {doneRef && (
              <button
                type="button"
                onClick={() => { try { navigator.clipboard.writeText(doneRef); setRefCopied(true); setTimeout(() => setRefCopied(false), 1600); } catch { /* تجاهل */ } }}
                className="group rounded-2xl bg-gold-400/10 px-6 py-2.5 ring-1 ring-gold-400/30 transition hover:bg-gold-400/15"
                title={t('co.doneCopy')}
              >
                <span className="text-xs text-stone-400">{t('co.doneRef')}</span>
                <p dir="ltr" className="flex items-center justify-center gap-1.5 font-mono text-lg font-bold tracking-wide text-gold-200">
                  {doneRef}
                  {refCopied
                    ? <CheckIcon className="h-4 w-4 text-emerald-300" />
                    : <CopyIcon className="h-4 w-4 text-gold-200/60 transition group-hover:text-gold-200" />}
                </p>
                <span className="text-[10px] text-stone-500">{refCopied ? t('co.doneCopied') : t('co.doneCopy')}</span>
              </button>
            )}
            <div className="mt-2 flex w-full flex-col gap-2">
              <Link
                to="/track"
                onClick={close}
                className="w-full rounded-full py-3.5 text-center font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
              >
                {t('co.doneTrack')}
              </Link>
              <button onClick={close} className="w-full rounded-full border border-cream/20 py-3 font-semibold text-cream/80 transition hover:bg-cream/10">
                {t('co.doneKeepShopping')}
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-stone-400">
            <BagIcon className="h-14 w-14 text-cream/25" />
            <p>{t('cart.empty')}</p>
            <button
              onClick={close}
              className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
            >
              {t('co.doneKeepShopping')}
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {view === 'cart' ? (
              <motion.div key="cart" initial={{ opacity: 0, x: ar ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: ar ? 16 : -16 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {items.map((i) => (
                    <div key={i.key} className="glass flex gap-3 p-3">
                      {/* صورة أكبر بنسبة 3:4 (نفس روح البطاقات الجديدة) */}
                      <img src={i.imageUrl || 'https://placehold.co/120x160/f1e9dd/5c1a2e?text=%F0%9F%91%97'} alt={i.name} className="h-20 w-16 rounded-xl object-cover shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold text-stone-100">{i.name}</p>
                        {(i.size || i.color) && (
                          <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-stone-400">
                            {i.size && <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-gold-200">{t('store.sizeLabel')}: {sizeLabel(i.size, t)}</span>}
                            {i.color && <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-gold-200">{i.color}</span>}
                          </p>
                        )}
                        <p className="mt-1 font-display font-bold text-gold-300">{t('common.currency')}{i.price}</p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button onClick={() => remove(i.key)} aria-label={t('common.remove')} className="text-stone-500 transition hover:text-red-400"><XIcon className="h-4 w-4" /></button>
                        {/* عدّاد كمية بحبة دائرية أنيقة */}
                        <div className="flex items-center gap-0.5 rounded-full border border-gold-400/30 px-1 py-0.5">
                          <button onClick={() => setQty(i.key, i.qty - 1)} aria-label="-" className="flex h-6 w-6 items-center justify-center rounded-full leading-none text-gold-200 transition hover:bg-gold-400/10">−</button>
                          <span className="w-5 text-center text-sm font-semibold">{i.qty}</span>
                          <button onClick={() => setQty(i.key, i.qty + 1)} disabled={i.maxQty != null && i.qty >= i.maxQty} aria-label="+" className="flex h-6 w-6 items-center justify-center rounded-full leading-none text-gold-200 transition hover:bg-gold-400/10 disabled:opacity-30">+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gold-400/15 p-4">
                  {/* تحفيز الشحن المجاني بأول شاشة بالسلة (كان بشاشة الإتمام فقط — متأخّر):
                      "باقي ₪X" يدفع الزبونة تضيف قطعة بدل ما تكمل — أقوى محفّز لرفع قيمة السلة */}
                  {freeOver > 0 && (
                    <div className="mb-3 rounded-xl bg-gold-400/10 px-3 py-2">
                      {total >= freeOver ? (
                        <p className="flex items-center justify-center gap-1.5 text-center text-xs font-bold text-emerald-300">
                          <PartyIcon className="h-4 w-4 shrink-0" /> {t('co.freeShipping')}
                        </p>
                      ) : (
                        <>
                          <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-gold-200">
                            <TruckIcon className="h-4 w-4 shrink-0" /> {t('co.freeShippingHint', { amount: (freeOver - total).toFixed(2) })}
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#e6c878] to-[#b8932c] transition-all duration-500" style={{ width: `${Math.min(100, Math.round((total / freeOver) * 100))}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-stone-300">{t('cart.total')}</span>
                    <span className="font-display text-2xl font-bold gradient-text">{t('common.currency')}{total.toFixed(2)}</span>
                  </div>
                  {/* حبة إتمام فاخرة بتدرج خمري وهالة ذهبية — والسهم يتبع اتجاه اللغة */}
                  <button
                    onClick={() => { setErr(''); setView('checkout'); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full py-4 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)', boxShadow: '0 16px 34px -14px rgba(74, 19, 34, 0.65)' }}
                  >
                    {t('cart.proceed')} <ForwardIcon className="h-4 w-4" />
                  </button>
                  <button onClick={clear} className="mt-2 w-full text-center text-xs text-stone-400 hover:text-red-300">{t('cart.clear')}</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="checkout" initial={{ opacity: 0, x: ar ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: ar ? 16 : -16 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {/* بيانات التوصيل */}
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-200"><PinIcon className="h-4 w-4" /> {t('co.customer')}</h3>
                    <div className="space-y-2.5">
                      <input className={`input !rounded-2xl ${invalid.name ? 'ring-1 ring-red-400/70' : ''}`} placeholder={t('co.name')} value={cust.name} onChange={(e) => { setCust({ ...cust, name: e.target.value }); if (invalid.name) setInvalid((v) => ({ ...v, name: false })); }} />
                      <input className={`input !rounded-2xl ${invalid.phone ? 'ring-1 ring-red-400/70' : ''}`} dir="ltr" inputMode="tel" placeholder={t('co.phone')} value={cust.phone} onChange={(e) => { setCust({ ...cust, phone: e.target.value }); if (invalid.phone) setInvalid((v) => ({ ...v, phone: false })); }} />
                      <Select
                        value={cust.city}
                        onChange={(v) => { setCust({ ...cust, city: v }); if (invalid.city) setInvalid((p) => ({ ...p, city: false })); }}
                        placeholder={t('co.selectCity')}
                        className={`!rounded-2xl ${invalid.city ? 'ring-1 ring-red-400/70' : ''}`}
                        options={areaList.map((z) => ({ value: z.name, label: `${z.name}${z.fee ? ` — ₪${z.fee}` : ''}` }))}
                      />
                      <input className="input !rounded-2xl" placeholder={t('co.address')} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                      <textarea className="input !rounded-2xl" rows={2} placeholder={t('co.notes')} value={cust.notes} onChange={(e) => setCust({ ...cust, notes: e.target.value })} />
                    </div>
                  </div>

                  {/* خصم الإحالة التلقائي (إن وصلت عبر رابط إحالة ولم تستخدم كوبوناً) */}
                  {!coupon && refDiscount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm font-semibold text-emerald-300">
                      <GiftIcon className="h-4 w-4 shrink-0" /> {referral?.referrerName
                        ? t('referral.welcomeFrom', { name: referral.referrerName, percent: referral.percent })
                        : t('referral.welcome', { percent: referral.percent })}
                    </div>
                  )}

                  {/* خصم الولاء التلقائي — مكافأة الزبون الدائم (كل N طلبات) */}
                  {loyaltyDiscount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm font-semibold text-emerald-300">
                      <GiftIcon className="h-4 w-4 shrink-0" /> {t('loyalty.banner', { percent: loyalty.percent })}
                    </div>
                  )}

                  {/* كوبون الخصم */}
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-200"><TicketIcon className="h-4 w-4" /> {t('coupon.title')}</h3>
                    {coupon ? (
                      <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
                        <span className="flex items-center gap-1 text-sm font-semibold text-emerald-300"><CheckIcon className="h-4 w-4" /> {coupon.code} — −{t('common.currency')}{discount.toFixed(2)}</span>
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
                    {couponMsg && <p className="mt-1.5 text-xs font-medium text-red-300">{couponMsg}</p>}
                  </div>

                  {/* ملخّص الطلب */}
                  <div className="glass p-3.5">
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-200"><ReceiptIcon className="h-4 w-4" /> {t('co.summary')}</h3>
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
                        <div className="flex justify-between text-emerald-300">
                          <span>{coupon ? `${t('coupon.discount')} (${coupon.code})` : flashDiscount > 0 ? t('store.flashDiscountLine') : refDiscount > 0 ? t('referral.discountLine') : t('loyalty.discountLine')}</span>
                          <span>−{t('common.currency')}{discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-400">
                        <span>{t('co.delivery')}</span>
                        {freeShip
                          ? <span className="inline-flex items-center gap-1 font-bold text-emerald-300">{t('co.freeShipping')} <PartyIcon className="h-4 w-4" /></span>
                          : <span>{t('common.currency')}{delivery.toFixed(2)}</span>}
                      </div>
                      <div className="mt-1 flex justify-between font-bold text-gold-200"><span>{t('co.grandTotal')}</span><span className="font-display text-lg gradient-text">{t('common.currency')}{grand.toFixed(2)}</span></div>
                    </div>
                    {/* تحفيز للشحن المجاني: كم باقي + شريط تقدّم ذهبي */}
                    {freeOver > 0 && !freeShip && (
                      <div className="mt-2 rounded-xl bg-gold-400/10 px-3 py-2">
                        <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-gold-200">
                          <TruckIcon className="h-4 w-4 shrink-0" /> {t('co.freeShippingHint', { amount: (freeOver - afterDiscount).toFixed(2) })}
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#e6c878] to-[#b8932c] transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.round((afterDiscount / freeOver) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-stone-400">* {t('co.deliveryNote')}</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 py-2.5 text-sm font-medium text-emerald-300">
                    <CashIcon className="h-4 w-4" /> {t('co.cod')}
                  </div>
                </div>

                <div className="border-t border-gold-400/15 p-4">
                  {err && <p className="mb-2 text-center text-xs text-red-300">{err}</p>}
                  <button onClick={confirmOrder} disabled={placing} className="btn-whatsapp w-full !rounded-full !py-4 disabled:opacity-60">
                    {placing ? t('common.loading') : <span className="inline-flex items-center gap-2"><WhatsAppIcon className="h-5 w-5" /> {t('co.confirm')}</span>}
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

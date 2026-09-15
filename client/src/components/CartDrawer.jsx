import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { productPath } from '../utils/links.js';
import { trackPath } from '../utils/links.js';
import { siteOrigin } from '../utils/links.js';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext.jsx';
import { buildWhatsappCheckout } from '../utils/whatsapp.js';
import useScrollLock from '../hooks/useScrollLock.js';
import CloseButton from './CloseButton.jsx';
import CitySearch, { placeLabelOf } from './CitySearch.jsx';
import { CartIcon, BagIcon, XIcon, PinIcon, GiftIcon, TicketIcon, CheckIcon, ReceiptIcon, PartyIcon, TruckIcon, CashIcon, WhatsAppIcon, ForwardIcon, BackIcon, CopyIcon, CardIcon, UserIcon, ShieldIcon, DownloadIcon, PrintIcon, LockIcon } from './icons.jsx';
import api from '../api/client.js';
import { sizeLabel } from '../utils/sizes.js';
import { newKey, enqueue } from '../utils/orderQueue.js';
import { colorToCss } from '../utils/colorDot.js';
import { cldThumb } from '../utils/cloudinary.js';
import { getRef, clearRef } from '../utils/referral.js';
import { trackPixel } from '../utils/pixels.js';
import { isValidMobile, normalizePhone, sanitizeMobileInput } from '../utils/phone.js';
import { printReceipt, saveReceiptImage } from '../utils/receipt.js';
import { phGlyph } from '../utils/imageFallback.js';

// بيانات الزبون المحفوظة محلياً — تعبّئ شاشة الإتمام تلقائياً بالطلبات القادمة
const CUSTOMER_KEY = 'bz_customer_v1';
const loadCustomer = () => {
  try { return { name: '', phone: '', city: '', area: '', address: '', notes: '', ...JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '{}') }; }
  catch { return { name: '', phone: '', city: '', area: '', address: '', notes: '' }; }
};
const saveCustomer = (c) => {
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: c.name, phone: c.phone, city: c.city, area: c.area, address: c.address })); }
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
  const { items, open, setOpen, remove, setQty, total, count, clear, syncFromServer, checkoutIntent, setCheckoutIntent } = useCart();
  const [view, setView] = useState('cart'); // 'cart' | 'checkout' | 'done'
  // شاشةُ الإتمامِ على ثلاثِ خطوات: مَنْ أنتِ ← إلى أين ← كيف تدفعين. النموذجُ
  // الطويلُ الواحدُ كان يُخيفُ بطولِه فتُغلقُ الزبونةُ السلّةَ قبل أن تبدأ؛ وثلاثُ
  // بطاقاتٍ قصيرةٍ بشريطِ تقدّمٍ تُنهيها بلا أن تشعرَ أنّها تملأُ استمارة.
  const [step, setStep] = useState(1); // 1 بياناتك · 2 التوصيل · 3 الدفع
  const [payMethod, setPayMethod] = useState('cod'); // 'cod' | 'card'
  const [doneRef, setDoneRef] = useState(''); // رقم الطلب (المرجع) بعد النجاح
  const [doneStore, setDoneStore] = useState(''); // متجر الطلب — لإبقاء التتبّع بهويته
  const [doneOrder, setDoneOrder] = useState(null); // لقطةُ الطلب — منها تُبنى شهادةُ الشراء
  const [doneWa, setDoneWa] = useState(''); // رابطُ واتساب — احتياطٌ إن حجب المتصفّحُ النافذة
  const [receiptBusy, setReceiptBusy] = useState(''); // 'image' | 'print' — أثناء توليد الشهادة
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
  const [localities, setLocalities] = useState([]); // قائمة مسطّحة: كل مدينة/قرية بندٌ مستقل بسعره
  const [freeOver, setFreeOver] = useState(0); // شحن مجاني فوق هذا المبلغ (0 = معطّل)
  const [referral, setReferral] = useState(null); // { code, percent, referrerName } خصم إحالة تلقائي
  const [cardEnabled, setCardEnabled] = useState(false); // المتجر مفعّل الدفع بالبطاقة
  const [cardEmail, setCardEmail] = useState(''); // بريد الزبون للدفع بالبطاقة
  const [cardBusy, setCardBusy] = useState(false); // جارٍ التحويل لصفحة الدفع
  const [storeInfo, setStoreInfo] = useState({ name: '', whatsapp: '' }); // هويّةُ المتجر — لشهادةِ الشراء
  const nameRef = useRef(null); // للتركيز التلقائي على أول حقل عند فتح شاشة الإتمام
  const formRef = useRef(null); // حاوية الحقول — للتمرير لأول حقل ناقص عند الخطأ
  useScrollLock(open);
  // #9: تركيز تلقائي على أول حقل (الاسم) عند دخول شاشة الإتمام — تعبئة أسرع.
  // بالخطوةِ الأولى وحدَها: تركيزُ حقلٍ بخطوةٍ لاحقةٍ يفتحُ لوحةَ المفاتيحِ فجأةً
  // ويقفزُ التمريرُ فوقَ ما كتبته الزبونةُ لتوّها.
  useEffect(() => {
    if (open && view === 'checkout' && step === 1) {
      const id = setTimeout(() => nameRef.current?.focus(), 150);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [open, view, step]);
  // بدايةُ كلِّ خطوةٍ من أعلاها — بلا هذا تبقى الخطوةُ الجديدةُ ممرَّرةً لمكانِ
  // التمريرِ السابقِ فتظهرُ مقطوعةَ الرأس.
  useEffect(() => { formRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' }); }, [step]);
  // إغلاق بمفتاح Escape (سلوك قياسي للنوافذ) — يعيد العرض لقائمة السلة
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setView('cart'); setStep(1); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const storeSlug = items[0]?.storeSlug || '';
  // الشراء الفوري: افتح السلة مباشرة على شاشة إتمام الطلب
  useEffect(() => {
    if (open && checkoutIntent) { setView('checkout'); setStep(1); setCheckoutIntent(false); }
  }, [open, checkoutIntent, setCheckoutIntent]);
  // متجرٌ أغلق الدفعَ بالبطاقةِ بعد أن اختارته الزبونة: نرجعُها للدفعِ عند الاستلامِ
  // بدل أن يبقى اختيارٌ لا زرَّ له فتضغطَ «تأكيد» ولا يحدث شيء.
  useEffect(() => { if (!cardEnabled) setPayMethod('cod'); }, [cardEnabled]);
  // نجلب إعدادات التوصيل الخاصة بالمتجر عند فتح السلة
  useEffect(() => {
    if (!open || !storeSlug) return;
    api.get(`/public/store/${storeSlug}/checkout`)
      .then((r) => {
        setLocalities(Array.isArray(r.data.localities) ? r.data.localities : []);
        setFreeOver(Number(r.data.freeShippingOver) || 0);
        setFlash(Number(r.data.flashPercent) > 0 ? { percent: Number(r.data.flashPercent), endsAt: r.data.flashEndsAt } : null);
        setCardEnabled(Boolean(r.data.cardPaymentEnabled));
        setStoreInfo({ name: r.data.storeName || '', whatsapp: r.data.whatsapp || '' });
      })
      .catch(() => { setLocalities([]); setFreeOver(0); setFlash(null); setCardEnabled(false); });
  }, [open, storeSlug]);

  // زبونة قديمة محفوظ عندها اسم مكان بخانة "المدينة" فقط (قبل فصل المحافظة/القرية):
  // نطابقه بالقائمة المسطّحة ونضبط المحافظة (parent) والقرية تلقائياً فتظهر الأجرة صح.
  useEffect(() => {
    if (!localities.length || !cust.city || cust.area) return;
    const hit = localities.find((l) => l.name === cust.city);
    if (hit && hit.parent && hit.parent !== hit.name) {
      setCust((p) => ({ ...p, city: hit.parent, area: hit.name }));
    }
  }, [localities, cust.city, cust.area]);

  // عند فتح السلة: نحدّث الأسعار والمتبقّي من الخادم بطلب واحد. عناصر السلة لقطة وقت
  // الإضافة، والطلب يُسعَّر على الخادم — فبلا هذا قد ترى الزبونة سعراً قديماً وترسل
  // رسالة واتساب برقم يخالف المُدوَّن. نتجاهل الفشل بهدوء (تبقى اللقطة المحفوظة).
  const itemIds = items.map((i) => i.id).join(',');
  useEffect(() => {
    if (!open || !itemIds) return undefined;
    let alive = true;
    api.get(`/public/products?ids=${itemIds}`)
      .then((r) => { if (alive) syncFromServer(r.data.products || []); })
      .catch(() => { /* بلا اتصال — نُبقي المعروض كما هو */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemIds]);

  // إنقاذ السلة المتروكة: بعد إدخال رقم هاتف صالح بشاشة الإتمام، نحفظ مسودة الطلب
  // عند الخادم (تُحدَّث مع كل تعديل بمهلة قصيرة). لو ما أكّدت الزبونة، يراها صاحب
  // المتجر بقائمة "طلبات لم تكتمل" ويتابعها — وتُحذف تلقائياً عند إتمام الطلب فعلياً.
  useEffect(() => {
    if (view !== 'checkout' || !storeSlug || !items.length) return undefined;
    if (cust.phone.replace(/\D/g, '').length < 9) return undefined;
    const id = setTimeout(() => {
      api.post('/public/abandoned', {
        slug: storeSlug,
        customer: { name: cust.name, phone: normalizePhone(cust.phone), city: [cust.city, cust.area].filter(Boolean).join(' - '), address: cust.address },
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
      api.post('/public/loyalty', { slug: storeSlug, phone: normalizePhone(cust.phone) })
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

  const close = () => {
    setOpen(false); setView('cart'); setStep(1); setErr('');
    setDoneRef(''); setDoneStore(''); setDoneOrder(null); setDoneWa(''); setReceiptBusy('');
  };
  // قائمة الأماكن المسطّحة (كل مدينة/قرية بندٌ مستقل بسعره) من الخادم، وإلا القائمة
  // الافتراضية. كل عنصر: { name, parent, region, fee }.
  const cityChoices = (localities && localities.length)
    ? localities.map((z) => ({ name: z.name, parent: z.parent || z.name, region: z.region || '', fee: Number(z.fee) || 0, tier: z.tier || '' }))
    : AREAS.map((a) => ({ name: ar ? a.ar : a.en, parent: ar ? a.ar : a.en, fee: a.fee, region: '', tier: '' }));
  // العنصر المختار: نطابق القرية (area) ضمن محافظتها (city)، وإلا المدينة نفسها
  const pickedLoc = cust.area
    ? cityChoices.find((z) => z.name === cust.area && z.parent === cust.city) || cityChoices.find((z) => z.name === cust.area)
    : cityChoices.find((z) => z.name === cust.city);
  // #3: صحّة رقم الموبايل لحظياً (05XXXXXXXX) — لعرض علامة صح/خطأ فورية
  const phoneOk = isValidMobile(cust.phone);
  // #1: مدة التوصيل المتوقعة حسب شريحة المكان المختار (ضفة/قدس/داخل)
  const etaTier = pickedLoc?.tier;
  const eta = etaTier ? t(`co.eta.${etaTier}`, { defaultValue: '' }) : '';
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
  const delivery = freeShip ? 0 : (pickedLoc ? pickedLoc.fee : 0);
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

  // ── خطواتُ الإتمام ───────────────────────────────────────────────────────────
  // كلُّ خطوةٍ تحرسُ حقولَها: لا تُفتحُ التاليةُ وفي الحاليةِ نقص. الحقلُ الناقصُ
  // يُعلَّمُ بإطارٍ أحمرَ ويُمرَّرُ إليه — فتعرفُ الزبونةُ *ما* ينقصُ لا أنّ شيئاً نقص.
  const STEP_FIELDS = { 1: ['name', 'phone'], 2: ['city'], 3: ['email'] };
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cardEmail.trim());
  const badFieldsFor = (s) => {
    const bad = {};
    if (s >= 1) {
      if (!cust.name.trim()) bad.name = true;
      if (!isValidMobile(cust.phone)) bad.phone = true;
    }
    // المكانُ يجبُ أن يكونَ مختاراً من القائمةِ لا مكتوباً بالحرف.
    //
    // الأجرةُ تختلفُ بالمكان: الضفّةُ شريحةٌ والقدسُ أخرى والداخلُ ثالثة. وما
    // يُكتَبُ بالحرفِ لا يُطابقُ مكاناً معروفاً، فكانت الواجهةُ تعرضُ «التوصيل
    // ٠٫٠٠» ثمّ يُصنّفُ الخادمُ الاسمَ ويخصمُ ٢٥ أو ٣٥ — فيرى الزبونُ رقماً
    // ويُحاسَبُ بغيرِه. ومَن يكتبُ «رام الله» بدل «رام الله والبيرة» كان
    // يُحاسَبُ بشريحةِ القدسِ خطأً. الاختيارُ من القائمةِ يُغلقُ البابَين.
    if (s >= 2 && !pickedLoc) bad.city = true;
    // البوّابةُ تربطُ الدفعةَ ببريدٍ وترسلُ إليه الإيصال. بلا بريدٍ صالحٍ كان
    // الخادمُ يضعُ عنواناً وهميّاً، فتدفعُ الزبونةُ ولا يصلُها إثباتُ دفعها.
    if (s >= 3 && payMethod === 'card' && !emailOk) bad.email = true;
    return bad;
  };
  // تُظهرُ الخطأَ وتُمرّرُ لأوّلِ حقلٍ ناقص. تُرجعُ true إن كان كلُّ شيءٍ سليماً.
  const guard = (s) => {
    const bad = badFieldsFor(s);
    const keys = Object.keys(bad);
    if (!keys.length) { setInvalid({}); setErr(''); return true; }
    setInvalid(bad);
    // الرسالةُ تصفُ الناقصَ بهذه الخطوةِ وحدَها — «تعبئة الاسم والهاتف واختيار
    // المدينة» على شاشةٍ لا مدينةَ فيها كانت تُربكُ أكثرَ ممّا تُرشد
    setErr(
      bad.email ? t('co.emailInvalid')
        : (bad.name || bad.phone)
          ? (bad.phone && !bad.name && cust.phone.trim() ? t('co.phoneInvalid') : t('co.requiredContact'))
          // كُتب اسمٌ لكنّه لا يطابقُ مكاناً: نقولُ السببَ لا «المكان مطلوب»
          : ((cust.city || cust.area) ? t('co.cityNotListed') : t('co.requiredCity'))
    );
    const order = [...STEP_FIELDS[1], ...STEP_FIELDS[2], ...STEP_FIELDS[3]];
    const first = order.find((k) => bad[k]);
    // الحقلُ الناقصُ قد يكونُ بخطوةٍ سابقةٍ (رجعت وحذفت اسمَها) — نعودُ لخطوتِه أوّلاً
    const owner = Number(Object.keys(STEP_FIELDS).find((k) => STEP_FIELDS[k].includes(first))) || 1;
    if (owner < step) setStep(owner);
    if (first) requestAnimationFrame(() => formRef.current?.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    return false;
  };
  const goNext = () => { if (guard(step)) setStep((s) => Math.min(3, s + 1)); };
  const goBack = () => { setErr(''); if (step > 1) setStep((s) => s - 1); else setView('cart'); };

  // لقطةُ الطلبِ كما رأتها الزبونةُ لحظةَ التأكيد — منها تُبنى شهادةُ الشراءِ بعد
  // تفريغِ السلّة، ومنها رسالةُ واتساب. تُؤخذُ قبل clear() لأنّ العناصرَ تزولُ بعده.
  const orderSnapshot = (reference, method) => ({
    reference,
    createdAt: new Date().toISOString(),
    storeName: storeInfo.name || items[0]?.storeName || '',
    storeSlug: storeSlug,
    storeWhatsapp: storeInfo.whatsapp || items[0]?.whatsapp || '',
    customerName: cust.name,
    customerPhone: normalizePhone(cust.phone),
    city: cust.city,
    area: cust.area,
    address: cust.address,
    notes: cust.notes,
    eta,
    items: items.map((i) => ({ name: i.name, size: i.size ? sizeLabel(i.size, t) : '', color: i.color || '', price: i.price, oldPrice: i.oldPrice, qty: i.qty })),
    subtotal: total,
    discount,
    couponCode: coupon?.code || (refDiscount > 0 ? referral?.code : '') || '',
    deliveryFee: delivery,
    total: grand,
    paymentMethod: method,
  });

  // الدفع بالبطاقة عبر Paytabs — يحوّل الزبونة لصفحة الدفع الآمنة
  const payWithCard = async () => {
    if (!guard(3)) return;
    if (cardBusy) return;
    setErr('');
    setCardBusy(true);
    saveCustomer(cust);
    try {
      const r = await api.post('/orders/checkout', {
        items: items.map((i) => ({ id: i.id, qty: i.qty, size: i.size, color: i.color })),
        customer: { name: cust.name, phone: normalizePhone(cust.phone), email: cardEmail, city: cust.city, area: cust.area, address: cust.address, notes: cust.notes },
        coupon: coupon ? { code: coupon.code } : undefined,
      });
      if (r.data?.redirectUrl) {
        trackPixel('InitiateCheckout', { value: grand, num_items: items.reduce((s, i) => s + i.qty, 0) });
        window.location.href = r.data.redirectUrl;
      } else {
        setErr(t('co.cardError'));
      }
    } catch (e) {
      setErr(e?.response?.data?.error || t('co.cardError'));
    } finally {
      setCardBusy(false);
    }
  };

  const confirmOrder = async () => {
    if (!guard(3)) return;
    if (placing) return;
    setErr('');
    const wa = storeInfo.whatsapp || items[0]?.whatsapp || '';
    setPlacing(true);
    // نتذكّر بيانات الزبون محلياً — الطلب القادم يتعبّأ تلقائياً
    saveCustomer(cust);
    // نحفظ الطلب أولاً ونتأكّد من اكتماله — هنا يُخصم المخزون من اللون/النمرة
    let reference = '';
    // حمولةٌ واحدة نرسلها ونحفظها إن تعثّرت — بمفتاحٍ يمنع تكرارها عند الإعادة
    const payload = {
      idempotencyKey: newKey(),
      items: items.map((i) => ({ id: i.id, qty: i.qty, size: i.size, color: i.color })),
      customer: { name: cust.name, phone: normalizePhone(cust.phone), city: cust.city, area: cust.area, address: cust.address, notes: cust.notes, deliveryFee: delivery },
      coupon: coupon ? { code: coupon.code } : undefined,
      referralCode: (!coupon && refDiscount > 0) ? referral?.code : undefined,
    };
    try {
      const r = await api.post('/orders/cod', payload);
      reference = r.data?.reference || '';
      // حدث بكسل التمويل: شراء مكتمل (أهم حدث لقياس الإعلانات)
      trackPixel('Purchase', { value: grand, num_items: items.reduce((s, i) => s + i.qty, 0), content_ids: items.map((i) => i.id), content_type: 'product' });
    } catch (e) {
      // 4xx رفضٌ نهائيّ (قسيمةٌ انتهت، مخزونٌ نفد): إعادتُه لن تنجح أبداً.
      // ما عداه شبكةٌ أو خادم — نحفظه ليُعاد تلقائياً حين تعود الشبكة.
      const status = e?.response?.status;
      if (!(status >= 400 && status < 500)) {
        try { enqueue(payload); } catch { /* التخزين ممتلئ */ }
      }
      // ونُكمل لشاشة النجاح على أيّ حال: رسالةُ واتساب هناك تحملُ الطلبَ كاملاً
      // فتصلُ صاحبةَ المتجرِ ولو لم يُسجَّل عندنا.
    }
    const snap = orderSnapshot(reference, 'cod');
    const trackUrl = reference ? `${siteOrigin()}/track${storeSlug ? `?store=${storeSlug}` : ''}` : '';
    const waLink = buildWhatsappCheckout(wa, items, {
      ...cust,
      delivery,
      discount,
      couponCode: snap.couponCode,
      reference,
      storeName: snap.storeName,
      eta,
      payment: 'cod',
      trackUrl,
    }, i18n.language);
    setPlacing(false);
    setDoneStore(storeSlug); // نلتقط سلاِگ المتجر قبل تفريغ السلة كي يبقى التتبّع بهويته
    setDoneOrder(snap);      // لقطةُ الشهادة — قبل أن تُفرَّغ السلّة
    setDoneWa(waLink);       // رسالةُ المتابعة — تُفتَحُ بضغطةٍ من شاشة النجاح
    clear();
    // نقفُ عند شاشة النجاح ولا نقفزُ لواتساب.
    //
    // كان الضغطُ على «تأكيد» يرمي الزبونةَ خارجَ الموقعِ فوراً، فلا ترى رقمَ
    // طلبِها ولا شهادةَ شرائِها ولا زرَّ التتبّع — وتظنُّ أنّ كلَّ ما حدث أنّ
    // رسالةً فُتحت. والطلبُ محفوظٌ عندنا أصلاً، وصاحبةُ المتجر يصلُها إشعارٌ
    // وبريد. فواتساب صارت خطوةَ متابعةٍ اختياريّةً بزرٍّ ظاهرٍ بشاشة النجاح.
    setDoneRef(reference);
    setView('done');
  };

  // حفظُ شهادةِ الشراء — صورةً أو طباعةً (ومنها PDF بحوارِ الطباعة)
  const takeReceipt = async (kind) => {
    if (!doneOrder || receiptBusy) return;
    setReceiptBusy(kind);
    try {
      if (kind === 'print') printReceipt(doneOrder, t, ar ? 'rtl' : 'ltr');
      else await saveReceiptImage(doneOrder, t, ar ? 'rtl' : 'ltr');
    } catch {
      setErr(t('receipt.failed'));
    } finally {
      setReceiptBusy('');
    }
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
              /* السهمُ يرجعُ خطوةً واحدةً لا للسلّةِ دفعةً — الرجوعُ الكاملُ كان
                 يُضيّعُ ما مُلئ ويجبرُ الزبونةَ على المرورِ بالخطواتِ من جديد */
              <button onClick={goBack} aria-label={step > 1 ? t('co.stepBack') : t('co.back')} className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/10 text-gold-200 transition hover:bg-gold-400/20">
                <BackIcon className="h-4 w-4" />
              </button>
            )}
            {view === 'cart' ? (
              <><CartIcon className="h-5 w-5" /> {t('cart.title')}
                {count > 0 && <span className="rounded-full bg-wine/15 px-2 py-0.5 text-sm font-bold text-wine">{count}</span>}
              </>
            ) : view === 'done' ? (doneRef ? t('co.doneTitle') : t('co.donePartialTitle')) : t('co.title')}
          </h2>
          <CloseButton onClick={close} variant="wine" />
        </div>

        {view === 'done' ? (
          /* شاشة ما بعد الطلب.
             حفظُ الطلب قد يفشل (شبكة أو خادم)، والرسالةُ تذهب لواتساب على أيّ
             حال — وهذا احتياطٌ جيّد يُبقي الطلب واصلاً. لكنّ الشاشة كانت تقول
             «تم استلام طلبك 🎉 … احتفظي برقم الطلب لمتابعته» بلا رقمٍ أصلاً،
             وتعرض زرَّ تتبّعٍ لن يجد شيئاً — والسلّة فُرِّغت فلا سبيل للإعادة.
             فتظنّ الزبونة أنّ طلبها مسجّل، ولا تراه صاحبةُ المتجر بلوحتها.
             الآن: نجاحٌ حين يُسجَّل، وصدقٌ حين لا يُسجَّل. */
          <div className="animate-fade-up flex min-h-0 flex-1 flex-col overflow-y-auto p-6 text-center">
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              {doneRef ? (
                /* خَتْمٌ لا علامةُ صحٍّ عارية: هالتان ذهبيّتان حول دائرةٍ خضراء —
                   لحظةُ الشراءِ تستحقُّ أن تبدوَ لحظةً لا إشعاراً */
                <span className="relative flex h-24 w-24 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-emerald-500/10" />
                  <span className="absolute inset-2 rounded-full bg-emerald-500/15 ring-1 ring-gold-400/30" />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/50">
                    <CheckIcon className="h-8 w-8 text-emerald-300" />
                  </span>
                </span>
              ) : (
                <span className="bz-tone-amber flex h-20 w-20 items-center justify-center rounded-full">
                  <WhatsAppIcon className="h-10 w-10" />
                </span>
              )}
              <p className="max-w-xs text-sm leading-relaxed text-stone-300">{doneRef ? t('co.doneMsg') : t('co.donePartialMsg')}</p>

              {doneRef && (
                <button
                  type="button"
                  onClick={() => { try { navigator.clipboard.writeText(doneRef); setRefCopied(true); setTimeout(() => setRefCopied(false), 1600); } catch { /* تجاهل */ } }}
                  className="group w-full rounded-2xl bg-gold-400/10 px-6 py-3 ring-1 ring-gold-400/30 transition hover:bg-gold-400/15"
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

              {/* شهادةُ الشراء: ورقةُ الزبونةِ التي تُثبتُ ما طلبته وما دفعت —
                  صورةً تُرسَلُ بواتساب، أو طباعةً يخرجُ منها PDF */}
              {doneOrder && doneRef && (
                <div className="w-full rounded-2xl border border-gold-400/20 bg-gold-400/[0.06] p-3.5 text-start">
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-gold-200">
                    <ReceiptIcon className="h-4 w-4 shrink-0" /> {t('receipt.title')}
                  </p>
                  <p className="mb-2.5 text-[11px] leading-relaxed text-stone-400">{t('receipt.hint')}</p>
                  <div className="flex gap-2">
                    <button
                      type="button" onClick={() => takeReceipt('image')} disabled={Boolean(receiptBusy)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gold-400/15 py-2.5 text-xs font-bold text-gold-200 ring-1 ring-gold-400/30 transition hover:bg-gold-400/25 disabled:opacity-50"
                    >
                      <DownloadIcon className="h-4 w-4 shrink-0" />
                      {receiptBusy === 'image' ? t('common.loading') : t('receipt.saveImage')}
                    </button>
                    <button
                      type="button" onClick={() => takeReceipt('print')} disabled={Boolean(receiptBusy)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gold-400/25 py-2.5 text-xs font-bold text-stone-300 transition hover:bg-gold-400/10 disabled:opacity-50"
                    >
                      <PrintIcon className="h-4 w-4 shrink-0" /> {t('receipt.print')}
                    </button>
                  </div>
                </div>
              )}
              {err && <p className="text-xs text-red-300">{err}</p>}
            </div>

            {/* ترتيبُ الأزرارِ يتبعُ حالَ الطلب.
                سُجِّل الطلبُ: التتبّعُ أوّلاً، وواتساب متابعةٌ اختياريّة.
                لم يُسجَّل (شبكةٌ أو خادم): واتساب هي الطريقُ الوحيدُ الذي يُوصِلُ
                الطلبَ الآن، فتتصدّرُ الشاشةَ ولا تُدفَنُ تحتَ زرٍّ لا يجدُ شيئاً. */}
            <div className="mt-4 flex w-full flex-col gap-2">
              {doneRef ? (
                <>
                  <Link
                    to={trackPath(doneStore)}
                    onClick={close}
                    className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-center bz-cta font-bold ring-1 ring-[#BAB9B7]/35 transition hover:brightness-110"
                   
                  >
                    <TruckIcon className="h-5 w-5 shrink-0" /> {t('co.doneTrack')}
                  </Link>
                  {doneWa && (
                    <a href={doneWa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full !rounded-full !py-3">
                      <WhatsAppIcon className="h-5 w-5 shrink-0" /> {t('co.doneWhatsapp')}
                    </a>
                  )}
                </>
              ) : doneWa && (
                <a href={doneWa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full !rounded-full !py-4">
                  <WhatsAppIcon className="h-5 w-5 shrink-0" /> {t('co.doneSendNow')}
                </a>
              )}
              <button onClick={close} className="w-full rounded-full border border-gold-400/25 py-3 font-semibold text-stone-300 transition hover:bg-gold-400/10">
                {t('co.doneKeepShopping')}
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-stone-400">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bz-softico-dark">
              <BagIcon className="h-9 w-9" />
            </span>
            <p>{t('cart.empty')}</p>
            <button
              onClick={close}
              className="rounded-full px-7 py-3 bz-cta font-bold ring-1 ring-[#BAB9B7]/35 transition hover:brightness-110"
             
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
                      {/* الصورة والاسم روابط لصفحة المنتج (تغلق الدرج) — مراجعة القطعة قبل الإتمام */}
                      <Link to={productPath(i)} onClick={close} className="shrink-0">
                        <img src={i.imageUrl ? cldThumb(i.imageUrl, 200) : phGlyph(120, 160, '👗')} alt={i.name} loading="lazy" decoding="async" className="h-20 w-16 rounded-xl object-cover shadow-sm transition hover:opacity-85" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={productPath(i)} onClick={close} className="block truncate font-display text-sm font-semibold text-stone-100 hover:text-gold-200">{i.name}</Link>
                        {(i.size || i.color) && (
                          <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-stone-400">
                            {i.size && <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-gold-200">{t('store.sizeLabel')}: {sizeLabel(i.size, t)}</span>}
                            {i.color && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/10 px-2 py-0.5 text-gold-200">
                                {colorToCss(i.color) && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorToCss(i.color), boxShadow: '0 0 0 1px rgba(255,255,255,0.5), inset 0 0 0 1px rgba(0,0,0,0.15)' }} />}
                                {i.color}
                              </span>
                            )}
                          </p>
                        )}
                        <p className="mt-1 font-display font-bold text-gold-300">
                          {t('common.currency')}{(i.price * i.qty).toFixed(2)}
                          {i.oldPrice > i.price && <span className="ms-1.5 text-xs font-normal text-stone-500 line-through">{t('common.currency')}{(i.oldPrice * i.qty).toFixed(2)}</span>}
                          {i.qty > 1 && <span className="ms-1.5 text-xs font-normal text-stone-400">({t('common.currency')}{i.price} × {i.qty})</span>}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button onClick={() => remove(i.key)} aria-label={t('common.remove')} className="text-stone-500 transition hover:text-red-400"><XIcon className="h-4 w-4" /></button>
                        {/* عدّاد كمية بحبة دائرية أنيقة */}
                        <div className="flex items-center gap-0.5 rounded-full border border-gold-400/30 px-1 py-0.5">
                          <button onClick={() => setQty(i.key, i.qty - 1)} aria-label="-" className="flex h-6 w-6 items-center justify-center rounded-full leading-none text-gold-200 transition hover:bg-gold-400/10">−</button>
                          <span className="w-5 text-center text-sm font-semibold">{i.qty}</span>
                          <button onClick={() => setQty(i.key, i.qty + 1)} disabled={i.maxQty != null && i.qty >= i.maxQty} aria-label="+" className="flex h-6 w-6 items-center justify-center rounded-full leading-none text-gold-200 transition hover:bg-gold-400/10 disabled:opacity-30">+</button>
                        </div>
                        {i.maxQty != null && i.maxQty > 0 && i.maxQty <= 3 && (
                          <span className="mt-1 text-[10px] font-bold text-red-600">{t('product.lastFew', { count: i.maxQty })}</span>
                        )}
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
                            <div className="h-full rounded-full bz-progress transition-all duration-500" style={{ width: `${Math.min(100, Math.round((total / freeOver) * 100))}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {(() => {
                    const saved = items.reduce((s, i) => s + (i.oldPrice && i.oldPrice > i.price ? (i.oldPrice - i.price) * i.qty : 0), 0);
                    return saved > 0 ? (
                      <div className="mb-2 flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300">
                        <span className="inline-flex items-center gap-1.5"><PartyIcon className="h-4 w-4 shrink-0" /> {t('cart.saved')}</span>
                        <span>{t('common.currency')}{saved.toFixed(2)}</span>
                      </div>
                    ) : null;
                  })()}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-stone-300">{t('cart.total')}</span>
                    <span className="font-display text-2xl font-bold gradient-text">{t('common.currency')}{total.toFixed(2)}</span>
                  </div>
                  {/* حبة إتمام فاخرة بتدرج خمري وهالة ذهبية — والسهم يتبع اتجاه اللغة */}
                  <button
                    onClick={() => { setErr(''); setView('checkout'); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full py-4 bz-cta font-bold ring-1 ring-[#BAB9B7]/35 transition hover:brightness-110"
                    style={{ boxShadow: '0 16px 34px -14px rgba(14, 14, 13, 0.65)' }}
                  >
                    {t('cart.proceed')} <ForwardIcon className="h-4 w-4" />
                  </button>
                  <button onClick={clear} className="mt-2 w-full text-center text-xs text-stone-400 hover:text-red-300">{t('cart.clear')}</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="checkout" initial={{ opacity: 0, x: ar ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: ar ? 16 : -16 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
                {/* شريطُ الخطوات.
                    الخيطُ لا يمرُّ خلفَ الدوائرِ بل *بينَها*: كان خطّاً واحداً ممتدّاً
                    تحتَ الشريطِ كلِّه، وخلفيّاتُ الدوائرِ شفّافةٌ (‎/20‎) فيظهرُ عابراً
                    وسطَ كلِّ دائرةٍ ويقطعُها. الآن كلُّ وَصْلةٍ عنصرٌ مستقلٌّ يملأُ
                    الفراغَ بين محطّتين (flex-1) ويتلوّنُ وحدَه حين تُجتازُ المحطّة —
                    فلا يلامسُ الخيطُ قرصاً أبداً، ولا يحتاجُ حساباً بالنِّسَب. */}
                <div className="border-b border-gold-400/15 px-4 pb-3 pt-3.5">
                  <div className="flex items-start">
                    {[
                      { n: 1, label: t('co.step1'), Icon: UserIcon },
                      { n: 2, label: t('co.step2'), Icon: TruckIcon },
                      { n: 3, label: t('co.step3'), Icon: CashIcon },
                    ].map(({ n, label, Icon }, idx) => {
                      const done = step > n;
                      const active = step === n;
                      return (
                        <Fragment key={n}>
                          {idx > 0 && (
                            /* mt-[13px]: منتصفُ قرصٍ ارتفاعُه ٢٨ بكسل — تُحاذي الوصلةُ
                               مركزَ الدوائرِ بلا تموضعٍ مطلق */
                            <span
                              aria-hidden="true"
                              className="mx-1 mt-[13px] h-0.5 flex-1 rounded-full transition-colors duration-500"
                              style={{ background: step > idx ? '#999795' : 'rgba(129,126,123,0.28)' }}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => { if (n < step) { setErr(''); setStep(n); } }}
                            disabled={n >= step}
                            aria-current={active ? 'step' : undefined}
                            className="flex w-16 shrink-0 flex-col items-center gap-1.5 disabled:cursor-default"
                          >
                            <span className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 transition ${
                              done ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40'
                                : active ? 'bg-gold-400/20 text-gold-200 ring-gold-400/50'
                                : 'bg-black/20 text-stone-500 ring-gold-400/20'}`}
                            >
                              {done ? <CheckIcon className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                            </span>
                            <span className={`text-[10px] font-semibold leading-tight ${active ? 'text-gold-200' : done ? 'text-stone-300' : 'text-stone-500'}`}>{label}</span>
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* الخطواتُ تنزلقُ ولا تذوب: حركةُ framer-motion محكومةٌ بـrAF،
                    وهو يتوقّفُ ما دام التبويبُ مخفيّاً أو موفّراً للطاقة. لو بدأت
                    الخطوةُ بشفافيّةِ صفرٍ ولم تعمل الحركة، بقيت الاستمارةُ بيضاءَ
                    فارغةً. الانزلاقُ وحدَه أسوأُ ما يفعلُه أن يتركَها مزاحةً ١٠ بكسل. */}
                <div ref={formRef} className="flex-1 space-y-4 overflow-y-auto p-4">
                  {/* ═══ الخطوة ١: بياناتُ الزبونة ═══ */}
                  {step === 1 && (
                    <motion.div initial={{ y: 10 }} animate={{ y: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
                      <div className="glass p-4">
                        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-gold-200"><UserIcon className="h-4 w-4 shrink-0" /> {t('co.step1Title')}</h3>
                        <p className="mb-3 text-[11px] leading-relaxed text-stone-400">{t('co.step1Hint')}</p>
                        <div className="space-y-3">
                          {/* autocomplete: الجوال يقترح الاسم/الهاتف المحفوظين — تعبئة أسرع = إتمام أكثر */}
                          <div data-field="name">
                            <label htmlFor="bz-co-name" className="mb-1 block text-[11px] font-bold text-stone-300">{t('co.name')}</label>
                            <input id="bz-co-name" ref={nameRef} className={`input !rounded-2xl ${invalid.name ? 'ring-1 ring-red-400/70' : ''}`} autoComplete="name" placeholder={t('co.namePlaceholder')} value={cust.name} onChange={(e) => { setCust({ ...cust, name: e.target.value }); if (invalid.name) setInvalid((v) => ({ ...v, name: false })); }} />
                          </div>
                          {/* #3: تحقّق فوري لرقم الموبايل — علامة صح خضراء لمّا يصحّ، وتلميح لمّا يكون ناقصاً */}
                          <div data-field="phone">
                            {/* العنوانُ فوقَ الحقلِ لا داخلَه: الحقلُ مقلوبٌ لليسار (الرقمُ لاتينيّ)
                                فنصٌّ عربيٌّ بداخلِه كان ينقلبُ ترتيبُه — «XXXXXXXX رقم الموبايل · 05» */}
                            <label htmlFor="bz-co-phone" className="mb-1 block text-[11px] font-bold text-stone-300">{t('co.phone')}</label>
                            {/* dir="ltr" على الحاوية نفسها (مش الحقل لحاله) — الرقم بيتّجه يسار-يمين
                                دايماً، فلازم "end-3" تتحسب بنفس الاتجاه حتى ما تتراكب علامة الصح فوق
                                أول رقم (الصفر) لما تنعكس start/end بصفحة عربية RTL */}
                            <div className="relative" dir="ltr">
                              {/* sanitizeMobileInput + maxLength: أرقام فقط، يقصّ المقدّمات الدوليّة
                                  (00970/00972/+972) ويقف عند ١٠ خانات — أوبتيموس يرفض غير هيك */}
                              <input
                                id="bz-co-phone"
                                className={`input !rounded-2xl pe-9 ${invalid.phone ? 'ring-1 ring-red-400/70' : phoneOk ? 'ring-1 ring-emerald-400/60' : ''}`}
                                inputMode="numeric" autoComplete="tel" maxLength={10} required
                                aria-invalid={cust.phone.trim() && !phoneOk ? 'true' : 'false'}
                                placeholder="05XXXXXXXX" value={cust.phone}
                                onChange={(e) => { setCust({ ...cust, phone: sanitizeMobileInput(e.target.value) }); if (invalid.phone) setInvalid((v) => ({ ...v, phone: false })); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goNext(); } }}
                              />
                              {phoneOk && <CheckIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />}
                            </div>
                            {/* التلميح ظاهر دايماً قبل ما يصحّ الرقم: مطلوب، يبدأ بـ 05، و١٠ أرقام */}
                            {!phoneOk && (
                              <p className={`mt-1 text-xs ${invalid.phone || cust.phone.trim() ? 'text-red-300' : 'text-stone-400'}`}>
                                {t('co.phoneExample')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* لمحةُ السلّة بالخطوةِ الأولى: ما تشتريه وكم — فلا تُدخلُ بياناتِها
                          وهي لا ترى ما تدفعُ ثمنَه */}
                      <div className="flex items-center justify-between rounded-2xl border border-gold-400/15 bg-black/20 px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-stone-300">
                          <BagIcon className="h-4 w-4 shrink-0 text-gold-200" /> {t('receipt.pieces', { count: items.reduce((s, i) => s + i.qty, 0) })}
                        </span>
                        <span className="font-display font-bold text-gold-200">{t('common.currency')}{total.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* ═══ الخطوة ٢: مكانُ التوصيل ═══ */}
                  {step === 2 && (
                    <motion.div initial={{ y: 10 }} animate={{ y: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
                      <div className="glass p-4">
                        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-gold-200"><PinIcon className="h-4 w-4 shrink-0" /> {t('co.step2Title')}</h3>
                        <p className="mb-3 text-[11px] leading-relaxed text-stone-400">{t('co.step2Hint')}</p>
                        <div className="space-y-3">
                          {/* المكان: قائمة مسطّحة — كل مدينة وقرية بندٌ مستقل بسعره (بلا تجميع).
                              اختيار قرية يضبط محافظتها (parent) داخلياً لإرسال دقيق لشركة التوصيل */}
                          <div data-field="city">
                            <span className="mb-1 block text-[11px] font-bold text-stone-300">{t('co.city')}</span>
                            <CitySearch
                              value={placeLabelOf(cust.city, cust.area)}
                              options={cityChoices}
                              invalid={invalid.city}
                              onClear={() => setCust((p) => ({ ...p, city: '', area: '' }))}
                              onText={(txt) => { setCust((p) => ({ ...p, city: txt, area: '' })); if (invalid.city) setInvalid((p) => ({ ...p, city: false })); }}
                              onPick={(name, fee, opt) => {
                                const parent = opt?.parent || name;
                                // القرية تروح لحقل area والمحافظة لحقل city (يطابق city/area بأوبتيموس)
                                setCust((p) => ({ ...p, city: parent, area: parent === name ? '' : name }));
                                setInvalid((p) => ({ ...p, city: false }));
                              }}
                            />
                          </div>
                          <div>
                            <label htmlFor="bz-co-address" className="mb-1 block text-[11px] font-bold text-stone-300">{t('co.addressLabel')}</label>
                            <input id="bz-co-address" className="input !rounded-2xl" autoComplete="street-address" placeholder={t('co.addressHint')} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                          </div>
                          <div>
                            <label htmlFor="bz-co-notes" className="mb-1 block text-[11px] font-bold text-stone-300">{t('co.notes')}</label>
                            <textarea id="bz-co-notes" className="input !rounded-2xl" rows={2} placeholder={t('co.notesHint')} value={cust.notes} onChange={(e) => setCust({ ...cust, notes: e.target.value })} />
                          </div>
                        </div>
                      </div>

                      {/* أجرةُ المكانِ ومدّتُه فورَ اختيارِه — لا مفاجأةَ بآخرِ خطوة */}
                      {pickedLoc && (
                        <div className="rounded-2xl border border-gold-400/20 bg-gold-400/[0.06] p-3.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 font-semibold text-gold-200"><TruckIcon className="h-4 w-4 shrink-0" /> {t('co.delivery')}</span>
                            {freeShip
                              ? <span className="inline-flex items-center gap-1 font-bold text-emerald-300">{t('co.freeShipping')} <PartyIcon className="h-4 w-4 shrink-0" /></span>
                              : <span className="font-bold text-stone-200">{t('common.currency')}{delivery.toFixed(2)}</span>}
                          </div>
                          {/* #1: مدة التوصيل المتوقعة حسب شريحة المكان — يقلّل التردّد */}
                          {eta && <p className="mt-1.5 text-xs font-medium text-emerald-300">{eta}</p>}
                        </div>
                      )}

                      {/* تحفيز الشحن المجاني: كم باقي + شريط تقدّم ذهبي */}
                      {freeOver > 0 && !freeShip && (
                        <div className="rounded-2xl bg-gold-400/10 px-3.5 py-3">
                          <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-gold-200">
                            <TruckIcon className="h-4 w-4 shrink-0" /> {t('co.freeShippingHint', { amount: (freeOver - afterDiscount).toFixed(2) })}
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bz-progress transition-all duration-500" style={{ width: `${Math.min(100, Math.round((afterDiscount / freeOver) * 100))}%` }} />
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] text-stone-400">* {t('co.deliveryNote')}</p>
                    </motion.div>
                  )}

                  {/* ═══ الخطوة ٣: الدفعُ والمراجعة ═══ */}
                  {step === 3 && (
                    <motion.div initial={{ y: 10 }} animate={{ y: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
                      {/* اختيارُ طريقةِ الدفع — بطاقتان لا زرّان متلاصقان بالأسفل.
                          الزرّان كانا يُنفّذان الطلبَ فورَ الضغط، فأيُّ ضغطةٍ بالخطأ
                          طلبٌ مُرسَل. الآن: تُختارُ الطريقةُ أوّلاً، ويُؤكَّدُ بزرٍّ واحد */}
                      <div>
                        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-200"><CardIcon className="h-4 w-4 shrink-0" /> {t('co.payMethod')}</h3>
                        <div className="space-y-2">
                          {/* الطريقتانِ تظهرانِ دائماً، والفيزا تُعطَّلُ بوضوحٍ حين لا
                              يكونُ المتجرُ قد فعّلها: شارةُ «غير مفعّلة حالياً» وزرٌّ
                              لا يُضغَط. إخفاؤُها كان يتركُ الزبونَ يظنُّ أنّ المنصّةَ
                              لا تعرفُ الدفعَ بالبطاقةِ أصلاً. */}
                          {[
                            { id: 'cod', Icon: CashIcon, title: t('co.payCodTitle'), desc: t('co.payCodDesc'), off: false },
                            { id: 'card', Icon: CardIcon, title: t('co.payCardTitle'), desc: t('co.payCardDesc'), off: !cardEnabled },
                          ].map(({ id, Icon, title, desc, off }) => {
                            const on = payMethod === id && !off;
                            return (
                              /* الحلقةُ والنقطةُ بلونٍ صريح (#999795) لا بصنفِ شفافيّة:
                                 كلُّ درجاتِ border-gold-400/* تُردُّ للونٍ واحدٍ بالوضعِ
                                 النهاريّ، فالبطاقةُ المختارةُ كانت تُشبهُ غيرَ المختارة */
                              <button
                                key={id} type="button"
                                onClick={() => { if (off) return; setPayMethod(id); setErr(''); }}
                                disabled={off}
                                aria-pressed={on}
                                style={on ? { boxShadow: '0 0 0 2px #999795' } : undefined}
                                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start transition ${
                                  off ? 'cursor-not-allowed border-gold-400/10 bg-black/10 opacity-60'
                                    : on ? 'border-transparent bg-gold-400/10' : 'border-gold-400/15 bg-black/20 hover:bg-gold-400/5'}`}
                              >
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-gold-400/20 text-gold-200' : 'bg-black/20 text-stone-400'}`}>
                                  <Icon className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={`flex flex-wrap items-center gap-x-1.5 text-sm font-bold ${on ? 'text-gold-200' : 'text-stone-200'}`}>
                                    {title}
                                    {off && (
                                      <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold text-stone-400">
                                        {t('co.payNotEnabled')}
                                      </span>
                                    )}
                                  </span>
                                  <span className="block text-[11px] leading-snug text-stone-400">{off ? t('co.payNotEnabledHint') : desc}</span>
                                </span>
                                <span
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition"
                                  /* اللونُ على الحاوية: أيقوناتُنا ترسمُ بـcurrentColor ولا
                                     تقبلُ style. وصحٌّ داكنٌ على الذهب لأنّ الأبيضَ
                                     على ‎#999795‎ تباينُه ٢٫٣ فقط. */
                                  style={on ? { borderColor: '#999795', background: '#999795', color: '#313130' } : { borderColor: 'rgba(129,126,123,0.45)' }}
                                >
                                  {on && <CheckIcon className="h-3 w-3" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {/* البريدُ مطلوبٌ للبطاقةِ وحدَها — يظهرُ حين تُختار، لا قبلها */}
                        {payMethod === 'card' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                            <input
                              type="email" dir="ltr" data-field="email"
                              className={`input !rounded-2xl mt-2 ${invalid.email ? 'ring-1 ring-red-400/70' : ''}`}
                              autoComplete="email" placeholder={t('co.emailPlaceholder')}
                              value={cardEmail}
                              onChange={(e) => { setCardEmail(e.target.value); if (invalid.email) setInvalid((v) => ({ ...v, email: false })); }}
                            />
                            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                              <LockIcon className="h-3.5 w-3.5 shrink-0" /> {t('co.cardHint')}
                            </p>
                            {/* التنبيهُ الأهمُّ بالشاشة: البطاقةُ تحملُ ثمنَ البضاعةِ
                                وحدَه، ورسومُ التوصيلِ تُدفَعُ نقداً للمندوب. بلا هذا
                                يظنُّ الزبونُ أنّه سدّدَ كلَّ شيءٍ فيُفاجَأُ بمبلغٍ عند
                                الباب — وهي أكثرُ لحظةٍ يُرفَضُ فيها الطلب. */}
                            {delivery > 0 && (
                              <div className="mt-2.5 flex items-start gap-2 rounded-2xl border border-gold-400/30 bg-gold-400/[0.08] px-3.5 py-3">
                                <TruckIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" />
                                <div className="min-w-0 text-[11px] leading-relaxed text-stone-300">
                                  <p className="font-bold text-gold-200">{t('co.cardSplitTitle')}</p>
                                  <p className="mt-0.5">
                                    {t('co.cardSplitBody', {
                                      goods: `${t('common.currency')}${afterDiscount.toFixed(2)}`,
                                      delivery: `${t('common.currency')}${delivery.toFixed(2)}`,
                                    })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
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
                        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-200"><TicketIcon className="h-4 w-4 shrink-0" /> {t('coupon.title')}</h3>
                        {coupon ? (
                          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
                            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-300"><CheckIcon className="h-4 w-4 shrink-0" /> {coupon.code} — −{t('common.currency')}{discount.toFixed(2)}</span>
                            <button onClick={removeCoupon} className="text-xs text-stone-400 hover:text-red-300">{t('coupon.remove')}</button>
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

                      {/* ملخّص الطلب — المراجعةُ الأخيرةُ قبل الضغط */}
                      <div className="glass p-3.5">
                        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-200"><ReceiptIcon className="h-4 w-4 shrink-0" /> {t('co.summary')}</h3>
                        <div className="space-y-1.5 text-sm">
                          {items.map((i) => (
                            <div key={i.key} className="flex items-center justify-between text-stone-300">
                              <span className="truncate pe-2">{i.name}{i.size ? ` (${sizeLabel(i.size, t)})` : ''}{i.color ? ` - ${i.color}` : ''} ×{i.qty}</span>
                              <span className="shrink-0">{t('common.currency')}{(i.price * i.qty).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="my-2 h-px bg-wine/10" />
                          <div className="flex justify-between text-stone-400"><span>{t('co.subtotal')}</span><span>{t('common.currency')}{total.toFixed(2)}</span></div>
                          {(() => {
                            const saved = items.reduce((s, i) => s + (i.oldPrice && i.oldPrice > i.price ? (i.oldPrice - i.price) * i.qty : 0), 0);
                            return saved > 0 ? (
                              <div className="flex justify-between font-semibold text-emerald-300"><span>{t('cart.saved')}</span><span>{t('common.currency')}{saved.toFixed(2)}</span></div>
                            ) : null;
                          })()}
                          {discount > 0 && (
                            <div className="flex justify-between text-emerald-300">
                              <span>{coupon ? `${t('coupon.discount')} (${coupon.code})` : flashDiscount > 0 ? t('store.flashDiscountLine') : refDiscount > 0 ? t('referral.discountLine') : t('loyalty.discountLine')}</span>
                              <span>−{t('common.currency')}{discount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-stone-400">
                            <span>{t('co.delivery')}</span>
                            {freeShip
                              ? <span className="inline-flex items-center gap-1 font-bold text-emerald-300">{t('co.freeShipping')} <PartyIcon className="h-4 w-4 shrink-0" /></span>
                              : <span>{t('common.currency')}{delivery.toFixed(2)}</span>}
                          </div>
                          <div className="mt-1 flex justify-between font-bold text-gold-200"><span>{t('co.grandTotal')}</span><span className="font-display text-lg gradient-text">{t('common.currency')}{grand.toFixed(2)}</span></div>
                          {/* الملخّصُ يذكرُ كيف يُدفعُ المبلغُ لا كم هو فقط — ويتبدّلُ
                              مع اختيارِ الطريقة، فما يُراجَعُ هو ما سيحدثُ فعلاً */}
                          <div className="flex justify-between text-stone-400">
                            <span>{t('co.payMethod')}</span>
                            <span className="font-semibold text-stone-300">
                              {payMethod === 'card' ? t('co.payCardTitle') : t('co.payCodTitle')}
                            </span>
                          </div>
                          {/* بالبطاقةِ ينقسمُ الإجماليُّ دفعتَين: ما يُخصَمُ الآنَ وما
                              يُدفَعُ عند الباب. عرضُ رقمٍ واحدٍ هنا ثمّ خصمُ غيرِه من
                              البطاقةِ هو عينُ «الخربطة» التي نتجنّبُها. */}
                          {payMethod === 'card' && delivery > 0 && (
                            <div className="mt-2 space-y-1.5 rounded-xl border border-gold-400/25 bg-gold-400/[0.08] p-2.5">
                              <div className="flex items-center justify-between text-sm font-bold text-gold-200">
                                <span className="inline-flex items-center gap-1.5"><CardIcon className="h-4 w-4 shrink-0" /> {t('co.payNowLine')}</span>
                                <span>{t('common.currency')}{afterDiscount.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm text-stone-300">
                                <span className="inline-flex items-center gap-1.5"><TruckIcon className="h-4 w-4 shrink-0" /> {t('co.payCourierLine')}</span>
                                <span className="font-semibold">{t('common.currency')}{delivery.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* إلى أين يذهبُ الطلبُ ولمن — مراجعةٌ سريعةٌ بلا رجوعٍ لخطوة */}
                        <div className="mt-3 space-y-1 border-t border-gold-400/15 pt-2.5 text-[11px] leading-relaxed text-stone-400">
                          <p className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5 shrink-0" /> {cust.name} · <span dir="ltr">{cust.phone}</span></p>
                          <p className="flex items-center gap-1.5"><PinIcon className="h-3.5 w-3.5 shrink-0" /> {[cust.city, cust.area && cust.area !== cust.city ? cust.area : '', cust.address].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>

                      {/* طمأنةٌ قبل الضغط: بياناتُها محميّة، ولا دفعَ قبل الاستلام */}
                      <div className="flex items-start gap-2 rounded-2xl border border-gold-400/15 bg-black/20 px-3.5 py-3 text-[11px] leading-relaxed text-stone-400">
                        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" />
                        <span>{payMethod === 'card'
                          ? (delivery > 0 ? t('co.trustCardSplit') : t('co.trustCard'))
                          : t('co.trustCod')}</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* شريطُ الأسفلِ الثابت: «السابق» و«التالي» جنباً إلى جنب.
                    كان التالي وحدَه يملأُ العرض، والرجوعُ سهماً صغيراً بالرأسِ لا
                    تكادُ العينُ تجدُه — فمن أراد تصحيحَ عنوانِه بحثَ عن مخرج. الآن
                    الطريقانِ ظاهرانِ معاً: الرجوعُ خفيفٌ بإطارٍ رفيع، والتقدّمُ
                    ممتلئٌ بلونِ العلامة، فتُعرَفُ الوجهةُ الأرجحُ بلا قراءة. */}
                <div className="border-t border-gold-400/15 p-4">
                  {err && <p className="mb-2 text-center text-xs text-red-300">{err}</p>}
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={goBack}
                      aria-label={step > 1 ? t('co.prev') : t('co.backToCart')}
                      className="flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-gold-400/30 px-4 py-4 text-sm font-bold text-stone-300 transition hover:bg-gold-400/10 min-[360px]:px-5"
                    >
                      <BackIcon className="h-4 w-4 shrink-0" />
                      {/* بالخطوةِ الأولى الرجوعُ يعودُ للسلّةِ لا لخطوةٍ سابقة.
                          وتحتَ ٣٦٠ بكسل يبقى السهمُ وحدَه: زرُّ التأكيدِ يحملُ
                          المبلغَ، وقياسُ الشاشةِ هناك لا يتّسعُ للنصَّين معاً —
                          فكان المبلغُ يُقَصُّ («تأكيد الطلب · ₪2…»). */}
                      <span className="max-[359px]:hidden">{step > 1 ? t('co.prev') : t('co.backToCart')}</span>
                    </button>
                  {step < 3 ? (
                    <button
                      onClick={goNext}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-4 bz-cta font-bold ring-1 ring-[#BAB9B7]/35 transition hover:brightness-110"
                      style={{ boxShadow: '0 16px 34px -14px rgba(14, 14, 13, 0.65)' }}
                    >
                      {t('co.next')} <ForwardIcon className="h-4 w-4 shrink-0" />
                    </button>
                  ) : (
                    /* زرُّ الإتمامِ بهويّةِ المتجرِ لا بهويّةِ واتساب.
                       كان أخضرَ بشعارِ واتساب، فيبدو الطلبُ كأنّه يُرسَلُ رسالةً
                       لا يُسجَّلُ عند المتجر — والزبونةُ تتردّدُ أمامَ زرٍّ يحملُ
                       علامةَ تطبيقٍ آخر. الآن: قفلٌ للدفعِ الآمن، وعلامةُ صحٍّ
                       للاستلام، وواتساب تظهرُ بعدَ التأكيدِ خياراً للمتابعة. */
                    <button
                      onClick={payMethod === 'card' ? payWithCard : confirmOrder}
                      disabled={placing || cardBusy}
                      /* حجمٌ واحدٌ (١٤) لا يكبرُ مع الشاشة: الزرُّ يحملُ مبلغاً لا
                         يجوزُ أن يُقَصَّ، والنصُّ الإنجليزيُّ أطولُ من العربيّ —
                         فبالحجمِ الكامل كان يخرجُ «Confirm order · …» بلا رقم. */
                      className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-4 text-sm bz-cta font-bold ring-1 ring-[#BAB9B7]/35 transition hover:brightness-110 disabled:opacity-60"
                      style={{ boxShadow: '0 16px 34px -14px rgba(14, 14, 13, 0.65)' }}
                    >
                      {(placing || cardBusy) ? t('common.loading') : (
                        <>
                          {payMethod === 'card' ? <LockIcon className="h-5 w-5 shrink-0" /> : <CheckIcon className="h-5 w-5 shrink-0" />}
                          {/* رقمُ الزرِّ هو المخصومُ فعلاً لا قيمةُ الطلب: بالبطاقةِ
                              ثمنُ البضاعةِ وحدَه، وبالاستلامِ الإجماليُّ كلُّه */}
                          <span className="truncate">{payMethod === 'card'
                            ? t('co.payNow', { amount: `${t('common.currency')}${afterDiscount.toFixed(2)}` })
                            : t('co.confirmPay', { amount: `${t('common.currency')}${grand.toFixed(2)}` })}</span>
                        </>
                      )}
                    </button>
                  )}
                  </div>
                  {step === 3 && (
                    <p className="mt-2 text-center text-[10px] text-stone-500">
                      {payMethod === 'card' ? t('co.cardHint') : t('co.confirmHint')}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </aside>
    </div>
  );
}

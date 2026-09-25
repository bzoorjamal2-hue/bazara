import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { clearCachePrefixes } from '../../utils/apiCache.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import CollectionWide from '../../components/CollectionWide.jsx';
import BannerEditor from '../../components/BannerEditor.jsx';
import OpostConnect from '../../components/OpostConnect.jsx';
import EpsConnect from '../../components/EpsConnect.jsx';
import GoboxConnect from '../../components/GoboxConnect.jsx';
import { Field, SectionHead, RowTools, PageHead, DateInput } from '../../components/FormField.jsx';
import useDraft, { clearDraft } from '../../hooks/useDraft.js';
import {
  SaveIcon, TruckIcon, ImageIcon, GiftIcon, FolderIcon, MegaphoneIcon, RulerIcon, ShieldIcon,
  StoreIcon, PhoneIcon, BoltIcon, ChartIcon, TagIcon, CardIcon, GearIcon, CheckIcon, CopyIcon, LinkIcon, ShareIcon,
  ClockIcon, SparkleIcon, WhatsAppIcon, InstagramIcon, FacebookIcon, CashIcon, PinIcon, GridIcon, ArrowDownIcon,
} from '../../components/icons.jsx';
import { cldThumb } from '../../utils/cloudinary.js';
import { SIZE_CHART } from '../../utils/sizes.js';
import { DEPARTMENTS, normDept, storeDepts } from '../../utils/departments.js';
import DeptIcon, { DeptsIcon } from '../../components/DeptIcon.jsx';
import BankSelect from '../../components/BankSelect.jsx';
import BANKS from '../../utils/banks.js';
import { usePlatformCatKeys, catDept, platformCatImage, platformCatName, platformKeysOfDept, storeBuiltinKeys } from '../../utils/platformCategories.js';
import { copyText } from '../../utils/links.js';

// أيقونتا إخفاء/إظهار (عين مشطوبة / عين) — للتحكم بظهور الفئة بالمتجر
const EyeOffGlyph = (p) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6A18.6 18.6 0 0 0 2 12s3 8 10 8a9.3 9.3 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
  </svg>
);
const EyeGlyph = (p) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

// حلقة تقدّم اكتمال الإعدادات — تعطي المالكة هدفاً واضحاً بدل قائمة خانات صمّاء
function ProgressRing({ pct }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center">
      <svg viewBox="0 0 52 52" className="h-14 w-14 -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="stroke-current text-stone-400/25" />
        <circle
          cx="26" cy="26" r={r} fill="none" stroke="url(#bz-progress)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .7s ease' }}
        />
        <defs>
          <linearGradient id="bz-progress" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#BAB9B7" /><stop offset="100%" stopColor="#73716E" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums text-gold-300">{pct}%</span>
    </span>
  );
}

// أقسام الإعدادات بالترتيب: [معرّف المرساة، مفتاح الترجمة تحت dashboard.store، هل القسم مكتمل؟]
// مصدر واحد لشريط التنقّل ومراقبة القسم النشط ومؤشّر الاكتمال
// تخطيطُ الأقسام: لكلِّ خيارٍ صفّان يُريانِ إيقاعَه (ممتلئٌ = شبكة، ناقصٌ = رفّ)
const LAYOUT_CHOICES = [
  ['mixed', [true, false]],
  ['grid', [true, true]],
  ['rail', [false, false]],
];

const SECTIONS = [
  ['s-basics', 'basics', (f) => Boolean(f.name && f.slug && f.logoUrl)],
  ['s-contact', 'contact', (f) => Boolean(f.whatsapp)],
  ['s-banners', 'banners', (f) => (f.banners || []).some((b) => String(b?.title || '').trim())],
  ['s-layout', 'layoutTitle', (f) => Boolean(f.sectionLayout) && f.sectionLayout !== 'mixed'],
  ['s-zones', 'zones', (f) => Number(f.deliveryTiers?.wb) > 0],
  ['s-flash', 'flashTitle', (f) => Number(f.flashPercent) > 0 && Boolean(f.flashEndsAt)],
  ['s-ads', 'adsTitle', (f) => Boolean(f.fbPixel || f.tiktokPixel || f.gaId)],
  ['s-depts', 'deptsTitle', (f) => (f.departments || []).length > 0],
  ['s-categories', 'categories', (f) => Object.values(f.categoryMeta || {}).some((m) => m?.image || m?.name) || (f.customCategories || []).length > 0],
  ['s-collections', 'collections', (f) => (f.collections || []).some((c) => String(c?.title || '').trim())],
  ['s-marketing', 'marketing', (f) => Boolean(String(f.welcomeOffer || '').trim())],
  ['s-sizechart', 'sizeChart', (f) => Object.values(f.sizeChart || {}).some((r) => r && Object.values(r).some(Boolean))],
  ['s-return', 'returnPolicy', (f) => Boolean(String(f.returnPolicy || '').trim())],
  ['s-delivery', 'deliveryPayment', (f) => Boolean(String(f.deliveryInfo || '').trim() || String(f.paymentInfo || '').trim())],
];

// قسمٌ طويلٌ يُطوى حتّى يُفتَح.
//
// صفحةُ الإعداداتِ ستّةَ عشرَ ألفَ بكسل، وثلاثةُ أقسامٍ منها تسعةُ آلاف:
// البانراتُ أربعةُ آلافٍ والمجموعاتُ ثلاثةٌ والفئاتُ ألفان. فمن تنزلُ إلى
// «سياسة الإرجاع» تمرُّ عليها كلِّها، ومن تريدُ تعديلَ شريحةٍ واحدةٍ ترى
// أربعةَ آلافِ بكسلٍ من محرّراتٍ دفعةً واحدة.
//
// والطيُّ صريحٌ لا تلقائيّ: زرٌّ مكتوبٌ يُفتَحُ ويُغلَق. جرّبتُ التخطّيَ
// التلقائيَّ ‎(content-visibility) فوجدتُ الصفحةَ تكبرُ أثناءَ النزولِ لأنّ
// المقاسَ المقدَّرَ يبعدُ عن الحقيقيِّ كثيراً، فيقفزُ التمرير — وهو ما داويناه.
//
// والقيمُ لا تضيعُ بالطيّ: كلُّ الحقولِ تقرأُ من حالةِ ‎form الواحدةِ لا من
// عناصرِ الصفحة، والحفظُ يرسلُها كاملةً مهما كان المطويُّ منها.
function Folded({ open, onToggle, label, children }) {
  const { t } = useTranslation();
  return (
    <>
      <button type="button" onClick={onToggle} aria-expanded={open} className="bz-fold">
        <span>{open ? t('common.hide') : t('common.show')} {label}</span>
        <ArrowDownIcon className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </>
  );
}

const EMPTY = {
  name: '', slug: '', description: '', logoUrl: '', phone: '', whatsapp: '', deliveryPhone: '',
  instagram: '', facebook: '', tiktok: '', themeColor: '#999795', deliveryInfo: '', paymentInfo: '', banners: [],
};

// شرايح افتراضية يقترحها النظام عند عدم وجود بانرات (يقدر المالك يعدّلها أو يحذفها)
const DEFAULT_BANNERS = [
  { title: 'تشكيلة جديدة وصلت', subtitle: 'تصفّحوا أحدث القطع لدينا', bgType: '', bgValue: '' },
  { title: 'عروض خاصة', subtitle: 'تابعونا لكل جديد وحصري', bgType: '', bgValue: '' },
];

// تحويل طابع زمني ISO إلى صيغة datetime-local ("YYYY-MM-DDTHH:mm") بالتوقيت المحلي
function toLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// نمر دليل المقاسات القابل للتخصيص
const CHART_SIZES = ['36', '38', '40', '42', '44', '46', '48'];

// سقوف تطابق ما يقبله الخادم بالضبط — أي فارقٍ بينهما يعني إدخالاً يضيع بصمت
const MAX_CUSTOM_CATS = 20;
const MAX_COLLECTIONS = 12;
// الفئات الثابتة (قابلة للتخصيص بصورة/اسم)
// فئات المنصّة من مصدرها الموحّد: كانت السبع مكرّرةً هنا، فالفئة التي يضيفها
// المدير لا تظهر بشاشة تخصيص الفئات — لا تستطيع المالكة إعطاءها صورةً ولا اسماً
// ولا إخفاءها، وتبقى بواجهة متجرها بأيقونتها الافتراضية بلا حيلة.

// تنظيف ما يُلصق بخانات التواصل: كثيراً ما يُلصق رابط كامل بدل اسم المستخدم
const cleanHandle = (v) =>
  String(v || '').trim()
    .replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?].*$/, '');
// أرقام الهاتف: نُبقي الأرقام و«+» فقط (يزيل المسافات والشرطات الملصوقة)
const cleanPhone = (v) => String(v || '').replace(/[^\d+]/g, '');
// رابط واتساب من الرقم (بلا + ولا أصفار بادئة) لتجربته بضغطة
const waLink = (v) => `https://wa.me/${cleanPhone(v).replace(/^\++/, '').replace(/^00/, '')}`;
// صالح لواتساب = صيغة دولية: ١٠–١٥ رقماً بلا صفر بادئ بعد إسقاط 00.
// الرقم المحلّي (0590000000) يبدو صحيحاً للعين لكنه لا يفتح واتساب أبداً — لذا ننبّه عليه.
const waValid = (v) => {
  const d = String(v || '').replace(/\D/g, '').replace(/^00/, '');
  return d.length >= 10 && d.length <= 15 && !d.startsWith('0');
};

/**
 * حالةُ تفعيلِ استلامِ المدفوعات. التاجرةُ تُدخلُ حسابَها ثمّ تنتظرُ تسجيلَها
 * مستفيدةً عند البوّابة — فنقولُ لها أين وصلت بدلَ أن تحدّقَ بنموذجٍ صامت.
 */
function PayoutStatus({ status, t }) {
  const map = {
    none:    { cls: 'border-stone-300 bg-stone-100 text-stone-600 dark:border-gold-400/25 dark:bg-ink-900/60 dark:text-stone-300', icon: '📝' },
    pending: { cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200', icon: '⏳' },
    active:  { cls: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200', icon: '✅' },
  };
  const s = map[status] || map.none;
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${s.cls}`}>
      <span className="me-1.5">{s.icon}</span>
      {t(`dashboard.store.payout_${status || 'none'}`)}
    </div>
  );
}

export default function StoreSettings() {
  const { t, i18n } = useTranslation();
  const platformKeys = usePlatformCatKeys();
  // عدد منتجات المتجر بكلّ قسم: القسم الذي فيه قطعٌ يبقى مفعّلاً بإعدادات الأقسام
  const [deptUse, setDeptUse] = useState({});
  // وعدد منتجات كلّ فئة: فئة المنصّة تظهر بإعدادات المتجر حين تبيع التاجرة تحتها فقط
  const [catUse, setCatUse] = useState({});
  useEffect(() => {
    api.get('/products').then((r) => {
      const c = {};
      const k = {};
      for (const p of r.data.products || []) {
        const d = normDept(p.department); c[d] = (c[d] || 0) + 1;
        k[p.category] = (k[p.category] || 0) + 1;
      }
      setDeptUse(c);
      setCatUse(k);
    }).catch(() => { /* العدّاد زينة: الخادم يحمي الأقسام المستعملة على كلّ حال */ });
  }, []);
  const { refresh, store: authStore } = useAuth();
  const [form, setForm] = useState(null);
  // قسمٌ واحدٌ مفتوحٌ من الثلاثةِ الطويلة — وكلُّها مطويّةٌ عندَ الفتح
  const [openSec, setOpenSec] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSec, setActiveSec] = useState('s-basics'); // القسم الظاهر حالياً — يُبرَز بشريط التنقّل
  const savedRef = useRef(''); // آخر نسخة محفوظة — للمقارنة وكشف التغييرات غير المحفوظة
  const [tick, setTick] = useState(0); // نبضة كل دقيقة لتحديث عدّاد عرض الفلاش

  useEffect(() => {
    api
      .get('/stores/me')
      .then((res) => {
        const s = res.data.store;
        const next = {
          ...EMPTY,
          name: s.name || '', slug: s.slug || '', description: s.description || '', logoUrl: s.logoUrl || '',
          phone: s.phone || '', whatsapp: s.whatsapp || '', deliveryPhone: s.deliveryPhone || '', instagram: s.instagram || '',
          facebook: s.facebook || '', tiktok: s.tiktok || '', themeColor: s.themeColor || '#999795',
          deliveryInfo: s.deliveryInfo || '', paymentInfo: s.paymentInfo || '',
          banners: Array.isArray(s.banners) && s.banners.length ? s.banners : DEFAULT_BANNERS,
          deliveryTiers: s.deliveryTiers && typeof s.deliveryTiers === 'object' ? s.deliveryTiers : { wb: 30, quds: 40, dakhel: 80 },
          freeShippingOver: s.freeShippingOver ? String(s.freeShippingOver) : '',
          referralPercent: s.referralPercent ? String(s.referralPercent) : '',
          sizeChart: s.sizeChart && typeof s.sizeChart === 'object' ? s.sizeChart : {},
          returnPolicy: s.returnPolicy || '',
          announcement: s.announcement || '',
          announcementEn: s.announcementEn || '',
          sectionLayout: s.sectionLayout || 'mixed',
          panelImage: s.panelImage || '',
          tagline: s.tagline || '',
          taglineEn: s.taglineEn || '',
          welcomeOffer: s.welcomeOffer || '',
          categoryMeta: s.categoryMeta && typeof s.categoryMeta === 'object' ? s.categoryMeta : {},
          customCategories: Array.isArray(s.customCategories) ? s.customCategories : [],
          departments: storeDepts(s),
          collections: Array.isArray(s.collections) ? s.collections : [],
          fbPixel: s.fbPixel || '',
          tiktokPixel: s.tiktokPixel || '',
          gaId: s.gaId || '',
          loyaltyEvery: s.loyaltyEvery ? String(s.loyaltyEvery) : '',
          loyaltyPercent: s.loyaltyPercent ? String(s.loyaltyPercent) : '',
          flashPercent: s.flashPercent ? String(s.flashPercent) : '',
          // datetime-local يحتاج "YYYY-MM-DDTHH:mm" بالتوقيت المحلي (بلا ثوانٍ/منطقة)
          flashEndsAt: s.flashEndsAt ? toLocalInput(s.flashEndsAt) : '',
          cardPaymentEnabled: Boolean(s.cardPaymentEnabled),
          bankAccountName: s.bankAccountName || '',
          bankName: s.bankName || '',
          bankCode: s.bankCode || '',
          // الآيبانُ يعودُ مقنّعاً: نتركُه فارغاً كي لا تُعيدَ التاجرةُ حفظَ النجوم
          bankIban: '',
          bankSwift: s.bankSwift || '',
          payoutStatus: s.payoutStatus || 'none',
        };
        savedRef.current = JSON.stringify(next);
        setForm(next);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  // إبراز القسم الظاهر بشريط التنقّل — نراقب دخول الأقسام لنطاق الرؤية (بعد تحميل النموذج)
  const loaded = form !== null;

  // مسودّة الإعدادات: ما يُكتب هنا يبقى لو تنقّل صاحب المتجر بين الأقسام ورجع
  useDraft(`store-settings:${authStore?.id || ''}`, form, (draft) => setForm((cur) => ({ ...cur, ...draft })), { ready: loaded });
  useEffect(() => {
    if (!loaded) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveSec(vis[0].target.id);
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 }
    );
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [loaded]);

  // نبضة كل دقيقة — يبقى «المتبقّي» بعرض الفلاش صادقاً بلا تحديث الصفحة
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // تغييرات غير محفوظة: مقارنة النموذج الحالي بآخر نسخة محفوظة
  const dirty = loaded && JSON.stringify(form) !== savedRef.current;
  // تحذير المتصفّح عند مغادرة الصفحة وفيها تعديلات لم تُحفظ — يمنع ضياع التعب
  useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  // اختصار Ctrl/⌘+S للحفظ — عادة راسخة عند كل من يعبّئ نماذج طويلة
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        document.getElementById('store-settings-form')?.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // نسبة اكتمال الإعدادات + الأقسام الناقصة (تُحتسب من SECTIONS عند كل تغيير)
  const { pct, doneCount, missing, doneMap } = useMemo(() => {
    if (!form) return { pct: 0, doneCount: 0, missing: [], doneMap: {} };
    const map = {};
    SECTIONS.forEach(([id, , isDone]) => { map[id] = Boolean(isDone(form)); });
    const n = Object.values(map).filter(Boolean).length;
    return {
      pct: Math.round((n / SECTIONS.length) * 100),
      doneCount: n,
      missing: SECTIONS.filter(([id]) => !map[id]),
      doneMap: map,
    };
  }, [form]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(''); setError(''); setBusy(true);
    try {
      // نُرسل وقت انتهاء الفلاش كـ ISO مطلق (UTC) — datetime-local محلي، فنحوّله
      // بالمتصفح كي لا يختلف عن توقيت الخادم (Render بتوقيت UTC عادةً)
      const payload = { ...form, flashEndsAt: form.flashEndsAt ? new Date(form.flashEndsAt).toISOString() : '' };
      const res = await api.put('/stores/me', payload);
      await refresh();
      clearCachePrefixes(['home', 'storepage:']); // الإعدادات الجديدة (شعار/بانر/فلاش) تظهر فوراً
      // الخادم يكمل ربط الفئات بفئات المنصّة (المستنتج من الاسم حين تُترك «تلقائي»):
      // نعرض ما حُفظ فعلاً فترى التاجرة أين ستظهر فئتها
      const saved = res.data?.store?.customCategories;
      const next = Array.isArray(saved) ? { ...form, customCategories: saved } : form;
      if (next !== form) setForm(next);
      savedRef.current = JSON.stringify(next);
      clearDraft(`store-settings:${authStore?.id || ''}`); // حُفظ فعلاً — لا داعي لمسودّة بعده
      setMsg(t('dashboard.store.saved'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  // حفظ الشعار فوراً
  const saveLogo = async () => {
    setMsg(''); setError('');
    try {
      await api.put('/stores/me', form);
      await refresh();
      clearCachePrefixes(['home', 'storepage:']);
      savedRef.current = JSON.stringify(form);
      setMsg(t('image.imageSaved'));
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    }
  };

  if (!form) return <Spinner />;
  // أقسام صفحة الفئات: المفعّلة، وما فيه منتجات أو فئاتٌ خاصّة ولو لم يُفعَّل (متجرٌ
  // قديم حقله «ملابس» وحدها وقد أضاف أحذية) — لا تختفي فئةٌ قائمة من الإعدادات.
  const catGroups = DEPARTMENTS.filter((d) => (form.departments || ['clothing']).includes(d)
    || deptUse[d] > 0
    || (form.customCategories || []).some((cc) => normDept(cc.dept) === d));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // التراجع عن كل التعديلات غير المحفوظة والعودة لآخر نسخة محفوظة
  const revert = () => {
    if (!window.confirm(t('dashboard.store.revertConfirm'))) return;
    setForm(JSON.parse(savedRef.current));
    setMsg(''); setError('');
  };

  // رابط المتجر العام — يُعرض كاملاً ويُنسخ بضغطة
  // رابط المشاركة: النطاق الرسمي دائماً — هذا ما تُرسله المالكة للزبائن.
  const storeUrl = `https://bazarastore.site/store/${form.slug || ''}`;
  // رابط الفتح: نفس أصل الصفحة الحالية. الجلسة (كوكي httpOnly + التوكن المحلي)
  // مربوطة بالأصل، فالقفز لنطاق آخر (التطبيق المثبّت أو نسخة معاينة أو محلياً)
  // يفتح المتجر على أصل بلا جلسة فيبدو الحساب «مسجّل خروج» عند الرجوع.
  const storeOpenUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/store/${form.slug || ''}`;
  const copyUrl = async () => {
    if (await copyText(storeUrl)) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };
  // مشاركة الرابط بورقة المشاركة الأصلية (جوال) — أسرع طريق لنشره على واتساب/إنستغرام
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareStore = async () => {
    try { await navigator.share({ title: form.name || 'Bazara', url: storeUrl }); } catch { /* أُلغيت المشاركة */ }
  };

  // التحكم بأسعار الشرائح الثلاث (الضفة/القدس/الداخل)
  const setTier = (key) => (e) => setForm((f) => ({ ...f, deliveryTiers: { ...f.deliveryTiers, [key]: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) } }));

  // التحكم بدليل المقاسات المخصّص: {"38": {bust, waist, hips}}
  const setChartCell = (size, key, val) =>
    setForm((f) => ({ ...f, sizeChart: { ...f.sizeChart, [size]: { ...(f.sizeChart?.[size] || {}), [key]: val.replace(/\D/g, '') } } }));
  // تعبئة الجدول بالقياسات القياسية دفعةً واحدة (ثم تعدّلها المالكة كما يناسب قصّاتها)
  const fillStandardChart = () =>
    setForm((f) => ({
      ...f,
      sizeChart: CHART_SIZES.reduce((acc, s) => {
        const m = SIZE_CHART[s] || {};
        acc[s] = { bust: String(m.bust || ''), waist: String(m.waist || ''), hips: String(m.hips || '') };
        return acc;
      }, {}),
    }));
  const clearChart = () => setForm((f) => ({ ...f, sizeChart: {} }));

  // التحكم بتخصيص الفئات: {"dress": {image, name}}
  const setCatMeta = (cat, key, val) =>
    setForm((f) => ({ ...f, categoryMeta: { ...f.categoryMeta, [cat]: { ...(f.categoryMeta?.[cat] || {}), [key]: val } } }));

  // الفئات الإضافية المخصّصة: [{key, name, image}]
  const addCustomCat = (dept) =>
    setForm((f) => ({ ...f, customCategories: [...(f.customCategories || []), { key: 'c_' + Math.random().toString(36).slice(2, 9), name: '', image: '', dept: dept || (f.departments || ['clothing'])[0] }] }));
  // ترتيب فئةٍ خاصّة بين جاراتها بقسمها: السهم يبدّلها بالتي قبلها/بعدها من القسم نفسه
  // (القائمة المحفوظة واحدة، وترتيبها داخل كلّ قسمٍ هو ترتيب ظهوره بالمتجر).
  const moveCustomInDept = (idx, dir) =>
    setForm((f) => {
      const list = [...(f.customCategories || [])];
      const d = normDept(list[idx]?.dept);
      let to = idx + dir;
      while (to >= 0 && to < list.length && normDept(list[to]?.dept) !== d) to += dir;
      if (to < 0 || to >= list.length) return f;
      [list[idx], list[to]] = [list[to], list[idx]];
      return { ...f, customCategories: list };
    });
  const setCustomCat = (idx, key, val) =>
    setForm((f) => ({ ...f, customCategories: f.customCategories.map((c, i) => (i === idx ? { ...c, [key]: val } : c)) }));
  const removeCustomCat = (idx) =>
    setForm((f) => ({ ...f, customCategories: f.customCategories.filter((_, i) => i !== idx) }));
  const addCollection = () =>
    setForm((f) => ({ ...f, collections: [...(f.collections || []), { title: '', titleEn: '', image: '', q: '' }] }));
  const setCollection = (idx, key, val) =>
    setForm((f) => ({ ...f, collections: f.collections.map((c, i) => (i === idx ? { ...c, [key]: val } : c)) }));
  const removeCollection = (idx) =>
    setForm((f) => ({ ...f, collections: f.collections.filter((_, i) => i !== idx) }));

  // ترتيب/نسخ عناصر أي قائمة (فئات إضافية، مجموعات) — نفس سلوك الشرايح تماماً:
  // ترتيب القائمة هنا هو ترتيب ظهورها بالمتجر.
  const moveIn = (key, idx, dir) =>
    setForm((f) => {
      const list = [...(f[key] || [])];
      const to = idx + dir;
      if (to < 0 || to >= list.length) return f;
      [list[idx], list[to]] = [list[to], list[idx]];
      return { ...f, [key]: list };
    });
  const duplicateIn = (key, idx, max, fresh) =>
    setForm((f) => {
      const list = [...(f[key] || [])];
      if (list.length >= max) return f;
      // المفتاح يجب أن يبقى فريداً بالفئات المخصّصة — نولّد واحداً جديداً للنسخة
      const copy = { ...list[idx], ...(fresh ? fresh() : {}) };
      list.splice(idx + 1, 0, copy);
      return { ...f, [key]: list };
    });
  const newCatKey = () => ({ key: 'c_' + Math.random().toString(36).slice(2, 9) });

  // ضبط نهاية عرض الفلاش بضغطة (ساعة/يوم/٣ أيام/أسبوع) بدل تعبئة التاريخ يدوياً
  const setFlashIn = (hours) => setVal('flashEndsAt', toLocalInput(new Date(Date.now() + hours * 3600000).toISOString()));
  const flashEndsMs = form.flashEndsAt ? new Date(form.flashEndsAt).getTime() : 0;
  const flashOn = Number(form.flashPercent) > 0 && flashEndsMs > Date.now();
  // المدّة المتبقّية للعرض بصيغة «يومان · ٥ ساعات» (tick يعيد الحساب كل دقيقة)
  const flashLeft = (() => {
    void tick;
    const ms = flashEndsMs - Date.now();
    if (ms <= 0) return '';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return [
      d ? t('dashboard.store.dDays', { n: d }) : '',
      h ? t('dashboard.store.dHours', { n: h }) : '',
      !d && m ? t('dashboard.store.dMins', { n: m }) : '',
    ].filter(Boolean).join(' · ');
  })();

  // تنقّل سريع بين أقسام الإعدادات — القفز لقسم مع محاذاته تحت الشريط العلوي (scroll-mt)
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6 scroll-mt-[calc(env(safe-area-inset-top,0px)+7.5rem)]';
  const SUBCARD = 'rounded-2xl border border-gold-400/15 bg-black/20 p-3';

  return (
    <div className="space-y-5">
      <PageHead icon={<GearIcon className="h-6 w-6" />} title={t('dashboard.storeSettings')} hint={t('dashboard.store.settingsHint')} />

      {/* بطاقة الاكتمال: نسبة + الأقسام الناقصة كأزرار قفز — تُرشد المالكة لما تبقّى */}
      <div className="glass p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <ProgressRing pct={pct} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold text-stone-100">{t('dashboard.store.progressTitle')}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-400">
              {pct === 100 ? t('dashboard.store.progressDone') : t('dashboard.store.progressCount', { done: doneCount, total: SECTIONS.length })}
            </p>
          </div>
        </div>
        {missing.length > 0 && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <p className="mb-2 text-[11px] font-semibold text-stone-400">{t('dashboard.store.progressMissing')}</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map(([id, key]) => (
                <button
                  key={id} type="button" onClick={() => jump(id)}
                  className="rounded-full border border-gold-400/25 bg-gold-400/5 px-2.5 py-1 text-[11px] font-semibold text-stone-300 transition hover:bg-gold-400/15 hover:text-gold-200"
                >
                  {t(`dashboard.store.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* شريط تنقّل + حفظ: قفز لأي قسم، إبراز القسم الظاهر، وحفظ من أعلى الصفحة.
          لاصق تحت الهيدر العلوي تماماً: top = ارتفاع الهيدر (safe-area + 4.25rem)
          و z-30 أقل من الهيدر (z-50) فلا يتراكبان. خلفية glass معتمة (أبيض/داكن)
          تغطّي المحتوى المتمرّر خلفه. يبقى الشريط في المتناول أثناء النزول. */}
      {/* --bz-tabbar-h: على الكمبيوتر ينزل الهيدرُ تحت الشريط العلويّ، فينزل
          هذا الشريطُ معه — وإلا لصق أعلى مما ينبغي واختفى خلف الهيدر. */}
      <div className="glass sticky top-[calc(var(--bz-headline-h)+var(--bz-tabbar-h,0px))] z-30 flex items-center gap-2 overflow-hidden p-2 transition-[top] duration-300 ease-out motion-reduce:transition-none">
        {/* خيط تقدّم رفيع بأسفل الشريط — نسبة الاكتمال حاضرة دوماً أثناء النزول */}
        <span
          // start-0 منطقي: ينمو من بداية السطر بالعربية والإنجليزية على السواء
          className="pointer-events-none absolute bottom-0 start-0 h-[2px] bg-gradient-to-r from-[#BAB9B7] to-[#73716E] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
        <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map(([id, key]) => {
            const on = activeSec === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => jump(id)}
                // النشط: ذهب صريح (hex) يتجاوز remap الثيم — يبقى ذهبياً بنص غامق في
                // الوضعين. (bg-gold-400/text-wine-dark كانا ينقلبان نهاراً لبنّي على بنّي)
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? 'border-[#999795] bg-[#999795] text-[#313130]'
                    : 'border-gold-400/30 bg-gold-400/5 text-stone-300 hover:bg-gold-400/10 hover:text-gold-300'
                }`}
              >
                {/* نقطة حالة: خضراء إذا القسم مكتمل — نظرة سريعة على ما ينقص */}
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${doneMap[id] ? 'bg-emerald-400' : on ? 'bg-[#313130]/35' : 'bg-stone-400/40'}`} />
                {t(`dashboard.store.${key}`)}
              </button>
            );
          })}
        </div>
        <button
          form="store-settings-form"
          type="submit"
          disabled={busy}
          // خمري ممتلئ بالحالتين (التباين مع النص العاجي يبقى عالياً نهاراً وليلاً)؛
          // الفرق بين «فيه تعديل» و«محفوظ» تحمله حلقة ذهبية ونقطة تنبيه لا شفافية اللون
          className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-wine px-4 py-1.5 text-xs font-bold text-cream shadow-sm transition hover:bg-wine-dark disabled:opacity-60 ${
            dirty ? 'ring-2 ring-[#999795]/60' : ''
          }`}
        >
          <SaveIcon className="h-3.5 w-3.5" /> {busy ? t('common.loading') : t('common.save')}
          {/* نقطة تنبيه: يوجد تعديل لم يُحفظ بعد */}
          {dirty && !busy && <span className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />}
        </button>
      </div>

      {/* حالة الحفظ: تعديلات معلّقة / تم الحفظ / خطأ */}
      {dirty && !msg && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
          <span className="min-w-0 flex-1">{t('dashboard.store.unsaved')}</span>
          {/* تراجع: يُرجع كل الخانات لآخر نسخة محفوظة — مخرج آمن بعد تعديل بالخطأ */}
          <button type="button" onClick={revert} className="shrink-0 rounded-full border border-amber-400/40 px-2.5 py-1 text-[11px] font-bold transition hover:bg-amber-500/20">
            {t('dashboard.store.revert')}
          </button>
        </div>
      )}
      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      <form id="store-settings-form" onSubmit={submit} className="space-y-5">
        {/* الأساسيات */}
        <div id="s-basics" className={CARD}>
          <SectionHead icon={<StoreIcon className="h-5 w-5" />} title={t('dashboard.store.basics')} desc={t('dashboard.store.basicsHint')} done={doneMap['s-basics']} />

          {/* معاينة حيّة: هيك بيشوف الزبون رأس متجرك — يجعل أثر كل تعديل ملموساً فوراً */}
          <div className="dash-preview flex items-center gap-3 rounded-2xl p-3">
            <span className="dash-avatar grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl">
              {form.logoUrl
                ? <img src={cldThumb(form.logoUrl, 160)} alt="" className="h-full w-full object-cover" />
                : <StoreIcon className="h-6 w-6 text-stone-500" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-bold text-stone-100">{form.name || t('dashboard.store.previewName')}</p>
              <p className="truncate text-[11px] text-stone-400">{form.description || t('dashboard.store.previewDesc')}</p>
              <p className="mt-0.5 truncate text-[10px] text-gold-300" dir="ltr">{storeUrl}</p>
            </div>
          </div>

          <div>
            <ImageInput
              label={t('dashboard.store.logo')}
              value={form.logoUrl}
              onChange={(v) => setVal('logoUrl', v)}
              hint={t('dashboard.store.logoHint')}
            />
            <button type="button" onClick={saveLogo} className="btn-ghost mt-2.5 gap-1.5 !py-1.5 text-sm"><SaveIcon className="h-4 w-4" /> {t('image.saveImage')}</button>
          </div>

          <Field label={t('dashboard.store.name')} tip={t('dashboard.store.nameTip')} max={60} value={form.name} required>
            <input type="text" required maxLength={60} className="input" placeholder={t('dashboard.store.namePlaceholder')} value={form.name} onChange={set('name')} />
          </Field>

          <Field label={t('dashboard.store.urlLabel')} tip={t('dashboard.store.urlTip')} hint={t('dashboard.store.urlHint')} required>
            <div className="flex items-center gap-1 rounded-xl border border-wine/20 bg-black/20 px-3 py-1" dir="ltr">
              <span className="shrink-0 text-xs text-stone-400">bazarastore.site/store/</span>
              <input
                type="text" dir="ltr" inputMode="latin" placeholder="lifestyle"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-stone-100 focus:outline-none"
                value={form.slug}
                onChange={(e) => setVal('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
            </div>
            {/* رابط قصير جداً يصعب تذكّره ويسهل تعارضه — تنبيه لا منع */}
            {form.slug && form.slug.length < 3 && (
              <p className="mt-1.5 text-[11px] font-semibold text-amber-300">{t('dashboard.store.slugShort')}</p>
            )}
            {/* نسخ الرابط أو مشاركته أو فتحه بتبويب جديد — بلا كتابة يدوية ولا أخطاء */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button" onClick={copyUrl} disabled={!form.slug}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-[11px] font-semibold text-gold-200 transition hover:bg-gold-400/20 disabled:opacity-40"
              >
                {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                {copied ? t('common.copied') : t('common.copyLink')}
              </button>
              {/* المشاركة الأصلية للجهاز (واتساب/إنستغرام…) — تظهر حيث يدعمها المتصفّح فقط */}
              {canShare && (
                <button
                  type="button" onClick={shareStore} disabled={!form.slug}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-stone-400 transition hover:text-gold-200 disabled:opacity-40"
                >
                  <ShareIcon className="h-3.5 w-3.5" /> {t('dashboard.store.shareStore')}
                </button>
              )}
              <a
                href={storeOpenUrl} target="_blank" rel="noopener"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-stone-400 transition hover:text-gold-200 ${form.slug ? '' : 'pointer-events-none opacity-40'}`}
              >
                <LinkIcon className="h-3.5 w-3.5" /> {t('dashboard.store.openStore')}
              </a>
            </div>
          </Field>

          <Field label={t('dashboard.store.tagline')} tip={t('dashboard.store.taglineTip')} hint={t('dashboard.store.taglineHint')} optional max={120} value={form.tagline}>
            <input type="text" maxLength={120} className="input" placeholder={t('dashboard.store.taglinePlaceholder')} value={form.tagline} onChange={set('tagline')} />
          </Field>

          <Field label={t('dashboard.store.taglineEn')} optional max={120} value={form.taglineEn}>
            <input type="text" maxLength={120} dir="ltr" className="input text-start" placeholder={t('dashboard.store.taglineEnPlaceholder')} value={form.taglineEn} onChange={set('taglineEn')} />
          </Field>

          <Field label={t('dashboard.store.description')} tip={t('dashboard.store.descriptionTip')} max={300} value={form.description}>
            <textarea rows={3} maxLength={300} className="input resize-none" placeholder={t('dashboard.store.descriptionPlaceholder')} value={form.description} onChange={set('description')} />
          </Field>
        </div>

        {/* التواصل */}
        <div id="s-contact" className={CARD}>
          <SectionHead icon={<PhoneIcon className="h-5 w-5" />} title={t('dashboard.store.contact')} desc={t('dashboard.store.contactHint')} done={doneMap['s-contact']} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('dashboard.store.whatsapp')} required
              icon={<WhatsAppIcon className="h-4 w-4 text-emerald-400" />}
              tip={t('dashboard.store.whatsappTip')} hint={t('dashboard.store.whatsappHint')}
            >
              <input type="tel" dir="ltr" inputMode="tel" className="input" placeholder="+962790000000" value={form.whatsapp} onChange={(e) => setVal('whatsapp', cleanPhone(e.target.value))} />
              {/* رقم بلا رمز دولة لن يفتح واتساب — ننبّه قبل الحفظ لا بعد ضياع طلب */}
              {form.whatsapp.length > 3 && !waValid(form.whatsapp) && (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-300">{t('dashboard.store.whatsappInvalid')}</p>
              )}
              {form.whatsapp.length > 7 && (
                <a href={waLink(form.whatsapp)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:opacity-80">
                  <CheckIcon className="h-3.5 w-3.5" /> {t('dashboard.store.testNumber')}
                </a>
              )}
            </Field>

            <Field label={t('dashboard.store.phone')} icon={<PhoneIcon className="h-4 w-4" />} tip={t('dashboard.store.phoneTip')}>
              <input type="tel" dir="ltr" inputMode="tel" className="input" placeholder="+970590000000" value={form.phone} onChange={(e) => setVal('phone', cleanPhone(e.target.value))} />
            </Field>

            <Field
              label={t('dashboard.store.deliveryPhone')} icon={<TruckIcon className="h-4 w-4" />}
              tip={t('dashboard.store.deliveryPhoneTip')} hint={t('dashboard.store.deliveryPhoneHint')}
            >
              <input type="tel" dir="ltr" inputMode="tel" className="input" placeholder="+970590000000" value={form.deliveryPhone} onChange={(e) => setVal('deliveryPhone', cleanPhone(e.target.value))} />
            </Field>

            <Field label={t('dashboard.store.instagram')} icon={<InstagramIcon className="h-4 w-4" />} tip={t('dashboard.store.handleTip')}>
              <div className="flex items-center gap-1 rounded-xl border border-gold-400/15 bg-black/20 px-3" dir="ltr">
                <span className="shrink-0 text-sm text-stone-400">@</span>
                <input type="text" dir="ltr" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 focus:outline-none" placeholder="username" value={form.instagram} onChange={(e) => setVal('instagram', cleanHandle(e.target.value))} />
              </div>
            </Field>

            <Field label={t('dashboard.store.facebook')} icon={<FacebookIcon className="h-4 w-4" />} tip={t('dashboard.store.facebookTip')}>
              <input type="text" dir="ltr" className="input" placeholder="facebook.com/yourpage" value={form.facebook} onChange={set('facebook')} />
            </Field>

            <Field label={t('dashboard.store.tiktok')} tip={t('dashboard.store.handleTip')}>
              <div className="flex items-center gap-1 rounded-xl border border-gold-400/15 bg-black/20 px-3" dir="ltr">
                <span className="shrink-0 text-sm text-stone-400">@</span>
                <input type="text" dir="ltr" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 focus:outline-none" placeholder="username" value={form.tiktok} onChange={(e) => setVal('tiktok', cleanHandle(e.target.value))} />
              </div>
            </Field>
          </div>
        </div>

        {/* بانرات السلايدر */}
        <div id="s-banners" className={CARD}>
          <SectionHead icon={<ImageIcon className="h-5 w-5" />} title={t('dashboard.store.banners')} desc={t('dashboard.store.bannersHint')} done={doneMap['s-banners']} />
          <Folded open={openSec === 's-banners'} onToggle={() => setOpenSec((v) => (v === 's-banners' ? '' : 's-banners'))} label={t('dashboard.store.banners')}>
          <BannerEditor banners={form.banners} onChange={(b) => setForm((f) => ({ ...f, banners: b }))} storeName={form.name} />
          </Folded>
        </div>

        {/* تخطيطُ أقسامِ المنتجاتِ بصفحةِ المتجر — الشكلُ يتبعُ حجمَ البضاعة:
            الرفُّ نصفَ الممتلئِ يبدو فراغاً بمتجرٍ قليلِ القطع، والشبكاتُ الثلاثُ
            تصنعُ صفحةً طولُها آلافُ البكسلاتِ بمتجرٍ كثيرِها. */}
        <div id="s-layout" className={CARD}>
          <SectionHead icon={<GridIcon className="h-5 w-5" />} title={t('dashboard.store.layoutTitle')} desc={t('dashboard.store.layoutHint')} done={doneMap['s-layout']} />
          <div className="grid gap-2 sm:grid-cols-3">
            {LAYOUT_CHOICES.map(([key, rows]) => {
              const on = (form.sectionLayout || 'mixed') === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, sectionLayout: key }))}
                  aria-pressed={on}
                  className={`rounded-xl border p-3 text-start transition ${on ? 'border-gold-400 bg-gold-400/10' : 'border-gold-400/20 hover:border-gold-400/50'}`}
                >
                  {/* رسمٌ صغيرٌ يُري الإيقاعَ نفسَه: صفٌّ ممتلئٌ شبكةٌ وصفٌّ ناقصٌ رفّ */}
                  <span aria-hidden="true" className="mb-2 flex flex-col gap-1">
                    {rows.map((full, r) => (
                      <span key={r} className="flex gap-1 overflow-hidden">
                        {/* صفُّ الشبكةِ ينتهي عندَ الحافّة، وصفُّ الرفِّ يُقَصُّ عندَها
                            — فيُقرَأُ الفرقُ بالعينِ قبلَ قراءةِ الشرح */}
                        {Array.from({ length: full ? 4 : 5 }).map((_, c) => (
                          <span
                            key={c}
                            className={`h-3 rounded-sm ${full ? 'flex-1' : 'w-1/4 shrink-0'} ${on ? 'bg-gold-400/70' : 'bg-stone-500/40'}`}
                          />
                        ))}
                      </span>
                    ))}
                  </span>
                  <span className="block text-sm font-semibold text-stone-100">{t(`dashboard.store.layout_${key}`)}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-400">{t(`dashboard.store.layout_${key}Hint`)}</span>
                </button>
              );
            })}
          </div>

          {/* صورةُ لوحتِك: تظهرُ خلفَ رأسِ اللوحةِ وخلفَ هويّةِ القائمةِ الجانبيّة.
              وإن تركتِها فارغةً أخذنا أوّلَ شريحةٍ من سلايدرِ متجرِك — فلا يبقى
              الرأسُ لوحاً داكناً عامّاً يصلحُ لأيِّ متجر. */}
          <Field label={t('dashboard.store.panelImage')} tip={t('dashboard.store.panelImageTip')} hint={t('dashboard.store.panelImageHint')} optional value={form.panelImage}>
            <ImageInput value={form.panelImage} onChange={(v) => setForm((f) => ({ ...f, panelImage: v }))} />
          </Field>
        </div>

        {/* مناطق التوصيل ورسومها */}
        <div id="s-zones" className={CARD}>
          <SectionHead icon={<TruckIcon className="h-5 w-5" />} title={t('dashboard.store.zones')} desc={t('dashboard.store.zonesHint')} done={doneMap['s-zones']} />

          {/* أسعار الشرائح: تُطبَّق تلقائياً على كل المدن (يبحث عنها الزبون بالسلة) */}
          <div className="grid grid-cols-3 gap-2">
            {[['wb', t('dashboard.store.tierWb')], ['quds', t('dashboard.store.tierQuds')], ['dakhel', t('dashboard.store.tierDakhel')]].map(([key, label]) => (
              <div key={key} className="rounded-2xl border border-gold-400/15 bg-black/20 p-2.5 text-center">
                <span className="mb-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-stone-400">
                  <PinIcon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
                </span>
                <div className="relative">
                  <input className="input !px-2 pe-6 text-center font-bold" type="number" min="0" step="1" inputMode="numeric" value={form.deliveryTiers?.[key] ?? ''} onChange={setTier(key)} />
                  <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-stone-400">₪</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-3">
            <Field label={t('dashboard.store.freeShippingOver')} icon={<CashIcon className="h-4 w-4" />} tip={t('dashboard.store.freeShippingHint')} hint={t('dashboard.store.freeShippingHint')}>
              <div className="relative w-40">
                <input className="input pe-8" type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={form.freeShippingOver} onChange={set('freeShippingOver')} />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">₪</span>
              </div>
            </Field>
          </div>

          {/* برنامج الإحالة: نسبة خصم الزبونة الجديدة (0 = معطّل) */}
          <div className="border-t border-white/5 pt-3">
            <Field label={t('dashboard.store.referralPercent')} icon={<GiftIcon className="h-4 w-4" />} tip={t('dashboard.store.referralHint')} hint={t('dashboard.store.referralHint')}>
              <div className="relative w-40">
                <input className="input pe-8" type="number" min="0" max="90" step="1" inputMode="numeric" placeholder="0" value={form.referralPercent} onChange={set('referralPercent')} />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">%</span>
              </div>
            </Field>
          </div>

          {/* نقاط الولاء: كل N طلبات مؤكّدة → خصم % تلقائي على الطلب التالي (0 = معطّل) */}
          <div className="border-t border-white/5 pt-3">
            <Field label={t('dashboard.store.loyaltyTitle')} icon={<GiftIcon className="h-4 w-4" />} tip={t('dashboard.store.loyaltyHint')} hint={t('dashboard.store.loyaltyHint')}>
              <div className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
                <span>{t('dashboard.store.loyaltyEveryLabel')}</span>
                <input className="input !w-20 text-center" type="number" min="0" max="50" step="1" inputMode="numeric" placeholder="0" value={form.loyaltyEvery} onChange={set('loyaltyEvery')} />
                <span>{t('dashboard.store.loyaltyPercentLabel')}</span>
                <div className="relative w-24">
                  <input className="input pe-7 text-center" type="number" min="0" max="50" step="1" inputMode="numeric" placeholder="0" value={form.loyaltyPercent} onChange={set('loyaltyPercent')} />
                  <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-xs text-stone-400">%</span>
                </div>
              </div>
            </Field>
          </div>
        </div>

        {/* عرض الفلاش: خصم مؤقّت على كل المتجر بعدّاد تنازلي — إلحاح يرفع مبيعات الحملات */}
        <div id="s-flash" className={CARD}>
          <SectionHead icon={<BoltIcon className="h-5 w-5" />} title={t('dashboard.store.flashTitle')} desc={t('dashboard.store.flashHint')} done={doneMap['s-flash']} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('dashboard.store.flashPercent')} tip={t('dashboard.store.flashPercentTip')}>
              <div className="relative w-32">
                <input className="input pe-7 text-center font-bold" type="number" min="0" max="90" step="1" inputMode="numeric" placeholder="0" value={form.flashPercent} onChange={set('flashPercent')} />
                <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-xs text-stone-400">%</span>
              </div>
              {/* اختصارات نسب شائعة — أسرع من الكتابة */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[10, 15, 20, 30, 50].map((p) => (
                  <button
                    key={p} type="button" onClick={() => setVal('flashPercent', String(p))}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      String(form.flashPercent) === String(p) ? 'border-[#999795] bg-[#999795] text-[#313130]' : 'border-gold-400/25 bg-gold-400/5 text-stone-300 hover:bg-gold-400/15'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t('dashboard.store.flashEndsAt')} icon={<ClockIcon className="h-4 w-4" />} tip={t('dashboard.store.flashEndsTip')}>
              <DateInput type="datetime-local" value={form.flashEndsAt} onChange={(v) => set('flashEndsAt')({ target: { value: v } })} />
              {/* مُدد جاهزة — بضغطة بدل تعبئة التاريخ والساعة يدوياً */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[[1, 'dHour1'], [24, 'dDay1'], [72, 'dDays3'], [168, 'dWeek1']].map(([h, key]) => (
                  <button
                    key={key} type="button" onClick={() => setFlashIn(h)}
                    className="rounded-full border border-gold-400/25 bg-gold-400/5 px-2.5 py-1 text-[11px] font-semibold text-stone-300 transition hover:bg-gold-400/15 hover:text-gold-200"
                  >
                    {t(`dashboard.store.${key}`)}
                  </button>
                ))}
                {form.flashEndsAt && (
                  <button type="button" onClick={() => setVal('flashEndsAt', '')} className="rounded-full px-2 py-1 text-[11px] text-stone-400 transition hover:text-red-300">
                    {t('common.remove')}
                  </button>
                )}
              </div>
            </Field>
          </div>

          {flashOn ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-400">
              <BoltIcon className="h-4 w-4 shrink-0" />
              <span>{t('dashboard.store.flashActive', { percent: form.flashPercent })}</span>
              {flashLeft && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5">{t('dashboard.store.flashLeft', { time: flashLeft })}</span>}
            </div>
          ) : (
            <p className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs text-stone-400">{t('dashboard.store.flashOff')}</p>
          )}
        </div>

        {/* التمويل والإعلانات: بكسلات تتبّع لإعلانات المالك الممولة */}
        <div id="s-ads" className={CARD}>
          <SectionHead icon={<ChartIcon className="h-5 w-5" />} title={t('dashboard.store.adsTitle')} desc={t('dashboard.store.adsHint')} done={doneMap['s-ads']} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t('dashboard.store.fbPixel')} tip={t('dashboard.store.fbPixelHint')} hint={t('dashboard.store.fbPixelHint')}>
              <input className="input" dir="ltr" placeholder="123456789012345" value={form.fbPixel} onChange={(e) => setVal('fbPixel', e.target.value.trim())} />
            </Field>
            <Field label={t('dashboard.store.tiktokPixel')} tip={t('dashboard.store.tiktokPixelHint')} hint={t('dashboard.store.tiktokPixelHint')}>
              <input className="input" dir="ltr" placeholder="C0ABC1DEFG2HIJ3KLM" value={form.tiktokPixel} onChange={(e) => setVal('tiktokPixel', e.target.value.trim())} />
            </Field>
            <Field label={t('dashboard.store.gaId')} tip={t('dashboard.store.gaIdHint')} hint={t('dashboard.store.gaIdHint')}>
              <input className="input" dir="ltr" placeholder="G-XXXXXXXXXX" value={form.gaId} onChange={(e) => setVal('gaId', e.target.value.trim())} />
            </Field>
          </div>
        </div>


        {/* أقسام المتجر — ما تبيعه التاجرة: ملابس، أحذية، إكسسوارات، أو أيّ مزيج.
            يحدّد الأقسام الظاهرة بنموذج المنتج وفئاته. قسمٌ فيه منتجات لا يُطفأ:
            إطفاؤه كان سيُخفي اختيار قسم قطعٍ قائمة، والخادم يُبقيه مفعّلاً أصلاً. */}
        <div id="s-depts" className={CARD}>
          <SectionHead icon={<DeptsIcon className="h-5 w-5" />} title={t('dashboard.store.deptsTitle')} desc={t('dashboard.store.deptsHint')} done={doneMap['s-depts']} />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {DEPARTMENTS.map((d) => {
              const on = (form.departments || []).includes(d);
              const used = deptUse[d] || 0;
              const locked = on && (used > 0 || (form.departments || []).length === 1);
              return (
                <button
                  key={d}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    setForm((f) => {
                      const cur = new Set(f.departments || []);
                      if (cur.has(d)) cur.delete(d); else cur.add(d);
                      return { ...f, departments: DEPARTMENTS.filter((x) => cur.has(x)) };
                    });
                  }}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-start transition ${on ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-gold-400/20 bg-black/20 hover:bg-white/5'} ${locked ? 'cursor-default' : ''}`}
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${on ? 'text-emerald-300' : 'text-stone-400'}`} style={{ background: on ? 'rgba(16,185,129,0.14)' : 'rgba(120,113,108,0.14)' }}>
                    <DeptIcon dept={d} className="h-8 w-8" strokeWidth={1.4} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-stone-100">{t(`dept.${d}`)}</span>
                      <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-stone-500/50'} ${locked ? 'opacity-70' : ''}`}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'start-5' : 'start-1'}`} />
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-stone-400">{t(`dashboard.store.deptDesc_${d}`)}</span>
                    {used > 0 && (
                      <span className="mt-1.5 block text-[10px] font-semibold text-stone-300">{t('dashboard.store.deptLocked', { count: used })}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* تخصيص الفئات — صورة واقعية + اسم لكل فئة */}
        <div id="s-categories" className={CARD}>
          <SectionHead icon={<FolderIcon className="h-5 w-5" />} title={t('dashboard.store.categories')} desc={t('dashboard.store.categoriesHint')} done={doneMap['s-categories']} />
          <Folded open={openSec === 's-categories'} onToggle={() => setOpenSec((v) => (v === 's-categories' ? '' : 's-categories'))} label={t('dashboard.store.categories')}>
          {/* الفئات مجمّعةً بأقسامها كواجهة المتجر: تحت «أحذية» فئات الأحذية كلّها —
              العامّة وما أضافته التاجرة (صنادل، رياضيّة) — وزرّ إضافةٍ بقسمه. كانت قائمةً
              واحدةً طويلة: سبعُ فئات ملابس، ثمّ العامّتان، ثمّ الفئات الخاصّة مدفونةً
              بآخرها تحت عنوانٍ منفصل، فلا تجد التاجرة فئات أحذيتها. */}
          {/* قفزٌ مباشرٌ إلى قسم: سبعُ بطاقات ملابس تسبق الأحذية، فلا تمرّري بحثاً عنها */}
          {catGroups.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {catGroups.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => document.getElementById(`s-cat-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 px-3 py-1.5 text-xs font-bold text-stone-200 transition hover:bg-gold-400/10"
                >
                  <DeptIcon dept={d} className="h-4 w-4" strokeWidth={1.7} /> {t(`dept.${d}`)}
                </button>
              ))}
            </div>
          )}
          {catGroups.map((d) => {
            // الأساسيّة لكلّ قسمٍ مفعّل — بالقاعدة نفسها لواجهة المتجر (storeBuiltinKeys)،
            // والمخفيّة معها هنا كي تُظهرها التاجرة من جديد. تفعيل القسم أعلاه يُظهر
            // فئاته فوراً برسومها.
            const builtins = storeBuiltinKeys(form, platformKeys, catUse, { includeHidden: true }).filter((c) => catDept(c) === d);
            const customs = (form.customCategories || []).map((cc, idx) => ({ cc, idx })).filter((x) => normDept(x.cc.dept) === d);
            return (
              <section key={d} id={`s-cat-${d}`} className={`scroll-mt-24 ${catGroups.length > 1 ? 'mb-6 last:mb-0' : ''}`}>
                {catGroups.length > 1 && (
                  <div className="mb-3 flex items-center gap-2.5 border-b border-gold-400/10 pb-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-400/10 text-gold-200">
                      <DeptIcon dept={d} className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <h3 className="font-display text-base font-bold text-stone-100">{t(`dept.${d}`)}</h3>
                    <span className="ms-auto text-[11px] tabular-nums text-stone-400">{t('dashboard.store.catCount', { count: builtins.length + customs.length })}</span>
                  </div>
                )}
                <div className="space-y-3">
                  {builtins.map((c) => {
                  const meta = form.categoryMeta?.[c] || {};
                  const hidden = !!meta.hidden;
                  // الاسم الظاهر: اسم المالكة إن وُجد وإلا الافتراضي — يُعرَض مرّة واحدة بالعنوان
                  const displayName = (meta.name || '').trim() || platformCatName(c, t, i18n.language);
                  // اللوقو الحالي: صورة المالكة إن رفعتها وإلا الأيقونة الثابتة — من المصدر
                  // المشترك: فئتا الأحذية والإكسسوارات بلا رسمٍ مقصوص فتأخذان أيقونة قسمهما
                  // (كان ‎/categories/shoes.png يُطلب فيفشل ويبقى مكانه فارغاً).
                  const fixed = platformCatImage(c);
                  const logo = meta.image ? cldThumb(meta.image, 120) : fixed;
                  return (
                    <div key={c} className={`${SUBCARD} transition ${hidden ? 'opacity-60' : ''}`}>
                      {/* العنوان: لوقو + اسم واحد + زر إخفاء/إظهار — بلا تكرار للاسم */}
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {logo
                            ? <img src={logo} alt="" className="h-8 w-8 shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            : <span className="grid h-8 w-8 shrink-0 place-items-center text-stone-300"><DeptIcon dept={catDept(c)} className="h-6 w-6" strokeWidth={1.4} /></span>}
                          <span className="truncate text-sm font-semibold text-gold-200">{displayName}</span>
                          {/* شارة «مخفية»: خلفية ذهبية شفّافة تعمل على الأبيض نهاراً وعلى الداكن ليلاً
                              (bg-black/40 كانت تصير رمادية داكنة بنصّ باهت بالوضع النهاري) */}
                          {hidden && <span className="shrink-0 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-semibold text-stone-400 ring-1 ring-gold-400/20">{t('dashboard.store.hiddenBadge')}</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCatMeta(c, 'hidden', !hidden)}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${hidden ? 'text-gold-200 hover:text-gold-100' : 'text-stone-400 hover:text-red-300'}`}
                        >
                          {hidden
                            ? <><EyeGlyph className="h-3.5 w-3.5" /> {t('dashboard.store.showCategory')}</>
                            : <><EyeOffGlyph className="h-3.5 w-3.5" /> {t('dashboard.store.hideCategory')}</>}
                        </button>
                      </div>
                      {!hidden && (
                        <>
                          <ImageInput
                            value={meta.image || ''} onChange={(v) => setCatMeta(c, 'image', v)}
                            placeholderImg={fixed} contain hint={t('dashboard.store.categoryImageHint')}
                          />
                          <input
                            type="text"
                            maxLength={40}
                            className="input mt-2"
                            placeholder={t('dashboard.store.renameCategory')}
                            value={meta.name || ''}
                            onChange={(e) => setCatMeta(c, 'name', e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  );
                  })}
                  {customs.map(({ cc, idx }, j) => (
                    <div key={cc.key || idx} className={SUBCARD}>
                      {/* الرأس: لوقو (إن وُجد) + الاسم، وأدوات الترتيب/النسخ/الحذف —
                          نفس أدوات الشرايح، فترتيب القائمة هو ترتيب الظهور بالمتجر */}
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {cc.image && <img src={cldThumb(cc.image, 120)} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />}
                          <span className="truncate text-xs font-semibold text-stone-500">{cc.name || t('dashboard.store.newCategory')}</span>
                        </span>
                        <RowTools
                          index={j} count={customs.length}
                          onMove={(dir) => moveCustomInDept(idx, dir)}
                          onDuplicate={() => duplicateIn('customCategories', idx, MAX_CUSTOM_CATS, newCatKey)}
                          onRemove={() => removeCustomCat(idx)}
                        />
                      </div>
                      <input type="text" maxLength={40} className="input mb-2" placeholder={t('dashboard.store.categoryNameField')} value={cc.name} onChange={(e) => setCustomCat(idx, 'name', e.target.value)} />
                      {/* قسم الفئة: يحدّد نمر منتجاتها (أحذية ٣٥–٤٦) ومكانها بتبويبات المتجر */}
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className="me-1 text-[11px] font-semibold text-stone-400">{t('dashboard.store.categoryDept')}</span>
                        {DEPARTMENTS.filter((d) => (form.departments || ['clothing']).includes(d) || normDept(cc.dept) === d).map((d) => {
                          const on = normDept(cc.dept) === d;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => { setCustomCat(idx, 'dept', d); setCustomCat(idx, 'platform', ''); }}
                              aria-pressed={on}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${on ? 'border-transparent' : 'border-gold-400/25 text-stone-300 hover:bg-white/5'}`}
                              style={on ? { background: '#999795', color: '#1E1D1C' } : undefined}
                            >
                              <DeptIcon dept={d} className="h-3.5 w-3.5" strokeWidth={1.8} /> {t(`dept.${d}`)}
                            </button>
                          );
                        })}
                      </div>
                      {/* مكانها بالموقع العام: الرئيسية وصفحة التصنيفات تعرضان فئات المنصّة
                          الثابتة وحدها، وقطع هذه الفئة تظهر تحت ما تختاره هنا */}
                      <label className="mb-2 block">
                        <span className="mb-1 block text-[11px] font-semibold text-stone-400">{t('dashboard.store.categoryPlatform')}</span>
                        <select
                          className="input"
                          value={cc.platform || ''}
                          onChange={(e) => setCustomCat(idx, 'platform', e.target.value)}
                        >
                          <option value="">{t('dashboard.store.categoryPlatformAuto')}</option>
                          {platformKeysOfDept(normDept(cc.dept)).map((k) => (
                            <option key={k} value={k}>{platformCatName(k, t, i18n.language)}</option>
                          ))}
                        </select>
                      </label>
                      <ImageInput value={cc.image || ''} onChange={(v) => setCustomCat(idx, 'image', v)} contain hint={t('dashboard.store.categoryImageHint')} />
                    </div>
                  ))}
                </div>
                {/* إضافة فئةٍ بقسمها مباشرةً — حتى MAX_CUSTOM_CATS، سقف الخادم نفسه:
                    لو سمحنا بأكثر لقُصّت الزائدة بصمتٍ بعد «تم الحفظ». */}
                {(form.customCategories || []).length < MAX_CUSTOM_CATS && (
                  <button type="button" onClick={() => addCustomCat(d)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-3 text-sm font-semibold text-stone-300 transition hover:border-gold-400/50 hover:bg-gold-400/5">
                    <DeptIcon dept={d} className="h-4 w-4" strokeWidth={1.8} /> ＋ {t('dashboard.store.addDeptCategory', { dept: t(`dept.${d}`) })}
                  </button>
                )}
              </section>
            );
          })}
          </Folded>
        </div>

        {/* مجموعات المتجر: تسوّقي حسب المناسبة — صورة مرفوعة + كلمة بحث */}
        <div id="s-collections" className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHead icon={<TagIcon className="h-5 w-5" />} title={t('dashboard.store.collections')} desc={t('dashboard.store.collectionsHint')} done={doneMap['s-collections']} />
            <div className="flex shrink-0 items-center gap-2">
              {(form.collections || []).length > 0 && (
                <span className="text-[11px] tabular-nums text-stone-400">{(form.collections || []).length}/12</span>
              )}
              {(form.collections || []).length < MAX_COLLECTIONS && (
                <button type="button" onClick={addCollection} className="btn-ghost !py-1.5 text-sm">＋ {t('common.add')}</button>
              )}
            </div>
          </div>
          <Folded open={openSec === 's-collections'} onToggle={() => setOpenSec((v) => (v === 's-collections' ? '' : 's-collections'))} label={t('dashboard.store.collections')}>
          {(form.collections || []).length === 0 ? (
            <button type="button" onClick={addCollection} className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-5 text-center transition hover:border-gold-400/50 hover:bg-gold-400/5">
              <SparkleIcon className="h-6 w-6 text-gold-300" />
              <span className="text-xs text-stone-400">{t('dashboard.store.collectionsEmpty')}</span>
            </button>
          ) : (
            <div className="space-y-3">
              {form.collections.map((c, idx) => (
                <div key={idx} className={SUBCARD}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gold-200">{c.title || t('dashboard.store.newCategory')}</span>
                    <RowTools
                      index={idx} count={form.collections.length}
                      onMove={(dir) => moveIn('collections', idx, dir)}
                      onDuplicate={() => duplicateIn('collections', idx, MAX_COLLECTIONS)}
                      canDuplicate={form.collections.length < MAX_COLLECTIONS}
                      onRemove={() => removeCollection(idx)}
                    />
                  </div>

                  {/* معاينة البطاقة كما تظهر بصفحة المتجر (٤:٣ + تدرّج سفلي + عنوان بالوسط) */}
                  <div className="relative mb-2 aspect-[4/3] max-w-[220px] overflow-hidden rounded-xl">
                    {c.image
                      ? <img src={cldThumb(c.image, 500)} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      : <span className="block h-full w-full" style={{ background: 'linear-gradient(135deg, #6F6D6A 0%, #4B4A49 55%, #313130 100%)' }} />}
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-3 text-center font-display text-base font-bold text-white drop-shadow-lg">
                      {c.title || t('dashboard.store.collectionTitlePreview')}
                    </span>
                  </div>

                  {/* المتجر يتجاهل أي مجموعة بلا عنوان أو بلا كلمة بحث — ننبّه بدل أن تختفي بصمت */}
                  {(!String(c.title || '').trim() || !String(c.q || '').trim()) && (
                    <p className="mb-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300">
                      {t('dashboard.store.collectionIncomplete')}
                    </p>
                  )}

                  <div className="mb-2 grid gap-2 sm:grid-cols-2">
                    <Field label={t('dashboard.store.collectionTitleLabel')} tip={t('dashboard.store.collectionTitleTip')}>
                      <input type="text" maxLength={60} className="input" placeholder={t('dashboard.store.collectionTitle')} value={c.title} onChange={(e) => setCollection(idx, 'title', e.target.value)} />
                    </Field>
                    <Field label={t('dashboard.store.collectionQueryLabel')} tip={t('dashboard.store.collectionQueryTip')}>
                      <input type="text" maxLength={60} className="input" placeholder={t('dashboard.store.collectionQuery')} value={c.q} onChange={(e) => setCollection(idx, 'q', e.target.value)} />
                    </Field>
                  </div>
                  <ImageInput value={c.image || ''} onChange={(v) => setCollection(idx, 'image', v)} hint={t('dashboard.store.collectionImageHint')} />
                  <CollectionWide
                    c={c}
                    onChange={(patch) => setForm((f) => ({
                      ...f,
                      collections: f.collections.map((x, j) => (j === idx ? { ...x, ...patch } : x)),
                    }))}
                  />
                </div>
              ))}
            </div>
          )}
          </Folded>
        </div>

        {/* تسويق: نافذة ترحيب */}
        <div id="s-marketing" className={CARD}>
          <SectionHead icon={<MegaphoneIcon className="h-5 w-5" />} title={t('dashboard.store.marketing')} desc={t('dashboard.store.marketingHint')} done={doneMap['s-marketing']} />

          <Field label={t('dashboard.store.welcomeOffer')} tip={t('dashboard.store.welcomeHint')} hint={t('dashboard.store.welcomeHint')} max={300} value={form.welcomeOffer}>
            <input type="text" maxLength={300} className="input" placeholder={t('dashboard.store.welcomePlaceholder')} value={form.welcomeOffer} onChange={set('welcomeOffer')} />
          </Field>
        </div>

        {/* دليل المقاسات المخصّص */}
        <div id="s-sizechart" className={CARD}>
          <SectionHead icon={<RulerIcon className="h-5 w-5" />} title={t('dashboard.store.sizeChart')} desc={t('dashboard.store.sizeChartHint')} done={doneMap['s-sizechart']} />
          {/* تعبئة/تفريغ دفعةً واحدة — أسرع بكثير من ٢١ خانة يدوية */}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={fillStandardChart} className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-[11px] font-semibold text-gold-200 transition hover:bg-gold-400/20">
              <RulerIcon className="h-3.5 w-3.5" /> {t('dashboard.store.fillStandard')}
            </button>
            <button type="button" onClick={clearChart} className="rounded-full px-2.5 py-1 text-[11px] text-stone-400 transition hover:text-red-300">{t('dashboard.store.clearChart')}</button>
          </div>
          <table className="w-full table-fixed border-collapse text-center text-[clamp(0.72rem,3.2vw,0.875rem)]">
            <thead>
              <tr className="text-stone-400">
                <th className="w-12 pb-2 font-semibold">{t('product.sizeCol')}</th>
                <th className="pb-2 font-semibold">{t('product.bustCol')}</th>
                <th className="pb-2 font-semibold">{t('product.waistCol')}</th>
                <th className="pb-2 font-semibold">{t('product.hipsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {CHART_SIZES.map((s) => {
                const row = form.sizeChart?.[s] || {};
                return (
                  <tr key={s}>
                    <td className="py-1 pe-1 font-bold text-gold-200">{s}</td>
                    {['bust', 'waist', 'hips'].map((k) => (
                      <td key={k} className="p-0.5">
                        <input
                          dir="ltr" inputMode="numeric"
                          // الشبح = القياس القياسي المستخدم تلقائياً لو تُركت الخانة فارغة
                          placeholder={String(SIZE_CHART[s]?.[k] ?? '—')}
                          value={row[k] ?? ''}
                          onChange={(e) => setChartCell(s, k, e.target.value)}
                          className="input w-full !min-w-0 !px-1 !py-1.5 text-center"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-stone-400">{t('dashboard.store.sizeChartCm')}</p>
        </div>

        {/* سياسة الإرجاع والتبديل */}
        <div id="s-return" className={CARD}>
          <SectionHead icon={<ShieldIcon className="h-5 w-5" />} title={t('dashboard.store.returnPolicy')} desc={t('dashboard.store.returnPolicyHint')} done={doneMap['s-return']} />
          <Field label={t('dashboard.store.returnPolicyLabel')} tip={t('dashboard.store.returnPolicyTip')} max={2000} value={form.returnPolicy}>
            <textarea rows={4} className="input resize-none" maxLength={2000} placeholder={t('product.returnPolicyDefault')} value={form.returnPolicy} onChange={set('returnPolicy')} />
          </Field>
        </div>

        {/* التوصيل والدفع */}
        <div id="s-delivery" className={CARD}>
          <SectionHead icon={<CardIcon className="h-5 w-5" />} title={t('dashboard.store.deliveryPayment')} desc={t('dashboard.store.deliveryPaymentHint')} done={doneMap['s-delivery']} />
          <Field label={t('dashboard.store.delivery')} icon={<TruckIcon className="h-4 w-4" />} tip={t('dashboard.store.deliveryTip')} max={500} value={form.deliveryInfo}>
            <textarea rows={2} maxLength={500} className="input resize-none" placeholder={t('dashboard.store.deliveryPlaceholder')} value={form.deliveryInfo} onChange={set('deliveryInfo')} />
          </Field>
          <Field label={t('dashboard.store.payment')} icon={<CashIcon className="h-4 w-4" />} tip={t('dashboard.store.paymentTip')} max={500} value={form.paymentInfo}>
            <textarea rows={2} maxLength={500} className="input resize-none" placeholder={t('dashboard.store.paymentPlaceholder')} value={form.paymentInfo} onChange={set('paymentInfo')} />
          </Field>

          {/* الدفع الإلكتروني — اختياري */}
          <div className="mt-4 rounded-2xl border border-gold-400/15 bg-black/20 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.cardPaymentEnabled || false}
                onChange={(e) => setVal('cardPaymentEnabled', e.target.checked)}
                className="h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500/30 dark:border-gold-400/40 dark:bg-ink-900 dark:text-emerald-500 dark:focus:ring-gold-400/30"
              />
              <div>
                <CardIcon className="inline h-4 w-4 me-1 text-wine dark:text-gold-300" />
                <span className="font-bold text-stone-800 dark:text-gold-200">{t('dashboard.store.cardPayment')}</span>
                <p className="text-xs text-stone-500 dark:text-stone-400">{t('dashboard.store.cardPaymentHint')}</p>
              </div>
            </label>
            {form.cardPaymentEnabled && (
              <div className="mt-4 space-y-3 animate-fade-up">
                <PayoutStatus status={form.payoutStatus} t={t} />

                <Field label={t('dashboard.store.bankAccountName')} tip={t('dashboard.store.bankAccountNameTip')}>
                  <input className="input" dir="ltr" placeholder="Fatima Ahmad Saleh" value={form.bankAccountName || ''} onChange={(e) => setVal('bankAccountName', e.target.value)} />
                </Field>
                <Field label={t('dashboard.store.bankName')} tip={t('dashboard.store.bankNameTip')}>
                  <BankSelect
                    value={form.bankCode || ''}
                    onChange={(bank) => setForm((f) => ({ ...f, bankCode: bank.code, bankName: bank.name, bankSwift: bank.swift }))}
                  />
                </Field>
                <Field label={t('dashboard.store.bankIban')} tip={t('dashboard.store.bankIbanTip')}>
                  <input className="input" dir="ltr" placeholder="PS00 0000 0000 0000 0000 0000 000" value={form.bankIban || ''} onChange={(e) => setVal('bankIban', e.target.value)} />
                </Field>
                <Field label={t('dashboard.store.bankSwift')} tip={t('dashboard.store.bankSwiftTip')}>
                  <input className="input" dir="ltr" readOnly value={form.bankSwift || ''} placeholder="ARABPS22" />
                </Field>
                <p className="text-[11px] text-stone-500">{t('dashboard.store.bankNote')}</p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-wine to-wine-dark py-3.5 font-bold text-cream shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? t('common.loading') : <span className="inline-flex items-center gap-1.5"><SaveIcon className="h-4 w-4" /> {t('common.save')}</span>}
        </button>
      </form>

      {/* ربط شركات التوصيل — مستقلّ عن فورم الإعدادات */}
      <OpostConnect />
      <EpsConnect />
      <GoboxConnect />
    </div>
  );
}

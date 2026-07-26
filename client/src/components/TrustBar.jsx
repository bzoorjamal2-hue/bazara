import { useTranslation } from 'react-i18next';
import { StoreIcon, StarIcon, TruckIcon, CashIcon } from './icons.jsx';

// شريط ثقة فوق الطية — أرقام حقيقية من قاعدة البيانات فقط.
//
// عتبات الظهور مقصودة: رقم ضعيف يضرّ الثقة أكثر مما يبنيها. "٤.٨ ★ من ٣ تقييمات"
// أو "متجران" يقولان للزائرة إن المنصّة فارغة. فنُخفي كل إحصائية لم تبلغ عتبتها،
// ونُبقي دائماً وعدَي الخدمة (التوصيل والدفع عند الاستلام) — فلا يظهر الشريط فارغاً
// ولا ناقصاً في متجر ناشئ.
const MIN_STORES = 5;
const MIN_PRODUCTS = 20;
const MIN_REVIEWS = 10;

// تقريب لأسفل لأقرب عتبة (١٢٧ → "+١٢٠") — لا نبالغ أبداً، والرقم يبقى صادقاً
const roundDown = (n) => {
  if (n < 50) return n;
  if (n < 100) return Math.floor(n / 10) * 10;
  if (n < 1000) return Math.floor(n / 50) * 50;
  return Math.floor(n / 100) * 100;
};

export default function TrustBar({ trust }) {
  const { t } = useTranslation();
  const s = trust || {};
  const items = [];

  if (s.stores >= MIN_STORES) {
    items.push({ key: 'stores', icon: <StoreIcon className="h-5 w-5" />, value: `+${roundDown(s.stores)}`, label: t('trust.stores') });
  }
  if (s.products >= MIN_PRODUCTS) {
    items.push({ key: 'products', icon: <SparkleGlyph />, value: `+${roundDown(s.products)}`, label: t('trust.products') });
  }
  if (s.ratingCount >= MIN_REVIEWS && s.ratingAvg > 0) {
    items.push({
      key: 'rating',
      icon: <StarIcon className="h-5 w-5" />,
      value: String(s.ratingAvg),
      label: t('trust.rating', { count: s.ratingCount }),
    });
  }
  // وعدا خدمة ثابتان (لا يحتاجان بيانات) — يضمنان شريطاً متّزناً دائماً
  items.push({ key: 'delivery', icon: <TruckIcon className="h-5 w-5" />, label: t('trust.delivery') });
  items.push({ key: 'cod', icon: <CashIcon className="h-5 w-5" />, label: t('trust.cod') });

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div
          key={it.key}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-gold-400/20 bg-white/60 px-3 py-4 text-center shadow-sm"
        >
          <span className="text-gold-500">{it.icon}</span>
          {it.value && <span className="font-display text-xl font-extrabold leading-none text-wine">{it.value}</span>}
          <span className="text-[11px] font-semibold leading-tight text-stone-500">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// نجمة صغيرة تمثّل القطع (نستعملها بدل أيقونة عامة كي يبقى الشريط متجانساً)
function SparkleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2c.5 3.8 2.2 5.5 6 6-3.8.5-5.5 2.2-6 6-.5-3.8-2.2-5.5-6-6 3.8-.5 5.5-2.2 6-6Z" />
    </svg>
  );
}

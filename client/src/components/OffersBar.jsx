import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TagIcon, ClockIcon, BoltIcon } from './icons.jsx';

// خلاصة العروض وعتبات عمق الخصم — مصدر واحد لصفحة العروض العامّة، وعروض
// المتجر داخل الشريط السفلي (?offers=1)، وصفقات الصفحة الرئيسية. كانت
// الخلاصة مكتوبة في صفحة واحدة فقط، فمن يفتح العروض من داخل متجر لا يرى
// منها شيئاً ويظنّ أنّ لا شيء تغيّر.

export const pctOf = (p) => (p.oldPrice && p.oldPrice > p.price ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0);

export const TIERS = [
  { key: 'all', min: 0 },
  { key: 'd30', min: 30 },
  { key: 'd50', min: 50 },
];

const SOON_MS = 48 * 60 * 60 * 1000; // «ينتهي قريباً» = خلال يومين

export function tierMin(key) {
  return TIERS.find((t) => t.key === key)?.min || 0;
}

export function filterByTier(products, tier) {
  const min = tierMin(tier);
  return min ? (products || []).filter((p) => pctOf(p) >= min) : (products || []);
}

// إحصاءات محسوبة من البيانات نفسها لا من نصّ ثابت
export function offerStats(products) {
  if (!products?.length) return null;
  const now = Date.now();
  let best = 0;
  let soon = 0;
  for (const p of products) {
    const pct = pctOf(p);
    if (pct > best) best = pct;
    if (p.saleEndsAt) {
      const left = new Date(p.saleEndsAt).getTime() - now;
      if (left > 0 && left <= SOON_MS) soon += 1;
    }
  }
  return { count: products.length, best, soon };
}

// شارة خلاصة. الشارتان الملوّنتان مصمتتان بنصّ عاجي: اللون الشفّاف فوق خلفية
// كريمية يهبط تحت عتبة القراءة، والمصمت يقرأ في الوضعين لأنه قائم بذاته.
function Pill({ icon, children, strong = false, urgent = false }) {
  if (strong || urgent) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-cream ring-1 ring-[#cdbda4]/35"
        style={{ background: urgent ? '#9a3412' : 'linear-gradient(150deg, #3f2e22 0%, #241708 100%)' }}
      >
        {icon}{children}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-wine/10 px-3 py-1 text-xs font-bold text-wine ring-1 ring-wine/20">
      {icon}{children}
    </span>
  );
}

/**
 * @param {Array} products قائمة العروض كاملةً (قبل تصفية العتبة)
 * @param {string} tier العتبة المختارة
 * @param {Function} onTier تغيير العتبة — إن غاب لا تُعرض العتبات (وضع العرض فقط)
 * @param {boolean} compact بلا هوامش علوية — للاندراج داخل رأس موجود
 */
export default function OffersBar({ products, tier = 'all', onTier, compact = false }) {
  const { t } = useTranslation();
  const stats = useMemo(() => offerStats(products), [products]);
  const counts = useMemo(() => {
    const out = {};
    for (const tr of TIERS) out[tr.key] = (products || []).filter((p) => pctOf(p) >= tr.min).length;
    return out;
  }, [products]);

  if (!stats) return null;

  return (
    <div className={compact ? '' : 'mb-4'}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Pill icon={<TagIcon className="h-3.5 w-3.5" />}>{t('offers.count', { count: stats.count })}</Pill>
        {stats.best > 0 && <Pill icon={<BoltIcon className="h-3.5 w-3.5" />} strong>{t('offers.upTo', { pct: stats.best })}</Pill>}
        {stats.soon > 0 && <Pill icon={<ClockIcon className="h-3.5 w-3.5" />} urgent>{t('offers.endingSoon', { count: stats.soon })}</Pill>}
      </div>

      {/* العتبات: الزائرة على عروض تسأل «أين الخصم الكبير؟» لا «ما الأحدث؟».
          العتبة الفارغة لا تُعرض بدل أن تعطي نتيجة صفرية. */}
      {onTier && counts.d30 > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {TIERS.filter((tr) => counts[tr.key] > 0).map((tr) => {
            const on = tier === tr.key;
            return (
              <button
                key={tr.key}
                type="button"
                onClick={() => onTier(tr.key)}
                aria-pressed={on}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${on ? 'ring-1 ring-[#cdbda4]/50' : 'border border-wine/25 text-wine hover:bg-wine/5'}`}
                // لونان صريحان للحالة النشطة: أصناف الذهب تنقلب بنّية نهاراً
                // فيصير النصّ بنّياً على بنّي ولا يُقرأ
                style={on ? { background: 'linear-gradient(150deg, #3f2e22 0%, #241708 100%)', color: '#F4EDE2' } : undefined}
              >
                {t(`offers.tier.${tr.key}`)}
                <span className={`ms-1.5 tabular-nums ${on ? 'opacity-80' : 'opacity-60'}`}>{counts[tr.key]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

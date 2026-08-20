import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import FilteredProductGrid from '../components/FilteredProductGrid.jsx';
import { TagIcon, ClockIcon, BoltIcon } from '../components/icons.jsx';
import { getCache, setCache } from '../utils/apiCache.js';

// نسبة الخصم الفعلية للقطعة (0 إن لا خصم)
const pctOf = (p) => (p.oldPrice && p.oldPrice > p.price ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0);

// عتبات عمق الخصم: الزائرة على صفحة عروض تسأل «وين الخصم الكبير؟» لا «ما الأحدث؟»
const TIERS = [
  { key: 'all', min: 0 },
  { key: 'd30', min: 30 },
  { key: 'd50', min: 50 },
];

const SOON_MS = 48 * 60 * 60 * 1000; // «ينتهي قريباً» = خلال يومين

// صفحة العروض — كل القطع المخفّضة عبر متاجر بازارا بمكان واحد
export default function Offers() {
  const { t } = useTranslation();
  const [products, setProducts] = useState(() => getCache('offers') || null);
  const [error, setError] = useState('');
  const [tier, setTier] = useState('all');

  const load = () => {
    setError('');
    api
      .get('/public/offers')
      .then((r) => { setProducts(r.data.products); setCache('offers', r.data.products); })
      .catch((e) => { if (!getCache('offers')) setError(getErrorMessage(e)); });
  };
  useEffect(load, []);

  // خلاصة الصفحة: كم قطعة، وأعمق خصم، وكم عرضاً على وشك الانتهاء. الرقم
  // المجرّد «١٢ قطعة» لا يقول شيئاً؛ «حتى ٦٠٪» و«٣ تنتهي اليوم» يقولان.
  const stats = useMemo(() => {
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
  }, [products]);

  // عدد القطع في كل عتبة — نُخفي عتبة فارغة بدل أن تعطي نتيجة صفرية
  const tierCounts = useMemo(() => {
    const out = {};
    for (const tr of TIERS) out[tr.key] = (products || []).filter((p) => pctOf(p) >= tr.min).length;
    return out;
  }, [products]);

  const shown = useMemo(() => {
    const min = TIERS.find((tr) => tr.key === tier)?.min || 0;
    return min ? (products || []).filter((p) => pctOf(p) >= min) : products;
  }, [products, tier]);

  return (
    <>
      <Seo title={t('offers.title')} description={t('offers.subtitle')} />

      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2.5 sm:gap-3">
          <span aria-hidden className="text-sm text-[#c79a3a]/70">❖</span>
          <span className="h-px w-7 bg-gradient-to-r from-transparent to-[#c79a3a]/45 sm:w-14" />
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><TagIcon className="h-6 w-6 text-wine" /> <span className="bz-title">{t('offers.title')}</span></h1>
          <span className="h-px w-7 bg-gradient-to-l from-transparent to-[#c79a3a]/45 sm:w-14" />
          <span aria-hidden className="text-sm text-[#c79a3a]/70">❖</span>
        </div>
        <p className="mt-1 text-sm text-wine/60">{t('offers.subtitle')}</p>
      </div>

      {error ? (
        // خطأ شبكة: بطاقة بمخرجين (إعادة محاولة + متابعة التسوّق) بدل نص عارٍ يترك الزائرة معلّقة
        <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <p className="text-stone-300">{error}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={load}
              className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
            >
              {t('assistant.retry')}
            </button>
            <Link to="/shop" className="rounded-full border border-wine/30 px-6 py-3 text-sm font-bold text-wine transition hover:bg-wine hover:text-cream">
              {t('co.doneKeepShopping')}
            </Link>
          </div>
        </div>
      ) : !products ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        // حالة فراغ لائقة بأيقونة ومخرج — كباقي الصفحات، بدل نص عارٍ يترك الزائرة معلّقة
        <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-wine/12 to-gold-400/15 text-wine ring-1 ring-gold-400/40"><TagIcon className="h-8 w-8" /></span>
          <p className="text-stone-300">{t('offers.empty')}</p>
          <Link
            to="/shop"
            className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
          >
            {t('co.doneKeepShopping')}
          </Link>
        </div>
      ) : (
        <>
          {/* شريط الخلاصة — يجيب «هل يستحقّ التصفّح؟» قبل النزول */}
          {stats && (
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
              <Pill icon={<TagIcon className="h-3.5 w-3.5" />}>{t('offers.count', { count: stats.count })}</Pill>
              {stats.best > 0 && (
                <Pill icon={<BoltIcon className="h-3.5 w-3.5" />} strong>{t('offers.upTo', { pct: stats.best })}</Pill>
              )}
              {stats.soon > 0 && (
                <Pill icon={<ClockIcon className="h-3.5 w-3.5" />} urgent>{t('offers.endingSoon', { count: stats.soon })}</Pill>
              )}
            </div>
          )}

          {/* عتبات عمق الخصم — لا تظهر إن لم يكن فيها ما يُعرض */}
          {tierCounts.d30 > 0 && (
            <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
              {TIERS.filter((tr) => tierCounts[tr.key] > 0).map((tr) => {
                const on = tier === tr.key;
                return (
                  <button
                    key={tr.key}
                    type="button"
                    onClick={() => setTier(tr.key)}
                    aria-pressed={on}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${on ? 'ring-1 ring-[#e6c878]/50' : 'border border-wine/25 text-wine hover:bg-wine/5'}`}
                    // لونان صريحان للحالة النشطة: أصناف الذهب تنقلب بنّية نهاراً
                    // فيصير النصّ بنّياً على بنّي ولا يُقرأ
                    style={on ? { background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 100%)', color: '#F4EDE2' } : undefined}
                  >
                    {t(`offers.tier.${tr.key}`)}
                    <span className={`ms-1.5 tabular-nums ${on ? 'opacity-80' : 'opacity-60'}`}>{tierCounts[tr.key]}</span>
                  </button>
                );
              })}
            </div>
          )}

          <FilteredProductGrid products={shown} defaultSort="discount" />
        </>
      )}
    </>
  );
}

// شارة خلاصة صغيرة. أصناف الموقع لا ألوان ثابتة: text-wine وtext-orange تتبدّل
// مع الثيم، بينما اللون الجامد يُقرأ في وضع ويختفي في الآخر. الاستثناء الوحيد
// تدرّج الخمري بنصّ عاجي — قائم بذاته فيصحّ في الوضعين معاً.
function Pill({ icon, children, strong = false, urgent = false }) {
  // الشارتان الملوّنتان مصمتتان بنصّ عاجي: البرتقالي الشفّاف فوق خلفية كريمية
  // يهبط إلى ٣.٨٩، والمصمت يقرأ في الوضعين معاً لأنه قائم بذاته.
  if (strong || urgent) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-cream ring-1 ring-[#e6c878]/35"
        style={{ background: urgent ? '#9a3412' : 'linear-gradient(135deg, #6e2637 0%, #4a1322 100%)' }}
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

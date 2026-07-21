import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProductCard from './ProductCard.jsx';
import Select from './Select.jsx';
import { productColors, colorToCss } from '../utils/colorDot.js';
import { SIZES, sizeLabel } from '../utils/sizes.js';

// مقاسات المنتج المتاحة: من مخزون الألوان ثم مخزون النمر ثم الحقل النصّي
const productSizes = (p) => {
  const cs = p?.colorStock && typeof p.colorStock === 'object' ? p.colorStock : null;
  if (cs && Object.keys(cs).length) return [...new Set(Object.values(cs).flatMap((sz) => Object.keys(sz || {})))];
  const ss = p?.sizeStock && typeof p.sizeStock === 'object' ? p.sizeStock : null;
  if (ss && Object.keys(ss).length) return Object.keys(ss);
  return String(p?.size || '').split(/[,،/|]/).map((s) => s.trim()).filter(Boolean);
};

const discountPct = (p) => (p.oldPrice && p.oldPrice > p.price ? (p.oldPrice - p.price) / p.oldPrice : 0);

// نفد المخزون: صفر عام أو نفاد كل كميات الألوان/النمر (النموذج التفصيلي)
const isSoldOut = (p) => {
  const cs = p?.colorStock && typeof p.colorStock === 'object' ? p.colorStock : null;
  if (cs && Object.keys(cs).length) {
    const v = Object.values(cs).flatMap((sz) => Object.values(sz || {})).filter((q) => typeof q === 'number');
    return v.length > 0 && v.reduce((a, b) => a + b, 0) === 0;
  }
  const ss = p?.sizeStock && typeof p.sizeStock === 'object' ? p.sizeStock : null;
  if (ss && Object.keys(ss).length) {
    const v = Object.values(ss).filter((q) => typeof q === 'number');
    return v.length > 0 && v.reduce((a, b) => a + b, 0) === 0;
  }
  return p?.stock === 0;
};

// فلترة وفرز على الواجهة فوق النتائج الموجودة (فوري، بلا طلبات إضافية). الفئات
// (ألوان/مقاسات/سعر) تُشتقّ من نفس المنتجات فلا يظهر إلا الفلتر الذي له معنى.
export default function FilteredProductGrid({ products, whatsapp, defaultSort = 'new' }) {
  const { t } = useTranslation();
  // الفلاتر تُحفظ بالجلسة لكل صفحة: تفلترين → تفتحين منتجاً → ترجعين → فلاترك كما هي
  const { pathname, search } = useLocation();
  const memKey = `bz_fpg:${pathname}${search}`;
  const saved = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(memKey) || '{}'); } catch { return {}; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memKey]);
  const [sort, setSort] = useState(saved.sort || defaultSort);
  const [selColors, setSelColors] = useState(Array.isArray(saved.selColors) ? saved.selColors : []);
  const [selSizes, setSelSizes] = useState(Array.isArray(saved.selSizes) ? saved.selSizes : []);
  const [saleOnly, setSaleOnly] = useState(!!saved.saleOnly);
  const [stockOnly, setStockOnly] = useState(!!saved.stockOnly);
  const [pmin, setPmin] = useState(saved.pmin ?? '');
  const [pmax, setPmax] = useState(saved.pmax ?? '');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { sessionStorage.setItem(memKey, JSON.stringify({ sort, selColors, selSizes, saleOnly, stockOnly, pmin, pmax })); } catch { /* تجاهل */ }
  }, [memKey, sort, selColors, selSizes, saleOnly, stockOnly, pmin, pmax]);

  const facets = useMemo(() => {
    const colorMap = new Map();
    const sizeSet = new Set();
    let anySale = false;
    let anySoldOut = false;
    let min = Infinity; let max = -Infinity;
    for (const p of products || []) {
      for (const c of productColors(p)) { if (!colorMap.has(c)) { const css = colorToCss(c); if (css) colorMap.set(c, css); } }
      for (const s of productSizes(p)) sizeSet.add(s);
      if (discountPct(p) > 0) anySale = true;
      if (isSoldOut(p)) anySoldOut = true;
      const pr = Number(p.price) || 0;
      if (pr < min) min = pr;
      if (pr > max) max = pr;
    }
    const colors = [...colorMap.entries()].map(([name, css]) => ({ name, css }));
    const sizes = [...sizeSet].sort((a, b) => {
      const ia = SIZES.indexOf(a); const ib = SIZES.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return { colors, sizes, anySale, anySoldOut, min: min === Infinity ? 0 : Math.floor(min), max: max === -Infinity ? 0 : Math.ceil(max) };
  }, [products]);

  const view = useMemo(() => {
    let list = [...(products || [])];
    if (selColors.length) list = list.filter((p) => productColors(p).some((c) => selColors.includes(c)));
    if (selSizes.length) list = list.filter((p) => productSizes(p).some((s) => selSizes.includes(s)));
    if (saleOnly) list = list.filter((p) => discountPct(p) > 0);
    if (stockOnly) list = list.filter((p) => !isSoldOut(p));
    const lo = pmin !== '' ? Number(pmin) : null;
    const hi = pmax !== '' ? Number(pmax) : null;
    if (lo != null) list = list.filter((p) => (Number(p.price) || 0) >= lo);
    if (hi != null) list = list.filter((p) => (Number(p.price) || 0) <= hi);
    const by = {
      'price-asc': (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
      'price-desc': (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
      discount: (a, b) => discountPct(b) - discountPct(a),
      popular: (a, b) => (b.soldCount || 0) - (a.soldCount || 0),
      rating: (a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0) || (b.ratingCount || 0) - (a.ratingCount || 0),
      new: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    };
    // المتوفّر أولاً دائماً، ثم الفرز المختار داخل كل مجموعة (المنتهي يهبط لأسفل)
    const cmp = by[sort] || by.new;
    return list.sort((a, b) => (isSoldOut(a) - isSoldOut(b)) || cmp(a, b));
  }, [products, selColors, selSizes, saleOnly, stockOnly, pmin, pmax, sort]);

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const activeCount = selColors.length + selSizes.length + (saleOnly ? 1 : 0) + (stockOnly ? 1 : 0) + (pmin !== '' || pmax !== '' ? 1 : 0);
  const clearAll = () => { setSelColors([]); setSelSizes([]); setSaleOnly(false); setStockOnly(false); setPmin(''); setPmax(''); };

  const sortOptions = [
    { value: 'new', label: t('filters.sortNew') },
    { value: 'popular', label: t('filters.sortPopular') },
    { value: 'price-asc', label: t('filters.sortPriceAsc') },
    { value: 'price-desc', label: t('filters.sortPriceDesc') },
    { value: 'discount', label: t('filters.sortDiscount') },
    { value: 'rating', label: t('filters.sortRating') },
  ];

  const hasFilters = facets.colors.length >= 2 || facets.sizes.length >= 2 || facets.anySale || facets.max > facets.min;
  // شبكة أصغر من عنصرين لا تحتاج فرزاً/فلترة — نعرضها كما هي
  if ((products?.length || 0) < 2) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {(products || []).map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={whatsapp || p.storeWhatsapp} />)}
      </div>
    );
  }

  return (
    <div>
      {/* شريط الفرز والفلاتر */}
      <div className="mb-4 flex items-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${open || activeCount ? 'border-wine bg-wine text-cream' : 'border-wine/25 text-wine hover:bg-wine/10'}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
            {t('filters.title')}
            {activeCount > 0 && <span className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-bold ${open || activeCount ? 'bg-cream text-wine' : 'bg-wine text-cream'}`}>{activeCount}</span>}
          </button>
        )}
        <div className="ms-auto flex items-center gap-2">
          <span className="hidden text-sm text-stone-400 sm:inline">{t('filters.results', { count: view.length })}</span>
          <Select value={sort} onChange={setSort} options={sortOptions} className="w-44" />
        </div>
      </div>

      {/* لوحة الفلاتر */}
      {open && hasFilters && (
        <div className="glass mb-5 space-y-4 p-4">
          {facets.colors.length >= 2 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-stone-300">{t('filters.color')}</p>
              <div className="flex flex-wrap gap-2">
                {facets.colors.map(({ name, css }) => {
                  const on = selColors.includes(name);
                  return (
                    <button
                      key={name} type="button" onClick={() => toggle(selColors, setSelColors, name)}
                      className={`flex items-center gap-2 rounded-full border py-1 pe-3 ps-1 text-sm transition ${on ? 'border-wine bg-wine/10 font-semibold text-wine' : 'border-wine/20 text-stone-200 hover:border-wine/40'}`}
                    >
                      <span className="h-6 w-6 rounded-full" style={{ background: css, boxShadow: '0 0 0 1px rgba(255,255,255,0.5), inset 0 0 0 1px rgba(0,0,0,0.12)' }} />
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {facets.sizes.length >= 2 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-stone-300">{t('filters.size')}</p>
              <div className="flex flex-wrap gap-2">
                {facets.sizes.map((s) => {
                  const on = selSizes.includes(s);
                  return (
                    <button
                      key={s} type="button" onClick={() => toggle(selSizes, setSelSizes, s)}
                      className={`min-w-[2.75rem] rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${on ? 'border-wine bg-wine text-cream' : 'border-wine/25 text-wine hover:bg-wine/10'}`}
                    >
                      {sizeLabel(s, t)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {facets.max > facets.min && (() => {
            const lo = pmin !== '' ? Math.max(facets.min, Number(pmin)) : facets.min;
            const hi = pmax !== '' ? Math.min(facets.max, Number(pmax)) : facets.max;
            const span = facets.max - facets.min || 1;
            const pctOf = (v) => ((v - facets.min) / span) * 100;
            return (
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-300">{t('filters.price')}</p>
                {/* dir=ltr مقصود: النطاقات الرقمية تُقرأ يسار→يمين عالمياً (الأصغر يساراً)
                    حتى داخل واجهة عربية — وهذا أيضاً يجنّبنا انعكاس حساب النِسَب */}
                <div
                  dir="ltr"
                  className="relative h-6 cursor-pointer select-none"
                  onClick={(e) => {
                    // النقر على المسار يقفز بأقرب مقبض. نتجاهل النقر الواقع على المدخلين
                    // نفسيهما — وإلا أطلق انتهاءُ السحب نقرةً تعيد ضبط القيمة
                    if (e.target.tagName === 'INPUT') return;
                    const r = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left - 9) / (r.width - 18)));
                    const v = Math.round(facets.min + ratio * span);
                    if (Math.abs(v - lo) <= Math.abs(v - hi)) setPmin(String(Math.min(v, hi)));
                    else setPmax(String(Math.max(v, lo)));
                  }}
                >
                  <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-wine/15" />
                  <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-wine" style={{ left: `${pctOf(lo)}%`, width: `${pctOf(hi) - pctOf(lo)}%` }} />
                  <input
                    type="range" min={facets.min} max={facets.max} value={lo} aria-label={t('filters.from')}
                    onChange={(e) => setPmin(String(Math.min(Number(e.target.value), hi)))}
                    className="range-dual absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2"
                  />
                  <input
                    type="range" min={facets.min} max={facets.max} value={hi} aria-label={t('filters.to')}
                    onChange={(e) => setPmax(String(Math.max(Number(e.target.value), lo)))}
                    className="range-dual absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2"
                  />
                </div>
                <div dir="ltr" className="mt-1.5 flex justify-between text-xs font-bold text-wine">
                  <span>{t('common.currency')}{lo}</span>
                  <span>{t('common.currency')}{hi}</span>
                </div>
              </div>
            );
          })()}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {facets.anySale && (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-200">
                <input type="checkbox" checked={saleOnly} onChange={(e) => setSaleOnly(e.target.checked)} className="h-4 w-4 accent-wine" />
                {t('filters.saleOnly')}
              </label>
            )}
            {facets.anySoldOut && (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-200">
                <input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)} className="h-4 w-4 accent-wine" />
                {t('filters.stockOnly')}
              </label>
            )}
            {activeCount > 0 && <button type="button" onClick={clearAll} className="ms-auto text-sm font-semibold text-wine hover:underline">{t('filters.clear')}</button>}
          </div>
        </div>
      )}

      {/* الشبكة */}
      {view.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {view.map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={whatsapp || p.storeWhatsapp} />)}
        </div>
      ) : (
        <div className="glass flex flex-col items-center gap-4 p-10 text-center text-stone-400">
          <p>{t('filters.none')}</p>
          {activeCount > 0 && (
            <button type="button" onClick={clearAll} className="rounded-full border border-wine/30 px-5 py-2 text-sm font-bold text-wine transition hover:bg-wine hover:text-cream">
              {t('filters.clear')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

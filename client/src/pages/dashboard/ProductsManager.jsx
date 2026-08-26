import { useCallback, useEffect, useMemo, useState } from 'react';
import useSessionState from '../../hooks/useSessionState.js';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import ProductForm from './ProductForm.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { StarIcon, LinkIcon, BagIcon, SearchIcon, EditIcon, CopyIcon, TrashIcon, CheckIcon, XIcon } from '../../components/icons.jsx';
import { cldVideoPoster } from '../../utils/cloudinary.js';
import { clearCachePrefixes } from '../../utils/apiCache.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHead, SectionHead } from '../../components/FormField.jsx';
import Select from '../../components/Select.jsx';
import { platformCatName } from '../../utils/platformCategories.js';

// فئات المنصّة تُقرأ من مصدرها الموحّد لا من قائمةٍ مكتوبة هنا: كانت السبع
// مكرّرةً بهذا الملف، فالفئة التي يضيفها المدير كانت تظهر بمفتاحها الخام
// («c_a1b2c3») بدل اسمها بجدول منتجات كل متجر.

// بعد حذف/تعديل/إضافة منتج: نفرّغ كاش الصفحات العامة كي يختفي/يظهر التغيير فوراً
// (الرئيسية، صفحة المتجر، الفئات، العروض، المقترحات، وصفحة المنتج نفسها)
const purgePublicCaches = () => clearCachePrefixes(['home', 'storepage:', 'cat:', 'offers', 'forYou', 'product:']);

const PH = 'https://placehold.co/48x48/2b1d12/b09a7e?text=%F0%9F%91%97';

export default function ProductsManager({ onCount }) {
  const { t, i18n } = useTranslation();
  const { store } = useAuth();
  // اسم الفئة الظاهر: أصلية → ترجمة، مخصّصة → اسمها من إعدادات المتجر، وإلا المفتاح نفسه
  const catLabel = (key) => {
    // فئة متجرٍ خاصّة أولاً (اسمها من إعداداته)، وإلا فئة منصّة تُسمّى بمصدرها
    const cc = (store?.customCategories || []).find((c) => c.key === key);
    if (cc?.name) return cc.name;
    return platformCatName(key, t, i18n.language);
  };
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  // نموذج المنتج المفتوح يبقى مفتوحاً لو خرج صاحب المتجر من اللوحة ورجع — ومع
  // مسودّة الحقول (useDraft داخل النموذج) يرجع كما تركه تماماً. يُنسى عند
  // الإغلاق المتعمّد أو بعد الحفظ.
  const [modal, setModal] = useSessionState('products:modal', null);
  const [confirmDel, setConfirmDel] = useState(null); // المنتج المراد حذفه
  const [delBusy, setDelBusy] = useState(false);
  const [stockFilter, setStockFilter] = useSessionState('products:stock', 'all'); // all | low | out — متابعة سريعة للمخزون
  const [q, setQ] = useSessionState('products:q', ''); // بحث بالاسم أو الفئة — يصير ضرورياً مع كثرة القطع
  const [cat, setCat] = useSessionState('products:cat', 'all'); // تصفية حسب الفئة
  const [sort, setSort] = useSessionState('products:sort', 'newest'); // newest | priceAsc | priceDesc | stockAsc

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.products);
      onCount?.(data.products.length);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 1800); };

  const handleSaved = (m) => { setModal(null); flash(m); load(); purgePublicCaches(); };
  // نسخ منتج: نفتح النموذج مُعبّأً بكل تفاصيله بلا id (فيُنشأ منتج جديد عند الحفظ) —
  // تسريع إضافة قطع مشابهة. نلحق "(نسخة)" بالاسم كي يميّزه صاحب المتجر
  const duplicate = (p) => setModal({ ...p, id: undefined, name: `${p.name} ${t('dashboard.product.copySuffix')}` });

  const doRemove = async () => {
    if (!confirmDel) return;
    setDelBusy(true);
    try {
      await api.delete(`/products/${confirmDel.id}`);
      setConfirmDel(null);
      flash(t('dashboard.product.deleted'));
      load();
      purgePublicCaches();
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
      setConfirmDel(null);
    } finally {
      setDelBusy(false);
    }
  };

  // رابط مشاركة المنتج عبر /share/product → تظهر صورة المنتج بمعاينة واتساب (OG)
  const shareProduct = async (p) => {
    const url = `${window.location.origin}/share/product/${p.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        flash(t('common.copied'));
      }
    } catch {
      /* أُلغيت المشاركة */
    }
  };

  // المتبقي الكلي: مجموع كميات الألوان/النمر إن وُجدت وإلا المخزون العام —
  // نفس منطق شارات الزبون، فتنبيهات التاجرة تطابق ما يراه زبونها
  const remainingOf = (p) => {
    const cs = p.colorStock && typeof p.colorStock === 'object' ? p.colorStock : null;
    if (cs && Object.keys(cs).length) {
      const v = Object.values(cs).flatMap((sz) => Object.values(sz || {})).filter((qty) => typeof qty === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) : null;
    }
    const ss = p.sizeStock && typeof p.sizeStock === 'object' ? p.sizeStock : null;
    if (ss && Object.keys(ss).length) {
      const v = Object.values(ss).filter((qty) => typeof qty === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) : null;
    }
    return typeof p.stock === 'number' ? p.stock : null;
  };

  // متابعة المخزون: "أوشك على النفاد" = 5 فأقل ولم ينفد بعد. نعتمد نفس remainingOf
  // الذي تقوم عليه الشارات، فما تراه هنا يطابق ما تراه الزبونة تماماً.
  const lowList = useMemo(() => (products || []).filter((p) => { const r = remainingOf(p); return r != null && r > 0 && r <= 5; }), [products]);
  const outList = useMemo(() => (products || []).filter((p) => remainingOf(p) === 0), [products]);

  // الفئات الموجودة فعلياً بقطعك — لا نعرض فئة فارغة للتصفية
  const cats = useMemo(() => [...new Set((products || []).map((p) => p.category).filter(Boolean))], [products]);

  const shown = useMemo(() => {
    if (!products) return [];
    let base = stockFilter === 'low' ? lowList : stockFilter === 'out' ? outList : products;
    if (cat !== 'all') base = base.filter((p) => p.category === cat);
    const needle = q.trim().toLowerCase();
    if (needle) base = base.filter((p) => `${p.name} ${catLabel(p.category)}`.toLowerCase().includes(needle));
    // الترتيب على نسخة — لا نمسّ مصفوفة المنتجات الأصلية
    const arr = [...base];
    const remOrInf = (p) => { const r = remainingOf(p); return r == null ? Infinity : r; };
    if (sort === 'priceAsc') arr.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === 'priceDesc') arr.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === 'stockAsc') arr.sort((a, b) => remOrInf(a) - remOrInf(b));
    // newest = ترتيب الخادم الأصلي (المميّزة ثم الأحدث) فلا نُعيد ترتيبه
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, stockFilter, q, cat, sort, lowList, outList, store]);

  if (products === null) return <Spinner />;

  // صورة مصغّرة: تعرض مشهد الفيديو إذا ما في صورة
  const Thumb = ({ p, size }) => {
    const img = p.imageUrl || (p.images && p.images[0]) || (p.videoUrl && cldVideoPoster(p.videoUrl));
    return <img src={img || PH} alt="" className={`${size} shrink-0 rounded-xl object-cover ring-1 ring-gold-400/20`} />;
  };

  const Badges = ({ p }) => {
    const rem = remainingOf(p);
    return (
      <span className="ms-2 inline-flex gap-1 align-middle">
        {p.featured && <span className="badge inline-flex items-center bg-gold-400/20 text-gold-200"><StarIcon className="h-3 w-3" /></span>}
        {p.oldPrice > p.price && <span className="badge bg-red-500/80 text-white">%</span>}
        {rem === 0 && <span className="badge bg-red-500/20 text-red-300">{t('product.outOfStock')}</span>}
        {rem != null && rem > 0 && rem <= 5 && <span className="badge bg-amber-500/20 text-amber-300">{t('product.lastFew', { count: rem })}</span>}
      </span>
    );
  };

  // المتبقّي كرقم صريح لا كشارة فقط — «٣ قطع» أوضح من «آخر القطع» عند إعادة التوفير.
  // الفارغ (—) يعني منتجاً بلا مخزون محدَّد أصلاً (متوفّر دائماً).
  const StockCell = ({ p }) => {
    const r = remainingOf(p);
    if (r == null) return <span className="text-stone-500">—</span>;
    const tone = r === 0 ? 'text-red-300' : r <= 5 ? 'text-amber-400' : 'text-stone-300';
    return <span className={`font-bold tabular-nums ${tone}`}>{r}</span>;
  };

  const Chip = ({ value, label, count, tone }) => (
    <button
      type="button"
      onClick={() => setStockFilter(value)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition ${
        stockFilter === value ? 'bg-wine text-cream ring-wine' : `${tone} hover:brightness-110`
      }`}
    >
      {label} ({count})
    </button>
  );

  // أزرار الصفّ: أيقونات متساوية بتلميح لكلٍّ منها — كانت أربعة أزرار نصّية
  // متلاصقة تزدحم على الجوال ويقصّ بعضها
  const RowActions = ({ p }) => {
    const btn = 'grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold-400/20 text-stone-400 transition';
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button onClick={() => shareProduct(p)} title={t('product.shareProduct')} aria-label={t('product.shareProduct')} className={`${btn} hover:border-gold-400/50 hover:text-gold-200`}>
          <LinkIcon className="h-4 w-4" />
        </button>
        <button onClick={() => setModal(p)} title={t('common.edit')} aria-label={t('common.edit')} className={`${btn} hover:border-gold-400/50 hover:text-gold-200`}>
          <EditIcon className="h-4 w-4" />
        </button>
        <button onClick={() => duplicate(p)} title={t('dashboard.product.duplicate')} aria-label={t('dashboard.product.duplicate')} className={`${btn} hover:border-gold-400/50 hover:text-gold-200`}>
          <CopyIcon className="h-4 w-4" />
        </button>
        <button onClick={() => setConfirmDel(p)} title={t('common.delete')} aria-label={t('common.delete')} className={`${btn} hover:border-red-400/50 hover:text-red-300`}>
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';

  return (
    <div className="space-y-5">
      <PageHead
        icon={<BagIcon className="h-6 w-6" />}
        title={t('dashboard.myProducts')}
        hint={t('dashboard.productsHint')}
        action={<button onClick={() => setModal({})} className="btn-primary shrink-0 !py-2 text-sm">＋ {t('dashboard.addProduct')}</button>}
      />

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      {products.length === 0 ? (
        <div className={CARD}>
          <button
            type="button" onClick={() => setModal({})}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-8 text-center transition hover:border-gold-400/50 hover:bg-gold-400/5"
          >
            <BagIcon className="h-8 w-8 text-gold-300" />
            <span className="font-display text-base font-bold text-stone-100">{t('dashboard.product.empty')}</span>
            <span className="text-xs text-stone-400">{t('dashboard.product.emptyCta')}</span>
          </button>
        </div>
      ) : (
        <div className={CARD}>
          <SectionHead
            icon={<BagIcon className="h-5 w-5" />}
            title={t('dashboard.product.listTitle')}
            desc={t('dashboard.product.listCount', { count: products.length })}
          />

          {/* بحث + ترتيب + تصفية */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              {/* الأيقونة والحقل داخل حاوية واحدة (لا تراكب) + زرّ تفريغ سريع */}
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gold-400/15 bg-black/20 px-3 focus-within:border-gold-400/60 focus-within:ring-2 focus-within:ring-gold-400/25">
                <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
                <input
                  type="text"
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
                  placeholder={t('dashboard.product.searchPlaceholder')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} aria-label={t('common.cancel')} className="shrink-0 text-stone-400 transition hover:text-gold-200">
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* قائمة الموقع المخصّصة لا <select> الأصلي: الأخير يرسم قائمته
                  بألوان النظام فلا تتبع ثيم الموقع ولا الوضع الليلي */}
              <div className="w-40 shrink-0">
                <Select
                  value={sort}
                  onChange={setSort}
                  className="!py-2 text-sm"
                  options={[
                    { value: 'newest', label: t('dashboard.product.sortNewest') },
                    { value: 'priceAsc', label: t('dashboard.product.sortPriceAsc') },
                    { value: 'priceDesc', label: t('dashboard.product.sortPriceDesc') },
                    { value: 'stockAsc', label: t('dashboard.product.sortStockAsc') },
                  ]}
                />
              </div>
            </div>

            {/* شرائح المخزون */}
            {(lowList.length > 0 || outList.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                <Chip value="all" label={t('common.all')} count={products.length} tone="bg-wine/10 text-wine ring-wine/20" />
                {lowList.length > 0 && <Chip value="low" label={t('dashboard.product.lowStock')} count={lowList.length} tone="bg-amber-500/15 text-amber-300 ring-amber-500/25" />}
                {outList.length > 0 && <Chip value="out" label={t('product.outOfStock')} count={outList.length} tone="bg-red-500/15 text-red-300 ring-red-500/25" />}
              </div>
            )}

            {/* شرائح الفئات — تظهر عند وجود أكثر من فئة فعلاً */}
            {cats.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {['all', ...cats].map((c) => {
                  const on = cat === c;
                  return (
                    <button
                      key={c} type="button" onClick={() => setCat(c)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        on ? 'border-[#b09a7e] bg-[#b09a7e] text-[#3f2e22]' : 'border-gold-400/25 bg-gold-400/5 text-stone-300 hover:bg-gold-400/15 hover:text-gold-200'
                      }`}
                    >
                      {c === 'all' ? t('common.all') : catLabel(c)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* عدد النتائج — يظهر فقط عند وجود تصفية فعّالة */}
            {(q.trim() || cat !== 'all' || stockFilter !== 'all') && shown.length > 0 && (
              <p className="text-[11px] text-stone-400">{t('dashboard.product.showing', { shown: shown.length, total: products.length })}</p>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-gold-400/15 bg-black/20 py-8 text-center text-sm text-stone-400">{t('dashboard.product.noMatch')}</p>
          ) : (
            <>
              {/* جدول للشاشات المتوسّطة فأعلى */}
              <table className="hidden w-full text-start text-sm sm:table">
                <thead className="border-b border-gold-400/15 text-stone-400">
                  <tr>
                    <th className="py-3 pe-3 text-start font-medium">{t('dashboard.product.name')}</th>
                    <th className="p-3 text-start font-medium">{t('dashboard.product.category')}</th>
                    <th className="p-3 text-start font-medium">{t('dashboard.product.price')}</th>
                    <th className="p-3 text-start font-medium">{t('dashboard.product.qty')}</th>
                    <th className="py-3 ps-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-gold-400/5">
                      <td className="py-3 pe-3">
                        <div className="flex items-center gap-3">
                          <Thumb p={p} size="h-11 w-11" />
                          <span className="font-medium text-stone-100">{p.name}<Badges p={p} /></span>
                        </div>
                      </td>
                      <td className="p-3 text-stone-300">{catLabel(p.category)}</td>
                      <td className="p-3 font-semibold text-gold-300">{t('common.currency')}{p.price}</td>
                      <td className="p-3"><StockCell p={p} /></td>
                      <td className="py-3 ps-3">
                        <div className="flex justify-end"><RowActions p={p} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* بطاقات للجوال — الأزرار بسطر مستقلّ فلا تزدحم مع الاسم */}
              <div className="space-y-2.5 sm:hidden">
                {shown.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-gold-400/15 bg-black/20 p-3">
                    <div className="flex items-center gap-3">
                      <Thumb p={p} size="h-14 w-14" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-stone-100">{p.name}</p>
                        <p className="mt-0.5 truncate text-xs text-stone-400">
                          {catLabel(p.category)} · <span className="font-bold text-gold-300">{t('common.currency')}{p.price}</span>
                          {' · '}<span className="text-stone-400">{t('dashboard.product.qty')}: </span><StockCell p={p} />
                        </p>
                        <p className="mt-1"><Badges p={p} /></p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex justify-end border-t border-white/5 pt-2.5"><RowActions p={p} /></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {modal !== null && (
        <ProductForm initial={modal.id || modal.name ? modal : null} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}

      <ConfirmModal
        open={!!confirmDel}
        title={t('dashboard.product.deleteTitle')}
        message={confirmDel ? `${t('dashboard.product.deleteMsg')}\n«${confirmDel.name}»` : ''}
        confirmLabel={t('common.delete')}
        busy={delBusy}
        onConfirm={doRemove}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

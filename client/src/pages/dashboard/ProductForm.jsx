import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import VideoInput from '../../components/VideoInput.jsx';
import Select from '../../components/Select.jsx';
import useScrollLock from '../../hooks/useScrollLock.js';
import { XIcon, ClockIcon, PaletteIcon, CameraIcon, StarIcon, EditIcon, TagIcon, CashIcon } from '../../components/icons.jsx';
import { Field, DateInput, Tip } from '../../components/FormField.jsx';
import { SIZES, sizeLabel } from '../../utils/sizes.js';
import { colorToCss, COLOR_SUGGESTIONS } from '../../utils/colorDot.js';

const CATEGORIES = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];
const EMPTY = {
  name: '', price: '', cost: '', oldPrice: '', description: '', size: '', color: '',
  category: 'abaya', imageUrl: '', images: [], videoUrl: '', stock: '', featured: false, sizeStock: {}, colorStock: {}, colorImages: {}, saleEndsAt: '',
};

// تحويل ISO إلى صيغة خانة التاريخ المحلّية (YYYY-MM-DD)
function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// قسم معنون داخل النموذج — يجمع الحقول المتشابهة بإطار واحد مرتب بدل رصّها المتتالي
function Section({ icon, title, children }) {
  return (
    <section className="rounded-2xl border border-gold-400/15 bg-black/[0.05] p-4">
      <h3 className="mb-3 flex items-center gap-2 border-b border-gold-400/10 pb-2.5 text-sm font-bold text-gold-100">{icon}{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function ProductForm({ initial, onClose, onSaved }) {
  const { t } = useTranslation();
  const { store } = useAuth();
  const isEdit = Boolean(initial?.id);
  // خيارات الفئة: الأصلية الخمس + الفئات المخصّصة للمتجر
  const categoryOptions = [
    ...CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) })),
    ...(Array.isArray(store?.customCategories) ? store.customCategories : []).map((cc) => ({ value: cc.key, label: cc.name })),
  ];
  const [form, setForm] = useState(
    initial
      ? {
          ...EMPTY,
          ...initial,
          price: String(initial.price ?? ''),
          cost: initial.cost != null ? String(initial.cost) : '',
          oldPrice: initial.oldPrice != null ? String(initial.oldPrice) : '',
          stock: initial.stock != null ? String(initial.stock) : '',
          images: initial.images || [],
          sizeStock: initial.sizeStock && typeof initial.sizeStock === 'object' ? initial.sizeStock : {},
          colorStock: initial.colorStock && typeof initial.colorStock === 'object' ? initial.colorStock : {},
          colorImages: initial.colorImages && typeof initial.colorImages === 'object' ? initial.colorImages : {},
          saleEndsAt: toDateInput(initial.saleEndsAt),
        }
      : EMPTY
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [colorInput, setColorInput] = useState('');
  useScrollLock(true); // تجميد الخلفية أثناء فتح نموذج المنتج

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // هامش القطعة = السعر − التكلفة (يظهر فور الكتابة ليوجّه التسعير)
  const margin = (() => {
    const price = parseFloat(form.price);
    const cost = parseFloat(form.cost);
    if (!Number.isFinite(price) || !Number.isFinite(cost) || cost <= 0) return null;
    const value = price - cost;
    return { value, pct: price > 0 ? Math.round((value / price) * 100) : 0 };
  })();

  // الخصم كما ستراه الزبونة. القيمة السالبة ليست خصماً بل رفعاً للسعر، وكانت
  // تُحفظ بصمت فيظهر على البطاقة سعرٌ مشطوب أقلّ من الحالي — وهو ما يفقد الثقة.
  const discount = (() => {
    const price = parseFloat(form.price);
    const old = parseFloat(form.oldPrice);
    if (!Number.isFinite(price) || !Number.isFinite(old) || old <= 0 || price <= 0) return null;
    if (old <= price) return { invalid: true };
    return { pct: Math.round(((old - price) / old) * 100), saves: old - price };
  })();

  // المخزون لكل لون ثم نمرة: { "أسود": {"38": 3}, ... }
  const colors = Object.keys(form.colorStock);

  // مجموع كميّات المتغيّرات: الرقم الذي يحكم البيع فعلاً حين تُعرَّف ألوان،
  // بينما «الكمية المتوفّرة» بالأعلى تخصّ المنتج بلا متغيّرات. عرضهما معاً
  // يمنع الظنّ أن الحقلين يتحدّثان عن الشيء نفسه.
  const variantTotal = colors.reduce(
    (sum, c) => sum + Object.values(form.colorStock[c] || {}).reduce((a, q) => a + (parseInt(q, 10) || 0), 0),
    0
  );
  const addColorVariant = (val) => {
    const v = (val || '').trim();
    if (!v || form.colorStock[v]) { setColorInput(''); return; }
    setForm({ ...form, colorStock: { ...form.colorStock, [v]: {} } });
    setColorInput('');
  };
  const removeColorVariant = (c) => {
    const colorStock = { ...form.colorStock };
    delete colorStock[c];
    const colorImages = { ...form.colorImages };
    delete colorImages[c];
    setForm({ ...form, colorStock, colorImages });
  };

  // صور كل لون (Color Swatches) — حتى 4 صور لكل لون
  const addColorImage = (c) =>
    setForm((f) => { const arr = f.colorImages?.[c] || []; return arr.length >= 4 ? f : { ...f, colorImages: { ...f.colorImages, [c]: [...arr, ''] } }; });
  const setColorImageAt = (c, idx, val) =>
    setForm((f) => { const arr = [...(f.colorImages?.[c] || [])]; arr[idx] = val; return { ...f, colorImages: { ...f.colorImages, [c]: arr } }; });
  const removeColorImage = (c, idx) =>
    setForm((f) => ({ ...f, colorImages: { ...f.colorImages, [c]: (f.colorImages?.[c] || []).filter((_, i) => i !== idx) } }));
  const toggleColorSize = (c, s) => {
    const sizes = { ...(form.colorStock[c] || {}) };
    if (s in sizes) delete sizes[s];
    else sizes[s] = '';
    setForm({ ...form, colorStock: { ...form.colorStock, [c]: sizes } });
  };
  const setColorSizeQty = (c, s, val) => {
    const sizes = { ...(form.colorStock[c] || {}) };
    sizes[s] = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setForm({ ...form, colorStock: { ...form.colorStock, [c]: sizes } });
  };

  const setGalleryAt = (idx, val) => {
    const images = [...form.images];
    images[idx] = val;
    setForm({ ...form, images });
  };
  const addGallery = () => form.images.length < 5 && setForm({ ...form, images: [...form.images, ''] });
  const removeGallery = (idx) => setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // الكمية لكل نمرة مختارة (لون/مقاس) إجبارية — وإلا اللون لا يُحفظ
    for (const c of Object.keys(form.colorStock)) {
      const sizes = form.colorStock[c] || {};
      for (const s of Object.keys(sizes)) {
        if (sizes[s] === '' || sizes[s] == null) {
          setError(t('dashboard.product.qtyRequired'));
          return;
        }
      }
    }
    for (const s of Object.keys(form.sizeStock || {})) {
      if (form.sizeStock[s] === '' || form.sizeStock[s] == null) {
        setError(t('dashboard.product.qtyRequired'));
        return;
      }
    }
    setBusy(true);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      cost: form.cost === '' ? null : parseFloat(form.cost),
      oldPrice: form.oldPrice === '' ? null : parseFloat(form.oldPrice),
      stock: form.stock === '' ? null : parseInt(form.stock, 10),
      images: form.images.filter(Boolean),
      sizeStock: form.sizeStock,
      // ينتهي العرض بنهاية اليوم المختار (23:59 محلياً)
      saleEndsAt: form.saleEndsAt ? new Date(`${form.saleEndsAt}T23:59:59`).toISOString() : null,
    };
    try {
      if (isEdit) await api.put(`/products/${initial.id}`, payload);
      else await api.post('/products', payload);
      onSaved(isEdit ? t('dashboard.product.updated') : t('dashboard.product.created'));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  // نرسم النافذة داخل جذر الثيم (.theme-pub) لا داخل body: يتجاوز الـstacking context الحابس
  // (فتغطّي الهيدر) مع بقاء سياق الثيم native فتضبط ألوان النهار/الليل تلقائياً بلا التفاف
  const portalTarget = (typeof document !== 'undefined' && (document.querySelector('.theme-pub') || document.body)) || null;
  if (!portalTarget) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-strong flex max-h-[92vh] w-full max-w-lg animate-fade-up flex-col overflow-hidden">
        {/* الرأس لاصق: النموذج طويل، وكانت العودة للإغلاق تتطلّب تمريراً للأعلى */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gold-400/15 px-4 py-4 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500 text-white shadow-md">
            <TagIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="gradient-text font-display text-lg font-bold leading-tight sm:text-xl">
              {isEdit ? t('dashboard.product.editTitle') : t('dashboard.product.newTitle')}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-stone-400">
              {isEdit ? form.name || t('dashboard.product.formHintEdit') : t('dashboard.product.formHintNew')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:bg-white/5 hover:text-gold-200" aria-label={t('common.cancel')}><XIcon className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
        {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
          {/* ١) الصور والفيديو */}
          <Section icon={<CameraIcon className="h-4 w-4" />} title={t('dashboard.product.secMedia')}>
            <Field label={t('dashboard.product.image')} tip={t('dashboard.product.imageTip')} icon={<CameraIcon className="h-4 w-4" />} required>
              <ImageInput value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
            </Field>
            <Field
              label={t('dashboard.product.gallery')}
              tip={t('dashboard.product.galleryTip')}
              optional
              hint={form.images.length ? t('dashboard.product.galleryCount', { count: form.images.length }) : ''}
            >
              <div className="space-y-3">
                {form.images.map((img, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <ImageInput value={img} onChange={(v) => setGalleryAt(idx, v)} />
                    </div>
                    <button type="button" onClick={() => removeGallery(idx)} className="mt-1 rounded-lg p-2 text-stone-400 hover:text-red-300"><XIcon className="h-4 w-4" /></button>
                  </div>
                ))}
                {form.images.length < 5 && (
                  <button type="button" onClick={addGallery} className="btn-ghost w-full text-sm">＋ {t('dashboard.product.addImage')}</button>
                )}
              </div>
            </Field>
            <Field label={t('dashboard.product.video')} tip={t('dashboard.product.videoTip')} optional>
              <VideoInput value={form.videoUrl} onChange={(v) => setForm({ ...form, videoUrl: v })} />
            </Field>
          </Section>

          {/* ٢) المعلومات الأساسية */}
          <Section icon={<EditIcon className="h-4 w-4" />} title={t('dashboard.product.secBasic')}>
            <Field label={t('dashboard.product.name')} tip={t('dashboard.product.nameTip')} required max={80} value={form.name}>
              <input type="text" required maxLength={80} className="input" value={form.name} onChange={set('name')} />
            </Field>
            <Field label={t('dashboard.product.category')} tip={t('dashboard.product.categoryTip')} required>
              <Select
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                options={categoryOptions}
              />
            </Field>
            <Field label={t('dashboard.product.description')} tip={t('dashboard.product.descriptionTip')} optional max={500} value={form.description}>
              <textarea rows={3} maxLength={500} className="input resize-none" value={form.description} onChange={set('description')} />
            </Field>
          </Section>

          {/* ٣) السعر والعرض */}
          <Section icon={<TagIcon className="h-4 w-4" />} title={t('dashboard.product.secPricing')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('dashboard.product.price')} tip={t('dashboard.product.priceTip')} required>
                <div className="relative">
                  <input type="number" step="0.01" min="0" inputMode="decimal" required className="input pe-8" value={form.price} onChange={set('price')} />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">{t('common.currency')}</span>
                </div>
              </Field>
              <Field label={t('dashboard.product.oldPrice')} tip={t('dashboard.product.oldPriceTip')} optional>
                <div className="relative">
                  <input type="number" step="0.01" min="0" inputMode="decimal" className="input pe-8" value={form.oldPrice} onChange={set('oldPrice')} />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">{t('common.currency')}</span>
                </div>
                {discount?.invalid && (
                  <p className="mt-1.5 text-[11px] font-semibold text-amber-400">{t('dashboard.product.oldPriceTooLow')}</p>
                )}
                {discount?.pct > 0 && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-stone-200">
                    {/* شارة مصمتة بلونين صريحين: الأخضر الشفّاف فوق خلفية فاتحة يهبط إلى ٢.٩٦ */}
                    <span className="rounded-full px-1.5 py-0.5" style={{ background: '#047857', color: '#ffffff' }}>−{discount.pct}%</span>
                    {t('dashboard.product.discountShown', { pct: discount.pct, amount: `${t('common.currency')}${discount.saves.toFixed(2)}` })}
                  </p>
                )}
              </Field>
            </div>
            {/* سعر التكلفة — للمالكة وحدها، لا يظهر للزبون إطلاقاً. أساس حساب الربح. */}
            <Field
              label={t('dashboard.product.cost')}
              tip={t('dashboard.product.costTip')}
              optional
              icon={<CashIcon className="h-4 w-4" />}
            >
              <div className="relative">
                <input
                  type="number" step="0.01" min="0" inputMode="decimal" placeholder="0"
                  className="input pe-8" value={form.cost} onChange={set('cost')}
                />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">{t('common.currency')}</span>
              </div>
              {/* الربح لكل قطعة يظهر فور الكتابة — رقم يوجّه التسعير قبل الحفظ */}
              {margin != null && (
                <p className={`mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold ${margin.value >= 0 ? 'text-emerald-400' : 'text-red-300'}`}>
                  <span>{t('dashboard.product.marginPerPiece', { amount: `${t('common.currency')}${margin.value.toFixed(2)}` })}</span>
                  <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-stone-400">{t('dashboard.product.marginPercent', { pct: margin.pct })}</span>
                </p>
              )}
            </Field>

            {/* عرض بوقت محدود: عدّاد تنازلي — يظهر للزبون، وعند انتهائه يعود السعر الأصلي تلقائياً */}
            {form.oldPrice !== '' && (
              <Field
                label={t('dashboard.product.saleEndsAt')}
                tip={t('dashboard.product.saleEndsTip')}
                optional
                icon={<ClockIcon className="h-4 w-4" />}
              >
                <DateInput value={form.saleEndsAt} onChange={(v) => set('saleEndsAt')({ target: { value: v } })} />
                <p className="mt-1 text-xs text-stone-400">{t('dashboard.product.saleEndsHint')}</p>
              </Field>
            )}
          </Section>

          {/* ٤) المخزون والألوان */}
          <Section icon={<PaletteIcon className="h-4 w-4" />} title={t('dashboard.product.secInventory')}>
            <Field label={t('dashboard.product.stock')} tip={t('dashboard.product.stockTip')} optional>
              <input type="number" min="0" inputMode="numeric" className="input" value={form.stock} onChange={set('stock')} placeholder="∞" />
              <p className="mt-1 text-xs text-stone-400">{t('dashboard.product.stockHint')}</p>
            </Field>
          {/* المتغيّرات: لكل لون نختار النمر المتوفّرة وكميتها — الزبون يختار اللون أولاً ثم النمرة */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-300">
              <PaletteIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">{t('dashboard.product.variants')}</span>
              <Tip text={t('dashboard.product.variantsTip')} />
              <span className="shrink-0 text-[10px] text-stone-400">({t('common.optional')})</span>
            </div>
            <p className="mb-2 text-xs text-stone-400">{t('dashboard.product.variantsHint')}</p>

            {colors.length > 0 && (
              <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-gold-400/20 bg-gold-400/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-stone-200">
                <span>{t('dashboard.product.variantTotal', { count: variantTotal })}</span>
                <span className="font-normal text-stone-400">{t('dashboard.product.variantTotalHint')}</span>
              </p>
            )}

            {colors.length > 0 && (
              <div className="space-y-3">
                {colors.map((c) => {
                  const sizes = form.colorStock[c] || {};
                  return (
                    <div key={c} className="rounded-xl border border-gold-400/15 bg-black/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-2 font-bold text-gold-100">
                          <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: colorToCss(c) || 'transparent', boxShadow: '0 0 0 1px rgba(244,237,226,0.45), inset 0 0 0 1px rgba(0,0,0,0.2)' }} />
                          {c}
                        </span>
                        <button type="button" onClick={() => removeColorVariant(c)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-400 hover:text-red-300"><XIcon className="h-3.5 w-3.5" /> {t('common.delete')}</button>
                      </div>
                      {/* اختيار النمر المتوفّرة لهذا اللون */}
                      <div className="flex flex-wrap gap-1.5">
                        {SIZES.map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => toggleColorSize(c, s)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              s in sizes ? 'border-gold-400 bg-gold-400/20 text-gold-100' : 'border-gold-400/20 text-stone-300 hover:bg-white/5'
                            }`}
                          >
                            {sizeLabel(s, t)}
                          </button>
                        ))}
                      </div>
                      {/* كمية كل نمرة مختارة لهذا اللون */}
                      {Object.keys(sizes).length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {Object.keys(sizes).map((s) => (
                            <div key={s} className="flex items-center gap-2">
                              <span className="w-12 shrink-0 text-xs font-bold text-gold-100">{sizeLabel(s, t)}</span>
                              <input
                                type="number" min="0" inputMode="numeric" required
                                className={`input !py-1.5 text-sm ${sizes[s] === '' || sizes[s] == null ? 'ring-1 ring-red-400/70' : ''}`}
                                placeholder={t('dashboard.product.qty')}
                                value={sizes[s] ?? ''}
                                onChange={(e) => setColorSizeQty(c, s, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* صور هذا اللون — تظهر للزبونة عند اختياره (Color Swatches) */}
                      {(() => {
                        const imgs = form.colorImages?.[c] || [];
                        return (
                          <div className="mt-3 rounded-lg border border-gold-400/20 bg-gold-400/[0.04] p-2.5">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="flex items-center gap-1.5 text-xs font-bold text-gold-100"><CameraIcon className="h-4 w-4" /> {t('dashboard.product.colorImages')}</p>
                              {imgs.length > 0 && <span className="shrink-0 text-[10px] font-medium text-stone-400">{t('dashboard.product.colorImagesCount', { count: imgs.length })}</span>}
                            </div>
                            <p className="mb-2 text-[11px] leading-relaxed text-stone-400">{t('dashboard.product.colorImagesHint')}</p>
                            <div className="space-y-2">
                              {imgs.map((img, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <div className="flex-1"><ImageInput value={img} onChange={(v) => setColorImageAt(c, idx, v)} /></div>
                                  <button type="button" onClick={() => removeColorImage(c, idx)} className="mt-1 rounded-lg p-2 text-stone-400 hover:text-red-300" aria-label={t('common.delete')}><XIcon className="h-4 w-4" /></button>
                                </div>
                              ))}
                              {imgs.length < 4 && (
                                <button type="button" onClick={() => addColorImage(c)} className="btn-ghost w-full text-sm">＋ {t('dashboard.product.addColorImage')}</button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            {/* إضافة لون جديد — مع اقتراحات أثناء الكتابة ومعاينة حيّة لدائرة اللون */}
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  className="input !pe-10"
                  list="bz-color-suggestions"
                  placeholder={t('dashboard.product.addColorPlaceholder')}
                  value={colorInput}
                  onChange={(e) => setColorInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addColorVariant(colorInput); } }}
                />
                {colorToCss(colorInput) && (
                  <span
                    className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
                    style={{ background: colorToCss(colorInput), boxShadow: '0 0 0 1px rgba(244,237,226,0.45), inset 0 0 0 1px rgba(0,0,0,0.2)' }}
                  />
                )}
              </div>
              <button type="button" onClick={() => addColorVariant(colorInput)} className="btn-ghost shrink-0 !px-4">＋ {t('dashboard.product.addColor')}</button>
              <datalist id="bz-color-suggestions">
                {COLOR_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            {/* الاسم غير معروف؟ ننبّه قبل الحفظ بدل دائرة فاضية تفاجئه على البطاقة */}
            {colorInput.trim().length > 1 && !colorToCss(colorInput) && (
              <p className="mt-1.5 text-xs text-orange-700">{t('dashboard.product.colorUnknown')}</p>
            )}
          </div>
          </Section>

          <div className="flex items-center gap-2 rounded-xl border border-gold-400/15 bg-black/20 px-4 py-3">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-5 w-5 shrink-0 accent-gold-400" />
              <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-stone-200"><StarIcon className="h-4 w-4 shrink-0 text-gold-300" /> {t('dashboard.product.featured')}</span>
            </label>
            <Tip text={t('dashboard.product.featuredTip')} />
          </div>

        </div>

        {/* الأزرار ثابتة أسفل النافذة: كانت بآخر نموذج يتجاوز ارتفاعه الشاشة
            مرّات، فيُملأ الحقل الأخير ثم يُبحث عن الحفظ بتمرير طويل */}
        <div className="flex shrink-0 gap-3 border-t border-gold-400/15 px-4 py-3 sm:px-6">
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? t('common.loading') : (isEdit ? t('common.save') : t('dashboard.product.saveNew'))}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost shrink-0">{t('common.cancel')}</button>
        </div>
        </form>
      </div>
    </div>,
    portalTarget,
  );
}

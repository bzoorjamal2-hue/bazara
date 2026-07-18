import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import VideoInput from '../../components/VideoInput.jsx';
import Select from '../../components/Select.jsx';
import useScrollLock from '../../hooks/useScrollLock.js';
import { XIcon, ClockIcon, PaletteIcon, CameraIcon, StarIcon, EditIcon, TagIcon } from '../../components/icons.jsx';
import { SIZES, sizeLabel } from '../../utils/sizes.js';
import { colorToCss, COLOR_SUGGESTIONS } from '../../utils/colorDot.js';

const CATEGORIES = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];
const EMPTY = {
  name: '', price: '', oldPrice: '', description: '', size: '', color: '',
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

  // المخزون لكل لون ثم نمرة: { "أسود": {"38": 3}, ... }
  const colors = Object.keys(form.colorStock);
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
      <div className="glass-strong max-h-[92vh] w-full max-w-lg animate-fade-up overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold gradient-text">
            {isEdit ? t('dashboard.product.editTitle') : t('dashboard.product.newTitle')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:text-gold-200" aria-label="close"><XIcon className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {/* ١) الصور والفيديو */}
          <Section icon={<CameraIcon className="h-4 w-4" />} title={t('dashboard.product.secMedia')}>
            <ImageInput label={t('dashboard.product.image')} value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
            <div>
              <label className="label">{t('dashboard.product.gallery')} <span className="text-stone-500">({t('common.optional')})</span></label>
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
            </div>
            <VideoInput
              label={`${t('dashboard.product.video')} (${t('common.optional')})`}
              value={form.videoUrl}
              onChange={(v) => setForm({ ...form, videoUrl: v })}
            />
          </Section>

          {/* ٢) المعلومات الأساسية */}
          <Section icon={<EditIcon className="h-4 w-4" />} title={t('dashboard.product.secBasic')}>
            <div>
              <label className="label">{t('dashboard.product.name')}</label>
              <input type="text" required className="input" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className="label">{t('dashboard.product.category')}</label>
              <Select
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                options={categoryOptions}
              />
            </div>
            <div>
              <label className="label">{t('dashboard.product.description')} <span className="text-stone-500">({t('common.optional')})</span></label>
              <textarea rows={3} className="input resize-none" value={form.description} onChange={set('description')} />
            </div>
          </Section>

          {/* ٣) السعر والعرض */}
          <Section icon={<TagIcon className="h-4 w-4" />} title={t('dashboard.product.secPricing')}>
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="label">{t('dashboard.product.price')}</label>
                <input type="number" step="0.01" min="0" required className="input" value={form.price} onChange={set('price')} />
              </div>
              <div className="min-w-0">
                <label className="label">{t('dashboard.product.oldPrice')} <span className="text-stone-500">({t('common.optional')})</span></label>
                <input type="number" step="0.01" min="0" className="input" value={form.oldPrice} onChange={set('oldPrice')} />
              </div>
            </div>
            {/* عرض بوقت محدود: عدّاد تنازلي — يظهر للزبون، وعند انتهائه يعود السعر الأصلي تلقائياً */}
            {form.oldPrice !== '' && (
              <div className="min-w-0">
                <label className="label flex items-center gap-1.5"><ClockIcon className="h-4 w-4" /> {t('dashboard.product.saleEndsAt')} <span className="text-stone-500">({t('common.optional')})</span></label>
                <input type="date" className="input" value={form.saleEndsAt} onChange={set('saleEndsAt')} />
                <p className="mt-1 text-xs text-stone-400">{t('dashboard.product.saleEndsHint')}</p>
              </div>
            )}
          </Section>

          {/* ٤) المخزون والألوان */}
          <Section icon={<PaletteIcon className="h-4 w-4" />} title={t('dashboard.product.secInventory')}>
            <div>
              <label className="label">{t('dashboard.product.stock')}</label>
              <input type="number" min="0" className="input" value={form.stock} onChange={set('stock')} placeholder="∞" />
              <p className="mt-1 text-xs text-stone-400">{t('dashboard.product.stockHint')}</p>
            </div>
          {/* المتغيّرات: لكل لون نختار النمر المتوفّرة وكميتها — الزبون يختار اللون أولاً ثم النمرة */}
          <div>
            <label className="label flex items-center gap-1.5"><PaletteIcon className="h-4 w-4" /> {t('dashboard.product.variants')} <span className="text-stone-500">({t('common.optional')})</span></label>
            <p className="mb-2 text-xs text-stone-400">{t('dashboard.product.variantsHint')}</p>

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
                      <div className="mt-3 border-t border-gold-400/10 pt-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-stone-300"><CameraIcon className="h-4 w-4" /> {t('dashboard.product.colorImages')}</p>
                        <div className="space-y-2">
                          {(form.colorImages?.[c] || []).map((img, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className="flex-1"><ImageInput value={img} onChange={(v) => setColorImageAt(c, idx, v)} /></div>
                              <button type="button" onClick={() => removeColorImage(c, idx)} className="mt-1 rounded-lg p-2 text-stone-400 hover:text-red-300" aria-label={t('common.delete')}><XIcon className="h-4 w-4" /></button>
                            </div>
                          ))}
                          {(form.colorImages?.[c] || []).length < 4 && (
                            <button type="button" onClick={() => addColorImage(c)} className="btn-ghost w-full text-sm">＋ {t('dashboard.product.addColorImage')}</button>
                          )}
                        </div>
                      </div>
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

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gold-400/15 bg-black/20 px-4 py-3">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-5 w-5 accent-gold-400" />
            <span className="inline-flex items-center gap-1.5 text-sm text-stone-200"><StarIcon className="h-4 w-4 text-gold-300" /> {t('dashboard.product.featured')}</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? t('common.loading') : t('common.save')}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>,
    portalTarget,
  );
}

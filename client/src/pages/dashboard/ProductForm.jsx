import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import ImageInput from '../../components/ImageInput.jsx';
import VideoInput from '../../components/VideoInput.jsx';
import Select from '../../components/Select.jsx';

const CATEGORIES = ['abaya', 'set', 'dress', 'hijab', 'trench'];
const SIZES = ['36', '38', '40', '42', '44', '46', '48'];
const EMPTY = {
  name: '', price: '', oldPrice: '', description: '', size: '', color: '',
  category: 'abaya', imageUrl: '', images: [], videoUrl: '', stock: '', featured: false,
};

export default function ProductForm({ initial, onClose, onSaved }) {
  const { t } = useTranslation();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(
    initial
      ? {
          ...EMPTY,
          ...initial,
          price: String(initial.price ?? ''),
          oldPrice: initial.oldPrice != null ? String(initial.oldPrice) : '',
          stock: initial.stock != null ? String(initial.stock) : '',
          images: initial.images || [],
        }
      : EMPTY
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [colorInput, setColorInput] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // مقاسات المنتج (متعدّدة) — مخزّنة كنص مفصول بفواصل
  const selectedSizes = form.size ? form.size.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const toggleSize = (s) => {
    const setS = new Set(selectedSizes);
    setS.has(s) ? setS.delete(s) : setS.add(s);
    setForm({ ...form, size: SIZES.filter((x) => setS.has(x)).join(',') });
  };

  // ألوان المنتج (متعدّدة) — يكتبها صاحب المتجر ويختارها الزبون لاحقاً
  const selectedColors = form.color ? form.color.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const addColor = (val) => {
    const v = (val || '').trim();
    if (!v || selectedColors.includes(v)) { setColorInput(''); return; }
    setForm({ ...form, color: [...selectedColors, v].join(',') });
    setColorInput('');
  };
  const removeColor = (c) => setForm({ ...form, color: selectedColors.filter((x) => x !== c).join(',') });

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
    setBusy(true);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      oldPrice: form.oldPrice === '' ? null : parseFloat(form.oldPrice),
      stock: form.stock === '' ? null : parseInt(form.stock, 10),
      images: form.images.filter(Boolean),
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

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-strong max-h-[92vh] w-full max-w-lg animate-fade-up overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold gradient-text">
            {isEdit ? t('dashboard.product.editTitle') : t('dashboard.product.newTitle')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:text-gold-200" aria-label="close">✕</button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <ImageInput label={t('dashboard.product.image')} value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />

          {/* معرض الصور الإضافية */}
          <div>
            <label className="label">{t('dashboard.product.gallery')} <span className="text-stone-500">({t('common.optional')})</span></label>
            <div className="space-y-3">
              {form.images.map((img, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex-1">
                    <ImageInput value={img} onChange={(v) => setGalleryAt(idx, v)} />
                  </div>
                  <button type="button" onClick={() => removeGallery(idx)} className="mt-1 rounded-lg p-2 text-stone-400 hover:text-red-300">✕</button>
                </div>
              ))}
              {form.images.length < 5 && (
                <button type="button" onClick={addGallery} className="btn-ghost w-full text-sm">＋ {t('dashboard.product.addImage')}</button>
              )}
            </div>
          </div>

          {/* فيديو المنتج (رفع مباشر أو رابط) */}
          <div>
            <VideoInput
              label={`🎬 ${t('dashboard.product.video')} (${t('common.optional')})`}
              value={form.videoUrl}
              onChange={(v) => setForm({ ...form, videoUrl: v })}
            />
          </div>

          <div>
            <label className="label">{t('dashboard.product.name')}</label>
            <input type="text" required className="input" value={form.name} onChange={set('name')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('dashboard.product.price')}</label>
              <input type="number" step="0.01" min="0" required className="input" value={form.price} onChange={set('price')} />
            </div>
            <div>
              <label className="label">{t('dashboard.product.oldPrice')} <span className="text-stone-500">({t('common.optional')})</span></label>
              <input type="number" step="0.01" min="0" className="input" value={form.oldPrice} onChange={set('oldPrice')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('dashboard.product.category')}</label>
              <Select
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                options={CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
              />
            </div>
            <div>
              <label className="label">{t('dashboard.product.stock')}</label>
              <input type="number" min="0" className="input" value={form.stock} onChange={set('stock')} placeholder="∞" />
              <p className="mt-1 text-xs text-stone-400">{t('dashboard.product.stockHint')}</p>
            </div>
          </div>

          <div>
            <label className="label">{t('dashboard.product.size')} <span className="text-stone-500">({t('common.optional')})</span></label>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSize(s)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                    selectedSizes.includes(s)
                      ? 'border-gold-400 bg-gold-400/20 text-gold-100'
                      : 'border-gold-400/20 text-stone-300 hover:bg-white/5'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t('dashboard.product.color')} <span className="text-stone-500">({t('common.optional')})</span></label>
            {selectedColors.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedColors.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/15 px-3 py-1 text-sm text-gold-100">
                    {c}
                    <button type="button" onClick={() => removeColor(c)} aria-label="remove" className="text-gold-200 transition hover:text-white">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder={t('dashboard.product.colorHint')}
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addColor(colorInput); } }}
              />
              <button type="button" onClick={() => addColor(colorInput)} className="btn-ghost shrink-0 !px-4">＋</button>
            </div>
          </div>

          <div>
            <label className="label">{t('dashboard.product.description')}</label>
            <textarea rows={3} className="input resize-none" value={form.description} onChange={set('description')} />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gold-400/15 bg-black/20 px-4 py-3">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-5 w-5 accent-gold-400" />
            <span className="text-sm text-stone-200">⭐ {t('dashboard.product.featured')}</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? t('common.loading') : t('common.save')}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

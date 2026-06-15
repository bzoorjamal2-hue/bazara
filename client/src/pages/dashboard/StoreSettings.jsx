import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import VideoInput from '../../components/VideoInput.jsx';

const EMPTY = {
  name: '', description: '', logoUrl: '', phone: '', whatsapp: '',
  instagram: '', facebook: '', tiktok: '', themeColor: '#d4af37', deliveryInfo: '', paymentInfo: '', banners: [],
};

// شرايح افتراضية يقترحها النظام عند عدم وجود بانرات (يقدر المالك يعدّلها أو يحذفها)
const DEFAULT_BANNERS = [
  { title: 'تشكيلة جديدة وصلت', subtitle: 'تصفّحوا أحدث القطع لدينا', bgType: '', bgValue: '' },
  { title: 'عروض خاصة', subtitle: 'تابعونا لكل جديد وحصري', bgType: '', bgValue: '' },
];
const BG_TYPES = [['', 'bgTheme'], ['color', 'bgColor'], ['image', 'bgImage'], ['video', 'bgVideo']];
const MAX_BANNERS = 5;
// نمر دليل المقاسات القابل للتخصيص
const CHART_SIZES = ['36', '38', '40', '42', '44', '46', '48'];

export default function StoreSettings() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/stores/me')
      .then((res) => {
        const s = res.data.store;
        setForm({
          name: s.name || '', description: s.description || '', logoUrl: s.logoUrl || '',
          phone: s.phone || '', whatsapp: s.whatsapp || '', instagram: s.instagram || '',
          facebook: s.facebook || '', tiktok: s.tiktok || '', themeColor: s.themeColor || '#d4af37',
          deliveryInfo: s.deliveryInfo || '', paymentInfo: s.paymentInfo || '',
          banners: Array.isArray(s.banners) && s.banners.length ? s.banners : DEFAULT_BANNERS,
          deliveryZones: Array.isArray(s.deliveryZones) ? s.deliveryZones : [],
          freeShippingOver: s.freeShippingOver ? String(s.freeShippingOver) : '',
          sizeChart: s.sizeChart && typeof s.sizeChart === 'object' ? s.sizeChart : {},
          returnPolicy: s.returnPolicy || '',
        });
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.put('/stores/me', form);
      await refresh();
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
      setMsg(t('image.imageSaved'));
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    }
  };

  if (!form) return <Spinner />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // التحكم بشرايح السلايدر
  const setBanner = (idx, key, val) =>
    setForm((f) => ({ ...f, banners: f.banners.map((b, i) => (i === idx ? { ...b, [key]: val } : b)) }));
  const addBanner = () =>
    setForm((f) => ({ ...f, banners: [...f.banners, { title: '', subtitle: '', bgType: '', bgValue: '' }] }));
  const removeBanner = (idx) =>
    setForm((f) => ({ ...f, banners: f.banners.filter((_, i) => i !== idx) }));
  // تغيير نوع الخلفية يصفّر القيمة السابقة
  const setBannerBg = (idx, bgType) =>
    setForm((f) => ({ ...f, banners: f.banners.map((b, i) => (i === idx ? { ...b, bgType, bgValue: '' } : b)) }));

  // التحكم بمناطق التوصيل [{name, fee}]
  const setZone = (idx, key, val) =>
    setForm((f) => ({ ...f, deliveryZones: f.deliveryZones.map((z, i) => (i === idx ? { ...z, [key]: val } : z)) }));
  const addZone = () => setForm((f) => ({ ...f, deliveryZones: [...f.deliveryZones, { name: '', fee: '' }] }));
  const removeZone = (idx) => setForm((f) => ({ ...f, deliveryZones: f.deliveryZones.filter((_, i) => i !== idx) }));

  // التحكم بدليل المقاسات المخصّص: {"38": {bust, waist, hips}}
  const setChartCell = (size, key, val) =>
    setForm((f) => ({ ...f, sizeChart: { ...f.sizeChart, [size]: { ...(f.sizeChart?.[size] || {}), [key]: val.replace(/\D/g, '') } } }));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.storeSettings')}</h1>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      <form onSubmit={submit} className="space-y-5">
        {/* الأساسيات */}
        <div className="glass space-y-4 p-6">
          <div>
            <ImageInput label={t('dashboard.store.logo')} value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
            <button type="button" onClick={saveLogo} className="btn-ghost mt-3 text-sm">💾 {t('image.saveImage')}</button>
          </div>
          <div>
            <label className="label">{t('dashboard.store.name')}</label>
            <input type="text" required className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">{t('dashboard.store.description')}</label>
            <textarea rows={3} className="input resize-none" value={form.description} onChange={set('description')} />
          </div>
        </div>

        {/* التواصل */}
        <div className="glass space-y-4 p-6">
          <h2 className="font-display text-lg font-bold text-stone-100">{t('dashboard.store.contact')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t('dashboard.store.whatsapp')}</label>
              <input type="text" dir="ltr" className="input" placeholder="+962790000000" value={form.whatsapp} onChange={set('whatsapp')} />
              <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.whatsappHint')}</p>
            </div>
            <div>
              <label className="label">{t('dashboard.store.phone')}</label>
              <input type="text" dir="ltr" className="input" value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="label">{t('dashboard.store.instagram')}</label>
              <input type="text" dir="ltr" className="input" placeholder="username" value={form.instagram} onChange={set('instagram')} />
            </div>
            <div>
              <label className="label">{t('dashboard.store.facebook')}</label>
              <input type="text" dir="ltr" className="input" placeholder="facebook.com/yourpage" value={form.facebook} onChange={set('facebook')} />
            </div>
            <div>
              <label className="label">{t('dashboard.store.tiktok')}</label>
              <input type="text" dir="ltr" className="input" placeholder="username" value={form.tiktok} onChange={set('tiktok')} />
            </div>
          </div>
        </div>

        {/* بانرات السلايدر */}
        <div className="glass space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-stone-100">{t('dashboard.store.banners')}</h2>
            {form.banners.length < MAX_BANNERS && (
              <button type="button" onClick={addBanner} className="btn-ghost !py-1.5 text-sm">＋ {t('dashboard.store.addBanner')}</button>
            )}
          </div>
          <p className="text-xs text-stone-400">{t('dashboard.store.bannersHint')}</p>

          {form.banners.length === 0 ? (
            <p className="rounded-xl border border-gold-400/15 bg-black/20 p-4 text-center text-sm text-stone-400">{t('dashboard.store.noBanners')}</p>
          ) : (
            <div className="space-y-3">
              {form.banners.map((b, idx) => (
                <div key={idx} className="rounded-xl border border-gold-400/15 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gold-200">{t('dashboard.store.slide')} {idx + 1}</span>
                    <button type="button" onClick={() => removeBanner(idx)} className="text-xs text-red-300 hover:text-red-200">🗑 {t('common.delete')}</button>
                  </div>
                  <input
                    type="text"
                    className="input mb-2"
                    placeholder={t('dashboard.store.bannerTitle')}
                    value={b.title}
                    maxLength={80}
                    onChange={(e) => setBanner(idx, 'title', e.target.value)}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder={t('dashboard.store.bannerSubtitle')}
                    value={b.subtitle}
                    maxLength={160}
                    onChange={(e) => setBanner(idx, 'subtitle', e.target.value)}
                  />

                  {/* خلفية الشريحة: افتراضي / لون / صورة / فيديو */}
                  <div className="mt-3 border-t border-gold-400/10 pt-3">
                    <p className="mb-2 text-xs font-semibold text-stone-300">{t('dashboard.store.bannerBg')}</p>
                    <div className="flex flex-wrap gap-2">
                      {BG_TYPES.map(([val, key]) => (
                        <button
                          type="button"
                          key={key}
                          onClick={() => setBannerBg(idx, val)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            (b.bgType || '') === val ? 'border-gold-400 bg-gold-400/20 text-gold-100' : 'border-gold-400/20 text-stone-300 hover:bg-white/5'
                          }`}
                        >
                          {t(`dashboard.store.${key}`)}
                        </button>
                      ))}
                    </div>

                    {b.bgType === 'color' && (
                      <div className="mt-2 flex items-center gap-2">
                        <input type="color" className="h-9 w-12 cursor-pointer rounded-lg border border-gold-400/20 bg-black/30" value={b.bgValue || '#5e4636'} onChange={(e) => setBanner(idx, 'bgValue', e.target.value)} />
                        <span className="text-xs text-stone-400" dir="ltr">{b.bgValue || '#5e4636'}</span>
                      </div>
                    )}
                    {b.bgType === 'image' && (
                      <div className="mt-2">
                        <ImageInput value={b.bgValue} onChange={(v) => setBanner(idx, 'bgValue', v)} />
                      </div>
                    )}
                    {b.bgType === 'video' && (
                      <div className="mt-2">
                        <VideoInput value={b.bgValue} onChange={(v) => setBanner(idx, 'bgValue', v)} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* مناطق التوصيل ورسومها */}
        <div className="glass space-y-3 p-6">
          <div>
            <h2 className="font-display text-lg font-bold text-stone-100">🚚 {t('dashboard.store.zones')}</h2>
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.zonesHint')}</p>
          </div>

          {form.deliveryZones.length > 0 && (
            <div className="space-y-2">
              {form.deliveryZones.map((z, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder={t('dashboard.store.zoneName')}
                    value={z.name}
                    onChange={(e) => setZone(idx, 'name', e.target.value)}
                  />
                  <div className="relative w-28 shrink-0">
                    <input
                      className="input pe-8"
                      type="number" min="0" step="1"
                      placeholder={t('dashboard.store.zoneFee')}
                      value={z.fee}
                      onChange={(e) => setZone(idx, 'fee', e.target.value)}
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">₪</span>
                  </div>
                  <button type="button" onClick={() => removeZone(idx)} className="rounded-lg p-2 text-stone-400 hover:text-red-300" aria-label="remove">✕</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={addZone} className="btn-ghost w-full text-sm">＋ {t('dashboard.store.addZone')}</button>

          <div className="border-t border-white/5 pt-3">
            <label className="label">{t('dashboard.store.freeShippingOver')}</label>
            <div className="relative w-40">
              <input className="input pe-8" type="number" min="0" step="1" placeholder="0" value={form.freeShippingOver} onChange={set('freeShippingOver')} />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">₪</span>
            </div>
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.freeShippingHint')}</p>
          </div>
        </div>

        {/* دليل المقاسات المخصّص */}
        <div className="glass space-y-3 p-6">
          <div>
            <h2 className="font-display text-lg font-bold text-stone-100">📏 {t('dashboard.store.sizeChart')}</h2>
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.sizeChartHint')}</p>
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
                          dir="ltr" inputMode="numeric" placeholder="—"
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
        </div>

        {/* سياسة الإرجاع والتبديل */}
        <div className="glass space-y-2 p-6">
          <label className="label">🛡️ {t('dashboard.store.returnPolicy')}</label>
          <p className="text-xs text-stone-400">{t('dashboard.store.returnPolicyHint')}</p>
          <textarea rows={3} className="input resize-none" maxLength={2000} placeholder={t('product.returnPolicyDefault')} value={form.returnPolicy} onChange={set('returnPolicy')} />
        </div>

        {/* التوصيل والدفع */}
        <div className="glass space-y-4 p-6">
          <div>
            <label className="label">{t('dashboard.store.delivery')}</label>
            <textarea rows={2} className="input resize-none" value={form.deliveryInfo} onChange={set('deliveryInfo')} />
          </div>
          <div>
            <label className="label">{t('dashboard.store.payment')}</label>
            <textarea rows={2} className="input resize-none" value={form.paymentInfo} onChange={set('paymentInfo')} />
          </div>
        </div>

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? t('common.loading') : t('common.save')}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import BannerEditor from '../../components/BannerEditor.jsx';
import OpostConnect from '../../components/OpostConnect.jsx';
import EpsConnect from '../../components/EpsConnect.jsx';
import { SaveIcon, TruckIcon, ImageIcon, XIcon, GiftIcon, FolderIcon, TrashIcon, MegaphoneIcon, RulerIcon, ShieldIcon } from '../../components/icons.jsx';

const EMPTY = {
  name: '', slug: '', description: '', logoUrl: '', phone: '', whatsapp: '', deliveryPhone: '',
  instagram: '', facebook: '', tiktok: '', themeColor: '#d4af37', deliveryInfo: '', paymentInfo: '', banners: [],
};

// شرايح افتراضية يقترحها النظام عند عدم وجود بانرات (يقدر المالك يعدّلها أو يحذفها)
const DEFAULT_BANNERS = [
  { title: 'تشكيلة جديدة وصلت', subtitle: 'تصفّحوا أحدث القطع لدينا', bgType: '', bgValue: '' },
  { title: 'عروض خاصة', subtitle: 'تابعونا لكل جديد وحصري', bgType: '', bgValue: '' },
];
// نمر دليل المقاسات القابل للتخصيص
const CHART_SIZES = ['36', '38', '40', '42', '44', '46', '48'];
// الفئات الثابتة (قابلة للتخصيص بصورة/اسم)
const STORE_CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

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
          name: s.name || '', slug: s.slug || '', description: s.description || '', logoUrl: s.logoUrl || '',
          phone: s.phone || '', whatsapp: s.whatsapp || '', deliveryPhone: s.deliveryPhone || '', instagram: s.instagram || '',
          facebook: s.facebook || '', tiktok: s.tiktok || '', themeColor: s.themeColor || '#d4af37',
          deliveryInfo: s.deliveryInfo || '', paymentInfo: s.paymentInfo || '',
          banners: Array.isArray(s.banners) && s.banners.length ? s.banners : DEFAULT_BANNERS,
          deliveryZones: Array.isArray(s.deliveryZones) ? s.deliveryZones : [],
          freeShippingOver: s.freeShippingOver ? String(s.freeShippingOver) : '',
          referralPercent: s.referralPercent ? String(s.referralPercent) : '',
          sizeChart: s.sizeChart && typeof s.sizeChart === 'object' ? s.sizeChart : {},
          returnPolicy: s.returnPolicy || '',
          announcement: s.announcement || '',
          announcementEn: s.announcementEn || '',
          welcomeOffer: s.welcomeOffer || '',
          categoryMeta: s.categoryMeta && typeof s.categoryMeta === 'object' ? s.categoryMeta : {},
          customCategories: Array.isArray(s.customCategories) ? s.customCategories : [],
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


  // التحكم بمناطق التوصيل [{name, fee}]
  const setZone = (idx, key, val) =>
    setForm((f) => ({ ...f, deliveryZones: f.deliveryZones.map((z, i) => (i === idx ? { ...z, [key]: val } : z)) }));
  const addZone = () => setForm((f) => ({ ...f, deliveryZones: [...f.deliveryZones, { name: '', fee: '' }] }));
  const removeZone = (idx) => setForm((f) => ({ ...f, deliveryZones: f.deliveryZones.filter((_, i) => i !== idx) }));

  // التحكم بدليل المقاسات المخصّص: {"38": {bust, waist, hips}}
  const setChartCell = (size, key, val) =>
    setForm((f) => ({ ...f, sizeChart: { ...f.sizeChart, [size]: { ...(f.sizeChart?.[size] || {}), [key]: val.replace(/\D/g, '') } } }));

  // التحكم بتخصيص الفئات: {"dress": {image, name}}
  const setCatMeta = (cat, key, val) =>
    setForm((f) => ({ ...f, categoryMeta: { ...f.categoryMeta, [cat]: { ...(f.categoryMeta?.[cat] || {}), [key]: val } } }));

  // الفئات الإضافية المخصّصة: [{key, name, image}]
  const addCustomCat = () =>
    setForm((f) => ({ ...f, customCategories: [...(f.customCategories || []), { key: 'c_' + Math.random().toString(36).slice(2, 9), name: '', image: '' }] }));
  const setCustomCat = (idx, key, val) =>
    setForm((f) => ({ ...f, customCategories: f.customCategories.map((c, i) => (i === idx ? { ...c, [key]: val } : c)) }));
  const removeCustomCat = (idx) =>
    setForm((f) => ({ ...f, customCategories: f.customCategories.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-6">
      {/* رأس فخم */}
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500 text-white shadow-md">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9.5 5.2 5h13.6L20 9.5a2.4 2.4 0 0 1-4.8.3 2.4 2.4 0 0 1-4.8 0 2.4 2.4 0 0 1-4.8 0A2.4 2.4 0 0 1 4 9.5Z" /><path d="M5.5 11v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight gradient-text">{t('dashboard.storeSettings')}</h1>
          <p className="text-xs text-stone-400">{t('dashboard.store.settingsHint')}</p>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      <form onSubmit={submit} className="space-y-5">
        {/* الأساسيات */}
        <div className="glass space-y-4 p-6">
          <div>
            <ImageInput label={t('dashboard.store.logo')} value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
            <button type="button" onClick={saveLogo} className="btn-ghost mt-3 gap-1.5 text-sm"><SaveIcon className="h-4 w-4" /> {t('image.saveImage')}</button>
          </div>
          <div>
            <label className="label">{t('dashboard.store.name')}</label>
            <input type="text" required className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">{t('dashboard.store.urlLabel')}</label>
            <div className="flex items-center gap-1 rounded-xl border border-wine/20 bg-white/5 px-3 py-1" dir="ltr">
              <span className="shrink-0 text-xs text-stone-400">bazarastore.site/store/</span>
              <input
                type="text" dir="ltr" inputMode="latin" placeholder="lifestyle"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-stone-100 focus:outline-none"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
            </div>
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.urlHint')}</p>
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
              <label className="label flex items-center gap-1.5"><TruckIcon className="h-4 w-4" /> {t('dashboard.store.deliveryPhone')}</label>
              <input type="text" dir="ltr" className="input" placeholder="+970590000000" value={form.deliveryPhone} onChange={set('deliveryPhone')} />
              <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.deliveryPhoneHint')}</p>
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
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><ImageIcon className="h-5 w-5" /> {t('dashboard.store.banners')}</h2>
          <BannerEditor banners={form.banners} onChange={(b) => setForm((f) => ({ ...f, banners: b }))} />
        </div>

        {/* مناطق التوصيل ورسومها */}
        <div className="glass space-y-3 p-6">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><TruckIcon className="h-5 w-5" /> {t('dashboard.store.zones')}</h2>
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
                  <button type="button" onClick={() => removeZone(idx)} className="rounded-lg p-2 text-stone-400 hover:text-red-300" aria-label="remove"><XIcon className="h-4 w-4" /></button>
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

          {/* برنامج الإحالة: نسبة خصم الزبونة الجديدة (0 = معطّل) */}
          <div className="border-t border-white/5 pt-3">
            <label className="label flex items-center gap-1.5"><GiftIcon className="h-4 w-4" /> {t('dashboard.store.referralPercent')}</label>
            <div className="relative w-40">
              <input className="input pe-8" type="number" min="0" max="90" step="1" placeholder="0" value={form.referralPercent} onChange={set('referralPercent')} />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">%</span>
            </div>
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.referralHint')}</p>
          </div>
        </div>

        {/* تخصيص الفئات — صورة واقعية + اسم لكل فئة */}
        <div className="glass space-y-4 p-6">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><FolderIcon className="h-5 w-5" /> {t('dashboard.store.categories')}</h2>
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.categoriesHint')}</p>
          </div>
          <div className="space-y-3">
            {STORE_CATS.map((c) => {
              const meta = form.categoryMeta?.[c] || {};
              return (
                <div key={c} className="rounded-xl border border-gold-400/15 bg-black/20 p-3">
                  <p className="mb-2 text-sm font-semibold text-gold-200">{t(`categories.${c}`)}</p>
                  <ImageInput value={meta.image || ''} onChange={(v) => setCatMeta(c, 'image', v)} />
                  <input
                    type="text"
                    maxLength={40}
                    className="input mt-2"
                    placeholder={t('dashboard.store.categoryNamePlaceholder', { name: t(`categories.${c}`) })}
                    value={meta.name || ''}
                    onChange={(e) => setCatMeta(c, 'name', e.target.value)}
                  />
                </div>
              );
            })}
          </div>

          {/* فئات إضافية مخصّصة — يضيفها المشترك بلا حدود */}
          <div className="border-t border-gold-400/10 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-stone-100">＋ {t('dashboard.store.customCategories')}</h3>
              <button type="button" onClick={addCustomCat} className="btn-ghost !py-1.5 text-sm">＋ {t('dashboard.store.addCategory')}</button>
            </div>
            {(form.customCategories || []).length === 0 ? (
              <p className="rounded-xl border border-gold-400/15 bg-black/20 p-3 text-center text-xs text-stone-400">{t('dashboard.store.noCustomCategories')}</p>
            ) : (
              <div className="space-y-3">
                {form.customCategories.map((cc, idx) => (
                  <div key={cc.key || idx} className="rounded-xl border border-gold-400/15 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gold-200">{cc.name || t('dashboard.store.newCategory')}</span>
                      <button type="button" onClick={() => removeCustomCat(idx)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-400 hover:text-red-300"><TrashIcon className="h-3.5 w-3.5" /> {t('common.delete')}</button>
                    </div>
                    <input type="text" maxLength={40} className="input mb-2" placeholder={t('dashboard.store.categoryNameField')} value={cc.name} onChange={(e) => setCustomCat(idx, 'name', e.target.value)} />
                    <ImageInput value={cc.image || ''} onChange={(v) => setCustomCat(idx, 'image', v)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* تسويق: شريط إعلانات + نافذة ترحيب */}
        <div className="glass space-y-4 p-6">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><MegaphoneIcon className="h-5 w-5" /> {t('dashboard.store.marketing')}</h2>
          <div>
            <label className="label">{t('dashboard.store.announcement')}</label>
            <textarea rows={3} maxLength={500} className="input resize-none" placeholder={t('dashboard.store.announcementPlaceholder')} value={form.announcement} onChange={set('announcement')} />
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.announcementHint')}</p>
          </div>
          <div>
            <label className="label">{t('dashboard.store.announcementEn')}</label>
            <textarea rows={3} maxLength={500} dir="ltr" className="input resize-none text-start" placeholder={t('dashboard.store.announcementEnPlaceholder')} value={form.announcementEn} onChange={set('announcementEn')} />
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.announcementEnHint')}</p>
          </div>
          <div>
            <label className="label">{t('dashboard.store.welcomeOffer')}</label>
            <input type="text" maxLength={300} className="input" placeholder={t('dashboard.store.welcomePlaceholder')} value={form.welcomeOffer} onChange={set('welcomeOffer')} />
            <p className="mt-1 text-xs text-stone-400">{t('dashboard.store.welcomeHint')}</p>
          </div>
        </div>

        {/* دليل المقاسات المخصّص */}
        <div className="glass space-y-3 p-6">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><RulerIcon className="h-5 w-5" /> {t('dashboard.store.sizeChart')}</h2>
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
          <label className="label flex items-center gap-1.5"><ShieldIcon className="h-4 w-4" /> {t('dashboard.store.returnPolicy')}</label>
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
    </div>
  );
}

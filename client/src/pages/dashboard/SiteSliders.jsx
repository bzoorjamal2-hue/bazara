import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { clearCachePrefixes } from '../../utils/apiCache.js';
import Spinner from '../../components/Spinner.jsx';
import BannerEditor from '../../components/BannerEditor.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { ImageIcon, MegaphoneIcon, GridIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Field, RowTools, Tip } from '../../components/FormField.jsx';
import { BUILTIN_CATS } from '../../utils/platformCategories.js';

// الشرائح الافتراضية الموجودة حالياً بالصفحة الرئيسية — تظهر للمدير ليعدّلها/يحذفها
const DEFAULT_SITE_SLIDES = [
  { title: 'تشكيلة جديدة وصلت', subtitle: 'تصفّحوا أحدث القطع لدينا', bgType: '', bgValue: '', btnLabel: '', btnHref: '' },
  { title: 'عروض خاصة', subtitle: 'تابعونا لكل جديد وحصري', bgType: '', bgValue: '', btnLabel: '', btnHref: '' },
  { title: 'بازارا', subtitle: 'وجهتك للأزياء الفاخرة', bgType: '', bgValue: '', btnLabel: '', btnHref: '' },
];

// تحكّم المدير العام بسلايدر الصفحة الرئيسية للموقع — نفس محرّر بانرات المشتركين + أزرار.
export default function SiteSliders() {
  const { t } = useTranslation();
  const [banners, setBanners] = useState(null);
  const [ann, setAnn] = useState('');
  const [annEn, setAnnEn] = useState('');
  const [lb, setLb] = useState({ image: '', title: '', titleEn: '', productIds: [] });
  const [collections, setCollections] = useState([]);
  const [platCats, setPlatCats] = useState({ extra: [], hidden: [] });
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/site/banners')
      .then((r) => { setBanners(r.data.banners?.length ? r.data.banners : DEFAULT_SITE_SLIDES); setAnn(r.data.announcement || ''); setAnnEn(r.data.announcementEn || ''); setLb({ image: '', title: '', titleEn: '', productIds: [], ...(r.data.lookbook || {}) }); setCollections(Array.isArray(r.data.collections) ? r.data.collections : []); setPlatCats({ extra: r.data.platformCategories?.extra || [], hidden: r.data.platformCategories?.hidden || [] }); setInstagram(r.data.instagram || ''); setFacebook(r.data.facebook || ''); })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const save = async () => {
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.put('/site/banners', { banners, announcement: ann, announcementEn: annEn, collections, lookbook: lb, instagram, facebook, platformCategories: platCats });
      // بانرات الرئيسية الجديدة تظهر فوراً: نفرّغ كاش الرئيسية + النسخة المحفوظة للظهور الفوري
      clearCachePrefixes(['home']);
      try { localStorage.removeItem('bz_home_banners'); localStorage.removeItem('bz_site_socials'); } catch { /* تجاهل */ }
      setMsg(t('dashboard.store.saved'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(getErrorMessage(e, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  if (banners === null) return <Spinner />;
  return (
    <div className="space-y-5">
      <PageHead icon={<ImageIcon className="h-6 w-6" />} title={t('admin.siteSliders')} hint={t('admin.siteSlidersHint')} />
      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
      <div className="dash-section glass space-y-4 p-5 sm:p-6">
        <SectionHead icon={<ImageIcon className="h-5 w-5" />} title={t('admin.slidesSection')} desc={t('admin.slidesSectionDesc')} />
        <BannerEditor banners={banners} onChange={setBanners} withButtons />
      </div>

      {/* شريط الإعلان أعلى الصفحة الرئيسية — سطر لكل رسالة، تُعرض بتتابع متحرّك.
          يبقى مخفياً تماماً إن تُرك فارغاً */}
      <div className="dash-section glass space-y-4 p-5 sm:p-6">
        <SectionHead icon={<MegaphoneIcon className="h-5 w-5" />} title={t('admin.announcement')} desc={t('admin.announcementHint')} />
        {/* سطر لكل رسالة، تُعرض بتتابع متحرّك. يبقى الشريط مخفياً إن تُرك فارغاً */}
        <Field label={t('admin.annAr')} tip={t('admin.annArTip')} max={400} value={ann}>
          <textarea
            value={ann}
            onChange={(e) => setAnn(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder={t('admin.announcementPlaceholder')}
            className="input w-full resize-none"
          />
        </Field>
        <Field label={t('admin.annEn')} tip={t('admin.annEnTip')} optional max={400} value={annEn}>
          <textarea
            value={annEn}
            onChange={(e) => setAnnEn(e.target.value)}
            rows={2}
            maxLength={400}
            dir="ltr"
            placeholder={t('admin.announcementEnPlaceholder')}
            className="input w-full resize-none"
          />
        </Field>
      </div>
      {/* اللوك بوك: صورة إطلالة + أرقام المنتجات الظاهرة فيها (بفواصل) */}
      {/* فئات المنصّة: كانت السبع مكتوبةً في ستّة ملفات، فإضافة فئة للموقع كلّه
          تعني تعديل كود ونشراً. صارت تُدار من هنا. */}
      <div className="dash-section glass space-y-4 p-5 sm:p-6">
        <SectionHead icon={<GridIcon className="h-5 w-5" />} title={t('admin.platCats')} desc={t('admin.platCatsDesc')} />

        {/* المدمجة: تُخفى ولا تُحذف — منتجاتها القائمة تبقى مربوطة بمفاتيحها */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-300">
            {t('admin.builtinCats')} <Tip text={t('admin.builtinCatsTip')} />
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BUILTIN_CATS.map((k) => {
              const off = platCats.hidden.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={!off}
                  onClick={() => setPlatCats((p2) => ({ ...p2, hidden: off ? p2.hidden.filter((x) => x !== k) : [...p2.hidden, k] }))}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${off ? 'border-gold-400/20 text-stone-400 line-through' : 'border-transparent'}`}
                  style={off ? undefined : { background: '#d4af37', color: '#2a1c10' }}
                >
                  {t(`categories.${k}`, k)}
                </button>
              );
            })}
          </div>
        </div>

        {/* المضافة */}
        {platCats.extra.length > 0 && (
          <div className="space-y-3">
            {platCats.extra.map((c, i) => (
              <div key={i} className="space-y-2.5 rounded-xl border border-gold-400/15 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-stone-100">{c.name || t('admin.collectionUntitled')}</span>
                  <RowTools
                    index={i}
                    count={platCats.extra.length}
                    canDuplicate={false}
                    onMove={(dir) => setPlatCats((p2) => {
                      const a2 = [...p2.extra]; const j = i + dir;
                      if (j < 0 || j >= a2.length) return p2;
                      [a2[j], a2[i]] = [a2[i], a2[j]];
                      return { ...p2, extra: a2 };
                    })}
                    onRemove={() => setPlatCats((p2) => ({ ...p2, extra: p2.extra.filter((_, j) => j !== i) }))}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label={t('admin.catName')} required max={40} value={c.name || ''}>
                    <input className="input" maxLength={40} value={c.name || ''} onChange={(e) => setPlatCats((p2) => ({ ...p2, extra: p2.extra.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))} />
                  </Field>
                  <Field label={t('admin.catNameEn')} optional max={40} value={c.nameEn || ''}>
                    <input className="input" dir="ltr" maxLength={40} value={c.nameEn || ''} onChange={(e) => setPlatCats((p2) => ({ ...p2, extra: p2.extra.map((x, j) => (j === i ? { ...x, nameEn: e.target.value } : x)) }))} />
                  </Field>
                </div>
                <Field label={t('admin.catKey')} tip={t('admin.catKeyTip')} required>
                  <input
                    className="input" dir="ltr" maxLength={24} value={c.key || ''}
                    onChange={(e) => setPlatCats((p2) => ({ ...p2, extra: p2.extra.map((x, j) => (j === i ? { ...x, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } : x)) }))}
                    placeholder="kaftan"
                  />
                </Field>
                <Field label={t('admin.catImage')} tip={t('admin.catImageTip')}>
                  <ImageInput value={c.image || ''} onChange={(v) => setPlatCats((p2) => ({ ...p2, extra: p2.extra.map((x, j) => (j === i ? { ...x, image: v } : x)) }))} />
                </Field>
              </div>
            ))}
          </div>
        )}

        {platCats.extra.length < 12 && (
          <button type="button" onClick={() => setPlatCats((p2) => ({ ...p2, extra: [...p2.extra, { key: '', name: '', nameEn: '', image: '' }] }))} className="btn-ghost w-full text-sm">
            ＋ {t('admin.addCat')}
          </button>
        )}
      </div>

      {/* المجموعات التحريرية («تسوّقي حسب المناسبة») — كان العمود يُحفظ ويُقرأ
          ولا واجهة تحرّره ولا الرئيسية تعرضه: ميزةٌ مدفونة من الطرفين. */}
      <div className="dash-section glass space-y-4 p-5 sm:p-6">
        <SectionHead icon={<GridIcon className="h-5 w-5" />} title={t('admin.collections')} desc={t('admin.collectionsHint')} />

        {collections.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-gold-400/25 bg-black/15 px-4 py-6 text-center">
            <GridIcon className="h-7 w-7 text-gold-300" />
            <p className="text-xs text-stone-400">{t('admin.collectionsEmpty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {collections.map((c, i) => (
              <div key={i} className="space-y-2.5 rounded-xl border border-gold-400/15 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gold-400/15 text-[11px] font-bold text-gold-200">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-stone-100">{c.title || t('admin.collectionUntitled')}</span>
                  <RowTools
                    index={i}
                    count={collections.length}
                    canDuplicate={false}
                    onMove={(dir) => setCollections((p2) => {
                      const a2 = [...p2]; const j = i + dir;
                      if (j < 0 || j >= a2.length) return p2;
                      [a2[j], a2[i]] = [a2[i], a2[j]];
                      return a2;
                    })}
                    onRemove={() => setCollections((p2) => p2.filter((_, j) => j !== i))}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label={t('admin.collTitle')} tip={t('admin.collTitleTip')} required max={60} value={c.title || ''}>
                    <input className="input" maxLength={60} value={c.title || ''} onChange={(e) => setCollections((p2) => p2.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  </Field>
                  <Field label={t('admin.collTitleEn')} optional max={60} value={c.titleEn || ''}>
                    <input className="input" dir="ltr" maxLength={60} value={c.titleEn || ''} onChange={(e) => setCollections((p2) => p2.map((x, j) => (j === i ? { ...x, titleEn: e.target.value } : x)))} />
                  </Field>
                </div>
                <Field label={t('admin.collQ')} tip={t('admin.collQTip')} required max={60} value={c.q || ''}>
                  <input className="input" maxLength={60} value={c.q || ''} onChange={(e) => setCollections((p2) => p2.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder={t('admin.collQPlaceholder')} />
                </Field>
                <Field label={t('admin.collImage')} tip={t('admin.collImageTip')}>
                  <ImageInput value={c.image || ''} onChange={(v) => setCollections((p2) => p2.map((x, j) => (j === i ? { ...x, image: v } : x)))} />
                </Field>
              </div>
            ))}
          </div>
        )}

        {collections.length < 6 && (
          <button type="button" onClick={() => setCollections((p2) => [...p2, { title: '', titleEn: '', q: '', image: '' }])} className="btn-ghost w-full text-sm">
            ＋ {t('admin.addCollection')}
          </button>
        )}
      </div>

      <div className="dash-section glass space-y-4 p-5 sm:p-6">
        <SectionHead icon={<ImageIcon className="h-5 w-5" />} title={t('admin.lookbook')} desc={t('admin.lookbookHint')} />
        <Field label={t('admin.lookbookImage')} tip={t('admin.lookbookImageTip')}>
          <ImageInput value={lb.image} onChange={(v) => setLb({ ...lb, image: v })} />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={lb.title} onChange={(e) => setLb({ ...lb, title: e.target.value })} maxLength={60} placeholder={t('admin.lookbookTitle')} className="input" />
          <input value={lb.titleEn} onChange={(e) => setLb({ ...lb, titleEn: e.target.value })} maxLength={60} dir="ltr" placeholder={t('admin.collectionTitleEn')} className="input" />
        </div>
        <input
          value={(lb.productIds || []).join(', ')}
          onChange={(e) => setLb({ ...lb, productIds: e.target.value.split(',').map((n) => Number(n.trim())).filter((n) => Number.isInteger(n) && n > 0) })}
          dir="ltr" placeholder={t('admin.lookbookIds')} className="input w-full"
        />
      </div>

      {/* حسابات المنصّة الرسمية — تظهر في فوتر كل صفحات المتجر العام (زي سوشيال المتاجر) */}
      <div className="glass space-y-3 p-6">
        <div>
          <h2 className="font-display text-lg font-bold text-gold-200">{t('dashboard.store.contact')}</h2>
          <p className="mt-1 text-xs text-stone-400">{t('admin.socialHint')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} maxLength={200} dir="ltr" placeholder={t('dashboard.store.instagram')} className="input" />
          <input value={facebook} onChange={(e) => setFacebook(e.target.value)} maxLength={200} dir="ltr" placeholder={t('dashboard.store.facebook')} className="input" />
        </div>
      </div>

      <button onClick={save} disabled={busy} className="btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </div>
  );
}

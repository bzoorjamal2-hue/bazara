import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { clearCachePrefixes } from '../../utils/apiCache.js';
import Spinner from '../../components/Spinner.jsx';
import BannerEditor from '../../components/BannerEditor.jsx';
import { ImageIcon } from '../../components/icons.jsx';

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
  const [cols, setCols] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/site/banners')
      .then((r) => { setBanners(r.data.banners?.length ? r.data.banners : DEFAULT_SITE_SLIDES); setAnn(r.data.announcement || ''); setAnnEn(r.data.announcementEn || ''); setCols(r.data.collections || []); })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const save = async () => {
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.put('/site/banners', { banners, announcement: ann, announcementEn: annEn, collections: cols });
      // بانرات الرئيسية الجديدة تظهر فوراً: نفرّغ كاش الرئيسية + النسخة المحفوظة للظهور الفوري
      clearCachePrefixes(['home']);
      try { localStorage.removeItem('bz_home_banners'); } catch { /* تجاهل */ }
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
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text"><ImageIcon className="h-6 w-6" /> {t('admin.siteSliders')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('admin.siteSlidersHint')}</p>
      </div>
      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
      <div className="glass p-6">
        <BannerEditor banners={banners} onChange={setBanners} withButtons />
      </div>

      {/* شريط الإعلان أعلى الصفحة الرئيسية — سطر لكل رسالة، تُعرض بتتابع متحرّك.
          يبقى مخفياً تماماً إن تُرك فارغاً */}
      <div className="glass space-y-3 p-6">
        <div>
          <h2 className="font-display text-lg font-bold text-gold-200">{t('admin.announcement')}</h2>
          <p className="mt-1 text-xs text-stone-400">{t('admin.announcementHint')}</p>
        </div>
        <textarea
          value={ann}
          onChange={(e) => setAnn(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder={t('admin.announcementPlaceholder')}
          className="input w-full"
        />
        <textarea
          value={annEn}
          onChange={(e) => setAnnEn(e.target.value)}
          rows={2}
          maxLength={400}
          dir="ltr"
          placeholder={t('admin.announcementEnPlaceholder')}
          className="input w-full"
        />
      </div>
      {/* المجموعات التحريرية بالرئيسية: عنوان + صورة + كلمة بحث تفتحها البطاقة.
          لا نطلب رابطاً — نبني /search من الكلمة، فلا مجال لرابط خاطئ أو خارجي */}
      <div className="glass space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-gold-200">{t('admin.collections')}</h2>
            <p className="mt-1 text-xs text-stone-400">{t('admin.collectionsHint')}</p>
          </div>
          {cols.length < 8 && (
            <button type="button" onClick={() => setCols([...cols, { title: '', titleEn: '', image: '', q: '' }])} className="btn-ghost !px-4 !py-1.5 text-xs">
              ＋ {t('common.add')}
            </button>
          )}
        </div>
        {cols.length === 0 ? (
          <p className="text-sm text-stone-400">{t('admin.collectionsEmpty')}</p>
        ) : (
          cols.map((c, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-gold-400/20 p-3 sm:grid-cols-2">
              <input value={c.title} onChange={(e) => setCols(cols.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
                placeholder={t('admin.collectionTitle')} maxLength={60} className="input" />
              <input value={c.q} onChange={(e) => setCols(cols.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))}
                placeholder={t('admin.collectionQuery')} maxLength={60} className="input" />
              <input value={c.titleEn} onChange={(e) => setCols(cols.map((x, k) => (k === i ? { ...x, titleEn: e.target.value } : x)))}
                placeholder={t('admin.collectionTitleEn')} maxLength={60} dir="ltr" className="input" />
              <input value={c.image} onChange={(e) => setCols(cols.map((x, k) => (k === i ? { ...x, image: e.target.value } : x)))}
                placeholder={t('admin.collectionImage')} dir="ltr" className="input" />
              <button type="button" onClick={() => setCols(cols.filter((_, k) => k !== i))} className="btn-danger !px-3 !py-1.5 text-xs sm:col-span-2 sm:justify-self-start">
                {t('common.delete')}
              </button>
            </div>
          ))
        )}
      </div>

      <button onClick={save} disabled={busy} className="btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </div>
  );
}

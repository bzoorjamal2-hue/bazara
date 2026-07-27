import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { clearCachePrefixes } from '../../utils/apiCache.js';
import Spinner from '../../components/Spinner.jsx';
import BannerEditor from '../../components/BannerEditor.jsx';
import ImageInput from '../../components/ImageInput.jsx';
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
  const [lb, setLb] = useState({ image: '', title: '', titleEn: '', productIds: [] });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/site/banners')
      .then((r) => { setBanners(r.data.banners?.length ? r.data.banners : DEFAULT_SITE_SLIDES); setAnn(r.data.announcement || ''); setAnnEn(r.data.announcementEn || ''); setLb({ image: '', title: '', titleEn: '', productIds: [], ...(r.data.lookbook || {}) }); })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const save = async () => {
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.put('/site/banners', { banners, announcement: ann, announcementEn: annEn, lookbook: lb });
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
      {/* اللوك بوك: صورة إطلالة + أرقام المنتجات الظاهرة فيها (بفواصل) */}
      <div className="glass space-y-3 p-6">
        <div>
          <h2 className="font-display text-lg font-bold text-gold-200">{t('admin.lookbook')}</h2>
          <p className="mt-1 text-xs text-stone-400">{t('admin.lookbookHint')}</p>
        </div>
        <ImageInput value={lb.image} onChange={(v) => setLb({ ...lb, image: v })} />
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

      <button onClick={save} disabled={busy} className="btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </div>
  );
}

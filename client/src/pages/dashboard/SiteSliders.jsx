import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import BannerEditor from '../../components/BannerEditor.jsx';

// تحكّم المدير العام بسلايدر الصفحة الرئيسية للموقع — نفس محرّر بانرات المشتركين.
export default function SiteSliders() {
  const { t } = useTranslation();
  const [banners, setBanners] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/site/banners').then((r) => setBanners(r.data.banners || [])).catch((e) => setError(getErrorMessage(e)));
  }, []);

  const save = async () => {
    setMsg(''); setError(''); setBusy(true);
    try {
      await api.put('/site/banners', { banners });
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
        <h1 className="font-display text-2xl font-bold gradient-text">🖼️ {t('admin.siteSliders')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('admin.siteSlidersHint')}</p>
      </div>
      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{msg}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}
      <div className="glass p-6">
        <BannerEditor banners={banners} onChange={setBanners} />
      </div>
      <button onClick={save} disabled={busy} className="btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </div>
  );
}

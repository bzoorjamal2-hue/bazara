import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { PageHead } from '../../components/FormField.jsx';
import { PaletteIcon, CheckIcon, WarnIcon } from '../../components/icons.jsx';
import AdsManager from './ads/AdsManager.jsx';
import AdBuilder from './ads/AdBuilder.jsx';

// تبويب «مصنع الإعلانات» — شاشتان كما في Ads Manager:
//   • لوحةُ الحملات (ads/AdsManager.jsx): النتائجُ والمصروفُ والحملاتُ وتشغيلُها وإيقافُها؛
//   • بانيةُ الإعلان (ads/AdBuilder.jsx): من قطعةٍ بالمتجرِ إلى حملةٍ كاملةٍ تُنشَرُ موقوفة.
//
// الصورةُ تُرسَمُ بمتصفّحِ التاجرةِ لا على الخادم، فكلُّ محاولةٍ مجّانيّةٌ ولا تمسُّ رصيدَ
// الوسائط. والمحفوظُ بالطابورِ وصفةُ الصورةِ لا الصورةُ نفسُها.

export default function AdStudio() {
  const { t } = useTranslation();
  const [data, setData] = useState(null); // { campaigns, products, store, smart, publishing }
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  // null = لوحةُ الحملات · {} = إعلانٌ جديد · حملة = فتحُها
  const [open, setOpen] = useState(null);

  const load = () => api.get('/ads')
    .then((r) => setData(r.data))
    .catch((e) => setErr(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  // الرسالةُ تختفي وحدَها — وتبقى الأخطاءُ حتى تُقرأ
  useEffect(() => {
    if (!msg) return undefined;
    const id = setTimeout(() => setMsg(''), 4000);
    return () => clearTimeout(id);
  }, [msg]);

  const go = (next) => {
    setOpen(next);
    setErr('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      <PageHead icon={<PaletteIcon className="h-6 w-6" />} title={t('adStudio.title')} hint={t('adStudio.hint')} />

      {err && (
        <p className="flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
          <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {err}
        </p>
      )}
      {msg && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          <CheckIcon className="h-4 w-4 shrink-0" /> {msg}
        </p>
      )}

      {!data ? (
        !err && <div className="dash-section glass p-5"><p className="text-sm text-stone-400">{t('common.loading')}</p></div>
      ) : open ? (
        <AdBuilder
          key={open.id || 'new'}
          data={data}
          campaign={open.id ? open : null}
          onBack={() => go(null)}
          onDone={async () => { await load(); go(null); }}
          setErr={setErr}
          setMsg={setMsg}
        />
      ) : (
        <AdsManager
          data={data}
          onNew={() => go({})}
          onOpen={(c) => go(c)}
          reload={load}
          setErr={setErr}
          setMsg={setMsg}
        />
      )}
    </div>
  );
}

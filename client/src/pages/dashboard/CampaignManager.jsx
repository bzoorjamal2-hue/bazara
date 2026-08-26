import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { getErrorMessage } from '../../api/client.js';
import { MegaphoneIcon, UsersIcon, CheckIcon, StoreIcon, TagIcon, ClockIcon, WarnIcon, BellIcon, CopyIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Field, Tip } from '../../components/FormField.jsx';
import { cldThumb } from '../../utils/cloudinary.js';

// طول العنوان الآمن قبل أن تقصّه شاشة الإشعار على الجوال
const TITLE_SAFE = 50;

// قوالب جاهزة لأكثر أربع حملات شيوعاً بمتجر ملابس — تُعبّئ العنوان والنصّ والوجهة
const TEMPLATES = [
  { key: 'newArrival', emoji: '✨', dest: 'store' },
  { key: 'sale', emoji: '🏷️', dest: 'offers' },
  { key: 'lastChance', emoji: '⏳', dest: 'offers' },
  { key: 'restock', emoji: '🔄', dest: 'store' },
];

// حملة إشعارات المتجر — صاحب المتجر يبعث Push لكل متابِعي متجره (وصل جديد/خصم).
// الجمهور = من فعّلوا "إشعارات المتجر" من صفحة المتجر (زوّار وزبائن، حتى بلا حساب).
export default function CampaignManager() {
  const { t } = useTranslation();
  const { store } = useAuth();
  const [status, setStatus] = useState(null); // { enabled, followers, last, readyAt }
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dest, setDest] = useState('store'); // store | offers
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0); // نبضة دقيقة لعدّاد التهدئة

  const load = () => api.get('/push/campaign').then((r) => setStatus(r.data)).catch(() => setStatus({ enabled: false, followers: 0 }));
  useEffect(() => { load(); }, []);

  // عدّاد التهدئة يتناقص أمام العين بدل رقم جامد يحتاج تحديث الصفحة
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const url = dest === 'offers' ? '/offers' : (store ? `/store/${store.slug}` : '/');
  const ready = title.trim() && body.trim() && !busy;
  // فترة تهدئة نشطة؟
  const cooldownMins = (() => {
    void tick;
    return status?.readyAt ? Math.max(0, Math.ceil((new Date(status.readyAt).getTime() - Date.now()) / 60000)) : 0;
  })();

  const send = async () => {
    setMsg(''); setErr(''); setBusy(true);
    try {
      const r = await api.post('/push/campaign', { title: title.trim(), body: body.trim(), url });
      setMsg(t('campaign.sent', { count: r.data.sent }));
      setTitle(''); setBody(''); setConfirm(false);
      load();
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const followers = status?.followers ?? 0;
  const history = status?.history || [];
  const pushOff = status && !status.enabled;
  const dests = [
    { key: 'store', label: t('campaign.linkStore'), Icon: StoreIcon },
    { key: 'offers', label: t('campaign.linkOffers'), Icon: TagIcon },
  ];
  const blocked = !ready || followers === 0 || cooldownMins > 0 || pushOff;

  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';

  return (
    <div className="space-y-5">
      <PageHead icon={<MegaphoneIcon className="h-6 w-6" />} title={t('campaign.title')} hint={t('campaign.hint')} />

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}
      {err && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{err}</div>}

      {/* جمهورك */}
      <div className={CARD}>
        <SectionHead icon={<UsersIcon className="h-5 w-5" />} title={t('campaign.audienceTitle')} desc={t('campaign.audienceHint')} />

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold-400/15 bg-black/20 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-300"><UsersIcon className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-3xl font-extrabold tabular-nums text-stone-100">{followers}</p>
            <p className="text-xs text-stone-400">{t('campaign.followers')}</p>
          </div>
          {followers === 0 && !pushOff && (
            <p className="w-full text-[11px] leading-relaxed text-stone-400 sm:w-auto sm:max-w-xs">{t('campaign.noFollowers')}</p>
          )}
        </div>

        {pushOff && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300">
            <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('campaign.disabled')}
          </p>
        )}

        {status?.last && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold-400/15 bg-black/20 p-3">
            <span className="flex min-w-0 items-center gap-2 text-xs text-stone-400">
              <BellIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate text-stone-300">{status.last.title}</span>
            </span>
            <span className="shrink-0 rounded-full bg-gold-400/10 px-2.5 py-1 text-[11px] font-bold text-gold-200">
              {t('campaign.lastReach', { count: status.last.sentCount })}
            </span>
          </div>
        )}
      </div>

      {/* المؤلّف */}
      <div id="campaign-compose" className={`${CARD} scroll-mt-[calc(env(safe-area-inset-top,0px)+5rem)]`}>
        <SectionHead icon={<MegaphoneIcon className="h-5 w-5" />} title={t('campaign.composeTitle')} desc={t('campaign.composeHint')} />

        {/* قوالب جاهزة — البدء من صفحة بيضاء أصعب ما بالحملة */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-stone-400">
            {t('campaign.templatesLabel')} <Tip text={t('campaign.templatesTip')} />
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((tp) => (
              <button
                key={tp.key}
                type="button"
                onClick={() => { setTitle(t(`campaign.tpl.${tp.key}.title`)); setBody(t(`campaign.tpl.${tp.key}.body`)); setDest(tp.dest); setConfirm(false); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/5 px-3 py-1.5 text-[11px] font-semibold text-stone-300 transition hover:bg-gold-400/15 hover:text-gold-200"
              >
                <span aria-hidden>{tp.emoji}</span> {t(`campaign.tpl.${tp.key}.name`)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t('campaign.notifTitle')} tip={t('campaign.titleTip')} max={80} value={title} required>
          <input className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('campaign.titlePlaceholder')} />
          {/* الجوال يقصّ العنوان الطويل — ننبّه قبل الإرسال لا بعده */}
          {title.trim().length > TITLE_SAFE && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
              <WarnIcon className="h-3.5 w-3.5 shrink-0" /> {t('campaign.titleLong', { n: TITLE_SAFE })}
            </p>
          )}
        </Field>

        <Field label={t('campaign.notifBody')} tip={t('campaign.bodyTip')} max={160} value={body} required>
          <textarea className="input resize-none" rows={3} maxLength={160} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('campaign.bodyPlaceholder')} />
        </Field>

        <Field label={t('campaign.link')} tip={t('campaign.linkTip')}>
          <div className="grid grid-cols-2 gap-2">
            {dests.map((d) => {
              const on = dest === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDest(d.key)}
                  // ذهب صريح بالهيكس: bg-gold-400 تنقلب بنّية نهاراً وتبقى ذهبية ليلاً
                  // مع نصّ عاجي، فيضعف التباين بأحد الوضعين
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    on ? 'border-[#b09a7e] bg-[#b09a7e] text-[#3f2e22] shadow-sm' : 'border-gold-400/25 text-stone-300 hover:bg-gold-400/10 hover:text-gold-200'
                  }`}
                >
                  <d.Icon className="h-4 w-4" /> {d.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* معاينة حيّة: هيك بيوصل الإشعار لجوال المتابِعة قبل ما تبعثيه */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-stone-400">{t('campaign.previewLabel')}</p>
          <div className="dash-preview flex items-start gap-3 rounded-2xl p-3">
            <span className="dash-avatar grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl">
              {store?.logoUrl
                ? <img src={cldThumb(store.logoUrl, 120)} alt="" className="h-full w-full object-cover" />
                : <StoreIcon className="h-5 w-5 text-stone-500" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <span className="truncate">{store?.name || t('app.name')}</span> · {t('campaign.previewNow')}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-stone-100">{title.trim() || t('campaign.previewTitle')}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-stone-300">{body.trim() || t('campaign.previewBody')}</p>
            </div>
          </div>
        </div>

        {!confirm ? (
          <button disabled={blocked} onClick={() => setConfirm(true)} className="btn-primary w-full gap-2 disabled:opacity-50">
            <MegaphoneIcon className="h-5 w-5" /> {t('campaign.send')}
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-gold-400/25 bg-gold-400/5 p-3">
            <p className="text-center text-sm font-semibold text-stone-200">{t('campaign.confirmCount', { count: followers })}</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={send} className="btn-primary flex-1 gap-2 disabled:opacity-60">
                <CheckIcon className="h-5 w-5" /> {busy ? t('campaign.sending') : t('campaign.send')}
              </button>
              <button disabled={busy} onClick={() => setConfirm(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
            </div>
          </div>
        )}

        {/* سبب تعطّل الزرّ — بلا تخمين */}
        {cooldownMins > 0 && (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-amber-300">
            <ClockIcon className="h-4 w-4" /> {t('campaign.cooldown', { mins: cooldownMins })}
          </p>
        )}
      </div>

      {/* سجلّ الحملات — ماذا أرسلتِ ومتى وكم وصل، كي لا تتكرّر رسالة أو تتقارب حملتان */}
      {history.length > 0 && (
        <div className={CARD}>
          <SectionHead icon={<ClockIcon className="h-5 w-5" />} title={t('campaign.historyTitle')} desc={t('campaign.historyHint')} />
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="rounded-2xl border border-gold-400/15 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-stone-100">{h.title}</p>
                  <span className="shrink-0 rounded-full bg-gold-400/10 px-2.5 py-1 text-[11px] font-bold text-gold-200">
                    {t('campaign.lastReach', { count: h.sentCount })}
                  </span>
                </div>
                {h.body && <p className="mt-1 line-clamp-2 text-[11px] text-stone-400">{h.body}</p>}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-stone-500">{new Date(h.at).toLocaleString()}</span>
                  {/* إعادة استخدام حملة سابقة نجحت — بضغطة بدل إعادة كتابتها */}
                  <button
                    type="button"
                    onClick={() => { setTitle(h.title); setBody(h.body || ''); setConfirm(false); document.getElementById('campaign-compose')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    className="inline-flex items-center gap-1 rounded-full border border-gold-400/25 px-2.5 py-1 text-[10px] font-semibold text-gold-200 transition hover:bg-gold-400/10"
                  >
                    <CopyIcon className="h-3 w-3" /> {t('campaign.reuse')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

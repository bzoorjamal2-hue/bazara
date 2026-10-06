import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../../api/client.js';
import { Tip } from '../../../components/FormField.jsx';
import {
  SparkleIcon, ImageIcon, CheckIcon, WarnIcon, CopyIcon, DownloadIcon,
  XIcon, VideoIcon, PinIcon, ClockIcon, MegaphoneIcon, SearchIcon, HelpIcon,
  BackIcon, ForwardIcon, GridIcon, BagIcon, SendIcon, LinkIcon, UsersIcon, EditIcon,
} from '../../../components/icons.jsx';
import { cldThumb } from '../../../utils/cloudinary.js';
import { copyText, storeUrl, siteOrigin } from '../../../utils/links.js';
import { drawAd, downloadCanvas, AD_SIZES, AD_TEMPLATES } from '../../../utils/adCanvas.js';
import { AD_CITIES, PLACEMENT_KEYS } from '../../../utils/adCities.js';
import AdPreview from './AdPreview.jsx';
import { runChecks, blocking } from './adChecks.js';

// بانيةُ الإعلان — خطواتٌ لا استمارة.
//
// كانت ستُّ بطاقاتٍ فوقَ بعضِها بشاشةٍ واحدة: القطعة والهدف والنصّ والصورة والجمهور والميزانية
// والمعاينة — تمرُّ التاجرةُ بأربعين خانةً قبلَ أن ترى إعلانَها. صارت ستَّ خطواتٍ، كلُّ خطوةٍ
// سؤالٌ واحد، وشريطُ تقدّمٍ فوقها وزرّا «السابق/التالي» تحتها — كما تفعلُ تطبيقاتُ الإعلاناتِ
// الكبيرة. والخطواتُ كلُّها تبقى مركّبةً (مخفيّةً لا محذوفة): لوحةُ رسمِ الصورةِ تعيشُ بخطوةِ
// التصميم، والنشرُ بالخطوةِ الأخيرةِ يرفعُ ما رُسِمَ عليها.
//
// لا شيءَ يُصرَفُ بلا ضغطةِ «شغّليها» من لوحةِ الحملات: النشرُ يُنشئُ الحملةَ موقوفة.

const STEPS = ['piece', 'goal', 'copy', 'design', 'audience', 'launch'];
const GOALS = [
  { k: 'sales', Icon: BagIcon },
  { k: 'messages', Icon: SendIcon },
  { k: 'traffic', Icon: LinkIcon },
  { k: 'awareness', Icon: MegaphoneIcon },
];
const TONES = ['warm', 'luxury', 'playful'];
const SIZES = Object.keys(AD_SIZES);
const BUDGETS = [15, 25, 40, 60, 100];
const DEFAULT_SETTINGS = { format: 'image', placements: [], startAt: '', abTest: false };

export default function AdBuilder({ data, campaign, onDone, onBack, setErr, setMsg }) {
  const { t } = useTranslation();
  const live = Boolean(campaign?.metaCampaignId);
  const publishing = data.publishing || {};

  const [productId, setProductId] = useState(campaign?.productId || '');
  const [goal, setGoal] = useState(campaign?.goal || 'sales');
  const [tone, setTone] = useState('warm');
  const [busy, setBusy] = useState('');
  const [gen, setGen] = useState(campaign
    ? { copies: campaign.copies, audience: campaign.audience, budget: campaign.budget, days: campaign.days, facts: null, usedAi: false }
    : null);
  const [chosen, setChosen] = useState(campaign?.chosen || 0);
  const [creative, setCreative] = useState({ template: 'bold', size: 'square', badge: '', showPrice: true, ...(campaign?.creative || {}) });
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(campaign?.settings || {}) });
  const [editingId, setEditingId] = useState(campaign?.id || '');
  const [imageUrl, setImageUrl] = useState('');
  // حملةٌ محفوظةٌ تُفتَحُ على المعاينة؛ الجديدةُ من أوّلِها
  const [step, setStep] = useState(campaign ? STEPS.length - 1 : 0);
  const canvasRef = useRef(null);
  const topRef = useRef(null);

  const product = useMemo(() => (data.products || []).find((p) => p.id === productId) || null, [data, productId]);
  const copy = gen?.copies?.[chosen];

  // قطعةٌ بفيديو: الفيديو افتراضاً للحملاتِ الجديدة — يبيعُ الملابسَ أكثرَ من أيِّ صورة
  useEffect(() => {
    if (campaign) return;
    setSettings((s) => ({ ...s, format: product?.video ? 'video' : 'image' }));
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i) => {
    setStep(i);
    setErr('');
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const generate = async () => {
    if (!productId) return;
    setBusy('gen'); setErr(''); setMsg('');
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    try {
      const r = await api.post('/ads/generate', { productId, goal, tone });
      setGen((g) => ({ ...r.data, audience: { ...r.data.audience, cities: g?.audience?.cities || [] } }));
      setChosen(0);
      const sale = r.data.facts?.sale;
      setCreative((c) => ({ ...c, badge: sale ? t('adStudio.badgeSale', { n: sale.off }) : t('adStudio.badgeNew') }));
      goTo(2);
    } catch (e) { setErr(getErrorMessage(e)); }
    setBusy('');
  };

  const patchCopy = (i, patch) => setGen((g) => ({ ...g, copies: g.copies.map((c, n) => (n === i ? { ...c, ...patch } : c)) }));

  const body = (status) => ({
    productId: product?.id,
    name: `${product?.name || campaign?.name || ''} — ${t(`adStudio.goal.${goal}`)}`,
    goal, status,
    copies: gen.copies, chosen,
    audience: gen.audience, budget: gen.budget, days: gen.days,
    creative, settings,
  });

  const save = async (status) => {
    if (!gen || !product) return null;
    setBusy(status); setErr(''); setMsg('');
    try {
      let id = editingId;
      if (id) await api.put(`/ads/${id}`, body(status));
      else id = (await api.post('/ads', body(status))).data.id;
      setEditingId(id);
      setBusy('');
      return id;
    } catch (e) { setErr(getErrorMessage(e)); setBusy(''); return null; }
  };

  const saveAndBack = async (status) => {
    if (await save(status)) { setMsg(t('adStudio.saved')); onDone(); }
  };

  // نشرٌ إلى ميتا: حفظٌ أوّلاً ثمّ رفعُ الصورةِ المرسومةِ (وهي غلافُ الفيديو إن كان فيديو).
  // والفيديو تعالجُه ميتا دقيقةً أو اثنتين، فالمهلةُ هنا أطولُ من مهلةِ اللوحةِ العاديّة.
  const publish = async () => {
    const id = await save('ready');
    if (!id) return;
    setBusy('publish'); setErr('');
    try {
      const imageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.92);
      await api.post(`/ads/${id}/publish`, { imageBase64 }, { timeout: 240000 });
      setMsg(t('adStudio.b.publishedOk'));
      onDone();
    } catch (e) {
      setErr(e?.name === 'SecurityError' ? t('adStudio.creative.downloadFailed') : getErrorMessage(e));
    }
    setBusy('');
  };

  const checks = gen ? runChecks({ product, copy, gen, creative, settings, goal, publishing }) : [];
  const blocked = blocking(checks);

  // متى تُفتَحُ كلُّ خطوة: لا نصَّ قبلَ قطعة، ولا تصميمَ قبلَ نصّ
  const reachable = (i) => {
    if (live) return true;
    if (i <= 0) return true;
    if (i === 1) return Boolean(productId);
    return Boolean(gen && copy && productId);
  };
  const isLast = step === STEPS.length - 1;
  const nextOk = step === 0 ? Boolean(productId) : step === 1 ? Boolean(gen) : true;

  return (
    <div className="bz-ad space-y-4" ref={topRef} style={{ scrollMarginTop: 'calc(var(--bz-headline-h, 64px) + 12px)' }}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="bz-ad-link inline-flex items-center gap-1.5 text-[13px] font-bold">
          <BackIcon className="h-4 w-4" /> {t('adStudio.b.back')}
        </button>
        {product && (
          <span className="bz-ad-pickchip inline-flex max-w-[60%] items-center gap-2 rounded-full py-1 pe-3 ps-1">
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full">{product.image ? <img src={cldThumb(product.image, 80)} alt="" className="h-full w-full object-cover" /> : null}</span>
            <span className="truncate text-[12px] font-bold">{product.name}</span>
          </span>
        )}
      </div>

      {/* ═══ شريطُ الخطوات ═══ */}
      <nav className="bz-ad-steps rounded-3xl p-3" aria-label={t('adStudio.w.stepsLabel')}>
        <div className="flex items-baseline justify-between gap-2 px-1">
          <p className="text-[15px] font-extrabold">{t(`adStudio.w.s.${STEPS[step]}.title`)}</p>
          <p className="bz-ad-muted text-[12px] font-bold tabular-nums">{t('adStudio.w.stepOf', { n: step + 1, total: STEPS.length })}</p>
        </div>
        <ol className="mt-3 grid grid-cols-6 gap-1.5">
          {STEPS.map((s, i) => {
            const done = i < step;
            const on = i === step;
            const ok = reachable(i);
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ok && goTo(i)}
                  disabled={!ok}
                  aria-current={on ? 'step' : undefined}
                  className={`bz-ad-step group flex w-full flex-col items-center gap-1.5 ${on ? 'is-on' : ''} ${done ? 'is-done' : ''}`}
                >
                  <span className="bz-ad-step-bar h-1.5 w-full rounded-full" />
                  <span className="bz-ad-step-lbl truncate text-[10.5px] font-bold">{t(`adStudio.w.s.${s}.short`)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {live && (
        <p className="bz-ad-note flex items-start gap-2 rounded-2xl px-4 py-3 text-[13px] font-semibold">
          <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.b.liveNote')}
        </p>
      )}

      {/* ═══ ١ · القطعة ═══ */}
      <section hidden={step !== 0} className="bz-ad-card space-y-3 rounded-3xl p-4">
        <p className="bz-ad-muted text-[13px]">{t('adStudio.w.s.piece.desc')}</p>
        <ProductPicker products={data.products} value={productId} onChange={(id) => { setProductId(id); }} disabled={live} />
      </section>

      {/* ═══ ٢ · الهدف والنبرة ═══ */}
      {busy === 'gen' && <Writing t={t} />}

      <section hidden={step !== 1 || busy === 'gen'} className="space-y-4">
        <div className="bz-ad-card space-y-3 rounded-3xl p-4">
          <p className="flex items-center gap-1.5 text-[14px] font-extrabold">{t('adStudio.w.goalQ')} <Tip text={t('adStudio.b.goalTip')} /></p>
          <div className="grid grid-cols-2 gap-2.5">
            {GOALS.map(({ k, Icon }) => {
              const on = goal === k;
              return (
                <button key={k} type="button" disabled={live} onClick={() => setGoal(k)} aria-pressed={on}
                  className={`bz-ad-goal app-tap flex flex-col items-start gap-2 rounded-2xl p-3.5 text-start ${on ? 'is-on' : ''}`}>
                  <span className="flex w-full items-center justify-between">
                    <span className="bz-ad-goal-ico grid h-10 w-10 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span>
                    <span className={`bz-ad-radio grid h-5 w-5 place-items-center rounded-full ${on ? 'is-on' : ''}`}>{on && <CheckIcon className="h-3 w-3" />}</span>
                  </span>
                  <span className="text-[14px] font-extrabold">{t(`adStudio.goal.${k}`)}</span>
                  <span className="bz-ad-muted text-[11.5px] leading-snug">{t(`adStudio.w.goalShort.${k}`)}</span>
                </button>
              );
            })}
          </div>
          <p className="bz-ad-soft rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed">{t(`adStudio.b.goalWhat.${goal}`)}</p>
        </div>

        <div className="bz-ad-card space-y-3 rounded-3xl p-4">
          <p className="flex items-center gap-1.5 text-[14px] font-extrabold">{t('adStudio.w.toneQ')} <Tip text={t('adStudio.tone.tip')} /></p>
          <div className="grid grid-cols-3 gap-2">
            {TONES.map((k) => (
              <button key={k} type="button" disabled={live} onClick={() => setTone(k)} aria-pressed={tone === k}
                className={`bz-ad-chip app-tap flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center ${tone === k ? 'is-on' : ''}`}>
                <span className="text-lg" aria-hidden>{{ warm: '🤍', luxury: '✨', playful: '🎈' }[k]}</span>
                <span className="text-[12px] font-bold leading-tight">{t(`adStudio.tone.${k}`)}</span>
              </button>
            ))}
          </div>
          {!data.smart && (
            <p className="bz-ad-note flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed">
              <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.freeMode')}
            </p>
          )}
        </div>

      </section>

      {gen && copy && (
        <>
          {/* ═══ ٣ · النصّ ═══ */}
          <section hidden={step !== 2} className="space-y-4">
            <div className="space-y-2.5">
              {gen.copies.map((c, i) => {
                const on = chosen === i;
                return (
                  <button key={i} type="button" onClick={() => setChosen(i)} aria-pressed={on}
                    className={`bz-ad-variant app-tap block w-full rounded-3xl p-4 text-start ${on ? 'is-on' : ''}`}>
                    <span className="flex items-center gap-2.5">
                      <span className={`bz-ad-radio grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? 'is-on' : ''}`}>{on && <CheckIcon className="h-3 w-3" />}</span>
                      <span className="bz-ad-muted text-[11px] font-extrabold">{t('adStudio.copy.n', { n: i + 1 })}</span>
                    </span>
                    <span className="mt-2 block text-[15px] font-extrabold leading-snug">{c.headline}</span>
                    <span className="bz-ad-muted mt-1.5 line-clamp-3 block whitespace-pre-wrap text-[12.5px] leading-relaxed">{c.primary}</span>
                  </button>
                );
              })}
            </div>

            <div className="bz-ad-card space-y-3 rounded-3xl p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-extrabold"><EditIcon className="h-4 w-4" /> {t('adStudio.w.editChosen', { n: chosen + 1 })}</p>
              <label className="block">
                <span className="bz-ad-muted flex items-center justify-between text-[12px] font-bold">
                  <span className="flex items-center gap-1.5">{t('adStudio.copy.headline')} <Tip text={t('adStudio.copy.headlineTip')} /></span>
                  <span className={`tabular-nums ${copy.headline.length > 40 ? 'bz-ad-warn-t' : ''}`}>{copy.headline.length}/60</span>
                </span>
                <input className="bz-ad-input mt-1 w-full rounded-xl px-3.5 py-2.5 text-[14px] font-bold" maxLength={60} value={copy.headline} disabled={live} onChange={(e) => patchCopy(chosen, { headline: e.target.value })} />
              </label>
              <label className="block">
                <span className="bz-ad-muted flex items-center justify-between text-[12px] font-bold">
                  <span className="flex items-center gap-1.5">{t('adStudio.copy.primary')} <Tip text={t('adStudio.copy.primaryTip')} /></span>
                  <span className="tabular-nums">{copy.primary.length}/600</span>
                </span>
                <textarea className="bz-ad-input mt-1 w-full resize-none rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed" rows={6} maxLength={600} value={copy.primary} disabled={live} onChange={(e) => patchCopy(chosen, { primary: e.target.value })} />
              </label>
              {copy.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {copy.hashtags.map((h, i) => <span key={i} className="bz-ad-tag rounded-full px-2.5 py-1 text-[11.5px] font-bold" dir="auto">{h}</span>)}
                </div>
              )}
              <CopyButton text={`${copy.primary}\n\n${(copy.hashtags || []).join(' ')}`.trim()} label={t('adStudio.copy.copyAll')} done={t('common.copied')} />
            </div>

            {gen.copies.length > 1 && (
              <Toggle on={settings.abTest} disabled={live} onChange={(v) => setSettings((s) => ({ ...s, abTest: v }))}
                label={t('adStudio.b.abTest')} hint={t('adStudio.b.abTestHint')} />
            )}
            {!live && (
              <button type="button" onClick={() => goTo(1)} className="bz-ad-link mx-auto flex items-center gap-1.5 text-[12.5px] font-bold">
                <SparkleIcon className="h-4 w-4" /> {t('adStudio.w.rewrite')}
              </button>
            )}
          </section>

          {/* ═══ ٤ · التصميم ═══ */}
          <section hidden={step !== 3}>
            <CreativeCard
              product={product} store={data.store} headline={copy.headline} sub={copy.cta} facts={gen.facts}
              creative={creative} setCreative={setCreative} settings={settings} setSettings={setSettings}
              canvasRef={canvasRef} onRendered={setImageUrl} onError={setErr} live={live}
            />
          </section>

          {/* ═══ ٥ · الجمهور والميزانية ═══ */}
          <section hidden={step !== 4} className="space-y-4">
            <AudienceCard gen={gen} setGen={setGen} goal={goal} settings={settings} setSettings={setSettings} publishing={publishing} live={live} />
            <BudgetCard gen={gen} setGen={setGen} settings={settings} setSettings={setSettings} currency={publishing.currency} live={live} />
          </section>

          {/* ═══ ٦ · المعاينة والنشر ═══ */}
          <section hidden={step !== 5} className="space-y-4">
            <Summary t={t} product={product} copy={copy} goal={goal} gen={gen} settings={settings} goTo={goTo} live={live} />

            <div className="bz-ad-card rounded-3xl p-4">
              <AdPreview
                goal={goal} format={settings.format} size={creative.size}
                image={imageUrl || (product?.image ? cldThumb(product.image, 720) : '')}
                video={product?.video} copy={copy} store={data.store}
                igHandle={data.store?.igUsername}
                link={product ? `${siteOrigin()}/store/${data.store?.slug}/product/${product.id}` : storeUrl(data.store?.slug || '')}
              />
            </div>

            <div className="bz-ad-card space-y-3 rounded-3xl p-4">
              <p className="text-[14px] font-extrabold">{t('adStudio.chk.title')}</p>
              {checks.length === 0 ? (
                <p className="bz-ad-ok flex items-center gap-2 rounded-2xl px-3.5 py-3 text-[13px] font-bold"><CheckIcon className="h-4 w-4" /> {t('adStudio.chk.allGood')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {checks.map((c) => (
                    <li key={c.key} className={`bz-ad-chk is-${c.level} flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed`}>
                      {c.level === 'tip' ? <HelpIcon className="mt-px h-4 w-4 shrink-0" /> : <WarnIcon className="mt-px h-4 w-4 shrink-0" />}
                      <span>{t(`adStudio.chk.${c.key}`, c.params)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!live && (
              <div className="bz-ad-card space-y-2.5 rounded-3xl p-4">
                {publishing.enabled && (
                  <>
                    <button onClick={publish} disabled={Boolean(busy) || blocked || !publishing.accountId} className="bz-ad-primary app-tap flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-extrabold disabled:opacity-50">
                      <MegaphoneIcon className="h-5 w-5" /> {busy === 'publish' ? t('adStudio.b.publishing') : t('adStudio.b.publish')}
                    </button>
                    <p className="bz-ad-muted text-center text-[11.5px] leading-relaxed">{t(publishing.accountId ? 'adStudio.b.publishTip' : 'adStudio.b.needAccount')}</p>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => saveAndBack('ready')} disabled={Boolean(busy)} className={`${publishing.enabled ? 'bz-ad-ghost' : 'bz-ad-primary'} app-tap flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-extrabold disabled:opacity-50`}>
                    <CheckIcon className="h-4 w-4" /> {editingId ? t('adStudio.update') : t('adStudio.saveReady')}
                  </button>
                  <button onClick={() => saveAndBack('draft')} disabled={Boolean(busy)} className="bz-ad-ghost app-tap rounded-2xl py-3 text-[13px] font-bold disabled:opacity-50">{t('adStudio.saveDraft')}</button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ═══ السابق / التالي — تحتَ الإبهام ═══ */}
      <div className="bz-ad-navbar sticky z-30 flex items-center gap-2 rounded-2xl p-2" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}>
        <button type="button" onClick={() => (step ? goTo(step - 1) : onBack())} className="bz-ad-ghost app-tap flex h-12 items-center gap-1 rounded-xl px-4 text-[13px] font-bold">
          <BackIcon className="h-4 w-4" /> {step ? t('adStudio.w.prev') : t('adStudio.w.cancel')}
        </button>
        {step === 1 && !live ? (
          <button type="button" onClick={generate} disabled={!productId || Boolean(busy)} className="bz-ad-primary app-tap flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold disabled:opacity-50">
            <SparkleIcon className="h-5 w-5" /> {busy === 'gen' ? t('adStudio.generating') : gen ? t('adStudio.b.regenerate') : t('adStudio.w.writeIt')}
          </button>
        ) : !isLast ? (
          <button type="button" onClick={() => goTo(step + 1)} disabled={!nextOk || !reachable(step + 1)} className="bz-ad-primary app-tap flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold disabled:opacity-50">
            {t(`adStudio.w.next.${STEPS[step + 1]}`)} <ForwardIcon className="h-4 w-4" />
          </button>
        ) : (
          <span className="bz-ad-muted flex-1 text-center text-[12px] font-semibold">{live ? t('adStudio.w.liveEnd') : t('adStudio.w.lastHint')}</span>
        )}
      </div>
    </div>
  );
}

// ───────────────────── «عم نكتب…» ─────────────────────
function Writing({ t }) {
  return (
    <div className="bz-ad-writing space-y-3 rounded-3xl p-4" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-[13px] font-extrabold"><SparkleIcon className="bz-ad-spin h-4 w-4" /> {t('adStudio.w.writing')}</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5">
          <span className="bz-ad-shimmer block h-3.5 w-2/3 rounded-full" />
          <span className="bz-ad-shimmer block h-2.5 w-full rounded-full" />
          <span className="bz-ad-shimmer block h-2.5 w-5/6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ───────────────────── ملخّصُ الحملةِ قبلَ النشر ─────────────────────
function Summary({ t, product, copy, goal, gen, settings, goTo, live }) {
  const a = gen.audience || {};
  const rows = [
    { k: 'goal', step: 1, v: t(`adStudio.goal.${goal}`) },
    { k: 'copy', step: 2, v: copy.headline },
    { k: 'design', step: 3, v: t(settings.format === 'video' ? 'adStudio.b.fmtVideo' : 'adStudio.b.fmtImage') },
    { k: 'audience', step: 4, v: `${t(`adStudio.target.g.${a.genders || 'female'}`)} · ${a.ageMin ?? 18}–${a.ageMax ?? 45} · ${(a.cities || []).length ? a.cities.slice(0, 2).join('، ') + ((a.cities.length > 2) ? ` +${a.cities.length - 2}` : '') : t('adStudio.b.allPalestine')}` },
    { k: 'budget', step: 4, v: t('adStudio.w.budgetLine', { per: gen.budget, days: gen.days, total: (Number(gen.budget) || 0) * (Number(gen.days) || 0) }) },
  ];
  return (
    <div className="bz-ad-card overflow-hidden rounded-3xl">
      <div className="flex items-center gap-3 p-4">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl">{product?.image ? <img src={cldThumb(product.image, 160)} alt="" className="h-full w-full object-cover" /> : null}</span>
        <div className="min-w-0 flex-1">
          <p className="bz-ad-muted text-[11px] font-bold">{t('adStudio.w.summary')}</p>
          <p className="truncate text-[15px] font-extrabold">{product?.name}</p>
        </div>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.k} className="bz-ad-row flex items-center gap-3 px-4 py-2.5">
            <span className="bz-ad-muted w-20 shrink-0 text-[12px] font-bold">{r.k === 'budget' ? t('adStudio.w.budgetShort') : t(`adStudio.w.s.${r.k}.short`)}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{r.v}</span>
            {!live && <button type="button" onClick={() => goTo(r.step)} className="bz-ad-link shrink-0 text-[12px] font-bold">{t('adStudio.w.change')}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────── القطعة ─────────────────────
function ProductPicker({ products, value, onChange, disabled }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = s ? products.filter((p) => p.name.toLowerCase().includes(s)) : products;
    // القطعةُ المختارةُ تبقى ظاهرةً ولو لم تطابقِ البحث
    const picked = products.find((p) => p.id === value);
    const top = all.slice(0, 24);
    return picked && !top.includes(picked) ? [picked, ...top.slice(0, 23)] : top;
  }, [products, q, value]);

  if (!products.length) return <p className="bz-ad-muted py-6 text-center text-sm">{t('adStudio.pick.empty')}</p>;
  return (
    <div className="space-y-3">
      {products.length > 6 && (
        <label className="bz-ad-input flex items-center gap-2 rounded-xl px-3">
          <SearchIcon className="h-4 w-4 shrink-0 opacity-50" />
          <input className="w-full bg-transparent py-2.5 text-sm outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('adStudio.b.searchProduct')} />
        </label>
      )}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {list.map((p) => {
          const on = p.id === value;
          return (
            <button key={p.id} type="button" disabled={disabled} onClick={() => onChange(p.id)} aria-pressed={on}
              className={`bz-ad-piece app-tap group relative overflow-hidden rounded-2xl text-start disabled:cursor-default ${on ? 'is-on' : ''}`}>
              <span className="relative block aspect-[4/5] w-full overflow-hidden">
                {p.image
                  ? <img src={cldThumb(p.image, 300)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  : <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-5 w-5 opacity-40" /></span>}
                {p.video && <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9.5px] font-bold text-white"><VideoIcon className="h-3 w-3" /></span>}
                <span className={`bz-ad-piece-check absolute end-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full ${on ? 'is-on' : ''}`}>{on && <CheckIcon className="h-3.5 w-3.5" />}</span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-white">
                  <span className="block truncate text-[11px] font-bold">{p.name}</span>
                  <span className="block text-[10.5px] font-bold tabular-nums opacity-90">₪{p.price}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// رسمٌ تخطيطيٌّ لكلِّ قالب — يُرى الفرقُ قبلَ الضغط
function TemplateGlyph({ k }) {
  return (
    <svg viewBox="0 0 40 40" className="h-12 w-12" aria-hidden="true">
      {k === 'bold' && (<><rect x="2" y="2" width="36" height="36" rx="6" className="bz-ad-g-img" /><rect x="7" y="24" width="20" height="3.5" rx="1.5" className="bz-ad-g-ink-on" /><rect x="7" y="30" width="12" height="3" rx="1.5" className="bz-ad-g-ink-on" opacity=".7" /></>)}
      {k === 'soft' && (<><rect x="2" y="2" width="36" height="36" rx="6" className="bz-ad-g-panel" /><rect x="2" y="2" width="36" height="22" rx="6" className="bz-ad-g-img" /><rect x="8" y="28" width="22" height="3" rx="1.5" className="bz-ad-g-ink" /><rect x="8" y="33" width="14" height="2.5" rx="1.25" className="bz-ad-g-ink" opacity=".6" /></>)}
      {k === 'split' && (<><rect x="2" y="2" width="36" height="36" rx="6" className="bz-ad-g-panel" /><rect x="20" y="2" width="18" height="36" rx="6" className="bz-ad-g-img" /><rect x="5" y="13" width="12" height="3" rx="1.5" className="bz-ad-g-ink" /><rect x="5" y="19" width="9" height="5" rx="1.5" className="bz-ad-g-ink" /><rect x="5" y="27" width="10" height="2.5" rx="1.25" className="bz-ad-g-ink" opacity=".6" /></>)}
    </svg>
  );
}
const SIZE_BOX = { square: [26, 26], story: [18, 32], wide: [34, 18] };

// ───────────────────── التصميم ─────────────────────
function CreativeCard({ product, store, headline, sub, facts, creative, setCreative, settings, setSettings, canvasRef, onRendered, onError, live }) {
  const { t } = useTranslation();
  const [drawing, setDrawing] = useState(false);
  const isVideo = settings.format === 'video';

  const recipe = useMemo(() => ({
    image: product?.image || '',
    logo: store?.logo || '',
    template: creative.template,
    size: creative.size,
    headline, sub,
    price: product?.price ?? 0,
    oldPrice: facts?.sale ? facts.sale.old : (product?.oldPrice || null),
    badge: creative.badge,
    showPrice: creative.showPrice,
    storeName: store?.name || '',
    url: storeUrl(store?.slug || '').replace(/^https?:\/\//, ''),
    accent: '#1F1E1D',
  }), [product, store, headline, sub, facts, creative]);

  // إعادةُ الرسمِ عند كلِّ تغيير — مؤجّلةٌ قليلاً كي لا تُرسَمَ اللوحةُ مع كلِّ حرف.
  // والصورةُ تصعدُ للمعاينة؛ لوحةٌ ملوّثةٌ لا تُصدَّرُ فتبقى المعاينةُ على صورةِ القطعة.
  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      if (!canvasRef.current) return;
      setDrawing(true);
      try {
        await drawAd(canvasRef.current, recipe);
        if (alive) onRendered(canvasRef.current.toDataURL('image/jpeg', 0.8));
      } catch { /* الرسمُ لا يُسقطُ الصفحة */ }
      if (alive) setDrawing(false);
    }, 220);
    return () => { alive = false; clearTimeout(id); };
  }, [recipe]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    try {
      await downloadCanvas(canvasRef.current, `${(store?.name || 'bazara').replace(/\s+/g, '-')}-${creative.size}.jpg`);
    } catch { onError(t('adStudio.creative.downloadFailed')); }
  };

  const pick = (k, v) => setCreative((c) => ({ ...c, [k]: v }));
  const badges = [
    facts?.sale ? t('adStudio.badgeSale', { n: facts.sale.off }) : null,
    t('adStudio.badgeNew'), t('adStudio.w.badgeHot'), t('adStudio.w.badgeLimited'),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* اللوحةُ أوّلاً وكبيرةً: هي ما سيراه الناس */}
      <div className="bz-ad-stage relative flex justify-center rounded-3xl p-5">
        <canvas ref={canvasRef} className={`h-auto w-full max-w-[300px] rounded-2xl shadow-xl transition-opacity ${drawing ? 'opacity-60' : 'opacity-100'}`} />
        {isVideo && <span className="absolute start-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white"><VideoIcon className="h-3.5 w-3.5" /> {t('adStudio.b.coverCaption')}</span>}
      </div>

      <div className="bz-ad-card space-y-4 rounded-3xl p-4">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold">{t('adStudio.b.format')} <Tip text={t('adStudio.b.formatTip')} /></p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={live} onClick={() => setSettings((s) => ({ ...s, format: 'image' }))} className={`bz-ad-chip app-tap flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold ${!isVideo ? 'is-on' : ''}`}>
              <ImageIcon className="h-4 w-4" /> {t('adStudio.b.fmtImage')}
            </button>
            <button type="button" disabled={live || !product?.video} onClick={() => setSettings((s) => ({ ...s, format: 'video' }))} className={`bz-ad-chip app-tap flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold disabled:opacity-40 ${isVideo ? 'is-on' : ''}`}>
              <VideoIcon className="h-4 w-4" /> {t('adStudio.b.fmtVideo')}
            </button>
          </div>
          <p className="bz-ad-muted mt-1.5 text-[11.5px]">{isVideo ? t('adStudio.b.videoNote') : !product?.video ? t('adStudio.b.noVideo') : t('adStudio.w.videoAvail')}</p>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold">{t(isVideo ? 'adStudio.b.coverTemplate' : 'adStudio.creative.template')} <Tip text={t('adStudio.creative.templateTip')} /></p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {AD_TEMPLATES.map((k) => (
              <button key={k} type="button" onClick={() => pick('template', k)} aria-pressed={creative.template === k}
                className={`bz-ad-chip app-tap flex flex-col items-center gap-1.5 rounded-2xl py-3 ${creative.template === k ? 'is-on' : ''}`}>
                <TemplateGlyph k={k} />
                <span className="text-[12px] font-bold">{t(`adStudio.creative.tpl.${k}`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold">{t('adStudio.creative.size')} <Tip text={t('adStudio.creative.sizeTip')} /></p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SIZES.map((k) => {
              const [w, h] = SIZE_BOX[k] || [26, 26];
              return (
                <button key={k} type="button" onClick={() => pick('size', k)} aria-pressed={creative.size === k}
                  className={`bz-ad-chip app-tap flex flex-col items-center gap-1.5 rounded-2xl py-3 ${creative.size === k ? 'is-on' : ''}`}>
                  <span className="grid h-9 place-items-center"><span className="bz-ad-sizebox block rounded-[4px]" style={{ width: w, height: h }} /></span>
                  <span className="text-[12px] font-bold">{t(`adStudio.creative.sz.${k}`)}</span>
                  <span className="bz-ad-muted text-[10px] font-bold tabular-nums" dir="ltr">{AD_SIZES[k].ar}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold">{t('adStudio.creative.badge')} <Tip text={t('adStudio.creative.badgeTip')} /></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => pick('badge', '')} className={`bz-ad-chip app-tap rounded-full px-3 py-1.5 text-[12px] font-bold ${!creative.badge ? 'is-on' : ''}`}>{t('adStudio.w.noBadge')}</button>
            {badges.map((b) => (
              <button key={b} type="button" onClick={() => pick('badge', b)} className={`bz-ad-chip app-tap rounded-full px-3 py-1.5 text-[12px] font-bold ${creative.badge === b ? 'is-on' : ''}`}>{b}</button>
            ))}
          </div>
          <input className="bz-ad-input mt-2 w-full rounded-xl px-3.5 py-2.5 text-[13px]" maxLength={24} value={creative.badge} placeholder={t('adStudio.w.badgeCustom')} onChange={(e) => pick('badge', e.target.value)} />
        </div>

        <Toggle on={creative.showPrice} onChange={(v) => pick('showPrice', v)} label={t('adStudio.creative.showPrice')} />

        <button onClick={download} className="bz-ad-ghost app-tap flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold">
          <DownloadIcon className="h-4 w-4" /> {t('adStudio.creative.download')}
        </button>
      </div>
    </div>
  );
}

// ───────────────────── الجمهور ─────────────────────
function AudienceCard({ gen, setGen, goal, settings, setSettings, publishing, live }) {
  const { t } = useTranslation();
  const a = gen.audience || {};
  const setA = (patch) => setGen((g) => ({ ...g, audience: { ...g.audience, ...patch } }));
  const [est, setEst] = useState(null);
  const [estBusy, setEstBusy] = useState(false);
  const auto = !(settings.placements || []).length;

  // أيُّ تغييرٍ بالجمهورِ يُبطلُ الرقمَ القديم — رقمٌ لجمهورٍ آخرَ أخطرُ من لا رقم
  useEffect(() => { setEst(null); }, [a.ageMin, a.ageMax, a.genders, a.cities, a.interests, settings.placements, goal]);

  const estimate = async () => {
    setEstBusy(true);
    try {
      const r = await api.post('/ads/estimate', { goal, audience: a, settings });
      setEst(r.data);
    } catch { setEst({ available: false }); }
    setEstBusy(false);
  };

  const togglePlacement = (k) => setSettings((s) => {
    const cur = s.placements || [];
    return { ...s, placements: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] };
  });

  return (
    <div className="bz-ad-card space-y-5 rounded-3xl p-4">
      <p className="flex items-center gap-2 text-[14px] font-extrabold"><UsersIcon className="h-5 w-5" /> {t('adStudio.w.whoSees')}</p>

      <div>
        <p className="bz-ad-muted flex items-center gap-1.5 text-[12px] font-bold">{t('adStudio.target.genders')} <Tip text={t('adStudio.target.gendersTip')} /></p>
        <div className="bz-ad-seg mt-1.5 grid grid-cols-3 gap-1 rounded-2xl p-1">
          {['female', 'male', 'all'].map((k) => (
            <button key={k} type="button" disabled={live} onClick={() => setA({ genders: k })} aria-pressed={(a.genders || 'female') === k}
              className={`bz-ad-segbtn rounded-xl py-2 text-[13px] font-bold ${(a.genders || 'female') === k ? 'is-on' : ''}`}>{t(`adStudio.target.g.${k}`)}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="bz-ad-muted flex items-center gap-1.5 text-[12px] font-bold">{t('adStudio.target.age')} <Tip text={t('adStudio.target.ageTip')} /></p>
        <div className="mt-1.5 flex items-center gap-2">
          <label className="bz-ad-input flex flex-1 items-center gap-2 rounded-xl px-3">
            <span className="bz-ad-muted text-[11px] font-bold">{t('adStudio.w.from')}</span>
            <input type="number" min="18" max="65" disabled={live} className="w-full bg-transparent py-2.5 text-center text-[15px] font-extrabold tabular-nums outline-none" value={a.ageMin ?? 18} onChange={(e) => setA({ ageMin: Number(e.target.value) })} />
          </label>
          <span className="bz-ad-muted">—</span>
          <label className="bz-ad-input flex flex-1 items-center gap-2 rounded-xl px-3">
            <span className="bz-ad-muted text-[11px] font-bold">{t('adStudio.w.to')}</span>
            <input type="number" min="18" max="65" disabled={live} className="w-full bg-transparent py-2.5 text-center text-[15px] font-extrabold tabular-nums outline-none" value={a.ageMax ?? 45} onChange={(e) => setA({ ageMax: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      <CityPicker values={a.cities || []} onChange={(v) => setA({ cities: v })} disabled={live} />

      <InterestInput values={a.interests || []} onChange={(v) => setA({ interests: v })} suggest={publishing.enabled} disabled={live} />

      <div>
        <p className="bz-ad-muted mb-1.5 flex items-center gap-1.5 text-[12px] font-bold">{t('adStudio.b.placements')} <Tip text={t('adStudio.b.placementsTip')} /></p>
        <Toggle on={auto} disabled={live} onChange={(v) => setSettings((s) => ({ ...s, placements: v ? [] : ['ig_feed', 'ig_story', 'ig_reels', 'fb_feed'] }))}
          label={t('adStudio.b.autoPlacements')} hint={t('adStudio.b.autoPlacementsHint')} />
        {!auto && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PLACEMENT_KEYS.map((k) => (
              <button key={k} type="button" disabled={live} onClick={() => togglePlacement(k)} className={`bz-ad-chip app-tap rounded-xl py-2.5 text-[12px] font-bold ${settings.placements.includes(k) ? 'is-on' : ''}`}>
                {t(`adStudio.b.pl.${k}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {publishing.enabled && (
        <div className="bz-ad-soft flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3.5">
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold"><GridIcon className="h-4 w-4" /> {t('adStudio.b.estTitle')}</span>
          {est?.available && est.lower ? (
            <span className="text-[16px] font-extrabold tabular-nums" dir="ltr">{compact(est.lower)} – {compact(est.upper)}</span>
          ) : (
            <button type="button" onClick={estimate} disabled={estBusy} className="bz-ad-ghost app-tap rounded-xl px-3 py-1.5 text-[12px] font-bold">
              {estBusy ? t('common.loading') : est ? t('adStudio.b.estFail') : t('adStudio.b.estBtn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

function CityPicker({ values, onChange, disabled }) {
  const { t } = useTranslation();
  const groups = ['wb', 'quds', 'dakhel'];
  const toggle = (ar) => onChange(values.includes(ar) ? values.filter((x) => x !== ar) : [...values, ar].slice(0, 15));
  return (
    <div>
      <p className="bz-ad-muted flex items-center gap-1.5 text-[12px] font-bold">{t('adStudio.target.locations')} <Tip text={t('adStudio.b.citiesTip')} /></p>
      <button type="button" disabled={disabled} onClick={() => onChange([])} className={`bz-ad-chip app-tap mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold ${!values.length ? 'is-on' : ''}`}>
        <PinIcon className="h-4 w-4" /> {t('adStudio.b.allPalestine')}
      </button>
      {groups.map((g) => (
        <div key={g} className="mt-2.5">
          <p className="bz-ad-muted mb-1 text-[10.5px] font-extrabold">{t(`adStudio.b.grp.${g}`)}</p>
          <div className="flex flex-wrap gap-1.5">
            {AD_CITIES.filter((c) => c.group === g).map((c) => {
              const on = values.includes(c.ar);
              return (
                <button key={c.ar} type="button" disabled={disabled} onClick={() => toggle(c.ar)} aria-pressed={on}
                  className={`bz-ad-chip app-tap rounded-full px-3 py-1.5 text-[12px] font-bold ${on ? 'is-on' : ''}`}>
                  {c.ar}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// اهتماماتٌ بكلماتٍ حرّة، ومعها اقتراحاتُ ميتا وحجمُ جمهورِ كلِّ اقتراحٍ حين يكونُ النشرُ مفعّلاً
function InterestInput({ values, onChange, suggest, disabled }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    const q = text.trim();
    if (!suggest || q.length < 2) { setItems([]); return undefined; }
    const id = setTimeout(() => {
      api.get(`/ads/interests?q=${encodeURIComponent(q)}`).then((r) => setItems(r.data.items || [])).catch(() => setItems([]));
    }, 350);
    return () => clearTimeout(id);
  }, [text, suggest]);

  const add = (v0) => {
    const v = String(v0 || text).trim();
    if (v && !values.includes(v) && values.length < 12) onChange([...values, v]);
    setText(''); setItems([]);
  };

  return (
    <div>
      <p className="bz-ad-muted flex items-center gap-1.5 text-[12px] font-bold">{t('adStudio.target.interests')} <Tip text={t('adStudio.target.interestsTip')} /></p>
      <div className="relative mt-1.5">
        <div className="flex gap-2">
          <input className="bz-ad-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-[13px]" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={t('adStudio.target.chipPlaceholder')} />
          <button type="button" disabled={disabled} onClick={() => add()} className="bz-ad-ghost app-tap shrink-0 rounded-xl px-4 text-[12.5px] font-bold">{t('common.add')}</button>
        </div>
        {items.length > 0 && (
          <div className="bz-ad-pop absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-2xl p-1">
            {items.map((it) => (
              <button key={it.id} type="button" onClick={() => add(it.name)} className="bz-ad-popitem flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-[12.5px]">
                <span className="truncate">{it.name}</span>
                {it.size && <span className="bz-ad-muted shrink-0 tabular-nums">{compact(it.size)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="bz-ad-tag inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold">
              {v}
              {!disabled && (
                <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-60 transition hover:opacity-100" aria-label={t('common.delete')}>
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────── الميزانية والموعد ─────────────────────
function BudgetCard({ gen, setGen, settings, setSettings, currency, live }) {
  const { t, i18n } = useTranslation();
  const budget = Number(gen.budget) || 0;
  const days = Number(gen.days) || 0;
  const total = budget * days;
  const local = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const end = settings.startAt ? new Date(new Date(settings.startAt).getTime() + days * 86400000) : null;
  const lang = i18n.language === 'en' ? 'en-GB' : 'ar-PS-u-nu-latn';

  return (
    <div className="bz-ad-card space-y-5 rounded-3xl p-4">
      <p className="flex items-center gap-2 text-[14px] font-extrabold">{t('adStudio.w.howMuch')} <Tip text={t('adStudio.target.budgetTip')} /></p>

      {/* المجموعُ كبيراً: هو ما سيخرجُ من الحساب */}
      <div className="bz-ad-total rounded-3xl p-4 text-center">
        <p className="text-[12px] font-bold opacity-80">{t('adStudio.target.total')}</p>
        <p className="font-display text-[40px] font-extrabold leading-tight tabular-nums">₪{total.toLocaleString('en-US')}</p>
        <p className="text-[12.5px] font-semibold opacity-85">{t('adStudio.w.perDayTimes', { per: budget, days })}</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <p className="bz-ad-muted text-[12px] font-bold">{t('adStudio.w.perDay')}</p>
          <p className="text-[18px] font-extrabold tabular-nums">₪{budget}</p>
        </div>
        <input type="range" min="5" max="200" step="5" disabled={live} value={Math.min(200, Math.max(5, budget))} onChange={(e) => setGen((g) => ({ ...g, budget: Number(e.target.value) }))} className="bz-ad-range mt-2 w-full" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BUDGETS.map((v) => (
            <button key={v} type="button" disabled={live} onClick={() => setGen((g) => ({ ...g, budget: v }))}
              className={`bz-ad-chip app-tap rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums ${budget === v ? 'is-on' : ''}`}>₪{v}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <p className="bz-ad-muted flex items-center gap-1.5 text-[12px] font-bold">{t('adStudio.target.days')} <Tip text={t('adStudio.target.daysTip')} /></p>
          <p className="text-[18px] font-extrabold tabular-nums">{t('adStudio.daysN', { n: days })}</p>
        </div>
        <input type="range" min="1" max="30" step="1" disabled={live} value={Math.min(30, Math.max(1, days))} onChange={(e) => setGen((g) => ({ ...g, days: Number(e.target.value) }))} className="bz-ad-range mt-2 w-full" />
      </div>

      <div>
        <p className="bz-ad-muted flex items-center gap-1.5 text-[12px] font-bold">{t('adStudio.b.start')} <Tip text={t('adStudio.b.startTip')} /></p>
        <input type="datetime-local" disabled={live} className="bz-ad-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-[13px] tabular-nums" value={local(settings.startAt)}
          onChange={(e) => setSettings((s) => ({ ...s, startAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
        <p className="bz-ad-muted mt-1.5 flex items-center gap-1.5 text-[11.5px]">
          <ClockIcon className="h-3.5 w-3.5" />
          {end ? t('adStudio.b.runsUntil', { date: end.toLocaleDateString(lang, { day: 'numeric', month: 'long' }) }) : t('adStudio.b.runsSoon', { n: days })}
        </p>
      </div>

      <p className="bz-ad-muted text-[11.5px] leading-relaxed">{t('adStudio.target.totalTip')}</p>
      {currency && currency !== 'ILS' && (
        <p className="bz-ad-note flex items-start gap-2 rounded-xl px-3 py-2 text-[11.5px] font-semibold"><WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.b.currencyWarn', { cur: currency })}</p>
      )}
    </div>
  );
}

// ───────────────────── أدوات ─────────────────────
function Toggle({ on, onChange, label, hint, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`bz-ad-toggle flex w-full items-center gap-3 rounded-2xl p-3.5 text-start transition disabled:opacity-60 ${on ? 'is-on' : ''}`}
    >
      <span className="bz-ad-switch relative h-6 w-11 shrink-0 rounded-full transition">
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'start-6' : 'start-1'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{label}</span>
        {hint && <span className="bz-ad-muted mt-0.5 block text-[11.5px] leading-relaxed">{hint}</span>}
      </span>
    </button>
  );
}

function CopyButton({ text, label, done }) {
  const [ok, setOk] = useState(false);
  const click = async () => {
    if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 2000); }
  };
  return (
    <button onClick={click} className="bz-ad-ghost app-tap flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-[12.5px] font-bold">
      {ok ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />} {ok ? done : label}
    </button>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../../api/client.js';
import Select from '../../../components/Select.jsx';
import { SectionHead, Field, Tip } from '../../../components/FormField.jsx';
import {
  SparkleIcon, ImageIcon, UsersIcon, CashIcon, CheckIcon, WarnIcon, CopyIcon, DownloadIcon,
  TagIcon, XIcon, VideoIcon, PinIcon, ClockIcon, EyeIcon, MegaphoneIcon, SearchIcon, HelpIcon,
  BackIcon, GridIcon,
} from '../../../components/icons.jsx';
import { cldThumb } from '../../../utils/cloudinary.js';
import { copyText, storeUrl, siteOrigin } from '../../../utils/links.js';
import { drawAd, downloadCanvas, AD_SIZES, AD_TEMPLATES } from '../../../utils/adCanvas.js';
import { AD_CITIES, PLACEMENT_KEYS } from '../../../utils/adCities.js';
import AdPreview from './AdPreview.jsx';
import { runChecks, blocking } from './adChecks.js';

// بانيةُ الإعلان — من قطعةٍ بالمتجرِ إلى حملةٍ كاملة: النصّ، والوسيطة (صورةٌ مرسومةٌ أو
// فيديو القطعة)، والجمهور، وأماكنُ الظهور، والميزانيّةُ والموعد — ثمّ فحصٌ ومعاينةٌ
// ونشرٌ إلى ميتا موقوفاً. لا شيءَ يُصرَفُ بلا ضغطةِ «شغّلي» من لوحةِ الحملات.

const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
const BOX = 'rounded-2xl border border-gold-400/15 bg-black/20 p-4';
const GOALS = ['sales', 'messages', 'traffic', 'awareness'];
const SIZES = Object.keys(AD_SIZES);
const chip = (on) => `rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
  on ? 'border-[#999795] bg-[#999795] text-[#313130] shadow-sm' : 'border-gold-400/25 text-stone-300 hover:bg-gold-400/10 hover:text-gold-200'
}`;
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
  const canvasRef = useRef(null);

  const product = useMemo(() => (data.products || []).find((p) => p.id === productId) || null, [data, productId]);
  const copy = gen?.copies?.[chosen];

  // قطعةٌ بفيديو: الفيديو افتراضاً للحملاتِ الجديدة — يبيعُ الملابسَ أكثرَ من أيِّ صورة
  useEffect(() => {
    if (campaign) return;
    setSettings((s) => ({ ...s, format: product?.video ? 'video' : 'image' }));
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    if (!productId) return;
    setBusy('gen'); setErr(''); setMsg('');
    try {
      const r = await api.post('/ads/generate', { productId, goal, tone });
      setGen((g) => ({ ...r.data, audience: { ...r.data.audience, cities: g?.audience?.cities || [] } }));
      setChosen(0);
      const sale = r.data.facts?.sale;
      setCreative((c) => ({ ...c, badge: sale ? t('adStudio.badgeSale', { n: sale.off }) : t('adStudio.badgeNew') }));
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

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-400 transition hover:text-gold-200">
        <BackIcon className="h-4 w-4" /> {t('adStudio.b.back')}
      </button>

      {live && (
        <p className="flex items-start gap-2 rounded-2xl border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm font-semibold text-gold-200">
          <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.b.liveNote')}
        </p>
      )}

      {/* ═══ ١ · القطعة والهدف ═══ */}
      <div className={CARD}>
        <SectionHead icon={<TagIcon className="h-5 w-5" />} title={t('adStudio.pick.title')} desc={t('adStudio.pick.desc')} />
        <ProductPicker products={data.products} value={productId} onChange={setProductId} disabled={live} />

        <Field label={t('adStudio.goal.label')} tip={t('adStudio.b.goalTip')}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GOALS.map((g) => (
              <button key={g} type="button" disabled={live} onClick={() => setGoal(g)} className={chip(goal === g)}>
                {t(`adStudio.goal.${g}`)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-400">{t(`adStudio.b.goalWhat.${goal}`)}</p>
        </Field>

        <Field label={t('adStudio.tone.label')} tip={t('adStudio.tone.tip')}>
          <Select value={tone} onChange={setTone} options={['warm', 'luxury', 'playful'].map((k) => ({ value: k, label: t(`adStudio.tone.${k}`) }))} />
        </Field>

        {!live && (
          <button onClick={generate} disabled={!productId || Boolean(busy)} className="btn-primary w-full gap-2 disabled:opacity-50">
            <SparkleIcon className="h-5 w-5" /> {busy === 'gen' ? t('adStudio.generating') : gen ? t('adStudio.b.regenerate') : t('adStudio.generate')}
          </button>
        )}
        {!data.smart && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold leading-relaxed text-amber-300">
            <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.freeMode')}
          </p>
        )}
      </div>

      {gen && copy && (
        <>
          {/* ═══ ٢ · النصّ ═══ */}
          <div className={CARD}>
            <SectionHead icon={<SparkleIcon className="h-5 w-5" />} title={t('adStudio.copy.title')} desc={t('adStudio.copy.desc')} />
            <div className="space-y-2">
              {gen.copies.map((c, i) => (
                <button
                  key={i} type="button" onClick={() => setChosen(i)}
                  className={`block w-full rounded-2xl border p-4 text-start transition ${chosen === i ? 'border-[#999795] bg-gold-400/10' : 'border-gold-400/15 bg-black/20 hover:border-gold-400/40'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-stone-100">{c.headline}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${chosen === i ? 'bg-[#999795] text-[#313130]' : 'bg-gold-400/10 text-gold-200'}`}>
                      {t('adStudio.copy.n', { n: i + 1 })}
                    </span>
                  </span>
                  <span className="mt-1.5 line-clamp-3 block whitespace-pre-wrap text-xs leading-relaxed text-stone-300">{c.primary}</span>
                </button>
              ))}
            </div>

            <Field label={t('adStudio.copy.headline')} tip={t('adStudio.copy.headlineTip')} max={60} value={copy.headline}>
              <input className="input" maxLength={60} value={copy.headline} disabled={live} onChange={(e) => patchCopy(chosen, { headline: e.target.value })} />
            </Field>
            <Field label={t('adStudio.copy.primary')} tip={t('adStudio.copy.primaryTip')} max={600} value={copy.primary}>
              <textarea className="input resize-none" rows={5} maxLength={600} value={copy.primary} disabled={live} onChange={(e) => patchCopy(chosen, { primary: e.target.value })} />
            </Field>

            {copy.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {copy.hashtags.map((h, i) => (
                  <span key={i} className="rounded-full border border-gold-400/25 bg-gold-400/5 px-2.5 py-1 text-[11px] font-semibold text-stone-300">{h}</span>
                ))}
              </div>
            )}

            {gen.copies.length > 1 && (
              <Toggle
                on={settings.abTest} disabled={live}
                onChange={(v) => setSettings((s) => ({ ...s, abTest: v }))}
                label={t('adStudio.b.abTest')} hint={t('adStudio.b.abTestHint')}
              />
            )}

            <CopyButton text={`${copy.primary}\n\n${(copy.hashtags || []).join(' ')}`.trim()} label={t('adStudio.copy.copyAll')} done={t('common.copied')} />
          </div>

          {/* ═══ ٣ · الصورة أو الفيديو ═══ */}
          <CreativeCard
            product={product} store={data.store} headline={copy.headline} sub={copy.cta} facts={gen.facts}
            creative={creative} setCreative={setCreative} settings={settings} setSettings={setSettings}
            canvasRef={canvasRef} onRendered={setImageUrl} onError={setErr} live={live}
          />

          {/* ═══ ٤ · الجمهور ═══ */}
          <AudienceCard gen={gen} setGen={setGen} goal={goal} settings={settings} setSettings={setSettings} publishing={publishing} live={live} />

          {/* ═══ ٥ · الميزانية والموعد ═══ */}
          <BudgetCard gen={gen} setGen={setGen} settings={settings} setSettings={setSettings} currency={publishing.currency} live={live} />

          {/* ═══ ٦ · المعاينة والفحص ═══ */}
          <div className={CARD}>
            <SectionHead icon={<EyeIcon className="h-5 w-5" />} title={t('adStudio.pv.title')} desc={t('adStudio.pv.desc')} />
            <AdPreview
              goal={goal} format={settings.format} size={creative.size}
              image={imageUrl || (product?.image ? cldThumb(product.image, 720) : '')}
              video={product?.video} copy={copy} store={data.store}
              domain={siteOrigin().replace(/^https?:\/\//, '')}
            />
          </div>

          <div className={CARD}>
            <SectionHead icon={<CheckIcon className="h-5 w-5" />} title={t('adStudio.chk.title')} desc={t('adStudio.chk.desc')} />
            {checks.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckIcon className="h-4 w-4" /> {t('adStudio.chk.allGood')}</p>
            ) : (
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li key={c.key} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    c.level === 'error' ? 'bg-red-500/10 text-red-300' : c.level === 'warn' ? 'bg-amber-500/10 text-amber-300' : 'bg-black/20 text-stone-300'
                  }`}>
                    {c.level === 'tip' ? <HelpIcon className="mt-px h-4 w-4 shrink-0" /> : <WarnIcon className="mt-px h-4 w-4 shrink-0" />}
                    <span>{t(`adStudio.chk.${c.key}`, c.params)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!live && (
            <div className={`${CARD} !space-y-3`}>
              {publishing.enabled && (
                <>
                  <button onClick={publish} disabled={Boolean(busy) || blocked || !publishing.accountId} className="btn-primary w-full gap-2 disabled:opacity-50">
                    <MegaphoneIcon className="h-5 w-5" /> {busy === 'publish' ? t('adStudio.b.publishing') : t('adStudio.b.publish')}
                  </button>
                  <Tip text={t(publishing.accountId ? 'adStudio.b.publishTip' : 'adStudio.b.needAccount')} />
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => saveAndBack('ready')} disabled={Boolean(busy)} className={`${publishing.enabled ? 'btn-ghost' : 'btn-primary'} flex-1 gap-2 disabled:opacity-50`}>
                  <CheckIcon className="h-5 w-5" /> {editingId ? t('adStudio.update') : t('adStudio.saveReady')}
                </button>
                <button onClick={() => saveAndBack('draft')} disabled={Boolean(busy)} className="btn-ghost flex-1">{t('adStudio.saveDraft')}</button>
              </div>
            </div>
          )}
        </>
      )}
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
    const top = all.slice(0, 15);
    return picked && !top.includes(picked) ? [picked, ...top.slice(0, 14)] : top;
  }, [products, q, value]);

  if (!products.length) return <p className="py-4 text-center text-sm text-stone-400">{t('adStudio.pick.empty')}</p>;
  return (
    <div className="space-y-2">
      {products.length > 10 && (
        <label className="flex items-center gap-2 rounded-xl border border-gold-400/20 bg-black/20 px-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
          <input className="w-full bg-transparent py-2.5 text-sm text-stone-100 outline-none placeholder:text-stone-500" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('adStudio.b.searchProduct')} />
        </label>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {list.map((p) => {
          const on = p.id === value;
          return (
            <button
              key={p.id} type="button" disabled={disabled} onClick={() => onChange(p.id)}
              className={`group overflow-hidden rounded-2xl border text-start transition disabled:cursor-default ${on ? 'border-[#999795] ring-2 ring-[#999795]' : 'border-gold-400/20 hover:border-gold-400/50'}`}
            >
              <span className="dash-avatar relative block aspect-square w-full overflow-hidden">
                {p.image
                  ? <img src={cldThumb(p.image, 240)} alt="" className="h-full w-full object-cover" />
                  : <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-5 w-5 text-stone-500" /></span>}
                {p.video && <span className="absolute bottom-1 end-1 grid h-5 w-5 place-items-center rounded-md bg-black/60 text-cream"><VideoIcon className="h-3 w-3" /></span>}
              </span>
              <span className="block px-2 py-1.5">
                <span className="block truncate text-[11px] font-bold text-stone-200">{p.name}</span>
                <span className="block text-[10px] tabular-nums text-stone-400">₪{p.price}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────── الوسيطة ─────────────────────
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

  return (
    <div className={CARD}>
      <SectionHead icon={<ImageIcon className="h-5 w-5" />} title={t('adStudio.b.mediaTitle')} desc={t('adStudio.b.mediaDesc')} />

      <Field label={t('adStudio.b.format')} tip={t('adStudio.b.formatTip')}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={live} onClick={() => setSettings((s) => ({ ...s, format: 'image' }))} className={`${chip(!isVideo)} inline-flex items-center justify-center gap-1.5`}>
            <ImageIcon className="h-4 w-4" /> {t('adStudio.b.fmtImage')}
          </button>
          <button type="button" disabled={live || !product?.video} onClick={() => setSettings((s) => ({ ...s, format: 'video' }))} className={`${chip(isVideo)} inline-flex items-center justify-center gap-1.5 disabled:opacity-40`}>
            <VideoIcon className="h-4 w-4" /> {t('adStudio.b.fmtVideo')}
          </button>
        </div>
        {!product?.video && <p className="mt-1.5 text-[11px] text-stone-500">{t('adStudio.b.noVideo')}</p>}
      </Field>

      {isVideo && (
        <p className={`${BOX} text-xs leading-relaxed text-stone-300`}>{t('adStudio.b.videoNote')}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(isVideo ? 'adStudio.b.coverTemplate' : 'adStudio.creative.template')} tip={t('adStudio.creative.templateTip')}>
          <div className="grid grid-cols-3 gap-2">
            {AD_TEMPLATES.map((k) => (
              <button key={k} type="button" onClick={() => pick('template', k)} className={`${chip(creative.template === k)} !px-2 !py-2 !text-[11px]`}>
                {t(`adStudio.creative.tpl.${k}`)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('adStudio.creative.size')} tip={t('adStudio.creative.sizeTip')}>
          <div className="grid grid-cols-3 gap-2">
            {SIZES.map((k) => (
              <button key={k} type="button" onClick={() => pick('size', k)} className={`${chip(creative.size === k)} !px-2 !py-2 !text-[11px]`}>
                {t(`adStudio.creative.sz.${k}`)}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adStudio.creative.badge')} tip={t('adStudio.creative.badgeTip')} max={24} value={creative.badge}>
          <input className="input" maxLength={24} value={creative.badge} onChange={(e) => pick('badge', e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Toggle on={creative.showPrice} onChange={(v) => pick('showPrice', v)} label={t('adStudio.creative.showPrice')} />
        </div>
      </div>

      <div className={`${BOX} flex justify-center`}>
        <canvas ref={canvasRef} className={`h-auto w-full max-w-[280px] rounded-xl transition-opacity ${drawing ? 'opacity-60' : 'opacity-100'}`} />
      </div>
      {isVideo && <p className="text-center text-[11px] text-stone-500">{t('adStudio.b.coverCaption')}</p>}

      <button onClick={download} className="btn-ghost w-full gap-2">
        <DownloadIcon className="h-5 w-5" /> {t('adStudio.creative.download')}
      </button>
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
    <div className={CARD}>
      <SectionHead icon={<UsersIcon className="h-5 w-5" />} title={t('adStudio.b.audTitle')} desc={t('adStudio.target.desc')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adStudio.target.age')} tip={t('adStudio.target.ageTip')}>
          <div className="flex items-center gap-2">
            <input type="number" min="18" max="65" disabled={live} className="input w-full text-center tabular-nums" value={a.ageMin ?? 18} onChange={(e) => setA({ ageMin: Number(e.target.value) })} />
            <span className="shrink-0 text-xs text-stone-400">—</span>
            <input type="number" min="18" max="65" disabled={live} className="input w-full text-center tabular-nums" value={a.ageMax ?? 45} onChange={(e) => setA({ ageMax: Number(e.target.value) })} />
          </div>
        </Field>
        <Field label={t('adStudio.target.genders')} tip={t('adStudio.target.gendersTip')}>
          <Select value={a.genders || 'female'} onChange={(v) => !live && setA({ genders: v })} options={['female', 'male', 'all'].map((k) => ({ value: k, label: t(`adStudio.target.g.${k}`) }))} />
        </Field>
      </div>

      <CityPicker values={a.cities || []} onChange={(v) => setA({ cities: v })} disabled={live} />

      <InterestInput values={a.interests || []} onChange={(v) => setA({ interests: v })} suggest={publishing.enabled} disabled={live} />

      <Field label={t('adStudio.b.placements')} tip={t('adStudio.b.placementsTip')}>
        <Toggle on={auto} disabled={live} onChange={(v) => setSettings((s) => ({ ...s, placements: v ? [] : ['ig_feed', 'ig_story', 'ig_reels', 'fb_feed'] }))}
          label={t('adStudio.b.autoPlacements')} hint={t('adStudio.b.autoPlacementsHint')} />
        {!auto && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLACEMENT_KEYS.map((k) => (
              <button key={k} type="button" disabled={live} onClick={() => togglePlacement(k)} className={`${chip(settings.placements.includes(k))} !py-2 !text-[11px]`}>
                {t(`adStudio.b.pl.${k}`)}
              </button>
            ))}
          </div>
        )}
      </Field>

      {publishing.enabled && (
        <div className={`${BOX} flex flex-wrap items-center justify-between gap-2`}>
          <span className="flex items-center gap-1.5 text-xs font-medium text-stone-400"><GridIcon className="h-4 w-4" /> {t('adStudio.b.estTitle')}</span>
          {est?.available && est.lower ? (
            <span className="rounded-full bg-gold-400/10 px-3 py-1 text-sm font-extrabold tabular-nums text-gold-200">
              {compact(est.lower)} – {compact(est.upper)}
            </span>
          ) : (
            <button type="button" onClick={estimate} disabled={estBusy} className="btn-ghost !py-1.5 text-xs">
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
    <Field label={t('adStudio.target.locations')} tip={t('adStudio.b.citiesTip')}>
      <button type="button" disabled={disabled} onClick={() => onChange([])} className={`${chip(!values.length)} mb-2 inline-flex items-center gap-1.5 !py-2`}>
        <PinIcon className="h-4 w-4" /> {t('adStudio.b.allPalestine')}
      </button>
      {groups.map((g) => (
        <div key={g} className="mb-2">
          <p className="mb-1 text-[10px] font-bold text-stone-500">{t(`adStudio.b.grp.${g}`)}</p>
          <div className="flex flex-wrap gap-1.5">
            {AD_CITIES.filter((c) => c.group === g).map((c) => {
              const on = values.includes(c.ar);
              return (
                <button key={c.ar} type="button" disabled={disabled} onClick={() => toggle(c.ar)} aria-pressed={on}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 transition ${on ? 'bg-wine text-cream ring-wine' : 'text-stone-300 ring-gold-400/25 hover:bg-gold-400/10'}`}>
                  {c.ar}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Field>
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
    <Field label={t('adStudio.target.interests')} tip={t('adStudio.target.interestsTip')}>
      <div className="relative">
        <div className="flex gap-2">
          <input className="input flex-1" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={t('adStudio.target.chipPlaceholder')} />
          <button type="button" disabled={disabled} onClick={() => add()} className="btn-ghost shrink-0 px-4 text-xs">{t('common.add')}</button>
        </div>
        {items.length > 0 && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-2xl border border-gold-400/25 bg-[#1f1e1d] p-1 shadow-2xl">
            {items.map((it) => (
              <button key={it.id} type="button" onClick={() => add(it.name)} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-xs text-stone-200 hover:bg-gold-400/10">
                <span className="truncate">{it.name}</span>
                {it.size && <span className="shrink-0 tabular-nums text-stone-500">{compact(it.size)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-gold-400/25 bg-gold-400/5 px-2.5 py-1 text-[11px] font-semibold text-stone-300">
              {v}
              {!disabled && (
                <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-stone-400 transition hover:text-red-300" aria-label={t('common.delete')}>
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

// ───────────────────── الميزانية والموعد ─────────────────────
function BudgetCard({ gen, setGen, settings, setSettings, currency, live }) {
  const { t } = useTranslation();
  const total = (Number(gen.budget) || 0) * (Number(gen.days) || 0);
  const local = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const end = settings.startAt
    ? new Date(new Date(settings.startAt).getTime() + (Number(gen.days) || 0) * 86400000)
    : null;

  return (
    <div className={CARD}>
      <SectionHead icon={<CashIcon className="h-5 w-5" />} title={t('adStudio.b.budgetTitle')} desc={t('adStudio.b.budgetDesc')} />

      <Field label={t('adStudio.target.budget')} tip={t('adStudio.target.budgetTip')}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[15, 25, 40, 60, 100].map((v) => (
            <button key={v} type="button" disabled={live} onClick={() => setGen((g) => ({ ...g, budget: v }))}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold tabular-nums ring-1 transition ${Number(gen.budget) === v ? 'bg-wine text-cream ring-wine' : 'text-stone-300 ring-gold-400/25 hover:bg-gold-400/10'}`}>
              ₪{v}
            </button>
          ))}
        </div>
        <input type="number" min="0" disabled={live} className="input tabular-nums" value={gen.budget} onChange={(e) => setGen((g) => ({ ...g, budget: Number(e.target.value) }))} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adStudio.target.days')} tip={t('adStudio.target.daysTip')}>
          <input type="number" min="1" max="60" disabled={live} className="input tabular-nums" value={gen.days} onChange={(e) => setGen((g) => ({ ...g, days: Number(e.target.value) }))} />
        </Field>
        <Field label={t('adStudio.b.start')} tip={t('adStudio.b.startTip')}>
          <input type="datetime-local" disabled={live} className="input tabular-nums" value={local(settings.startAt)}
            onChange={(e) => setSettings((s) => ({ ...s, startAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
        </Field>
      </div>

      <div className={`${BOX} space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-stone-400"><CashIcon className="h-4 w-4" /> {t('adStudio.target.total')}</span>
          <span className="rounded-full bg-gold-400/10 px-3 py-1 text-sm font-extrabold tabular-nums text-gold-200">₪{total}</span>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
          <ClockIcon className="h-3.5 w-3.5" />
          {end ? t('adStudio.b.runsUntil', { date: end.toLocaleDateString() }) : t('adStudio.b.runsSoon', { n: gen.days })}
        </p>
      </div>
      <Tip text={t('adStudio.target.totalTip')} />
      {currency && currency !== 'ILS' && (
        <p className="flex items-start gap-2 text-[11px] font-semibold text-amber-300"><WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.b.currencyWarn', { cur: currency })}</p>
      )}
    </div>
  );
}

// ───────────────────── أدوات ─────────────────────
function Toggle({ on, onChange, label, hint, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition disabled:opacity-60 ${on ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-gold-400/20 bg-black/20'}`}
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-stone-500/50'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'start-6' : 'start-1'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-stone-200">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-400">{hint}</span>}
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
    <button onClick={click} className="btn-ghost w-full gap-2">
      {ok ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />} {ok ? done : label}
    </button>
  );
}

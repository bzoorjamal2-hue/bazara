import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Select from '../../components/Select.jsx';
import { PageHead, SectionHead, Field, Tip } from '../../components/FormField.jsx';
import {
  PaletteIcon, SparkleIcon, ImageIcon, UsersIcon, CashIcon, CheckIcon, WarnIcon,
  CopyIcon, DownloadIcon, TrashIcon, TagIcon, ClockIcon, XIcon,
} from '../../components/icons.jsx';
import { cldThumb } from '../../utils/cloudinary.js';
import { copyText, storeUrl } from '../../utils/links.js';
import { drawAd, downloadCanvas, AD_SIZES, AD_TEMPLATES } from '../../utils/adCanvas.js';

// تبويب «مصنع الإعلانات» — من قطعةٍ في متجرك إلى إعلانٍ جاهزٍ للنشر بأربع خطوات.
//
// الصورة تُرسم هنا بمتصفّح التاجرة لا على الخادم، فكل محاولة مجّانية تماماً ولا
// تمسّ رصيد الوسائط المحدود. والمحفوظ بالطابور وصفةُ الصورة لا الصورة نفسها.

const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
const BOX = 'rounded-2xl border border-gold-400/15 bg-black/20 p-4';
const GOALS = ['sales', 'traffic', 'messages', 'awareness'];
const SIZES = Object.keys(AD_SIZES);

export default function AdStudio() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);       // { campaigns, products, store, smart }
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // الخطوة الأولى
  const [productId, setProductId] = useState('');
  const [goal, setGoal] = useState('sales');
  const [tone, setTone] = useState('warm');
  const [busy, setBusy] = useState(false);

  // نتيجة التوليد
  const [gen, setGen] = useState(null);         // { copies, audience, budget, days, facts, usedAi }
  const [chosen, setChosen] = useState(0);
  const [creative, setCreative] = useState({ template: 'bold', size: 'square', badge: '', showPrice: true });
  const [editingId, setEditingId] = useState('');

  const load = () => api.get('/ads')
    .then((r) => setData(r.data))
    .catch((e) => setErr(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const product = useMemo(
    () => (data?.products || []).find((p) => p.id === productId) || null,
    [data, productId]
  );

  const generate = async () => {
    if (!productId) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await api.post('/ads/generate', { productId, goal, tone });
      setGen(r.data);
      setChosen(0);
      setEditingId('');
      const sale = r.data.facts?.sale;
      setCreative((c) => ({ ...c, badge: sale ? t('adStudio.badgeSale', { n: sale.off }) : t('adStudio.badgeNew') }));
    } catch (e) { setErr(getErrorMessage(e)); }
    setBusy(false);
  };

  const patchCopy = (i, patch) => setGen((g) => ({
    ...g, copies: g.copies.map((c, n) => (n === i ? { ...c, ...patch } : c)),
  }));

  const save = async (status) => {
    if (!gen || !product) return;
    setBusy(true); setErr(''); setMsg('');
    const body = {
      productId: product.id,
      name: `${product.name} — ${t(`adStudio.goal.${goal}`)}`,
      goal, status,
      copies: gen.copies,
      chosen,
      audience: gen.audience,
      budget: gen.budget,
      days: gen.days,
      creative,
    };
    try {
      if (editingId) await api.put(`/ads/${editingId}`, body);
      else await api.post('/ads', body);
      setMsg(t('adStudio.saved'));
      await load();
    } catch (e) { setErr(getErrorMessage(e)); }
    setBusy(false);
  };

  const openCampaign = (c) => {
    setProductId(c.productId || '');
    setGoal(c.goal);
    setGen({ copies: c.copies, audience: c.audience, budget: c.budget, days: c.days, facts: null, usedAi: false });
    setChosen(c.chosen);
    setCreative({ template: 'bold', size: 'square', badge: '', showPrice: true, ...c.creative });
    setEditingId(c.id);
    setMsg('');
    document.getElementById('ad-step1')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const removeCampaign = async (id) => {
    try {
      await api.delete(`/ads/${id}`);
      if (editingId === id) { setEditingId(''); setGen(null); }
      await load();
    } catch (e) { setErr(getErrorMessage(e)); }
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHead icon={<PaletteIcon className="h-6 w-6" />} title={t('adStudio.title')} hint={t('adStudio.hint')} />
        {err
          ? <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{err}</p>
          : <div className={CARD}><p className="text-sm text-stone-400">{t('common.loading')}</p></div>}
      </div>
    );
  }

  const copy = gen?.copies?.[chosen];

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

      {/* ═══ ١ · القطعة والهدف ═══ */}
      <div id="ad-step1" className={`${CARD} scroll-mt-[calc(env(safe-area-inset-top,0px)+5rem)]`}>
        <SectionHead icon={<TagIcon className="h-5 w-5" />} title={t('adStudio.pick.title')} desc={t('adStudio.pick.desc')} />

        {data.products.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">{t('adStudio.pick.empty')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {data.products.slice(0, 20).map((p) => {
              const on = p.id === productId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(p.id)}
                  className={`group overflow-hidden rounded-2xl border text-start transition ${
                    on ? 'border-[#999795] ring-2 ring-[#999795]' : 'border-gold-400/20 hover:border-gold-400/50'
                  }`}
                >
                  <span className="dash-avatar block aspect-square w-full overflow-hidden">
                    {p.image
                      ? <img src={cldThumb(p.image, 240)} alt="" className="h-full w-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-5 w-5 text-stone-500" /></span>}
                  </span>
                  <span className="block px-2 py-1.5">
                    <span className="block truncate text-[11px] font-bold text-stone-200">{p.name}</span>
                    <span className="block text-[10px] tabular-nums text-stone-400">₪{p.price}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <Field label={t('adStudio.goal.label')} tip={t('adStudio.goal.tip')}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                  goal === g ? 'border-[#999795] bg-[#999795] text-[#313130] shadow-sm' : 'border-gold-400/25 text-stone-300 hover:bg-gold-400/10 hover:text-gold-200'
                }`}
              >
                {t(`adStudio.goal.${g}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('adStudio.tone.label')} tip={t('adStudio.tone.tip')}>
          <Select
            value={tone}
            onChange={setTone}
            options={['warm', 'luxury', 'playful'].map((k) => ({ value: k, label: t(`adStudio.tone.${k}`) }))}
          />
        </Field>

        <button onClick={generate} disabled={!productId || busy} className="btn-primary w-full gap-2 disabled:opacity-50">
          <SparkleIcon className="h-5 w-5" /> {busy ? t('adStudio.generating') : t('adStudio.generate')}
        </button>

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
                  key={i}
                  type="button"
                  onClick={() => setChosen(i)}
                  className={`block w-full rounded-2xl border p-4 text-start transition ${
                    chosen === i ? 'border-[#999795] bg-gold-400/10' : 'border-gold-400/15 bg-black/20 hover:border-gold-400/40'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-stone-100">{c.headline}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${chosen === i ? 'bg-[#999795] text-[#313130]' : 'bg-gold-400/10 text-gold-200'}`}>
                      {t('adStudio.copy.n', { n: i + 1 })}
                    </span>
                  </span>
                  <span className="mt-1.5 block whitespace-pre-wrap text-xs leading-relaxed text-stone-300">{c.primary}</span>
                </button>
              ))}
            </div>

            <Field label={t('adStudio.copy.headline')} tip={t('adStudio.copy.headlineTip')} max={60} value={copy.headline}>
              <input className="input" maxLength={60} value={copy.headline} onChange={(e) => patchCopy(chosen, { headline: e.target.value })} />
            </Field>

            <Field label={t('adStudio.copy.primary')} tip={t('adStudio.copy.primaryTip')} max={600} value={copy.primary}>
              <textarea className="input resize-none" rows={5} maxLength={600} value={copy.primary} onChange={(e) => patchCopy(chosen, { primary: e.target.value })} />
            </Field>

            {copy.hashtags?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-stone-400">{t('adStudio.copy.tags')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {copy.hashtags.map((h, i) => (
                    <span key={i} className="rounded-full border border-gold-400/25 bg-gold-400/5 px-2.5 py-1 text-[11px] font-semibold text-stone-300">{h}</span>
                  ))}
                </div>
              </div>
            )}

            <CopyButton
              text={`${copy.primary}\n\n${(copy.hashtags || []).join(' ')}`.trim()}
              label={t('adStudio.copy.copyAll')}
              done={t('common.copied')}
            />
          </div>

          {/* ═══ ٣ · الصورة ═══ */}
          <CreativeCard
            product={product}
            store={data.store}
            headline={copy.headline}
            sub={copy.cta}
            facts={gen.facts}
            creative={creative}
            setCreative={setCreative}
            onError={setErr}
          />

          {/* ═══ ٤ · الجمهور والميزانية ═══ */}
          <TargetingCard gen={gen} setGen={setGen} />

          <div className={`${CARD} flex flex-wrap gap-2`}>
            <button onClick={() => save('ready')} disabled={busy} className="btn-primary flex-1 gap-2 disabled:opacity-50">
              <CheckIcon className="h-5 w-5" /> {editingId ? t('adStudio.update') : t('adStudio.saveReady')}
            </button>
            <button onClick={() => save('draft')} disabled={busy} className="btn-ghost flex-1">{t('adStudio.saveDraft')}</button>
          </div>
        </>
      )}

      {/* ═══ الطابور ═══ */}
      {data.campaigns.length > 0 && (
        <div className={CARD}>
          <SectionHead icon={<ClockIcon className="h-5 w-5" />} title={t('adStudio.queue.title')} desc={t('adStudio.queue.desc')} />
          <div className="space-y-2">
            {data.campaigns.map((c) => (
              <div key={c.id} className={`${BOX} flex flex-wrap items-center gap-3`}>
                <span className="dash-avatar grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl">
                  {c.productImage
                    ? <img src={cldThumb(c.productImage, 120)} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-5 w-5 text-stone-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-100">{c.copies?.[c.chosen]?.headline || c.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-stone-400">
                    <span>{t(`adStudio.goal.${c.goal}`)}</span>
                    <span className="tabular-nums">₪{c.budget}/{t('adStudio.perDay')}</span>
                    <span className="tabular-nums">{t('adStudio.daysN', { n: c.days })}</span>
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  c.status === 'published' ? 'bg-emerald-500/20 text-emerald-300'
                    : c.status === 'ready' ? 'bg-gold-400/15 text-gold-200' : 'bg-black/30 text-stone-400'
                }`}>
                  {t(`adStudio.status.${c.status}`)}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openCampaign(c)} className="rounded-lg p-2 text-stone-400 transition hover:text-gold-200" title={t('adStudio.queue.open')}>
                    <SparkleIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeCampaign(c.id)} className="rounded-lg p-2 text-stone-400 transition hover:text-red-300" title={t('common.delete')}>
                    <TrashIcon className="h-4 w-4" />
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

// ───────────────────── الصورة ─────────────────────

function CreativeCard({ product, store, headline, sub, facts, creative, setCreative, onError }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  const recipe = useMemo(() => ({
    image: product?.image || '',
    logo: store?.logo || '',
    template: creative.template,
    size: creative.size,
    headline,
    sub,
    price: product?.price ?? 0,
    oldPrice: facts?.sale ? facts.sale.old : (product?.oldPrice || null),
    badge: creative.badge,
    showPrice: creative.showPrice,
    storeName: store?.name || '',
    url: storeUrl(store?.slug || '').replace(/^https?:\/\//, ''),
    accent: '#1F1E1D',
  }), [product, store, headline, sub, facts, creative]);

  // إعادة الرسم عند كل تغيير — مؤجّلة قليلاً كي لا تُرسم اللوحة مع كل حرف يُكتب
  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      if (!canvasRef.current) return;
      setDrawing(true);
      try { await drawAd(canvasRef.current, recipe); }
      catch { /* الرسم لا يُسقط الصفحة */ }
      if (alive) setDrawing(false);
    }, 220);
    return () => { alive = false; clearTimeout(id); };
  }, [recipe]);

  const download = async () => {
    try {
      const name = `${(store?.name || 'bazara').replace(/\s+/g, '-')}-${creative.size}.jpg`;
      await downloadCanvas(canvasRef.current, name);
    } catch {
      onError(t('adStudio.creative.downloadFailed'));
    }
  };

  return (
    <div className={CARD}>
      <SectionHead icon={<ImageIcon className="h-5 w-5" />} title={t('adStudio.creative.title')} desc={t('adStudio.creative.desc')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adStudio.creative.template')} tip={t('adStudio.creative.templateTip')}>
          <div className="grid grid-cols-3 gap-2">
            {AD_TEMPLATES.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCreative((c) => ({ ...c, template: k }))}
                className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                  creative.template === k ? 'border-[#999795] bg-[#999795] text-[#313130]' : 'border-gold-400/25 text-stone-300 hover:bg-gold-400/10'
                }`}
              >
                {t(`adStudio.creative.tpl.${k}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('adStudio.creative.size')} tip={t('adStudio.creative.sizeTip')}>
          <div className="grid grid-cols-3 gap-2">
            {SIZES.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCreative((c) => ({ ...c, size: k }))}
                className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                  creative.size === k ? 'border-[#999795] bg-[#999795] text-[#313130]' : 'border-gold-400/25 text-stone-300 hover:bg-gold-400/10'
                }`}
              >
                {t(`adStudio.creative.sz.${k}`)}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adStudio.creative.badge')} tip={t('adStudio.creative.badgeTip')} max={24} value={creative.badge}>
          <input className="input" maxLength={24} value={creative.badge} onChange={(e) => setCreative((c) => ({ ...c, badge: e.target.value }))} />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            role="switch"
            aria-checked={creative.showPrice}
            onClick={() => setCreative((c) => ({ ...c, showPrice: !c.showPrice }))}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition ${
              creative.showPrice ? 'border-gold-400/40 bg-gold-400/10' : 'border-gold-400/20 bg-black/20'
            }`}
          >
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${creative.showPrice ? 'bg-[#999795]' : 'bg-stone-500/50'}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${creative.showPrice ? 'start-6' : 'start-1'}`} />
            </span>
            <span className="min-w-0 flex-1 text-xs font-bold text-stone-200">{t('adStudio.creative.showPrice')}</span>
          </button>
        </div>
      </div>

      <div className={`${BOX} flex justify-center`}>
        <canvas
          ref={canvasRef}
          className={`h-auto w-full max-w-[320px] rounded-xl transition-opacity ${drawing ? 'opacity-60' : 'opacity-100'}`}
        />
      </div>

      <button onClick={download} className="btn-primary w-full gap-2">
        <DownloadIcon className="h-5 w-5" /> {t('adStudio.creative.download')}
      </button>
      <Tip text={t('adStudio.creative.downloadTip')} />
    </div>
  );
}

// ───────────────────── الجمهور والميزانية ─────────────────────

function TargetingCard({ gen, setGen }) {
  const { t } = useTranslation();
  const a = gen.audience || {};
  const setA = (patch) => setGen((g) => ({ ...g, audience: { ...g.audience, ...patch } }));
  const total = (Number(gen.budget) || 0) * (Number(gen.days) || 0);

  return (
    <div className={CARD}>
      <SectionHead icon={<UsersIcon className="h-5 w-5" />} title={t('adStudio.target.title')} desc={t('adStudio.target.desc')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adStudio.target.age')} tip={t('adStudio.target.ageTip')}>
          <div className="flex items-center gap-2">
            <input type="number" min="13" max="65" className="input w-full text-center tabular-nums" value={a.ageMin ?? 18}
              onChange={(e) => setA({ ageMin: Number(e.target.value) })} />
            <span className="shrink-0 text-xs text-stone-400">—</span>
            <input type="number" min="13" max="65" className="input w-full text-center tabular-nums" value={a.ageMax ?? 45}
              onChange={(e) => setA({ ageMax: Number(e.target.value) })} />
          </div>
        </Field>
        <Field label={t('adStudio.target.genders')} tip={t('adStudio.target.gendersTip')}>
          <Select
            value={a.genders || 'female'}
            onChange={(v) => setA({ genders: v })}
            options={['female', 'male', 'all'].map((k) => ({ value: k, label: t(`adStudio.target.g.${k}`) }))}
          />
        </Field>
      </div>

      <ChipInput
        label={t('adStudio.target.locations')}
        tip={t('adStudio.target.locationsTip')}
        values={a.locations || []}
        onChange={(v) => setA({ locations: v })}
      />
      <ChipInput
        label={t('adStudio.target.interests')}
        tip={t('adStudio.target.interestsTip')}
        values={a.interests || []}
        onChange={(v) => setA({ interests: v })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('adStudio.target.budget')} tip={t('adStudio.target.budgetTip')}>
          <input type="number" min="0" className="input tabular-nums" value={gen.budget}
            onChange={(e) => setGen((g) => ({ ...g, budget: Number(e.target.value) }))} />
        </Field>
        <Field label={t('adStudio.target.days')} tip={t('adStudio.target.daysTip')}>
          <input type="number" min="1" max="60" className="input tabular-nums" value={gen.days}
            onChange={(e) => setGen((g) => ({ ...g, days: Number(e.target.value) }))} />
        </Field>
      </div>

      <div className={`${BOX} flex flex-wrap items-center justify-between gap-2`}>
        <span className="flex items-center gap-1.5 text-xs font-medium text-stone-400">
          <CashIcon className="h-4 w-4" /> {t('adStudio.target.total')}
        </span>
        <span className="rounded-full bg-gold-400/10 px-3 py-1 text-sm font-extrabold tabular-nums text-gold-200">₪{total}</span>
      </div>
      <Tip text={t('adStudio.target.totalTip')} />
    </div>
  );
}

function ChipInput({ label, tip, values, onChange }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (!v || values.includes(v) || values.length >= 12) { setText(''); return; }
    onChange([...values, v]);
    setText('');
  };
  return (
    <Field label={label} tip={tip}>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={t('adStudio.target.chipPlaceholder')}
        />
        <button type="button" onClick={add} className="btn-ghost shrink-0 px-4 text-xs">{t('common.add')}</button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-gold-400/25 bg-gold-400/5 px-2.5 py-1 text-[11px] font-semibold text-stone-300">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-stone-400 transition hover:text-red-300">
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

function CopyButton({ text, label, done }) {
  const [ok, setOk] = useState(false);
  const click = async () => {
    if (await copyText(text)) {
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    }
  };
  return (
    <button onClick={click} className="btn-ghost w-full gap-2">
      {ok ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />} {ok ? done : label}
    </button>
  );
}

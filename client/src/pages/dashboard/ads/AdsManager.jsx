import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../../api/client.js';
import { SectionHead, Tip } from '../../../components/FormField.jsx';
import {
  ChartIcon, CashIcon, LinkIcon, SendIcon, BagIcon, TrophyIcon, EyeIcon,
  CopyIcon, EditIcon, TrashIcon, LinkOutIcon, ImageIcon, VideoIcon, PlusIcon, KeyIcon,
  CheckIcon, WarnIcon, MegaphoneIcon,
} from '../../../components/icons.jsx';
import { cldThumb } from '../../../utils/cloudinary.js';

// لوحةُ الحملات — ما يفتحُه Ads Manager أوّلاً: أين ذهبَ المال وماذا جاءَ به.
//
// وفوقَ ما يعرفُه Ads Manager رقمٌ لا يعرفُه: المحادثاتُ التي بدأت من الإعلانِ بدايركت
// إنستغرام، والطلباتُ التي سُجّلت منها ومبيعاتُها. أغلبُ البيعِ هنا بالرسائلِ لا بموقعٍ
// عليه بكسل، فـ«عائدُ الإعلان» الحقيقيُّ يُحسَبُ من بازارا لا من ميتا.

const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
const BOX = 'rounded-2xl border border-gold-400/15 bg-black/20 p-4';
const PRESETS = ['today', 'last_7d', 'last_14d', 'last_30d', 'maximum'];
const TABS = ['all', 'draft', 'ready', 'active', 'paused'];

// حالةُ الحملةِ كما تراها التاجرة: قبلَ ميتا (مسوّدة/جاهزة) وبعدَها (شغّالة/موقوفة)
export function campaignState(c) {
  if (c.metaCampaignId) return c.metaStatus === 'ACTIVE' ? 'active' : 'paused';
  return c.status === 'ready' ? 'ready' : 'draft';
}

const money = (n, cur = 'ILS') => {
  const v = Number(n) || 0;
  const sym = cur === 'ILS' ? '₪' : cur === 'USD' ? '$' : `${cur} `;
  return `${sym}${v >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(v % 1 ? 2 : 0)}`;
};
const num = (n) => (Number(n) || 0).toLocaleString('en');

export default function AdsManager({ data, onNew, onOpen, reload, setErr, setMsg }) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState('last_7d');
  const [ov, setOv] = useState(null);
  const [tab, setTab] = useState('all');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let alive = true;
    setOv(null);
    api.get(`/ads/insights?preset=${preset}`)
      .then((r) => { if (alive) setOv(r.data); })
      .catch(() => { if (alive) setOv({ failed: true }); });
    return () => { alive = false; };
  }, [preset, data]);

  const counts = useMemo(() => {
    const m = { all: data.campaigns.length, draft: 0, ready: 0, active: 0, paused: 0 };
    data.campaigns.forEach((c) => { m[campaignState(c)] += 1; });
    return m;
  }, [data.campaigns]);
  const list = data.campaigns.filter((c) => tab === 'all' || campaignState(c) === tab);
  const cur = ov?.currency || data.publishing?.currency || 'ILS';

  const act = async (id, fn, okMsg) => {
    setBusyId(id); setErr('');
    try {
      await fn();
      if (okMsg) setMsg(okMsg);
      await reload();
    } catch (e) { setErr(getErrorMessage(e)); }
    setBusyId('');
  };

  const toggle = (c) => act(c.id, () => api.post(`/ads/${c.id}/status`, { active: c.metaStatus !== 'ACTIVE' }),
    t(c.metaStatus === 'ACTIVE' ? 'adStudio.m.pausedOk' : 'adStudio.m.activeOk'));
  const duplicate = (c) => act(c.id, () => api.post(`/ads/${c.id}/duplicate`), t('adStudio.m.duplicated'));
  const remove = (c) => {
    if (c.metaCampaignId && !window.confirm(t('adStudio.m.deletePublished'))) return;
    act(c.id, () => api.delete(`/ads/${c.id}`));
  };

  const tot = ov?.total;
  const baz = ov?.bazara;
  const roas = tot?.spend > 0 && baz?.revenue > 0 ? baz.revenue / tot.spend : null;

  return (
    <div className="space-y-4">
      <AccountCard publishing={data.publishing} reload={reload} setErr={setErr} setMsg={setMsg} />

      {/* ═══ الأرقام ═══ */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHead icon={<ChartIcon className="h-5 w-5" />} title={t('adStudio.m.resultsTitle')} desc={t('adStudio.m.resultsDesc')} />
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('adStudio.m.period')}>
            {PRESETS.map((p) => (
              <button
                key={p} type="button" role="tab" aria-selected={preset === p} onClick={() => setPreset(p)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 transition ${
                  preset === p ? 'bg-[#999795] text-[#313130] ring-[#999795]' : 'text-stone-300 ring-gold-400/25 hover:bg-gold-400/10'
                }`}
              >
                {t(`adStudio.m.p.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {!ov ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`${BOX} h-[76px] animate-pulse`} />)}
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{t('adStudio.m.fromMeta')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi icon={CashIcon} label={t('adStudio.m.k.spend')} value={money(tot?.spend, cur)} />
              <Kpi icon={EyeIcon} label={t('adStudio.m.k.reach')} value={num(tot?.reach)} />
              <Kpi icon={LinkIcon} label={t('adStudio.m.k.clicks')} value={num(tot?.linkClicks || tot?.clicks)} sub={tot?.ctr ? `CTR ${tot.ctr.toFixed(2)}%` : ''} />
              <Kpi icon={CashIcon} label={t('adStudio.m.k.cpc')} value={tot?.cpc ? money(tot.cpc, cur) : '—'} sub={tot?.cpm ? `CPM ${money(tot.cpm, cur)}` : ''} />
            </div>

            <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-stone-500">{t('adStudio.m.fromBazara')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi icon={SendIcon} label={t('adStudio.m.k.chats')} value={num(baz?.chats)} />
              <Kpi icon={BagIcon} label={t('adStudio.m.k.orders')} value={num(baz?.orders)} />
              <Kpi icon={CashIcon} label={t('adStudio.m.k.revenue')} value={money(baz?.revenue, 'ILS')} />
              <Kpi icon={TrophyIcon} label={t('adStudio.m.k.roas')} value={roas ? `×${roas.toFixed(1)}` : '—'} sub={t('adStudio.m.k.roasSub')} strong={roas >= 2} />
            </div>
            <Tip text={t('adStudio.m.bazaraTip')} />
            {cur !== 'ILS' && tot?.spend > 0 && (
              <p className="text-[11px] text-amber-300">{t('adStudio.m.currencyNote', { cur })}</p>
            )}

            {ov.daily?.length > 1 && <SpendChart daily={ov.daily} cur={cur} />}

            {!ov.enabled && (
              <p className={`${BOX} text-xs leading-relaxed text-stone-400`}>{t('adStudio.m.metaOff')}</p>
            )}
            {ov.metaError && (
              <p className="flex items-start gap-2 text-xs text-amber-300"><WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.m.metaErr')}</p>
            )}
          </>
        )}
      </div>

      {/* ═══ الحملات ═══ */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHead icon={<MegaphoneIcon className="h-5 w-5" />} title={t('adStudio.m.campaignsTitle')} desc={t('adStudio.m.campaignsDesc')} />
          <button type="button" onClick={onNew} className="btn-primary shrink-0 gap-1.5 !py-2 text-sm">
            <PlusIcon className="h-4 w-4" /> {t('adStudio.m.new')}
          </button>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
          {TABS.map((k) => (
            <button
              key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition ${
                tab === k ? 'bg-wine text-cream ring-wine' : 'text-stone-300 ring-gold-400/25 hover:bg-gold-400/10'
              }`}
            >
              {t(`adStudio.m.tab.${k}`)} ({counts[k]})
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className={`${BOX} py-8 text-center`}>
            <p className="text-sm text-stone-400">{t(data.campaigns.length ? 'adStudio.m.emptyTab' : 'adStudio.m.empty')}</p>
            {!data.campaigns.length && (
              <button type="button" onClick={onNew} className="btn-primary mx-auto mt-3 gap-1.5 !py-2 text-sm">
                <PlusIcon className="h-4 w-4" /> {t('adStudio.m.new')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((c) => (
              <CampaignRow
                key={c.id} c={c} cur={cur}
                metrics={ov?.campaigns?.[c.id]}
                baz={ov?.bazara?.perCampaign?.[c.id]}
                busy={busyId === c.id}
                canPublish={Boolean(data.publishing?.enabled)}
                onOpen={() => onOpen(c)}
                onToggle={() => toggle(c)}
                onDuplicate={() => duplicate(c)}
                onDelete={() => remove(c)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, strong }) {
  return (
    <div className="rounded-2xl border border-gold-400/15 bg-black/20 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone-400">
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
      </p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${strong ? 'text-emerald-300' : 'text-stone-100'}`}>{value}</p>
      {sub && <p className="truncate text-[10px] tabular-nums text-stone-500">{sub}</p>}
    </div>
  );
}

// ───────────────────── المصروفُ يوماً بيوم ─────────────────────
// سلسلةٌ واحدة (لا مفتاحَ ألوان: العنوانُ يسمّيها)، أعمدةٌ رفيعةٌ بحوافَّ مستديرةٍ على
// خطِّ الأساس، وتلميحٌ لكلِّ عمود. والجدولُ تحتَها لمن لا يقرأُ الرسم.
function SpendChart({ daily, cur }) {
  const { t, i18n } = useTranslation();
  const [hover, setHover] = useState(-1);
  const W = 640; const H = 200; const padB = 30; const padT = 26;
  const max = Math.max(...daily.map((d) => d.spend), 0.01);
  const step = W / daily.length;
  const bw = Math.max(4, Math.min(28, step - 6));
  const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language === 'en' ? 'en' : 'ar', { day: 'numeric', month: 'short' });
  const every = Math.ceil(daily.length / 7); // عناوينُ قليلةٌ لا تتزاحم
  const h = hover >= 0 ? daily[hover] : null;

  return (
    <div className={BOX}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-stone-300">{t('adStudio.m.chartTitle')}</p>
        <p className="min-h-[1rem] text-[11px] tabular-nums text-stone-400" aria-live="polite">
          {h ? `${day(h.date)} · ${money(h.spend, cur)} · ${t('adStudio.m.k.clicks')} ${num(h.clicks)}` : ''}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={t('adStudio.m.chartTitle')} onMouseLeave={() => setHover(-1)}>
        {[0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={padT + (H - padB - padT) * (1 - f)} y2={padT + (H - padB - padT) * (1 - f)} stroke="rgba(120,113,108,0.18)" strokeWidth="1" />
        ))}
        <line x1="0" x2={W} y1={H - padB} y2={H - padB} stroke="rgba(120,113,108,0.4)" strokeWidth="1" />
        {/* قيمةُ الخطِّ الأعلى وحدَها — مرجعٌ يُقرأُ منه الطولُ بلا رقمٍ فوقَ كلِّ عمود */}
        <text x={W - 4} y={padT - 8} textAnchor="end" direction="ltr" fontSize="16" className="fill-stone-500">{money(max, cur)}</text>
        {daily.map((d, i) => {
          const bh = Math.max(d.spend > 0 ? 2 : 0, ((H - padB - padT) * d.spend) / max);
          const x = i * step + (step - bw) / 2;
          const y = H - padB - bh;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
              {/* هدفُ لمسٍ بعرضِ اليومِ كلِّه، أكبرُ من العمود */}
              <rect x={i * step} y={padT} width={step} height={H - padB - padT} fill="transparent" />
              <path
                d={bh > 0 ? `M${x},${H - padB} V${y + Math.min(4, bh)} Q${x},${y} ${x + Math.min(4, bw / 2)},${y} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${y} ${x + bw},${y + Math.min(4, bh)} V${H - padB} Z` : ''}
                className={hover === i ? 'fill-gold-200' : 'fill-gold-400'}
              />
              {i % every === 0 && (
                <text x={i * step + step / 2} y={H - 4} textAnchor="middle" fontSize="17" className="fill-stone-500">{day(d.date)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-bold text-stone-400">{t('adStudio.m.table')}</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-[11px] tabular-nums text-stone-300">
            <thead><tr className="text-stone-500">
              <th className="py-1 text-start font-medium">{t('adStudio.m.day')}</th>
              <th className="py-1 text-start font-medium">{t('adStudio.m.k.spend')}</th>
              <th className="py-1 text-start font-medium">{t('adStudio.m.k.clicks')}</th>
              <th className="py-1 text-start font-medium">{t('adStudio.m.k.reach')}</th>
              <th className="py-1 text-start font-medium">{t('adStudio.m.k.msgs')}</th>
            </tr></thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date} className="border-t border-white/5">
                  <td className="py-1">{day(d.date)}</td><td>{money(d.spend, cur)}</td><td>{num(d.clicks)}</td><td>{num(d.reach)}</td><td>{num(d.messages)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ───────────────────── صفُّ الحملة ─────────────────────
function CampaignRow({ c, cur, metrics, baz, busy, canPublish, onOpen, onToggle, onDuplicate, onDelete }) {
  const { t } = useTranslation();
  const st = campaignState(c);
  const live = Boolean(c.metaCampaignId);
  const isVideo = c.settings?.format === 'video';
  const tone = { active: 'bg-emerald-500/20 text-emerald-300', paused: 'bg-amber-500/15 text-amber-300', ready: 'bg-gold-400/15 text-gold-200', draft: 'bg-black/30 text-stone-400' }[st];
  const btn = 'grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold-400/20 text-stone-400 transition hover:border-gold-400/50 hover:text-gold-200 disabled:opacity-40';

  return (
    <div className={`${BOX} space-y-3 ${busy ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="dash-avatar relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl">
          {c.productImage
            ? <img src={cldThumb(c.productImage, 120)} alt="" className="h-full w-full object-cover" />
            : <ImageIcon className="h-5 w-5 text-stone-500" />}
          <span className="absolute bottom-0.5 end-0.5 grid h-4 w-4 place-items-center rounded bg-black/60 text-cream">
            {isVideo ? <VideoIcon className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-stone-100">{c.copies?.[c.chosen]?.headline || c.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-stone-400">
            <span>{t(`adStudio.goal.${c.goal}`)}</span>
            <span className="tabular-nums">₪{c.budget}/{t('adStudio.perDay')}</span>
            <span className="tabular-nums">{t('adStudio.daysN', { n: c.days })}</span>
            {c.settings?.abTest && <span className="rounded bg-gold-400/10 px-1.5 text-gold-200">A/B</span>}
          </p>
        </div>
        {live ? (
          <button
            type="button" role="switch" aria-checked={st === 'active'} onClick={onToggle} disabled={busy || !canPublish}
            title={t(st === 'active' ? 'adStudio.m.pause' : 'adStudio.m.activate')}
            className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${st === 'active' ? 'bg-emerald-500' : 'bg-stone-500/50'}`}
          >
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${st === 'active' ? 'start-6' : 'start-1'}`} />
          </button>
        ) : (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{t(`adStudio.m.tab.${st}`)}</span>
        )}
      </div>

      {live && (
        <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <Mini label={t('adStudio.m.k.spend')} value={metrics ? money(metrics.spend, cur) : '—'} />
          <Mini label={t('adStudio.m.k.reach')} value={metrics ? num(metrics.reach) : '—'} />
          <Mini label={t('adStudio.m.k.clicks')} value={metrics ? num(metrics.linkClicks || metrics.clicks) : '—'} />
          <Mini label={t('adStudio.m.k.msgs')} value={metrics ? num(metrics.messages) : '—'} />
          <Mini label={t('adStudio.m.k.chats')} value={num(baz?.chats)} />
          <Mini label={t('adStudio.m.k.orders')} value={num(baz?.orders)} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-white/5 pt-2.5">
        {!live && (
          <button type="button" onClick={onOpen} className="btn-primary me-auto gap-1.5 !py-1.5 text-xs">
            {st === 'ready' && canPublish ? <><MegaphoneIcon className="h-4 w-4" /> {t('adStudio.m.openPublish')}</> : <><EditIcon className="h-4 w-4" /> {t('adStudio.m.edit')}</>}
          </button>
        )}
        {live && c.managerUrl && (
          <a href={c.managerUrl} target="_blank" rel="noopener noreferrer" className="me-auto inline-flex items-center gap-1 text-xs font-bold text-gold-200 hover:underline">
            <LinkOutIcon className="h-3.5 w-3.5" /> {t('adStudio.m.openManager')}
          </a>
        )}
        <button type="button" onClick={onDuplicate} disabled={busy} className={btn} title={t('adStudio.m.duplicate')} aria-label={t('adStudio.m.duplicate')}>
          <CopyIcon className="h-4 w-4" />
        </button>
        {live && (
          <button type="button" onClick={onOpen} className={btn} title={t('adStudio.m.view')} aria-label={t('adStudio.m.view')}>
            <EyeIcon className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={onDelete} disabled={busy} className={`${btn} hover:!border-red-400/50 hover:!text-red-300`} title={t('common.delete')} aria-label={t('common.delete')}>
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-xl bg-black/20 px-2 py-1.5">
      <p className="truncate text-[10px] text-stone-500">{label}</p>
      <p className="truncate text-xs font-bold tabular-nums text-stone-200">{value}</p>
    </div>
  );
}

// ───────────────────── الحسابُ الإعلانيّ ─────────────────────
function AccountCard({ publishing, reload, setErr, setMsg }) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!publishing?.enabled) {
    return (
      <div className={`${CARD} !space-y-2`}>
        <SectionHead icon={<KeyIcon className="h-5 w-5" />} title={t('adStudio.m.accTitle')} desc={t('adStudio.m.accOff')} />
      </div>
    );
  }

  const loadAccounts = async () => {
    setBusy(true); setErr('');
    try { setAccounts((await api.get('/ads/accounts')).data.accounts || []); } catch (e) { setErr(getErrorMessage(e)); }
    setBusy(false);
  };
  const pick = async (a) => {
    setBusy(true); setErr('');
    try {
      await api.put('/ads/account', { accountId: a.accountId });
      setMsg(t('adStudio.m.accLinked'));
      setAccounts(null);
      await reload();
    } catch (e) { setErr(getErrorMessage(e)); }
    setBusy(false);
  };

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHead icon={<KeyIcon className="h-5 w-5" />} title={t('adStudio.m.accTitle')}
          desc={publishing.accountId ? t('adStudio.m.accOn', { id: publishing.accountId, cur: publishing.currency || '—' }) : t('adStudio.m.accNone')} />
        <button type="button" onClick={loadAccounts} disabled={busy} className="btn-ghost shrink-0 !py-2 text-xs">
          {publishing.accountId ? t('adStudio.m.accChange') : t('adStudio.m.accLink')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Pill ok={publishing.pageLinked} label={t('adStudio.m.chkPage')} />
        <Pill ok={publishing.igLinked} label={t('adStudio.m.chkIg')} />
        <Pill ok={publishing.pixel} label={t('adStudio.m.chkPixel')} soft />
      </div>
      {accounts && (
        <div className="space-y-2">
          {accounts.length === 0 && <p className="text-xs text-stone-400">{t('adStudio.m.accEmpty')}</p>}
          {accounts.map((a) => (
            <button
              key={a.id} type="button" disabled={busy || !a.active} onClick={() => pick(a)}
              className={`${BOX} flex w-full items-center gap-3 text-start transition hover:border-gold-400/40 disabled:opacity-50`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-stone-100">{a.name}</span>
                <span className="block text-[11px] tabular-nums text-stone-400">{a.accountId} · {a.currency}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${a.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                {t(a.active ? 'adStudio.m.accActive' : 'adStudio.m.accBlocked')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ ok, label, soft }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${
      ok ? 'bg-emerald-500/15 text-emerald-300' : soft ? 'bg-black/30 text-stone-400' : 'bg-amber-500/15 text-amber-300'
    }`}>
      {ok ? <CheckIcon className="h-3 w-3" /> : <WarnIcon className="h-3 w-3" />} {label}
    </span>
  );
}

export { money, num };

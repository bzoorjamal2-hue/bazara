import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../../api/client.js';
import { Tip } from '../../../components/FormField.jsx';
import {
  ChartIcon, CashIcon, LinkIcon, SendIcon, BagIcon, TrophyIcon, EyeIcon,
  CopyIcon, EditIcon, TrashIcon, LinkOutIcon, ImageIcon, VideoIcon, PlusIcon, KeyIcon,
  CheckIcon, WarnIcon, MegaphoneIcon, SparkleIcon,
} from '../../../components/icons.jsx';
import { cldThumb } from '../../../utils/cloudinary.js';

// لوحةُ الحملات — ما يفتحُه Ads Manager أوّلاً: أين ذهبَ المال وماذا جاءَ به.
//
// وفوقَ ما يعرفُه Ads Manager رقمٌ لا يعرفُه: المحادثاتُ التي بدأت من الإعلانِ بدايركت
// إنستغرام، والطلباتُ التي سُجّلت منها ومبيعاتُها. أغلبُ البيعِ هنا بالرسائلِ لا بموقعٍ
// عليه بكسل، فـ«عائدُ الإعلان» الحقيقيُّ يُحسَبُ من بازارا لا من ميتا.

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
  const hasAny = (tot?.spend || 0) > 0 || (baz?.chats || 0) > 0 || (baz?.orders || 0) > 0;
  const pics = (data.products || []).filter((p) => p.image).slice(0, 3);

  // رحلةُ الشيكل: من المصروفِ إلى البيع، كلُّ محطّةٍ برقمِها ونسبتِها من التي قبلها
  const clicks = tot?.linkClicks || tot?.clicks || 0;
  const path = [
    { k: 'spend', Icon: CashIcon, v: money(tot?.spend, cur) },
    { k: 'reach', Icon: EyeIcon, v: num(tot?.reach) },
    { k: 'clicks', Icon: LinkIcon, v: num(clicks), rate: tot?.reach ? (clicks / tot.reach) * 100 : null },
    { k: 'chats', Icon: SendIcon, v: num(baz?.chats) },
    { k: 'orders', Icon: BagIcon, v: num(baz?.orders), rate: baz?.chats ? ((baz?.orders || 0) / baz.chats) * 100 : null },
    { k: 'revenue', Icon: TrophyIcon, v: money(baz?.revenue, 'ILS'), strong: true },
  ];

  return (
    <div className="bz-ad space-y-4">
      {/* ═══ البداية: إعلانٌ جديدٌ بضغطة ═══ */}
      <div className="bz-ad-hero relative overflow-hidden rounded-[28px] p-5">
        <div className="relative z-10 max-w-[62%]">
          <p className="bz-ad-hero-kick text-[11px] font-extrabold">{t('adStudio.h.kick')}</p>
          <p className="mt-1.5 text-[22px] font-extrabold leading-tight">{t('adStudio.h.title')}</p>
          <p className="bz-ad-hero-sub mt-1.5 text-[12.5px] leading-relaxed">{t('adStudio.h.sub')}</p>
          <button type="button" onClick={onNew} className="bz-ad-hero-btn app-tap mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[14px] font-extrabold">
            <SparkleIcon className="h-5 w-5" /> {t('adStudio.m.new')}
          </button>
        </div>
        {/* ثلاثُ قطعٍ من المتجرِ نفسِه، مائلةً كأنّها إعلاناتٌ جاهزة */}
        <div className="pointer-events-none absolute -end-3 top-1/2 h-[190px] w-[42%] -translate-y-1/2" aria-hidden>
          {pics.map((p, i) => (
            <img key={p.id} src={cldThumb(p.image, 240)} alt="" className={`bz-ad-hero-pic is-${i} absolute rounded-2xl object-cover`} />
          ))}
        </div>
      </div>

      <AccountCard publishing={data.publishing} reload={reload} setErr={setErr} setMsg={setMsg} />

      {/* ═══ النتائج ═══ */}
      <div className="bz-ad-card space-y-4 rounded-3xl p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[15px] font-extrabold"><ChartIcon className="h-5 w-5" /> {t('adStudio.m.resultsTitle')}</p>
          <Tip text={t('adStudio.m.bazaraTip')} />
        </div>
        <div className="bz-ad-seg flex gap-1 overflow-x-auto rounded-2xl p-1" role="tablist" aria-label={t('adStudio.m.period')}>
          {PRESETS.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={preset === p} onClick={() => setPreset(p)}
              className={`bz-ad-segbtn shrink-0 flex-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-[12px] font-bold ${preset === p ? 'is-on' : ''}`}>
              {t(`adStudio.m.p.${p}`)}
            </button>
          ))}
        </div>

        {!ov ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bz-ad-shimmer h-12 rounded-2xl" />)}</div>
        ) : (
          <>
            {/* الجوابُ أوّلاً: كم رجّعَ كلُّ شيكل */}
            <div className={`bz-ad-roas rounded-3xl p-4 ${roas >= 2 ? 'is-good' : ''}`}>
              {roas ? (
                <>
                  <p className="text-[12px] font-bold opacity-80">{t('adStudio.h.roasQ')}</p>
                  <p className="mt-1 font-display text-[34px] font-extrabold leading-tight tabular-nums" dir="ltr">×{roas.toFixed(1)}</p>
                  <p className="text-[13px] font-semibold">{t('adStudio.h.roasLine', { spend: money(tot.spend, cur), revenue: money(baz.revenue, 'ILS') })}</p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-extrabold">{hasAny ? t('adStudio.h.noRoas') : t('adStudio.h.noData')}</p>
                  <p className="mt-1 text-[12px] leading-relaxed opacity-80">{hasAny ? t('adStudio.h.noRoasHint') : t('adStudio.h.noDataHint')}</p>
                </>
              )}
            </div>

            <ol className="bz-ad-path">
              {path.map((s, i) => (
                <li key={s.k} className="relative flex items-center gap-3 py-2">
                  <span className={`bz-ad-path-dot relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ${s.strong ? 'is-strong' : ''}`}><s.Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold">{t(`adStudio.h.path.${s.k}`)}</span>
                    <span className="bz-ad-muted block text-[11px]">{i < 3 ? t('adStudio.m.fromMeta') : t('adStudio.h.fromBazara')}{s.rate != null ? ` · ${s.rate.toFixed(1)}%` : ''}</span>
                  </span>
                  <span className={`shrink-0 tabular-nums ${s.strong ? 'text-[18px] font-extrabold' : 'text-[15px] font-extrabold'}`}>{s.v}</span>
                </li>
              ))}
            </ol>
            {cur !== 'ILS' && tot?.spend > 0 && <p className="bz-ad-note rounded-xl px-3 py-2 text-[11.5px] font-semibold">{t('adStudio.m.currencyNote', { cur })}</p>}

            {ov.daily?.length > 1 && <SpendChart daily={ov.daily} cur={cur} />}

            {!ov.enabled && <p className="bz-ad-soft rounded-2xl p-3.5 text-[12px] leading-relaxed">{t('adStudio.m.metaOff')}</p>}
            {ov.metaError && <p className="bz-ad-note flex items-start gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold"><WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('adStudio.m.metaErr')}</p>}
          </>
        )}
      </div>

      {/* ═══ الحملات ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="flex items-center gap-2 text-[15px] font-extrabold"><MegaphoneIcon className="h-5 w-5" /> {t('adStudio.m.campaignsTitle')}</p>
          {data.campaigns.length > 0 && (
            <button type="button" onClick={onNew} className="bz-ad-ghost app-tap inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold">
              <PlusIcon className="h-4 w-4" /> {t('adStudio.m.new')}
            </button>
          )}
        </div>

        {data.campaigns.length > 0 && (
          <div className="bz-ochips -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist">
            {TABS.map((k) => ((counts[k] || k === 'all') ? (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`bz-ochip app-tap inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${tab === k ? 'is-on' : ''}`}>
                {k !== 'all' && <span className={`bz-ad-dot is-${k} h-1.5 w-1.5 rounded-full`} />}
                {t(`adStudio.m.tab.${k}`)}
                <span className="bz-ochip-n tabular-nums">{counts[k]}</span>
              </button>
            ) : null))}
          </div>
        )}

        {list.length === 0 ? (
          <div className="bz-ad-card flex flex-col items-center gap-2 rounded-3xl px-6 py-10 text-center">
            <span className="bz-ad-goal-ico grid h-14 w-14 place-items-center rounded-2xl"><MegaphoneIcon className="h-7 w-7" /></span>
            <p className="text-[14px] font-extrabold">{t(data.campaigns.length ? 'adStudio.m.emptyTab' : 'adStudio.h.emptyTitle')}</p>
            {!data.campaigns.length && <p className="bz-ad-muted max-w-xs text-[12.5px] leading-relaxed">{t('adStudio.m.empty')}</p>}
            {!data.campaigns.length && (
              <button type="button" onClick={onNew} className="bz-ad-primary app-tap mt-2 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[14px] font-extrabold">
                <SparkleIcon className="h-5 w-5" /> {t('adStudio.h.firstAd')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
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
  const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'ar-PS-u-nu-latn', { day: 'numeric', month: 'numeric' });
  const every = Math.ceil(daily.length / 7); // عناوينُ قليلةٌ لا تتزاحم
  const h = hover >= 0 ? daily[hover] : null;

  return (
    <div className="bz-ad-soft rounded-2xl p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-extrabold">{t('adStudio.m.chartTitle')}</p>
        <p className="bz-ad-muted min-h-[1rem] text-[11px] font-bold tabular-nums" aria-live="polite">
          {h ? `${day(h.date)} · ${money(h.spend, cur)} · ${t('adStudio.m.k.clicks')} ${num(h.clicks)}` : ''}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={t('adStudio.m.chartTitle')} onMouseLeave={() => setHover(-1)}>
        {[0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={padT + (H - padB - padT) * (1 - f)} y2={padT + (H - padB - padT) * (1 - f)} className="bz-ad-grid" strokeWidth="1" />
        ))}
        <line x1="0" x2={W} y1={H - padB} y2={H - padB} className="bz-ad-axis" strokeWidth="1" />
        {/* قيمةُ الخطِّ الأعلى وحدَها — مرجعٌ يُقرأُ منه الطولُ بلا رقمٍ فوقَ كلِّ عمود */}
        <text x={W - 4} y={padT - 8} textAnchor="end" direction="ltr" fontSize="16" className="bz-ad-axis-t">{money(max, cur)}</text>
        {daily.map((d, i) => {
          const bh = Math.max(d.spend > 0 ? 2 : 0, ((H - padB - padT) * d.spend) / max);
          const x = i * step + (step - bw) / 2;
          const y = H - padB - bh;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} tabIndex={0}>
              {/* هدفُ لمسٍ بعرضِ اليومِ كلِّه، أكبرُ من العمود */}
              <rect x={i * step} y={padT} width={step} height={H - padB - padT} fill="transparent" />
              <path
                d={bh > 0 ? `M${x},${H - padB} V${y + Math.min(4, bh)} Q${x},${y} ${x + Math.min(4, bw / 2)},${y} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${y} ${x + bw},${y + Math.min(4, bh)} V${H - padB} Z` : ''}
                className={`bz-ad-barfill ${hover === i ? 'is-on' : ''}`}
              />
              {i % every === 0 && (
                <text x={i * step + step / 2} y={H - 4} textAnchor="middle" fontSize="17" className="bz-ad-axis-t">{day(d.date)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="mt-2">
        <summary className="bz-ad-muted cursor-pointer text-[11.5px] font-bold">{t('adStudio.m.table')}</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-[11.5px] tabular-nums">
            <thead><tr className="bz-ad-muted">
              <th className="py-1 text-start font-bold">{t('adStudio.m.day')}</th>
              <th className="py-1 text-start font-bold">{t('adStudio.m.k.spend')}</th>
              <th className="py-1 text-start font-bold">{t('adStudio.m.k.clicks')}</th>
              <th className="py-1 text-start font-bold">{t('adStudio.m.k.reach')}</th>
              <th className="py-1 text-start font-bold">{t('adStudio.m.k.msgs')}</th>
            </tr></thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date} className="bz-ad-row">
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

// ───────────────────── بطاقةُ الحملة ─────────────────────
function CampaignRow({ c, cur, metrics, baz, busy, canPublish, onOpen, onToggle, onDuplicate, onDelete }) {
  const { t } = useTranslation();
  const st = campaignState(c);
  const live = Boolean(c.metaCampaignId);
  const isVideo = c.settings?.format === 'video';
  const btn = 'bz-ad-icobtn app-tap grid h-10 w-10 shrink-0 place-items-center rounded-xl disabled:opacity-40';

  return (
    <div className={`bz-ad-card overflow-hidden rounded-3xl ${busy ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3 p-3.5">
        <button type="button" onClick={onOpen} className="relative h-[76px] w-[62px] shrink-0 overflow-hidden rounded-2xl" aria-label={t('adStudio.m.view')}>
          {c.productImage
            ? <img src={cldThumb(c.productImage, 160)} alt="" className="h-full w-full object-cover" />
            : <span className="bz-ad-soft grid h-full w-full place-items-center"><ImageIcon className="h-5 w-5 opacity-50" /></span>}
          <span className="absolute bottom-1 start-1 grid h-5 w-5 place-items-center rounded-md bg-black/60 text-white">
            {isVideo ? <VideoIcon className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-[14px] font-extrabold leading-snug">{c.copies?.[c.chosen]?.headline || c.name}</p>
            {live ? (
              <button
                type="button" role="switch" aria-checked={st === 'active'} onClick={onToggle} disabled={busy || !canPublish}
                title={t(st === 'active' ? 'adStudio.m.pause' : 'adStudio.m.activate')}
                className={`bz-ad-livesw relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${st === 'active' ? 'is-on' : ''}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${st === 'active' ? 'start-6' : 'start-1'}`} />
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`bz-ad-state is-${st} inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold`}>
              <span className={`bz-ad-dot is-${st} h-1.5 w-1.5 rounded-full`} /> {t(`adStudio.m.tab.${st}`)}
            </span>
            <span className="bz-ad-meta rounded-full px-2 py-0.5 text-[10.5px] font-bold">{t(`adStudio.goal.${c.goal}`)}</span>
            <span className="bz-ad-meta rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums">₪{c.budget}/{t('adStudio.perDay')} · {t('adStudio.daysN', { n: c.days })}</span>
            {c.settings?.abTest && <span className="bz-ad-meta rounded-full px-2 py-0.5 text-[10.5px] font-bold">A/B</span>}
          </p>
        </div>
      </div>

      {live && (
        <div className="bz-ad-mstats grid grid-cols-3 text-center">
          <Mini label={t('adStudio.m.k.spend')} value={metrics ? money(metrics.spend, cur) : '—'} />
          <Mini label={t('adStudio.m.k.reach')} value={metrics ? num(metrics.reach) : '—'} />
          <Mini label={t('adStudio.m.k.clicks')} value={metrics ? num(metrics.linkClicks || metrics.clicks) : '—'} />
          <Mini label={t('adStudio.m.k.msgs')} value={metrics ? num(metrics.messages) : '—'} />
          <Mini label={t('adStudio.m.k.chats')} value={num(baz?.chats)} />
          <Mini label={t('adStudio.m.k.orders')} value={num(baz?.orders)} strong={(baz?.orders || 0) > 0} />
        </div>
      )}

      <div className="flex items-center gap-2 px-3.5 pb-3.5 pt-1">
        {!live ? (
          <button type="button" onClick={onOpen} className="bz-ad-primary app-tap flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold">
            {st === 'ready' && canPublish ? <><MegaphoneIcon className="h-4 w-4" /> {t('adStudio.m.openPublish')}</> : <><EditIcon className="h-4 w-4" /> {t('adStudio.h.continue')}</>}
          </button>
        ) : (
          <button type="button" onClick={onOpen} className="bz-ad-ghost app-tap flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold">
            <EyeIcon className="h-4 w-4" /> {t('adStudio.m.view')}
          </button>
        )}
        {live && c.managerUrl && (
          <a href={c.managerUrl} target="_blank" rel="noopener noreferrer" className={btn} title={t('adStudio.m.openManager')} aria-label={t('adStudio.m.openManager')}>
            <LinkOutIcon className="h-4 w-4" />
          </a>
        )}
        <button type="button" onClick={onDuplicate} disabled={busy} className={btn} title={t('adStudio.m.duplicate')} aria-label={t('adStudio.m.duplicate')}>
          <CopyIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDelete} disabled={busy} className={`${btn} is-danger`} title={t('common.delete')} aria-label={t('common.delete')}>
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value, strong }) {
  return (
    <div className="bz-ad-mcell px-1 py-2">
      <p className="bz-ad-muted truncate text-[10px] font-bold">{label}</p>
      <p className={`truncate text-[13px] tabular-nums ${strong ? 'font-extrabold' : 'font-bold'}`}>{value}</p>
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
      <div className="bz-ad-soft flex items-start gap-3 rounded-2xl p-3.5">
        <span className="bz-ad-goal-ico grid h-9 w-9 shrink-0 place-items-center rounded-xl"><KeyIcon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold">{t('adStudio.m.accTitle')}</p>
          <p className="bz-ad-muted mt-0.5 text-[12px] leading-relaxed">{t('adStudio.m.accOff')}</p>
        </div>
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
  const allOk = publishing.accountId && publishing.pageLinked && publishing.igLinked;

  return (
    <div className="bz-ad-card space-y-3 rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <span className={`bz-ad-acc grid h-10 w-10 shrink-0 place-items-center rounded-xl ${allOk ? 'is-ok' : ''}`}>{allOk ? <CheckIcon className="h-5 w-5" /> : <KeyIcon className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold">{t('adStudio.m.accTitle')}</p>
          <p className="bz-ad-muted truncate text-[11.5px]">{publishing.accountId ? t('adStudio.m.accOn', { id: publishing.accountId, cur: publishing.currency || '—' }) : t('adStudio.m.accNone')}</p>
        </div>
        <button type="button" onClick={loadAccounts} disabled={busy} className={`${publishing.accountId ? 'bz-ad-ghost' : 'bz-ad-primary'} app-tap shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold`}>
          {publishing.accountId ? t('adStudio.m.accChange') : t('adStudio.m.accLink')}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill ok={publishing.pageLinked} label={t('adStudio.m.chkPage')} />
        <Pill ok={publishing.igLinked} label={t('adStudio.m.chkIg')} />
        <Pill ok={publishing.pixel} label={t('adStudio.m.chkPixel')} soft />
      </div>
      {accounts && (
        <div className="space-y-2">
          {accounts.length === 0 && <p className="bz-ad-muted text-[12px]">{t('adStudio.m.accEmpty')}</p>}
          {accounts.map((a) => (
            <button
              key={a.id} type="button" disabled={busy || !a.active} onClick={() => pick(a)}
              className="bz-ad-chip app-tap flex w-full items-center gap-3 rounded-2xl p-3 text-start disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{a.name}</span>
                <span className="bz-ad-muted block text-[11px] tabular-nums">{a.accountId} · {a.currency}</span>
              </span>
              <span className={`bz-ad-pill ${a.active ? 'is-ok' : 'is-bad'} shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold`}>
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
    <span className={`bz-ad-pill ${ok ? 'is-ok' : soft ? 'is-soft' : 'is-warn'} inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold`}>
      {ok ? <CheckIcon className="h-3 w-3" /> : <WarnIcon className="h-3 w-3" />} {label}
    </span>
  );
}

export { money, num };

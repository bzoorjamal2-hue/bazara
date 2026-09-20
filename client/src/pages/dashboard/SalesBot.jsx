import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Select from '../../components/Select.jsx';
import { PageHead, SectionHead, Field, Tip } from '../../components/FormField.jsx';
import {
  SparkleIcon, InstagramIcon, StoreIcon, CheckIcon, WarnIcon, ClockIcon, TagIcon,
  CashIcon, BoltIcon, SearchIcon, UserIcon, ShieldIcon, XIcon,
} from '../../components/icons.jsx';
import { cldThumb } from '../../utils/cloudinary.js';

// تبويب «البائعة الآلية» — تضبط التاجرة من هنا من يردّ على زبونتها حين تكون هي
// مشغولة، وبأي أسلوب، وإلى أي سعر مسموح له أن ينزل.
//
// ترتيب الأقسام مقصود: مفتاح التشغيل أولاً (أهم قرار)، ثم الشخصية، ثم المفاصلة
// (أخطر قسم فله بطاقته وحده)، وأخيراً التجربة — فلا تشغّلها على زبونة حقيقية قبل
// أن تسمع كيف تتكلّم.

const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
const BOX = 'rounded-2xl border border-gold-400/15 bg-black/20 p-4';

export default function SalesBot() {
  const { t } = useTranslation();
  const [s, setS] = useState(null);          // الإعدادات
  const [products, setProducts] = useState([]);
  const [smart, setSmart] = useState(true);  // هل بالخادم مزوّد ذكاء؟
  const [storeName, setStoreName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/bot/settings')
      .then((r) => {
        setS(r.data.settings);
        setProducts(r.data.products || []);
        setSmart(r.data.smart);
        setStoreName(r.data.storeName || '');
      })
      .catch((e) => setErr(getErrorMessage(e)));
  }, []);

  const set = (patch) => { setS((prev) => ({ ...prev, ...patch })); setDirty(true); setMsg(''); };

  const save = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      const r = await api.put('/bot/settings', s);
      setS(r.data.settings);
      setDirty(false);
      setMsg(t('salesBot.saved'));
    } catch (e) { setErr(getErrorMessage(e)); }
    setSaving(false);
  };

  if (!s) {
    return (
      <div className="space-y-4">
        <PageHead icon={<SparkleIcon className="h-6 w-6" />} title={t('salesBot.title')} hint={t('salesBot.hint')} />
        {err
          ? <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{err}</p>
          : <div className={CARD}><p className="text-sm text-stone-400">{t('common.loading')}</p></div>}
      </div>
    );
  }

  const chan = new Set(s.channels || []);
  const toggleChan = (key) => {
    const next = new Set(chan);
    if (next.has(key)) next.delete(key); else next.add(key);
    set({ channels: [...next] });
  };

  const quotaPct = Math.min(100, Math.round((s.quotaUsed / Math.max(1, s.quotaTotal)) * 100));

  return (
    <div className="space-y-4">
      <PageHead
        icon={<SparkleIcon className="h-6 w-6" />}
        title={t('salesBot.title')}
        hint={t('salesBot.hint')}
        action={(
          <button onClick={save} disabled={!dirty || saving} className="btn-primary gap-2 disabled:opacity-50">
            <CheckIcon className="h-5 w-5" /> {saving ? t('salesBot.saving') : t('common.save')}
          </button>
        )}
      />

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

      {/* ═══ التشغيل ═══ */}
      <div className={CARD}>
        <SectionHead icon={<BoltIcon className="h-5 w-5" />} title={t('salesBot.power.title')} desc={t('salesBot.power.desc')} />

        <button
          type="button"
          role="switch"
          aria-checked={s.enabled}
          onClick={() => set({ enabled: !s.enabled })}
          className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition ${
            s.enabled ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-gold-400/20 bg-black/20'
          }`}
        >
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${s.enabled ? 'bg-emerald-500' : 'bg-stone-500/50'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${s.enabled ? 'start-6' : 'start-1'}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-stone-100">
              {s.enabled ? t('salesBot.power.on') : t('salesBot.power.off')}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">
              {s.enabled ? t('salesBot.power.onHint') : t('salesBot.power.offHint')}
            </span>
          </span>
        </button>

        <Field label={t('salesBot.channels.label')} tip={t('salesBot.channels.tip')}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'site', label: t('salesBot.channels.site'), Icon: StoreIcon },
              { key: 'instagram', label: t('salesBot.channels.instagram'), Icon: InstagramIcon },
            ].map((c) => {
              const on = chan.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleChan(c.key)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    on ? 'border-[#999795] bg-[#999795] text-[#313130] shadow-sm' : 'border-gold-400/25 text-stone-300 hover:bg-gold-400/10 hover:text-gold-200'
                  }`}
                >
                  <c.Icon className="h-4 w-4" /> {c.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* وضعُ التجربة: يظهرُ حين تكونُ قناةُ إنستغرام مفتوحةً وحدَها — فهو حارسُها.
            مساعِدةُ الموقعِ بلا هويّةٍ للزائر، فلا معنى لقائمةِ أسماءٍ فيها. */}
        {chan.has('instagram') && (
          <div className={`rounded-2xl border p-4 ${s.testOnly ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-gold-400/20 bg-black/20'}`}>
            <button
              type="button"
              role="switch"
              aria-checked={s.testOnly}
              onClick={() => set({ testOnly: !s.testOnly })}
              className="flex w-full items-center gap-3 text-start"
            >
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${s.testOnly ? 'bg-emerald-500' : 'bg-stone-500/50'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${s.testOnly ? 'start-6' : 'start-1'}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-extrabold text-stone-100">
                  <ShieldIcon className="h-4 w-4" /> {t('salesBot.test.label')}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">{t('salesBot.test.hint')}</span>
              </span>
            </button>

            {s.testOnly && (
              <div className="mt-3">
                <TestAccounts
                  values={s.testAccounts || []}
                  onChange={(v) => set({ testAccounts: v })}
                />
                {(s.testAccounts || []).length === 0 && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-300">
                    <WarnIcon className="mt-px h-3.5 w-3.5 shrink-0" /> {t('salesBot.test.empty')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <Field label={t('salesBot.mode.label')} tip={t('salesBot.mode.tip')}>
          <Select
            value={s.mode}
            onChange={(v) => set({ mode: v })}
            options={['always', 'first', 'offhours'].map((k) => ({ value: k, label: t(`salesBot.mode.${k}`) }))}
          />
        </Field>

        {s.mode === 'offhours' && (
          <div className={BOX}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-stone-400">
              <ClockIcon className="h-4 w-4" /> {t('salesBot.hours.label')} <Tip text={t('salesBot.hours.tip')} />
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-stone-400">{t('salesBot.hours.from')}</span>
                <input type="time" className="input" value={s.hours?.from || '09:00'} onChange={(e) => set({ hours: { ...s.hours, from: e.target.value } })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-stone-400">{t('salesBot.hours.to')}</span>
                <input type="time" className="input" value={s.hours?.to || '21:00'} onChange={(e) => set({ hours: { ...s.hours, to: e.target.value } })} />
              </label>
            </div>
          </div>
        )}

        {/* الحصّة: التاجرة تستحقّ أن ترى أين صارت قبل أن تتبدّل نبرة الردود */}
        <div className={BOX}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-stone-400">
              <SparkleIcon className="h-4 w-4" /> {t('salesBot.quota.label')} <Tip text={t('salesBot.quota.tip')} />
            </span>
            <span className="shrink-0 rounded-full bg-gold-400/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-gold-200">
              {s.quotaLeft} / {s.quotaTotal}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-gradient-to-r from-[#BAB9B7] to-[#999795] transition-all" style={{ width: `${quotaPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-400">
            <span className="tabular-nums">{t('salesBot.stats.replies', { n: s.repliesTotal })}</span>
            <span className="tabular-nums">{t('salesBot.stats.handoffs', { n: s.handoffsTotal })}</span>
          </div>
        </div>

        {!smart && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold leading-relaxed text-amber-300">
            <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('salesBot.freeMode')}
          </p>
        )}
      </div>

      {/* ═══ الشخصية ═══ */}
      <div className={CARD}>
        <SectionHead icon={<UserIcon className="h-5 w-5" />} title={t('salesBot.persona.title')} desc={t('salesBot.persona.desc')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('salesBot.tone.label')} tip={t('salesBot.tone.tip')}>
            <Select
              value={s.tone}
              onChange={(v) => set({ tone: v })}
              options={['warm', 'short', 'formal'].map((k) => ({ value: k, label: t(`salesBot.tone.${k}`) }))}
            />
          </Field>
          <Field label={t('salesBot.dialect.label')} tip={t('salesBot.dialect.tip')}>
            <Select
              value={s.dialect}
              onChange={(v) => set({ dialect: v })}
              options={['ps', 'sy', 'eg', 'gulf', 'msa'].map((k) => ({ value: k, label: t(`salesBot.dialect.${k}`) }))}
            />
          </Field>
        </div>

        <Field label={t('salesBot.signature.label')} tip={t('salesBot.signature.tip')} hint={t('salesBot.signature.hint')} max={120} value={s.signature}>
          <input
            className="input"
            maxLength={120}
            value={s.signature}
            onChange={(e) => set({ signature: e.target.value })}
            placeholder={t('salesBot.signature.placeholder')}
          />
        </Field>

        <Field label={t('salesBot.notes.label')} tip={t('salesBot.notes.tip')} hint={t('salesBot.notes.hint')} max={2000} value={s.notes}>
          <textarea
            className="input resize-none"
            rows={4}
            maxLength={2000}
            value={s.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder={t('salesBot.notes.placeholder')}
          />
        </Field>
      </div>

      {/* ═══ القطعة المروَّجة والمفاصلة ═══ */}
      <PricingCard
        s={s}
        set={set}
        products={products}
        setProducts={setProducts}
        onError={setErr}
      />

      {/* ═══ التجربة ═══ */}
      <TryBox storeName={storeName} enabled={s.enabled} />
    </div>
  );
}

// حساباتُ التجربة: أسماءُ إنستغرام التي يُسمَحُ للبائعةِ بمكالمتِها وحدَها.
function TestAccounts({ values, onChange }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const add = () => {
    // نقبلُ ‎@name وname معاً وننظّفُهما — الفرقُ بينهما يُفشلُ الحارسَ صامتاً
    const v = text.trim().replace(/^@+/, '').toLowerCase();
    if (!v || values.includes(v) || values.length >= 10) { setText(''); return; }
    onChange([...values, v]);
    setText('');
  };
  return (
    <>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={t('salesBot.test.placeholder')}
        />
        <button type="button" onClick={add} className="btn-ghost shrink-0 px-4 text-xs">{t('common.add')}</button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              @{v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-emerald-300/70 transition hover:text-red-300">
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────── القطعة المروَّجة + أرضيّات الأسعار ─────────────────────

function PricingCard({ s, set, products, setProducts, onError }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? products.filter((p) => p.name.toLowerCase().includes(needle)) : products;
    // القطع التي لها أرضيّة أولاً: هي ما تراجعه التاجرة، والباقي للبحث
    return [...list].sort((a, b) => (b.floorPrice != null) - (a.floorPrice != null)).slice(0, needle ? 30 : 12);
  }, [products, q]);

  const saveFloor = async (id, raw) => {
    const value = String(raw).trim() === '' ? null : Number(raw);
    const before = products.find((p) => p.id === id)?.floorPrice ?? null;
    if (value === before) return;
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, floorPrice: value } : p)));
    try {
      await api.put('/bot/floor', { productId: id, floorPrice: value });
    } catch (e) {
      setProducts((list) => list.map((p) => (p.id === id ? { ...p, floorPrice: before } : p)));
      onError(getErrorMessage(e));
    }
  };

  const withFloor = products.filter((p) => p.floorPrice != null).length;

  return (
    <div className={CARD}>
      <SectionHead icon={<TagIcon className="h-5 w-5" />} title={t('salesBot.pricing.title')} desc={t('salesBot.pricing.desc')} />

      <Field label={t('salesBot.promo.label')} tip={t('salesBot.promo.tip')} hint={t('salesBot.promo.hint')}>
        <Select
          value={s.promoProduct || ''}
          onChange={(v) => set({ promoProduct: v })}
          placeholder={t('salesBot.promo.none')}
          options={[{ value: '', label: t('salesBot.promo.none') },
            ...products.map((p) => ({ value: p.id, label: `${p.name} — ₪${p.price}` }))]}
        />
      </Field>

      <button
        type="button"
        role="switch"
        aria-checked={s.haggle}
        onClick={() => set({ haggle: !s.haggle })}
        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition ${
          s.haggle ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-gold-400/20 bg-black/20'
        }`}
      >
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${s.haggle ? 'bg-emerald-500' : 'bg-stone-500/50'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${s.haggle ? 'start-6' : 'start-1'}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-stone-100">{t('salesBot.haggle.label')}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">{t('salesBot.haggle.hint')}</span>
        </span>
      </button>

      {s.haggle && (
        <>
          <Field label={t('salesBot.steps.label')} tip={t('salesBot.steps.tip')}>
            <Select
              value={String(s.haggleSteps)}
              onChange={(v) => set({ haggleSteps: Number(v) })}
              options={[1, 2, 3].map((n) => ({ value: String(n), label: t('salesBot.steps.n', { n }) }))}
            />
          </Field>

          <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold leading-relaxed text-amber-300">
            <WarnIcon className="mt-px h-4 w-4 shrink-0" /> {t('salesBot.haggle.siteNote')}
          </p>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-stone-400">
                <CashIcon className="h-4 w-4" /> {t('salesBot.floors.label')} <Tip text={t('salesBot.floors.tip')} />
              </span>
              <span className="shrink-0 rounded-full bg-gold-400/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-gold-200">
                {t('salesBot.floors.count', { n: withFloor })}
              </span>
            </div>

            <div className="relative mb-2">
              <SearchIcon className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500 start-3" />
              <input
                className="input ps-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('salesBot.floors.search')}
              />
            </div>

            <div className="space-y-2">
              {shown.map((p) => (
                <FloorRow key={p.id} p={p} onSave={saveFloor} />
              ))}
              {shown.length === 0 && <p className="py-4 text-center text-xs text-stone-400">{t('salesBot.floors.empty')}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FloorRow({ p, onSave }) {
  const { t } = useTranslation();
  const [v, setV] = useState(p.floorPrice != null ? String(p.floorPrice) : '');
  useEffect(() => { setV(p.floorPrice != null ? String(p.floorPrice) : ''); }, [p.floorPrice]);

  // نسبة النزول القصوى — الرقم الذي تريد التاجرة رؤيته فعلاً قبل أن تقرّر
  const cut = p.floorPrice != null && p.price > 0
    ? Math.round(((p.price - p.floorPrice) / p.price) * 100)
    : null;

  return (
    <div className={`${BOX} flex flex-wrap items-center gap-3`}>
      <span className="dash-avatar grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl">
        {p.image ? <img src={cldThumb(p.image, 120)} alt="" className="h-full w-full object-cover" /> : <TagIcon className="h-5 w-5 text-stone-500" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-stone-100">{p.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-stone-400">
          <span className="tabular-nums">₪{p.price}</span> · {p.stock}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {cut != null && (
          <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-gold-200">−{cut}%</span>
        )}
        <input
          type="number"
          inputMode="decimal"
          min="1"
          className="input w-24 text-center tabular-nums"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onSave(p.id, v)}
          placeholder={t('salesBot.floors.placeholder')}
        />
      </div>
    </div>
  );
}

// ───────────────────── التجربة ─────────────────────

// تجربة حيّة بلا إرسال لأحد: التاجرة تكتب كما تكتب زبونتها وتسمع الردّ. هذا
// وحده ما يجعلها تضغط «شغّليها» — الوصف لا يقنع أحداً بأن يسلّم صوت متجره.
function TryBox({ storeName, enabled }) {
  const { t } = useTranslation();
  const [chat, setChat] = useState([]);   // [{role, content, handoff, usedAi}]
  const [text, setText] = useState('');
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat, busy]);

  const send = async (preset) => {
    const body = String(preset ?? text).trim();
    if (!body || busy) return;
    const next = [...chat, { role: 'user', content: body }];
    setChat(next); setText(''); setBusy(true); setErr('');
    try {
      const r = await api.post('/bot/try', {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        stage,
      });
      setStage(r.data.stage || 0);
      setChat([...next, { role: 'assistant', content: r.data.reply, handoff: r.data.handoff, usedAi: r.data.usedAi }]);
    } catch (e) {
      setErr(getErrorMessage(e));
      setChat(next);
    }
    setBusy(false);
  };

  const reset = () => { setChat([]); setStage(0); setErr(''); };

  return (
    <div className={CARD}>
      <SectionHead icon={<SparkleIcon className="h-5 w-5" />} title={t('salesBot.try.title')} desc={t('salesBot.try.desc')} />

      {!enabled && (
        <p className="flex items-start gap-2 rounded-xl border border-gold-400/25 bg-gold-400/5 px-4 py-2.5 text-xs font-semibold leading-relaxed text-stone-300">
          <SparkleIcon className="mt-px h-4 w-4 shrink-0" /> {t('salesBot.try.offNote')}
        </p>
      )}

      <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-2xl border border-gold-400/15 bg-black/20 p-3">
        {chat.length === 0 && (
          <p className="py-6 text-center text-xs leading-relaxed text-stone-400">{t('salesBot.try.empty', { store: storeName })}</p>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#999795] text-[#313130]'
                  : 'border border-gold-400/20 bg-black/25 text-stone-200'
              }`}
            >
              {m.content}
              {m.role === 'assistant' && m.handoff && (
                <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-300">
                  <WarnIcon className="h-3 w-3" /> {t('salesBot.try.handoff')}
                </span>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="px-1 text-xs text-stone-400">{t('salesBot.try.typing')}</p>}
        <div ref={endRef} />
      </div>

      {err && <p className="text-xs font-semibold text-red-300">{err}</p>}

      {/* أسئلة تُسأل فعلاً بكل يوم — البدء من صندوق فارغ أصعب ما بالتجربة */}
      <div className="flex flex-wrap gap-1.5">
        {['stock', 'price', 'haggle', 'complaint'].map((k) => (
          <button
            key={k}
            type="button"
            disabled={busy}
            onClick={() => send(t(`salesBot.try.samples.${k}`))}
            className="inline-flex items-center rounded-full border border-gold-400/25 bg-gold-400/5 px-3 py-1.5 text-[11px] font-semibold text-stone-300 transition hover:bg-gold-400/15 hover:text-gold-200 disabled:opacity-50"
          >
            {t(`salesBot.try.samples.${k}`)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder={t('salesBot.try.placeholder')}
        />
        <button onClick={() => send()} disabled={busy || !text.trim()} className="btn-primary shrink-0 gap-1.5 px-4 disabled:opacity-50">
          <SparkleIcon className="h-4 w-4" /> {t('salesBot.try.send')}
        </button>
      </div>

      {chat.length > 0 && (
        <button type="button" onClick={reset} className="btn-ghost w-full text-xs">{t('salesBot.try.reset')}</button>
      )}
    </div>
  );
}

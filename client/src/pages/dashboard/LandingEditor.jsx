import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { PageHead, SectionHead, Field, Tip } from '../../components/FormField.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import {
  HomeIcon, SparkleIcon, CheckIcon, TrashIcon, PlusIcon, VideoIcon,
  EyeIcon, EyeOffIcon, ImageIcon, GridIcon, NoteIcon, UsersIcon, MailIcon,
} from '../../components/icons.jsx';

// محرّر صفحة الواجهة — أوّل ما يراه الزائر من جوجل أو من رابطٍ بإنستغرام.
//
// الفارغ يعني «استخدم النصّ الأصلي»: تبقى الصفحة كاملةً ومترجَمةً بلغتين قبل
// أن يُكتب فيها حرف، ولا يُضطرّ المدير لملء ثلاثين حقلاً ليُطلق شيئاً.

const CARD = 'dash-section glass space-y-4 p-5';

// صفّ عنصرٍ قابل للحذف داخل قائمة (ميزة/خطوة/شهادة)
function Item({ children, onRemove, label }) {
  return (
    <div className="space-y-3 rounded-2xl border border-gold-400/15 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-gold-300">{label}</span>
        <button type="button" onClick={onRemove} className="app-tap rounded-full p-1.5 text-red-300 transition hover:bg-red-500/10">
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

export default function LandingEditor() {
  const { t } = useTranslation();
  const [L, setL] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/site/banners')
      .then((r) => {
        const d = r.data?.landing || {};
        setL({
          hero: { badge: '', title: '', subtitle: '', image: '', video: '', dim: 62, chips: [], ...(d.hero || {}) },
          features: d.features || [],
          steps: d.steps || [],
          testimonials: d.testimonials || [],
          faq: d.faq || [],
          cta: { title: '', subtitle: '', ...(d.cta || {}) },
          about: { title: '', text: '', ...(d.about || {}) },
          contact: { title: '', email: '', phone: '', address: '', hours: '', ...(d.contact || {}) },
          hidden: d.hidden || [],
        });
      })
      .catch((e) => setErr(getErrorMessage(e)));
  }, []);

  if (!L) return err ? <p className="text-sm text-red-300">{err}</p> : <Spinner />;

  const setHero = (k, v) => setL((p) => ({ ...p, hero: { ...p.hero, [k]: v } }));
  const setCta = (k, v) => setL((p) => ({ ...p, cta: { ...p.cta, [k]: v } }));
  const setAbout = (k, v) => setL((p) => ({ ...p, about: { ...p.about, [k]: v } }));
  const setContact = (k, v) => setL((p) => ({ ...p, contact: { ...p.contact, [k]: v } }));
  const setIn = (key, i, k, v) =>
    setL((p) => ({ ...p, [key]: p[key].map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const addTo = (key, blank) => setL((p) => ({ ...p, [key]: [...p[key], blank] }));
  const rmFrom = (key, i) => setL((p) => ({ ...p, [key]: p[key].filter((_, j) => j !== i) }));
  const toggleHidden = (k) =>
    setL((p) => ({ ...p, hidden: p.hidden.includes(k) ? p.hidden.filter((x) => x !== k) : [...p.hidden, k] }));

  const save = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      // نرسل الواجهة وحدها — الخادم يُبقي كلّ ما لم يُرسَل كما هو، فلا يمسح
      // هذا الحفظُ شرائحَ الصفحة الرئيسية ولا فئات المنصّة.
      await api.put('/site/banners', { landing: L });
      setMsg(t('admin.land.saved'));
      setTimeout(() => setMsg(''), 3500);
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const SECTIONS = [
    { key: 'stats', label: t('admin.land.secStats'), Icon: GridIcon },
    { key: 'shelf', label: t('admin.land.secShelf'), Icon: ImageIcon },
    { key: 'features', label: t('admin.land.secFeatures'), Icon: SparkleIcon },
    { key: 'steps', label: t('admin.land.secSteps'), Icon: NoteIcon },
    { key: 'testimonials', label: t('admin.land.secQuotes'), Icon: UsersIcon },
    { key: 'faq', label: t('admin.land.secFaq'), Icon: NoteIcon },
  ];

  return (
    <div className="space-y-5">
      <PageHead icon={<HomeIcon className="h-6 w-6" />} title={t('admin.land.title')} hint={t('admin.land.hint')} />

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}
      {err && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{err}</div>}

      {/* ─── الهيرو ─── */}
      <div className={CARD}>
        <SectionHead icon={<ImageIcon className="h-5 w-5" />} title={t('admin.land.heroTitle')} desc={t('admin.land.heroHint')} />

        <Field label={t('admin.land.badge')} tip={t('admin.land.badgeTip')} max={60} value={L.hero.badge}>
          <input className="input" maxLength={60} value={L.hero.badge} onChange={(e) => setHero('badge', e.target.value)} placeholder={t('landing.badge')} />
        </Field>
        <Field label={t('admin.land.headline')} tip={t('admin.land.headlineTip')} max={120} value={L.hero.title}>
          <input className="input" maxLength={120} value={L.hero.title} onChange={(e) => setHero('title', e.target.value)} placeholder={t('landing.title')} />
        </Field>
        <Field label={t('admin.land.sub')} max={300} value={L.hero.subtitle}>
          <textarea rows={3} className="input resize-none" maxLength={300} value={L.hero.subtitle} onChange={(e) => setHero('subtitle', e.target.value)} placeholder={t('landing.subtitle')} />
        </Field>

        <Field label={t('admin.land.heroImage')} tip={t('admin.land.heroImageTip')}>
          <ImageInput value={L.hero.image} onChange={(v) => setHero('image', v)} />
        </Field>

        <Field label={t('admin.land.heroVideo')} tip={t('admin.land.heroVideoTip')}>
          <div className="flex items-center gap-2">
            <VideoIcon className="h-4 w-4 shrink-0 text-gold-300" />
            <input
              className="input min-w-0 flex-1" dir="ltr" maxLength={500}
              value={L.hero.video} onChange={(e) => setHero('video', e.target.value)}
              placeholder="https://…/hero.mp4"
            />
          </div>
        </Field>
        {L.hero.video && !/^https:\/\/\S+\.(mp4|webm|mov|m4v)(\?\S*)?$/i.test(L.hero.video.trim()) && (
          <p className="text-[11px] font-semibold text-amber-400">{t('admin.land.videoBad')}</p>
        )}

        {/* التعتيم — يظهر فقط حين توجد خلفية، فلا معنى له بلا صورة أو فيديو.
            المعاينة بنفس تدرّج الصفحة حرفياً، فما تُرى هنا هو ما سيظهر. */}
        {(L.hero.image || L.hero.video) && (
          <div className="space-y-2 border-t border-gold-400/10 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-stone-100">
                {t('admin.land.dim')} <Tip text={t('admin.land.dimTip')} />
              </span>

            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={L.hero.dim ?? 62}
              onChange={(e) => setHero('dim', Number(e.target.value))}
              className="bz-range w-full"
              aria-label={t('admin.land.dim')}
            />
            <div className="flex justify-between text-[10.5px] font-semibold text-stone-400">
              <span>{t('admin.land.dimLow')}</span>
              <span>{t('admin.land.dimHigh')}</span>
            </div>

            <div
              className="relative h-32 overflow-hidden rounded-2xl ring-1 ring-gold-400/20"
              style={{
                backgroundImage: L.hero.image ? `url(${L.hero.image})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#3f2e22',
                // eslint-disable-next-line
                ['--bz-dim']: (L.hero.dim ?? 62) / 100,
              }}
            >
              <span className="bz-veil-preview absolute inset-0" aria-hidden="true" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center">
                <span className="text-[15px] font-extrabold text-[#F4EDE2]">{t('admin.land.dimSample')}</span>
                <span className="text-[11px] text-[#F4EDE2]/80">{t('admin.land.dimSampleSub')}</span>
              </span>
            </div>
            {!L.hero.image && L.hero.video && (
              <p className="text-[11px] text-stone-400">{t('admin.land.dimVideoNote')}</p>
            )}
          </div>
        )}

        {/* شارات الميزات فوق الأزرار */}
        <div className="space-y-2 border-t border-gold-400/10 pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-stone-100">{t('admin.land.ticks')}</span>
            {L.hero.chips.length < 4 && (
              <button type="button" onClick={() => setHero('chips', [...L.hero.chips, { label: '' }])} className="btn-ghost !py-1.5 text-xs">
                ＋ {t('common.add')}
              </button>
            )}
          </div>
          {L.hero.chips.length === 0 ? (
            <p className="text-[11px] text-stone-400">{t('admin.land.ticksEmpty')}</p>
          ) : (
            L.hero.chips.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input min-w-0 flex-1" maxLength={40} value={c.label || ''} onChange={(e) => setHero('chips', L.hero.chips.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <button type="button" onClick={() => setHero('chips', L.hero.chips.filter((_, j) => j !== i))} className="app-tap rounded-full p-2 text-red-300 transition hover:bg-red-500/10">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── إظهار/إخفاء الأقسام ─── */}
      <div className={CARD}>
        <SectionHead icon={<EyeIcon className="h-5 w-5" />} title={t('admin.land.secTitle')} desc={t('admin.land.secHint')} />
        <div className="grid gap-2 sm:grid-cols-2">
          {SECTIONS.map(({ key, label, Icon }) => {
            const on = !L.hidden.includes(key);
            return (
              <button
                key={key} type="button" onClick={() => toggleHidden(key)}
                className={`app-tap flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-start ring-1 transition ${on ? 'bg-gold-400/10 text-stone-100 ring-gold-400/30' : 'bg-black/20 text-stone-400 ring-cream/10'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{label}</span>
                {on ? <EyeIcon className="h-4 w-4 text-gold-300" /> : <EyeOffIcon className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── الميزات ─── */}
      <div className={CARD}>
        <SectionHead icon={<SparkleIcon className="h-5 w-5" />} title={t('admin.land.featTitle')} desc={t('admin.land.listHint')} />
        {L.features.map((f, i) => (
          <Item key={i} label={`${t('admin.land.feature')} ${i + 1}`} onRemove={() => rmFrom('features', i)}>
            <input className="input" maxLength={60} placeholder={t('admin.land.itemTitle')} value={f.title || ''} onChange={(e) => setIn('features', i, 'title', e.target.value)} />
            <textarea rows={2} className="input resize-none" maxLength={220} placeholder={t('admin.land.itemDesc')} value={f.desc || ''} onChange={(e) => setIn('features', i, 'desc', e.target.value)} />
          </Item>
        ))}
        {L.features.length < 8 && (
          <button type="button" onClick={() => addTo('features', { title: '', desc: '' })} className="btn-ghost w-full !py-2 text-xs">
            <PlusIcon className="h-3.5 w-3.5" /> {t('admin.land.addFeature')}
          </button>
        )}
      </div>

      {/* ─── الخطوات ─── */}
      <div className={CARD}>
        <SectionHead icon={<NoteIcon className="h-5 w-5" />} title={t('admin.land.stepTitle')} desc={t('admin.land.listHint')} />
        {L.steps.map((s, i) => (
          <Item key={i} label={`${t('admin.land.step')} ${i + 1}`} onRemove={() => rmFrom('steps', i)}>
            <input className="input" maxLength={60} placeholder={t('admin.land.itemTitle')} value={s.title || ''} onChange={(e) => setIn('steps', i, 'title', e.target.value)} />
            <textarea rows={2} className="input resize-none" maxLength={220} placeholder={t('admin.land.itemDesc')} value={s.desc || ''} onChange={(e) => setIn('steps', i, 'desc', e.target.value)} />
          </Item>
        ))}
        {L.steps.length < 4 && (
          <button type="button" onClick={() => addTo('steps', { title: '', desc: '' })} className="btn-ghost w-full !py-2 text-xs">
            <PlusIcon className="h-3.5 w-3.5" /> {t('admin.land.addStep')}
          </button>
        )}
      </div>

      {/* ─── الشهادات ─── */}
      <div className={CARD}>
        <SectionHead icon={<UsersIcon className="h-5 w-5" />} title={t('admin.land.quoteTitle')} desc={t('admin.land.listHint')} />
        {L.testimonials.map((q, i) => (
          <Item key={i} label={`${t('admin.land.quote')} ${i + 1}`} onRemove={() => rmFrom('testimonials', i)}>
            <textarea rows={2} className="input resize-none" maxLength={300} placeholder={t('admin.land.quoteText')} value={q.text || ''} onChange={(e) => setIn('testimonials', i, 'text', e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" maxLength={60} placeholder={t('admin.land.quoteName')} value={q.name || ''} onChange={(e) => setIn('testimonials', i, 'name', e.target.value)} />
              <input className="input" maxLength={60} placeholder={t('admin.land.quoteStore')} value={q.store || ''} onChange={(e) => setIn('testimonials', i, 'store', e.target.value)} />
            </div>
          </Item>
        ))}
        {L.testimonials.length < 6 && (
          <button type="button" onClick={() => addTo('testimonials', { text: '', name: '', store: '' })} className="btn-ghost w-full !py-2 text-xs">
            <PlusIcon className="h-3.5 w-3.5" /> {t('admin.land.addQuote')}
          </button>
        )}
      </div>

      {/* ─── الأسئلة الشائعة ─── */}
      <div className={CARD}>
        <SectionHead icon={<NoteIcon className="h-5 w-5" />} title={t('admin.land.faqTitle')} desc={t('admin.land.faqHint')} />
        {L.faq.map((f, i) => (
          <Item key={i} label={`${t('admin.land.question')} ${i + 1}`} onRemove={() => rmFrom('faq', i)}>
            <input
              className="input"
              maxLength={120}
              placeholder={t('admin.land.faqQ')}
              value={f.q || ''}
              onChange={(e) => setIn('faq', i, 'q', e.target.value)}
            />
            <textarea
              rows={2}
              className="input resize-none"
              maxLength={400}
              placeholder={t('admin.land.faqA')}
              value={f.a || ''}
              onChange={(e) => setIn('faq', i, 'a', e.target.value)}
            />
          </Item>
        ))}
        {L.faq.length < 8 && (
          <button type="button" onClick={() => addTo('faq', { q: '', a: '' })} className="btn-ghost w-full !py-2 text-xs">
            <PlusIcon className="h-3.5 w-3.5" /> {t('admin.land.addFaq')}
          </button>
        )}
      </div>

      {/* ─── الختام ─── */}
      <div className={CARD}>
        <SectionHead icon={<CheckIcon className="h-5 w-5" />} title={t('admin.land.ctaTitle')} desc={t('admin.land.ctaHint')} />
        <Field label={t('admin.land.headline')} max={120} value={L.cta.title}>
          <input className="input" maxLength={120} value={L.cta.title} onChange={(e) => setCta('title', e.target.value)} placeholder={t('landing.ctaTitle')} />
        </Field>
        <Field label={t('admin.land.sub')} max={300} value={L.cta.subtitle}>
          <textarea rows={2} className="input resize-none" maxLength={300} value={L.cta.subtitle} onChange={(e) => setCta('subtitle', e.target.value)} placeholder={t('landing.ctaDesc')} />
        </Field>
      </div>

      {/* ─── من نحن ─── */}
      <div className={CARD}>
        <SectionHead icon={<UsersIcon className="h-5 w-5" />} title={t('admin.land.aboutTitle')} desc={t('admin.land.aboutHint')} />
        <Field label={t('admin.land.headline')} max={80} value={L.about.title}>
          <input className="input" maxLength={80} value={L.about.title} onChange={(e) => setAbout('title', e.target.value)} placeholder={t('landing.aboutTitle')} />
        </Field>
        <Field label={t('admin.land.sub')} max={700} value={L.about.text}>
          <textarea rows={6} className="input resize-none" maxLength={700} value={L.about.text} onChange={(e) => setAbout('text', e.target.value)} placeholder={t('landing.aboutText')} />
        </Field>
      </div>

      {/* ─── تواصلوا معنا ─── */}
      <div className={CARD}>
        <SectionHead icon={<MailIcon className="h-5 w-5" />} title={t('admin.land.contactTitle')} desc={t('admin.land.contactHint')} />
        <Field label={t('admin.land.headline')} max={80} value={L.contact.title}>
          <input className="input" maxLength={80} value={L.contact.title} onChange={(e) => setContact('title', e.target.value)} placeholder={t('landing.contactTitle')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('admin.land.fEmail')} max={120} value={L.contact.email}>
            <input type="email" dir="ltr" className="input" maxLength={120} value={L.contact.email} onChange={(e) => setContact('email', e.target.value)} placeholder="hello@bazarastore.site" />
          </Field>
          <Field label={t('admin.land.fPhone')} max={20} value={L.contact.phone}>
            <input type="tel" dir="ltr" className="input" maxLength={20} value={L.contact.phone} onChange={(e) => setContact('phone', e.target.value)} placeholder="+970599000000" />
          </Field>
        </div>
        <Field label={t('admin.land.fAddress')} max={160} value={L.contact.address}>
          <input className="input" maxLength={160} value={L.contact.address} onChange={(e) => setContact('address', e.target.value)} />
        </Field>
        <Field label={t('admin.land.fHours')} max={120} value={L.contact.hours}>
          <input className="input" maxLength={120} value={L.contact.hours} onChange={(e) => setContact('hours', e.target.value)} placeholder={t('admin.land.fHoursPh')} />
        </Field>
      </div>

      <div className="sticky bottom-4 z-10">
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full shadow-xl">
          {busy ? t('common.loading') : t('admin.land.save')}
        </button>
      </div>

      <a href="/" target="_blank" rel="noreferrer" className="block text-center text-[12px] font-bold text-gold-300 transition hover:text-gold-200">
        {t('admin.land.preview')}
      </a>
    </div>
  );
}

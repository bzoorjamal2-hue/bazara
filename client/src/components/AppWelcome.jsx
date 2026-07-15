import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from './Logo.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { BagIcon, ForwardIcon, TruckIcon, CashIcon, CheckIcon } from './icons.jsx';

// شاشة افتتاح التطبيق المثبّت (standalone) — تصميم فخم بألوان Bazara.
// كل الحركات المستمرة صارت CSS خالص على الـGPU (بلا framer-motion) لتفادي التعليق:
// حلقات framer الجافاسكربتية + لمعة النص (إعادة رسم كل إطار) كانت تُشغّل الخيط
// الرئيسي باستمرار. الشاشة كلها تظهر بتلاشٍ ناعم واحد (animate-fade-in).
export default function AppWelcome() {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-in fixed inset-0 z-40 flex flex-col overflow-hidden bg-wine-dark text-cream">
      {/* خلفية متدرّجة فاخرة + توهّجان ثابتان (يُرسمان مرة واحدة) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(212,175,55,0.18), transparent 55%), radial-gradient(100% 70% at 50% 110%, rgba(138,106,79,0.45), transparent 60%), linear-gradient(180deg, #3f2e22 0%, #2a1d14 100%)',
        }}
      />
      <div className="pointer-events-none absolute -top-24 start-1/4 h-72 w-72 rounded-full bg-[#d4af37]/15 opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 end-0 h-80 w-80 rounded-full bg-[#8a6a4f]/40 opacity-60 blur-3xl" />

      {/* إطار ذهبي رفيع حول الشاشة — لمسة بوتيك فاخرة */}
      <div
        className="pointer-events-none absolute rounded-[26px] ring-1 ring-[#e6c878]/25"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          insetInlineStart: '10px',
          insetInlineEnd: '10px',
        }}
      />

      {/* شريط علوي */}
      <div className="relative flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
        <LanguageSwitcher />
        <span className="font-display text-sm tracking-[0.3em] text-cream/60">ELEGANCE</span>
      </div>

      {/* المنتصف: الشعار + الاسم */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="relative">
          {/* حلقة ذهبية تدور خلف الشعار — CSS transform (على الـGPU) */}
          <div
            className="bz-ring absolute inset-[-22px] -z-10 rounded-full"
            style={{ background: 'conic-gradient(from 0deg, transparent, rgba(212,175,55,0.55), transparent 60%)' }}
          />
          {/* هالة ثابتة خلف الشعار */}
          <div className="absolute inset-0 -z-10 rounded-full bg-cream/15 opacity-60 blur-2xl" />
          {/* دخول الشعار لمرّة واحدة (لفّة + تكبير) ثم طفو ناعم دائم — كلاهما CSS transform */}
          <div className="bz-logo-in">
            <div className="bz-float">
              <Logo className="h-28 w-28 drop-shadow-2xl sm:h-32 sm:w-32" />
            </div>
          </div>
        </div>

        {/* اسم Bazara: خط serif فخم ثابت (Playfair ثم Georgia النظامي) مستقلّ عن لغة
            الصفحة — نتجاوز قاعدة html[lang='ar'] .font-display التي كانت تفرض Cairo
            وتسبّب "تبديل الخط". Georgia متوفّر دائماً فلا قفزة حتى قبل تحميل Playfair.
            وتدرّج ذهبي ثابت (بلا لمعة تعيد رسم النص كل إطار). */}
        <h1
          className="mt-8 text-5xl font-extrabold tracking-wide sm:text-6xl"
          style={{
            fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
            background: 'linear-gradient(160deg, #f7ecd2 0%, #d4af37 55%, #b8932c 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Bazara
        </h1>

        <div className="mt-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#d4af37]/70" />
          <span className="text-2xl">✦</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#d4af37]/70" />
        </div>

        <p className="mt-4 font-display text-lg text-cream/90 sm:text-xl">{t('app.tagline')}</p>
        <p className="mt-2 text-xs tracking-[0.25em] text-cream/45">ELEGANCE · MODESTY · DISTINCTION</p>

        {/* شارات ثقة (أسلوب المتاجر الكبرى): توصيل · دفع عند الاستلام · تبديل */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {[
            { Icon: TruckIcon, label: t('appWelcome.feat1') },
            { Icon: CashIcon, label: t('appWelcome.feat2') },
            { Icon: CheckIcon, label: t('appWelcome.feat3') },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e6c878]/25 bg-[#F4EDE2]/[0.06] px-3 py-1.5 text-xs font-medium text-cream/85"
            >
              <Icon className="h-4 w-4 text-[#e6c878]" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* الأزرار */}
      <div className="relative space-y-3 px-7 pb-[max(env(safe-area-inset-bottom),28px)]">
        {/* نبض توهّج الزر = طبقة مستقلة تتنفّس بالشفافية فقط (CSS، على الـGPU) */}
        <div className="relative">
          <span className="bz-glowpulse pointer-events-none absolute inset-x-5 -bottom-1.5 top-3 -z-10 rounded-full bg-[#d4af37]/50 blur-xl" />
          <Link
            to="/shop"
            className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-center font-bold shadow-xl ring-1 ring-[#e6c878]/50 transition active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #f7ecd2 0%, #F4EDE2 50%, #e6c878 100%)', color: '#3f2e22', boxShadow: '0 18px 38px -16px rgba(212, 175, 55, 0.55)' }}
          >
            <BagIcon className="h-5 w-5" /> {t('appWelcome.browse')}
          </Link>
        </div>
        <Link
          to="/login"
          className="block w-full rounded-full border border-[#e6c878]/40 py-3.5 text-center font-semibold text-cream transition hover:bg-cream/10 active:scale-[0.97]"
        >
          {t('nav.login')}
        </Link>
        <div className="text-center">
          <Link to="/register" className="inline-flex items-center gap-1 pt-1 text-sm text-cream/75 transition hover:text-cream">
            {t('appWelcome.openStore')} <ForwardIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

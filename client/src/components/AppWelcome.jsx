import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Logo from './Logo.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { BagIcon } from './icons.jsx';

// شاشة افتتاح التطبيق المثبّت (standalone) — تصميم فخم متحرّك بألوان Bazara.
// تظهر فقط داخل التطبيق؛ الموقع في المتصفح يبقى كما هو.

// تنسيق الحركة: دخول متدرّج للعناصر من الأسفل للأعلى
// بلا حركة دخول للعناصر — تظهر مع تلاشي الصفحة الواحد (لا قفز ولا فصل)
const container = { hidden: {}, show: {} };
const rise = { hidden: { opacity: 1 }, show: { opacity: 1 } };

const MLink = motion.create(Link);

export default function AppWelcome() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-wine-dark text-cream">
      {/* خلفية متدرّجة فاخرة + توهّجات متحرّكة */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(212,175,55,0.18), transparent 55%), radial-gradient(100% 70% at 50% 110%, rgba(138,106,79,0.45), transparent 60%), linear-gradient(180deg, #3f2e22 0%, #2a1d14 100%)',
        }}
      />
      <motion.div
        className="pointer-events-none absolute -top-24 start-1/4 h-72 w-72 rounded-full bg-[#d4af37]/15 blur-3xl"
        animate={{ y: [0, 24, 0], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-0 end-0 h-80 w-80 rounded-full bg-[#8a6a4f]/40 blur-3xl"
        animate={{ y: [0, -18, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* شريط علوي */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]"
      >
        <LanguageSwitcher />
        <span className="font-display text-sm tracking-[0.3em] text-cream/60">ELEGANCE</span>
      </motion.div>

      {/* المنتصف: الشعار + الاسم */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative flex flex-1 flex-col items-center justify-center px-8 text-center"
      >
        <motion.div
          variants={rise}
          className="relative"
        >
          {/* حلقة ذهبية متوهّجة تدور خلف الشعار */}
          <motion.div
            className="absolute inset-[-22px] -z-10 rounded-full"
            style={{ background: 'conic-gradient(from 0deg, transparent, rgba(212,175,55,0.55), transparent 60%)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-0 -z-10 rounded-full bg-cream/15 blur-2xl"
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.08, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* دخول: لفّة كاملة مع عقارب الساعة + تكبير وتلاشٍ ناعم */}
          <motion.div
            initial={{ rotate: 0, scale: 0.55, opacity: 0 }}
            animate={{ rotate: 360, scale: 1, opacity: 1 }}
            transition={{ duration: 1.3, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* استمرار: طفو ناعم دائم */}
            <motion.div
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Logo className="h-28 w-28 drop-shadow-2xl sm:h-32 sm:w-32" />
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.h1
          variants={rise}
          className="mt-8 font-display text-5xl font-extrabold tracking-wide sm:text-6xl"
          style={{
            background: 'linear-gradient(180deg, #f7ecd2 0%, #d4af37 70%, #b8932c 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Bazara
        </motion.h1>

        <motion.div variants={rise} className="mt-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#d4af37]/70" />
          <span className="text-2xl">✦</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#d4af37]/70" />
        </motion.div>

        <motion.p variants={rise} className="mt-4 font-display text-lg text-cream/90 sm:text-xl">
          {t('app.tagline')}
        </motion.p>
        <motion.p variants={rise} className="mt-2 text-xs tracking-[0.25em] text-cream/45">
          ELEGANCE · MODESTY · DISTINCTION
        </motion.p>
      </motion.div>

      {/* الأزرار */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative space-y-3 px-7 pb-[max(env(safe-area-inset-bottom),28px)]"
      >
        <MLink
          variants={rise}
          to="/shop"
          whileTap={{ scale: 0.97 }}
          className="block w-full rounded-2xl py-4 text-center font-bold shadow-xl"
          style={{ background: 'linear-gradient(135deg, #f7ecd2 0%, #F4EDE2 50%, #e6c878 100%)', color: '#3f2e22' }}
        >
          <BagIcon className="inline h-5 w-5" /> {t('appWelcome.browse')}
        </MLink>
        <MLink
          variants={rise}
          to="/login"
          whileTap={{ scale: 0.97 }}
          className="block w-full rounded-2xl border border-cream/35 py-3.5 text-center font-semibold text-cream transition hover:bg-cream/10"
        >
          {t('nav.login')}
        </MLink>
        <motion.div variants={rise} className="text-center">
          <Link to="/register" className="inline-block pt-1 text-sm text-cream/75 transition hover:text-cream">
            {t('appWelcome.openStore')} ←
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

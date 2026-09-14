/** @type {import('tailwindcss').Config} */
export default {
  // hover: يعمل فقط على أجهزة تدعمه فعلاً (ماوس) — على اللمس كان تأثير الضغط
  // "يعلق" على الزر بعد رفع الإصبع (المتصفح يثبّت حالة hover) ويبقى كأنه مضغوط
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // عربي: Tajawal (نصوص) — إنجليزي: Inter — عناوين فخمة: Playfair (إنجليزي) / El Messiri (عربي)
        sans: ['Inter', 'Tajawal', 'system-ui', 'sans-serif'],
        // Inter قبل Tajawal عمداً: اختيار الخط يجري لكل حرف على حدة، وInter
        // بلا حروف عربية فتذهب كلها إلى Tajawal كما كانت، بينما تلتقط Inter
        // الأرقام واللاتيني. كانت Tajawal أولاً فتُرسم بها الأرقام وأرقامها
        // أضعف — ولهذا كانت الواجهة الإنجليزية تبدو أنظف من العربية.
        ar: ['Inter', 'Tajawal', 'sans-serif'],
        display: ['"Playfair Display"', '"El Messiri"', 'serif'],
        // ثيم المتجر العام (خمري/عاجي): عناوين El Messiri + نصوص Tajawal
        messiri: ['"El Messiri"', 'serif'],
        almarai: ['Tajawal', 'sans-serif'],
      },
      colors: {
        // هوية دافئة: بنّي قهوة + بيج كريمي (مستوحاة من أجواء الخريف)
        // الأسماء "wine/cream" محفوظة كما هي لتفادي تغيير الأصناف عبر الموقع.
        // القيمُ بمتغيّراتِ CSS لا بأرقامٍ ثابتة: الوضعُ الليليُّ يقلبُها فتنقلبُ
        // معها كلُّ الأصناف (bg-wine و bg-wine/10 و border-wine/25 …) بلا استثناء.
        // القيمُ النهاريّةُ نفسُها لم تتغيّر — انظر :root في index.css.
        wine: {
          light: 'rgb(var(--c-wine-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--c-wine) / <alpha-value>)',
          dark: 'rgb(var(--c-wine-dark) / <alpha-value>)',
        },
        cream: '#F4EDE2',
        // ذهبي معدني فاخر
        // الاسم «gold» محفوظ كما هو (تستعمله ٦٥٨ موضعاً بالكود)، لكنّ القيم
        // صارت رمليّةً دافئة بلا أيّ صُفرة. الذهب المعدنيّ حين يعمّ على كلّ
        // حدٍّ وحلقةٍ وزرّ لا يعود يميّز شيئاً، ويعطي الموقع مظهراً قالبياً.
        // اللوحة الآن بنّيّة وعاجيّة فحسب: التمييز بالتباين لا باللمعان.
        gold: {
          50: 'rgb(var(--c-gold-50) / <alpha-value>)',
          100: 'rgb(var(--c-gold-100) / <alpha-value>)',
          200: 'rgb(var(--c-gold-200) / <alpha-value>)',
          300: 'rgb(var(--c-gold-300) / <alpha-value>)',
          400: 'rgb(var(--c-gold-400) / <alpha-value>)',
          500: 'rgb(var(--c-gold-500) / <alpha-value>)',
          600: 'rgb(var(--c-gold-600) / <alpha-value>)',
          700: 'rgb(var(--c-gold-700) / <alpha-value>)',
          800: 'rgb(var(--c-gold-800) / <alpha-value>)',
          900: 'rgb(var(--c-gold-900) / <alpha-value>)',
        },
        // أسود/فحمي عميق
        ink: {
          950: '#070708',
          900: '#0b0b0d',
          800: '#121214',
          700: '#1a1a1e',
          600: '#242429',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.55)',
        glow: '0 0 35px -8px rgba(176, 154, 126, 0.45)',
        gold: '0 10px 30px -10px rgba(176, 154, 126, 0.5)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        'slide-in': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.6s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out both',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};

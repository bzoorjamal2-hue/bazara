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
        ar: ['Tajawal', 'sans-serif'],
        display: ['"Playfair Display"', '"El Messiri"', 'serif'],
        // ثيم المتجر العام (خمري/عاجي): عناوين El Messiri + نصوص Tajawal
        messiri: ['"El Messiri"', 'serif'],
        almarai: ['Tajawal', 'sans-serif'],
      },
      colors: {
        // هوية دافئة: بنّي قهوة + بيج كريمي (مستوحاة من أجواء الخريف)
        // الأسماء "wine/cream" محفوظة كما هي لتفادي تغيير الأصناف عبر الموقع.
        wine: {
          light: '#8a6a4f',
          DEFAULT: '#5e4636',
          dark: '#3f2e22',
        },
        cream: '#F4EDE2',
        // ذهبي معدني فاخر
        gold: {
          50: '#fbf8ef',
          100: '#f6edcf',
          200: '#ecd99b',
          300: '#e0c25f',
          400: '#d4af37',
          500: '#c2992b',
          600: '#a37d22',
          700: '#7d5f1d',
          800: '#5c451a',
          900: '#3d2e13',
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
        glow: '0 0 35px -8px rgba(212, 175, 55, 0.45)',
        gold: '0 10px 30px -10px rgba(212, 175, 55, 0.5)',
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

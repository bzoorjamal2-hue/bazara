/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // عربي: Tajawal / Cairo — إنجليزي: Inter — عناوين فخمة: Playfair Display
        sans: ['Inter', 'Tajawal', 'system-ui', 'sans-serif'],
        ar: ['Tajawal', 'Cairo', 'sans-serif'],
        display: ['"Playfair Display"', 'Cairo', 'serif'],
        // ثيم المتجر العام (خمري/عاجي): عناوين El Messiri + نصوص Almarai
        messiri: ['"El Messiri"', 'Cairo', 'serif'],
        almarai: ['Almarai', 'Tajawal', 'sans-serif'],
      },
      colors: {
        // هوية المتجر العام الفاخرة: خمري/بوردو + عاجي كريمي
        wine: {
          light: '#7a2238',
          DEFAULT: '#5C1A2E',
          dark: '#4A1322',
        },
        cream: '#F8F3EC',
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

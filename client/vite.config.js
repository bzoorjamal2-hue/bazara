import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // وكيل التطوير: يحوّل طلبات /api إلى الخادم المحلي لتفادي مشاكل CORS/الكوكيز
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

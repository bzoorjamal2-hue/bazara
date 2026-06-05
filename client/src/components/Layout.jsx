import { useTranslation } from 'react-i18next';
import Navbar from './Navbar.jsx';
import CartDrawer from './CartDrawer.jsx';

export default function Layout({ children }) {
  const { t } = useTranslation();
  return (
    <div className="app-bg flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 text-center text-sm text-stone-500 sm:px-6">
        <div className="gold-divider mb-5" />
        © {new Date().getFullYear()} {t('app.name')} — {t('app.tagline')}
      </footer>
      <CartDrawer />
    </div>
  );
}

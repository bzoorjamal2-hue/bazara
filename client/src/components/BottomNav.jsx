import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

function HomeIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-8 9 8M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function UserIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function CategoriesIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </svg>
  );
}
function OffersIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 13.3 13.3 20.5a1.5 1.5 0 0 1-2.1 0l-7.7-7.7V4.5a1 1 0 0 1 1-1h8.3l7.7 7.7a1.5 1.5 0 0 1 0 2.1Z" />
      <circle cx="7.5" cy="7.5" r="1.3" fill={filled ? 'none' : 'currentColor'} />
    </svg>
  );
}
function TrackIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H14a1 1 0 0 1 1 1v9H3.5A.5.5 0 0 1 3 14.5Z" />
      <path d="M15 8h3.2a1 1 0 0 1 .8.4l2 2.7a1 1 0 0 1 .2.6V15h-6Z" />
      <circle cx="7.5" cy="17.5" r="1.7" fill="none" />
      <circle cx="17" cy="17.5" r="1.7" fill="none" />
    </svg>
  );
}

// شريط تنقّل سفلي بأسلوب التطبيقات (يظهر داخل التطبيق المثبّت فقط).
export default function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { count, setOpen, open: cartOpen } = useCart();
  const { count: wishCount, setOpen: setWishOpen, open: wishOpen } = useWishlist();
  const { user, store, subscription } = useAuth();
  const isAdmin = subscription?.isAdmin;

  // عدّاد الطلبات الجديدة لصاحب المتجر — شارة على تبويب "حسابي"
  const [newOrders, setNewOrders] = useState(0);
  useEffect(() => {
    if (!user || !store?.slug) { setNewOrders(0); return undefined; }
    let alive = true;
    const load = () => api.get('/orders/new-count').then((r) => { if (alive) setNewOrders(r.data.count || 0); }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [user, store?.slug]);

  // عند وجود طلب جديد، يفتح تبويب "الطلبات" مباشرة (الإشعار يوصلك لمصدره)
  const accountTo = user ? (newOrders > 0 ? '/dashboard?tab=myOrders' : '/dashboard') : '/login';
  // "الرئيسية": المدير العام → الصفحة الرئيسية للموقع (ليعاين تعديلاته)؛ المشترك → متجره؛ الزائر → بازارا العام
  const homeTo = isAdmin ? '/shop' : user && store?.slug ? `/store/${store.slug}` : '/shop';
  const homeActive = homeTo === '/shop' ? pathname === '/shop' : pathname === homeTo;
  // إغلاق أدراج السلة/المفضلة قبل الانتقال (الشريط يبقى ظاهراً فوق الأدراج)
  const closeDrawers = () => { setOpen(false); setWishOpen(false); };
  const goto = (to) => { closeDrawers(); navigate(to); };
  // السلة والمفضّلة موجودتان بالشريط العلوي بحد الأفاتار، فنستبدلهما بوجهات أنفع.
  // الترتيب يتبع اتجاه اللغة تلقائياً: عربي (حسابي أولاً يميناً)، إنجليزي (يساراً).
  const items = [
    { key: 'account', label: t('nav.account') || 'حسابي', Icon: UserIcon, active: !cartOpen && !wishOpen && pathname.startsWith('/dashboard'), badge: newOrders, onClick: () => goto(accountTo) },
    { key: 'track', label: t('nav.track'), Icon: TrackIcon, active: !cartOpen && !wishOpen && pathname === '/track', onClick: () => goto('/track') },
    { key: 'offers', label: t('nav.offers'), Icon: OffersIcon, active: !cartOpen && !wishOpen && pathname === '/offers', onClick: () => goto('/offers') },
    { key: 'categories', label: t('nav.categories'), Icon: CategoriesIcon, active: !cartOpen && !wishOpen && (pathname === '/categories' || pathname.startsWith('/category/')), onClick: () => goto('/categories') },
    { key: 'home', label: t('nav.home'), Icon: HomeIcon, active: !cartOpen && !wishOpen && homeActive, onClick: () => goto(homeTo) },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[78] border-t border-wine/10 bg-white/95 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-6px_20px_rgba(94,70,54,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {items.map(({ key, label, Icon, active, badge, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            data-cart-target={key === 'cart' ? '' : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium transition ${
              active ? 'text-wine' : 'text-stone-400'
            }`}
          >
            {/* تظليل التبويب الفعّال: حبّة خمرية حول الأيقونة ليعرف المستخدم مكانه */}
            <span className={`relative flex items-center justify-center rounded-2xl px-5 py-1 transition-colors duration-200 ${active ? 'bg-wine text-cream shadow-sm' : ''}`}>
              <Icon className="h-6 w-6" filled={active} />
              {badge > 0 && (
                <span className={`absolute -end-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${active ? 'bg-cream text-wine' : 'bg-wine text-cream'}`}>
                  {badge}
                </span>
              )}
            </span>
            <span className={active ? 'font-bold' : ''}>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

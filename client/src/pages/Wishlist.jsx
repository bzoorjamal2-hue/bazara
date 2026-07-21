import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../context/WishlistContext.jsx';
import Seo from '../components/Seo.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { HeartIcon } from '../components/icons.jsx';
import { goBack } from '../utils/nav.js';

// المفضّلة بنفس ستايل الموقع: بطاقات ProductCard الموحّدة (شارات/ألوان/نظرة سريعة/
// خيارات المقاس) — والقلب المملوء عليها يحذف من المفضّلة مباشرة.
export default function Wishlist() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const { items, clear } = useWishlist();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false); // تأكيد بخطوتين قبل مسح الكل

  return (
    <>
      <Seo title={t('wishlist.title')} />
      {/* رجوع + عنوان مزخرف مركزي (نفس روح عناوين الموقع) */}
      <div className="mb-2 flex items-center">
        <button
          onClick={() => goBack(navigate, '/shop')}
          aria-label={t('common.back')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine hover:text-cream"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} /></svg>
        </button>
      </div>
      <div className="mb-6 flex items-center justify-center gap-2.5 text-wine sm:gap-3">
        <span aria-hidden className="text-sm text-wine/40">❖</span>
        <span className="h-px w-7 bg-gradient-to-r from-transparent to-wine/30 sm:w-12" />
        <h1 className="flex items-center gap-2 whitespace-nowrap font-display text-xl font-bold sm:text-2xl">
          <HeartIcon className="h-6 w-6" filled /> {t('wishlist.title')}
          {items.length > 0 && <span className="rounded-full bg-wine/10 px-2 py-0.5 text-sm font-bold">{items.length}</span>}
        </h1>
        <span className="h-px w-7 bg-gradient-to-l from-transparent to-wine/30 sm:w-12" />
        <span aria-hidden className="text-sm text-wine/40">❖</span>
      </div>

      {items.length === 0 ? (
        <div className="glass flex flex-col items-center gap-4 p-12 text-center text-stone-400">
          <HeartIcon className="h-14 w-14 text-wine/25" />
          <p>{t('wishlist.empty')}</p>
          <Link
            to="/shop"
            className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}
          >
            {t('co.doneKeepShopping')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} whatsapp={p.storeWhatsapp || p.whatsapp} />
          ))}
        </div>
      )}
      {items.length > 1 && (
        <div className="mt-6 text-center">
          {confirmClear ? (
            <span className="inline-flex items-center gap-3 text-xs">
              <span className="text-stone-400">{t('wishlist.clearConfirm')}</span>
              <button onClick={() => { clear(); setConfirmClear(false); }} className="font-bold text-red-400 transition hover:text-red-300">{t('common.yes')}</button>
              <button onClick={() => setConfirmClear(false)} className="font-semibold text-stone-400 transition hover:text-stone-200">{t('common.cancel')}</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="text-xs font-semibold text-stone-400 transition hover:text-red-400">{t('filters.clear')}</button>
          )}
        </div>
      )}
    </>
  );
}

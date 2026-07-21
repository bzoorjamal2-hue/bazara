import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useWishlist } from '../context/WishlistContext.jsx';
import Seo from '../components/Seo.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import { HeartIcon, LinkIcon } from '../components/icons.jsx';
import { goBack } from '../utils/nav.js';

const GRID = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
const MAX_SHARE = 20; // سقف معقول لطول الرابط

// المفضّلة بنفس ستايل الموقع: بطاقات ProductCard الموحّدة (شارات/ألوان/نظرة سريعة/
// خيارات المقاس) — والقلب المملوء عليها يحذف من المفضّلة مباشرة.
// وتدعم وضعين: مفضّلتي (المحلية)، ومفضّلة مُشاركة عبر رابط (?ids=…) يفتحها أي شخص.
export default function Wishlist() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const { items, clear, toggle, has } = useWishlist();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [confirmClear, setConfirmClear] = useState(false); // تأكيد بخطوتين قبل مسح الكل
  const [copied, setCopied] = useState(false);

  // وضع "مفضّلة مُشاركة": نجلب القطع من معرّفات الرابط (المحذوف منها يُتجاهل بهدوء)
  const sharedIds = (params.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const isShared = sharedIds.length > 0;
  const [shared, setShared] = useState(null);

  useEffect(() => {
    if (!isShared) { setShared(null); return; }
    let alive = true;
    Promise.all(
      sharedIds.slice(0, MAX_SHARE).map((id) =>
        api.get(`/public/product/${id}`).then((r) => r.data.product).catch(() => null)
      )
    ).then((list) => { if (alive) setShared(list.filter(Boolean)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('ids')]);

  // البيانات الحالية لقطع المفضّلة: المخزّن محلياً لقطة وقت الحفظ (سعر/مخزون قديمان).
  // نجلب الحالي فنعرض سعراً ومخزوناً صحيحين، ونكشف أيضاً أيّ قطعة نزل سعرها منذ حفظها.
  const ids = items.map((p) => p.id).join(',');
  const [fresh, setFresh] = useState({});
  useEffect(() => {
    if (isShared || !items.length) return undefined;
    let alive = true;
    Promise.all(items.map((it) => api.get(`/public/product/${it.id}`).then((r) => r.data.product).catch(() => null)))
      .then((list) => {
        if (!alive) return;
        const map = {};
        list.forEach((p) => { if (p) map[p.id] = p; });
        setFresh(map);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, isShared]);

  const shareUrl = `${window.location.origin}/wishlist?ids=${items.slice(0, MAX_SHARE).map((p) => p.id).join(',')}`;
  const shareMine = async () => {
    try {
      if (navigator.share) await navigator.share({ title: t('wishlist.title'), text: t('wishlist.shareMsg'), url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* أُلغيت المشاركة */ }
  };
  // إضافة كل القطع المُشاركة لمفضّلتي (نتجاهل الموجود مسبقاً فلا نحذفه بالخطأ)
  const keepAll = () => (shared || []).forEach((p) => { if (!has(p.id)) toggle(p); });

  const dropCount = items.filter((s) => fresh[s.id] && fresh[s.id].price < s.price).length;
  const list = isShared ? shared : items;
  const title = isShared ? t('wishlist.shared') : t('wishlist.title');

  return (
    <>
      <Seo title={title} />
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
          <HeartIcon className="h-6 w-6" filled /> {title}
          {list?.length > 0 && <span className="rounded-full bg-wine/10 px-2 py-0.5 text-sm font-bold">{list.length}</span>}
        </h1>
        <span className="h-px w-7 bg-gradient-to-l from-transparent to-wine/30 sm:w-12" />
        <span aria-hidden className="text-sm text-wine/40">❖</span>
      </div>

      {isShared ? (
        /* ───── مفضّلة مُشاركة عبر رابط ───── */
        shared === null ? (
          <ProductGridSkeleton count={6} />
        ) : shared.length === 0 ? (
          <div className="glass flex flex-col items-center gap-4 p-12 text-center text-stone-400">
            <HeartIcon className="h-14 w-14 text-wine/25" />
            <p>{t('wishlist.sharedGone')}</p>
            <Link to="/shop" className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110" style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}>
              {t('co.doneKeepShopping')}
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-center text-sm text-stone-400">{t('wishlist.sharedHint')}</p>
            <div className={GRID}>
              {shared.map((p, i) => <ProductCard key={p.id} product={p} index={i} whatsapp={p.storeWhatsapp || p.whatsapp} />)}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button onClick={keepAll} className="rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110" style={{ background: 'linear-gradient(135deg, #6e2637 0%, #4a1322 60%, #3f1020 100%)' }}>
                {t('wishlist.keepAll')}
              </button>
              <Link to="/wishlist" className="rounded-full border border-wine/30 px-6 py-3 text-sm font-bold text-wine transition hover:bg-wine hover:text-cream">
                {t('wishlist.mine')}
              </Link>
            </div>
          </>
        )
      ) : items.length === 0 ? (
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
        <>
          {dropCount > 0 && (
            <p className="mb-4 text-center text-sm font-bold text-emerald-600">✨ {t('wishlist.priceDropCount', { count: dropCount })}</p>
          )}
          <div className={GRID}>
            {items.map((saved, i) => {
              const now = fresh[saved.id]; // الحالي إن وصل، وإلا اللقطة المحفوظة
              return (
                <ProductCard
                  key={saved.id}
                  product={now || saved}
                  index={i}
                  whatsapp={(now || saved).storeWhatsapp || saved.whatsapp}
                  priceDrop={now ? saved.price : 0}
                />
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {/* مشاركة المفضّلة: رابط يفتح نفس القطع عند أي شخص (بلا حساب) */}
            <button onClick={shareMine} className="inline-flex items-center gap-2 rounded-full border border-wine/30 px-6 py-2.5 text-sm font-bold text-wine transition hover:bg-wine hover:text-cream">
              <LinkIcon className="h-4 w-4" /> {copied ? t('common.copied') : t('wishlist.share')}
            </button>
            {items.length > 1 && (
              confirmClear ? (
                <span className="inline-flex items-center gap-3 text-xs">
                  <span className="text-stone-400">{t('wishlist.clearConfirm')}</span>
                  <button onClick={() => { clear(); setConfirmClear(false); }} className="font-bold text-red-400 transition hover:text-red-300">{t('common.yes')}</button>
                  <button onClick={() => setConfirmClear(false)} className="font-semibold text-stone-400 transition hover:text-stone-200">{t('common.cancel')}</button>
                </span>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="text-xs font-semibold text-stone-400 transition hover:text-red-400">{t('filters.clear')}</button>
              )
            )}
          </div>
        </>
      )}
    </>
  );
}

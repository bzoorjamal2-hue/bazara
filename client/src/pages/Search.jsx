import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import Seo from '../components/Seo.jsx';
import FilteredProductGrid from '../components/FilteredProductGrid.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import { SearchIcon, StoreIcon, XIcon } from '../components/icons.jsx';
import { cldThumb } from '../utils/cloudinary.js';
import { goBack } from '../utils/nav.js';

// البحث الشامل عبر المنصّة (أسلوب المتاجر الكبرى): الاستعلام بالرابط (?q=)
// فيعمل الرجوع والمشاركة، مع عمليات بحث سابقة محلية واقتراحات فئات عند اللاشيء.
const RECENT_KEY = 'bz_recent_searches';
const getRecentSearches = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
};
const pushRecentSearch = (q) => {
  try {
    const list = [q, ...getRecentSearches().filter((x) => x !== q)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* تجاهل */ }
};

const CATS = ['dress', 'abaya', 'set', 'hijab', 'trench', 'jacket', 'shirt'];

export default function Search() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  // نطاق متجر مشترِكة (?store=slug): نفس تجربة البحث الشامل لكن نتائج هذا المتجر فقط
  const storeScope = (params.get('store') || '').trim();
  const withScope = (obj) => (storeScope ? { ...obj, store: storeScope } : obj);
  const [input, setInput] = useState(q);
  const [results, setResults] = useState(null); // { products, stores } | null = لم يبحث بعد
  const [busy, setBusy] = useState(false);
  const [recents, setRecents] = useState(getRecentSearches());
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // نفتح الكيبورد بعد اكتمال حركة الانتقال (٠.٢ث) — التركيز الفوري كان يجعل الفتح "يتقطّع"
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 280);
    return () => clearTimeout(id);
  }, []);

  // الكتابة تحدّث الرابط (replace حتى لا يتراكم التاريخ حرفاً حرفاً)
  const onType = (v) => {
    setInput(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setParams(v.trim() ? withScope({ q: v.trim() }) : withScope({}), { replace: true });
    }, 350);
  };

  // الجلب يتبع الرابط — فيعمل عند الرجوع/الفتح المباشر أيضاً
  useEffect(() => {
    if (q.length < 2) { setResults(null); setBusy(false); return undefined; }
    let alive = true;
    setBusy(true);
    api.get(`/public/search?q=${encodeURIComponent(q)}${storeScope ? `&store=${encodeURIComponent(storeScope)}` : ''}`)
      .then((r) => {
        if (!alive) return;
        setResults({ products: r.data.products || [], stores: r.data.stores || [] });
        if ((r.data.products || []).length || (r.data.stores || []).length) {
          pushRecentSearch(q);
          setRecents(getRecentSearches());
        }
      })
      .catch(() => { if (alive) setResults({ products: [], stores: [] }); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [q]);

  const clearRecents = () => { try { localStorage.removeItem(RECENT_KEY); } catch { /* تجاهل */ } setRecents([]); };
  // حذف عملية بحث واحدة (بدل مسح القائمة كلها)
  const removeRecent = (term) => {
    const list = getRecentSearches().filter((x) => x !== term);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* تجاهل */ }
    setRecents(list);
  };
  const searchFor = (term) => { setInput(term); setParams(withScope({ q: term })); };
  // شرائح الفئات تتبع النطاق: داخل متجر → فئة المتجر نفسه (CategoryPage يدعم ?store=)
  const catLink = (c) => `/category/${c}${storeScope ? `?store=${encodeURIComponent(storeScope)}` : ''}`;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Seo title={`${t('searchPage.title')} — Bazara`} />

      {/* شريط البحث: رجوع + حقل مع أيقونة ومسح */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goBack(navigate, storeScope ? `/store/${storeScope}` : '/shop')}
          aria-label={t('common.back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wine transition hover:bg-wine/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
          </svg>
        </button>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-wine/50" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { clearTimeout(timerRef.current); const v = input.trim(); setParams(v ? withScope({ q: v }) : withScope({}), { replace: true }); inputRef.current?.blur(); } }}
            placeholder={t('searchPage.placeholder')}
            enterKeyHint="search"
            className="w-full rounded-full border border-wine/15 bg-white py-3 pe-11 ps-11 text-[16px] text-stone-100 shadow-[0_6px_18px_-12px_rgba(94,70,54,0.35)] outline-none transition focus:border-wine/40"
          />
          {input && (
            <button
              type="button"
              onClick={() => { setInput(''); setParams(withScope({}), { replace: true }); inputRef.current?.focus(); }}
              aria-label={t('common.remove')}
              className="absolute end-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-wine/10 text-wine transition hover:bg-wine/20"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* قبل البحث: عمليات سابقة + فئات مقترحة */}
      {q.length < 2 && (
        <div className="mt-6 space-y-6">
          {recents.length > 0 && (
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-stone-300">{t('searchPage.recent')}</h2>
                <button type="button" onClick={clearRecents} className="text-xs font-semibold text-stone-500 transition hover:text-wine">{t('searchPage.clear')}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <span key={r} className="inline-flex items-center rounded-full border border-wine/15 bg-white transition hover:border-wine/40">
                    <button type="button" onClick={() => searchFor(r)} className="max-w-[10rem] truncate py-1.5 pe-1.5 ps-3.5 text-sm text-stone-200">{r}</button>
                    <button
                      type="button"
                      onClick={() => removeRecent(r)}
                      aria-label={`${t('common.remove')} ${r}`}
                      title={t('common.remove')}
                      className="flex h-6 w-6 me-1.5 items-center justify-center rounded-full text-stone-400 transition hover:bg-wine/10 hover:text-wine"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-2.5 text-sm font-bold text-stone-300">{t('searchPage.tryCats')}</h2>
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => (
                <Link key={c} to={catLink(c)}
                  className="rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1.5 text-sm font-semibold text-gold-200 transition hover:border-gold-400/60">
                  {t(`categories.${c}`)}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* أثناء البحث */}
      {q.length >= 2 && (
        <div className="mt-6">
          {busy && !results ? (
            <ProductGridSkeleton count={8} />
          ) : results && (
            <>
              {/* متاجر مطابقة */}
              {results.stores.length > 0 && (
                <section className="mb-6">
                  <h2 className="mb-2.5 text-sm font-bold text-stone-300">{t('searchPage.stores')} <span className="font-medium text-stone-500">· {results.stores.length}</span></h2>
                  <div className="flex flex-wrap gap-2.5">
                    {results.stores.map((s) => (
                      <Link key={s.slug} to={`/store/${s.slug}`}
                        className="flex items-center gap-2 rounded-full border border-wine/15 bg-white py-1.5 pe-4 ps-1.5 shadow-sm transition hover:border-wine/40">
                        {s.logoUrl
                          ? <img src={cldThumb(s.logoUrl, 80)} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-gold-400/40" />
                          : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wine/10 text-wine"><StoreIcon className="h-4 w-4" /></span>}
                        <span className="text-sm font-semibold text-stone-100">{s.name}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results.products.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-sm font-bold text-stone-300">{t('searchPage.results')} <span className="font-medium text-stone-500">· {results.products.length} {t('store.products')}</span></h2>
                  <FilteredProductGrid products={results.products} />
                </section>
              ) : results.stores.length === 0 && !busy && (
                <div className="rounded-2xl border border-wine/10 bg-white p-10 text-center">
                  <p className="text-3xl">🔍</p>
                  <p className="mt-3 font-semibold text-stone-200">{t('searchPage.noResults', { q })}</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {CATS.slice(0, 4).map((c) => (
                      <Link key={c} to={catLink(c)}
                        className="rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1.5 text-sm font-semibold text-gold-200">
                        {t(`categories.${c}`)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

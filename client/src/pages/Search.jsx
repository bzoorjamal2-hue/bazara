import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import Seo from '../components/Seo.jsx';
import FilteredProductGrid from '../components/FilteredProductGrid.jsx';
import StoreHeader from '../components/StoreHeader.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import { SearchIcon, StoreIcon, XIcon, BackIcon } from '../components/icons.jsx';
import { StateCard, SubHead } from '../components/PageUI.jsx';
import { cldThumb } from '../utils/cloudinary.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { goBack } from '../utils/nav.js';
import { platformCatKeys, platformCatName, platformCatImage, usePlatformCatKeys } from '../utils/platformCategories.js';

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



export default function Search() {
  const catKeys = usePlatformCatKeys();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  // نطاق متجر مشترِكة (?store=slug): نفس تجربة البحث الشامل لكن نتائج هذا المتجر فقط
  const storeScope = (params.get('store') || '').trim();
  const withScope = (obj) => (storeScope ? { ...obj, store: storeScope } : obj);
  // كائن المتجر — كي تلبس صفحة البحث هوية المتجر (هيدره ودرج فئاته) بدل شريط بازارا.
  // يبدأ من الكاش (المستخدمة غالباً جاية من المتجر) فيظهر فوراً، ثم يُحدَّث بالخلفية.
  const [storeObj, setStoreObj] = useState(() => (storeScope && getCache(`store:${storeScope}`)?.store) || null);
  useEffect(() => {
    if (!storeScope) { setStoreObj(null); return; }
    const cached = getCache(`store:${storeScope}`);
    if (cached?.store) setStoreObj(cached.store);
    api.get(`/public/store/${storeScope}`)
      .then((r) => { setCache(`store:${storeScope}`, r.data); setStoreObj(r.data.store); })
      .catch(() => { /* الهيدر يظهر بالحدّ الأدنى إن فشل الجلب */ });
  }, [storeScope]);
  // درج هيدر المتجر: "الكل" → صفحة المتجر، وأي فئة → صفحة الفئة بنطاق المتجر
  const goStoreCat = (c) => navigate(c && c !== 'all' ? `/category/${c}?store=${encodeURIComponent(storeScope)}` : `/store/${storeScope}`);
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
    <>
      {/* نطاق متجر: هيدر المتجر نفسه (اسم/شعار + درج فئاته + سلة) بلا حقل بحث مكرّر —
          فلا يظهر شريط بازارا العام ولا درج التحكم داخل تجربة المتجر */}
      {storeScope && (
        <StoreHeader
          store={storeObj || { slug: storeScope, name: '' }}
          q=""
          setQ={() => {}}
          cat="all"
          setCat={goStoreCat}
          hideSearch
        />
      )}
    <div className="mx-auto w-full max-w-5xl">
      <Seo title={`${t('searchPage.title')} — Bazara`} />

      {/* شريط البحث: رجوع + حقل مع أيقونة ومسح */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goBack(navigate, storeScope ? `/store/${storeScope}` : '/shop')}
          aria-label={t('common.back')}
          className="bz-iconbtn app-tap"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        <div className="relative flex-1">
          <SearchIcon className="bz-field-ico pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { clearTimeout(timerRef.current); const v = input.trim(); setParams(v ? withScope({ q: v }) : withScope({}), { replace: true }); inputRef.current?.blur(); } }}
            placeholder={t('searchPage.placeholder')}
            enterKeyHint="search"
            className="bz-field pe-11 ps-11"
          />
          {input && (
            <button
              type="button"
              onClick={() => { setInput(''); setParams(withScope({}), { replace: true }); inputRef.current?.focus(); }}
              aria-label={t('common.remove')}
              className="bz-field-x absolute end-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full"
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
                <SubHead>{t('searchPage.recent')}</SubHead>
                <button type="button" onClick={clearRecents} className="bz-mini-btn">{t('searchPage.clear')}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <span key={r} className="bz-pill !gap-0 !px-0">
                    <button type="button" onClick={() => searchFor(r)} className="max-w-[10rem] truncate py-1.5 pe-1.5 ps-3.5 text-sm">{r}</button>
                    <button
                      type="button"
                      onClick={() => removeRecent(r)}
                      aria-label={`${t('common.remove')} ${r}`}
                      title={t('common.remove')}
                      className="bz-pill-x flex h-6 w-6 me-1.5 items-center justify-center rounded-full"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}
          <section>
            <SubHead className="mb-2.5 block">{t('searchPage.tryCats')}</SubHead>
            <div className="flex flex-wrap gap-2">
              {catKeys.map((c) => (
                <Link key={c} to={catLink(c)} className="bz-pill">
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
                  <SubHead className="mb-2.5 block" count={results.stores.length}>{t('searchPage.stores')}</SubHead>
                  <div className="flex flex-wrap gap-2.5">
                    {results.stores.map((s) => (
                      <Link key={s.slug} to={`/store/${s.slug}`}
                        className="bz-pill !py-1.5 !pe-4 !ps-1.5">
                        {s.logoUrl
                          ? <img src={cldThumb(s.logoUrl, 80)} alt="" className="bz-storecard-logo h-8 w-8 rounded-full object-cover" />
                          : <span className="bz-softico flex h-8 w-8 items-center justify-center rounded-full"><StoreIcon className="h-4 w-4" /></span>}
                        <span className="text-sm font-semibold">{s.name}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results.products.length > 0 ? (
                <section>
                  <h2 className="bz-sub-h mb-3">{t('searchPage.results')} <span>· {results.products.length} {t('store.products')}</span></h2>
                  <FilteredProductGrid products={results.products} />
                </section>
              ) : results.stores.length === 0 && !busy && (
                <StateCard icon={<SearchIcon className="h-7 w-7" />} title={t('searchPage.noResults', { q })}>
                  {catKeys.slice(0, 4).map((c) => (
                    <Link key={c} to={catLink(c)} className="bz-pill">{t(`categories.${c}`)}</Link>
                  ))}
                </StateCard>
              )}
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}

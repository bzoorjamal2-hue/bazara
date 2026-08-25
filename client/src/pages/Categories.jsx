import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import api from '../api/client.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { cldThumb } from '../utils/cloudinary.js';
import { platformCatKeys, platformCatName, platformCatImage, usePlatformCatKeys, storeOnlyCats } from '../utils/platformCategories.js';



// صفحة تصنيفات الموقع العام (بازارا) — فئات بازارا الأصلية + الفئات المخصّصة المجمّعة من
// كل المتاجر (يعيدها /public/categories). أي فئة يضيفها أي متجر تظهر هنا تلقائياً بنفس
// شكل الفئات الأصلية. لا تعتمد على متجر صاحب الحساب المسجّل (الصفحة تبقى بازارا خالصة).
export default function Categories() {
  const catKeys = usePlatformCatKeys();
  const { t, i18n } = useTranslation();
  const [custom, setCustom] = useState(() => getCache('publicCats') || []);
  useEffect(() => {
    api.get('/public/categories')
      .then((r) => { const c = r.data.customCategories || []; setCustom(c); setCache('publicCats', c); })
      .catch(() => { /* الفئات المخصّصة اختيارية — الأصلية تكفي */ });
  }, []);
  const items = [
    ...catKeys.map((c) => ({ key: c, name: platformCatName(c, t, i18n.language), to: `/category/${c}`, img: platformCatImage(c) })),
    ...storeOnlyCats(custom, catKeys).map((c) => ({ key: c.key, name: c.name, to: `/category/${c.key}`, img: c.image || '' })),
  ];

  return (
    <>
      <Seo title={t('nav.categories')} />
      <div className="mb-8 flex items-center justify-center gap-2.5 sm:mb-10 sm:gap-3">
        <span aria-hidden className="text-sm text-[#c79a3a]/70">❖</span>
        <span className="h-px w-7 bg-gradient-to-r from-transparent to-[#c79a3a]/45 sm:w-14" />
        <h1 className="bz-title whitespace-nowrap font-display text-2xl font-bold">{t('nav.categories')}</h1>
        <span className="h-px w-7 bg-gradient-to-l from-transparent to-[#c79a3a]/45 sm:w-14" />
        <span aria-hidden className="text-sm text-[#c79a3a]/70">❖</span>
      </div>

      {/* بطاقات glass فاخرة بنفس ستايل بطاقات الموقع (hairline ذهبي + رفعة وظل عند المرور) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {items.map((it, i) => (
          <Link
            key={it.key}
            to={it.to}
            className="glass group animate-fade-up relative flex flex-col items-center overflow-hidden p-4 text-center transition duration-300 hover:-translate-y-1.5 hover:shadow-glow"
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
          >
            <span className="dash-hairline absolute inset-x-0 top-0" />
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden">
              {it.img ? (
                <img
                  src={it.img.startsWith('/') ? it.img : cldThumb(it.img, 400)}
                  alt={it.name}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-wine/60" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 4a3 3 0 0 0 6 0" />
                  <path d="M12 4 4.5 9v3l3-1.5V20h9V10.5l3 1.5V9L12 4Z" />
                </svg>
              )}
            </div>
            <span className="mt-2 font-display text-sm font-bold text-stone-100">{it.name}</span>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-wine/25 px-3.5 py-1 text-[11px] font-bold text-wine transition group-hover:border-wine group-hover:bg-wine group-hover:text-cream">
              {t('home.shopNow')}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

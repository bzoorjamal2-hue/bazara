import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import { PageTitle } from '../components/PageUI.jsx';
import { GridIcon } from '../components/icons.jsx';
import api from '../api/client.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { cldThumb } from '../utils/cloudinary.js';
import { platformCatKeys, platformCatName, platformCatImage, platformCatImageFallback, usePublicCatKeys, useLiveDepartments, storeOnlyCats, catDept } from '../utils/platformCategories.js';
import { normDept, presentDepts } from '../utils/departments.js';
import { DeptHeading } from '../components/DeptTabs.jsx';
import DeptIcon from '../components/DeptIcon.jsx';

// صفحة تصنيفات الموقع العام (بازارا) — فئات بازارا الأصلية + الفئات المخصّصة المجمّعة من
// كل المتاجر (يعيدها /public/categories). أي فئة يضيفها أي متجر تظهر هنا تلقائياً بنفس
// شكل الفئات الأصلية. لا تعتمد على متجر صاحب الحساب المسجّل (الصفحة تبقى بازارا خالصة).
export default function Categories() {
  const catKeys = usePublicCatKeys();
  const liveDepts = useLiveDepartments();
  const { t, i18n } = useTranslation();
  const [custom, setCustom] = useState(() => getCache('publicCats') || []);
  useEffect(() => {
    api.get('/public/categories')
      .then((r) => { const c = r.data.customCategories || []; setCustom(c); setCache('publicCats', c); })
      .catch(() => { /* الفئات المخصّصة اختيارية — الأصلية تكفي */ });
  }, []);
  const items = [
    ...catKeys.map((c) => ({ key: c, name: platformCatName(c, t, i18n.language), to: `/category/${c}`, img: platformCatImage(c), fallback: platformCatImageFallback(c), dept: catDept(c) })),
    ...storeOnlyCats(custom, catKeys).map((c) => ({ key: c.key, name: c.name, to: `/category/${c.key}`, img: c.image || '', dept: normDept(c.dept) })),
  ].filter((it) => liveDepts.includes(it.dept));
  // الأقسام متتاليةً برؤوسها حين يجمع الموقع أكثر من قسم؛ وإلّا شبكةٌ واحدة كما كانت
  const groups = presentDepts(items, (it) => it.dept);

  return (
    <>
      <Seo title={t('nav.categories')} />
      <PageTitle icon={<GridIcon className="h-6 w-6" />} title={t('nav.categories')} />

      {groups.map((d) => (
      <section key={d} className={groups.length > 1 ? 'mb-10' : ''}>
      {groups.length > 1 && <DeptHeading dept={d} />}
      {/* بطاقةٌ واحدة هادئة كبطاقات المتاجر بالرئيسية — بلا خيطٍ علويّ ولا هالة */}
      <div className="bz-cards">
        {items.filter((it) => it.dept === d).map((it, i) => (
          <Link
            key={it.key}
            to={it.to}
            className="bz-storecard group animate-fade-up relative flex flex-col items-center overflow-hidden rounded-2xl p-4 text-center transition duration-300 hover:-translate-y-1.5"
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
          >
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden">
              {it.img ? (
                <img
                  src={it.img.startsWith('/') ? it.img : cldThumb(it.img, 400)}
                  alt={it.name}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // متصفّحٌ لا يعرف WebP: نسقط للـPNG مرّةً واحدة لا حلقةً
                    if (it.fallback && e.currentTarget.src !== it.fallback) e.currentTarget.src = it.fallback;
                  }}
                />
              ) : (
                <DeptIcon dept={it.dept} className="bz-field-ico h-1/2 w-1/2" strokeWidth={1.2} />
              )}
            </div>
            <span className="bz-card-name mt-2 text-sm font-bold">{it.name}</span>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-wine/25 px-3.5 py-1 text-[11px] font-bold text-wine transition group-hover:border-wine group-hover:bg-wine group-hover:text-cream">
              {t('home.shopNow')}
            </span>
          </Link>
        ))}
      </div>
      </section>
      ))}
    </>
  );
}

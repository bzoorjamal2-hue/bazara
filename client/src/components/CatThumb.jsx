import CatIcon from './CatIcon.jsx';
import { CLOTHING_CATS } from '../utils/departments.js';
import { catDept, platformCatImage } from '../utils/platformCategories.js';

// أيقونة فئة صغيرة تستعمل صورة الفئة (/categories/{cat}.png) — بلا إطار/خلفية،
// يظهر شكل الأيقونة فقط (الصور بلا خلفية).
//
// فئةٌ بلا رسمٍ مقصوص (الفئتان العامّتان للأحذية والإكسسوارات، وما تضيفه
// التاجرة بلا صورة) تأخذ أيقونة قسمها بدل صورةٍ مكسورةٍ تُخفى فيبقى فراغ.
// ‏dept يُمرَّر لفئات المتجر الخاصّة: قسمها عند المتجر لا عند المنصّة.
// ‏icon: شكلٌ بديل لفئة تاجرةٍ بلا صورة — شكل فئة المنصّة المربوطة بها (صنادل…)
export default function CatThumb({ cat, dept, icon, className = 'h-8 w-8' }) {
  if (!CLOTHING_CATS.includes(cat)) {
    // فئة منصّةٍ أضافها المدير بصورتها
    const img = platformCatImage(cat);
    if (img) return <img src={img} alt="" aria-hidden="true" loading="lazy" className={`${className} shrink-0 object-contain`} />;
    return (
      <span className={`${className} flex shrink-0 items-center justify-center`} aria-hidden="true">
        <CatIcon cat={icon || cat} dept={dept || catDept(cat)} className="h-[70%] w-[70%]" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <img
      src={platformCatImage(cat)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`${className} shrink-0 object-contain`}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

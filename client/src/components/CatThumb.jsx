// أيقونة فئة صغيرة تستعمل صورة الفئة (/categories/{cat}.jpg) — بلا إطار/خلفية،
// يظهر شكل الأيقونة فقط (الصور بلا خلفية).
export default function CatThumb({ cat, className = 'h-8 w-8' }) {
  return (
    <img
      src={`/categories/${cat}.jpg`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`${className} shrink-0 object-contain`}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

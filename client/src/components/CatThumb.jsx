// أيقونة فئة صغيرة تستعمل صورة اللوقو المصمّمة (/categories/{cat}.png)،
// مقصوصة على الملبس (بدون نص الاسم بالأسفل).
export default function CatThumb({ cat, className = 'h-8 w-8' }) {
  return (
    <img
      src={`/categories/${cat}.png`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      style={{ background: '#594335' }}
      className={`${className} shrink-0 rounded-lg object-contain ring-1 ring-wine/15`}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

import { Link } from 'react-router-dom';

// عناصر صفحات الزبونة المشتركة.
//
// كانت كلّ صفحةٍ تكتب ترويستها وبطاقة فراغها وأزرارها بنفسها: نفس الشكل
// تقريباً، بترتيبٍ مختلفٍ قليلاً، وبتدرّجٍ مكتوبٍ داخل السطر منسوخٍ حرفياً
// خمس مرّات. النتيجة أنّ الصفحات تتشابه ولا تتطابق، وأنّ أيّ تعديلٍ على
// الزرّ يحتاج خمس زيارات. الشكل هنا، والصفحات تصف محتواها فحسب.

// ترويسة: أيقونة + عنوان + سطر شرح
export function PageTitle({ icon, title, sub }) {
  return (
    <div className="bz-ph">
      {icon && <span aria-hidden className="bz-ph-ico">{icon}</span>}
      <h1 className="bz-ph-t">{title}</h1>
      {sub && <p className="bz-ph-sub">{sub}</p>}
    </div>
  );
}

// بطاقة حالة: فراغٌ أو خطأ — دائماً بأيقونةٍ ومخرج، فلا تبقى الزائرة معلّقة
export function StateCard({ icon, title, text, children }) {
  return (
    <div className="bz-state">
      {icon && <span aria-hidden className="bz-state-ico">{icon}</span>}
      {title && <p className="bz-state-t">{title}</p>}
      {text && <p className="bz-state-p">{text}</p>}
      {children && <div className="bz-state-acts">{children}</div>}
    </div>
  );
}

// زرّ الفعل الأساسيّ — يقبل to (رابط) أو onClick (زرّ)
export function Act({ to, children, className = '', ...rest }) {
  const cls = `bz-act ${className}`.trim();
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

// الفعل الثانويّ
export function Act2({ to, children, className = '', ...rest }) {
  const cls = `bz-act-2 ${className}`.trim();
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

// عنوان قسمٍ صغير داخل الصفحة، مع عدّادٍ اختياريّ
export function SubHead({ children, count, className = '' }) {
  return (
    <h2 className={`bz-sub-h ${className}`.trim()}>
      {children}
      {count != null && <span> · {count}</span>}
    </h2>
  );
}

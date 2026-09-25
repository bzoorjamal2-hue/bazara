// جذرُ النوافذ المنبثقة: داخل .theme-pub (لتصلها ألوان النهار/الليل) لا داخل الصفحة.
// داخل الصفحة قد يكون أحد الآباء متحرّكاً (transform/filter) فيصير هو إطار أيّ عنصر
// fixed بدل الشاشة — فتنزل النافذة لأسفل الصفحة أو تُقصّ أو يبدأ ظلّها من منتصفها.
export default function modalRoot() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.theme-pub') || document.body;
}

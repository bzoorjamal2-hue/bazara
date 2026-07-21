import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// زر «العودة للأعلى» عائم — يظهر بعد التمرير لأسفل بمسافة كافية على الصفحات الطويلة.
//
// ترتيب الأزرار العائمة بالموقع (نمط المتاجر العالمية):
//   جهة النهاية (end): واتساب — زر التواصل الأساسي، بالأسفل ليسهل الوصول إليه.
//   جهة البداية (start): عمود عمودي — مساعِدة الأناقة بالأسفل، وهذا الزر فوقها.
// زر المساعِدة لا يظهر بكل الصفحات، فلا نخمّن موضعه من المسار (جرّبناه فأخطأ: المساعِدة
// تظهر بالرئيسية أيضاً لا بصفحات /store/ وحدها). بدلاً من ذلك نقيس الزر نفسه وقت العرض
// ونجلس فوقه بفراغ ثابت — يبقى الترتيب صحيحاً مهما تغيّر مقاسه أو موضعه لاحقاً.
const BASE_BOTTOM = 84; // يكفي لتخطّي الشريط السفلي حين لا يوجد زر تحتنا
const GAP = 12;

export default function ScrollToTopButton() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [bottom, setBottom] = useState(BASE_BOTTOM);

  useEffect(() => {
    // بلا requestAnimationFrame: لا يعمل بالتبويبات الخلفية، و React يتجاهل نفس القيمة
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // نقيس زر المساعِدة (إن وُجد بهذه الصفحة) ونجلس فوقه. نعيد القياس عند الظهور وبعد
  // لحظة — قد يُركَّب الزر بعد تحميل بيانات المتجر فيتغيّر الترتيب.
  useEffect(() => {
    if (!show) return undefined;
    const measure = () => {
      const el = document.querySelector('[data-fab="stylist"]');
      if (!el) { setBottom(BASE_BOTTOM); return; }
      const r = el.getBoundingClientRect();
      setBottom(Math.round(window.innerHeight - r.top + GAP));
    };
    measure();
    const id = setTimeout(measure, 700);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(id); window.removeEventListener('resize', measure); };
  }, [show]);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      className="fixed start-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-wine/90 text-cream shadow-lg ring-1 ring-cream/20 transition hover:bg-wine hover:scale-110 active:scale-95 animate-fade-in"
      style={{ bottom: bottom === BASE_BOTTOM ? `calc(env(safe-area-inset-bottom, 0px) + ${BASE_BOTTOM}px)` : `${bottom}px` }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}

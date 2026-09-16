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
const GAP = 12; // الفراغُ بينه وبين زرِّ المساعِدةِ تحتَه

export default function ScrollToTopButton() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  // ارتفاعُ ما تحتَنا (زرُّ المساعِدةِ + فراغُه) لا موضعُنا المطلق — انظر أدناه
  const [stack, setStack] = useState(0);

  useEffect(() => {
    // بلا requestAnimationFrame: لا يعمل بالتبويبات الخلفية، و React يتجاهل نفس القيمة
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // نقيسُ زرَّ المساعِدةِ (إن وُجد بهذه الصفحة) ونجلسُ فوقَه. نعيدُ القياسَ عند الظهورِ
  // وبعدَ لحظة — قد يُركَّبُ الزرُّ بعدَ تحميلِ بياناتِ المتجرِ فيتغيّرُ الترتيب.
  //
  // والمقيسُ ارتفاعُه لا موضعُه: كان يُحسَبُ موضعٌ مطلقٌ بالبكسل من حافّةِ الشاشة،
  // فيجمُدُ عندَه. ولمّا صارت الأزرارُ تنزلُ مع الشريطِ السفليِّ بقيَ هذا وحدَه
  // معلّقاً حيث كان. أمّا الارتفاعُ فثابتٌ لا يتغيّرُ بحركةِ الشريط، فنبني عليه
  // موضعاً نسبيّاً من ‎--bz-fab-bottom نفسِه — فينزلُ الثلاثةُ معاً بمدّةٍ واحدة.
  //
  // و‎offsetHeight لا ‎getBoundingClientRect: الأخيرُ يقرأُ المقاسَ بعدَ التحويل،
  // فلو قِسناه والمؤشّرُ فوقَ الزرِّ (‎scale 1.06) لجاءَ أكبرَ من حقيقتِه.
  useEffect(() => {
    if (!show) return undefined;
    const measure = () => {
      const el = document.querySelector('[data-fab="stylist"]');
      setStack(el ? el.offsetHeight + GAP : 0);
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
      className="bz-fab bz-fab-pos fixed start-5 z-40 flex h-11 w-11 items-center justify-center rounded-full animate-fade-in"
      style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + var(--bz-fab-bottom) + ${stack}px)` }}
    >
      {/* نصفُ قطرِ الزرّ كإخوتِه: ٢٠ من ٤٤ كانت ٤٥٪ بينما الأُخريانِ ٥٠٪،
          فيبدو السهمُ أنحلَ منهما بلا سبب */}
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}

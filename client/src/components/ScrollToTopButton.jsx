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

  // نقيسُ زرَّ المساعِدةِ (إن وُجد بهذه الصفحة) ونجلسُ فوقَه — **مع كلِّ تمرير**، لا مرّةً
  // عند الظهورِ وبعدَ لحظة كما كان: الزرُّ يُركَّبُ بعدَ تحميلِ بياناتِ المتجر، والتنقّلُ
  // بين الصفحاتِ يُبقي هذا الزرَّ ظاهراً بلا إعادةِ قياس — فكان يبقى على قياسِ صفحةٍ بلا
  // مساعِدة (صفر) ويقعدُ فوقَها تماماً. القياسُ رخيص، و React يتجاهلُ القيمةَ نفسَها.
  //
  // والمقيسُ ارتفاعُه لا موضعُه: الارتفاعُ ثابتٌ لا يتغيّرُ بحركةِ الشريطِ السفليّ، فنبني
  // عليه موضعاً نسبيّاً من ‎--bz-fab-bottom نفسِه — فينزلُ الثلاثةُ معاً بمدّةٍ واحدة.
  // و‎offsetHeight لا ‎getBoundingClientRect: الأخيرُ يقرأُ المقاسَ بعدَ التحويل،
  // فلو قِسناه والمؤشّرُ فوقَ الزرِّ (‎scale 1.06) لجاءَ أكبرَ من حقيقتِه.
  useEffect(() => {
    const update = () => {
      const on = window.scrollY > 600;
      setShow(on);
      if (!on) return;
      const el = document.querySelector('[data-fab="stylist"]');
      setStack(el && el.offsetHeight ? el.offsetHeight + GAP : 0);
    };
    update();
    const id = setInterval(update, 1500); // زرٌّ رُكِّبَ أو أُزيلَ والصفحةُ ساكنة
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      clearInterval(id);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

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

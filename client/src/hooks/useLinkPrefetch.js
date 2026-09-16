import { useEffect } from 'react';
import { prefetchRoute, routeKeyOf } from '../utils/prefetchRoute.js';

/* ═══════ الجلبُ المسبَقُ لكلِّ رابطٍ بالموقع ═══════
   الشريطُ السفليُّ كان واحداً من عشراتِ الروابط: بطاقاتُ المنتجات، بلاطاتُ
   الفئات، بطاقاتُ المتاجر، الأدراج، الهيدر، الفوتر. وتعديلُ كلِّ مكوّنٍ على حِدة
   يعني أن نتذكّرَ ذلك بكلِّ رابطٍ يُضاف بعدَ اليوم — ولن نتذكّر.

   مستمعٌ واحدٌ على المستندِ يكفي: الحدثُ يصعدُ من أيِّ رابطٍ مهما عمُق، فنجدُ
   أقربَ <a> ونجلبُ حزمةَ وجهتِه. يغطّي ما كُتب وما سيُكتَب.

   و‎pointerdown لا ‎click: يسبقُه بنحوِ مئةِ مليّ ثانيةٍ على اللمس — زمنُ وضعِ
   الإصبعِ ورفعِه — فتصلُ الضغطةُ والحزمةُ جاهزةٌ أو قاربت. وعلى الفأرةِ نسبقُ
   أكثر: ‎pointerover يقعُ قبلَ الضغطةِ بمئاتِ المليّ ثانية.

   والحدثانِ سلبيّان (passive) فلا يعترضانِ طريقَ التمريرِ على وحدةِ الرسم،
   والجلبُ يُنفَّذُ مرّةً لكلِّ حزمةٍ (يُحرسُ داخلَ prefetchRoute). */
export default function useLinkPrefetch() {
  useEffect(() => {
    const warm = (e) => {
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      // الداخليُّ وحدَه: الخارجيُّ ليس له حزمةٌ عندنا، والمرساةُ والبريدُ والهاتف لا تنقل
      if (!href.startsWith('/')) return;
      if (a.target === '_blank') return;
      const key = routeKeyOf(href);
      if (key) prefetchRoute(key);
    };
    document.addEventListener('pointerdown', warm, { passive: true, capture: true });
    // الفأرةُ وحدَها: على اللمسِ يُطلقُ المتصفّحُ ‎pointerover قبلَ ‎pointerdown
    // بلحظةٍ فلا يضيفُ شيئاً، وعلى شاشةٍ تُمرَّرُ بالإصبعِ فوقَ عشراتِ البطاقاتِ
    // قد يُغري بجلبِ ما لا يُفتَح.
    if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      document.addEventListener('pointerover', warm, { passive: true, capture: true });
    }
    return () => {
      document.removeEventListener('pointerdown', warm, { capture: true });
      document.removeEventListener('pointerover', warm, { capture: true });
    };
  }, []);
}

// طباعة ورقة (فاتورة) من الصفحة نفسها — بلا إطار مخفيّ.
//
// كانت الفاتورة تُطبع داخل iframe مخفيّ (0×0) عبر setTimeout، وهاض بيمشي على
// كروم/إيدج بس سفاري على الآيفون بيحجبه ويطلّع «This website has been blocked
// from automatically printing»: عنده الطباعة من إطارٍ بلا حجم، أو بعد أي تأخير
// يقطع إيماءة اللمس، = طباعة تلقائية مشبوهة.
//
// الحل اللي بيشتغل على كل الأجهزة: نحقن الفاتورة داخل حاوية بالصفحة نفسها
// (#bz-print-root) وننادي window.print() بنفس نبضة الضغطة. قواعد @media print
// في index.css بتخفي كل شي غيرها، فما بيطلع بالورقة إلا الفاتورة. وميزة زيادة:
// خطوط التطبيق (Cairo) محمّلة أصلاً بالصفحة، فتطبع بخطّها الحقيقي لا ببديلٍ عنه.

export const PRINT_ROOT_ID = 'bz-print-root';

// نحصر أنماط الفاتورة داخل الحاوية كي لا تتسرّب لباقي اللوحة (الأنماط مكتوبة
// لمستند مستقلّ: body وh1 وtable…). body/html تصير الحاوية نفسها، وغيرها يصير
// أبناءها. @page تُترك كما هي لأنها تخصّ المستند لا عنصراً.
export function scopeCss(css, scope) {
  return String(css)
    .replace(/\/\*[\s\S]*?\*\//g, '') // التعليقات أولاً كي لا تُحسب جزءاً من المُحدِّد
    .replace(/(^|\})\s*([^{}@]+?)\s*\{/g, (_m, close, selectors) => {
      const list = selectors.split(',').map((raw) => {
        const s = raw.trim();
        if (!s) return '';
        return s === 'body' || s === 'html' ? scope : `${scope} ${s}`;
      }).filter(Boolean).join(',');
      return `${close}${list}{`;
    });
}

/**
 * يطبع قصاصة HTML بأنماطها.
 * @param {string} html جسم الورقة
 * @param {string} css أنماطها (مكتوبة كمستند مستقلّ)
 * @param {string} title عنوان المستند — يصير اسم ملف PDF عند «حفظ كـPDF»
 */
export function printSheet(html, css, title) {
  let root = document.getElementById(PRINT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = PRINT_ROOT_ID;
    root.setAttribute('dir', 'rtl'); // الفاتورة عربية دائماً مهما كانت لغة اللوحة
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
  }
  root.innerHTML = `<style>${scopeCss(css, `#${PRINT_ROOT_ID}`)}</style>${html}`;

  const prevTitle = document.title;
  if (title) document.title = title;

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    window.removeEventListener('afterprint', cleanup);
    root.innerHTML = '';
    document.title = prevTitle;
  };
  window.addEventListener('afterprint', cleanup);
  // شبكة أمان: بعض المتصفّحات لا تُطلق afterprint (أو يُلغي المستخدم الحوار
  // بطريقة لا تُطلقه) — لا نترك العنوان مبدّلاً ولا القصاصة معلّقة بالصفحة.
  setTimeout(cleanup, 60000);

  // بنفس نبضة الضغطة — أي تأخير هنا يجعلها «طباعة تلقائية» بنظر سفاري
  window.print();
}

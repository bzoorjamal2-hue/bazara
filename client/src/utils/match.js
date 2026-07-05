// مطابقة أسماء المدن/المناطق العربية بين نص حرّ وقوائم شركات التوصيل
// (مشتركة بين أوبتيموس وEPS)

// تطبيع نص عربي للمطابقة: إزالة التشكيل/أل التعريف/الفواصل وتوحيد الألف والياء والتاء المربوطة
export const norm = (s) =>
  String(s || '')
    .replace(/[ً-ْ]/g, '')
    .replace(/\(.*?\)/g, ' ') // إزالة اسم المدينة بين قوسين بأسماء المناطق: "عابا الغربية (جنين)"
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/(^|\s)ال/g, '$1') // إزالة "ال" التعريف من بداية كل كلمة (بحدود موثوقة)
    .replace(/[-_،,.،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// كلمات وصفية عامّة في العناوين ليست أسماء أماكن — نستبعدها من المطابقة حتى لا
// تسبّب تطابقاً خاطئاً. مثال: "رابا اول البلد" كان يطابق منطقة "جنين البلد" بسبب
// كلمة "البلد"؛ باستبعادها تبقى "رابا" وحدها هي المميِّزة.
const STOP = new Set([
  'بلد', 'بلده', 'شارع', 'حي', 'حاره', 'دوار', 'عماره', 'بنايه', 'طابق', 'مبنى', 'برج',
  'بجانب', 'جنب', 'قرب', 'مقابل', 'خلف', 'امام', 'فوق', 'تحت', 'بين', 'عند', 'اول',
  'وسط', 'اخر', 'رئيسي', 'فرعي', 'قديمه', 'جديده', 'شماليه', 'جنوبيه', 'شرقيه', 'غربيه',
]);

// كلمات مميّزة (طول ≥ 2، وليست وصفاً عامّاً) للمطابقة بحدود الكلمات — يمنع المطابقة
// داخل كلمة أخرى (مثلاً منطقة "عابا" لا تطابق كلمة "شعبان") ويتجاهل كلمات الوصف
const tokenize = (s) => norm(s).split(' ').filter((w) => w.length >= 2 && !STOP.has(w));

// مطابقة مُسجَّلة: تُرجّع أفضل عنصر مع درجة ثقة 0..100 (أعلى = أدقّ). تعتمد المطابقة
// على الكلمات لا على السلاسل الجزئية، فتتفادى المطابقات الخاطئة. تُستخدم للإرسال
// التلقائي: نُرسل مباشرة فقط عند درجة عالية، وإلا نطلب تأكيداً سريعاً.
export function bestMatchScored(text, list) {
  const nt = norm(text);
  if (!nt || !Array.isArray(list) || !list.length) return null;
  const textTokens = new Set(tokenize(text));
  let best = null;
  for (const it of list) {
    const nn = norm(it.name);
    if (nn.length < 2) continue;
    const nameTokens = tokenize(it.name);
    let score = 0;
    if (nt === nn) {
      score = 100; // تطابق تامّ
    } else if (nameTokens.length && nameTokens.every((w) => textTokens.has(w))) {
      // كل كلمات اسم المنطقة موجودة في العنوان (بحدود الكلمات) — تطابق قوي جداً
      // مثال: عنوان "رابا قرب المسجد" ⇄ منطقة "رابا"
      score = 80 + Math.min(nn.length, 15);
    } else {
      // تطابق جزئي: نسبة كلمات اسم المنطقة (≥3 حروف) الموجودة في العنوان
      const strong = nameTokens.filter((w) => w.length >= 3 && textTokens.has(w));
      if (strong.length) score = 40 + Math.round((strong.length / nameTokens.length) * 40); // 40..80
    }
    if (score > (best?.score || 0)) best = { it, score };
  }
  return best;
}

// أفضل تطابق فوق عتبة أمان — للاستخدام العام (المدن/EPS): يُرجّع العنصر أو null
export function bestMatch(text, list) {
  const b = bestMatchScored(text, list);
  return b && b.score >= 45 ? b.it : null;
}

// يزيل كلمات أسماء معروفة (المدينة/القرية) من العنوان الحرّ ويُبقي التفاصيل فقط.
// مثال: stripNames('رابا اول البلد', ['جنين','رابا']) → 'اول البلد'
// نستخدمه ليذهب اسم المدينة لحقل المدينة، والقرية لحقل المنطقة، والباقي فقط
// لحقل العنوان التفصيلي في أوبتيموس (بلا تكرار).
export function stripNames(text, names = []) {
  const drop = new Set();
  for (const n of names) for (const w of norm(n).split(' ')) if (w) drop.add(w);
  if (!drop.size) return String(text || '').trim();
  const kept = String(text || '')
    .split(/[\s،,]+/)
    .filter((raw) => {
      const nw = norm(raw);
      return nw && !nw.split(' ').every((p) => drop.has(p)); // نُسقط الكلمة إن كانت كلها ضمن الأسماء المعروفة
    });
  return kept.join(' ').trim();
}

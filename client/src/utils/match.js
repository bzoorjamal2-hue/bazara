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
    .replace(/\bال/g, '')
    .replace(/[-_،,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// أفضل تطابق بالاسم بين نص حرّ وقائمة {id,name} — بعتبة تمنع المطابقة الخاطئة
export function bestMatch(text, list) {
  const nt = norm(text);
  if (!nt || !Array.isArray(list)) return null;
  let best = null;
  for (const it of list) {
    const nn = norm(it.name);
    if (nn.length < 3) continue;
    let score = 0;
    if (nt === nn) score = 100;
    else if (nt.includes(nn)) score = 50 + nn.length;
    else if (nn.includes(nt)) score = 40 + nt.length;
    if (score > (best?.score || 0)) best = { it, score };
  }
  return best && best.score >= 43 ? best.it : null;
}

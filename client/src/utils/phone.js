// تحقّق أرقام الموبايل الفلسطينية / الداخل: الصيغة المحليّة 05XXXXXXXX (١٠ أرقام).
// نقبل رمز الدولة (+970 / +972 / 00…) ونحوّله لصيغة محليّة قبل التحقّق، فلا تُرفض
// الزبونة اللي كتبت رقمها برمز الدولة.

// يُرجّع الأرقام فقط بصيغة محليّة موحّدة (05XXXXXXXX إن أمكن)
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);          // بادئة دولية 00
  if (d.startsWith('970') || d.startsWith('972')) d = d.slice(3); // رمز فلسطين/الداخل
  if (d.length === 9 && d.startsWith('5')) d = '0' + d; // 5XXXXXXXX → 05XXXXXXXX
  return d;
}

// رقم موبايل صحيح = 05 يتبعها ٨ أرقام (المجموع ١٠)
export function isValidMobile(raw) {
  return /^05\d{8}$/.test(normalizePhone(raw));
}

// تنظيف ما تكتبه الزبونة لحظةً بلحظة: أرقام فقط، بلا مقدّمات دوليّة (00970/‎+972…)،
// وبحدٍّ أقصى ١٠ خانات — لأن أوبتيموس يرفض أي رقم أطول أو أقصر من ١٠ أو بمقدّمة دوليّة.
export function sanitizeMobileInput(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);                        // 00970… / 00972…
  if (d.startsWith('970') || d.startsWith('972')) d = d.slice(3); // رمز الدولة بلا 00 أو بعد +
  if (d.startsWith('5')) d = '0' + d;                             // 5XXXXXXXX → 05XXXXXXXX
  return d.slice(0, 10);                                          // ١٠ خانات لا أكثر
}

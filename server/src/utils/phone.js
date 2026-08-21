// توحيد أرقام الموبايل قبل تخزينها أو إرسالها لشركة التوصيل (أوبتيموس).
// أوبتيموس يرفض أي رقم غير ١٠ خانات، ويرفض المقدّمات الدوليّة (00970 / +972 …)،
// فنحوّل كل صيغة لصيغة محليّة موحّدة: 05XXXXXXXX.
export function normalizeMobile(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);                         // بادئة دوليّة 00
  if (d.startsWith('970') || d.startsWith('972')) d = d.slice(3); // رمز فلسطين/الداخل
  if (d.length === 9 && d.startsWith('5')) d = '0' + d;           // 5XXXXXXXX → 05XXXXXXXX
  return d;
}

// رقم موبايل صحيح = 05 يتبعها ٨ أرقام (المجموع ١٠)
export function isValidMobile(raw) {
  return /^05\d{8}$/.test(normalizeMobile(raw));
}

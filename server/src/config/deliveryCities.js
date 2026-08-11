// قائمة المدن الفلسطينية للتوصيل (مستوى المدينة فقط — القرية/الشارع يُكتب بالعنوان التفصيلي).
// كل مدينة لها "شريحة" (tier): wb = مدن الضفة · quds = القدس · dakhel = مدن الداخل (48).
// السعر لا يأتي من أوبتيموس (يحسبه وقت الشحن)، فنعتمد شرائح يحدّد صاحب المتجر أسعارها
// ويقدر يضيف استثناءً لأي مدينة. الأسماء عربية قياسية تُطابق ما يعرفه الزبون والشركة.

export const DELIVERY_TIER_DEFAULTS = { wb: 30, quds: 40, dakhel: 80 };

export const PS_CITIES = [
  // ── مدن الضفة الغربية (wb) ──
  { name: 'رام الله والبيرة', tier: 'wb' },
  { name: 'البيرة', tier: 'wb' },
  { name: 'بيتونيا', tier: 'wb' },
  { name: 'نابلس', tier: 'wb' },
  { name: 'الخليل', tier: 'wb' },
  { name: 'دورا', tier: 'wb' },
  { name: 'يطا', tier: 'wb' },
  { name: 'حلحول', tier: 'wb' },
  { name: 'بيت أمر', tier: 'wb' },
  { name: 'سعير', tier: 'wb' },
  { name: 'بني نعيم', tier: 'wb' },
  { name: 'ترقوميا', tier: 'wb' },
  { name: 'إذنا', tier: 'wb' },
  { name: 'بيت لحم', tier: 'wb' },
  { name: 'بيت جالا', tier: 'wb' },
  { name: 'بيت ساحور', tier: 'wb' },
  { name: 'الدوحة', tier: 'wb' },
  { name: 'الخضر', tier: 'wb' },
  { name: 'جنين', tier: 'wb' },
  { name: 'قباطية', tier: 'wb' },
  { name: 'يعبد', tier: 'wb' },
  { name: 'عرابة', tier: 'wb' },
  { name: 'برقين', tier: 'wb' },
  { name: 'طولكرم', tier: 'wb' },
  { name: 'عنبتا', tier: 'wb' },
  { name: 'بلعا', tier: 'wb' },
  { name: 'دير الغصون', tier: 'wb' },
  { name: 'قلقيلية', tier: 'wb' },
  { name: 'عزون', tier: 'wb' },
  { name: 'حبلة', tier: 'wb' },
  { name: 'سلفيت', tier: 'wb' },
  { name: 'بديا', tier: 'wb' },
  { name: 'كفر الديك', tier: 'wb' },
  { name: 'أريحا', tier: 'wb' },
  { name: 'طوباس', tier: 'wb' },
  { name: 'طمون', tier: 'wb' },
  { name: 'عقربا', tier: 'wb' },
  { name: 'حوارة', tier: 'wb' },
  { name: 'بيتا', tier: 'wb' },
  { name: 'عصيرة الشمالية', tier: 'wb' },
  { name: 'سبسطية', tier: 'wb' },
  { name: 'بيت فوريك', tier: 'wb' },
  { name: 'سلواد', tier: 'wb' },
  { name: 'سنجل', tier: 'wb' },
  { name: 'دير دبوان', tier: 'wb' },
  { name: 'بيرزيت', tier: 'wb' },
  { name: 'عين يبرود', tier: 'wb' },
  { name: 'دير جرير', tier: 'wb' },
  { name: 'رنتيس', tier: 'wb' },

  // ── القدس (quds) ──
  { name: 'القدس', tier: 'quds' },
  { name: 'بيت حنينا', tier: 'quds' },
  { name: 'شعفاط', tier: 'quds' },
  { name: 'صور باهر', tier: 'quds' },
  { name: 'جبل المكبر', tier: 'quds' },
  { name: 'سلوان', tier: 'quds' },
  { name: 'الطور', tier: 'quds' },
  { name: 'العيسوية', tier: 'quds' },
  { name: 'بيت صفافا', tier: 'quds' },
  { name: 'أبو ديس', tier: 'quds' },
  { name: 'العيزرية', tier: 'quds' },
  { name: 'عناتا', tier: 'quds' },
  { name: 'الرام', tier: 'quds' },
  { name: 'بير نبالا', tier: 'quds' },
  { name: 'قلنديا', tier: 'quds' },

  // ── مدن الداخل / أراضي 48 (dakhel) ──
  { name: 'حيفا', tier: 'dakhel' },
  { name: 'يافا', tier: 'dakhel' },
  { name: 'عكا', tier: 'dakhel' },
  { name: 'الناصرة', tier: 'dakhel' },
  { name: 'الرملة', tier: 'dakhel' },
  { name: 'اللد', tier: 'dakhel' },
  { name: 'أم الفحم', tier: 'dakhel' },
  { name: 'الطيبة', tier: 'dakhel' },
  { name: 'الطيرة', tier: 'dakhel' },
  { name: 'قلنسوة', tier: 'dakhel' },
  { name: 'باقة الغربية', tier: 'dakhel' },
  { name: 'كفر قاسم', tier: 'dakhel' },
  { name: 'جلجولية', tier: 'dakhel' },
  { name: 'كفر برا', tier: 'dakhel' },
  { name: 'كفر قرع', tier: 'dakhel' },
  { name: 'عرعرة', tier: 'dakhel' },
  { name: 'جت', tier: 'dakhel' },
  { name: 'سخنين', tier: 'dakhel' },
  { name: 'عرابة البطوف', tier: 'dakhel' },
  { name: 'دير حنا', tier: 'dakhel' },
  { name: 'شفاعمرو', tier: 'dakhel' },
  { name: 'طمرة', tier: 'dakhel' },
  { name: 'كابول', tier: 'dakhel' },
  { name: 'المغار', tier: 'dakhel' },
  { name: 'كفر كنا', tier: 'dakhel' },
  { name: 'الرينة', tier: 'dakhel' },
  { name: 'عيلوط', tier: 'dakhel' },
  { name: 'إكسال', tier: 'dakhel' },
  { name: 'عين ماهل', tier: 'dakhel' },
  { name: 'كفر مندا', tier: 'dakhel' },
  { name: 'البعنة', tier: 'dakhel' },
  { name: 'دير الأسد', tier: 'dakhel' },
  { name: 'مجد الكروم', tier: 'dakhel' },
  { name: 'نحف', tier: 'dakhel' },
  { name: 'يركا', tier: 'dakhel' },
  { name: 'أبو سنان', tier: 'dakhel' },
  { name: 'جديدة المكر', tier: 'dakhel' },
  { name: 'بيت جن', tier: 'dakhel' },
  { name: 'جسر الزرقاء', tier: 'dakhel' },
  { name: 'الفريديس', tier: 'dakhel' },
  { name: 'رهط', tier: 'dakhel' },
  { name: 'تل السبع', tier: 'dakhel' },
  { name: 'حورة', tier: 'dakhel' },
  { name: 'اللقية', tier: 'dakhel' },
  { name: 'بئر السبع', tier: 'dakhel' },
];

// خريطة اسم المدينة → الشريحة (لبحث سريع على الخادم عند إعادة حساب الأجرة)
const NAME_TIER = new Map(PS_CITIES.map((c) => [c.name, c.tier]));

// تطبيع أسعار الشرائح القادمة من الإعداد (٣ أرقام غير سالبة) مع القيم الافتراضية
export function normalizeTiers(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const num = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    wb: num(t.wb, DELIVERY_TIER_DEFAULTS.wb),
    quds: num(t.quds, DELIVERY_TIER_DEFAULTS.quds),
    dakhel: num(t.dakhel, DELIVERY_TIER_DEFAULTS.dakhel),
  };
}

// أجرة مدينة: استثناء المتجر (zones) أولاً، ثم سعر الشريحة، ثم شريحة الضفة كافتراضي.
export function feeForCity(cityName, tiers, overrides) {
  const name = String(cityName || '').trim();
  if (!name) return 0;
  const ov = Array.isArray(overrides) ? overrides.find((z) => z && z.name === name) : null;
  if (ov && ov.fee != null && ov.fee !== '') return Math.max(0, Number(ov.fee) || 0);
  const tier = NAME_TIER.get(name);
  const tt = normalizeTiers(tiers);
  return tier ? tt[tier] : tt.wb;
}

// القائمة الكاملة مع الأجرة المحسوبة لكل مدينة — لواجهة الزبون والتاجر
export function citiesWithFees(tiers, overrides) {
  const tt = normalizeTiers(tiers);
  return PS_CITIES.map((c) => ({ name: c.name, tier: c.tier, fee: feeForCity(c.name, tt, overrides) }));
}

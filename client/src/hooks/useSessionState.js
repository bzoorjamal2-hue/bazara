import { useEffect, useState } from 'react';

// useState لكن الحالة تنجو من التنقّل.
//
// أقسام اللوحة تُبدَّل بالرابط، وكل تبديل يُفكّك القسم فيضيع كل شي: البحث الذي
// كتبه، التصفية التي اختارها، حتى النموذج الذي كان مفتوحاً. يخرج ليتأكّد من شي
// ويرجع فيلاقي القسم من الصفر. هذا الخُطّاف يحفظ الحالة بذاكرة الجلسة ويعيدها
// عند العودة — يُقرأ عند أول رسمة (لا بعدها) فلا وميض ولا حالة قديمة تُدهَس.
//
// ذاكرة الجلسة لا القرص: تنتهي بإغلاق التبويب، فلا تلاحق صاحب المتجر غداً
// بتصفيةٍ نسيها. وللمسودّات الطويلة (نماذج الإدخال) انظر useDraft.

const PREFIX = 'bz_ss:';

export function clearSessionState(key) {
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* تصفّح خاص */ }
}

// مسحُ كلِّ ما حفظه هذا الخُطّاف — عند الخروج أو تبدّل الحساب. البحثُ والتصفيةُ
// تخصُّ صاحبَها: حسابٌ يدخلُ بعده على نفسِ المتصفّح لا يرثُ كلمةَ بحثِ غيره.
export function clearAllSessionState() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      // ‎bz_dash_tab: آخرُ قسمٍ فُتح باللوحة — حسابٌ آخرُ يبدأ من رئيسيّةِ لوحتِه لا من قسمِ غيره
      if (k && (k.startsWith(PREFIX) || k === 'bz_dash_tab')) sessionStorage.removeItem(k);
    }
  } catch { /* تصفّح خاص */ }
}

export default function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });

  useEffect(() => {
    try { sessionStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch { /* ممتلئة أو تصفّح خاص — الحفظ ميزة مساعدة لا تُعطّل القسم */ }
  }, [key, value]);

  return [value, setValue];
}

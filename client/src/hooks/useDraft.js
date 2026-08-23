import { useEffect, useRef } from 'react';

// حفظ ما يكتبه صاحب المتجر بالنماذج الطويلة كي لا يضيع بالتنقّل.
//
// اللوحة أقسامٌ تُبدَّل بالرابط (?tab=)، وكل تبديل يُفكّك مكوّن القسم فيروح كل ما
// كُتب ولم يُحفظ — يفتح إعدادات المتجر، يكتب نصف الوصف، يقفز لقسم ليتأكّد من شي،
// فيرجع ويلاقي الحقول فاضية. صار كل نموذج يحفظ مسودّته لحظياً بذاكرة الجلسة
// (sessionStorage) ويستعيدها عند العودة، حتى لو دخل أقساماً متداخلة بينهما.
//
// ذاكرة الجلسة لا القرص: تنتهي بإغلاق التبويب فلا تُلاحق أحداً غداً. ومع ذلك
// نضع عمراً أقصى احتياطاً، ونمسح المسودّة فور نجاح الحفظ.

const PREFIX = 'bz_draft:';
const MAX_AGE = 12 * 60 * 60 * 1000; // ١٢ ساعة

export function readDraft(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > MAX_AGE) { sessionStorage.removeItem(PREFIX + key); return null; }
    return data ?? null;
  } catch { return null; }
}

export function clearDraft(key) {
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* تصفّح خاص */ }
}

/**
 * يحفظ الحالة كمسودّة ويستعيدها مرّة واحدة عند التركيب.
 * @param {string} key مفتاح فريد للنموذج (يشمل هويّة العنصر: product:<id>)
 * @param {any} value الحالة الحالية (تُحفظ كما هي)
 * @param {(draft:any)=>void} onRestore يُستدعى بالمسودّة إن وُجدت عند التركيب
 * @param {{ ready?: boolean }} opts ready=false يؤجّل الحفظ والاستعادة حتى تجهز البيانات
 */
export default function useDraft(key, value, onRestore, { ready = true } = {}) {
  const restored = useRef(false);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;

  // استعادة (مرّة واحدة، بعد جهوز النموذج كي لا تدهسها بيانات الخادم)
  useEffect(() => {
    if (!ready || restored.current || !key) return;
    restored.current = true;
    const draft = readDraft(key);
    if (draft != null) restoreRef.current?.(draft);
  }, [key, ready]);

  // حفظ لحظيّ مخنوق: الكتابة السريعة لا تكتب عشرات المرّات بالثانية
  useEffect(() => {
    if (!ready || !restored.current || !key || value == null) return undefined;
    const id = setTimeout(() => {
      try { sessionStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data: value })); }
      catch { /* ممتلئة أو تصفّح خاص — الحفظ ميزة مساعدة لا تُعطّل النموذج */ }
    }, 400);
    return () => clearTimeout(id);
  }, [key, value, ready]);
}

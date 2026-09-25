import { useEffect, useState } from 'react';

// هيرو رأته الزبونةُ بهذه الجلسة: العودةُ إليه (من الشريطِ السفليّ) تُظهرُه حاضراً بلا
// حركةِ دخول — كان يبدأُ معتماً ويظهرُ نصُّه وشعارُه على ثانيةٍ كاملةٍ بكلِّ رجوع.
// الحركةُ تعودُ ما إن تتبدّلَ الشريحة (i يغادرُ صفرَه).
const seen = new Set();
export default function useHeroStill(key, i) {
  const [still] = useState(() => seen.has(key));
  const [moved, setMoved] = useState(false);
  useEffect(() => { seen.add(key); }, [key]);
  useEffect(() => { if (i !== 0) setMoved(true); }, [i]);
  return still && !moved;
}

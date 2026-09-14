import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// شريط إعلانات هادئ — سطرٌ واحدٌ ثابتٌ بلونَي الموقع (كريميٌّ نهاراً، بنّيٌّ داكنٌ
// ليلاً) لا بلوكٌ أسودُ غريبٌ عن الصفحة. كان مارْكي يمشي ومعه لمعةٌ تمسحُ وتدرّجٌ
// يتحرّك بالنصّ: ثلاثُ حركاتٍ بشريطٍ ارتفاعُه ٣٠ بكسل تُعطي إحساسَ إعلانٍ رخيص،
// والرسالةُ لا تُقرأ إلا وهي تمرق. الآن: الرسالةُ واقفةٌ تُقرأ، وإن كانت أكثرَ من
// واحدةٍ تتبدّلُ بتلاشٍ هادئ كلَّ خمسِ ثوانٍ.
export default function AnnouncementBar({ ar, en }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  // نص الشريط يتبع اللغة: إنجليزي عند en (مع رجوع للعربي إن كان فارغاً) والعكس
  const text = (isEn ? (en || ar) : (ar || en)) || '';
  const items = String(text).split('\n').map((s) => s.trim()).filter(Boolean);
  const [i, setI] = useState(0);

  // التبديل مرهونٌ بعدد الإعلانات: إعلانٌ واحدٌ = شريطٌ ساكنٌ تماماً بلا مؤقّت
  useEffect(() => {
    if (items.length < 2) return undefined;
    const id = setInterval(() => setI((v) => (v + 1) % items.length), 5000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[i % items.length];

  return (
    <div className="bz-ann -mx-4 mb-5 overflow-hidden py-2.5 sm:-mx-6">
      {/* للقارئ الصوتي: الإعلانات كلها دفعةً واحدة بلا تكرارٍ مع كل تبديل */}
      <ul className="sr-only">{items.map((s, k) => <li key={k}>{s}</li>)}</ul>
      <p aria-hidden className="flex items-center justify-center gap-2 px-6 text-center">
        <SparkleIcon className="bz-ann-ico h-3.5 w-3.5 shrink-0" />
        {/* المفتاح = النصّ: يُعاد بناء العنصر عند كل تبديل فتُعاد الحركة من أوّلها */}
        <span key={current} className="bz-ann-text line-clamp-2 text-[12.5px] font-semibold tracking-wide sm:text-[13px]" dir="auto">{current}</span>
      </p>
    </div>
  );
}

// نجمة صغيرة تسبق النص — علامةٌ هادئةٌ بلون النصّ نفسه بلا توهّج
function SparkleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2c.5 3.8 2.2 5.5 6 6-3.8.5-5.5 2.2-6 6-.5-3.8-2.2-5.5-6-6 3.8-.5 5.5-2.2 6-6Z" />
    </svg>
  );
}

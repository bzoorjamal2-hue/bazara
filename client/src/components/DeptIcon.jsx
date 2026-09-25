// أيقونات الأقسام الثلاثة بلغة أيقونات الشريط السفليّ: خطّيّةٌ في حالتها العاديّة،
// ومصمتةٌ (filled) حين تكون نشطة — فيقرأ الزائر «أنا هنا» من شكل الأيقونة لا من
// لونها وحده. تُرسَم بـcurrentColor فتأخذ لون ما حولها نهاراً وليلاً.
// الأشكال سيلويتات لا رسومٌ مفصّلة: تبقى مقروءةً بعشرين بكسلاً داخل حبّة.
const SHAPES = {
  // فستانٌ بصدرٍ محدّد وحمّالتين، وخصرٌ مشدود يفصله عن تنّورةٍ تتّسع
  clothing: {
    paths: [
      'M9 2.6c.5 1.5 1.5 2.3 3 2.3s2.5-.8 3-2.3l1.3.6c-.3 1.8-.9 3.4-1.9 4.6l1.2 2.6H8.4l1.2-2.6c-1-1.2-1.6-2.8-1.9-4.6L9 2.6Z',
      'M8.9 11.6h6.2l4.2 8.3c.3.7-.2 1.5-.9 1.5H5.6c-.7 0-1.2-.8-.9-1.5l4.2-8.3Z',
    ],
  },
  // حذاءُ كعبٍ عالٍ: مقدّمةٌ مدبّبة، وقوسٌ مفتوحٌ تحت القدم، وكعبٌ رفيع
  shoes: {
    paths: [
      'M2.6 17.6c0-1 .8-1.6 1.8-1.5 3.2.3 5.9-1 7.9-3.4l2.1-2.6c.8-1 2.2-1.2 3.2-.5l.8.6c1.5 1.1 2.4 2.8 2.4 4.7v.4h-1.2l-.4 6.2h-1.1l-.2-5.9c-2.6.3-5 1.3-7.1 2.9l-.6.5c-.4.3-.9.5-1.4.5H4.1c-.8 0-1.5-.7-1.5-1.5v-.4Z',
    ],
  },
  // حقيبة يدٍ بقفلٍ صغير ومقبضٍ مقوّس
  accessories: {
    paths: [
      'M5.4 9.4h13.2c.8 0 1.4.6 1.5 1.4l.9 8.8c.1.9-.6 1.6-1.5 1.6H4.5c-.9 0-1.6-.7-1.5-1.6l.9-8.8c.1-.8.7-1.4 1.5-1.4Z M10.8 12.6h2.4v1.7a.5.5 0 0 1-.5.5h-1.4a.5.5 0 0 1-.5-.5v-1.7Z',
    ],
    handle: 'M8.6 9.4V7.9a3.4 3.4 0 0 1 6.8 0v1.5',
  },
};

export default function DeptIcon({ dept = 'clothing', filled = false, className = 'h-5 w-5', strokeWidth = 1.6 }) {
  const s = SHAPES[dept] || SHAPES.clothing;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {s.paths.map((d) => <path key={d} d={d} fillRule="evenodd" />)}
      {s.handle && <path d={s.handle} fill="none" stroke="currentColor" strokeWidth={filled ? 1.8 : strokeWidth} strokeLinecap="round" />}
    </svg>
  );
}

// رمز «الأقسام» نفسها (رأس إعدادات أقسام المتجر): طبقاتٌ متراكبة — لا رمز قسمٍ
// بعينه، فالبطاقة عن الثلاثة لا عن الأحذية وحدها.
export function DeptsIcon({ className = 'h-5 w-5', strokeWidth = 1.6 }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3.5 8.5 4.3L12 12 3.5 7.8 12 3.5Z" fill="currentColor" fillOpacity={0.16} />
      <path d="m3.5 12 8.5 4.3 8.5-4.3" />
      <path d="m3.5 16.2 8.5 4.3 8.5-4.3" />
    </svg>
  );
}

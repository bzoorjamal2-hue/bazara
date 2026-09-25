import DeptIcon from './DeptIcon.jsx';

// أيقونات فئات المنصّة للأحذية والإكسسوارات — مكان الرسم المقصوص الذي تحمله فئات
// الملابس السبع، إلى أن يرفع المدير صورةً رسميّة لكلٍّ منها (لوحة «سلايدر الموقع»).
// بلغة أيقونات الأقسام نفسها: خطّيّة، بـcurrentColor، مقروءة بحجم صغير. فئةٌ بلا
// شكلٍ خاصّ (العامّتان، وفئات التاجرة) تأخذ أيقونة قسمها.
const SHAPES = {
  heels: null, // الكعب هو شكل قسم الأحذية نفسه
  sneakers: [
    'M3 15.2c0-.9.7-1.6 1.6-1.6h2.7l2.3-4.2c.3-.6 1.1-.8 1.7-.4l1.3.9c.9.6 2 1 3.1 1h.6c2.5 0 4.6 1.9 4.7 4.4v2.1c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1v-2.2Z',
    'M3.2 16.4h17.6',
    'M10.6 11.6l1.4.9M12.1 10.7l1.3.8',
  ],
  sandals: [
    'M3 17.6c0-.9.7-1.6 1.6-1.6h13c1.9 0 3.4 1.1 3.4 2.4 0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1v-.8Z',
    'M6.5 16l2.4-5.2M11.8 16l-1.1-5.4',
    'M8.4 10.9c1.2-.8 2.6-.9 3.9-.3',
  ],
  boots: [
    'M8.2 3h5.3v8.8c0 .6.4 1.2 1 1.4l4.3 1.8c1.3.5 2.2 1.8 2.2 3.2V20c0 .6-.4 1-1 1H6.4c-.6 0-1-.4-1-1v-1.6L8.2 12V3Z',
    'M5.4 18.6h15.6',
    'M8.2 6.4h5.3',
  ],
  flats: [
    'M3 15.4c0-1 .8-1.7 1.8-1.6 1.7.2 3.3.9 5 .9 2.1 0 3.9-1.9 6.3-1.9 2.6 0 4.9 1.6 4.9 3.7v.6c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1v-1.7Z',
    'M8.6 15.1l1.3-.9 1.3.9-1.3.8-1.3-.8Z',
  ],
  bags: null, // الحقيبة هي شكل قسم الإكسسوارات نفسه
  watches: [
    'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
    'M9.6 7.6 10.1 3h3.8l.5 4.6M9.6 16.4l.5 4.6h3.8l.5-4.6',
    'M12 9.6V12l1.7 1.1',
  ],
  jewelry: [
    'M12 9.2a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2Z',
    'M9.8 6.1 11 4.3h2l1.2 1.8L12 9.2 9.8 6.1Z',
  ],
  sunglasses: [
    'M3.2 10h7.3l-.5 3.4c-.2 1.5-1.5 2.6-3 2.6h-.3c-1.5 0-2.8-1.1-3-2.6L3.2 10Z',
    'M13.5 10h7.3l-.5 3.4c-.2 1.5-1.5 2.6-3 2.6H17c-1.5 0-2.8-1.1-3-2.6L13.5 10Z',
    'M10.5 11c.9-.6 2.1-.6 3 0M3.2 10 2.4 8.2M20.8 10l.8-1.8',
  ],
};

export function hasCatIcon(cat) {
  return Object.prototype.hasOwnProperty.call(SHAPES, cat);
}

export default function CatIcon({ cat, dept = 'clothing', className = 'h-5 w-5', strokeWidth = 1.5 }) {
  const paths = SHAPES[cat];
  if (!paths) {
    const d = cat === 'heels' ? 'shoes' : cat === 'bags' ? 'accessories' : dept;
    return <DeptIcon dept={d} className={className} strokeWidth={strokeWidth} />;
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

// يولّد أيقونات PNG بأحجام مختلفة من icon-master.svg
// عشان تشتغل على Safari (آيفون/آيباد) و Android التي لا تدعم أيقونة SVG.
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('./icon-master.svg', import.meta.url));
// أيقونة محركات البحث/التبويب: ختم دائري يملأ الحاوية الدائرية في Google (بلا مربّع)
const faviconSvg = readFileSync(new URL('./favicon-master.svg', import.meta.url));
const out = (name) => `public/${name}`; // يُشغَّل من مجلد client
const BROWN = '#5e4636'; // بني الخلفية — يملأ الزوايا أيضاً (كان خمري #5C1A2E فتظهر زوايا خمرية)

// أيقونات التطبيق: مربّع بنّي كامل بلا زوايا دائرية داخلية (النظام يدوّرها) —
// نستبدل rx="20" بـ0 فلا تبقى زوايا شفّافة تُملأ بلون مختلف. + تسطيح بنّي احتياطاً.
const svgSquare = Buffer.from(svg.toString('utf8').replace(/rx="20"/g, 'rx="0"'));

// أيقونات بخلفية صلبة (للأجهزة التي تدوّر الزوايا تلقائياً مثل iOS/Android)
const solid = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];
// أيقونات تبويب المتصفح (شفافية الزوايا مقبولة)
const favicons = [
  ['favicon-16.png', 16],
  ['favicon-32.png', 32],
  ['favicon-48.png', 48],
];

for (const [name, size] of solid) {
  await sharp(svgSquare, { density: 384 }).resize(size, size).flatten({ background: BROWN }).png().toFile(out(name));
  console.log('icon:', name, size);
}
for (const [name, size] of favicons) {
  await sharp(faviconSvg, { density: 384 }).resize(size, size).png().toFile(out(name));
  console.log('icon:', name, size);
}

// favicon.ico (متعدّد الأحجام) — للطلب التلقائي /favicon.ico في كل المتصفحات
const ico = await pngToIco(['public/favicon-16.png', 'public/favicon-32.png', 'public/favicon-48.png']);
const { writeFileSync } = await import('node:fs');
writeFileSync('public/favicon.ico', ico);
console.log('icon: favicon.ico');
console.log('done');

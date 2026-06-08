// يولّد أيقونات PNG بأحجام مختلفة من icon-master.svg
// عشان تشتغل على Safari (آيفون/آيباد) و Android التي لا تدعم أيقونة SVG.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('./icon-master.svg', import.meta.url));
const out = (name) => `public/${name}`; // يُشغَّل من مجلد client
const MAROON = '#5C1A2E';

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
  await sharp(svg, { density: 384 }).resize(size, size).flatten({ background: MAROON }).png().toFile(out(name));
  console.log('icon:', name, size);
}
for (const [name, size] of favicons) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(name));
  console.log('icon:', name, size);
}
console.log('done');

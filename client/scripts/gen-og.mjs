// يولّد صورة مشاركة (OG) نظيفة فخمة 1200×630 لموقع Bazara العام.
// تشغيل: node scripts/gen-og.mjs  (يحتاج sharp: npm i --no-save sharp)
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7eed9"/>
      <stop offset="0.5" stop-color="#efe1c6"/>
      <stop offset="1" stop-color="#f7eed9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- إطار ذهبي ناعم -->
  <rect x="28" y="28" width="1144" height="574" rx="28" fill="none" stroke="#c79a3a" stroke-opacity="0.45" stroke-width="2"/>
  <!-- شعار دائري -->
  <circle cx="600" cy="212" r="92" fill="#fffaf0" stroke="#c79a3a" stroke-width="8"/>
  <text x="600" y="248" font-family="Georgia, 'Times New Roman', serif" font-size="110" font-weight="700" fill="#5e4636" text-anchor="middle">B</text>
  <!-- الاسم -->
  <text x="600" y="400" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="#5e4636" text-anchor="middle" letter-spacing="2">Bazara</text>
  <!-- خط ذهبي -->
  <rect x="500" y="430" width="200" height="3" rx="1.5" fill="#c79a3a"/>
  <!-- وصف -->
  <text x="600" y="492" font-family="Georgia, 'Times New Roman', serif" font-size="34" fill="#6e5340" text-anchor="middle" letter-spacing="6">LUXURY FASHION</text>
  <text x="600" y="540" font-family="Arial, sans-serif" font-size="26" fill="#8a6a4f" text-anchor="middle">bazarastore.site</text>
</svg>`;

const out = 'public/og-cover.png';
const buf = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(out, buf);
console.log('og-cover.png generated:', buf.length, 'bytes');

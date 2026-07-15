// يولّد صور مصدر تطبيق الجوال (أيقونة + سبلاش) من icon-master.svg بالتصميم الجديد،
// ثم يستعملها @capacitor/assets لتوليد كل أحجام أندرويد. يُشغَّل من مجلد client.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const master = readFileSync(new URL('./icon-master.svg', import.meta.url), 'utf8');
const WINE = '#5C1A2E'; // خلفية الأيقونة التكيّفية (خمري الهوية)
const CREAM = '#F4EDE2'; // خلفية السبلاش الكريمية مثل شاشة بازارا
const p = (n) => fileURLToPath(new URL('../assets/' + n, import.meta.url));

// أيقونة مربّعة كاملة (بلا زوايا دائرية — النظام يدوّرها)
const square = master.replace(/rx="20"/g, 'rx="0"');
// الشعار فقط بلا خلفية (للأيقونة التكيّفية والسبلاش) — نزيل مستطيل الخلفية الخمرية
const logoOnly = master.replace(/<rect[^>]*fill="url\(#bazaraWine\)"[^>]*\/>/, '');

const run = async () => {
  await sharp(Buffer.from(square)).resize(1024, 1024).png().toFile(p('icon.png'));

  const fg = await sharp(Buffer.from(logoOnly)).resize(640, 640).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fg, gravity: 'center' }]).png().toFile(p('icon-foreground.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: WINE } }).png().toFile(p('icon-background.png'));

  // السبلاش الأصلي كريمي صافٍ بلا شعار، كي يندمج مع شاشة Bazara الويب (شاشة واحدة)
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: CREAM } }).png().toFile(p('splash.png'));
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: CREAM } }).png().toFile(p('splash-dark.png'));

  console.log('OK gen-app-assets');
};
run().catch((e) => { console.error(e); process.exit(1); });

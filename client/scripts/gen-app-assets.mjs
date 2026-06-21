// يولّد صور مصدر تطبيق الجوال (أيقونة + سبلاش) من icon-master.svg بالتصميم الجديد،
// ثم يستعملها @capacitor/assets لتوليد كل أحجام أندرويد. يُشغَّل من مجلد client.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const master = readFileSync(new URL('./icon-master.svg', import.meta.url), 'utf8');
const BROWN = '#5e4636';
const BROWN_DARK = '#2b211a';
const p = (n) => fileURLToPath(new URL('../assets/' + n, import.meta.url));

// أيقونة مربّعة كاملة (بلا زوايا دائرية — النظام يدوّرها)
const square = master.replace('rx="20"', 'rx="0"');
// الشعار فقط بلا خلفية (للأيقونة التكيّفية والسبلاش)
const logoOnly = master.replace(/<rect[^>]*fill="#5e4636"[^>]*\/>/, '');

const run = async () => {
  await sharp(Buffer.from(square)).resize(1024, 1024).png().toFile(p('icon.png'));

  const fg = await sharp(Buffer.from(logoOnly)).resize(640, 640).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fg, gravity: 'center' }]).png().toFile(p('icon-foreground.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BROWN } }).png().toFile(p('icon-background.png'));

  const logoBig = await sharp(Buffer.from(logoOnly)).resize(820, 820).png().toBuffer();
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BROWN } })
    .composite([{ input: logoBig, gravity: 'center' }]).png().toFile(p('splash.png'));
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BROWN_DARK } })
    .composite([{ input: logoBig, gravity: 'center' }]).png().toFile(p('splash-dark.png'));

  console.log('OK gen-app-assets');
};
run().catch((e) => { console.error(e); process.exit(1); });

// لقطةُ المتجر التي تظهر بقسم «هذا ما تحصلين عليه» بصفحة الواجهة.
//
// لماذا سكربتٌ يُشغَّل يدوياً لا خطوةُ بناء: التوليد وقت النشر يحتاج كروم
// وخادماً يعمل على منصّة النشر — فتصير كلّ نشرةٍ رهينةَ متصفّحٍ بلا واجهة،
// وتفشل النشرةُ كلُّها إن تعثّر. واللقطة لا تتغيّر إلا حين يتغيّر تصميمُ
// صفحة المتجر: مرّاتٌ معدودة بالسنة. فأمرٌ واحد حين يلزم أرخصُ وأأمن.
//
//   npm run preview:shot                 (يلتقط من http://localhost:4173)
//   npm run preview:shot -- --url=…      (أو من أيّ عنوان: نسخةٌ منشورة مثلاً)
//   npm run preview:shot -- --store=slug (متجرٌ آخر)
//
// يلزم قبله خادمٌ يعمل: npm run build && npm run preview

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const BASE = arg('url', 'http://localhost:4173');
const STORE = arg('store', 'habooshstyle');
const OUT = path.resolve('public/store-preview.webp');

// كروم على ويندوز له حدٌّ أدنى لعرض النافذة (نحو 500px). ما دونه يُرسم أوسعَ
// ثمّ تُقصّ اللقطة — وبالعربية يبدأ القصُّ من الحافّة الخطأ، فيختفي اسمُ
// المتجر وحقلُ البحث. 520 فوق الحدّ، وبنسبة هاتفٍ معقولة.
const W = 520;
const H = 1126;
const SCALE = 2;
const QUALITY = 0.82;

function findChrome() {
  const candidates = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }[process.platform] || [];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) {
    console.error('لم أجد كروم. مرّر مساره: CHROME=/path/to/chrome npm run preview:shot');
    process.exit(1);
  }
  return process.env.CHROME || hit;
}

function run(chrome, args) {
  return execFileSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', ...args], {
    stdio: 'pipe',
    maxBuffer: 512 * 1024 * 1024,
  });
}

const chrome = findChrome();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bz-shot-'));
const rawPng = path.join(tmp, 'raw.png');
const url = `${BASE.replace(/\/$/, '')}/store/${STORE}`;

// ── حارسٌ قبل اللقطة ──
// كروم يلتقط ما يجده أياً كان: صفحةَ «تعذّر الوصول» إن كان الخادمُ متوقّفاً،
// وبطاقةَ «المتجر غير موجود» إن أخطأتَ الاسم — ثمّ يكتبها فوق اللقطة الجيّدة
// بلا شكوى. جرّبتُ الحالتين قبل هذا الحارس فدهس الملفَّ الصحيحَ مرّتين.
// فنقرأ DOM أوّلاً: يلزم أن يحمل اسمَ المتجر (bz-sh-name)، وألّا يحمل بطاقةَ
// حالةٍ (bz-state) وهي ما تُرسم عند الخطأ.
console.log(`أفحص: ${url}`);
let dom = '';
try {
  dom = run(chrome, ['--virtual-time-budget=12000', '--dump-dom', url]).toString();
} catch {
  console.error(`تعذّر فتح ${url} — هل الخادم يعمل؟  (npm run build && npm run preview)`);
  process.exit(1);
}
if (!dom.includes('bz-sh-name')) {
  console.error(
    `الصفحة ليست صفحةَ متجر — لم أجد اسمَ المتجر بها.\n` +
    `  • الخادم يعمل على ${BASE}؟   (npm run build && npm run preview)\n` +
    `  • المتجر «${STORE}» موجودٌ ومنشور؟\n` +
    `لم أمسّ اللقطة الحالية.`,
  );
  process.exit(1);
}
if (dom.includes('bz-state')) {
  console.error(`الصفحة تعرض حالةَ خطأ (متجرٌ موقوف أو بلا منتجات). لم أمسّ اللقطة الحالية.`);
  process.exit(1);
}

console.log(`ألتقط: ${url}`);
try {
  run(chrome, [
    `--screenshot=${rawPng}`,
    `--window-size=${W},${H}`,
    `--force-device-scale-factor=${SCALE}`,
    '--virtual-time-budget=12000',
    url,
  ]);
} catch {
  console.error(`تعذّرت اللقطة. لم أمسّ اللقطة الحالية.`);
  process.exit(1);
}

if (!fs.existsSync(rawPng)) {
  console.error('لم تُنتَج لقطة. لم أمسّ اللقطة الحالية.');
  process.exit(1);
}

// PNG لقطةِ صفحةٍ كاملة يقارب سبعمئة كيلو — أثقلُ من الصفحة التي يظهر فيها.
// نحوّله WebP بكروم نفسه (لا مكتبةَ صور بالمشروع): نحو ٩٠٪ أقلّ بلا فرقٍ يُرى.
const b64 = fs.readFileSync(rawPng).toString('base64');
const htmlPath = path.join(tmp, 'conv.html');
fs.writeFileSync(
  htmlPath,
  `<!doctype html><meta charset="utf-8"><body style="margin:0"><script>
(async () => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej;
    img.src = 'data:image/png;base64,${b64}'; });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  const el = document.createElement('pre');
  el.id = 'out'; el.textContent = c.toDataURL('image/webp', ${QUALITY});
  document.body.appendChild(el);
})();
</script></body>`,
);

const convDom = run(chrome, [
  '--virtual-time-budget=20000',
  '--dump-dom',
  'file:///' + htmlPath.split(path.sep).join('/'),
]).toString();

const m = convDom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m) {
  console.error('فشل تحويل WebP.');
  process.exit(1);
}

const webp = Buffer.from(m[1].split(',')[1], 'base64');
const pngSize = fs.statSync(rawPng).size;
fs.writeFileSync(OUT, webp);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(
  `${(pngSize / 1024).toFixed(0)} KB → ${(webp.length / 1024).toFixed(0)} KB` +
  `  (${Math.round(100 - (webp.length / pngSize) * 100)}٪ أقلّ)`,
);
console.log(`حُفظت: ${path.relative(process.cwd(), OUT)}  —  راجعها بعينك قبل الرفع.`);

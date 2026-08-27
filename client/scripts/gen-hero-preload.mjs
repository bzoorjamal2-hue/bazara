// يحقن <link rel="preload"> لصورة الهيرو داخل index.html وقت البناء.
//
// المشكلة: رابطُ الصورة يأتي من /public/site-info، أي بعد تحميل الحزمة
// وتنفيذِها ونداءِ الشبكة — أربعُ جولاتٍ متسلسلة قبل أن يبدأ التنزيل. حللتُها
// للزائر العائد بحفظ الرابط بـlocalStorage وحقنِ preload منه قبل React. لكنّ
// أوّلَ زيارةٍ لا رابطَ محفوظاً فيها — وهي زيارةُ القادم من جوجل، أي أهمُّ
// زائرٍ وأقلُّهم صبراً. قِستُ الفرق على الإنتاج: ٧٩ms للعائد، ٢٢٤٠ للقادم أوّل
// مرّة.
//
// الحلّ: الرابط لا يتغيّر إلا حين يبدّله المدير — أي مرّاتٍ معدودة، وكلُّ
// تبديلٍ يتبعه نشر. فنقرؤه وقت البناء ونكتبه بالـHTML: يراه ماسحُ التحميل
// المسبق قبل أن يبدأ تنزيلُ الحزمة أصلاً.
//
// وإن تعذّر الجلب لا نُفشل البناء: الصفحة تعمل كما كانت، والزائر العائد يبقى
// مخدوماً بنسخة localStorage.

import { readFileSync, writeFileSync } from 'node:fs';

const HTML = 'index.html';
const API = 'https://bazara-hwux.onrender.com/api/public/site-info';
const MARK_OPEN = '<!-- hero-preload:start -->';
const MARK_CLOSE = '<!-- hero-preload:end -->';
const WIDTHS = [640, 828, 1080, 1440, 1920];

// نفس منطق utils/heroImage.js — مضاعفٌ عمداً: هذا يعمل بـnode وقت البناء،
// وذاك بالمتصفّح. وإبقاؤهما متطابقين شرطٌ ليختار المتصفّحُ نسخةً واحدة.
const at = (url, w) => {
  if (url.includes('/upload/') && url.includes('cloudinary')) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${w},c_limit/`);
  }
  try {
    const u = new URL(url);
    if (!/(^|\.)images\.unsplash\.com$/.test(u.hostname)) return null;
    u.searchParams.set('w', String(w));
    if (!u.searchParams.has('auto')) u.searchParams.set('auto', 'format');
    if (!u.searchParams.has('q')) u.searchParams.set('q', '80');
    return u.toString();
  } catch { return null; }
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function strip(html) {
  const a = html.indexOf(MARK_OPEN);
  const b = html.indexOf(MARK_CLOSE);
  if (a === -1 || b === -1) return html;
  return html.slice(0, a) + html.slice(b + MARK_CLOSE.length);
}

async function run() {
  let html = readFileSync(HTML, 'utf8');

  // نُزيل أيَّ حقنٍ سابق أوّلاً: البناءُ يعيد الكرّة، ولا نريد روابطَ متراكمة
  const clean = strip(html);

  if (typeof fetch === 'undefined') {
    if (clean !== html) writeFileSync(HTML, clean);
    console.log('hero-preload: لا fetch — تُرك بلا حقن');
    return;
  }

  let image = '';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(API, { signal: ctrl.signal });
    clearTimeout(timer);
    const json = await res.json();
    image = json?.landing?.hero?.image || '';
  } catch {
    if (clean !== html) writeFileSync(HTML, clean);
    console.log('hero-preload: تعذّر جلب الإعدادات — تُرك بلا حقن (الصفحة تعمل)');
    return;
  }

  if (!/^https?:\/\//.test(image)) {
    if (clean !== html) writeFileSync(HTML, clean);
    console.log('hero-preload: لا صورةَ هيرو — تُرك بلا حقن');
    return;
  }

  const srcset = WIDTHS.map((w) => [at(image, w), w]).filter(([u]) => u);
  const src = at(image, 1440) || image;

  const tag =
    `${MARK_OPEN}\n    <link rel="preload" as="image" fetchpriority="high" href="${esc(src)}"` +
    (srcset.length
      ? `\n      imagesrcset="${esc(srcset.map(([u, w]) => `${u} ${w}w`).join(', '))}"\n      imagesizes="100vw"`
      : '') +
    ` />\n    ${MARK_CLOSE}`;

  // نضعه قبل </head> مباشرةً — بعد الخطوط وقبل أيّ سكربت
  const out = clean.replace('</head>', `  ${tag}\n  </head>`);
  writeFileSync(HTML, out);
  console.log(`hero-preload: حُقن (${srcset.length || 1} مقاس) — ${src.slice(0, 60)}…`);
}

run().catch((e) => {
  console.log('hero-preload: تخطّي — ' + e.message);
});

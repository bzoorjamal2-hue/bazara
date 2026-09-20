// رسمُ صورةِ الإعلانِ داخلَ متصفّحِ التاجرة.
//
// لماذا هنا لا على الخادم: كلُّ وسائطِ المنصّةِ على حسابٍ مجّانيٍّ محدودِ الرصيد،
// وتجاوزُه يُخفي صورَ الموقعِ كلَّها. فلو رُسِمت كلُّ محاولةِ إعلانٍ على الخادمِ
// ورُفِعت، لدفعنا رصيدَ الصورِ ثمناً لمسوّداتٍ لا تُنشَر. هنا: كلُّ محاولةٍ مجّانيّةٌ
// تماماً، ولا يُحفَظُ إلّا **وصفُ** الصورة (قالبٌ ومقاسٌ ونصّ) فتُرسَمُ من جديدٍ
// متى شاءت التاجرةُ بنفسِ الشكل.

import { heroCrop } from './cloudinary.js';

export const AD_SIZES = {
  square: { w: 1080, h: 1080, ar: '1:1' },     // منشور فيسبوك/إنستغرام
  story: { w: 1080, h: 1920, ar: '9:16' },     // ستوري وريلز
  wide: { w: 1200, h: 628, ar: '1.91' },     // إعلان فيسبوك عريض
};

export const AD_TEMPLATES = ['bold', 'soft', 'split'];

const FONT = '"Cairo", "Tajawal", system-ui, sans-serif';

// ─────────── أدوات ───────────

// الخطُّ الويبيُّ لا يُرسَمُ على اللوحةِ قبلَ أن يُحمَّلَ فعلاً: بلا الانتظارِ
// تُرسَمُ أوّلُ صورةٍ بخطِّ النظامِ الاحتياطيّ، وتختلفُ عمّا تراه التاجرةُ بالشاشة.
async function ensureFont() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`900 80px ${FONT}`),
      document.fonts.load(`700 44px ${FONT}`),
      document.fonts.load(`400 34px ${FONT}`),
    ]);
    await document.fonts.ready;
  } catch { /* الخطُّ الاحتياطيُّ يكفي */ }
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    // بلا crossOrigin تصيرُ اللوحةُ «ملوَّثةً» فيرفضُ المتصفّحُ تصديرَها،
    // وتفشلُ كلُّ محاولةِ تنزيلٍ بلا سببٍ ظاهرٍ للتاجرة.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    return undefined;
  });
}

// الصورةُ تُقصُّ بنسبةِ الصندوقِ عندَ كلاوديناري لا بالمتصفّح: بكسلاتٌ أقلُّ تُنقَل،
// والقصُّ الذكيُّ يُبقي القطعةَ بالإطار.
function sourceFor(url, size, ratio) {
  const cropped = heroCrop(url, size.w, ratio || size.ar);
  return cropped || url;
}

function cover(ctx, img, x, y, w, h) {
  if (!img) return;
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// لفُّ النصِّ العربيِّ: القياسُ بالكلمةِ لا بالحرف. (اللوحةُ تُشكّلُ الحروفَ
// وتوصلُها بنفسِها ما دام الاتجاهُ rtl، فلا حاجةَ لمعالجةِ تشكيلٍ يدويّة.)
function wrap(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.length) {
    // ما فاضَ عن الأسطرِ المسموحةِ يُقصُّ بثلاثِ نقاطٍ بدل أن يُرسَمَ فوقَ ما تحته
    const drawn = lines.join(' ').split(/\s+/).length;
    if (drawn < words.length) lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }
  return lines;
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

// شارةٌ مستديرةٌ (خصم / جديد): تُرسَمُ من اليمينِ لأنّ الواجهةَ عربيّة
function pill(ctx, text, xRight, y, { bg, fg, size = 38, padX = 28, padY = 16 }) {
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + padX * 2;
  const h = size + padY * 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(xRight - w, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, xRight - padX, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic';
  return h;
}

// ─────────── الرسمُ ───────────

/**
 * يرسمُ الإعلانَ على canvas معطاة.
 * recipe: { image, logo, template, size, headline, sub, price, oldPrice, badge,
 *           storeName, url, accent, showPrice }
 */
export async function drawAd(canvas, recipe) {
  const size = AD_SIZES[recipe.size] || AD_SIZES.square;
  const tpl = AD_TEMPLATES.includes(recipe.template) ? recipe.template : 'bold';
  const accent = recipe.accent || '#1F1E1D';
  const cream = '#F9F9F8';

  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';

  await ensureFont();

  const pad = Math.round(size.w * 0.06);
  const priceText = recipe.showPrice === false ? '' : `${recipe.price}₪`;

  // شريطٌ محجوزٌ أسفلَ الإعلانِ لاسمِ المتجرِ ورابطِه، وما فوقَه وحدَه للنصّ.
  // بلا هذا الحجزِ كان السعرُ يقعُ فوقَ اسمِ المتجرِ حرفاً على حرف: عطبٌ لا يظهرُ
  // إلّا بالعين، ويخرجُ به الإعلانُ إلى الناسِ مشوّهاً. والعلاجُ أن تُكدَّسَ
  // الأسطرُ من الأسفلِ إلى الأعلى لا أن تُحسَبَ من الأعلى إلى الأسفل.
  const fs = Math.round(size.w * 0.032);
  const footerH = Math.round(fs * 2.6);
  const bottom = size.h - pad - footerH;

  // صندوقُ الوسيطةِ بكلِّ قالب — منه تُحسَبُ نسبةُ القصّ، فتصلُ البكسلاتُ حيث تُرى.
  //
  // ولوحُ القالبِ الهادئِ يُقاسُ بما سيحملُه لا برقمٍ ثابت: على المقاسِ العريضِ
  // (١٢٠٠×٦٢٨) كان ٥٨٪ منه صورةً فيبقى للنصِّ شريطٌ لا يتّسعُ لعنوانِه، فيرتفعُ
  // العنوانُ فوقَ حافّةِ الصورةِ ويُقرأُ على القماشِ لا على اللوح.
  const geo = (() => {
    if (tpl === 'split') {
      const imgW = Math.round(size.w * 0.52);
      return { w: imgW, h: size.h, imgW };
    }
    if (tpl === 'soft') {
      const hSize = Math.round(size.w * 0.065);
      const lh = hSize * 1.25;
      ctx.font = `900 ${hSize}px ${FONT}`;
      const headLines = wrap(ctx, recipe.headline, size.w - pad * 2, 2);
      const textH = headLines.length * lh
        + (recipe.sub ? hSize * 0.72 : 0)
        + (priceText ? hSize * 1.05 : 0);
      const panelH = Math.round(textH + footerH + pad * 1.2);
      const imgH = Math.max(Math.round(size.h * 0.3), size.h - panelH);
      return { w: size.w, h: imgH, imgH, headLines, hSize, lh };
    }
    return { w: size.w, h: size.h };
  })();

  const [img, logo] = await Promise.all([
    loadImage(sourceFor(recipe.image, { w: geo.w }, `${geo.w}:${geo.h}`)),
    loadImage(recipe.logo ? sourceFor(recipe.logo, { w: 200 }, '1:1') : ''),
  ]);

  ctx.fillStyle = cream;
  ctx.fillRect(0, 0, size.w, size.h);

  // سطرُ السعر (ومعَه القديمُ مشطوباً) على خطِّ أساسٍ معلوم
  const drawPrice = (baseY, strong, softColor, hSize) => {
    if (!priceText) return;
    ctx.font = `900 ${Math.round(hSize * 0.8)}px ${FONT}`;
    ctx.fillStyle = strong;
    ctx.fillText(priceText, size.w - pad, baseY);
    if (!recipe.oldPrice) return;
    const pw = ctx.measureText(priceText).width;
    ctx.font = `600 ${Math.round(hSize * 0.5)}px ${FONT}`;
    ctx.fillStyle = softColor;
    const ox = size.w - pad - pw - 24;
    const oldText = `${recipe.oldPrice}₪`;
    ctx.fillText(oldText, ox, baseY);
    const ow = ctx.measureText(oldText).width;
    ctx.strokeStyle = softColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ox, baseY - hSize * 0.16);
    ctx.lineTo(ox - ow, baseY - hSize * 0.16);
    ctx.stroke();
  };

  if (tpl === 'bold') {
    // صورةٌ ملءَ الإطارِ وتدرّجٌ داكنٌ من الأسفلِ يحملُ النصَّ — أوضحُ ما يُقرأُ
    // وسطَ خلاصةِ إنستغرام، ولا يُغطّي القطعةَ نفسَها.
    cover(ctx, img, 0, 0, size.w, size.h);
    if (!img) { ctx.fillStyle = accent; ctx.fillRect(0, 0, size.w, size.h); }
    const g = ctx.createLinearGradient(0, size.h * 0.35, 0, size.h);
    g.addColorStop(0, 'rgba(15,15,14,0)');
    g.addColorStop(0.55, 'rgba(15,15,14,0.62)');
    g.addColorStop(1, 'rgba(15,15,14,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, size.h * 0.35, size.w, size.h * 0.65);

    if (recipe.badge) pill(ctx, recipe.badge, size.w - pad, pad, { bg: '#DDDDDC', fg: '#1F1E1D' });

    const hSize = Math.round(size.w * (size.h > size.w ? 0.085 : 0.075));
    const lh = hSize * 1.28;
    ctx.font = `900 ${hSize}px ${FONT}`;
    const headLines = wrap(ctx, recipe.headline, size.w - pad * 2, 3);

    let b = bottom;
    drawPrice(b, cream, 'rgba(249,249,248,0.7)', hSize);
    if (priceText) b -= hSize * 1.05;
    if (recipe.sub) {
      ctx.font = `600 ${Math.round(hSize * 0.5)}px ${FONT}`;
      ctx.fillStyle = 'rgba(249,249,248,0.85)';
      ctx.fillText(wrap(ctx, recipe.sub, size.w - pad * 2, 1)[0] || '', size.w - pad, b);
      b -= hSize * 0.72;
    }
    ctx.font = `900 ${hSize}px ${FONT}`;
    ctx.fillStyle = cream;
    drawLines(ctx, headLines, size.w - pad, b - (headLines.length - 1) * lh, lh);

    footer(ctx, size, pad, recipe, logo, cream, 'rgba(249,249,248,0.75)');
  }

  if (tpl === 'soft') {
    // صورةٌ فوقَ لوحٍ عاجيٍّ تحتَها: يليقُ بالقطعِ الراقيةِ وتُقرأُ حروفُه براحة
    const imgH = geo.imgH;
    cover(ctx, img, 0, 0, size.w, imgH);
    if (!img) { ctx.fillStyle = accent; ctx.fillRect(0, 0, size.w, imgH); }
    ctx.fillStyle = cream;
    ctx.fillRect(0, imgH, size.w, size.h - imgH);

    if (recipe.badge) pill(ctx, recipe.badge, size.w - pad, pad, { bg: '#1F1E1D', fg: cream });

    const { hSize, lh, headLines } = geo;

    let b = bottom;
    drawPrice(b, '#1F1E1D', 'rgba(31,30,29,0.5)', hSize);
    if (priceText) b -= hSize * 1.05;
    if (recipe.sub) {
      ctx.font = `500 ${Math.round(hSize * 0.5)}px ${FONT}`;
      ctx.fillStyle = 'rgba(31,30,29,0.65)';
      ctx.fillText(wrap(ctx, recipe.sub, size.w - pad * 2, 1)[0] || '', size.w - pad, b);
      b -= hSize * 0.72;
    }
    ctx.font = `900 ${hSize}px ${FONT}`;
    ctx.fillStyle = '#1F1E1D';
    drawLines(ctx, headLines, size.w - pad, b - (headLines.length - 1) * lh, lh);

    footer(ctx, size, pad, recipe, logo, '#1F1E1D', 'rgba(31,30,29,0.6)');
  }

  if (tpl === 'split') {
    // نصفانِ: القطعةُ يميناً والكلامُ يساراً على لونٍ صريح — يصلحُ للعروضِ
    // التي بطلُها الرقمُ لا الصورة.
    const imgW = geo.imgW;
    cover(ctx, img, size.w - imgW, 0, imgW, size.h);
    if (!img) { ctx.fillStyle = '#31312F'; ctx.fillRect(size.w - imgW, 0, imgW, size.h); }
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, size.w - imgW, size.h);

    const boxW = size.w - imgW;
    const inner = Math.round(boxW * 0.11);
    const hSize = Math.round(boxW * 0.13);
    const footFs = Math.round(hSize * 0.34);
    const bottomS = size.h - inner - Math.round(footFs * 2.6);
    const lh = hSize * 1.22;

    ctx.textAlign = 'right';
    if (recipe.badge) {
      pill(ctx, recipe.badge, boxW - inner, Math.round(size.h * 0.12), {
        bg: cream, fg: accent, size: Math.round(hSize * 0.42), padX: 20, padY: 12,
      });
    }

    ctx.font = `900 ${hSize}px ${FONT}`;
    const headLines = wrap(ctx, recipe.headline, boxW - inner * 2, 4);

    let b = bottomS;
    if (priceText) {
      ctx.font = `900 ${Math.round(hSize * 0.85)}px ${FONT}`;
      ctx.fillStyle = cream;
      ctx.fillText(priceText, boxW - inner, b);
      b -= hSize * 1.05;
    }
    if (recipe.sub) {
      ctx.font = `500 ${Math.round(hSize * 0.44)}px ${FONT}`;
      ctx.fillStyle = 'rgba(249,249,248,0.82)';
      const subLines = wrap(ctx, recipe.sub, boxW - inner * 2, 2);
      drawLines(ctx, subLines, boxW - inner, b - (subLines.length - 1) * hSize * 0.6, hSize * 0.6);
      b -= (subLines.length - 1) * hSize * 0.6 + hSize * 0.72;
    }
    ctx.font = `900 ${hSize}px ${FONT}`;
    ctx.fillStyle = cream;
    drawLines(ctx, headLines, boxW - inner, b - (headLines.length - 1) * lh, lh);

    // التذييلُ داخلَ اللوحِ الملوّنِ لا عرضَ الصورة
    ctx.font = `700 ${footFs}px ${FONT}`;
    ctx.fillStyle = 'rgba(249,249,248,0.78)';
    ctx.fillText(recipe.storeName || '', boxW - inner, size.h - inner - footFs * 0.9);
    if (recipe.url) {
      ctx.font = `500 ${Math.round(footFs * 0.82)}px ${FONT}`;
      ctx.fillText(recipe.url, boxW - inner, size.h - inner + footFs * 0.1);
    }
  }


  return canvas;
}

// اسمُ المتجرِ ورابطُه أسفلَ الإعلان: بلاهما إعلانٌ جميلٌ لا يعرفُ من رآه أين
// يشتري — وهو أكثرُ ما يُنسى بإعلاناتِ المتاجرِ الصغيرة.
function footer(ctx, size, pad, recipe, logo, strong, soft) {
  const fs = Math.round(size.w * 0.032);
  let x = size.w - pad;
  ctx.textAlign = 'right';
  if (logo) {
    const s = fs * 1.9;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad + s / 2, size.h - pad - s / 2, s / 2, 0, Math.PI * 2);
    ctx.clip();
    cover(ctx, logo, pad, size.h - pad - s, s, s);
    ctx.restore();
  }
  ctx.font = `800 ${fs}px ${FONT}`;
  ctx.fillStyle = strong;
  ctx.fillText(recipe.storeName || '', x, size.h - pad - fs * 0.9);
  if (recipe.url) {
    ctx.font = `500 ${Math.round(fs * 0.82)}px ${FONT}`;
    ctx.fillStyle = soft;
    ctx.fillText(recipe.url, x, size.h - pad + fs * 0.1);
  }
}

// تنزيلُ اللوحةِ صورةً. يفشلُ إن كانت اللوحةُ ملوّثةً (صورةٌ من مضيفٍ لا يسمحُ
// بالقراءةِ عبرَ النطاقات) — فنقولُها صراحةً بدل زرٍّ لا يفعلُ شيئاً.
export async function downloadCanvas(canvas, filename) {
  const blob = await new Promise((resolve, reject) => {
    try { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.92); }
    catch (e) { reject(e); }
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// مشاركةُ قطعةٍ **بوسائطِها** لا برابطِها وحدَه.
//
// الرابطُ وحدَه لا يفتحُ لإنستغرامَ باباً بورقةِ المشاركة: الستوري والريلز والمنشورُ
// كلُّها تحتاجُ صورةً أو فيديو. فحين يدعمُ الجهازُ مشاركةَ الملفّات نبعثُ ملفّاً:
//   • للقطعةِ فيديو؟ نبعثُ الفيديو نفسَه (MP4) — فيعرضُ إنستغرامُ ريلز وستوري؛
//   • وإلّا صورةَ ستوري (١٠٨٠×١٩٢٠) ترسمُها اللوحةُ من صورتِها وسعرِها واسمِ متجرِها
//     ورابطِه — نفسُ رسّامِ مصنعِ الإعلانات.
// ثمّ يختارُ صاحبُ الجهازِ التطبيقَ، والتطبيقُ نفسُه يسألُه: منشور؟ ستوري؟ ريلز؟ رسالة؟
//
// **الملفُّ يُجهَّزُ قبلَ الضغطة لا بعدَها.** المتصفّحُ لا يفتحُ ورقةَ المشاركةِ إلّا
// بأثرِ ضغطةٍ قريبة، وسفاري يعدُّها بثانيةٍ تقريباً — وتنزيلُ فيديو أو رسمُ صورةٍ قد
// يتجاوزُها. فالصفحةُ تُجهّزُ الصورةَ مسبقاً، وإن لم يجهزِ الملفُّ وضاعت الضغطةُ بقيَ
// محفوظاً فتنجحُ الضغطةُ الثانيةُ فوراً.

import { drawAd } from './adCanvas.js';
import { cldVideoMp4, cldVideoPoster } from './cloudinary.js';
import { productUrl, storeUrl, shareLink } from './links.js';

// فيديو أكبرُ من هذا لا يُنزَّلُ على بيانات الجوّال لأجل مشاركة — نبعثُ الصورةَ بدلَه
const MAX_VIDEO = 60 * 1024 * 1024;

// هل يقبلُ الجهازُ ملفّاتٍ بورقةِ المشاركة؟ (الجوّالاتُ الحديثةُ نعم، أغلبُ الحواسيبِ لا)
export function canShareFiles() {
  try {
    if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
    const probe = new File([new Uint8Array(1)], 'x.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

const fileName = (p, ext) => `${String(p.name || 'bazara').trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'bazara'}.${ext}`;

async function videoFile(p) {
  const src = cldVideoMp4(p.videoUrl, 720);
  if (!/\.mp4(\?|$)/i.test(src)) return null; // صيغةٌ لا تقبلُها التطبيقاتُ كلُّها
  const res = await fetch(src, { mode: 'cors' });
  if (!res.ok) return null;
  if (Number(res.headers.get('content-length') || 0) > MAX_VIDEO) return null;
  const blob = await res.blob();
  if (!blob.size || blob.size > MAX_VIDEO) return null;
  const file = new File([blob], fileName(p, 'mp4'), { type: 'video/mp4' });
  return navigator.canShare({ files: [file] }) ? file : null;
}

async function imageFile(p, store) {
  const image = p.imageUrl || p.images?.[0] || (p.videoUrl && cldVideoPoster(p.videoUrl, 1080)) || '';
  const price = Number(p.price) || 0;
  const old = Number(p.oldPrice) || 0;
  const pct = old > price && price > 0 ? Math.round((1 - price / old) * 100) : 0;
  const slug = p.storeSlug || store?.slug || '';
  const canvas = document.createElement('canvas');
  await drawAd(canvas, {
    image,
    logo: store?.logo || p.storeLogo || '',
    template: 'bold',
    size: 'story',
    headline: p.name || '',
    sub: '',
    price,
    oldPrice: pct ? old : null,
    badge: pct ? `خصم ${pct}%` : '',
    showPrice: price > 0,
    storeName: store?.name || p.storeName || '',
    url: (slug ? storeUrl(slug) : productUrl(p)).replace(/^https?:\/\//, ''),
    accent: '#1F1E1D',
  });
  // لوحةٌ ملوّثةٌ (صورةٌ من مضيفٍ لا يسمحُ بالقراءة) ترمي هنا — فنرجعُ للرابط
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.9);
  });
  const file = new File([blob], fileName(p, 'jpg'), { type: 'image/jpeg' });
  return navigator.canShare({ files: [file] }) ? file : null;
}

const images = new Map(); // معرّفُ القطعة → Promise<File|null>
const videos = new Map();

function once(map, key, make) {
  if (!map.has(key)) map.set(key, make().catch(() => null));
  return map.get(key);
}

// يجهّزُ صورةَ الستوري بالخلفيّة (مرّةً لكلِّ قطعة) — رسمٌ محلّيٌّ رخيص. أمّا الفيديو
// فلا يُنزَّلُ إلّا عند الضغط: تنزيلُ عشراتِ الميغا لكلِّ زائرٍ يفتحُ صفحةَ قطعةٍ
// ثمنٌ يدفعُه من باقتِه لأجل زرٍّ قد لا يلمسُه.
export function prepareProductShare(p, store) {
  if (!p?.id || !canShareFiles()) return Promise.resolve(null);
  return once(images, p.id, () => imageFile(p, store));
}

async function fileFor(p, store) {
  if (!p?.id || !canShareFiles()) return null;
  if (p.videoUrl) {
    const v = await once(videos, p.id, () => videoFile(p));
    if (v) return v; // الفيديو تعذّر أو كبير — الصورةُ بديلٌ أمين
  }
  return prepareProductShare(p, store);
}

/**
 * يشاركُ القطعةَ بملفِّها إن أمكن، وإلّا برابطِها كما كان.
 * تُعيد: 'shared' | 'copied' | 'failed' | 'retry'
 *   'retry' = الملفُّ صار جاهزاً لكنّ الضغطةَ انتهت صلاحيّتُها؛ ضغطةٌ ثانيةٌ تفتحُ الورقة.
 */
export async function shareProduct(p, store) {
  const url = productUrl({ ...p, storeSlug: p.storeSlug || store?.slug });
  const title = p.name || '';
  const file = await fileFor(p, store);
  if (!file) return shareLink({ title, url });
  try {
    // النصُّ يرافقُ الملفّ: واتساب يجعلُه تعليقاً تحتَ الصورةِ أو الفيديو فيصلُ الرابط،
    // وإنستغرامُ يتجاهلُه — والرابطُ مكتوبٌ على صورةِ الستوري نفسِها.
    await navigator.share({ files: [file], title, text: `${title}\n${url}` });
    return 'shared';
  } catch (err) {
    if (err?.name === 'AbortError') return 'shared';
    if (err?.name === 'NotAllowedError') return 'retry';
    return shareLink({ title, url });
  }
}

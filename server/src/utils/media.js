// لقطةُ الغلافِ من فيديو كلاوديناري — تُبنى من القاعدةِ النظيفةِ لا بحشوِ so_0 فوق
// تحويلاتِ الفيديو القديمة. كانت تُبنى بالاستبدالِ المباشر فيخرجُ رابطٌ مثل
// .../video/upload/so_0/f_mp4,vc_h264,q_auto,w_720,c_limit/v.../x.jpg — يردُّه
// كلاوديناري فيديو mp4 بحجمِ ١٫٦ ميغا لا صورة، فترفضُه واتساب وفيسبوك ولا تظهرُ
// صورةٌ بأيِّ رابطِ منتجٍ يُشارَك (وكلُّ منتجاتِ المنصّةِ فيديو). النسخةُ النظيفةُ
// تُعيد JPEG بـ١١٢ كيلوبايت. (نفسُ منطقِ cldVideoPoster بالواجهة.)
export function videoPoster(url, width = 1200) {
  const m = String(url || '').match(/^(https?:\/\/[^/]+\/[^/]+\/video\/upload\/)(.+)$/);
  if (!m) return '';
  const segs = m[2].split('/');
  let vi = segs.findIndex((s) => /^v\d+$/.test(s)); // جزءُ الإصدار — ما قبله تحويلاتٌ نتجاهلها
  if (vi === -1) vi = segs.length - 1;
  const rest = segs.slice(vi).join('/').replace(/\.[a-z0-9]+(\?.*)?$/i, '');
  return `${m[1]}so_0,f_jpg,q_auto,w_${width},c_limit/${rest}.jpg`;
}

// مسارُ المنتجِ العامّ — يحملُ اسمَ متجرِه دائماً (بازارا/store/<المتجر>/product/<المعرّف>)
export function productPath(slug, id) {
  return slug ? `/store/${slug}/product/${id}` : `/product/${id}`;
}

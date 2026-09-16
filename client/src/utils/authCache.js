// الجلسةُ بكوكي: لا يعرفُ المتصفّحُ صاحبَها حتى يردَّ ‎/auth/me. فكانت كلُّ
// فتحةِ صفحةٍ شاشتَين: حارسُ الصفحاتِ المحميّةِ يرسمُ دوّارةً ثمّ الصفحة،
// وشاشةُ الإقلاعِ بالتطبيقِ المثبّتِ تظهرُ ثمّ تزول، والشريطُ السفليُّ يرسمُ
// تنقّلَ زبونةٍ ثمّ يستبدلُه بتنقّلِ صاحبةِ متجر. ثلاثتُها عَرَضٌ لسببٍ واحد.
//
// فنحفظُ آخرَ جوابٍ وصلَنا ونُقلعُ به، ثمّ يجري النداءُ بالخلفيّةِ ويصحّح.
// وهذه نسخةٌ للعرضِ لا مفتاحٌ للوصول: الكوكي وحدَه يوثّقُ الطلبات، والخادمُ
// لا يقرأُ هذا الحقلَ أبداً — فتزويرُه بالمتصفّحِ لا يفتحُ باباً ولا يجلبُ
// بياناً، وأقصى أثرِه شاشةٌ خاطئةٌ يمسحُها جوابُ الخادمِ بعدَ جزءٍ من الثانية.
// ولا نحفظُ رمزاً ولا كلمةَ مرور — الجوابُ نفسُه لا يحملُهما.
const KEY = 'bz_auth_snap';
// يطابقُ عمرَ كوكي الجلسةِ بالخادم (٩٠ يوماً): نسخةٌ أقدمُ منه جلستُها منتهيةٌ
// حتماً، فالإقلاعُ بها يرسمُ داخلاً ثمّ يقذفُه إلى الدخول — وميضٌ نتجنّبه.
const MAX_AGE = 1000 * 60 * 60 * 24 * 90;

export function readAuthCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap !== 'object' || !snap.user) return null;
    if (!snap.at || Date.now() - snap.at > MAX_AGE) { localStorage.removeItem(KEY); return null; }
    return { user: snap.user, store: snap.store || null, subscription: snap.subscription || null };
  } catch { return null; } // تصفّحٌ خاصٌّ أو تخزينٌ ممنوع → نُقلعُ كما كنّا
}

export function writeAuthCache(data) {
  try {
    if (!data?.user) { localStorage.removeItem(KEY); return; }
    localStorage.setItem(KEY, JSON.stringify({
      at: Date.now(),
      user: data.user,
      store: data.store || null,
      subscription: data.subscription || null,
    }));
  } catch { /* تصفّحٌ خاص */ }
}

export function clearAuthCache() {
  try { localStorage.removeItem(KEY); } catch { /* تصفّحٌ خاص */ }
}

// مدنُ الاستهدافِ الإعلانيّ — اسمٌ عربيٌّ تراه التاجرةُ، واسمٌ إنجليزيٌّ تبحثُ به ميتا.
//
// بحثُ المواقعِ عندَ ميتا (adgeolocation) لا يفهمُ الأسماءَ العربيّةَ بثقة: «الخليل»
// قد لا يُطابَقُ و«Hebron» يُطابَق. فالقائمةُ مغلقةٌ لا نصٌّ حرّ، وكلُّ مدينةٍ معها
// اسمُ بحثِها. نسخةٌ منها بالخادم (server/src/utils/adCities.js) — تُعدَّلُ الاثنتان معاً.
export const AD_CITIES = [
  { ar: 'رام الله', en: 'Ramallah', group: 'wb' },
  { ar: 'البيرة', en: 'Al-Bireh', group: 'wb' },
  { ar: 'نابلس', en: 'Nablus', group: 'wb' },
  { ar: 'الخليل', en: 'Hebron', group: 'wb' },
  { ar: 'جنين', en: 'Jenin', group: 'wb' },
  { ar: 'طولكرم', en: 'Tulkarm', group: 'wb' },
  { ar: 'قلقيلية', en: 'Qalqilya', group: 'wb' },
  { ar: 'سلفيت', en: 'Salfit', group: 'wb' },
  { ar: 'بيت لحم', en: 'Bethlehem', group: 'wb' },
  { ar: 'أريحا', en: 'Jericho', group: 'wb' },
  { ar: 'طوباس', en: 'Tubas', group: 'wb' },
  { ar: 'القدس', en: 'Jerusalem', group: 'quds' },
  { ar: 'الناصرة', en: 'Nazareth', group: 'dakhel' },
  { ar: 'أم الفحم', en: 'Umm al-Fahm', group: 'dakhel' },
  { ar: 'سخنين', en: 'Sakhnin', group: 'dakhel' },
  { ar: 'شفاعمرو', en: 'Shefa-Amr', group: 'dakhel' },
  { ar: 'الطيبة', en: 'Tayibe', group: 'dakhel' },
  { ar: 'باقة الغربية', en: 'Baqa al-Gharbiyye', group: 'dakhel' },
  { ar: 'الطيرة', en: 'Tira', group: 'dakhel' },
  { ar: 'كفر قاسم', en: 'Kafr Qasim', group: 'dakhel' },
  { ar: 'رهط', en: 'Rahat', group: 'dakhel' },
  { ar: 'عكا', en: 'Acre', group: 'dakhel' },
  { ar: 'حيفا', en: 'Haifa', group: 'dakhel' },
  { ar: 'اللد', en: 'Lod', group: 'dakhel' },
  { ar: 'الرملة', en: 'Ramla', group: 'dakhel' },
  { ar: 'يافا', en: 'Jaffa', group: 'dakhel' },
  { ar: 'بئر السبع', en: 'Beersheba', group: 'dakhel' },
  { ar: 'طبريا', en: 'Tiberias', group: 'dakhel' },
];

export const AD_CITY_NAMES = new Set(AD_CITIES.map((c) => c.ar));
export const cityByAr = (ar) => AD_CITIES.find((c) => c.ar === ar) || null;

// أماكنُ الظهور — مفتاحٌ واحدٌ لكلِّ مكانٍ تراه التاجرة، يتحوّلُ إلى منصّةٍ ومواضعَ عند ميتا
export const PLACEMENTS = {
  fb_feed: { platform: 'facebook', key: 'facebook_positions', pos: 'feed' },
  fb_story: { platform: 'facebook', key: 'facebook_positions', pos: 'story' },
  fb_reels: { platform: 'facebook', key: 'facebook_positions', pos: 'facebook_reels' },
  ig_feed: { platform: 'instagram', key: 'instagram_positions', pos: 'stream' },
  ig_story: { platform: 'instagram', key: 'instagram_positions', pos: 'story' },
  ig_reels: { platform: 'instagram', key: 'instagram_positions', pos: 'reels' },
  ig_explore: { platform: 'instagram', key: 'instagram_positions', pos: 'explore' },
};
export const PLACEMENT_KEYS = Object.keys(PLACEMENTS);

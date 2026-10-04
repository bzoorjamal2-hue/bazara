// ───────── ذاكرةُ صندوقِ الرسائل بين الشاشات ─────────
//
// المحادثةُ مسارٌ مستقلٌّ عن اللوحة: فتحُها يهدمُ اللوحةَ، والرجوعُ يبنيها من الصفر —
// حالةُ الربطِ ثمّ القائمةُ ثمّ دوّامةٌ وهياكلُ تحميلٍ في كلِّ مرّة. وفتحُ محادثةٍ فُتحت
// قبل دقيقةٍ يبدأُ أيضاً بشاشةٍ فارغة. هذا ما يُحَسُّ «تعليقاً» وإن كان الخادمُ سريعاً.
// نحفظُ آخرَ ما رأيناه في الذاكرة (لا في التخزين: يُعادُ جلبُه عند فتحِ التطبيق) فيُرسَمُ
// فوراً، ثمّ يُحدَّثُ من الخادمِ بصمتٍ فوقَه.

let status = null;
let convs = null;
let products = null;
const chats = new Map();
const MAX_CHATS = 15;

export const getStatus = () => status;
export const setStatus = (s) => { status = s; };

export const getConvs = () => convs;
export const setConvs = (list) => { convs = Array.isArray(list) ? list : null; };

// فتحُ المحادثةِ يقرؤها: نُصفّرُ عدّادَها في القائمةِ المحفوظة، وإلّا عادت التاجرةُ
// إلى قائمةٍ تقولُ إنّ فيها جديداً قرأته للتوّ.
export function markConvRead(id) {
  if (!convs) return;
  convs = convs.map((c) => (String(c.id) === String(id) && c.unread ? { ...c, unread: 0 } : c));
}

// منتجاتُ المتجرِ لقائمةِ «أرسلي منتجاً» — تُجلَبُ مرّةً للجلسةِ لا مع كلِّ فتحةِ قائمة
export const getProducts = () => products;
export const setProducts = (list) => { products = Array.isArray(list) ? list : null; };

export const getChat = (id) => chats.get(String(id)) || null;

// تُحفَظُ رسائلُ الخادمِ وحدَها: التفاؤليّةُ (tmp-) حالةٌ عابرةٌ تخصُّ الشاشةَ المفتوحة.
export function setChat(id, data) {
  if (!data) return;
  const key = String(id);
  chats.delete(key); // الأحدثُ استعمالاً آخرَ الترتيب، فيُهدَمُ الأقدمُ أوّلاً
  chats.set(key, {
    conversation: data.conversation,
    messages: (data.messages || []).filter((m) => !String(m.id).startsWith('tmp-')),
    hasMore: Boolean(data.hasMore),
  });
  while (chats.size > MAX_CHATS) chats.delete(chats.keys().next().value);
}

// خروجٌ من الحساب: لا يرى الحسابُ التالي محادثاتِ السابق
export function clearChatCache() {
  status = null;
  convs = null;
  products = null;
  chats.clear();
}

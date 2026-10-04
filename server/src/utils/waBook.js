import { query } from '../config/db.js';

// ───────── دفترُ أرقامِ واتساب الزبائن ─────────
//
// أرقامُ جوّال والوطنيّة (059/056) فلسطينيّةٌ، لكنّ صاحبَها قد يكونُ مسجّلاً على
// واتساب بمقدّمة ‎+970 أو ‎+972 — ولا شيءَ في الرقمِ نفسِه يقولُ أيُّهما. كانت اللوحةُ
// تعرضُ زرّين وتتركُ التاجرةَ تُجرّبُ كلَّ مرّة، ولكلِّ طلب. صارت التجربةُ مرّةً واحدة:
// حين تقولُ «انفتحت المحادثة» يُحفَظُ الرقمُ الصحيحُ لهذا الزبونِ في متجرِها، ويُفتَحُ
// به مباشرةً في كلِّ طلبٍ له بعدها — وفي السلّةِ المتروكةِ أيضاً.

// مفتاحُ الزبون: الرقمُ المحلّيُّ بلا صفرٍ ولا مقدّمة (٩ خانات: 591234567)، فيلتقي
// «0591234567» و«+970 59 123 4567» و«00972591234567» على زبونٍ واحد.
export function phoneKey(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('970') || d.startsWith('972')) d = d.slice(3);
  d = d.replace(/^0+/, '');
  return /^5\d{8}$/.test(d) ? d : '';
}

// رقمُ واتسابٍ مقبولٌ للحفظ: مقدّمةٌ من الاثنتين ثمّ مفتاحُ الزبونِ نفسِه — فلا يُحفَظُ
// لزبونٍ رقمُ زبونٍ آخر بخطأٍ في الواجهة.
export function validWa(wa, key) {
  const d = String(wa || '').replace(/\D/g, '');
  return /^(970|972)5\d{8}$/.test(d) && d.slice(3) === key ? d : '';
}

// الدفترُ كلُّه لمتجر: { مفتاح: رقم }. جدولٌ ناقصٌ (ترقيةٌ لم تصلْ بعد) دفترٌ فارغ —
// لا يُسقِطُ قائمةَ الطلبات.
export async function loadWaBook(storeId) {
  try {
    const r = await query('SELECT phone_key, wa FROM customer_wa WHERE store_id = $1', [storeId]);
    return Object.fromEntries(r.rows.map((x) => [x.phone_key, x.wa]));
  } catch {
    return {};
  }
}

export async function saveWa(storeId, key, wa) {
  if (!wa) {
    await query('DELETE FROM customer_wa WHERE store_id = $1 AND phone_key = $2', [storeId, key]);
    return;
  }
  await query(
    `INSERT INTO customer_wa (store_id, phone_key, wa) VALUES ($1, $2, $3)
     ON CONFLICT (store_id, phone_key) DO UPDATE SET wa = EXCLUDED.wa, updated_at = now()`,
    [storeId, key, wa]
  );
}

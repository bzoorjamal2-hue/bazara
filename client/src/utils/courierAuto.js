import api from '../api/client.js';
import { bestMatch, bestMatchScored, stripNames, norm } from './match.js';

// ═════ مطابقةُ عنوانِ الزبونةِ بقوائمِ شركاتِ التوصيل ═════
// مصدرٌ واحدٌ يستعملُه زرُّ الإرسالِ للطلبِ الواحد (OpostSend/EpsSend) والإرسالُ الجماعيُّ
// من صفحةِ الطلبات — فلا تُرسَلُ شحنةٌ بطريقةٍ هنا وبطريقةٍ هناك.
//
// كلُّ دالّةٍ تُرجعُ { ok: true, body } حين تكونُ المطابقةُ مؤكّدةً فيُرسَلُ الطلبُ بلا سؤال،
// أو { ok: false, … } بأفضلِ ترشيحٍ لتأكّدَ التاجرةُ بنفسِها. الدقّةُ أهمُّ من السرعة: شحنةٌ
// لقريةٍ غلط أغلى من ضغطةِ تأكيد.

// مناطقُ كلِّ مدينةٍ عند أوبتيموس — تُجلَبُ مرّةً للصفحةِ كلِّها
const areaCache = new Map();
export async function opostAreas(cityId) {
  if (areaCache.has(cityId)) return areaCache.get(cityId);
  const r = await api.get('/opost/areas', { params: { city: cityId } });
  const list = r.data.areas || [];
  areaCache.set(cityId, list);
  return list;
}

// EPS: المدينةُ وحدَها (بلا مناطق). إرسالٌ مباشرٌ فقط عند تطابقٍ تامٍّ مع مدينةِ الزبونة.
export function epsAuto(order, cities = []) {
  const city = bestMatch(order.city, cities) || bestMatch(order.address, cities);
  if (!city) return { ok: false, reason: 'noCity' };
  if (norm(city.name) === norm(order.city)) return { ok: true, body: { city: String(city.id) } };
  return { ok: false, reason: 'verifyCity', cityId: String(city.id) };
}

// العنوانُ التفصيليُّ لأوبتيموس: عنوانُ الزبونةِ بلا اسمِ المدينةِ والقرية (راحا لحقليهما)
export const opostDetail = (order, areaName) =>
  stripNames(order.address, [order.city, order.area, areaName].filter(Boolean)) || '';

// أوبتيموس: المحافظةُ ثمّ القرية/المنطقة.
//   • القريةُ بحقلِها المستقلّ (order.area) — اختارتها الزبونةُ من قائمة، فتُطابَقُ بالاسم مباشرة
//   • أو العنوانُ كما هو حرفيّاً اسمُ منطقة
//   • وإلّا العنوانُ + المدينةُ بعد حذفِ اسمِ المحافظةِ منه: إبقاؤه كان يجعلُ «جنين البلد»
//     تتفوّقُ على القريةِ الصحيحة (رابا) — وهكذا ذهبت شحنةُ رابا إلى جنين البلد مرّة.
export async function opostAuto(order, { cities = [], shipmentType = '' } = {}) {
  const city = bestMatch(order.city, cities) || bestMatch(order.address, cities);
  if (!city) return { ok: false, reason: 'noCity' };
  const cityId = String(city.id);
  const list = await opostAreas(cityId);
  const byField = order.area ? bestMatchScored(order.area, list) : null;
  const rawExact = bestMatchScored(order.address, list);
  const areaText = stripNames(`${order.address || ''} ${order.city || ''}`, [city.name]);
  const m = (byField && byField.score >= 60) ? byField
    : rawExact?.score === 100 ? rawExact
      : bestMatchScored(areaText, list);
  if (m && m.score >= 60) {
    return {
      ok: true,
      body: { city: cityId, area: String(m.it.id), shipmentType, address: opostDetail(order, m.it.name) },
    };
  }
  return { ok: false, reason: m ? 'verifyArea' : 'noArea', cityId, areaId: m ? String(m.it.id) : '', areas: list };
}

// إرسالُ طلبٍ لشركةٍ بالمطابقةِ التلقائيّة — للإرسالِ الجماعيّ.
// يُرجع { ok, tracking } أو { ok: false, reason } (تحتاجُ تأكيداً يدويّاً أو فشلَ الإرسال).
// gobox يختارُ القريةَ من شجرةِ مناطقِه يدويّاً دائماً، فلا يُرسَلُ جماعيّاً.
export async function autoSend(courier, order, couriers) {
  try {
    if (courier === 'eps') {
      const a = epsAuto(order, couriers.eps.cities);
      if (!a.ok) return { ok: false, reason: 'manual' };
      const r = await api.post(`/eps/orders/${order.id}/send`, a.body);
      return { ok: true, tracking: r.data.tracking || '✓' };
    }
    if (courier === 'opost') {
      const type = String(couriers.opost.defaultType || couriers.opost.types?.[0]?.id || '');
      const a = await opostAuto(order, { cities: couriers.opost.cities, shipmentType: type });
      if (!a.ok) return { ok: false, reason: 'manual' };
      const r = await api.post(`/opost/orders/${order.id}/send`, a.body);
      return { ok: true, tracking: r.data.tracking || '✓' };
    }
    return { ok: false, reason: 'manual' };
  } catch (e) {
    return { ok: false, reason: 'error', error: e };
  }
}

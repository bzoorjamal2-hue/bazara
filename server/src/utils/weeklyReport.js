import { query } from '../config/db.js';
import { notifyUser } from './notify.js';

// ───────── التقريرُ الأسبوعيّ: كلَّ أحدٍ صباحاً ─────────
//
// التاجرةُ تعرفُ يومَها من صفحةِ الطلبات، لكنّ «كيف كان أسبوعي؟» سؤالٌ لا يُجيبُه
// أحدٌ إلّا إن فتحت الإحصائيّات وقارنت بنفسِها. صار يصلُها جوابُه إشعاراً واحداً
// صباحَ كلِّ أحد (أوّلُ أيّامِ الشغلِ عندنا): كم باعت، كم طلباً، والفرقُ عن الأسبوعِ
// الذي قبله، والقطعةُ الأكثرُ طلباً، ومن رجعت من زبائنِها.
//
// المهمّةُ تمرُّ مع المزامنةِ الدوريّة (كلَّ نصفِ ساعة)، لكنّها لا تلمسُ القاعدةَ إلّا
// صباحَ الأحدِ بتوقيتِ فلسطين — فلا توقظُ Neon بقيّةَ الأسبوع. وكلُّ متجرٍ يُحجَزُ
// بتحديثٍ ذرّيٍّ لعمودِ weekly_report_at قبل الإرسال، فإعادةُ تشغيلِ الخادم أو نسختان
// منه لا تُرسلانِ التقريرَ مرّتين.

const TZ = 'Asia/Hebron';
const FROM_HOUR = 10; // العاشرةُ صباحاً — لا إشعارَ أرقامٍ مع أوّلِ فنجانِ قهوة
const SOLD = "status IN ('confirmed','shipped','delivered')";

function localNow(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(d).map((p) => [p.type, p.value])
  );
  return { weekday: parts.weekday, hour: Number(parts.hour) };
}

export function isReportTime(d = new Date()) {
  const { weekday, hour } = localNow(d);
  return weekday === 'Sun' && hour >= FROM_HOUR;
}

const money = (n) => `₪${Math.round(n).toLocaleString('en-US')}`;

// العددُ مع معدودِه كما يُقال: طلب واحد، طلبين، ٣ طلبات، ١١ طلب
function ordersAr(n) {
  if (n === 1) return 'طلب واحد';
  if (n === 2) return 'طلبين';
  if (n >= 3 && n <= 10) return `${n} طلبات`;
  return `${n} طلب`;
}

export async function weeklyStats(storeId) {
  const r = await query(
    `SELECT
        COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days' AND status NOT IN ('pending','failed'))::int AS orders,
        COALESCE(SUM(total) FILTER (WHERE created_at >= now() - interval '7 days' AND ${SOLD}), 0)::float AS sales,
        COALESCE(SUM(total) FILTER (WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days' AND ${SOLD}), 0)::float AS prev,
        COUNT(*) FILTER (WHERE status = 'new')::int AS waiting
       FROM orders WHERE store_id = $1 AND created_at >= now() - interval '60 days'`,
    [storeId]
  );
  const top = await query(
    `SELECT it->>'name' AS name, SUM((it->>'qty')::int)::int AS qty
       FROM orders o, jsonb_array_elements(o.items) it
      WHERE o.store_id = $1 AND o.created_at >= now() - interval '7 days' AND o.${SOLD}
      GROUP BY 1 ORDER BY qty DESC LIMIT 1`,
    [storeId]
  );
  // من اشترت هالأسبوع وكان لها طلبٌ مؤكّدٌ قبلَه
  const back = await query(
    `WITH k AS (SELECT RIGHT(regexp_replace(customer_phone, '\\D', '', 'g'), 9) AS k, created_at, status FROM orders WHERE store_id = $1)
     SELECT COUNT(DISTINCT w.k)::int AS n
       FROM k w
      WHERE w.created_at >= now() - interval '7 days' AND w.${SOLD}
        AND EXISTS (SELECT 1 FROM k b WHERE b.k = w.k AND b.created_at < now() - interval '7 days' AND b.${SOLD})`,
    [storeId]
  );
  const s = r.rows[0] || {};
  return {
    orders: s.orders || 0,
    sales: Number(s.sales) || 0,
    prev: Number(s.prev) || 0,
    waiting: s.waiting || 0,
    top: top.rows[0]?.name || '',
    back: back.rows[0]?.n || 0,
  };
}

export function reportPayload(storeName, st) {
  const lines = [];
  if (st.orders) {
    let head = `${money(st.sales)} مبيعات من ${ordersAr(st.orders)}`;
    if (st.prev > 0) {
      const pct = Math.round(((st.sales - st.prev) / st.prev) * 100);
      head += pct >= 0 ? ` (▲ ${pct}% عن الأسبوع الي قبله)` : ` (▼ ${Math.abs(pct)}% عن الأسبوع الي قبله)`;
    }
    lines.push(head);
    if (st.top) lines.push(`الأكثر طلباً: ${st.top}`);
    if (st.back) lines.push(st.back === 1 ? 'زبونة رجعت تشتري منك 💜' : `${st.back} زبائن رجعوا يشتروا منك 💜`);
  } else {
    lines.push('أسبوع هادي بلا طلبات — جرّبي تنزّلي قطعة جديدة أو تبعتي عرض لزبائنك من صفحة «زبائني».');
  }
  if (st.waiting) lines.push(`⏳ ${ordersAr(st.waiting)} بانتظار تأكيدك`);
  return {
    title: `📊 أسبوعك بـ${storeName}`,
    body: lines.join(' · '),
    url: st.orders ? '/dashboard?tab=analytics' : '/dashboard?tab=customers',
    type: 'report',
    tag: 'weekly-report',
  };
}

let running = false;
export async function sendWeeklyReports(now = new Date()) {
  if (running || !isReportTime(now)) return;
  running = true;
  try {
    // المتاجرُ التي باعت أو وصلها طلبٌ خلالَ الشهرِ الأخير ولم يصلْها تقريرُ هذا الأسبوع.
    // المتجرُ الخامدُ تماماً لا يُزعَجُ كلَّ أحدٍ برسالةِ «لا شيء».
    const r = await query(
      `SELECT s.id, s.name, s.user_id
         FROM stores s JOIN users u ON u.id = s.user_id
        WHERE u.suspended_at IS NULL
          AND (s.weekly_report_at IS NULL OR s.weekly_report_at < now() - interval '6 days')
          AND EXISTS (SELECT 1 FROM orders o WHERE o.store_id = s.id AND o.created_at >= now() - interval '30 days')
        LIMIT 500`
    );
    let sent = 0;
    for (const s of r.rows) {
      try {
        const claim = await query(
          `UPDATE stores SET weekly_report_at = now()
            WHERE id = $1 AND (weekly_report_at IS NULL OR weekly_report_at < now() - interval '6 days')
            RETURNING id`,
          [s.id]
        );
        if (!claim.rowCount) continue;
        const st = await weeklyStats(s.id);
        await notifyUser(s.user_id, reportPayload(s.name, st), s.id);
        sent += 1;
      } catch (e) {
        console.error(`weeklyReport ${s.id}:`, e.message);
      }
    }
    if (sent) console.log(`📊 التقرير الأسبوعي: انبعت لـ ${sent} متجر`);
  } catch (e) {
    // عمودٌ لم تصلْه الترقيةُ بعد — نحاولُ بالدورةِ القادمة
    if (e.code !== '42703') console.error('sendWeeklyReports:', e.message);
  } finally {
    running = false;
  }
}

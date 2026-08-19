import { query } from '../config/db.js';
import { orderProfit, storeCostMap } from './order.controller.js';

// المالية: ربح البضاعة (من الطلبات) ناقص مصاريف المتجر = صافي الربح.
// كل الأرقام محسوبة على الخادم كي لا تختلف بين الشاشات، وشهرياً لأن المالكة
// تفكّر بالشهر: «شو ربحت هذا الشهر؟» لا «منذ الافتتاح».

export const EXPENSE_CATEGORIES = ['ads', 'packaging', 'shipping', 'rent', 'salaries', 'goods', 'other'];

// الطلبات المؤكّدة فقط = مبيعات فعلية (نفس أساس الإيراد بصفحة الإحصائيات)
const PAID = "status IN ('confirmed','shipped','delivered')";

async function getUserStore(userId) {
  const r = await query('SELECT id FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

// نطاق الشهر: "YYYY-MM" → [بداية الشهر، بداية الشهر التالي). فارغ = الشهر الحالي.
function monthRange(raw) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(raw || ''));
  const now = new Date();
  const y = m ? Number(m[1]) : now.getFullYear();
  const mo = m ? Number(m[2]) - 1 : now.getMonth();
  const from = new Date(Date.UTC(y, mo, 1));
  const to = new Date(Date.UTC(y, mo + 1, 1));
  const key = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, '0')}`;
  return { from, to, key };
}

// سجلّ مصاريف الشهر. 42P01 = الجدول غير موجود بعد (قاعدة لم تُرقَّ): نُرجع سجلاً
// فارغاً بدل خطأ خادم — تبقى أرقام الإيراد والربح ظاهرة والمصاريف صفراً، وهو
// أصدق للمالكة من شاشة معطّلة. نفس الدرس الذي أسقط قائمة الطلبات سابقاً.
async function listExpenses(storeId, from, to) {
  try {
    return await query(
      `SELECT id, category, amount, note, spent_at FROM expenses
       WHERE store_id = $1 AND spent_at >= $2 AND spent_at < $3
       ORDER BY spent_at DESC, created_at DESC`,
      [storeId, from, to]
    );
  } catch (err) {
    if (err.code === '42P01') return { rows: [] };
    throw err;
  }
}

// ── GET /api/finance?month=YYYY-MM ─────────────────────────────────────────
export async function financeSummary(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const { from, to, key } = monthRange(req.query.month);

    // نافذة ستة أشهر تنتهي بالشهر المختار: رقمٌ واحد بلا سياق لا يقول للمالكة
    // إن كانت تتحسّن أم تتراجع. نجلبها بطلبين لا باثني عشر.
    const trendFrom = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 5, 1));
    const [allOrders, allExp, costMap] = await Promise.all([
      query(
        `SELECT items, total, delivery_fee, created_at FROM orders
         WHERE store_id = $1 AND ${PAID} AND created_at >= $2 AND created_at < $3`,
        [store.id, trendFrom, to]
      ),
      listExpenses(store.id, trendFrom, to),
      storeCostMap(store.id),
    ]);

    const mKey = (d) => {
      const x = new Date(d);
      return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    };
    const inMonth = (d) => mKey(d) === key;
    const ordersRes = { rows: allOrders.rows.filter((o) => inMonth(o.created_at)) };
    const expRes = { rows: allExp.rows.filter((e) => inMonth(e.spent_at)) };

    let revenue = 0;
    let cogs = 0;
    let productProfit = 0;
    let profitOrders = 0;
    let profitMissing = 0;
    let profitEstimated = 0;
    let deliveryFees = 0;
    for (const o of ordersRes.rows) {
      revenue += Number(o.total || 0);
      deliveryFees += Number(o.delivery_fee || 0);
      const p = orderProfit({ items: o.items, total: Number(o.total), deliveryFee: Number(o.delivery_fee || 0) }, costMap);
      if (!p.complete) { profitMissing += 1; continue; }
      cogs += p.cogs;
      productProfit += p.profit;
      profitOrders += 1;
      if (!p.exact) profitEstimated += 1;
    }

    const expenses = expRes.rows.map((e) => ({
      id: e.id,
      category: e.category,
      amount: Number(e.amount),
      note: e.note || '',
      spentAt: e.spent_at,
    }));
    const byCategory = {};
    let expensesTotal = 0;
    for (const e of expenses) {
      byCategory[e.category] = Math.round(((byCategory[e.category] || 0) + e.amount) * 100) / 100;
      expensesTotal += e.amount;
    }

    const r2 = (n) => Math.round(n * 100) / 100;

    // اتجاه الأشهر الستة: صافي ربح كل شهر بنفس معادلة الشهر المختار تماماً
    const buckets = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1));
      buckets.set(mKey(d), { month: mKey(d), revenue: 0, productProfit: 0, expenses: 0 });
    }
    for (const o of allOrders.rows) {
      const b = buckets.get(mKey(o.created_at));
      if (!b) continue;
      b.revenue += Number(o.total || 0);
      const p = orderProfit({ items: o.items, total: Number(o.total), deliveryFee: Number(o.delivery_fee || 0) }, costMap);
      if (p.complete) b.productProfit += p.profit;
    }
    for (const e of allExp.rows) {
      const b = buckets.get(mKey(e.spent_at));
      if (b) b.expenses += Number(e.amount || 0);
    }
    const trend = [...buckets.values()].map((b) => ({
      month: b.month,
      revenue: r2(b.revenue),
      netProfit: r2(b.productProfit - b.expenses),
    }));

    const netProfit = r2(productProfit - expensesTotal);
    const prev = trend[trend.length - 2] || null;
    // نسبة التغيّر بلا قسمة على صفر، وبقيمة مطلقة للمقام كي لا ينقلب الاتجاه
    // حين يكون الشهر الماضي خسارة: من −١٠٠ إلى +٥٠ تحسُّنٌ لا تراجع.
    const change = prev && prev.netProfit !== 0
      ? Math.round(((netProfit - prev.netProfit) / Math.abs(prev.netProfit)) * 100)
      : null;

    // مصاريف متكرّرة: الإيجار والرواتب تتكرّر كل شهر بنفس المبلغ، وإعادة
    // إدخالها يدوياً كل مرّة عبء يجعل المالكة تهملها فيكذب صافي الربح. نقترح
    // ما سُجّل الشهر الماضي ولم يُسجَّل بعد هذا الشهر — اقتراحٌ بضغطة، لا
    // إنشاءٌ تلقائي، كي لا يظهر مصروف لم تقرّره.
    const prevKey = mKey(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1)));
    const loggedNow = new Set(expenses.map((e) => e.category));
    const seen = new Set();
    const recurring = [];
    for (const e of allExp.rows) {
      if (mKey(e.spent_at) !== prevKey) continue;
      if (loggedNow.has(e.category)) continue;
      const sig = `${e.category}|${Number(e.amount)}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      recurring.push({ category: e.category, amount: Number(e.amount), note: e.note || '' });
      if (recurring.length >= 4) break;
    }

    res.json({
      recurring,
      trend,
      prevNetProfit: prev ? prev.netProfit : null,
      netChange: change,
      // هامش الربح: كم شيكلاً يبقى من كل ١٠٠ تبيعها. أصدق من الرقم المطلق
      // لأنه لا يكبر لمجرّد أن المبيعات كبرت.
      margin: revenue > 0 ? Math.round((netProfit / revenue) * 100) : null,
      month: key,
      ordersCount: ordersRes.rows.length,
      revenue: r2(revenue),
      cogs: r2(cogs),
      deliveryFees: r2(deliveryFees),
      productProfit: r2(productProfit),
      profitOrders,
      profitMissing,
      profitEstimated,
      expenses,
      expensesByCategory: byCategory,
      expensesTotal: r2(expensesTotal),
      // صافي الربح = ربح البضاعة − مصاريف الشهر. يكون سالباً إن تجاوزت المصاريف الربح.
      netProfit,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/finance/expenses ─────────────────────────────────────────────
export async function createExpense(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'أدخلي مبلغاً صحيحاً.' });
    const category = EXPENSE_CATEGORIES.includes(req.body.category) ? req.body.category : 'other';
    const note = String(req.body.note || '').trim().slice(0, 200);
    // تاريخ الصرف: نقبل YYYY-MM-DD فقط، وإلا اليوم
    const spentAt = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.spentAt || '')) ? req.body.spentAt : new Date().toISOString().slice(0, 10);

    const r = await query(
      `INSERT INTO expenses (store_id, category, amount, note, spent_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, category, amount, note, spent_at`,
      [store.id, category, amount, note, spentAt]
    );
    const e = r.rows[0];
    res.status(201).json({ expense: { id: e.id, category: e.category, amount: Number(e.amount), note: e.note || '', spentAt: e.spent_at } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/finance/expenses/:id ───────────────────────────────────────
export async function deleteExpense(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('DELETE FROM expenses WHERE id = $1 AND store_id = $2 RETURNING id', [req.params.id, store.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'المصروف غير موجود.' });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    next(err);
  }
}

// ── تسوية تحصيل شركات التوصيل ──────────────────────────────────────────────
// المال الذي تدفعه الزبونة عند الاستلام يبقى عند شركة التوصيل حتى تُسلّمه
// للمالكة. فرقٌ بين «بِعتُ» و«قبضتُ»، والمتجر قد يبدو رابحاً بينما نصف ماله
// ما زال عند الشركة. هنا نفصلهما: بالطريق · مستحقّ عند الشركة · محصَّل.

// الشركة تُعرف من رقم الشحنة المسجّل على الطلب — نفس مفاتيح couriers.jsx
const COURIER_SQL = `CASE
    WHEN COALESCE(opost_tracking,'') <> '' THEN 'opost'
    WHEN COALESCE(eps_barcode,'')    <> '' THEN 'eps'
    WHEN COALESCE(gobox_barcode,'')  <> '' THEN 'gobox'
    ELSE 'none' END`;

// عمود collected_at حديث؛ إن سبق الكودُ الترقيةَ نُرجع لا شيء بدل إسقاط الشاشة
async function safeQuery(sql, params, fallback = { rows: [] }) {
  try {
    return await query(sql, params);
  } catch (err) {
    if (err.code === '42703' || err.code === '42P01') return fallback;
    throw err;
  }
}

// ── GET /api/finance/couriers?month=YYYY-MM ────────────────────────────────
export async function courierSettlement(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const { from, to, key } = monthRange(req.query.month);

    const [agg, pendingRes] = await Promise.all([
      // المستحقّ والمُحصَّل لا يُقيَّدان بشهر: مبلغٌ عالق منذ شهرين ما زال عالقاً
      // اليوم ويجب أن يظهر. المُحصَّل وحده شهريّ لأنه سؤال «كم قبضتُ هذا الشهر؟».
      safeQuery(
        `SELECT ${COURIER_SQL} AS courier,
            COUNT(*) FILTER (WHERE status = 'shipped')::int AS transit_orders,
            COALESCE(SUM(total) FILTER (WHERE status = 'shipped'), 0) AS transit_amount,
            COUNT(*) FILTER (WHERE status = 'delivered' AND collected_at IS NULL)::int AS pending_orders,
            COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND collected_at IS NULL), 0) AS pending_amount,
            COUNT(*) FILTER (WHERE collected_at >= $2 AND collected_at < $3)::int AS collected_orders,
            COALESCE(SUM(total) FILTER (WHERE collected_at >= $2 AND collected_at < $3), 0) AS collected_amount
         FROM orders WHERE store_id = $1
         GROUP BY 1`,
        [store.id, from, to]
      ),
      safeQuery(
        `SELECT id, reference, customer_name, total, delivery_fee, created_at, ${COURIER_SQL} AS courier
         FROM orders
         WHERE store_id = $1 AND status = 'delivered' AND collected_at IS NULL
         ORDER BY created_at ASC`,
        [store.id]
      ),
    ]);

    const num = (v) => Math.round(Number(v || 0) * 100) / 100;
    const couriers = agg.rows
      .map((r) => ({
        key: r.courier,
        transitOrders: r.transit_orders,
        transitAmount: num(r.transit_amount),
        pendingOrders: r.pending_orders,
        pendingAmount: num(r.pending_amount),
        collectedOrders: r.collected_orders,
        collectedAmount: num(r.collected_amount),
      }))
      // شركة بلا أي حركة لا تُعرض — لكن 'none' يبقى إن كان فيه تسليم يدوي
      .filter((c) => c.transitOrders || c.pendingOrders || c.collectedOrders)
      .sort((a, b) => b.pendingAmount - a.pendingAmount);

    const sum = (f) => num(couriers.reduce((s, c) => s + c[f], 0));
    res.json({
      month: key,
      couriers,
      pending: pendingRes.rows.map((o) => ({
        id: o.id,
        reference: o.reference || '',
        customerName: o.customer_name || '',
        total: num(o.total),
        deliveryFee: num(o.delivery_fee),
        courier: o.courier,
        createdAt: o.created_at,
      })),
      totals: {
        transitAmount: sum('transitAmount'),
        pendingAmount: sum('pendingAmount'),
        collectedAmount: sum('collectedAmount'),
        pendingOrders: couriers.reduce((s, c) => s + c.pendingOrders, 0),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/finance/collect ──────────────────────────────────────────────
// { orderIds: [] } تعليم مبالغ كمقبوضة، أو { courier } لتسوية شركة كاملة دفعةً
// واحدة (المالكة تستلم من الشركة حوالةً واحدة لا طلباً طلباً).
export async function markCollected(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const ids = Array.isArray(req.body.orderIds) ? req.body.orderIds.filter((x) => typeof x === 'string') : [];
    const courier = ['opost', 'eps', 'gobox', 'none'].includes(req.body.courier) ? req.body.courier : null;
    if (!ids.length && !courier) return res.status(400).json({ error: 'حدّدي طلبات أو شركة.' });

    // شرط status='delivered' مقصود: لا يُقبض ثمن شحنة لم تصل بعد
    const r = ids.length
      ? await query(
          `UPDATE orders SET collected_at = now()
           WHERE store_id = $1 AND id = ANY($2::uuid[]) AND status = 'delivered' AND collected_at IS NULL
           RETURNING id`,
          [store.id, ids]
        )
      : await query(
          `UPDATE orders SET collected_at = now()
           WHERE store_id = $1 AND status = 'delivered' AND collected_at IS NULL AND ${COURIER_SQL} = $2
           RETURNING id`,
          [store.id, courier]
        );
    res.json({ ok: true, count: r.rows.length });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/finance/uncollect ────────────────────────────────────────────
// تراجُع عن تعليم خاطئ — التسوية اليدوية تُخطئ، ولا يجوز أن يكون الخطأ نهائياً
export async function undoCollected(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const ids = Array.isArray(req.body.orderIds) ? req.body.orderIds.filter((x) => typeof x === 'string') : [];
    if (!ids.length) return res.status(400).json({ error: 'حدّدي طلبات.' });
    const r = await query(
      'UPDATE orders SET collected_at = NULL WHERE store_id = $1 AND id = ANY($2::uuid[]) RETURNING id',
      [store.id, ids]
    );
    res.json({ ok: true, count: r.rows.length });
  } catch (err) {
    next(err);
  }
}

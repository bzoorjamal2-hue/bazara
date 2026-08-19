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

    const [ordersRes, expRes, costMap] = await Promise.all([
      query(
        `SELECT items, total, delivery_fee FROM orders
         WHERE store_id = $1 AND ${PAID} AND created_at >= $2 AND created_at < $3`,
        [store.id, from, to]
      ),
      listExpenses(store.id, from, to),
      storeCostMap(store.id),
    ]);

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
    res.json({
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
      netProfit: r2(productProfit - expensesTotal),
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

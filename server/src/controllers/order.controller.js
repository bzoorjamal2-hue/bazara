import crypto from 'crypto';
import { query } from '../config/db.js';
import { isLahzaConfigured, initializeTransaction, verifyTransaction, PAY_CURRENCY } from '../config/lahza.js';

const SITE = () => (process.env.PUBLIC_SITE_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

async function getUserStore(userId) {
  const r = await query('SELECT id FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

// إنشاء طلب دفع بالبطاقة عبر Lahza
export async function checkout(req, res, next) {
  const { items, customer } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'السلة فارغة.' });
  }
  if (!customer?.email || !/^\S+@\S+\.\S+$/.test(customer.email)) {
    return res.status(400).json({ error: 'بريد إلكتروني غير صالح.' });
  }
  if (!isLahzaConfigured()) {
    return res.status(503).json({ error: 'الدفع بالبطاقة غير مُفعّل بعد. جرّب الطلب عبر واتساب.' });
  }

  try {
    // نحسب الإجمالي من قاعدة البيانات (لا نثق بأسعار العميل) ونتأكد أن المنتجات من متجر واحد
    const ids = items.map((i) => i.id);
    const r = await query(
      'SELECT id, name, price, store_id FROM products WHERE id = ANY($1::uuid[])',
      [ids]
    );
    if (r.rows.length === 0) return res.status(400).json({ error: 'منتجات غير صالحة.' });

    const storeId = r.rows[0].store_id;
    const sameStore = r.rows.every((p) => p.store_id === storeId);
    if (!sameStore) return res.status(400).json({ error: 'الدفع بالبطاقة يدعم منتجات متجر واحد لكل طلب.' });

    let total = 0;
    const orderItems = items.map((i) => {
      const p = r.rows.find((x) => x.id === i.id);
      const qty = Math.max(1, parseInt(i.qty, 10) || 1);
      if (!p) return null;
      total += Number(p.price) * qty;
      return { id: p.id, name: p.name, price: Number(p.price), qty };
    }).filter(Boolean);

    if (total <= 0) return res.status(400).json({ error: 'إجمالي غير صالح.' });

    const reference = 'BZ-' + crypto.randomBytes(8).toString('hex');
    const orderRes = await query(
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total, currency, status, reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8) RETURNING id`,
      [storeId, customer.name || '', customer.email, customer.phone || '', JSON.stringify(orderItems), total, PAY_CURRENCY, reference]
    );

    const init = await initializeTransaction({
      email: customer.email,
      amount: total,
      currency: PAY_CURRENCY,
      callbackUrl: `${SITE()}/payment/callback`,
      reference,
      metadata: { orderId: orderRes.rows[0].id },
    });

    res.json({ authorizationUrl: init.data.authorization_url, reference });
  } catch (err) {
    next(err);
  }
}

// التحقق من حالة الدفع بعد العودة من Lahza
export async function verify(req, res, next) {
  const { reference } = req.params;
  try {
    const orderRes = await query('SELECT * FROM orders WHERE reference = $1', [reference]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود.' });

    if (order.status === 'paid') {
      return res.json({ status: 'paid', total: Number(order.total) });
    }

    if (!isLahzaConfigured()) return res.status(503).json({ error: 'الدفع غير مُفعّل.' });

    const result = await verifyTransaction(reference);
    const paid = result?.data?.status === 'success';
    const newStatus = paid ? 'paid' : 'failed';
    await query('UPDATE orders SET status = $1 WHERE reference = $2', [newStatus, reference]);

    res.json({ status: newStatus, total: Number(order.total) });
  } catch (err) {
    next(err);
  }
}

// طلبات متجر المستخدم الحالي
export async function listMyOrders(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query(
      `SELECT id, customer_name, customer_email, customer_phone, items, total, currency, status, created_at
       FROM orders WHERE store_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [store.id]
    );
    res.json({
      orders: r.rows.map((o) => ({
        id: o.id,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        customerPhone: o.customer_phone,
        items: o.items,
        total: Number(o.total),
        currency: o.currency,
        status: o.status,
        createdAt: o.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

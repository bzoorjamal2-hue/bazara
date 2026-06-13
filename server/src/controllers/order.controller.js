import crypto from 'crypto';
import { query } from '../config/db.js';
import { isLahzaConfigured, initializeTransaction, verifyTransaction, PAY_CURRENCY } from '../config/lahza.js';
import { evaluateCoupon } from './coupon.controller.js';

// يخصم الكمية المطلوبة من مخزون المنتج العام ومن مخزون المقاس (إن وُجد) — لا يقل عن صفر
async function decrementStock(orderItems) {
  for (const it of orderItems) {
    const qty = it.qty;
    // المخزون العام (NULL = متوفّر دائماً → لا يُلمس)
    await query('UPDATE products SET stock = GREATEST(0, stock - $2) WHERE id = $1 AND stock IS NOT NULL', [it.id, qty]);
    // مخزون المقاس (نمرة) إن كان المنتج يتتبّع كميات لكل مقاس
    if (it.size) {
      await query(
        `UPDATE products
         SET size_stock = jsonb_set(size_stock, ARRAY[$2::text], to_jsonb(GREATEST(0, COALESCE((size_stock->>$2)::int, 0) - $3)))
         WHERE id = $1 AND size_stock ? $2`,
        [it.id, it.size, qty]
      );
    }
  }
}

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

// إنشاء طلب الدفع عند الاستلام (واتساب) — يُحفظ بالنظام بحالة "جديد" (بلا دفع إلكتروني)
export async function createCodOrder(req, res, next) {
  const { items, customer } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'السلة فارغة.' });
  }
  const name = (customer?.name || '').trim();
  const phone = (customer?.phone || '').trim();
  if (!name || !phone) return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان.' });

  try {
    // نحسب الإجمالي من قاعدة البيانات (لا نثق بأسعار العميل) ونتأكد أن المنتجات من متجر واحد
    const ids = items.map((i) => i.id);
    const r = await query('SELECT id, name, price, store_id FROM products WHERE id = ANY($1::uuid[])', [ids]);
    if (r.rows.length === 0) return res.status(400).json({ error: 'منتجات غير صالحة.' });

    const storeId = r.rows[0].store_id;
    if (!r.rows.every((p) => p.store_id === storeId)) {
      return res.status(400).json({ error: 'الطلب يجب أن يكون من متجر واحد.' });
    }

    let subtotal = 0;
    const orderItems = items
      .map((i) => {
        const p = r.rows.find((x) => x.id === i.id);
        if (!p) return null;
        const qty = Math.max(1, parseInt(i.qty, 10) || 1);
        subtotal += Number(p.price) * qty;
        return { id: p.id, name: p.name, price: Number(p.price), qty, size: i.size || '', color: i.color || '' };
      })
      .filter(Boolean);
    if (orderItems.length === 0 || subtotal <= 0) return res.status(400).json({ error: 'طلب غير صالح.' });

    const deliveryFee = Math.max(0, Number(customer?.deliveryFee) || 0);

    // كوبون الخصم (إن وُجد): نتحقّق منه من قاعدة البيانات ونحسب الخصم على المجموع الفرعي
    const couponCode = String(req.body?.coupon?.code || customer?.couponCode || '').trim().toUpperCase();
    let discount = 0;
    let appliedCoupon = '';
    if (couponCode) {
      const cr = await query('SELECT * FROM coupons WHERE store_id = $1 AND code = $2', [storeId, couponCode]);
      const ev = evaluateCoupon(cr.rows[0], subtotal);
      if (ev.ok) { discount = ev.discount; appliedCoupon = cr.rows[0].code; }
    }

    const total = Math.max(0, subtotal - discount) + deliveryFee;
    const reference = 'BZ-' + crypto.randomBytes(5).toString('hex').toUpperCase();

    const ins = await query(
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total, currency, status, reference, city, address, notes, delivery_fee, coupon_code, discount)
       VALUES ($1, $2, '', $3, $4, $5, 'ILS', 'new', $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [storeId, name, phone, JSON.stringify(orderItems), total, reference,
        (customer?.city || '').trim(), (customer?.address || '').trim(), (customer?.notes || '').trim().slice(0, 500), deliveryFee,
        appliedCoupon, discount]
    );

    // نخصم المخزون ونرفع عدّاد استخدام الكوبون (بالخلفية — لا نُفشل الطلب لو تعثّر أحدها)
    decrementStock(orderItems).catch((e) => console.error('decrementStock:', e.message));
    if (appliedCoupon) {
      query('UPDATE coupons SET used_count = used_count + 1 WHERE store_id = $1 AND code = $2', [storeId, appliedCoupon])
        .catch((e) => console.error('coupon usedCount:', e.message));
    }

    res.status(201).json({ orderId: ins.rows[0].id, reference, discount, total });
  } catch (err) {
    next(err);
  }
}

// تحديث حالة الطلب (صاحب المتجر فقط)
const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
export async function updateOrderStatus(req, res, next) {
  const { id } = req.params;
  const status = (req.body.status || '').trim();
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة.' });
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('UPDATE orders SET status = $1 WHERE id = $2 AND store_id = $3 RETURNING id', [status, id, store.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود.' });
    res.json({ ok: true, status });
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
      `SELECT id, customer_name, customer_phone, items, total, currency, status, created_at,
              city, address, notes, delivery_fee, coupon_code, discount
       FROM orders WHERE store_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [store.id]
    );
    res.json({
      orders: r.rows.map((o) => ({
        id: o.id,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        items: o.items,
        total: Number(o.total),
        deliveryFee: Number(o.delivery_fee || 0),
        couponCode: o.coupon_code || '',
        discount: Number(o.discount || 0),
        currency: o.currency,
        status: o.status,
        city: o.city || '',
        address: o.address || '',
        notes: o.notes || '',
        createdAt: o.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

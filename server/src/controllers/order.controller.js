import crypto from 'crypto';
import { query, withTransaction } from '../config/db.js';
import { isLahzaConfigured, initializeTransaction, verifyTransaction, PAY_CURRENCY } from '../config/lahza.js';
import { evaluateCoupon } from './coupon.controller.js';
import { clearAbandoned } from './abandoned.controller.js';
import { sendMail, isMailConfigured } from '../utils/mail.js';
import { sendPushToUser } from '../config/push.js';
import { sendNativeToUser } from '../config/nativePush.js';

// إشعار صاحب المتجر (بريد + إشعار دفع على الجوال) عند وصول طلب جديد — بالخلفية
async function notifyOwnerNewOrder(storeId, info) {
  try {
    const r = await query(
      'SELECT u.id AS user_id, u.email, s.name AS store_name FROM stores s JOIN users u ON u.id = s.user_id WHERE s.id = $1',
      [storeId]
    );
    const row = r.rows[0];
    if (!row) return;

    // إشعار دفع على الجوال — للويب/PWA (VAPID) وللتطبيق الأصلي (APNs) معاً
    const pushPayload = {
      title: `🛍️ طلب جديد — ${row.store_name}`,
      body: `${info.name} · ₪${Number(info.total).toFixed(2)}`,
      url: '/dashboard?tab=myOrders',
    };
    sendPushToUser(row.user_id, pushPayload);
    sendNativeToUser(row.user_id, pushPayload);

    if (!isMailConfigured() || !row.email) return;
    const rows = (info.items || [])
      .map((i) => `<li>${i.name}${i.color ? ` - ${i.color}` : ''}${i.size ? ` (${i.size})` : ''} ×${i.qty} — ₪${(i.price * i.qty).toFixed(2)}</li>`)
      .join('');
    const html = `
      <div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#2b2b2b">
        <h2 style="color:#5e4636">🛍️ طلب جديد في متجرك ${row.store_name}</h2>
        <p><b>الزبون:</b> ${info.name} — <span dir="ltr">${info.phone}</span></p>
        ${info.city ? `<p><b>المدينة:</b> ${info.city}</p>` : ''}
        <ul>${rows}</ul>
        <p style="font-size:18px"><b>الإجمالي: ₪${Number(info.total).toFixed(2)}</b></p>
        <p style="color:#8a6a4f">ادخلي لوحة التحكم → الطلبات لتأكيد الطلب ومتابعته.</p>
      </div>`;
    await sendMail({ to: row.email, subject: `🛍️ طلب جديد — ${row.store_name}`, html });
  } catch (err) {
    console.error('notifyOwnerNewOrder:', err.message);
  }
}

// يخصم الكمية المطلوبة من مخزون المنتج العام ومن مخزون المقاس/اللون (إن وُجد) — لا يقل عن صفر
async function decrementStock(orderItems, q = query) {
  for (const it of orderItems) {
    const qty = it.qty;
    // عدّاد المبيعات الحقيقي — يزيد عند تأكيد الطلب (دليل اجتماعي للزبائن)
    await q('UPDATE products SET sold_count = sold_count + $2 WHERE id = $1', [it.id, qty]);
    // المخزون العام (NULL = متوفّر دائماً → لا يُلمس)
    await q('UPDATE products SET stock = GREATEST(0, stock - $2) WHERE id = $1 AND stock IS NOT NULL', [it.id, qty]);
    // مخزون المقاس المجمّع (نمرة) إن كان المنتج يتتبّع كميات لكل مقاس
    if (it.size) {
      await q(
        `UPDATE products
         SET size_stock = jsonb_set(size_stock, ARRAY[$2::text], to_jsonb(GREATEST(0, COALESCE((size_stock->>$2)::int, 0) - $3)))
         WHERE id = $1 AND size_stock ? $2`,
        [it.id, it.size, qty]
      );
    }
    // مخزون اللون ثم النمرة إن كان المنتج يتتبّع المخزون لكل لون
    if (it.color && it.size) {
      await q(
        `UPDATE products
         SET color_stock = jsonb_set(color_stock, ARRAY[$2::text, $3::text], to_jsonb(GREATEST(0, COALESCE((color_stock->$2->>$3)::int, 0) - $4)))
         WHERE id = $1 AND color_stock ? $2 AND (color_stock->$2) ? $3`,
        [it.id, it.color, it.size, qty]
      );
    }
  }
}

// يعيد الكميات للمخزون (عند إلغاء طلب سبق أن خُصم)
async function restoreStock(orderItems, q = query) {
  for (const it of orderItems || []) {
    const qty = it.qty;
    // إرجاع/إلغاء طلب مؤكّد → نخفّض عدّاد المبيعات بنفس الكمية
    await q('UPDATE products SET sold_count = GREATEST(0, sold_count - $2) WHERE id = $1', [it.id, qty]);
    await q('UPDATE products SET stock = stock + $2 WHERE id = $1 AND stock IS NOT NULL', [it.id, qty]);
    if (it.size) {
      await q(
        `UPDATE products
         SET size_stock = jsonb_set(size_stock, ARRAY[$2::text], to_jsonb(COALESCE((size_stock->>$2)::int, 0) + $3))
         WHERE id = $1 AND size_stock ? $2`,
        [it.id, it.size, qty]
      );
    }
    if (it.color && it.size) {
      await q(
        `UPDATE products
         SET color_stock = jsonb_set(color_stock, ARRAY[$2::text, $3::text], to_jsonb(COALESCE((color_stock->$2->>$3)::int, 0) + $4))
         WHERE id = $1 AND color_stock ? $2 AND (color_stock->$2) ? $3`,
        [it.id, it.color, it.size, qty]
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

    // خصم الإحالة (فقط إن لم يُطبَّق كوبون — لا نجمع خصمين): يُحسب على الخادم من نسبة المتجر
    let referralCode = '';
    if (!appliedCoupon) {
      const refIn = String(req.body?.referralCode || '').trim().toUpperCase().slice(0, 20);
      if (refIn) {
        const sr = await query('SELECT referral_percent FROM stores WHERE id = $1', [storeId]);
        const percent = Number(sr.rows[0]?.referral_percent || 0);
        if (percent > 0) {
          const rf = await query('SELECT code FROM referrals WHERE store_id = $1 AND code = $2', [storeId, refIn]);
          if (rf.rows.length) {
            discount = Math.min(subtotal, Math.round((subtotal * percent) / 100 * 100) / 100);
            referralCode = rf.rows[0].code;
          }
        }
      }
    }

    // خصم الولاء (أدنى أولوية — لا يُجمع مع كوبون/إحالة): كل N طلبات مؤكّدة
    // لنفس الرقم بهذا المتجر → خصم % على هذا الطلب. الخادم هو الحكم (لا نثق بالواجهة).
    if (!appliedCoupon && !referralCode) {
      const ls = await query('SELECT loyalty_every, loyalty_percent FROM stores WHERE id = $1', [storeId]);
      const every = Number(ls.rows[0]?.loyalty_every || 0);
      const percent = Number(ls.rows[0]?.loyalty_percent || 0);
      const last9 = phone.replace(/\D/g, '').slice(-9);
      if (every >= 2 && percent > 0 && last9.length === 9) {
        const cr = await query(
          `SELECT COUNT(*)::int AS n FROM orders
           WHERE store_id = $1 AND status IN ('confirmed','shipped','delivered')
             AND regexp_replace(customer_phone, '\\D', '', 'g') LIKE $2`,
          [storeId, '%' + last9]
        );
        const n = cr.rows[0].n;
        if (n > 0 && n % every === 0) {
          discount = Math.min(subtotal, Math.round((subtotal * percent) / 100 * 100) / 100);
        }
      }
    }

    const total = Math.max(0, subtotal - discount) + deliveryFee;
    const reference = 'BZ-' + crypto.randomBytes(5).toString('hex').toUpperCase();

    const ins = await query(
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total, currency, status, reference, city, address, notes, delivery_fee, coupon_code, discount, referral_code)
       VALUES ($1, $2, '', $3, $4, $5, 'ILS', 'new', $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [storeId, name, phone, JSON.stringify(orderItems), total, reference,
        (customer?.city || '').trim(), (customer?.address || '').trim(), (customer?.notes || '').trim().slice(0, 500), deliveryFee,
        appliedCoupon, discount, referralCode]
    );

    // ملاحظة: لا نخصم المخزون ولا نرفع عدّاد الكوبون عند الإنشاء —
    // يتمّ ذلك عند تأكيد صاحب المتجر للطلب، ويُعاد عند الإلغاء (تحكّم أدق).

    res.status(201).json({ orderId: ins.rows[0].id, reference, discount, total });

    // الطلب اكتمل فعلياً → نحذف مسودته من "الطلبات غير المكتملة" (بالخلفية)
    clearAbandoned(storeId, phone);

    // إشعار صاحب المتجر بالبريد (بالخلفية)
    notifyOwnerNewOrder(storeId, { name, phone, city: (customer?.city || '').trim(), items: orderItems, total })
      .catch((e) => console.error('notify:', e.message));
  } catch (err) {
    next(err);
  }
}

// تحديث حالة الطلب (صاحب المتجر فقط)
const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
// الحالات التي تعني أن الطلب مؤكّد ويجب خصم مخزونه
const APPLY_STATUSES = ['confirmed', 'shipped', 'delivered'];
// يطبّق حالة على طلب (مع خصم/إعادة المخزون وعدّاد الكوبون/الإحالة ذرّياً).
// مُصدَّرة ليعيد استخدامها تكامل أوبتيموس (يحوّل الطلب لـ"تم الشحن" تلقائياً عند الإرسال).
export async function applyOrderStatus(storeId, id, status) {
  const cur = await query(
    'SELECT items, status, stock_applied, coupon_code, referral_code FROM orders WHERE id = $1 AND store_id = $2',
    [id, storeId]
  );
  const order = cur.rows[0];
  if (!order) return { ok: false, code: 404 };

  const shouldApply = APPLY_STATUSES.includes(status);
  // الطلب يُعتبر "مخصوماً" إن كان العلم مضبوطاً، أو كانت حالته الحالية مؤكّدة
  const wasApplied = order.stock_applied || APPLY_STATUSES.includes(order.status);
  let stockApplied = wasApplied;
  if (shouldApply && !wasApplied) stockApplied = true;
  else if (!shouldApply && wasApplied) stockApplied = false;

  // تغيير المخزون والكوبون/الإحالة وحالة الطلب داخل معاملة واحدة (ذرّية)
  await withTransaction(async (q) => {
    if (shouldApply && !wasApplied) {
      await decrementStock(order.items, q);
      if (order.coupon_code) {
        await q('UPDATE coupons SET used_count = used_count + 1 WHERE store_id = $1 AND code = $2', [storeId, order.coupon_code]);
      }
      if (order.referral_code) {
        await q('UPDATE referrals SET uses = uses + 1 WHERE store_id = $1 AND code = $2', [storeId, order.referral_code]);
      }
    } else if (!shouldApply && wasApplied) {
      await restoreStock(order.items, q);
      if (order.coupon_code) {
        await q('UPDATE coupons SET used_count = GREATEST(0, used_count - 1) WHERE store_id = $1 AND code = $2', [storeId, order.coupon_code]);
      }
      if (order.referral_code) {
        await q('UPDATE referrals SET uses = GREATEST(0, uses - 1) WHERE store_id = $1 AND code = $2', [storeId, order.referral_code]);
      }
    }
    await q('UPDATE orders SET status = $1, stock_applied = $2 WHERE id = $3 AND store_id = $4', [status, stockApplied, id, storeId]);
  });
  return { ok: true, status };
}

export async function updateOrderStatus(req, res, next) {
  const { id } = req.params;
  const status = (req.body.status || '').trim();
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة.' });
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await applyOrderStatus(store.id, id, status);
    if (!r.ok) return res.status(r.code || 400).json({ error: 'الطلب غير موجود.' });
    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
}

// عدد الطلبات الجديدة (غير المؤكّدة) — للشارة في التطبيق
export async function getNewOrdersCount(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.json({ count: 0 });
    const r = await query("SELECT COUNT(*)::int AS c FROM orders WHERE store_id = $1 AND status = 'new'", [store.id]);
    res.json({ count: r.rows[0].c });
  } catch (err) {
    next(err);
  }
}

// إحصائيات متجر المشترك (مبيعات/طلبات/أكثر المنتجات/نشاط آخر 7 أيام)
export async function getStats(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const sid = store.id;
    const PAID = "status IN ('confirmed','shipped','delivered')"; // الطلبات المؤكّدة = مبيعات فعلية

    const totals = await query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COUNT(*) FILTER (WHERE status='new')::int AS new_orders,
         COUNT(*) FILTER (WHERE ${PAID})::int AS confirmed_orders,
         COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled_orders,
         COALESCE(SUM(total) FILTER (WHERE ${PAID}), 0) AS revenue
       FROM orders WHERE store_id = $1`,
      [sid]
    );

    const top = await query(
      `SELECT it->>'name' AS name, SUM((it->>'qty')::int)::int AS qty
       FROM orders o, jsonb_array_elements(o.items) it
       WHERE o.store_id = $1 AND o.${PAID}
       GROUP BY it->>'name' ORDER BY qty DESC LIMIT 5`,
      [sid]
    );

    const daily = await query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(c.orders, 0)::int AS orders
       FROM generate_series((now() - interval '6 days')::date, now()::date, '1 day') d
       LEFT JOIN (
         SELECT created_at::date AS day, COUNT(*) AS orders
         FROM orders WHERE store_id = $1 AND created_at >= (now() - interval '6 days')::date
         GROUP BY created_at::date
       ) c ON c.day = d::date
       ORDER BY day`,
      [sid]
    );

    const prod = await query('SELECT COUNT(*)::int AS c FROM products WHERE store_id = $1', [sid]);
    const visitsRow = await query('SELECT COALESCE(views, 0)::int AS v FROM stores WHERE id = $1', [sid]);

    // المنتجات قاربة النفاد (المتبقّي ≤ 3) — تنبيه للمالكة لإعادة التوفير قبل انتهائها.
    // نحسب المتبقّي: المخزون العام إن وُجد، وإلا مجموع كميات اللون/المقاس. (NULL = غير محدود → نتجاهله)
    const LOW = 3;
    const stockRows = await query(
      'SELECT id, name, stock, size_stock, color_stock FROM products WHERE store_id = $1',
      [sid]
    );
    const sumObj = (o) => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const lowStock = stockRows.rows
      .map((p) => {
        let remaining = null;
        if (p.stock !== null && p.stock !== undefined) remaining = Number(p.stock);
        else {
          const cs = p.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
          const ss = p.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
          if (Object.keys(cs).length) remaining = Object.values(cs).reduce((sum, sizes) => sum + sumObj(sizes), 0);
          else if (Object.keys(ss).length) remaining = sumObj(ss);
        }
        return { id: p.id, name: p.name, remaining };
      })
      .filter((p) => p.remaining !== null && p.remaining <= LOW)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 12);

    // تقرير التحصيل الشهري حسب شركة التوصيل: الطلبات المسلّمة هذا الشهر (عدد + مجموع
    // شامل التوصيل) لكل شركة — لمطابقة المبالغ التي تحوّلها كل شركة لصاحب المتجر.
    const courier = await query(
      `SELECT CASE
           WHEN opost_tracking <> '' THEN 'optimus'
           WHEN eps_barcode <> '' THEN 'eps'
           WHEN gobox_barcode <> '' THEN 'gobox'
           ELSE 'none' END AS courier,
         COUNT(*)::int AS orders,
         COALESCE(SUM(total), 0) AS amount
       FROM orders
       WHERE store_id = $1 AND status = 'delivered'
         AND created_at >= date_trunc('month', now())
       GROUP BY 1 ORDER BY amount DESC`,
      [sid]
    );

    const t = totals.rows[0];
    res.json({
      revenue: Number(t.revenue),
      totalOrders: t.total_orders,
      newOrders: t.new_orders,
      confirmedOrders: t.confirmed_orders,
      cancelledOrders: t.cancelled_orders,
      productsCount: prod.rows[0].c,
      visitors: visitsRow.rows[0]?.v || 0,
      topProducts: top.rows.map((r) => ({ name: r.name, qty: r.qty })),
      daily: daily.rows.map((r) => ({ day: r.day, orders: r.orders })),
      lowStock,
      courierMonth: courier.rows.map((r) => ({ courier: r.courier, orders: r.orders, amount: Number(r.amount) })),
    });
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
              city, address, notes, delivery_fee, coupon_code, discount,
              opost_tracking, opost_status, eps_barcode, eps_status, gobox_barcode, gobox_status
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
        opostTracking: o.opost_tracking || '',
        opostStatus: o.opost_status || '',
        epsTracking: o.eps_barcode || '',
        epsStatus: o.eps_status || '',
        goboxTracking: o.gobox_barcode || '',
        goboxStatus: o.gobox_status || '',
        createdAt: o.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

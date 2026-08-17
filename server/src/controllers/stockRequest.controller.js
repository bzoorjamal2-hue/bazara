import crypto from 'crypto';
import { query } from '../config/db.js';
import { notifyStoreOwner } from '../utils/notify.js';

async function getUserStore(userId) {
  const r = await query('SELECT id FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

// الزبون يطلب تنبيهاً عند توفّر منتج/نمرة نفدت (عام)
export async function createStockRequest(req, res, next) {
  const productId = String(req.body.productId || '').trim();
  const phone = String(req.body.phone || '').replace(/[^\d+]/g, '');
  const color = String(req.body.color || '').trim().slice(0, 50);
  const size = String(req.body.size || '').trim().slice(0, 20);
  // بيانات الزبونة الكاملة (كأنه طلب عادي) — يعرفها المتجر ويحوّلها بضغطة
  const name = String(req.body.name || '').trim().slice(0, 100);
  const city = String(req.body.city || '').trim().slice(0, 80);
  const address = String(req.body.address || '').trim().slice(0, 300);
  if (!productId || phone.replace(/\D/g, '').length < 6) {
    return res.status(400).json({ error: 'بيانات ناقصة.' });
  }
  try {
    const p = await query('SELECT id, store_id, name FROM products WHERE id = $1', [productId]);
    const product = p.rows[0];
    if (!product) return res.status(404).json({ error: 'المنتج غير موجود.' });

    // تفادي التكرار: نفس الرقم لنفس المنتج/اللون/النمرة — نحدّث بياناتها إن أُعيد الطلب
    const dup = await query(
      'SELECT id FROM stock_requests WHERE product_id = $1 AND phone = $2 AND color = $3 AND size = $4',
      [productId, phone, color, size]
    );
    if (dup.rows.length) {
      await query(
        'UPDATE stock_requests SET customer_name = $1, city = $2, address = $3 WHERE id = $4',
        [name, city, address, dup.rows[0].id]
      );
      return res.json({ ok: true });
    }

    await query(
      'INSERT INTO stock_requests (store_id, product_id, product_name, color, size, phone, customer_name, city, address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [product.store_id, productId, product.name, color, size, phone, name, city, address]
    );
    res.status(201).json({ ok: true });

    // إشعار المالك بطلب توفّر جديد (بالخلفية)
    const variant = [color, size].filter(Boolean).join(' - ');
    const who = name ? `${name} — ${phone}` : phone;
    notifyStoreOwner(product.store_id, {
      title: `🔔 طلب توفّر — ${product.name}`,
      body: `${who} ينتظر توفّر${variant ? ` (${variant})` : ''}`,
      url: '/dashboard?tab=stockRequests',
    });
  } catch (err) {
    next(err);
  }
}

// قائمة طلبات التوفّر لمتجر المشترك
// هل المتغيّر المطلوب (لون/نمرة) متوفّر الآن؟ نطابق منطق صفحة المنتج للزبون.
export function variantInStock(p, color, size) {
  if (!p) return false; // المنتج محذوف
  const sizeStock = p.size_stock && typeof p.size_stock === 'object' ? p.size_stock : {};
  const colorStock = p.color_stock && typeof p.color_stock === 'object' ? p.color_stock : {};
  const hasColorStock = Object.keys(colorStock).length > 0;
  if (color && size && hasColorStock) {
    const q = colorStock?.[color]?.[size];
    if (typeof q === 'number') return q > 0;
  }
  if (size) {
    const q = sizeStock?.[size];
    if (typeof q === 'number') return q > 0;
  }
  if (p.stock === null || p.stock === undefined) return true; // مخزون عام غير محدود
  return Number(p.stock) > 0;
}

// طلب مُحوَّل → نفس شكل طلبات صفحة الطلبات (حتى تعمل عليه نفس أزرار شركات التوصيل)
const ORDER_FIELDS = [
  'id AS o_id', 'customer_name', 'customer_phone', 'items', 'total', 'delivery_fee',
  'status', 'city', 'address', 'notes', 'created_at AS o_created_at',
  'opost_tracking', 'opost_status', 'eps_barcode', 'eps_status', 'gobox_barcode', 'gobox_status',
];
// نفس الأعمدة بصيغتين: مع بادئة الجدول للـ JOIN، وبلا بادئة لـ RETURNING
const orderCols = (prefix = '') => ORDER_FIELDS.map((f) => prefix + f).join(', ');
function mapOrder(x) {
  if (!x || !x.o_id) return null;
  return {
    id: x.o_id,
    customerName: x.customer_name || '',
    customerPhone: x.customer_phone || '',
    items: x.items || [],
    total: Number(x.total || 0),
    deliveryFee: Number(x.delivery_fee || 0),
    status: x.status,
    city: x.city || '',
    address: x.address || '',
    notes: x.notes || '',
    opostTracking: x.opost_tracking || '',
    opostStatus: x.opost_status || '',
    epsTracking: x.eps_barcode || '',
    epsStatus: x.eps_status || '',
    goboxTracking: x.gobox_barcode || '',
    goboxStatus: x.gobox_status || '',
    createdAt: x.o_created_at,
  };
}

// قائمة طلبات التوفّر لمتجر المشترك — مع تمييز ما رجع للمخزون فعلاً (inStock)
// وصورة/سعر المنتج، والطلب المُحوَّل إن وُجد (لإدارته وشحنه من نفس الصفحة)
export async function listMyStockRequests(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query(
      `SELECT sr.id, sr.product_id, sr.product_name, sr.color, sr.size, sr.phone, sr.created_at,
              sr.customer_name, sr.city, sr.address,
              p.stock, p.size_stock, p.color_stock, p.price, p.image_url, p.images,
              ${orderCols('o.')}
       FROM stock_requests sr
       LEFT JOIN products p ON p.id = sr.product_id
       LEFT JOIN orders o ON o.id = sr.order_id
       WHERE sr.store_id = $1 ORDER BY sr.created_at DESC LIMIT 300`,
      [store.id]
    );
    const mapped = r.rows.map((x) => ({
      id: x.id,
      productId: x.product_id,
      productName: x.product_name,
      productImage: x.image_url || (Array.isArray(x.images) ? x.images[0] : '') || '',
      price: x.price != null ? Number(x.price) : null,
      color: x.color || '',
      size: x.size || '',
      phone: x.phone,
      customerName: x.customer_name || '',
      city: x.city || '',
      address: x.address || '',
      createdAt: x.created_at,
      inStock: variantInStock(x, x.color, x.size), // رجع متوفّراً → نبّهي الزبونة
      order: mapOrder(x), // حُوّل لطلب حقيقي؟ نرجّعه كاملاً بحالته وشحنته
    }));
    // غير المحوّلة أولاً، والمتوفّر الآن قبل النافد (الأهم للمالكة)، ثم الأحدث
    mapped.sort((a, b) =>
      (!!a.order - !!b.order) || (b.inStock - a.inStock) || (new Date(b.createdAt) - new Date(a.createdAt))
    );
    res.json({ requests: mapped });
  } catch (err) {
    next(err);
  }
}

// تحويل طلب توفّر إلى طلب حقيقي بالمتجر — يصبح له حالة، ويُرسَل لشركة التوصيل
// (أوبتيموس/EPS/gobox) بنفس أزرار صفحة الطلبات، ويظهر أيضاً ضمن الطلبات والإحصائيات.
export async function convertStockRequest(req, res, next) {
  const { id } = req.params;
  const notes = String(req.body.notes || '').trim().slice(0, 500);
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  const deliveryFee = Math.max(0, Number(req.body.deliveryFee) || 0);
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const r = await query(
      `SELECT sr.*, p.price AS product_price, p.name AS current_name
       FROM stock_requests sr LEFT JOIN products p ON p.id = sr.product_id
       WHERE sr.id = $1 AND sr.store_id = $2`,
      [id, store.id]
    );
    const sr = r.rows[0];
    if (!sr) return res.status(404).json({ error: 'الطلب غير موجود.' });

    // بيانات التوصيل: ما أدخله المتجر إن عدّل، وإلا ما تركته الزبونة عند الطلب
    const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const name = (has(req.body.name) ? String(req.body.name) : (sr.customer_name || '')).trim().slice(0, 100);
    const city = (has(req.body.city) ? String(req.body.city) : (sr.city || '')).trim().slice(0, 80);
    const address = (has(req.body.address) ? String(req.body.address) : (sr.address || '')).trim().slice(0, 300);
    if (!name) return res.status(400).json({ error: 'اسم الزبونة مطلوب.' });

    // حُوّل سابقاً → نُرجع الطلب نفسه بلا إنشاء نسخة ثانية (نقرة مكرّرة/إنترنت متقطّع)
    if (sr.order_id) {
      const ex = await query(`SELECT ${orderCols('o.')} FROM orders o WHERE o.id = $1`, [sr.order_id]);
      if (ex.rows[0]) return res.json({ order: mapOrder(ex.rows[0]), already: true });
    }

    const price = req.body.price !== undefined && req.body.price !== ''
      ? Math.max(0, Number(req.body.price) || 0)
      : Number(sr.product_price || 0);
    const items = [{
      id: sr.product_id,
      name: sr.product_name || sr.current_name || '',
      price,
      qty,
      size: sr.size || '',
      color: sr.color || '',
    }];
    const total = price * qty + deliveryFee;
    const reference = 'BZ-' + crypto.randomBytes(5).toString('hex').toUpperCase();

    const ins = await query(
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total, currency, status, reference, city, address, notes, delivery_fee, coupon_code, discount)
       VALUES ($1, $2, '', $3, $4, $5, 'ILS', 'new', $6, $7, $8, $9, $10, '', 0)
       RETURNING ${orderCols()}`,
      [store.id, name, sr.phone, JSON.stringify(items), total, reference, city, address, notes, deliveryFee]
    );
    const order = mapOrder(ins.rows[0]);
    await query('UPDATE stock_requests SET order_id = $1 WHERE id = $2', [order.id, id]);
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

// تنبيه استباقي للمالكة عند إعادة تخزين منتج: لو صار متغيّرٌ (لون/مقاس) تنتظره
// زبونة متوفّراً، نُشعرها مرة واحدة (restocked_at) بعدد المنتظِرات لتبلّغهن بضغطة واتساب
// (الأزرار جاهزة بتبويب طلبات التوفّر). يُستدعى بالخلفية بعد تعديل المنتج — لا يفشل الحفظ.
export async function alertOwnerOnRestock(productId) {
  try {
    if (!productId) return;
    const pr = await query(
      'SELECT id, store_id, name, stock, size_stock, color_stock FROM products WHERE id = $1',
      [productId]
    );
    const p = pr.rows[0];
    if (!p) return;
    const rr = await query(
      'SELECT id, color, size FROM stock_requests WHERE product_id = $1 AND order_id IS NULL AND restocked_at IS NULL',
      [productId]
    );
    const back = rr.rows.filter((r) => variantInStock(p, r.color, r.size));
    if (!back.length) return;
    await query('UPDATE stock_requests SET restocked_at = now() WHERE id = ANY($1::uuid[])', [back.map((r) => r.id)]);
    const n = back.length;
    await notifyStoreOwner(p.store_id, {
      title: 'رجع متوفّر 🎉',
      body: `${p.name} — ${n === 1 ? 'زبونة واحدة تنتظره' : `${n} زبونات ينتظرنه`}. بلّغيهنّ الآن.`,
      url: '/dashboard?tab=stockRequests',
    });
  } catch (e) {
    console.error('alertOwnerOnRestock:', e.message);
  }
}

export async function deleteStockRequest(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('DELETE FROM stock_requests WHERE id = $1 AND store_id = $2 RETURNING id', [id, store.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'الطلب غير موجود.' });
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
}

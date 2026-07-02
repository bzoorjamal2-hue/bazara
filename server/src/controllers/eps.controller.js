import { query } from '../config/db.js';
import { applyOrderStatus } from './order.controller.js';
import { sendPushToUser } from '../config/push.js';
import { sendNativeToUser } from '../config/nativePush.js';
import { encrypt, decrypt } from '../config/opost.js';
import {
  fetchEpsCities,
  createEpsShipment,
  getEpsPackageStatus,
  getEpsAwb,
  epsStatusLabelAr,
  epsToBazaraStatus,
  EPS_TERMINAL,
} from '../config/eps.js';

async function getUserStoreRow(userId) {
  const r = await query(
    `SELECT id, user_id, name, phone, whatsapp,
            eps_email, eps_password, eps_city, eps_address, eps_connected
     FROM stores WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0] || null;
}

// ───────── GET /api/eps/status — حالة الربط (بلا كلمة سر) ─────────
export async function epsStatus(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    res.json({
      connected: Boolean(store.eps_connected),
      email: store.eps_email || '',
      city: store.eps_city || '',
      address: store.eps_address || '',
    });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/eps/connect — ربط حساب EPS للمتجر ─────────
// لا يوجد مسار تسجيل دخول لدى LogesTechs للتحقّق المسبق — البيانات تُستخدم مع كل
// إنشاء شحنة، لذا نخزّنها مشفّرة ويظهر أي خطأ اعتماد عند أول إرسال.
export async function epsConnect(req, res, next) {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const cityId = String(req.body.city || '');
  const address = String(req.body.address || '').trim().slice(0, 300);
  if (!email || !password) return res.status(400).json({ error: 'البريد وكلمة السر مطلوبان.' });
  if (!cityId || !address) return res.status(400).json({ error: 'اختر مدينة الاستلام واكتب عنوان الاستلام.' });

  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    await query(
      `UPDATE stores SET eps_email = $1, eps_password = $2, eps_city = $3, eps_address = $4,
         eps_connected = true WHERE id = $5`,
      [email, encrypt(password), cityId, address, store.id]
    );
    res.json({ connected: true, email, city: cityId, address });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/eps/disconnect — فصل الحساب ─────────
export async function epsDisconnect(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    await query(
      `UPDATE stores SET eps_connected = false, eps_email = '', eps_password = '',
         eps_city = '', eps_address = '' WHERE id = $1`,
      [store.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ───────── PUT /api/eps/origin — تعديل مدينة/عنوان الاستلام ─────────
export async function epsSetOrigin(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const cityId = String(req.body.city || store.eps_city || '');
    const address = String(req.body.address ?? store.eps_address ?? '').trim().slice(0, 300);
    await query('UPDATE stores SET eps_city = $1, eps_address = $2 WHERE id = $3', [cityId, address, store.id]);
    res.json({ ok: true, city: cityId, address });
  } catch (err) {
    next(err);
  }
}

// ───────── GET /api/eps/cities ─────────
export async function epsCities(_req, res, next) {
  try {
    res.json({ cities: await fetchEpsCities() });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/eps/orders/:id/send — إنشاء شحنة EPS من طلب ─────────
export async function epsSendOrder(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    if (!store.eps_connected) return res.status(400).json({ error: 'اربط حساب EPS أولاً من إعدادات المتجر.' });

    const orderRes = await query(
      `SELECT id, customer_name, customer_phone, items, total, city, address, notes, eps_barcode
       FROM orders WHERE id = $1 AND store_id = $2`,
      [id, store.id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود.' });
    if (order.eps_barcode) {
      return res.status(400).json({ error: 'هذا الطلب أُرسل مسبقاً لـ EPS.', tracking: order.eps_barcode });
    }

    const cityId = String(req.body.city || '');
    if (!cityId) return res.status(400).json({ error: 'اختر مدينة الزبون.' });

    const password = decrypt(store.eps_password);
    if (!store.eps_email || !password) return res.status(400).json({ error: 'اربط حساب EPS أولاً من إعدادات المتجر.' });

    const items = Array.isArray(order.items) ? order.items : [];
    const quantity = items.reduce((s, it) => s + (parseInt(it.qty, 10) || 1), 0) || 1;
    const itemsDescription = items
      .map((it) => `${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`)
      .join(' | ')
      .slice(0, 500);

    const payload = {
      email: store.eps_email,
      password,
      pkgUnitType: 'METRIC',
      pkg: {
        cod: Number(order.total || 0), // شامل التوصيل حسب توثيق LogesTechs
        notes: (order.notes || '').slice(0, 500),
        invoiceNumber: order.id, // ربط الشحنة برقم طلب بازارا (يرجع في الـ webhook)
        senderName: store.name || '',
        businessSenderName: store.name || '',
        senderPhone: store.phone || store.whatsapp || '',
        receiverName: order.customer_name || '',
        receiverPhone: order.customer_phone || '',
        quantity,
        description: itemsDescription,
        serviceTypeId: 1,
        vehicleTypeId: 0,
        shipmentType: 'COD',
      },
      destinationAddress: {
        // العنوان التفصيلي = ما كتبه الزبون (مدينته ثم عنوانه) كما هو
        addressLine1: [order.city, order.address].map((x) => (x || '').trim()).filter(Boolean).join(' - ') || '-',
        cityId: Number(cityId),
      },
      originAddress: {
        addressLine1: store.eps_address || '-',
        cityId: Number(store.eps_city),
      },
    };

    let resp;
    try {
      resp = await createEpsShipment(payload);
    } catch (e) {
      const details = e.body?.errors
        ? Object.values(e.body.errors).flat().join(' • ')
        : (e.body?.error || e.body?.message || e.message);
      return res.status(400).json({ error: `EPS: ${details}` });
    }

    const epsId = resp?.id != null ? String(resp.id) : '';
    const barcode = String(resp?.barcode || '') || epsId;
    await query(
      `UPDATE orders SET eps_id = $1, eps_barcode = $2, eps_status = $3, eps_sent_at = now() WHERE id = $4`,
      [epsId, barcode, 'PENDING_CUSTOMER_CARE_APPROVAL', order.id]
    );

    // الطلب الآن بعهدة EPS → "تم الشحن" تلقائياً (يخصم المخزون إن لم يُخصم)
    try { await applyOrderStatus(store.id, order.id, 'shipped'); } catch (e) { console.error('eps auto-status:', e.message); }

    res.json({ ok: true, tracking: barcode, id: epsId });
  } catch (err) {
    next(err);
  }
}

// ───────── GET /api/eps/orders/:id/awb — رابط بوليصة الشحن PDF ─────────
export async function epsOrderAwb(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('SELECT eps_barcode FROM orders WHERE id = $1 AND store_id = $2', [id, store.id]);
    const barcode = r.rows[0]?.eps_barcode;
    if (!barcode) return res.status(404).json({ error: 'الطلب غير مُرسل لـ EPS.' });
    const url = await getEpsAwb([barcode]);
    if (!url) return res.status(502).json({ error: 'تعذّر جلب البوليصة من EPS.' });
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

// يطبّق حالة EPS جديدة على طلب: يحفظها، يعكسها على حالة بازارا، ويُشعر المالك.
async function applyEpsStatus(order, status, { notes = '' } = {}) {
  if (!status || status === order.eps_status) return false;
  await query('UPDATE orders SET eps_status = $1 WHERE id = $2', [status, order.id]);
  const bz = epsToBazaraStatus(status);
  if (bz) await applyOrderStatus(order.store_id, order.id, bz).catch(() => {});
  const payload = {
    title: `🚚 تحديث شحنة EPS — ${order.store_name}`,
    body: `${order.customer_name || 'طلب'}: ${epsStatusLabelAr(status)}${notes ? ` — ${notes}` : ''}`,
    url: '/dashboard?tab=myOrders',
  };
  sendPushToUser(order.store_user_id, payload);
  sendNativeToUser(order.store_user_id, payload);
  return true;
}

// ───────── POST /api/eps/webhook — تحديثات الحالة من LogesTechs (بلا CSRF/توثيق) ─────────
// الجسم: { packageId, newStatus, barcode, cod, invoiceNumber, time, notes, postponedDate }
// نطابق الطلب بالباركود (والـ invoiceNumber احتياطاً) — لا يُنفَّذ شيء إن لم يطابق شيئاً.
export async function epsWebhook(req, res) {
  try {
    const b = req.body || {};
    const status = String(b.newStatus || b.status || '').trim();
    const barcode = String(b.barcode || b.packageBarcode || '').trim();
    const invoice = String(b.invoiceNumber || '').trim();
    if (!status || (!barcode && !invoice)) return res.json({ ok: true });

    const r = await query(
      `SELECT o.id, o.store_id, o.eps_status, o.customer_name, s.name AS store_name, s.user_id AS store_user_id
       FROM orders o JOIN stores s ON s.id = o.store_id
       WHERE ($1 <> '' AND o.eps_barcode = $1)
          OR ($2 <> '' AND o.id::text = $2 AND o.eps_barcode <> '')
       LIMIT 1`,
      [barcode, invoice]
    );
    const order = r.rows[0];
    if (order) await applyEpsStatus(order, status, { notes: String(b.notes || '').slice(0, 200) });
    res.json({ ok: true }); // دائماً 200 حتى لا يعيد LogesTechs المحاولة بلا داعٍ
  } catch (e) {
    console.error('eps webhook:', e.message);
    res.json({ ok: true });
  }
}

// يزامن طلبات متجر واحد مع حالتها الحيّة لدى EPS (احتياط عن الـ webhook).
async function syncStoreOrders(store) {
  const r = await query(
    `SELECT o.id, o.store_id, o.eps_barcode, o.eps_status, o.customer_name,
            $2::text AS store_name, $3::uuid AS store_user_id
     FROM orders o
     WHERE o.store_id = $1 AND o.eps_barcode <> '' ORDER BY o.created_at DESC LIMIT 50`,
    [store.id, store.name, store.user_id]
  );
  const statuses = {};
  r.rows.forEach((o) => { statuses[o.id] = o.eps_status || ''; });

  const pending = r.rows.filter((o) => !EPS_TERMINAL.has(String(o.eps_status || '').toUpperCase()));
  for (const o of pending.slice(0, 30)) {
    try {
      const st = await getEpsPackageStatus(o.eps_barcode);
      if (await applyEpsStatus(o, st)) statuses[o.id] = st;
    } catch { /* نتجاهل فشل شحنة مفردة */ }
  }
  return statuses;
}

// ───────── GET /api/eps/sync — مزامنة حالة طلبات المتجر الحالي ─────────
export async function epsSync(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store?.eps_connected) return res.json({ statuses: {} });
    res.json({ statuses: await syncStoreOrders(store) });
  } catch (err) {
    next(err);
  }
}

// ───────── مهمّة خلفية: تزامن كل المتاجر المربوطة (احتياط عن الـ webhook) ─────────
let syncRunning = false;
export async function syncAllEpsStores() {
  if (syncRunning) return;
  syncRunning = true;
  try {
    const r = await query('SELECT id, user_id, name FROM stores WHERE eps_connected = true');
    for (const store of r.rows) {
      try { await syncStoreOrders(store); } catch (e) { console.error('eps sync store', store.id, e.message); }
    }
  } catch (e) {
    console.error('syncAllEpsStores:', e.message);
  } finally {
    syncRunning = false;
  }
}

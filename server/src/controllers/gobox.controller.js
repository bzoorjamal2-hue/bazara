import { query } from '../config/db.js';
import { applyOrderStatus } from './order.controller.js';
import { sendPushToUser } from '../config/push.js';
import { sendNativeToUser } from '../config/nativePush.js';
import { encrypt, decrypt } from '../config/opost.js';
// حالات LogesTechs موحّدة مع EPS (نفس النظام) — نعيد استخدامها بلا تكرار.
import { epsStatusLabelAr as goboxLabelAr, epsToBazaraStatus as goboxToBazara, EPS_TERMINAL as GOBOX_TERMINAL } from '../config/eps.js';
import {
  searchGoboxVillages,
  createGoboxShipment,
  getGoboxPackageStatus,
  getGoboxAwb,
} from '../config/gobox.js';

async function getUserStoreRow(userId) {
  const r = await query(
    `SELECT id, user_id, name, phone, whatsapp,
            gobox_email, gobox_password, gobox_region, gobox_city, gobox_village, gobox_address, gobox_connected
     FROM stores WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0] || null;
}

// ───────── GET /api/gobox/status — حالة الربط (بلا كلمة سر) ─────────
export async function goboxStatus(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    res.json({
      connected: Boolean(store.gobox_connected),
      email: store.gobox_email || '',
      region: store.gobox_region || '',
      city: store.gobox_city || '',
      village: store.gobox_village || '',
      address: store.gobox_address || '',
    });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/gobox/connect — ربط حساب gobox (بريد + كلمة سر فقط) ─────────
// لا يوجد مسار تسجيل دخول لدى LogesTechs للتحقّق المسبق — البيانات تُستخدم مع كل
// إنشاء شحنة، لذا نخزّنها مشفّرة ويظهر أي خطأ اعتماد عند أول إرسال.
export async function goboxConnect(req, res, next) {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'البريد وكلمة السر مطلوبان.' });

  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    await query(
      `UPDATE stores SET gobox_email = $1, gobox_password = $2, gobox_connected = true WHERE id = $3`,
      [email, encrypt(password), store.id]
    );
    res.json({ connected: true, email });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/gobox/disconnect — فصل الحساب ─────────
export async function goboxDisconnect(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    await query(
      `UPDATE stores SET gobox_connected = false, gobox_email = '', gobox_password = '',
         gobox_region = '', gobox_city = '', gobox_village = '', gobox_address = '' WHERE id = $1`,
      [store.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ───────── PUT /api/gobox/origin — قرية/عنوان الاستلام (region+city+village معاً من قرية مختارة) ─────────
export async function goboxSetOrigin(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const region = String(req.body.region || store.gobox_region || '');
    const city = String(req.body.city || store.gobox_city || '');
    const village = String(req.body.village || store.gobox_village || '');
    const address = String(req.body.address ?? store.gobox_address ?? '').trim().slice(0, 300);
    await query(
      'UPDATE stores SET gobox_region = $1, gobox_city = $2, gobox_village = $3, gobox_address = $4 WHERE id = $5',
      [region, city, village, address, store.id]
    );
    res.json({ ok: true, region, city, village, address });
  } catch (err) {
    next(err);
  }
}

// ───────── GET /api/gobox/villages?search= — بحث القرى (لاختيار الاستلام/الوجهة) ─────────
export async function goboxVillages(req, res, next) {
  try {
    const villages = await searchGoboxVillages(req.query.search || '');
    res.json({ villages });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/gobox/orders/:id/send — إنشاء شحنة gobox من طلب ─────────
export async function goboxSendOrder(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    if (!store.gobox_connected) return res.status(400).json({ error: 'اربط حساب gobox أولاً من إعدادات المتجر.' });

    const orderRes = await query(
      `SELECT id, customer_name, customer_phone, items, total, city, address, notes, gobox_barcode
       FROM orders WHERE id = $1 AND store_id = $2`,
      [id, store.id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود.' });
    if (order.gobox_barcode) {
      return res.status(400).json({ error: 'هذا الطلب أُرسل مسبقاً لـ gobox.', tracking: order.gobox_barcode });
    }

    // الوجهة = قرية الزبون المختارة (تحمل معرّفاتها الثلاثة)
    const region = String(req.body.region || '');
    const city = String(req.body.city || '');
    const village = String(req.body.village || '');
    if (!region || !city || !village) return res.status(400).json({ error: 'اختر قرية/منطقة الزبون.' });
    if (!store.gobox_village || !store.gobox_address) {
      return res.status(400).json({ error: 'حدّد قرية وعنوان الاستلام أولاً من إعدادات المتجر (بطاقة gobox).' });
    }

    const password = decrypt(store.gobox_password);
    if (!store.gobox_email || !password) return res.status(400).json({ error: 'اربط حساب gobox أولاً من إعدادات المتجر.' });

    const items = Array.isArray(order.items) ? order.items : [];
    const quantity = items.reduce((s, it) => s + (parseInt(it.qty, 10) || 1), 0) || 1;
    const itemsDescription = items
      .map((it) => `${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`)
      .join(' | ')
      .slice(0, 500);

    const payload = {
      email: store.gobox_email,
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
        serviceType: 'STANDARD',
        shipmentType: 'COD',
      },
      destinationAddress: {
        // العنوان التفصيلي = ما كتبه الزبون (مدينته ثم عنوانه) كما هو
        addressLine1: [order.city, order.address].map((x) => (x || '').trim()).filter(Boolean).join(' - ') || '-',
        cityId: Number(city),
        regionId: Number(region),
        villageId: Number(village),
      },
      originAddress: {
        addressLine1: store.gobox_address || '-',
        cityId: Number(store.gobox_city),
        regionId: Number(store.gobox_region),
        villageId: Number(store.gobox_village),
      },
    };

    let resp;
    try {
      resp = await createGoboxShipment(payload);
    } catch (e) {
      const details = e.body?.errors
        ? Object.values(e.body.errors).flat().join(' • ')
        : (e.body?.error || e.body?.message || e.message);
      return res.status(400).json({ error: `gobox: ${details}` });
    }

    const goboxId = resp?.id != null ? String(resp.id) : '';
    const barcode = String(resp?.barcode || '') || goboxId;
    await query(
      `UPDATE orders SET gobox_id = $1, gobox_barcode = $2, gobox_status = $3, gobox_sent_at = now() WHERE id = $4`,
      [goboxId, barcode, 'PENDING_CUSTOMER_CARE_APPROVAL', order.id]
    );

    // الطلب الآن بعهدة gobox → "تم الشحن" تلقائياً (يخصم المخزون إن لم يُخصم)
    try { await applyOrderStatus(store.id, order.id, 'shipped'); } catch (e) { console.error('gobox auto-status:', e.message); }

    res.json({ ok: true, tracking: barcode, id: goboxId });
  } catch (err) {
    next(err);
  }
}

// ───────── GET /api/gobox/orders/:id/awb — رابط بوليصة الشحن PDF (بمعرّف الشحنة) ─────────
export async function goboxOrderAwb(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('SELECT gobox_id FROM orders WHERE id = $1 AND store_id = $2', [id, store.id]);
    const goboxId = r.rows[0]?.gobox_id;
    if (!goboxId) return res.status(404).json({ error: 'الطلب غير مُرسل لـ gobox.' });
    const url = await getGoboxAwb([Number(goboxId)]);
    if (!url) return res.status(502).json({ error: 'تعذّر جلب البوليصة من gobox.' });
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

// يطبّق حالة gobox جديدة على طلب: يحفظها، يعكسها على حالة بازارا، ويُشعر المالك.
async function applyGoboxStatus(order, status, { notes = '' } = {}) {
  if (!status || status === order.gobox_status) return false;
  await query('UPDATE orders SET gobox_status = $1 WHERE id = $2', [status, order.id]);
  const bz = goboxToBazara(status);
  if (bz) await applyOrderStatus(order.store_id, order.id, bz).catch(() => {});
  const payload = {
    title: `🚚 تحديث شحنة gobox — ${order.store_name}`,
    body: `${order.customer_name || 'طلب'}: ${goboxLabelAr(status)}${notes ? ` — ${notes}` : ''}`,
    url: '/dashboard?tab=myOrders',
  };
  sendPushToUser(order.store_user_id, payload);
  sendNativeToUser(order.store_user_id, payload);
  return true;
}

// ───────── POST /api/gobox/webhook — تحديثات الحالة من LogesTechs (بلا CSRF/توثيق) ─────────
export async function goboxWebhook(req, res) {
  try {
    const b = req.body || {};
    const status = String(b.newStatus || b.status || '').trim();
    const barcode = String(b.barcode || b.packageBarcode || '').trim();
    const invoice = String(b.invoiceNumber || '').trim();
    if (!status || (!barcode && !invoice)) return res.json({ ok: true });

    const r = await query(
      `SELECT o.id, o.store_id, o.gobox_status, o.customer_name, s.name AS store_name, s.user_id AS store_user_id
       FROM orders o JOIN stores s ON s.id = o.store_id
       WHERE ($1 <> '' AND o.gobox_barcode = $1)
          OR ($2 <> '' AND o.id::text = $2 AND o.gobox_barcode <> '')
       LIMIT 1`,
      [barcode, invoice]
    );
    const order = r.rows[0];
    if (order) await applyGoboxStatus(order, status, { notes: String(b.notes || '').slice(0, 200) });
    res.json({ ok: true }); // دائماً 200 حتى لا يعيد LogesTechs المحاولة بلا داعٍ
  } catch (e) {
    console.error('gobox webhook:', e.message);
    res.json({ ok: true });
  }
}

// يزامن طلبات متجر واحد مع حالتها الحيّة لدى gobox (احتياط عن الـ webhook).
async function syncStoreOrders(store) {
  const r = await query(
    `SELECT o.id, o.store_id, o.gobox_barcode, o.gobox_status, o.customer_name,
            $2::text AS store_name, $3::uuid AS store_user_id
     FROM orders o
     WHERE o.store_id = $1 AND o.gobox_barcode <> '' ORDER BY o.created_at DESC LIMIT 50`,
    [store.id, store.name, store.user_id]
  );
  const statuses = {};
  r.rows.forEach((o) => { statuses[o.id] = o.gobox_status || ''; });

  const pending = r.rows.filter((o) => !GOBOX_TERMINAL.has(String(o.gobox_status || '').toUpperCase()));
  for (const o of pending.slice(0, 30)) {
    try {
      const st = await getGoboxPackageStatus(o.gobox_barcode);
      if (await applyGoboxStatus(o, st)) statuses[o.id] = st;
    } catch { /* نتجاهل فشل شحنة مفردة */ }
  }
  return statuses;
}

// ───────── GET /api/gobox/sync — مزامنة حالة طلبات المتجر الحالي ─────────
export async function goboxSync(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store?.gobox_connected) return res.json({ statuses: {} });
    res.json({ statuses: await syncStoreOrders(store) });
  } catch (err) {
    next(err);
  }
}

// ───────── مهمّة خلفية: تزامن كل المتاجر المربوطة (احتياط عن الـ webhook) ─────────
let syncRunning = false;
export async function syncAllGoboxStores() {
  if (syncRunning) return;
  syncRunning = true;
  try {
    const r = await query('SELECT id, user_id, name FROM stores WHERE gobox_connected = true');
    for (const store of r.rows) {
      try { await syncStoreOrders(store); } catch (e) { console.error('gobox sync store', store.id, e.message); }
    }
  } catch (e) {
    console.error('syncAllGoboxStores:', e.message);
  } finally {
    syncRunning = false;
  }
}

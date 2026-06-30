import { query } from '../config/db.js';
import { applyOrderStatus } from './order.controller.js';
import {
  isOpostConfigured,
  loginOpost,
  refreshOpost,
  encrypt,
  decrypt,
  opostApi,
  asList,
  fetchCities,
  fetchAreas,
  fetchShipmentTypes,
  createShipment,
  extractShipmentInfo,
  getShipment,
  shipmentStatus,
} from '../config/opost.js';

async function getUserStoreRow(userId) {
  const r = await query(
    `SELECT id, name, opost_email, opost_access_token, opost_refresh_token,
            opost_token_expires, opost_business, opost_business_address, opost_connected
     FROM stores WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0] || null;
}

// يحفظ التوكنات (مشفّرة) + تاريخ انتهائها
async function saveTokens(storeId, tok) {
  const expires = new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000);
  await query(
    `UPDATE stores SET opost_access_token = $1, opost_refresh_token = $2,
       opost_token_expires = $3, opost_connected = true WHERE id = $4`,
    [encrypt(tok.access_token), encrypt(tok.refresh_token || ''), expires, storeId]
  );
  return tok.access_token;
}

// يُرجّع توكناً صالحاً: يعيد استخدام المخزّن، ويجدّده تلقائياً عند قرب انتهائه (يقلّل استهلاك الـ API)
async function ensureToken(store) {
  const exp = store.opost_token_expires ? new Date(store.opost_token_expires).getTime() : 0;
  const access = decrypt(store.opost_access_token);
  if (access && exp - Date.now() > 60 * 1000) return access; // ما زال صالحاً
  const refresh = decrypt(store.opost_refresh_token);
  if (!refresh) {
    const e = new Error('not_connected');
    e.code = 'NOT_CONNECTED';
    throw e;
  }
  const tok = await refreshOpost(refresh); // تجديد بلا إعادة تسجيل دخول
  return saveTokens(store.id, tok);
}

function mapNamed(x) {
  return {
    id: x.id ?? x.value ?? x.key,
    name: x.name || x.title || x.name_ar || x.name_en || x.label || String(x.id ?? ''),
  };
}

// عنوان الاستلام: كائنه يستخدم مفاتيح منقّطة (city.name, area.name) وبلا حقل name
function mapAddress(x) {
  const parts = [x['city.name'], x['area.name'], x.address].filter(Boolean);
  return { id: x.id, name: parts.join(' - ') || String(x.id ?? '') };
}

// ───────── GET /api/opost/status — حالة الربط (بدون أي توكن/كلمة سر) ─────────
export async function opostStatus(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    res.json({
      enabled: isOpostConfigured(), // هل ضبط المشرف مفاتيح التطبيق على أوبتيموس؟
      connected: Boolean(store.opost_connected),
      email: store.opost_email || '',
      business: store.opost_business || '',
      businessAddress: store.opost_business_address || '',
    });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/opost/connect — ربط حساب أوبتيموس للمتجر ─────────
export async function opostConnect(req, res, next) {
  if (!isOpostConfigured()) {
    return res.status(503).json({ error: 'ربط أوبتيموس غير مُفعّل بعد على المنصّة. تواصل مع الدعم.' });
  }
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const businessAddressId = req.body.businessAddress ? String(req.body.businessAddress) : '';
  if (!email || !password) return res.status(400).json({ error: 'البريد وكلمة السر مطلوبان.' });

  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    // 1) تسجيل دخول أوبتيموس → توكنات (كلمة السر تُستخدم هنا فقط ولا تُحفظ أبداً)
    let tok;
    try {
      tok = await loginOpost(email, password);
    } catch (e) {
      const msg = e.status === 400 || e.status === 401
        ? 'بيانات الدخول لأوبتيموس غير صحيحة، أو حسابك غير مُفعّل للـ API.'
        : (e.message || 'تعذّر الاتصال بأوبتيموس.');
      return res.status(400).json({ error: msg });
    }
    const access = tok.access_token;

    // 2) جلب نشاط المتجر (business) وعناوين الاستلام
    let businessId = '';
    let businesses = [];
    let addresses = [];
    try {
      businesses = asList(await opostApi('/api/resources/businesses', access)).map(mapNamed);
      addresses = asList(await opostApi('/api/resources/business-addresses', access)).map(mapAddress);
    } catch {
      // لو فشل الجلب لا نُفشل الربط — نخزّن التوكن ونكمل لاحقاً
    }
    businessId = businesses[0]?.id ? String(businesses[0].id) : '';
    const addrId = businessAddressId || (addresses[0]?.id ? String(addresses[0].id) : '');

    // 3) حفظ التوكنات + المعرّفات + البريد للعرض
    await query(
      `UPDATE stores SET opost_email = $1, opost_business = $2, opost_business_address = $3 WHERE id = $4`,
      [email, businessId, addrId, store.id]
    );
    await saveTokens(store.id, tok);

    res.json({
      connected: true,
      email,
      business: businessId,
      businessAddress: addrId,
      businesses,
      addresses, // لو في أكثر من عنوان استلام، الواجهة تخلّيه يختار
    });
  } catch (err) {
    next(err);
  }
}

// ───────── POST /api/opost/disconnect — فصل الحساب ─────────
export async function opostDisconnect(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    await query(
      `UPDATE stores SET opost_connected = false, opost_access_token = '', opost_refresh_token = '',
        opost_token_expires = NULL, opost_email = '', opost_business = '', opost_business_address = '' WHERE id = $1`,
      [store.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ───────── PUT /api/opost/address — تغيير عنوان الاستلام المختار ─────────
export async function opostSetAddress(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const addrId = String(req.body.businessAddress || '');
    await query('UPDATE stores SET opost_business_address = $1 WHERE id = $2', [addrId, store.id]);
    res.json({ ok: true, businessAddress: addrId });
  } catch (err) {
    next(err);
  }
}

// ───────── GET /api/opost/cities ─────────
export async function opostCities(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store?.opost_connected) return res.status(400).json({ error: 'الحساب غير مربوط.' });
    const token = await ensureToken(store);
    const cities = (await fetchCities(token)).map(mapNamed);
    res.json({ cities });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') return res.status(400).json({ error: 'الحساب غير مربوط.' });
    next(err);
  }
}

// ───────── GET /api/opost/areas?city=ID ─────────
export async function opostAreas(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store?.opost_connected) return res.status(400).json({ error: 'الحساب غير مربوط.' });
    const cityId = String(req.query.city || '');
    if (!cityId) return res.json({ areas: [] });
    const token = await ensureToken(store);
    const areas = (await fetchAreas(token, cityId)).map(mapNamed);
    res.json({ areas });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') return res.status(400).json({ error: 'الحساب غير مربوط.' });
    next(err);
  }
}

// ───────── GET /api/opost/shipment-types ─────────
export async function opostShipmentTypes(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store?.opost_connected) return res.status(400).json({ error: 'الحساب غير مربوط.' });
    const token = await ensureToken(store);
    const types = (await fetchShipmentTypes(token)).map(mapNamed);
    res.json({ types });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') return res.status(400).json({ error: 'الحساب غير مربوط.' });
    next(err);
  }
}

// ───────── POST /api/opost/orders/:id/send — إنشاء شحنة أوبتيموس من طلب ─────────
export async function opostSendOrder(req, res, next) {
  const { id } = req.params;
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    if (!store.opost_connected) return res.status(400).json({ error: 'اربط حساب أوبتيموس أولاً من إعدادات المتجر.' });

    const orderRes = await query(
      `SELECT id, customer_name, customer_phone, items, total, city, address, notes, opost_tracking
       FROM orders WHERE id = $1 AND store_id = $2`,
      [id, store.id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود.' });
    if (order.opost_tracking) {
      return res.status(400).json({ error: 'هذا الطلب أُرسل مسبقاً لأوبتيموس.', tracking: order.opost_tracking });
    }

    const cityId = String(req.body.city || '');
    const areaId = String(req.body.area || '');
    const shipmentTypeId = req.body.shipmentType ? String(req.body.shipmentType) : '';
    if (!cityId || !areaId) return res.status(400).json({ error: 'اختر المدينة والمنطقة.' });

    const token = await ensureToken(store);

    // نوع الشحنة: المختار، وإلا أول نوع متاح
    let typeId = shipmentTypeId;
    if (!typeId) {
      const types = await fetchShipmentTypes(token);
      typeId = types[0]?.id ? String(types[0].id) : '';
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const quantity = items.reduce((s, it) => s + (parseInt(it.qty, 10) || 1), 0) || 1;
    const itemsDescription = items
      .map((it) => `${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`)
      .join(' | ')
      .slice(0, 500);

    const payload = {
      business: store.opost_business || undefined,
      business_address: store.opost_business_address || undefined,
      consignee: {
        name: order.customer_name || '',
        phone: order.customer_phone || '',
        city: cityId,
        area: areaId,
        address: order.address || order.city || '-',
      },
      shipment_types: [{ id: typeId }],
      ref_order_id: order.id, // ربط الشحنة برقم طلب بازارا
      quantity,
      items_description: itemsDescription,
      is_cod: 1,
      cod_amount: Number(order.total || 0),
      has_return: 0,
      notes: (order.notes || '').slice(0, 500),
    };

    let resp;
    try {
      resp = await createShipment(token, payload);
    } catch (e) {
      // 422 = خطأ تحقّق من أوبتيموس (حقل ناقص/غير صالح) — نرجّع التفاصيل للمالك
      const details = e.body?.errors
        ? Object.values(e.body.errors).flat().join(' • ')
        : (e.body?.message || e.message);
      return res.status(400).json({ error: `أوبتيموس: ${details}` });
    }

    const info = extractShipmentInfo(resp);
    await query(
      `UPDATE orders SET opost_id = $1, opost_tracking = $2, opost_status = $3, opost_sent_at = now() WHERE id = $4`,
      [info.id, info.tracking, info.status, order.id]
    );

    // الطلب الآن بعهدة أوبتيموس → نحوّله تلقائياً لـ"تم الشحن" (يخصم المخزون إن لم يُخصم)
    // ويُقفل التغيير اليدوي بالواجهة. لا نُفشل الردّ لو تعثّر هذا الجزء.
    try { await applyOrderStatus(store.id, order.id, 'shipped'); } catch (e) { console.error('opost auto-status:', e.message); }

    res.json({ ok: true, tracking: info.tracking, id: info.id, status: info.status });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      return res.status(400).json({ error: 'اربط حساب أوبتيموس أولاً من إعدادات المتجر.' });
    }
    next(err);
  }
}

// حالات أوبتيموس النهائية — ما نعيد الاستعلام عنها (وفّر استدعاءات)
const OPOST_TERMINAL = new Set(['delivered', 'cancelled', 'canceled', 'returned', 'return']);

// ───────── GET /api/opost/sync — مزامنة حالة الطلبات مع أوبتيموس ─────────
// يجلب الحالة الحيّة لكل شحنة غير منتهية ويحدّث الطلب، ويعكس النهائي على حالة بازارا.
export async function opostSync(req, res, next) {
  try {
    const store = await getUserStoreRow(req.user.id);
    if (!store?.opost_connected) return res.json({ statuses: {} });

    const r = await query(
      `SELECT id, opost_id, opost_status FROM orders
       WHERE store_id = $1 AND opost_id <> '' ORDER BY created_at DESC LIMIT 50`,
      [store.id]
    );
    const out = {};
    r.rows.forEach((o) => { out[o.id] = o.opost_status || ''; });

    const pending = r.rows.filter((o) => !OPOST_TERMINAL.has(String(o.opost_status || '').toLowerCase()));
    if (!pending.length) return res.json({ statuses: out });

    const token = await ensureToken(store);
    for (const o of pending.slice(0, 30)) {
      try {
        const st = shipmentStatus(await getShipment(token, o.opost_id));
        if (st && st !== o.opost_status) {
          await query('UPDATE orders SET opost_status = $1 WHERE id = $2', [st, o.id]);
          out[o.id] = st;
          const low = st.toLowerCase();
          // عكس الحالة النهائية على حالة بازارا (للإحصائيات والمخزون)
          if (low === 'delivered') await applyOrderStatus(store.id, o.id, 'delivered').catch(() => {});
          else if (OPOST_TERMINAL.has(low)) await applyOrderStatus(store.id, o.id, 'cancelled').catch(() => {});
        }
      } catch { /* نتجاهل فشل شحنة مفردة */ }
    }
    res.json({ statuses: out });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') return res.json({ statuses: {} });
    next(err);
  }
}

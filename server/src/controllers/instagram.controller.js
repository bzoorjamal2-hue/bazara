import crypto from 'crypto';
import { query } from '../config/db.js';
import { encrypt, decrypt } from '../config/opost.js';
import { sendPushToUser } from '../config/push.js';
import { sendNativeToUser } from '../config/nativePush.js';
import {
  isInstagramConfigured,
  verifySignature,
  VERIFY_TOKEN,
  APP_ID,
  GRAPH_VERSION,
  LOGIN_CONFIG_ID,
  exchangeCodeForToken,
  exchangeLongLivedToken,
  getManagedPages,
  subscribePageMessages,
  unsubscribePageMessages,
  sendMessage,
  getSenderProfile,
} from '../config/instagram.js';

async function getUserStore(userId) {
  const r = await query(
    `SELECT id, user_id, ig_user_id, ig_username, ig_page_id, ig_access_token, ig_connected
     FROM stores WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0] || null;
}

// المحادثة مع التأكد أنها تخصّ متجر هذا المستخدم (منع الوصول لمحادثات متجر آخر)
async function getOwnedConversation(userId, convId) {
  const r = await query(
    `SELECT c.*, s.user_id, s.ig_access_token
     FROM ig_conversations c JOIN stores s ON s.id = c.store_id
     WHERE c.id = $1 AND s.user_id = $2`,
    [convId, userId]
  );
  return r.rows[0] || null;
}

// ═════════════════════ Webhook (يأتي من خوادم Meta — بلا كوكي/CSRF) ═════════════════════

// GET — تأكيد اشتراك الـ webhook: Meta ترسل verify_token فنطابقه ونعيد challenge.
export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// POST — استقبال الأحداث (رسائل واردة). نتحقق من التوقيع أولاً، نردّ 200 فوراً،
// ثم نعالج بالخلفية (Meta تعيد الإرسال لو تأخّر الردّ أو فشل).
export function receiveWebhook(req, res) {
  if (!verifySignature(req.rawBody, req.headers['x-hub-signature-256'])) {
    return res.sendStatus(403);
  }
  res.sendStatus(200);
  processWebhook(req.body).catch((e) => console.error('ig webhook:', e.message));
}

async function processWebhook(body) {
  if (body?.object !== 'instagram' && body?.object !== 'page') return;
  for (const entry of body.entry || []) {
    for (const ev of entry.messaging || []) {
      // recipient.id = حساب المتجر (Business) ، sender.id = الزبون (IGSID)
      const businessId = ev.recipient?.id;
      const senderId = ev.sender?.id;
      const msg = ev.message;
      if (!businessId || !senderId || !msg) continue;

      // نجد المتجر صاحب هذا الحساب. لو الرسالة "echo" (صادرة) فالمُرسِل هو المتجر.
      const isEcho = Boolean(msg.is_echo);
      const storeIgId = isEcho ? senderId : businessId;
      const customerId = isEcho ? businessId : senderId;

      const sr = await query(
        'SELECT id, user_id, ig_access_token FROM stores WHERE ig_user_id = $1 AND ig_connected = true',
        [storeIgId]
      );
      const store = sr.rows[0];
      if (!store) continue;

      const text = msg.text || '';
      const attachment = msg.attachments?.[0]?.payload?.url || '';
      const preview = text || (attachment ? '📎 مرفق' : '');

      // upsert المحادثة (صف واحد لكل زبون بهذا المتجر) — نرفع غير المقروء للوارد فقط
      const conv = await query(
        `INSERT INTO ig_conversations (store_id, ig_sender_id, last_message, last_at, unread)
         VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT (store_id, ig_sender_id) DO UPDATE
           SET last_message = EXCLUDED.last_message,
               last_at = now(),
               unread = ig_conversations.unread + $4
         RETURNING id, (xmax = 0) AS is_new`,
        [store.id, customerId, preview, isEcho ? 0 : 1]
      );
      const convId = conv.rows[0].id;

      // نخزّن الرسالة (mid فريد → لا يتكرّر نفس الحدث ولا ردّنا الذي عاد كـ echo)
      await query(
        `INSERT INTO ig_messages (conversation_id, mid, direction, text, attachment_url)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (mid) DO NOTHING`,
        [convId, msg.mid || null, isEcho ? 'out' : 'in', text, attachment]
      );

      if (isEcho) continue; // ردّنا/ردّ المتجر — لا إشعار

      // اسم الزبون (مرّة واحدة عند أول رسالة) لعرضه بالصندوق بدل معرّف مجرّد
      if (conv.rows[0].is_new) {
        const token = decrypt(store.ig_access_token);
        if (token) {
          const prof = await getSenderProfile(token, customerId);
          if (prof.name || prof.username) {
            await query(
              'UPDATE ig_conversations SET customer_name = $2, customer_username = $3 WHERE id = $1',
              [convId, prof.name, prof.username]
            );
          }
        }
      }

      // إشعار المتجر برسالة إنستغرام جديدة (دفع على الجوال — ويب وأصلي)
      const payload = {
        title: '💬 رسالة إنستغرام جديدة',
        body: preview.slice(0, 120),
        url: '/dashboard?tab=instagram',
      };
      sendPushToUser(store.user_id, payload);
      sendNativeToUser(store.user_id, payload);
    }
  }
}

// ═════════════════════ ربط الحساب (لصاحب المتجر) ═════════════════════

// GET /api/instagram/status — حالة الربط بلا كشف أي توكن
export async function igStatus(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    res.json({
      enabled: isInstagramConfigured(),
      connected: Boolean(store.ig_connected),
      username: store.ig_username || '',
      appId: APP_ID, // عام — لبناء رابط تسجيل الدخول بالواجهة
      graphVersion: GRAPH_VERSION,
      configId: LOGIN_CONFIG_ID, // إعداد تسجيل الدخول للأعمال (عام)
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/instagram/connect — تدفّق إعادة التوجيه (Facebook Login for Business):
//   • الخطوة 1: { code, redirectUri } → نبدّل الرمز بتوكن، نجلب الصفحات.
//       - صفحة واحدة → نربطها فوراً.
//       - عدّة صفحات → نخزّن التوكن (طويل العمر) مؤقّتاً ونُعيد القائمة ليختار.
//   • الخطوة 2: { pageId } فقط → نستأنف بالتوكن المخزّن مؤقّتاً ونربط الصفحة المختارة.
export async function igConnect(req, res, next) {
  if (!isInstagramConfigured()) {
    return res.status(503).json({ error: 'ربط إنستغرام غير مُفعّل بعد على المنصّة. تواصل مع الدعم.' });
  }
  const code = String(req.body.code || '').trim();
  const redirectUri = String(req.body.redirectUri || '').trim();
  const pageId = String(req.body.pageId || '').trim();
  const rawUserToken = String(req.body.userToken || '').trim(); // مسار قديم (احتياطي)

  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    // نحصل على توكن طويل العمر: من الرمز، أو من توكن مباشر، أو من المخزّن مؤقّتاً (اختيار صفحة).
    let longLived;
    if (code && redirectUri) {
      const userToken = await exchangeCodeForToken(code, redirectUri);
      longLived = await exchangeLongLivedToken(userToken);
    } else if (rawUserToken) {
      longLived = await exchangeLongLivedToken(rawUserToken);
    } else if (pageId && !store.ig_connected && store.ig_access_token) {
      longLived = decrypt(store.ig_access_token); // التوكن المؤقّت من الخطوة 1
    }
    if (!longLived) return res.status(400).json({ error: 'انتهت جلسة الربط. أعد المحاولة من زر الربط.' });

    const pages = await getManagedPages(longLived);
    if (!pages.length) {
      return res.status(400).json({
        error: 'ما لقينا حساب إنستغرام Business مربوط بصفحة فيسبوك. تأكّد أنّ حسابك Business ومربوط بصفحة تديرها.',
      });
    }

    // صفحة واحدة → تلقائي. عدّة صفحات بلا اختيار → نخزّن التوكن مؤقّتاً ونُعيد القائمة.
    const chosen = pages.find((p) => p.pageId === pageId) || (pages.length === 1 ? pages[0] : null);
    if (!chosen) {
      await query(
        "UPDATE stores SET ig_access_token = $1, ig_connected = false WHERE id = $2",
        [encrypt(longLived), store.id]
      );
      return res.json({ pages: pages.map((p) => ({ pageId: p.pageId, name: p.pageName, username: p.igUsername })) });
    }

    // اشتراك الـ webhook لهذه الصفحة — أفضل جهد. لو نقصت صلاحية pages_manage_metadata
    // لا نُفشل الربط: الاشتراك بحقل «messages» على مستوى تطبيق إنستغرام (بلوحة Meta)
    // يكفي لوصول الرسائل لكل حساب مربوط، فنتجاهل فشل اشتراك الصفحة بهدوء.
    try {
      await subscribePageMessages(chosen.pageId, chosen.pageToken);
    } catch (e) {
      console.error('ig subscribe page (تم تجاهله):', e.message);
    }

    await query(
      `UPDATE stores SET ig_user_id = $1, ig_username = $2, ig_page_id = $3,
         ig_access_token = $4, ig_connected = true WHERE id = $5`,
      [chosen.igUserId, chosen.igUsername, chosen.pageId, encrypt(chosen.pageToken), store.id]
    );

    res.json({ connected: true, username: chosen.igUsername });
  } catch (err) {
    if (err.status) return res.status(400).json({ error: err.body?.error?.message || 'تعذّر الربط مع إنستغرام.' });
    next(err);
  }
}

// POST /api/instagram/disconnect
export async function igDisconnect(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    // تنظيف اشتراك الـ webhook (لا نُفشل الفصل لو تعذّر)
    const token = decrypt(store.ig_access_token);
    if (store.ig_page_id && token) {
      unsubscribePageMessages(store.ig_page_id, token).catch(() => {});
    }
    await query(
      `UPDATE stores SET ig_connected = false, ig_user_id = '', ig_username = '',
         ig_page_id = '', ig_access_token = '' WHERE id = $1`,
      [store.id]
    );
    res.json({ connected: false });
  } catch (err) {
    next(err);
  }
}

// ═════════════════════ صندوق الرسائل ═════════════════════

// GET /api/instagram/conversations — قائمة المحادثات (الأحدث أولاً)
export async function listConversations(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query(
      `SELECT id, ig_sender_id, customer_name, customer_username, last_message,
              last_at, unread, order_id
       FROM ig_conversations WHERE store_id = $1 ORDER BY last_at DESC LIMIT 100`,
      [store.id]
    );
    res.json({ conversations: r.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/instagram/conversations/:id/messages — رسائل المحادثة + تصفير غير المقروء
export async function listMessages(req, res, next) {
  try {
    const conv = await getOwnedConversation(req.user.id, req.params.id);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    const r = await query(
      `SELECT id, direction, text, attachment_url, created_at
       FROM ig_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200`,
      [conv.id]
    );
    await query('UPDATE ig_conversations SET unread = 0 WHERE id = $1', [conv.id]);
    res.json({
      conversation: {
        id: conv.id,
        customer_name: conv.customer_name,
        customer_username: conv.customer_username,
        order_id: conv.order_id,
      },
      messages: r.rows,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/instagram/conversations/:id/reply — { text }
export async function sendReply(req, res, next) {
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'الرسالة فارغة.' });
  try {
    const conv = await getOwnedConversation(req.user.id, req.params.id);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    const token = decrypt(conv.ig_access_token);
    if (!token) return res.status(400).json({ error: 'حساب إنستغرام غير مربوط.' });

    let result;
    try {
      result = await sendMessage(token, conv.ig_sender_id, text);
    } catch (e) {
      // خارج نافذة الـ 24 ساعة المسموح فيها بالرد قد ترفض Meta الإرسال
      return res.status(400).json({ error: e.body?.error?.message || 'تعذّر إرسال الرسالة عبر إنستغرام.' });
    }

    await query(
      `INSERT INTO ig_messages (conversation_id, mid, direction, text)
       VALUES ($1, $2, 'out', $3) ON CONFLICT (mid) DO NOTHING`,
      [conv.id, result?.message_id || null, text]
    );
    await query(
      'UPDATE ig_conversations SET last_message = $2, last_at = now(), unread = 0 WHERE id = $1',
      [conv.id, text]
    );
    res.json({ sent: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/instagram/conversations/:id/convert — تحويل المحادثة لطلب
// body: { items:[{id, qty, size, color}], customer:{name, phone, city, address, notes, deliveryFee} }
export async function convertToOrder(req, res, next) {
  const { items, customer } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'اختر منتجاً واحداً على الأقل.' });
  }
  const name = (customer?.name || '').trim();
  const phone = (customer?.phone || '').trim();
  if (!name || !phone) return res.status(400).json({ error: 'اسم الزبون ورقم هاتفه مطلوبان.' });

  try {
    const conv = await getOwnedConversation(req.user.id, req.params.id);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });

    // نحسب الإجمالي من قاعدة البيانات (لا نثق بأسعار الواجهة) ونتأكد أنها من متجر هذا المستخدم
    const ids = items.map((i) => i.id);
    const r = await query('SELECT id, name, price, store_id FROM products WHERE id = ANY($1::uuid[])', [ids]);
    if (r.rows.length === 0) return res.status(400).json({ error: 'منتجات غير صالحة.' });
    if (!r.rows.every((p) => p.store_id === conv.store_id)) {
      return res.status(400).json({ error: 'كل المنتجات يجب أن تكون من متجرك.' });
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
    const total = subtotal + deliveryFee;
    const reference = 'BZ-' + crypto.randomBytes(5).toString('hex').toUpperCase();

    const ins = await query(
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total, currency, status, reference, city, address, notes, delivery_fee)
       VALUES ($1, $2, '', $3, $4, $5, 'ILS', 'new', $6, $7, $8, $9, $10) RETURNING id`,
      [conv.store_id, name, phone, JSON.stringify(orderItems), total, reference,
        (customer?.city || '').trim(), (customer?.address || '').trim(),
        `طلب من رسائل إنستغرام${customer?.notes ? ' — ' + String(customer.notes).slice(0, 400) : ''}`, deliveryFee]
    );

    // نربط المحادثة بالطلب (يظهر للتاجر أنها تحوّلت + يمنع تحويلها مرتين بالخطأ)
    await query('UPDATE ig_conversations SET order_id = $2 WHERE id = $1', [conv.id, ins.rows[0].id]);

    res.status(201).json({ orderId: ins.rows[0].id, reference, total });
  } catch (err) {
    next(err);
  }
}

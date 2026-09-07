import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { encrypt, decrypt } from '../config/opost.js';
import { notifyUser } from '../utils/notify.js';
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
  sendAttachment,
  getSenderProfile,
  mirrorRemote,
} from '../config/instagram.js';

// سطرُ «آخر رسالة» في قائمة المحادثات يخلو من النصّ حين تكون الرسالةُ صورةً أو
// صوتاً، فيقولُ نوعَها بدل «مرفق» مبهمة.
const ATTACHMENT_LABEL = {
  image: '📷 صورة',
  video: '🎬 فيديو',
  audio: '🎤 رسالة صوتية',
  file: '📎 ملف',
  share: '🔗 منشور مُشارَك',
  story_mention: '📖 ذكرٌ في ستوري',
  ig_reel: '🎬 ريلز',
};

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

// أخطاء Meta التي تعني أنّ التوكن لم يعد صالحاً: غيّر التاجر كلمة مروره، أو سحب
// صلاحية التطبيق، أو فُصلت الصفحة عن الحساب. بلا رصدها تتوقّف الرسائل بصمتٍ
// يظنّه التاجر عطلاً في الموقع.
function isAuthError(e) {
  const err = e?.body?.error;
  if (!err) return false;
  return err.code === 190 || err.code === 102 || err.type === 'OAuthException';
}

// نفصل المتجر ونُعلم صاحبه ليعيد الربط. نمسح التوكن الميّت حتى لا يُستعمل ثانيةً،
// ونُبقي اسم الحساب لأنّ الفهرس الفريد جزئيٌّ على المربوطة وحدها.
async function markDisconnected(storeId, userId) {
  await query(
    "UPDATE stores SET ig_connected = false, ig_access_token = '' WHERE id = $1 AND ig_connected = true",
    [storeId]
  );
  notifyUser(userId, {
    type: 'instagram',
    title: '⚠️ انفصل حساب إنستغرام',
    body: 'انتهت صلاحية ربط حسابك، والرسائل متوقّفة. افتح تبويب رسائل إنستغرام واضغط «ربط» من جديد.',
    url: '/dashboard?tab=instagram',
  });
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
  // سطرٌ واحدٌ لكلِّ نداء: morgan لا يعمل على الإنتاج، فبدونه لا يُعرف أوصلَ نداءُ Meta
  // أصلاً أم لا — وهو أوّلُ سؤالٍ يُسأل حين لا تظهر رسالة، وأغلى ساعةٍ تضيع بلا جوابه.
  console.log('ig webhook ←', req.body?.object || '?', 'entries:', req.body?.entry?.length ?? 0);
  if (!verifySignature(req.rawBody, req.headers['x-hub-signature-256'])) {
    // التوقيعُ يُحسبُ بسرِّ التطبيق. فشلُه يعني أنّ IG_APP_SECRET على الخادمِ ليس سرَّ
    // التطبيقِ الذي أرسل — والخلطُ الشائع أن يُنسخ سرُّ «Instagram login» بدلَه.
    console.error('ig webhook: توقيعٌ غيرُ مطابق — راجع IG_APP_SECRET');
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
      if (!store) {
        // وصلنا حدثٌ لحسابٍ لا نعرفُه: إمّا الربطُ سُجّل بمعرّفٍ آخر، أو فُصل الحساب.
        // بلا هذا السطرِ يبدو الأمرُ كأنّ Meta لم تُرسل شيئاً، والفرقُ بينهما كلُّ التشخيص.
        console.log('ig webhook: لا متجر لهذا الحساب', storeIgId);
        continue;
      }

      const text = msg.text || '';
      // النوعُ يقرّرُ كيف يُعرَض المرفق: صورةٌ تُعرَضُ صورةً وفيديو يُشغَّل. بلا حفظِه
      // يصيرُ كلُّ شيءٍ رابطاً مكتوباً عليه «مرفق».
      const att = msg.attachments?.[0] || null;
      const attType = att?.type || '';
      // ننسخُ المرفقَ عندنا فوراً: رابطُ Meta ينتهي بعد أيّام فتصيرُ محادثاتُ التاجرةِ
      // القديمةُ مربّعاتٍ مكسورة. النسخُ مرّةً واحدةً هنا يجعلُها تبقى.
      const attachment = att?.payload?.url ? await mirrorRemote(att.payload.url, 'ig/messages') : '';
      const preview = text || (attachment ? ATTACHMENT_LABEL[attType] || '📎 مرفق' : '');

      // upsert المحادثة (صف واحد لكل زبون بهذا المتجر) — نرفع غير المقروء للوارد فقط
      const conv = await query(
        `INSERT INTO ig_conversations (store_id, ig_sender_id, last_message, last_at, unread)
         VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT (store_id, ig_sender_id) DO UPDATE
           SET last_message = EXCLUDED.last_message,
               last_at = now(),
               unread = ig_conversations.unread + $4
         RETURNING id, customer_name, customer_username, customer_avatar, (xmax = 0) AS is_new`,
        [store.id, customerId, preview, isEcho ? 0 : 1]
      );
      const convId = conv.rows[0].id;

      // نخزّن الرسالة (mid فريد → لا يتكرّر نفس الحدث ولا ردّنا الذي عاد كـ echo)
      await query(
        `INSERT INTO ig_messages (conversation_id, mid, direction, text, attachment_url, attachment_type)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (mid) DO NOTHING`,
        [convId, msg.mid || null, isEcho ? 'out' : 'in', text, attachment, attType]
      );

      if (isEcho) continue; // ردّنا/ردّ المتجر — لا إشعار

      // اسم الزبون وصورتُه: يُجلبان عند أوّل رسالةٍ ومتى غابت الصورة. ويُحتاجان قبل
      // الإشعارِ لا بعدَه، لأنّ الإشعارَ يحملُ اسمَه وصورتَه لا عنواناً عامّاً.
      let who = conv.rows[0].customer_name || conv.rows[0].customer_username || '';
      let avatar = conv.rows[0].customer_avatar || '';
      if (conv.rows[0].is_new || !avatar) {
        const token = decrypt(store.ig_access_token);
        if (token) {
          const prof = await getSenderProfile(token, customerId);
          if (prof.name || prof.username || prof.avatar) {
            avatar = prof.avatar ? await mirrorRemote(prof.avatar, 'ig/avatars') : avatar;
            who = prof.name || prof.username || who;
            await query(
              `UPDATE ig_conversations SET customer_name = $2, customer_username = $3,
                 customer_avatar = $4 WHERE id = $1`,
              [convId, prof.name, prof.username, avatar]
            );
          }
        }
      }

      // الإشعارُ كما في تطبيقات المحادثة: اسمُ المُرسِلِ عنواناً ونصُّ رسالتِه تحته
      // وصورتُه أيقونةً — لا «رسالة إنستغرام جديدة» التي لا تقولُ ممّن ولا فيمَ.
      // وtag باسم المحادثة يجعلُ رسائلَ الشخصِ الواحدِ تستبدلُ بعضَها في شريطِ الهاتف
      // بدل أن تتكدّس، والرابطُ يفتحُ محادثتَه هو لا قائمةَ المحادثات.
      notifyUser(store.user_id, {
        type: 'instagram',
        title: who || 'رسالة إنستغرام',
        body: preview.slice(0, 120),
        url: `/dashboard/instagram/${convId}`,
        tag: `ig-${convId}`,
        icon: avatar || undefined,
      });
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

// ═════════ ربطٌ يبقى داخلَ التطبيق (iOS) ═════════
// على الآيفون يلتقطُ النظامُ روابطَ facebook.com ويفتحُ تطبيقَ فيسبوك، فيُتمُّ الموافقةَ
// ثمّ يفتحُ رابطَ العودةِ في سفاري لا في تطبيقِنا المثبَّت — فتنقطعُ الرحلةُ ولا يعودُ
// إلينا شيء. وتحويلةُ الخادمِ لم تمنعه.
//
// فصار الربطُ يُفتَحُ في نافذةٍ مستقلّةٍ (لا يلتقطُ النظامُ روابطَها للتطبيقات)، وتعودُ
// موافقةُ فيسبوك إلى **خادمِنا** لا إلى الواجهة — لأنّ تلك النافذةَ لا تحملُ جلسةَ
// المستخدمِ في التطبيق. ولنعرفَ صاحبَها نمرّرُ تذكرةً موقّعةً (عشرُ دقائق) تحملُ رقمَه،
// فيُتمُّ الخادمُ الربطَ وحدَه ويقولُ للنافذة: أُغلقيني وارجعي.

// POST /api/instagram/link-token — تذكرةُ ربطٍ قصيرةُ العمر (تُطلَبُ من داخل التطبيق)
export function igLinkToken(req, res) {
  const token = jwt.sign({ sub: req.user.id, ig: 1 }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.json({ token });
}

function ticketUser(raw) {
  try {
    const p = jwt.verify(String(raw || ''), process.env.JWT_SECRET);
    return p?.ig === 1 && p.sub ? p.sub : null;
  } catch { return null; }
}

// صفحةٌ صغيرةٌ تُعرَضُ في النافذةِ المستقلّة بعد انتهاء الرحلة
function closingPage(title, body) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#F4EDE2;font-family:system-ui,-apple-system,'Tajawal',sans-serif;color:#3f2e22">
<div style="max-width:22rem;padding:2rem;text-align:center">
<div style="font-size:2.5rem">${title.startsWith('تم') ? '✅' : '⚠️'}</div>
<h1 style="font-size:1.1rem;margin:.75rem 0 .5rem">${title}</h1>
<p style="font-size:.9rem;line-height:1.7;color:#6b6560;margin:0">${body}</p>
</div></body></html>`;
}

// GET /api/instagram/callback — رجعةُ فيسبوك إلى الخادمِ لا إلى الواجهة
export async function igCallback(req, res) {
  // سطرٌ لكلِّ رجعة: بلا هذا لا يُعرَفُ أوصلت الرحلةُ إلينا أصلاً أم توقّفت عند فيسبوك.
  console.log('ig callback ←', req.query.error ? 'error=' + req.query.error : 'code ok', 'state?', Boolean(req.query.state));
  const uid = ticketUser(req.query.state);
  if (!uid) return res.status(400).send(closingPage('انتهت جلسة الربط', 'ارجع للتطبيق واضغط «ربط» من جديد.'));
  const code = String(req.query.code || '');
  if (!code) {
    // access_denied لا يعني دائماً أنّ صاحبَ المتجرِ ضغطَ «إلغاء»: التطبيقُ ما دام في
    // وضعِ التطويرِ ترفضُ Meta أيَّ حسابٍ لا دورَ له عليه — وهو أكثرُ ما يقعُ الآن،
    // ورسالةُ «أُلغي الربط» تُضلّلُ من لم يُلغِ شيئاً.
    const denied = String(req.query.error || '') === 'access_denied';
    return res.status(400).send(closingPage(
      denied ? 'رفض فيسبوك الإذن' : 'أُلغي الربط',
      denied
        ? 'التطبيق ما زال قيد المراجعة عند Meta، فلا يقبل إلّا الحسابات المضافة كمُختبِرين عليه. أضف حسابك في App roles ← Testers ثم اقبل الدعوة وأعد المحاولة.'
        : 'ارجع للتطبيق وحاول مرّة أخرى إن أردت.'
    ));
  }
  try {
    const store = await getUserStore(uid);
    if (!store) return res.status(404).send(closingPage('لا يوجد متجر', 'أنشئ متجرك أوّلاً ثم أعد الربط.'));

    const redirectUri = `${req.protocol}://${req.get('host')}/api/instagram/callback`;
    const userToken = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeLongLivedToken(userToken);
    const pages = await getManagedPages(longLived);
    console.log('ig callback: pages', pages.length);
    if (!pages.length) {
      return res.status(400).send(closingPage(
        'ما لقينا حساب إنستغرام',
        'تأكّد أنّ حسابك على إنستغرام من نوع Business ومربوط بصفحة فيسبوك تديرها، ثم أعد المحاولة.'
      ));
    }

    // أكثرُ من صفحة: الاختيارُ هنا في النافذةِ نفسِها. كان يُحفَظُ التوكنُ ويُقالُ له
    // «ارجع للتطبيق واختر» — خطوةٌ تضيعُ في الطريق: يغلقُ النافذةَ فيظنُّ أنّه ربط،
    // ولا رسالةَ تصل، ولا شيءَ يقولُ لماذا. والصفحاتُ بين يديه الآن، فليختر الآن.
    if (pages.length > 1) {
      await query('UPDATE stores SET ig_access_token = $1, ig_connected = false WHERE id = $2', [encrypt(longLived), store.id]);
      return res.send(choicePage(String(req.query.state), pages));
    }

    return res.send(await finishConnect(store, pages[0]));
  } catch (e) {
    console.error('ig callback:', e.message, JSON.stringify(e.body || {}).slice(0, 300));
    return res.status(500).send(closingPage('تعذّر الربط', e.message || 'حاول مرّة أخرى.'));
  }
}

// إتمامُ الربطِ بصفحةٍ بعينِها: يُستعمَلُ حين تكون صفحةً واحدةً وحين يختارُ من نافذةِ
// الاختيار — فلا يُكتَبُ المنطقُ نفسُه مرّتين ويفترقان بعد شهر.
async function finishConnect(store, chosen) {
  const dup = await query(
    'SELECT id FROM stores WHERE ig_user_id = $1 AND ig_connected = true AND id <> $2',
    [chosen.igUserId, store.id]
  );
  if (dup.rows.length) {
    return closingPage('الحساب مربوط بمتجر آخر', 'افصله من ذاك المتجر أوّلاً ثم أعد الربط.');
  }
  let subscribed = false;
  try { await subscribePageMessages(chosen.pageId, chosen.pageToken); subscribed = true; }
  catch (e) { console.error('ig subscribe page (تم تجاهله):', e.message); }
  // النجاحُ يُسجَّلُ كما يُسجَّلُ الفشل: صمتُ السجلِّ عند النجاحِ يجعلُنا نظنُّ أنّ شيئاً
  // لم يقع، فنبحثُ عن عطلٍ في مكانٍ سليم.
  console.log('ig connect ✓ page', chosen.pageId, 'ig', chosen.igUserId, '@' + (chosen.igUsername || '?'), 'subscribed', subscribed);
  await query(
    `UPDATE stores SET ig_user_id = $1, ig_username = $2, ig_page_id = $3,
       ig_access_token = $4, ig_connected = true WHERE id = $5`,
    [chosen.igUserId, chosen.igUsername, chosen.pageId, encrypt(chosen.pageToken), store.id]
  );
  return closingPage('تمّ الربط', 'أغلق هذه النافذة وارجع للتطبيق — رسائلك ستصلك هنا.');
}

// صفحةُ اختيارِ الصفحةِ داخلَ النافذةِ نفسِها
function choicePage(ticket, pages) {
  const items = pages.map((p) => {
    const label = `${p.pageName || p.pageId}${p.igUsername ? ` · @${p.igUsername}` : ''}`;
    const href = `/api/instagram/choose?lt=${encodeURIComponent(ticket)}&page=${encodeURIComponent(p.pageId)}`;
    return `<a href="${href}" style="display:block;margin:.5rem 0;padding:.9rem 1rem;border-radius:1rem;background:#fff;border:1px solid rgba(94,70,54,.18);color:#3f2e22;text-decoration:none;font-weight:700">${label}</a>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>اختر الصفحة</title></head>
<body style="margin:0;min-height:100vh;background:#F4EDE2;font-family:system-ui,-apple-system,'Tajawal',sans-serif;color:#3f2e22">
<div style="max-width:26rem;margin:0 auto;padding:2.5rem 1.25rem">
<h1 style="font-size:1.15rem;margin:0 0 .35rem">اختر الصفحة</h1>
<p style="font-size:.85rem;color:#6b6560;margin:0 0 1.25rem">حسابك يدير أكثر من صفحة — أيّها تريد ربطها بهذا المتجر؟</p>
${items}
</div></body></html>`;
}

// GET /api/instagram/choose — إتمامُ الربطِ بالصفحةِ المختارةِ من نافذةِ الاختيار
export async function igChoose(req, res) {
  const uid = ticketUser(req.query.lt);
  if (!uid) return res.status(400).send(closingPage('انتهت جلسة الربط', 'ارجع للتطبيق واضغط «ربط» من جديد.'));
  try {
    const store = await getUserStore(uid);
    if (!store || !store.ig_access_token) {
      return res.status(400).send(closingPage('انتهت جلسة الربط', 'ارجع للتطبيق واضغط «ربط» من جديد.'));
    }
    const pages = await getManagedPages(decrypt(store.ig_access_token));
    const chosen = pages.find((p) => p.pageId === String(req.query.page || ''));
    if (!chosen) return res.status(400).send(closingPage('لم نجد الصفحة', 'ارجع للتطبيق واضغط «ربط» من جديد.'));
    return res.send(await finishConnect(store, chosen));
  } catch (e) {
    console.error('ig choose:', e.message);
    return res.status(500).send(closingPage('تعذّر الربط', e.message || 'حاول مرّة أخرى.'));
  }
}

// GET /api/instagram/pending-pages — صفحاتُ التوكنِ المؤقّتِ (حين كان عنده أكثر من صفحة)
export async function igPendingPages(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store || store.ig_connected || !store.ig_access_token) return res.json({ pages: [] });
    const pages = await getManagedPages(decrypt(store.ig_access_token));
    res.json({ pages: pages.map((p) => ({ pageId: p.pageId, name: p.pageName, username: p.igUsername })) });
  } catch { res.json({ pages: [] }); }
}

// GET /api/instagram/login — بابُ الربط.
// كانت الواجهةُ تذهبُ إلى facebook.com مباشرةً، فيلتقطُ iOS الرابطَ ويفتحُ تطبيقَ
// فيسبوك (رابطٌ شامل)؛ والتطبيقُ يُتمُّ الموافقةَ ثمّ يفتحُ رابطَ العودةِ في سفاري لا
// في تطبيقِنا المثبَّت — فتنقطعُ الرحلة. والروابطُ الشاملةُ لا تُلتقَطُ حين يصلُ
// المتصفّحُ إلى العنوانِ بتحويلةٍ من نطاقٍ آخر، فنمرُّ من هنا.
// وبذلك أمكن أيضاً طلبُ دخولٍ جديدٍ في كلِّ مرّة (fresh)، وهو ما يجعلُ كلَّ تاجرةٍ
// تربطُ حسابَها هي لا حسابَ من سبقها على الجهاز نفسِه.
export function igLoginRedirect(req, res) {
  if (!isInstagramConfigured()) return res.status(503).send('ربط إنستغرام غير مُفعّل بعد.');
  // المسارُ الجديد: تذكرةٌ موقّعةٌ ورجعةٌ إلى الخادم. والقديمُ (رجعةٌ إلى الواجهة) يبقى
  // للمتصفّحاتِ التي لا يلتقطُ نظامُها الروابط.
  const ticket = String(req.query.lt || '');
  if (ticket) {
    if (!ticketUser(ticket)) return res.status(400).send('انتهت جلسة الربط.');
    const cb = `${req.protocol}://${req.get('host')}/api/instagram/callback`;
    const q = new URLSearchParams({ client_id: APP_ID, redirect_uri: cb, response_type: 'code', state: ticket });
    if (LOGIN_CONFIG_ID) { q.set('config_id', LOGIN_CONFIG_ID); q.set('override_default_response_type', 'true'); }
    if (req.query.fresh) {
      // reauthenticate وحدَه تتجاهلُه أحياناً نافذةُ «تسجيل الدخول للأعمال»، وnonce
      // جديدٌ في كلِّ محاولةٍ يجعلُ الطلبَ لا يُطابَقُ بأيِّ إثباتٍ سابقٍ فيُعادُ السؤال.
      q.set('auth_type', 'reauthenticate');
      q.set('auth_nonce', crypto.randomBytes(8).toString('hex'));
    }
    return res.redirect(302, `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${q.toString()}`);
  }
  const redirectUri = String(req.query.redirect_uri || '');
  // لا نحوّلُ إلّا إلى موقعِنا: الحقلُ يأتي من المتصفّحِ، وقبولُه كما هو يجعلُ الرابطَ
  // بابَ تحويلٍ مفتوحاً يُرسَلُ للناسِ فيظنّونه منّا.
  const allowed = [process.env.PUBLIC_SITE_URL, process.env.CLIENT_URL].filter(Boolean);
  if (!allowed.some((base) => redirectUri.startsWith(base))) {
    return res.status(400).send('رابط عودة غير مقبول.');
  }
  const p = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: String(req.query.state || '').slice(0, 120),
  });
  if (LOGIN_CONFIG_ID) {
    p.set('config_id', LOGIN_CONFIG_ID);
    p.set('override_default_response_type', 'true');
  }
  if (req.query.fresh) p.set('auth_type', 'reauthenticate');
  res.redirect(302, `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${p.toString()}`);
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

    // حسابٌ واحد لمتجرٍ واحد: لو ربطه متجرٌ آخر لَما عرف الـ webhook لأيّهما
    // يسلّم الرسالة. نمنعه هنا برسالةٍ مفهومة بدل انتهاك قيدٍ في قاعدة البيانات.
    const dup = await query(
      'SELECT id FROM stores WHERE ig_user_id = $1 AND ig_connected = true AND id <> $2',
      [chosen.igUserId, store.id]
    );
    if (dup.rows.length) {
      return res.status(409).json({ error: 'حساب إنستغرام هذا مربوط بمتجرٍ آخر على بازارا. افصله من ذاك المتجر أوّلاً.' });
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
      `SELECT id, ig_sender_id, customer_name, customer_username, customer_avatar,
              last_message, last_at, unread, order_id
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
    // ?after=<وقت>: لا نُعيدُ المحادثةَ كلَّها كلَّ أربعِ ثوانٍ لنرى رسالةً واحدةً
    // جديدة. بلا هذا يصيرُ التحديثُ اللحظيُّ أثقلَ ممّا يُفيد.
    const after = String(req.query.after || '').trim();
    const r = after
      ? await query(
          `SELECT id, direction, text, attachment_url, attachment_type, created_at
           FROM ig_messages WHERE conversation_id = $1 AND created_at > $2
           ORDER BY created_at ASC LIMIT 200`,
          [conv.id, after]
        )
      : await query(
          `SELECT id, direction, text, attachment_url, attachment_type, created_at
           FROM ig_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200`,
          [conv.id]
        );
    await query('UPDATE ig_conversations SET unread = 0 WHERE id = $1', [conv.id]);
    res.json({
      conversation: {
        id: conv.id,
        customer_name: conv.customer_name,
        customer_username: conv.customer_username,
        customer_avatar: conv.customer_avatar,
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
  const attachmentUrl = String(req.body.attachmentUrl || '').trim();
  if (!text && !attachmentUrl) return res.status(400).json({ error: 'الرسالة فارغة.' });
  // الرابطَ تجلبُه خوادمُ Meta بنفسها، فقبولُ أيِّ عنوانٍ يجعلُ حقلَ الردِّ باباً
  // نُملي منه على خادمِهم ما يطلب. نقصرُه على مستضيفِ صورِنا وحدَه.
  if (attachmentUrl && !attachmentUrl.startsWith('https://res.cloudinary.com/')) {
    return res.status(400).json({ error: 'رابط المرفق غير مقبول.' });
  }
  try {
    const conv = await getOwnedConversation(req.user.id, req.params.id);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    const token = decrypt(conv.ig_access_token);
    if (!token) return res.status(400).json({ error: 'حساب إنستغرام غير مربوط.' });

    // رسالةٌ واحدةٌ عند إنستغرام لا تحمل صورةً ونصّاً معاً، فالصورةُ أوّلاً ثمّ النصّ
    // تحتها — وهو ترتيبُ ما يراه الزبون في محادثته.
    const parts = [];
    if (attachmentUrl) parts.push({ image: attachmentUrl });
    if (text) parts.push({ text });

    for (const part of parts) {
      let result;
      try {
        result = part.image
          ? await sendAttachment(token, conv.ig_sender_id, part.image)
          : await sendMessage(token, conv.ig_sender_id, part.text);
      } catch (e) {
        // ماتَ التوكن: نفصل الحساب ونُعلم التاجر بدل رسالة Meta الإنجليزيّة الغامضة
        if (isAuthError(e)) {
          await markDisconnected(conv.store_id, conv.user_id);
          return res.status(400).json({
            error: 'انفصل حساب إنستغرام (انتهت صلاحية الربط). اضغط «ربط» من جديد لتعود الرسائل.',
          });
        }
        // خارج نافذة الـ 24 ساعة المسموح فيها بالردّ ترفض Meta الإرسال
        if (e.body?.error?.code === 10) {
          return res.status(400).json({
            error: 'مضى أكثر من ٢٤ ساعة على آخر رسالة من الزبون، وإنستغرام يمنع الردّ بعدها. انتظري رسالةً جديدة منه.',
          });
        }
        return res.status(400).json({ error: e.body?.error?.message || 'تعذّر إرسال الرسالة عبر إنستغرام.' });
      }

      await query(
        `INSERT INTO ig_messages (conversation_id, mid, direction, text, attachment_url, attachment_type)
         VALUES ($1, $2, 'out', $3, $4, $5) ON CONFLICT (mid) DO NOTHING`,
        [conv.id, result?.message_id || null, part.text || '', part.image || '', part.image ? 'image' : '']
      );
    }

    const preview = text || ATTACHMENT_LABEL.image;
    await query(
      'UPDATE ig_conversations SET last_message = $2, last_at = now(), unread = 0 WHERE id = $1',
      [conv.id, preview]
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
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total, currency, status, reference, city, area, address, notes, delivery_fee)
       VALUES ($1, $2, '', $3, $4, $5, 'ILS', 'new', $6, $7, $8, $9, $10, $11) RETURNING id`,
      [conv.store_id, name, phone, JSON.stringify(orderItems), total, reference,
        (customer?.city || '').trim(), (customer?.area || '').trim(), (customer?.address || '').trim(),
        `طلب من رسائل إنستغرام${customer?.notes ? ' — ' + String(customer.notes).slice(0, 400) : ''}`, deliveryFee]
    );

    // نربط المحادثة بالطلب (يظهر للتاجر أنها تحوّلت + يمنع تحويلها مرتين بالخطأ)
    await query('UPDATE ig_conversations SET order_id = $2 WHERE id = $1', [conv.id, ins.rows[0].id]);

    // تأكيدٌ للزبون في محادثته: كان الطلبُ يُسجَّلُ عندنا ولا يعلمُ هو شيئاً، فيعودُ
    // يسألُ «وصلكم؟» بعد ساعة. الرسالةُ تُحفَظُ في المحادثةِ أيضاً لتراها التاجرةُ في
    // مكانها، وفشلُها لا يُسقطُ الطلب: قد تكون نافذةُ الأربعِ والعشرين ساعةً أُغلقت.
    const confirm = `تمّ تسجيل طلبك ✅\nرقم الطلب: ${reference}\nالإجمالي: ₪${total}\nرح نتواصل معك لتأكيد التوصيل.`;
    let confirmed = false;
    try {
      const token = decrypt(conv.ig_access_token);
      if (token) {
        const sent = await sendMessage(token, conv.ig_sender_id, confirm);
        confirmed = true;
        await query(
          `INSERT INTO ig_messages (conversation_id, mid, direction, text)
           VALUES ($1, $2, 'out', $3) ON CONFLICT (mid) DO NOTHING`,
          [conv.id, sent?.message_id || null, confirm]
        );
        await query(
          'UPDATE ig_conversations SET last_message = $2, last_at = now() WHERE id = $1',
          [conv.id, confirm.slice(0, 120)]
        );
      }
    } catch (e) {
      console.error('ig confirm (تم تجاهله):', e.message);
    }

    res.status(201).json({ orderId: ins.rows[0].id, reference, total, confirmed });
  } catch (err) {
    next(err);
  }
}

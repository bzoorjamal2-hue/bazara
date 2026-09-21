import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { encrypt, decrypt } from '../config/opost.js';
import { notifyUser } from '../utils/notify.js';
import { feeForCity, flatInternalLocalities, cityOfVillage } from '../config/deliveryCities.js';
import { extractOrderDraft } from '../utils/orderExtract.js';
import { imageBlock, transcribe, canHear } from '../utils/mediaUnderstand.js';
import {
  loadBot, botActiveNow, agentReply, countReply, MAX_BOT_REPLIES, testModeAllows, variantAvailable,
  effectiveFloor,
} from '../utils/salesAgent.js';
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
  sendTyping,
  sendReplyTo,
  sendReaction,
  sendAttachment,
  getSenderProfile,
  mirrorRemote,
} from '../config/instagram.js';

// سطرُ «آخر رسالة» في قائمة المحادثات يخلو من النصّ حين تكون الرسالةُ صورةً أو
// صوتاً، فيقولُ نوعَها بدل «مرفق» مبهمة.
// نوعُ المرفقِ كما نُصنّفُه نحن لا كما تُسمّيه ميتا. مُصدَّرةٌ ليفحصَها الاختبار:
// الخطأُ هنا يُحوِّلُ إبهاماً إلى نداءِ رؤيةٍ كامل.
export function attachmentKind(msg, att) {
  if (msg?.sticker_id || att?.payload?.sticker_id) return 'sticker';
  return att?.type || '';
}

const ATTACHMENT_LABEL = {
  image: '📷 صورة',
  sticker: '👍 ملصق',
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
//
// وكان الفحصُ يقبلُ `type === 'OAuthException'` وحدَه — وهذه كارثة: ميتا تُعطي
// هذا النوعَ لعائلةٍ كاملةٍ من الأخطاءِ لا علاقةَ لها بالتوكن، منها الخروجُ عن
// نافذةِ الأربعِ والعشرينَ ساعة (١٠) والمُعاملُ غيرُ الصالحِ (١٠٠) ونقصُ
// الصلاحيّة (٢٠٠). فمرفقٌ صوتيٌّ ترفضُه ميتا لأيِّ سبب — امتدادٌ أو حجمٌ أو
// تعذُّرُ جلبِ الرابط — كان **يمسحُ توكنَ المتجرِ ويفصلُ الحساب**. ومعالجةُ
// الخطأِ ١٠ المكتوبةُ بعدَه كانت لا تُبلَغُ أصلاً لأنّ هذا يسبقُها.
//
// موتُ التوكنِ رقمٌ لا نوع: ١٩٠ (منتهٍ أو مسحوب) و١٠٢ (جلسةٌ باطلة).
export function isAuthError(e) {
  const code = Number(e?.body?.error?.code);
  return code === 190 || code === 102;
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

      // ثلاثةُ أحداثٍ غيرِ الرسالة تصلُ بنفسِ المجرى، وكلٌّ منها يغيّرُ ما تراه
      // التاجرةُ على الشاشة: رأى الزبونُ ما أرسلناه، أو تفاعلَ على رسالة.
      if (!msg) {
        if (ev.read && businessId && senderId) {
          // watermark: كلُّ ما أُرسِلَ قبلَ هذا الوقتِ صارَ مرئيّاً
          const seenAt = ev.read.watermark ? new Date(Number(ev.read.watermark)) : new Date();
          await query(
            `UPDATE ig_conversations c SET seen_at = $3
             FROM stores s WHERE c.store_id = s.id AND c.ig_sender_id = $2
               AND (s.ig_user_id = $1 OR s.ig_page_id = $1)`,
            [businessId, senderId, seenAt]
          );
        } else if (ev.reaction?.mid) {
          const val = ev.reaction.action === 'unreact' ? '' : (ev.reaction.reaction || 'love');
          await query('UPDATE ig_messages SET reaction = $2 WHERE mid = $1', [ev.reaction.mid, val]);
        }
        continue;
      }
      if (!businessId || !senderId) continue;

      // نجد المتجر صاحب هذا الحساب. لو الرسالة "echo" (صادرة) فالمُرسِل هو المتجر.
      const isEcho = Boolean(msg.is_echo);
      const storeIgId = isEcho ? senderId : businessId;
      const customerId = isEcho ? businessId : senderId;

      // رسائلُ ماسنجر تصلُ بمعرّفِ **الصفحة** لا بمعرّفِ حسابِ إنستغرام. كان البحثُ
      // بـig_user_id وحدَه، فكلُّ رسالةِ فيسبوكَ تسقطُ هنا بسطرِ «لا متجر لهذا الحساب»
      // — وصلت، وسُجّلت بالسِّجلّ، ولم يرَها أحد.
      const sr = await query(
        `SELECT id, user_id, name, slug, ig_access_token, ig_page_id, ig_user_id,
                delivery_tiers, free_shipping_over
         FROM stores WHERE (ig_user_id = $1 OR ig_page_id = $1) AND ig_connected = true`,
        [storeIgId]
      );
      const store = sr.rows[0];
      if (!store) {
        // وصلنا حدثٌ لحسابٍ لا نعرفُه: إمّا الربطُ سُجّل بمعرّفٍ آخر، أو فُصل الحساب.
        // بلا هذا السطرِ يبدو الأمرُ كأنّ Meta لم تُرسل شيئاً، والفرقُ بينهما كلُّ التشخيص.
        console.log('ig webhook: لا متجر لهذا الحساب', storeIgId);
        continue;
      }

      // القناةُ تُعرَفُ من المعرّفِ الذي طابقَ لا من body.object وحدَه: ميتا تُرسلُ
      // رسائلَ إنستغرام تحتَ object:'page' ببعضِ الإعدادات، فالمطابقةُ أصدق.
      const channel = String(storeIgId) === String(store.ig_page_id || '') ? 'messenger' : 'instagram';

      const text = msg.text || '';
      // النوعُ يقرّرُ كيف يُعرَض المرفق: صورةٌ تُعرَضُ صورةً وفيديو يُشغَّل. بلا حفظِه
      // يصيرُ كلُّ شيءٍ رابطاً مكتوباً عليه «مرفق».
      const att = msg.attachments?.[0] || null;
      // زرُّ اللايك بالماسنجرِ ملصقٌ لا صورة: يصلُ بنوعِ `image` ومعه `sticker_id`.
      // وكنّا نعاملُه صورةَ قطعةٍ فنجلبُه ونبعثُه للنموذجِ ليصفَه ويبحثَ عن شبيهٍ
      // له بالكتالوج — نداءُ رؤيةٍ كاملٌ على إبهام، وردٌّ لا معنى له.
      //
      // وهو ليس بلا معنىً للزبون: إبهامٌ بعدَ سؤالٍ يعني «تمام». فنقرأُه كما يُقرَأ.
      const attType = attachmentKind(msg, att);
      // ننسخُ المرفقَ عندنا فوراً: رابطُ Meta ينتهي بعد أيّام فتصيرُ محادثاتُ التاجرةِ
      // القديمةُ مربّعاتٍ مكسورة. النسخُ مرّةً واحدةً هنا يجعلُها تبقى.
      const attachment = att?.payload?.url ? await mirrorRemote(att.payload.url, 'ig/messages') : '';
      const preview = text || (attachment ? ATTACHMENT_LABEL[attType] || '📎 مرفق' : '');

      // حدثٌ بلا نصٍّ ولا مرفقٍ ليس رسالة (مشاركةُ رقمٍ مثلاً): لا يُخزَّنُ فقاعةً
      // فارغة، ولا — وهو الأهمُّ — يرفعُ عدّادَ غيرِ المقروءِ ويمسحُ سطرَ آخرِ رسالةٍ
      // بسطرٍ فارغ. كان الفحصُ بعد الحفظِ فوقعَ الضرران قبلَه.
      if (!text && !attachment) continue;

      // upsert المحادثة (صف واحد لكل زبون بهذا المتجر) — نرفع غير المقروء للوارد فقط
      const conv = await query(
        `INSERT INTO ig_conversations (store_id, ig_sender_id, last_message, last_at, unread, channel)
         VALUES ($1, $2, $3, now(), $4, $5)
         ON CONFLICT (store_id, ig_sender_id) DO UPDATE
           SET last_message = EXCLUDED.last_message,
               last_at = now(),
               unread = ig_conversations.unread + $4,
               channel = EXCLUDED.channel
         RETURNING id, customer_name, customer_username, customer_avatar, (xmax = 0) AS is_new`,
        [store.id, customerId, preview, isEcho ? 0 : 1, channel]
      );
      const convId = conv.rows[0].id;

      // ردُّ الزبونِ على ستوري: صورتُها تُنسَخُ عندنا لتبقى، فرابطُ Meta ينتهي.
      const storyUrl = msg.reply_to?.story?.url
        ? await mirrorRemote(msg.reply_to.story.url, 'ig/stories')
        : '';

      // صدى رسالةٍ كتبَتْها البائعةُ قبلَ قليل؟ إذاً هو ردُّها لا ردُّ التاجرة.
      // الطرفُ الآخرُ من السباقِ نفسِه: recordBotMessage تَسِمُ متى سبقَنا الصدى،
      // وهذا يَسِمُ متى سبقناه نحن بصفٍّ بلا mid.
      const echoIsBot = isEcho && text
        ? (await query(
          `SELECT 1 FROM ig_messages WHERE conversation_id = $1 AND direction = 'out'
             AND ai = true AND text = $2 AND created_at > now() - interval '3 minutes' LIMIT 1`,
          [convId, text]
        ).catch(() => ({ rows: [] }))).rows.length > 0
        : false;

      // نخزّن الرسالة (mid فريد → لا يتكرّر نفس الحدث ولا ردّنا الذي عاد كـ echo)
      await query(
        `INSERT INTO ig_messages (conversation_id, mid, direction, text, attachment_url, attachment_type, reply_to_mid, story_url, ai)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (mid) DO NOTHING`,
        [convId, msg.mid || null, isEcho ? 'out' : 'in', text, attachment, attType,
          msg.reply_to?.mid || '', storyUrl, echoIsBot]
      );

      if (isEcho) continue; // ردّنا/ردّ المتجر — لا إشعار

      // اسم الزبون وصورتُه: يُجلبان عند أوّل رسالةٍ ومتى غابت الصورة. ويُحتاجان قبل
      // الإشعارِ لا بعدَه، لأنّ الإشعارَ يحملُ اسمَه وصورتَه لا عنواناً عامّاً.
      let who = conv.rows[0].customer_name || conv.rows[0].customer_username || '';
      let avatar = conv.rows[0].customer_avatar || '';
      if (conv.rows[0].is_new || !avatar) {
        const token = decrypt(store.ig_access_token);
        if (token) {
          const prof = await getSenderProfile(token, customerId, channel, store.ig_page_id);
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
        title: who || (channel === 'messenger' ? 'رسالة ماسنجر' : 'رسالة إنستغرام'),
        body: preview.slice(0, 120),
        url: `/dashboard/instagram/${convId}`,
        tag: `ig-${convId}`,
        icon: avatar || undefined,
      });

      // البائعةُ الآليّة: تردُّ الآنَ إن أذنت التاجرةُ وغابت عن الشاشة. تُنادى بعدَ
      // الإشعارِ لا قبلَه — لو تعثّرت (مزوّدُ ذكاءٍ ساقطٌ مثلاً) تكونُ التاجرةُ قد
      // عرفت برسالةِ زبونتِها على أيِّ حال. ولا ننتظرُها: الـwebhook ردَّ 200 من
      // زمان، وتأخيرُ الحلقةِ هنا يؤخّرُ باقي رسائلِ الدفعة.
      maybeAutoReply({
        store, convId, customerId, text, isNew: conv.rows[0].is_new, who, channel,
        // رابطُ Meta الأصليُّ لا نسختُنا على كلاوديناري: هو طازجٌ الآنَ وقراءتُه
        // مجّانيّةٌ علينا، ونسختُنا تُكلّفُ من حصّةِ التسليمِ المحدودة.
        mediaUrl: att?.payload?.url || '', mediaType: attType,
      })
        .catch((e) => console.error('⚠️ البائعة الآلية:', e.message));
    }
  }
}

// ═════════════════════ البائعة الآلية ═════════════════════

// تسجيلُ رسالةٍ أرسلَتْها البائعةُ — موسومةً أنّها آليّة، مهما سبقَنا صدى ميتا.
//
// ميتا تُعيدُ إلينا كلَّ ما نرسلُه كحدثِ echo، وحدثُ الصدى يُدرَجُ بلا وسمِ ai
// (افتراضُ العمودِ false). فإذا وصلَ الصدى قبلَ أن نكتبَ صفَّنا — وهو سباقٌ يقعُ
// فعلاً — كان `ON CONFLICT DO NOTHING` يُسقِطُ كتابتَنا بصمت، فيبقى ردُّ البائعةِ
// مكتوباً في القاعدةِ كأنّه **ردُّ التاجرةِ بيدِها**. وحارسُ «التاجرةُ على الشاشة»
// يرى ردّاً يدويّاً عمرُه ثانية، فيُسكِتُ البائعةَ عشرَ دقائق — بعدَ ردٍّ واحد.
//
// فالكتابةُ هنا تُصرُّ على الوسمِ أيّاً كان الترتيب.
async function recordBotMessage(convId, mid, text) {
  // الختمُ أوّلاً ومهما جرى بعدَه: حارسُ «التاجرةُ على الشاشة» يقيسُ عليه، فلو
  // سقطت كتابةُ الصفِّ (إعادةُ تشغيلٍ بين الإرسالِ والكتابة) بقيَ الحارسُ يعرفُ
  // أنّ ما وصلَ بعدَ ثوانٍ هو صدانا لا ردُّ تاجرة.
  await query('UPDATE ig_conversations SET bot_sent_at = now() WHERE id = $1', [convId])
    .catch(() => {});
  if (mid) {
    await query(
      `INSERT INTO ig_messages (conversation_id, mid, direction, text, ai)
       VALUES ($1, $2, 'out', $3, true)
       ON CONFLICT (mid) DO UPDATE SET ai = true`,
      [convId, mid, text]
    );
    return;
  }
  // بلا mid لا يقعُ تعارضٌ أصلاً (NULL لا يساوي NULL في فهرسٍ فريد)، فصدى ميتا
  // يُنشئُ صفّاً ثانياً بلا وسم. نَسِمُ الموجودَ إن كان وصلَ، وإلّا نكتبُ صفَّنا.
  const up = await query(
    `UPDATE ig_messages SET ai = true
      WHERE conversation_id = $1 AND direction = 'out' AND text = $2
        AND created_at > now() - interval '3 minutes'`,
    [convId, text]
  );
  if (!up.rowCount) {
    await query(
      `INSERT INTO ig_messages (conversation_id, mid, direction, text, ai)
       VALUES ($1, NULL, 'out', $2, true)`,
      [convId, text]
    );
  }
}

// تسجيلُ طلبٍ من محادثةٍ اكتملت شروطُها. يُنشَأُ بنفسِ شكلِ طلبِ الموقعِ حرفيّاً
// (نفسُ الجدولِ ونفسُ الحالةِ ونفسُ صيغةِ البنود)، فيظهرُ في «طلباتي» ويدخلُ
// الحسابَ والمخزونَ وشركةَ التوصيلِ كأيِّ طلبٍ آخر — لا كسجلٍّ جانبيٍّ للبائعة.
//
// والسعرُ يُقرأُ من القاعدةِ لا ممّا قالته البائعة، وأجرةُ التوصيلِ تُحسَبُ من
// مدينةِ الزبونةِ بجدولِ المتجر. فحتى لو أخطأَ النموذجُ برقمٍ بالمحادثة، الطلبُ
// المسجَّلُ صحيح.
// السعرُ الذي يُسجَّلُ فعلاً. الأصلُ سعرُ القاعدةِ لا ما قالته البائعة — لكنّ
// المفاصلةَ اتّفاقٌ قالته باسمِ المتجرِ وقبلَه الزبون. أن نَعِدَ بـ١٧٠ ونسجّلَ ١٨٠
// ليس «حرصاً على التاجرة» بل إخلافُ وعدٍ يكتشفُه الزبونُ لحظةَ الاستلام — وهذا ما
// وقعَ فعلاً: «محنا اتفقنا على ٢٠٠».
//
// فيُقبَلُ السعرُ المتّفَقُ عليه بشرطَين: أن يكونَ لهذه القطعةِ بعينِها، وألّا ينزلَ
// تحتَ أرضيّتِها. وما عدا ذلك يعودُ لسعرِ القاعدة.
const money = (n) => Math.round(Number(n) * 100) / 100;

function agreedUnit(product, offer, bot) {
  const base = money(Number(product.price));
  if (!offer || String(offer.productId || '') !== String(product.id)) return base;
  const asked = money(Number(offer.price));
  if (!Number.isFinite(asked) || asked <= 0 || asked > base) return base;
  const floor = effectiveFloor(product, bot);
  const least = floor == null ? base : floor;
  return Math.max(least, asked);
}

async function createChatOrder(store, conv, order, customerId, { offer = null, bot = null, orderId = null } = {}) {
  // المخزونُ يُقرأُ من القاعدةِ هنا من جديد، لا من كتالوجِ البائعةِ المكشوف.
  // بين لحظةِ عرضِ النمرةِ ولحظةِ تسجيلِ الطلبِ دقائقُ كاملة: تكفي لتؤكّدَ التاجرةُ
  // طلباً آخرَ فيُخصَمَ آخرُ ما بقي، أو تحذفَ النمرةَ بيدِها. هذا آخرُ حاجزٍ قبلَ
  // أن يصيرَ الوعدُ طلباً مسجَّلاً — وما بعدَه زبونةٌ تنتظرُ قطعةً غيرَ موجودة.
  const p = (await query(
    `SELECT id, name, price, cost, stock, size_stock, color_stock, store_id
       FROM products WHERE id = $1 AND store_id = $2 AND hidden_at IS NULL`,
    [order.product.id, store.id]
  )).rows[0];
  if (!p) throw new Error('القطعة لم تعد متاحة.');
  if (!variantAvailable(p, order.color, order.size)) {
    const e = new Error('نفدت');
    e.soldOut = true;
    throw e;
  }

  const unit = agreedUnit(p, offer, bot);
  const subtotal = unit * order.qty;

  // الزبونةُ تقولُ «رابا» لا «جنين — رابا». وطلبُ الموقعِ يخزّنُ المدينةَ الأمَّ
  // بحقلِ المدينةِ والقريةَ بحقلِها، وعليه تبني شركةُ التوصيلِ إرسالَها. فنفصلُهما
  // هنا بنفسِ المنطقِ تماماً، وإلّا خرجَ من المحادثةِ طلبٌ بمدينةٍ لا يعرفُها المندوب.
  let cityName = String(order.city || '').trim();
  let areaName = '';
  const parent = cityOfVillage(cityName);
  if (parent) { areaName = cityName; cityName = parent; }
  const deliveryFee = feeForCity(cityName, store.delivery_tiers);
  const freeOver = Number(store.free_shipping_over) || 0;
  const fee = freeOver > 0 && subtotal >= freeOver ? 0 : deliveryFee;
  const total = subtotal + fee;
  const reference = 'BZ-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  const items = [{
    id: p.id, name: p.name, price: unit, qty: order.qty,
    size: order.size || '', color: order.color || '',
    // لقطةُ التكلفةِ لحظةَ البيعِ — بدونها يُعرَضُ ربحُ هذا الطلبِ «تقديريّاً» وحدَه
    // بين طلباتٍ ربحُها مؤكّد.
    cost: p.cost != null ? Number(p.cost) : null,
  }];

  // تعديلُ طلبٍ قائمٍ بدل إنشاءِ ثانٍ. الزبونُ يغيّرُ رأيَه بالنمرةِ أو اللونِ أو
  // العنوانِ بعدَ التسجيلِ بدقيقة، وكانت البائعةُ إمّا تعتذرُ وتُحيلَه للتاجرةِ أو
  // تُسجّلَ طلباً ثانياً للقطعةِ نفسِها. وكلاهما خطأ.
  //
  // والشرطُ أنّ الطلبَ ما زالَ `new`: بتأكيدِ التاجرةِ يُخصَمُ المخزونُ وقد يذهبُ
  // للتوصيل، فتعديلُه بعدَها قرارُها هي لا قرارُ محادثة.
  let id = null;
  let ref = reference;
  let edited = false;
  if (orderId) {
    const cur = (await query(
      'SELECT id, reference, status FROM orders WHERE id = $1 AND store_id = $2',
      [orderId, store.id]
    )).rows[0];
    // طلبٌ مُلغىً ليس طلباً يُعدَّل — ولا هو حاجزٌ يمنعُ الزبونَ من الطلبِ ثانيةً.
    // نتركُه ونُنشئُ جديداً، وإلّا قيلَ لمن أُلغيَ طلبُه «طلبك جاهزٌ للتوصيل».
    if (cur && cur.status === 'cancelled') {
      // لا نلمسُ الملغى، والربطُ يُحدَّثُ للطلبِ الجديدِ أدناه
    } else if (cur && cur.status === 'new') {
      await query(
        `UPDATE orders SET customer_name = $2, customer_phone = $3, items = $4, total = $5,
           city = $6, area = $7, address = $8, delivery_fee = $9
         WHERE id = $1`,
        [cur.id, order.name, order.phone, JSON.stringify(items), total,
          cityName, areaName, order.address, fee]
      );
      id = cur.id;
      ref = cur.reference;
      edited = true;
    } else if (cur) {
      const e = new Error('الطلب تأكّد ولم يعد يُعدَّل من المحادثة.');
      e.locked = true;
      e.reference = cur.reference;
      throw e;
    }
  }

  if (!id) {
    const ins = await query(
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total,
         currency, status, reference, city, area, address, notes, delivery_fee)
       VALUES ($1,$2,'',$3,$4,$5,'ILS','new',$6,$7,$8,$9,$10,$11) RETURNING id`,
      [store.id, order.name, order.phone, JSON.stringify(items), total, reference,
        cityName, areaName, order.address, 'طلب سجّلته البائعة الآلية من رسائل إنستغرام', fee]
    );
    id = ins.rows[0].id;
    await query('UPDATE ig_conversations SET order_id = $2 WHERE id = $1', [conv.id, id]);
  }

  // ميتا ترفضُ قراءةَ ملفِّ مُرسِلِ ماسنجر أحياناً («Unsupported get request»)
  // فيبقى بالصندوقِ باسمِ «زبون» بلا اسمٍ ولا صورة — وهي ترفضُ القراءةَ لا
  // الإرسال، فلا حيلةَ لنا عندَها. لكنّ الزبونَ قالَ اسمَه بنفسِه ليُسجَّلَ طلبُه،
  // وهو أصدقُ من أيِّ اسمٍ نجلبُه: نكتبُه بالمحادثةِ إن كانت بلا اسم.
  if (order.name && !conv.customer_name) {
    await query(
      "UPDATE ig_conversations SET customer_name = $2 WHERE id = $1 AND COALESCE(customer_name, '') = ''",
      [conv.id, order.name]
    ).catch(() => {});
  }

  notifyUser(store.user_id, {
    type: 'order',
    title: `${edited ? '✏️ تعديل طلب' : '🛍️ طلب جديد'} — ${order.name}`,
    body: `${p.name}${order.color ? ' · ' + order.color : ''}${order.size ? ' · نمرة ' + order.size : ''} — ₪${total}`,
    url: '/dashboard?tab=myOrders',
    tag: `order-${id}`,
  });

  return {
    reference: ref,
    total,
    unit,
    edited,
    deliveryFee: fee,
    itemLine: `${p.name}${order.color ? ' — ' + order.color : ''}${order.size ? ' — نمرة ' + order.size : ''}${order.qty > 1 ? ` — ${order.qty} قطع` : ''}`,
  };
}

// كم دقيقةً نعتبرُ التاجرةَ فيها «على الشاشة» بعدَ ردِّها؟ ردُّها بيدِها يعني أنّها
// موجودة، ومقاطعتُها بردٍّ آليٍّ في منتصفِ حديثِها أسوأُ من ألّا نردَّ أصلاً.
const OWNER_PRESENT_MINUTES = 10;
// بعدَها يسقطُ التسليمُ للتاجرةِ إن لم تردَّ: لا نتركُ الزبونَ بلا أحدٍ إلى الأبد.
const PAUSE_HOURS = 6;

// هل يسقطُ التسليمُ للتاجرةِ فيعودُ الردُّ الآليّ؟ مُصدَّرةٌ ليفحصَها الاختبارُ
// بكلِّ حالاتِها: هذا القرارُ بالذاتِ هو ما تركَ زبوناً بلا أحدٍ يردُّ عليه.
//   • ختمٌ فارغٌ = تسليمٌ قديمٌ سبقَ الترقية ⇒ يسقط (وإلّا بقيَ أبديّاً)
//   • ردَّت التاجرةُ بعدَه ⇒ تولّت فانتهى دورُه
//   • مضت ستُّ ساعاتٍ ولم يردَّ أحدٌ ⇒ الصمتُ أسوأُ من ردٍّ آليّ
// ووضعُ التجربةِ يُقصّرُ المهلةَ إلى دقيقتين. التاجرةُ حينَها تُجرّبُ بنفسِها، ولا
// أحدَ ينتظرُ ردّاً بشريّاً — وستُّ ساعاتِ صمتٍ تعني أنّ كلَّ تسليمٍ يُنهي جلسةَ
// التجربةِ كلَّها. تُطفأُ التجربةُ فتعودُ الستُّ ساعاتُ وحدَها.
const PAUSE_HOURS_TEST = 2 / 60;

export function shouldResume({ pausedAt, ownerRepliedAfter = false, now = Date.now(), testing = false }) {
  if (!pausedAt) return true;
  const hours = (now - new Date(pausedAt).getTime()) / 3600000;
  return hours >= (testing ? PAUSE_HOURS_TEST : PAUSE_HOURS) || ownerRepliedAfter === true;
}

// ردٌّ آليٌّ على رسالةٍ واردة. كلُّ حارسٍ هنا مكتوبٌ لأنّ ما بعدَه يذهبُ لزبونةٍ
// حقيقيّةٍ باسمِ المتجر: لا رجعةَ في رسالةٍ أُرسِلت.
// ───────────────────── دفعةُ الرسائلِ الواحدة ─────────────────────
//
// الناسُ لا يكتبونَ بالدايركت رسالةً واحدةً مكتملة، يكتبونَ فكرةً مقطّعةً على أربعِ
// رسائلٍ بأربعِ ثوانٍ. وكانت البائعةُ تردُّ على كلِّ واحدةٍ على حدةٍ لأنّ كلَّ واحدةٍ
// حدثُ webhook مستقلّ — فتخرجُ ردّانِ متتاليانِ متشابهانِ ومتناقضان. هذا حرفيّاً ما
// رأته الزبونةُ في المحادثةِ الأخيرة: تحيّتانِ مختلفتانِ بنفسِ الدقيقة، ثمّ ضحكتانِ
// على ضحكتِها الواحدة. ولا بائعةَ بشرٌ تفعلُ هذا.
//
// فننتظرُ أن تسكتَ ثمانيَ ثوانٍ قبلَ أن نفكّر. كلُّ رسالةٍ جديدةٍ تُلغي الموعدَ
// وتفتحُ غيرَه، وحينَ يحينُ الموعدُ نقرأُ المحادثةَ كلَّها من القاعدةِ — وقد صارت
// رسائلُها الأربعُ فيها — فنردُّ ردّاً واحداً يجمعُهنّ.
//
// والانتظارُ ليس أبديّاً: زبونةٌ تكتبُ بلا توقّفٍ كانت ستبقى بلا ردّ، فبعدَ نصفِ
// دقيقةٍ من أوّلِ رسالةٍ نردُّ مهما استمرّت.
//
// وفائدةٌ ثانيةٌ مجّانيّة: ثماني ثوانٍ نافذةٌ تلحقُ فيها التاجرةُ لتردَّ بنفسِها
// قبلَ أن تسبقَها البائعة، وحُرّاسُ «التاجرةُ على الشاشة» كلُّها تُفحَصُ عندَ
// الموعدِ لا عندَ وصولِ الرسالة.
const BURST_MS = 8000;
const BURST_MAX_MS = 30000;
const bursts = new Map();

// كم ننتظرُ بعدَ هذه الرسالة، ونحن ننتظرُ منذُ waited مللي؟ مُصدَّرةٌ ليفحصَها
// الاختبار: السقفُ هو ما يمنعُ زبونةً كثيرةَ الكتابةِ أن تبقى بلا ردٍّ إلى الأبد.
export function burstDelay(waited) {
  return Math.max(0, Math.min(BURST_MS, BURST_MAX_MS - Number(waited || 0)));
}

function maybeAutoReply(args) {
  const key = args.convId;
  if (!key) return runAutoReply(args).catch((e) => console.error('⚠️ البائعة الآلية:', e.message));

  const prev = bursts.get(key);
  if (prev) clearTimeout(prev.timer);
  const since = prev?.since || Date.now();

  // مرفقٌ وصلَ بأوّلِ الدفعةِ ثمّ تلتْه كلمة: الكلمةُ لا تُلغي الصورة. نحملُ آخرَ
  // مرفقٍ رأيناهُ بالدفعةِ إن لم يحملْ آخرُ رسالةٍ مرفقاً بنفسِها.
  const merged = args.mediaUrl ? args : { ...args, mediaUrl: prev?.args?.mediaUrl || '', mediaType: prev?.args?.mediaType || '' };
  // «جديدة» صفةُ الدفعةِ لا صفةُ آخرِ رسالةٍ فيها
  merged.isNew = prev?.args?.isNew || args.isNew;

  const delay = burstDelay(Date.now() - since);
  const timer = setTimeout(() => {
    bursts.delete(key);
    runAutoReply(merged).catch((e) => console.error('⚠️ البائعة الآلية:', e.message));
  }, delay);
  if (typeof timer.unref === 'function') timer.unref();
  bursts.set(key, { timer, since, args: merged });
  return Promise.resolve();
}

async function runAutoReply({ store, convId, customerId, text, isNew, who, channel = 'instagram', mediaUrl = '', mediaType = '' }) {
  // صورةٌ أو صوتٌ بلا كلام لم يكن يُجابُ عليه أصلاً — كانت البائعةُ تُدير ظهرَها
  // لنصفِ ما يصلُ الدايركت. الآن تنظرُ وتسمع.
  const isImage = mediaType === 'image' && Boolean(mediaUrl);
  const isVoice = mediaType === 'audio' && Boolean(mediaUrl);
  // ملصقٌ لا صورة: لا يُجلَبُ ولا يُرسَلُ للرؤية. إبهامٌ بعدَ سؤالٍ يعني «تمام»،
  // وتجاهلُه يتركُ الزبونَ بلا ردٍّ على شيءٍ قالَه فعلاً.
  const isSticker = mediaType === 'sticker';
  if (!text && !isImage && !isVoice && !isSticker) return;
  const bot = await loadBot(store.id);
  // القناةُ الحقيقيّةُ لا 'instagram' دائماً: تاجرةٌ فتحت الدايركت ولم تفتحِ
  // الماسنجر يجبُ أن يبقى ماسنجرُها صامتاً.
  if (!botActiveNow(bot, channel, { isFirstMessage: Boolean(isNew) })) return;

  // حالةُ المحادثةِ مقروءةٌ على حدةٍ لا ضمنَ upsert الرسالة: خادمٌ لم تصلْه
  // الترقيةُ بعدُ كان سيُسقطُ استقبالَ الرسائلِ كلَّه بعمودٍ مفقود.
  let conv;
  try {
    const r = await query(
      `SELECT id, order_id, bot_paused, bot_paused_at, bot_sent_at, bot_replies, bot_stage, customer_username, customer_name
       FROM ig_conversations WHERE id = $1`,
      [convId]
    );
    conv = r.rows[0];
  } catch (err) {
    if (err.code === '42703') return; // الأعمدةُ لم تصل بعد
    throw err;
  }
  if (!conv) return;

  // التسليمُ ليس أبديّاً. كان «محادثةٌ سُلِّمت لإنسانٍ تبقى له» — منطقيٌّ ساعتَه،
  // وبالواقعِ تاجرةٌ لم تردَّ وزبونٌ عادَ بعدَ يومٍ بموضوعٍ جديد، فلا يجيبُه أحدٌ
  // إطلاقاً. وصمتُ الجميعِ أسوأُ من ردٍّ آليٍّ أو من ردٍّ متأخّرٍ بشريّ.
  //
  // يسقطُ التسليمُ في حالتين: أن تردَّ التاجرةُ بعدَه (تولّت فانتهى دورُه — ويحميها
  // بعدَها حارسُ العشرِ دقائق)، أو أن تمرَّ ستُّ ساعاتٍ ولم يردَّ أحد.
  if (conv.bot_paused) {
    const pausedAt = conv.bot_paused_at || null;
    let ownerRepliedAfter = false;
    if (pausedAt) {
      // ردُّ التاجرةِ يصلُنا echo ويُخزَّنُ out بلا وسمِ ai — فنعرفُه أينما ردّت
      const after = await query(
        `SELECT 1 FROM ig_messages WHERE conversation_id = $1 AND direction = 'out'
           AND ai = false AND created_at > $2
           AND created_at > COALESCE($3::timestamptz, '-infinity'::timestamptz) + interval '20 seconds'
         LIMIT 1`,
        [convId, pausedAt, conv.bot_sent_at || null]
      ).catch(() => ({ rows: [] }));
      ownerRepliedAfter = after.rows.length > 0;
    }
    if (!shouldResume({ pausedAt, ownerRepliedAfter, testing: bot.bot_test_only === true })) return;
    await query(
      'UPDATE ig_conversations SET bot_paused = false, bot_paused_at = NULL, bot_replies = 0 WHERE id = $1',
      [convId]
    ).catch(() => {});
    conv.bot_paused = false;
    conv.bot_replies = 0;
  }

  // وضعُ التجربة: لا تُكلَّمُ إلّا الحساباتُ المذكورةُ بالاسم. ويُفحَصُ قبلَ كلِّ
  // شيءٍ آخرَ ليبقى الحارسُ واحداً لا يُلتَفُّ عليه من أيِّ مسار.
  if (!testModeAllows(bot, conv.customer_username, conv.customer_name, customerId)) return;
  // بلغَت حدَّها: تُسلِّمُ **معلنةً** لا صامتة. الصمتُ هنا أسوأُ من الحدِّ نفسِه —
  // ظلَّ الزبونُ يسألُ ثمّ كتب «مالك بطّلت تردّي؟» ولا أحدَ يعلمُ أنّه ينتظر.
  if (Number(conv.bot_replies) >= MAX_BOT_REPLIES) {
    if (!conv.bot_paused) {
      const token = decrypt(store.ig_access_token);
      const bye = 'خليني أخلي صاحبة المتجر ترد عليك بنفسها، بتكون معك بعد شوي 🌷';
      if (token) {
        try {
          const sent = await sendMessage(token, customerId, bye);
          await recordBotMessage(convId, sent?.message_id || null, bye);
        } catch { /* خارجَ النافذةِ أو توكنٌ ميّت: التسليمُ يبقى قائماً */ }
      }
      await query('UPDATE ig_conversations SET bot_paused = true, bot_paused_at = now(), last_at = now() WHERE id = $1', [convId]);
      notifyUser(store.user_id, {
        type: 'instagram',
        title: `🙋 ${who || 'زبون'} بانتظار ردّك`,
        body: 'البائعة الآلية وصلت حدّها بهالمحادثة وسلّمتك إيّاها.',
        url: `/dashboard/instagram/${convId}`,
        tag: `ig-${convId}`,
      });
    }
    return;
  }

  // هل ردّت التاجرةُ بيدِها قريباً؟ ردُّها من تطبيقِ إنستغرام يصلُنا echo ويُخزَّنُ
  // out بلا وسمِ ai — فالحارسُ يعملُ أينما ردّت.
  //
  // لكنّ **صدى البائعةِ نفسِها** يصلُ بنفسِ الشكل. ووسمُ ai وحدَه لا يكفي حارساً:
  // كلُّ ما يُسقِطُ كتابتَنا (سباقٌ مع الصدى، إعادةُ تشغيلٍ بين الإرسالِ والكتابة،
  // صفٌّ قديمٌ كُتِبَ قبلَ الإصلاح) يتركُ ردَّ البائعةِ مكتوباً كأنّه ردُّ تاجرة —
  // فتُسكِتُ البائعةُ نفسَها عشرَ دقائقَ بردِّها هي. وهذا ما وقعَ فعلاً مرّتين.
  //
  // فالحارسُ يقيسُ على وقتِ إرسالِنا: صدانا يعودُ خلالَ ثوانٍ، وردُّ إنسانٍ يكتبُ
  // بيدِه يأتي بعدَها. ما وصلَ خلالَ العشرينَ ثانيةً التاليةَ لإرسالِنا ليس ردَّ
  // تاجرة، مهما كان وسمُه — ولا حاجةَ لتصحيحِ الصفوفِ القديمةِ بعدَ اليوم.
  const recent = await query(
    `SELECT 1 FROM ig_messages m
      WHERE m.conversation_id = $1 AND m.direction = 'out' AND m.ai = false
        AND m.created_at > now() - interval '${OWNER_PRESENT_MINUTES} minutes'
        AND m.created_at > COALESCE($2::timestamptz, '-infinity'::timestamptz) + interval '20 seconds'
      LIMIT 1`,
    [convId, conv.bot_sent_at || null]
  ).catch(() => ({ rows: [] }));
  if (recent.rows.length) return;

  // «عم تكتب…» قبلَ التفكيرِ لا بعدَه: النموذجُ يأخذُ أربعَ ثوانٍ، وهي فراغٌ ميّتٌ
  // بالمحادثةِ ما لم يرَ الزبونُ أنّ أحداً يكتب. فشلُه لا يوقفُ شيئاً.
  const igToken = decrypt(store.ig_access_token);
  if (igToken) sendTyping(igToken, customerId, true).catch(() => {});

  // الصوتُ يُفرَّغُ نصّاً فيدخلُ المحادثةَ ككلامٍ عاديّ — والتفريغُ يُحفَظُ بالرسالةِ
  // نفسِها كي تقرأَه التاجرةُ أيضاً بدل أن ترى «🎤 رسالة صوتية» بلا مضمون.
  let heard = '';
  if (isVoice) {
    if (canHear()) {
      try {
        heard = await transcribe(mediaUrl);
        if (heard) {
          await query(
            "UPDATE ig_messages SET text = $2 WHERE conversation_id = $1 AND attachment_url <> '' AND text = '' AND direction = 'in' AND id = (SELECT id FROM ig_messages WHERE conversation_id = $1 AND direction = 'in' ORDER BY created_at DESC LIMIT 1)",
            [convId, heard]
          ).catch(() => {});

        }
      } catch (e) {
        console.error('⚠️ تفريغ الصوت:', e.message);
      }
    }
    if (!heard) {
      // لا نصمت: الصمتُ أمامَ رسالةٍ صوتيّةٍ يبدو تجاهلاً. نقولُها بصراحةٍ ونطلبُ الكتابة.
      const say = 'سمعت إنّك بعتّ رسالة صوتية بس ما قدرت أسمعها 🌷 بتكتبيلي شو بتحتاجي؟';
      if (igToken) {
        try {
          const sent = await sendMessage(igToken, customerId, say);
          await recordBotMessage(convId, sent?.message_id || null, say);
          await query('UPDATE ig_conversations SET last_message = $2, last_at = now(), bot_replies = bot_replies + 1 WHERE id = $1', [convId, say]);
        } catch { /* خارجَ النافذة */ }
      }
      return;
    }
  }

  // الصورةُ تُقرأُ بايتاتٍ وتُمرَّرُ للنموذج. فشلُها لا يُسكِتُ البائعةَ — تردُّ على
  // النصِّ إن وُجد، وتعتذرُ إن لم يوجد.
  let image = null;
  if (isImage) {
    try { image = await imageBlock(mediaUrl); }
    catch (e) { console.error('⚠️ قراءة الصورة:', e.message); }
  }

  const hist = await query(
    `SELECT direction, text FROM ig_messages
     WHERE conversation_id = $1 AND text <> '' ORDER BY created_at DESC LIMIT 8`,
    [convId]
  );
  const messages = hist.rows.reverse()
    .map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.text }));
  const spoken = heard || text
    || (image ? 'بعتتلك صورة — شو رأيك فيها؟ في شي شبهها عندكم؟' : '')
    || (isSticker ? '(بعتلك ملصق إبهام 👍 — يعني موافق/تمام)' : '');
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: spoken });
  } else if (heard || ((image || isSticker) && !text)) {
    // آخرُ رسالةٍ محفوظةٌ بلا نصّ (مرفقٌ وحدَه) — نضعُ مكانَها ما فهمناه
    messages[messages.length - 1] = { role: 'user', content: spoken };
  }

  const out = await agentReply({
    store: { id: store.id, name: store.name || 'متجرنا' },
    bot, messages, stage: Number(conv.bot_stage) || 0,
    // الاسمُ كما يصلُنا من ميتا — به تعرفُ البائعةُ أتخاطبُ رجلاً أم امرأة
    customerName: conv.customer_name || conv.customer_username || who || '',
    image,
  });
  if (!out.reply) return;

  // القطعةُ التي تكلّمَتْ عنها: رابطُها يحوّلُ الحديثَ إلى طلبٍ بضغطة، ولقطتُها
  // تُري الزبونةَ ما يُقالُ لها. بلا الرابطِ تبقى تدوّرُ على القطعةِ بنفسِها،
  // وهناك يضيعُ أكثرُ البيع.
  // القطعُ التي تكلّمَتْ عنها بردِّها هذا — **كلُّها** لا أوّلُها وحدَه: من طلبَ
  // «تشكيلة» كان يأخذُ قطعةً واحدةً لأنّنا كنّا نقرأُ ids[0] فقط.
  let prods = [];
  if (out.ids && out.ids.length) {
    const pr = await query(
      `SELECT id, name, price FROM products
       WHERE id = ANY($1::uuid[]) AND store_id = $2 AND hidden_at IS NULL`,
      [out.ids.slice(0, 3), store.id]
    ).catch(() => ({ rows: [] }));
    // نحفظُ ترتيبَ ترشيحِ البائعةِ لا ترتيبَ القاعدة
    const byId = new Map(pr.rows.map((x) => [String(x.id), x]));
    prods = out.ids.map((id) => byId.get(String(id))).filter(Boolean).slice(0, 3);
  }
  const prod = prods[0] || null;
  const site = (process.env.PUBLIC_SITE_URL || 'https://bazarastore.site').replace(/\/$/, '');
  const linkOf = (p) => (store.slug ? `${site}/store/${store.slug}/product/${p.id}` : '');

  // الإفصاح: سياسةُ المراسلةِ عندَ Meta تطلبُ أن تعرفَ الزبونةُ أنّها تكلّمُ آليّاً،
  // والتاجرةُ تختارُ صيغتَه. يُضافُ مرّةً واحدةً بأوّلِ ردٍّ آليٍّ بالمحادثةِ فقط —
  // تكرارُه بكلِّ رسالةٍ يجعلُ الحديثَ آليّاً أكثرَ ممّا هو.
  // إتمامُ الطلب. **نحن من يُسجّلُ ونحن من يُخبر** — لا النموذج: النموذجُ ممنوعٌ
  // بنصِّ النظامِ من قولِ «تمّ التسجيل»، فالرقمُ الذي تراه الزبونةُ رقمٌ موجودٌ في
  // قاعدةِ البيانات، لا رقمٌ لطيفٌ اخترعَه نموذجٌ ليُرضيَها.
  let orderLine = '';
  if (out.order?.ready) {
    try {
      const o = await createChatOrder(store, conv, out.order, customerId, {
        offer: out.offer, bot, orderId: conv.order_id || null,
      });
      const head = o.edited ? 'عدّلت طلبك ✅' : 'تمّ تسجيل طلبك ✅';
      const tail = o.edited
        ? 'رح يروح بالشكل الجديد مع شركة التوصيل.'
        : 'رح يتسجّل بالموقع تلقائياً ويروح مع شركة التوصيل، ويوصلك خلال يوم أو يومين.';
      orderLine = `\n\n${head}\nرقم الطلب: ${o.reference}\n`
        + `${o.itemLine}\nالإجمالي: ₪${o.total} (منها ₪${o.deliveryFee} توصيل)\n${tail}`;
    } catch (e) {
      console.error('⚠️ طلب من المحادثة:', e.message);
      // طلبٌ أكّدَتْه التاجرةُ وخرجَ للتوصيل: تعديلُه قرارُها هي. نقولُها بصراحةٍ
      // ونُسلّمُ لها، لا نعتذرُ بجملةٍ غامضةٍ عن «مشكلةٍ صغيرة».
      if (e.locked) {
        orderLine = `\n\nطلبك ${e.reference} تأكّد وصار جاهز للتوصيل، فما بقدر أعدّله من هون.`
          + ' خليني أخلي صاحبة المتجر تشوفه معك 🌷';
        out.handoff = true;
      // نفادُ النمرةِ ليس عطلاً بل خبرٌ للزبونة: نقولُه بصراحةٍ ونكملُ معها بدل
      // أن نُلقيَ بها لتاجرةٍ قد لا تردُّ قبلَ ساعات.
      } else if (e.soldOut) {
        const d = out.order || {};
        const what = [d.color, d.size && ('نمرة ' + d.size)].filter(Boolean).join(' ');
        orderLine = `\n\nآسفة 🌷 ${what || 'هالخيار'} خلص من المخزن هلق قبل ما أسجّل طلبك. بتحبي أشوفلك لون أو نمرة تانية؟`;
      } else {
        orderLine = '\n\nصار في مشكلة صغيرة بتسجيل الطلب — صاحبة المتجر رح تكمّل معك حالاً 🌷';
        out.handoff = true;
      }
    }
  }

  const sign = String(bot.bot_signature || '').trim();
  const withOrder = out.reply + orderLine;
  const body = (sign && Number(conv.bot_replies) === 0) ? `${withOrder}

${sign}` : withOrder;

  const token = igToken; // فُكَّ قبلَ مؤشّرِ الكتابة — لا نفكُّه مرّتين
  if (!token) return;

  // اللقطةُ أوّلاً ثمّ النصُّ تحتَها — ترتيبُ ما تراه الزبونةُ بمحادثتِها.
  // ولا تُرسَلُ القطعةُ الواحدةُ مرّتين: البائعةُ قد تعودُ لذكرِها بردٍّ تالٍ،
  // وإعادةُ الإرسالِ جلبٌ ثانٍ من حسابِ الوسائطِ بلا فائدةٍ للزبونة.
  let result;
  try {
    result = await sendMessage(token, customerId, body);
  } catch (e) {
    if (isAuthError(e)) await markDisconnected(store.id, store.user_id);
    // خارجَ نافذةِ الـ24 ساعةِ أو أيُّ رفضٍ آخر: نصمتُ ولا نُزعجُ التاجرةَ بخطأٍ
    // لا تملكُ حياله شيئاً — رسالتُها وصلتها بالإشعارِ أصلاً.
    return;
  }

  await recordBotMessage(convId, result?.message_id || null, body);
  // بطاقةُ كلِّ قطعةٍ برسالةٍ مستقلّة: إنستغرام ترسمُ معاينةً (صورةٌ واسمٌ ومتجرٌ
  // ورابطٌ يُضغَط) للرابطِ **الأوّلِ وحدَه** في الرسالة — فعشرُ روابطَ برسالةٍ
  // واحدةٍ بطاقةٌ واحدةٌ وتسعُ عناوينَ عارية. ومن طلبَ «تشكيلة» يستحقُّ تشكيلة.
  //
  // ولا تتكرّرُ قطعةٌ أُرسِلَ رابطُها قبلاً بهذه المحادثة: كان الرابطُ يُلحَقُ بكلِّ
  // ردٍّ فتُعيدُ إنستغرام رسمَ البطاقةِ نفسِها بعدَ كلِّ رسالة — نفسُ الصورةِ خمسَ
  // مرّاتٍ بمحادثةٍ واحدة.
  for (const p of prods) {
    const url = linkOf(p);
    if (!url) continue;
    const seen = await query(
      `SELECT 1 FROM ig_messages WHERE conversation_id = $1 AND text LIKE $2 LIMIT 1`,
      [convId, `%${p.id}%`]
    ).catch(() => ({ rows: [] }));
    if (seen.rows.length) continue;
    const card = `${p.name} — ${Number(p.price)}₪\n${url}`;
    try {
      const sent = await sendMessage(token, customerId, card);
      await recordBotMessage(convId, sent?.message_id || null, card);
    } catch (e) {
      // البطاقةُ زينةٌ لا ركن: الردُّ نفسُه وصلَ قبلَها
      console.error('⚠️ بطاقة المنتج:', e.message);
    }
  }

  // صورةٌ طلبتها الزبونةُ صراحةً. لا يُرسِلُها النموذجُ ولا يصفُها — نحن نقرأُ ما
  // تملكُه القطعةُ فعلاً ونرسلُه، ونقولُ بصراحةٍ متى لم تكن صورةَ اللونِ المطلوب.
  //
  // فكلُّ قطعِ المنصّةِ اليومَ فيديو بلا صورِ ألوان، فأحسنُ ما نملكُ لقطةٌ من
  // الفيديو — وهي لا تضمنُ اللون. أن نرسلَها صامتين يعني أن تطلبَ الزبونةُ
  // الأخضرَ فترى الأحمرَ وتظنَّه الأخضر. الصدقُ هنا أرخصُ من طلبٍ مرتجَع.
  if (out.photo?.url) {
    const already = await query(
      "SELECT 1 FROM ig_messages WHERE conversation_id = $1 AND attachment_url = $2 LIMIT 1",
      [convId, out.photo.url]
    ).catch(() => ({ rows: [] }));
    if (!already.rows.length) {
      try {
        await sendAttachment(token, customerId, out.photo.url, 'image');
        let note = '';
        if (!out.photo.exact) {
          const c = String(out.photo.askedColor || '').trim();
          note = out.photo.fromVideo
            ? (c
              ? `هاي لقطة من فيديو القطعة — مش بالضرورة لون ${c}. الفيديو بيوريكي كل الألوان، افتحي رابط القطعة فوق 🌷`
              : 'هاي لقطة من فيديو القطعة. الفيديو بيوريكي كل الألوان من رابط القطعة فوق 🌷')
            : (c ? `هاي صورة القطعة — مش مخصّصة للون ${c}. رابط القطعة فوق فيه كل الصور 🌷` : '');
        }
        if (note) {
          const sentNote = await sendMessage(token, customerId, note);
          await recordBotMessage(convId, sentNote?.message_id || null, note);
        }
        await query(
          `INSERT INTO ig_messages (conversation_id, mid, direction, text, attachment_url, attachment_type, ai)
           VALUES ($1, NULL, 'out', '', $2, 'image', true)`,
          [convId, out.photo.url]
        ).catch(() => {});
      } catch (e) {
        // الصورةُ تعذّرت: الردُّ وصلَ ومعه الرابط، فلا تُترَكُ الزبونةُ بلا شيء
        console.error('⚠️ صورة المنتج:', e.message);
      }
    }
  }

  await query(
    `UPDATE ig_conversations
     SET last_message = $2, last_at = now(),
         bot_replies = bot_replies + 1, bot_stage = $3, bot_paused = $4,
         bot_paused_at = CASE WHEN $4 THEN now() ELSE NULL END
     WHERE id = $1`,
    [convId, body.slice(0, 200), out.stage, out.handoff === true]
  );
  await countReply(store.id, out.usedAi, out.handoff);

  // التسليم: البائعةُ تعرفُ حدَّها، والتاجرةُ يجبُ أن تعرفَ أنّه بلغ — وإلّا
  // بقيت زبونةٌ تنتظرُ جواباً قالت لها البائعةُ إنّه قادم.
  if (out.handoff) {
    notifyUser(store.user_id, {
      type: 'instagram',
      title: `🙋 ${who || 'زبونة'} بحاجة لردّك`,
      body: 'البائعة الآلية سلّمتك المحادثة — فيها سؤال بدّه قرارك.',
      url: `/dashboard/instagram/${convId}`,
      tag: `ig-${convId}`,
    });
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
<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#FAF9F7;font-family:system-ui,-apple-system,'Tajawal',sans-serif;color:#1F1E1D">
<div style="max-width:22rem;padding:2rem;text-align:center">
<div style="font-size:2.5rem">${title.startsWith('تم') ? '✅' : '⚠️'}</div>
<h1 style="font-size:1.1rem;margin:.75rem 0 .5rem">${title}</h1>
<p style="font-size:.9rem;line-height:1.7;color:#676664;margin:0">${body}</p>
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
    return `<a href="${href}" style="display:block;margin:.5rem 0;padding:.9rem 1rem;border-radius:1rem;background:#fff;border:1px solid rgba(23,23,23,.14);color:#313130;text-decoration:none;font-weight:700">${label}</a>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>اختر الصفحة</title></head>
<body style="margin:0;min-height:100vh;background:#FAF9F7;font-family:system-ui,-apple-system,'Tajawal',sans-serif;color:#1F1E1D">
<div style="max-width:26rem;margin:0 auto;padding:2.5rem 1.25rem">
<h1 style="font-size:1.15rem;margin:0 0 .35rem">اختر الصفحة</h1>
<p style="font-size:.85rem;color:#676664;margin:0 0 1.25rem">حسابك يدير أكثر من صفحة — أيّها تريد ربطها بهذا المتجر؟</p>
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
              last_message, last_at, unread, order_id, channel
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
    // عمودُ ai يميّزُ ردَّ البائعةِ الآليّةِ عن يدِ التاجرةِ بالمحادثة. وإن كان
    // الخادمُ لم تصلْه الترقيةُ بعدُ نُعيدُ الاستعلامَ بلا العمود: وسمٌ ناقصٌ أهونُ
    // من محادثةٍ لا تُفتَح.
    const cols = (ai) => `id, mid, direction, text, attachment_url, attachment_type,
      reply_to_mid, reaction, story_url, ${ai ? 'ai' : 'false AS ai'}, created_at`;
    const run = (ai) => (after
      ? query(
          `SELECT ${cols(ai)} FROM ig_messages WHERE conversation_id = $1 AND created_at > $2
           ORDER BY created_at ASC LIMIT 200`,
          [conv.id, after]
        )
      : query(
          `SELECT ${cols(ai)} FROM ig_messages WHERE conversation_id = $1
           ORDER BY created_at ASC LIMIT 200`,
          [conv.id]
        ));
    const r = await run(true).catch((e) => {
      if (e.code === '42703') return run(false);
      throw e;
    });
    await query('UPDATE ig_conversations SET unread = 0 WHERE id = $1', [conv.id]);
    res.json({
      conversation: {
        id: conv.id,
        customer_name: conv.customer_name,
        customer_username: conv.customer_username,
        customer_avatar: conv.customer_avatar,
        seen_at: conv.seen_at,
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
  // صورةٌ أو صوت: إنستغرام تتعاملُ معهما بنوعين مختلفين، ولو أُرسل الصوتُ صورةً رُفض
  const attachmentKind = req.body.attachmentType === 'audio' ? 'audio' : 'image';
  const replyToMid = String(req.body.replyToMid || '').trim();
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
    if (attachmentUrl) parts.push({ media: attachmentUrl, kind: attachmentKind });
    if (text) parts.push({ text });

    for (const part of parts) {
      let result;
      try {
        result = part.media
          ? await sendAttachment(token, conv.ig_sender_id, part.media, part.kind)
          : (replyToMid
            ? await sendReplyTo(token, conv.ig_sender_id, part.text, replyToMid)
            : await sendMessage(token, conv.ig_sender_id, part.text));
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
        // مرفقٌ رفضَتْه ميتا: رسالتُها إنجليزيّةٌ غامضةٌ («Invalid parameter»)،
        // والتاجرةُ تحتاجُ أن تعرفَ أنّ **المرفقَ** هو ما فشلَ لا الحسابُ كلُّه.
        if (part.media) {
          const kind = part.kind === 'audio' ? 'الرسالة الصوتية' : 'المرفق';
          return res.status(400).json({
            error: `إنستغرام ما قبل ${kind}. جرّبي تبعتيها مرّة تانية، وإذا ضلّت ابعتي نصّ.`,
          });
        }
        return res.status(400).json({ error: e.body?.error?.message || 'تعذّر إرسال الرسالة عبر إنستغرام.' });
      }

      await query(
        `INSERT INTO ig_messages (conversation_id, mid, direction, text, attachment_url, attachment_type, reply_to_mid)
         VALUES ($1, $2, 'out', $3, $4, $5, $6) ON CONFLICT (mid) DO NOTHING`,
        [conv.id, result?.message_id || null, part.text || '', part.media || '',
          part.media ? part.kind : '', part.media ? '' : replyToMid]
      );
    }

    const preview = text || ATTACHMENT_LABEL[attachmentKind] || ATTACHMENT_LABEL.image;
    await query(
      'UPDATE ig_conversations SET last_message = $2, last_at = now(), unread = 0, bot_replies = 0 WHERE id = $1',
      [conv.id, preview]
    ).catch(async (e) => {
      // خادمٌ لم تصلْه ترقيةُ البائعةِ بعد: الردُّ أهمُّ من العدّاد
      if (e.code !== '42703') throw e;
      await query('UPDATE ig_conversations SET last_message = $2, last_at = now(), unread = 0 WHERE id = $1', [conv.id, preview]);
    });
    res.json({ sent: true });
  } catch (err) {
    next(err);
  }
}

// ردودٌ جاهزةٌ لكلِّ متجر: نصوصٌ تُرسَلُ بضغطةٍ بدل كتابةِ «متوفّر» عشرين مرّةً في اليوم.
export async function igQuickReplies(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('SELECT ig_quick_replies FROM stores WHERE id = $1', [store.id]);
    res.json({ replies: r.rows[0]?.ig_quick_replies || [] });
  } catch (err) { next(err); }
}

export async function igSaveQuickReplies(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    // حدٌّ للعددِ والطول: القائمةُ شريطٌ فوقَ صندوقِ الكتابةِ لا مستودعُ نصوص
    const replies = (Array.isArray(req.body.replies) ? req.body.replies : [])
      .map((x) => String(x || '').trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 20);
    await query('UPDATE stores SET ig_quick_replies = $2 WHERE id = $1', [store.id, JSON.stringify(replies)]);
    res.json({ replies });
  } catch (err) { next(err); }
}

// POST /api/instagram/conversations/:id/react — تفاعلٌ على رسالة (❤️ أو إزالته)
// إنستغرام لا تعرفُ إلّا love، فأيُّ قيمةٍ أخرى تُرفَض. والحفظُ عندنا بعد نجاحِ
// الإرسالِ لا قبلَه: قلبٌ يظهرُ في لوحتِنا ولا يراه الزبونُ أسوأُ من لا شيء.
export async function igReact(req, res, next) {
  const mid = String(req.body.mid || '').trim();
  const reaction = req.body.reaction ? 'love' : '';
  if (!mid) return res.status(400).json({ error: 'رسالة غير محدّدة.' });
  try {
    const conv = await getOwnedConversation(req.user.id, req.params.id);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
    const token = decrypt(conv.ig_access_token);
    if (!token) return res.status(400).json({ error: 'حساب إنستغرام غير مربوط.' });
    try {
      await sendReaction(token, conv.ig_sender_id, mid, reaction);
    } catch (e) {
      if (isAuthError(e)) {
        await markDisconnected(conv.store_id, conv.user_id);
        return res.status(400).json({ error: 'انفصل حساب إنستغرام. اضغط «ربط» من جديد.' });
      }
      return res.status(400).json({ error: e.body?.error?.message || 'تعذّر إرسال التفاعل.' });
    }
    await query(
      'UPDATE ig_messages SET reaction = $2 WHERE mid = $1 AND conversation_id = $3',
      [mid, reaction, conv.id]
    );
    res.json({ ok: true, reaction });
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
    const r = await query('SELECT id, name, price, floor_price, store_id FROM products WHERE id = ANY($1::uuid[])', [ids])
      .catch((e) => (e.code === '42703'
        ? query('SELECT id, name, price, NULL AS floor_price, store_id FROM products WHERE id = ANY($1::uuid[])', [ids])
        : Promise.reject(e)));
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
        // السعرُ المتّفقُ عليه بالمحادثة: مفاصلةٌ جرت فعلاً، فلو سجّلنا الطلبَ
        // بالسعرِ المعروضِ لصارت البائعةُ تَعِدُ بما لا يُنفَّذ. ومع ذلك لا نثقُ
        // برقمِ الواجهة: يُقبَلُ فقط بين أرضيّةِ القطعةِ وسعرِها المعروض.
        const floor = p.floor_price != null ? Number(p.floor_price) : Number(p.price);
        const asked = Number(i.price);
        const unit = Number.isFinite(asked) && asked >= floor && asked <= Number(p.price)
          ? Math.round(asked * 100) / 100
          : Number(p.price);
        subtotal += unit * qty;
        return { id: p.id, name: p.name, price: unit, qty, size: i.size || '', color: i.color || '' };
      })
      .filter(Boolean);
    if (orderItems.length === 0 || subtotal <= 0) return res.status(400).json({ error: 'طلب غير صالح.' });

    const deliveryFee = Math.max(0, Number(customer?.deliveryFee) || 0);
    const total = subtotal + deliveryFee;
    let reference = 'BZ-' + crypto.randomBytes(5).toString('hex').toUpperCase();

    // المحادثةُ لها طلبٌ سلفاً؟ يُعدَّلُ لا يُستنسَخ. كانت الضغطةُ الثانيةُ تُنشئُ
    // طلباً ثانياً للقطعةِ نفسِها — ولا بابَ للتاجرةِ لتصحيحَ خطأٍ برقمٍ أو عنوان.
    // فصارَ نموذجُ التحويلِ نفسُه نموذجَ التعديل.
    //
    // وبعدَ تأكيدِ الطلبِ يُقفَل: التأكيدُ خصمَ المخزونَ وربّما أرسلَه، وتغييرُ ما
    // خرجَ للتوصيلِ يجري من صفحةِ الطلباتِ لا من هنا.
    let orderId = null;
    let reused = false;
    if (conv.order_id) {
      const cur = (await query(
        'SELECT id, reference, status FROM orders WHERE id = $1 AND store_id = $2',
        [conv.order_id, conv.store_id]
      )).rows[0];
      // الملغى يُترَكُ ويُنشَأُ جديدٌ — إلغاءُ الطلبِ لا يمنعُ الزبونَ من الطلبِ ثانية
      if (cur && cur.status !== 'new' && cur.status !== 'cancelled') {
        return res.status(409).json({
          error: `الطلب ${cur.reference} تأكّد ولم يعد يُعدَّل من هنا — عدّليه من صفحة الطلبات.`,
        });
      }
      if (cur && cur.status === 'new') {
        await query(
          `UPDATE orders SET customer_name = $2, customer_phone = $3, items = $4, total = $5,
             city = $6, area = $7, address = $8, notes = $9, delivery_fee = $10
           WHERE id = $1`,
          [cur.id, name, phone, JSON.stringify(orderItems), total,
            (customer?.city || '').trim(), (customer?.area || '').trim(), (customer?.address || '').trim(),
            `طلب من رسائل إنستغرام${customer?.notes ? ' — ' + String(customer.notes).slice(0, 400) : ''}`, deliveryFee]
        );
        orderId = cur.id;
        reference = cur.reference;
        reused = true;
      }
    }

    if (!orderId) {
      const ins = await query(
        `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total, currency, status, reference, city, area, address, notes, delivery_fee)
         VALUES ($1, $2, '', $3, $4, $5, 'ILS', 'new', $6, $7, $8, $9, $10, $11) RETURNING id`,
        [conv.store_id, name, phone, JSON.stringify(orderItems), total, reference,
          (customer?.city || '').trim(), (customer?.area || '').trim(), (customer?.address || '').trim(),
          `طلب من رسائل إنستغرام${customer?.notes ? ' — ' + String(customer.notes).slice(0, 400) : ''}`, deliveryFee]
      );
      orderId = ins.rows[0].id;
      // نربط المحادثة بالطلب (يظهر للتاجر أنها تحوّلت + يمنع تحويلها مرتين بالخطأ)
      await query('UPDATE ig_conversations SET order_id = $2 WHERE id = $1', [conv.id, orderId]);
    }

    // تأكيدٌ للزبون في محادثته: كان الطلبُ يُسجَّلُ عندنا ولا يعلمُ هو شيئاً، فيعودُ
    // يسألُ «وصلكم؟» بعد ساعة. الرسالةُ تُحفَظُ في المحادثةِ أيضاً لتراها التاجرةُ في
    // مكانها، وفشلُها لا يُسقطُ الطلب: قد تكون نافذةُ الأربعِ والعشرين ساعةً أُغلقت.
    const confirm = reused
      ? `عدّلنا طلبك ✅
رقم الطلب: ${reference}
الإجمالي: ₪${total}
رح يروح بالشكل الجديد.`
      : `تمّ تسجيل طلبك ✅\nرقم الطلب: ${reference}\nالإجمالي: ₪${total}\nرح نتواصل معك لتأكيد التوصيل.`;
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

    res.status(reused ? 200 : 201).json({ orderId, reference, total, confirmed, edited: reused });
  } catch (err) {
    next(err);
  }
}

// GET /api/instagram/conversations/:id/draft — مسوّدةُ طلبٍ مقروءةٌ من المحادثة
//
// التاجرةُ كانت تقرأُ الاسمَ والرقمَ والعنوانَ برسائلِ الزبونِ ثمّ تعيدُ كتابتَها
// بيدِها في نموذجِ التحويل — وهذا أكثرُ ما يُنفّرُ من تحويلِ المحادثاتِ إلى طلبات.
// الآن تُقرأُ مرّةً وتُملأُ الخاناتُ، وتبقى كلُّها قابلةً للتعديلِ قبلَ الحفظ.
export async function igOrderDraft(req, res, next) {
  try {
    const conv = await getOwnedConversation(req.user.id, req.params.id);
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });

    // للمحادثةِ طلبٌ مسجَّلٌ سلفاً؟ فالنموذجُ نموذجُ **تعديل**، ويجبُ أن يُظهِرَ ما
    // هو مسجَّلٌ فعلاً لا ما نُعيدُ قراءتَه من المحادثة — التاجرةُ تصحّحُ رقماً أو
    // نمرةً، فلا يجوزُ أن تُفاجأَ بحقولٍ تختلفُ عمّا في الطلب.
    if (conv.order_id) {
      const o = (await query(
        `SELECT id, reference, status, customer_name, customer_phone, items, city, area,
                address, notes, delivery_fee
           FROM orders WHERE id = $1 AND store_id = $2`,
        [conv.order_id, conv.store_id]
      )).rows[0];
      // طلبٌ مُلغىً: لا يُعرَضُ للتعديلِ بل تُقرأُ المحادثةُ من جديدٍ كأنّه لم يكن
      if (o && o.status !== "cancelled") {
        const items = Array.isArray(o.items) ? o.items : [];
        return res.json({
          found: true,
          editing: true,
          orderId: o.id,
          reference: o.reference,
          locked: o.status !== 'new',
          status: o.status,
          name: o.customer_name || '',
          phone: o.customer_phone || '',
          city: o.city || '',
          area: o.area || '',
          address: o.address || '',
          notes: /^طلب (من رسائل إنستغرام|سجّلته البائعة)/.test(String(o.notes || '')) ? '' : (o.notes || ''),
          deliveryFee: o.delivery_fee != null ? String(o.delivery_fee) : '',
          items: items.map((i) => ({
            id: String(i.id), name: i.name, price: Number(i.price) || 0,
            qty: Number(i.qty) || 1, size: i.size || '', color: i.color || '',
          })),
        });
      }
    }

    const msgs = await query(
      `SELECT direction, text FROM ig_messages
       WHERE conversation_id = $1 AND text <> '' ORDER BY created_at DESC LIMIT 25`,
      [conv.id]
    );
    const prods = await query(
      `SELECT id, name, price, color, size, color_stock FROM products
       WHERE store_id = $1 AND hidden_at IS NULL ORDER BY created_at DESC LIMIT 60`,
      [conv.store_id]
    );
    const store = (await query(
      'SELECT delivery_tiers, opost_connected FROM stores WHERE id = $1', [conv.store_id]
    )).rows[0] || {};

    const draft = await extractOrderDraft({
      messages: msgs.rows.reverse(),
      products: prods.rows,
      localities: flatInternalLocalities(store.delivery_tiers),
    });
    // اسمُ حسابِ إنستغرام احتياطٌ أخير: ما كتبَه الزبونُ للطلبِ أولى منه
    if (!draft.name) draft.name = conv.customer_name || '';
    res.json(draft);
  } catch (err) { next(err); }
}

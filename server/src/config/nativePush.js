import http2 from 'http2';
import crypto from 'crypto';
import { query } from './db.js';

// ===================================================================
//  إشعارات Push الأصلية للآيفون عبر APNs (Apple Push Notification service)
//  تكمّل نظام Web Push: هذا يشتغل داخل تطبيق iOS الأصلي، وذاك في المتصفّح/PWA.
//
//  يبقى "نائماً" بهدوء (بلا أخطاء) لين تُضبط متغيّرات البيئة على Render
//  بعد شراء حساب Apple Developer:
//    APNS_KEY        = محتوى ملف .p8 كامل (يشمل سطري BEGIN/END)
//    APNS_KEY_ID     = Key ID للمفتاح (10 أحرف)
//    APNS_TEAM_ID    = Team ID من حساب المطوّر (10 أحرف)
//    APNS_TOPIC      = معرّف التطبيق = com.bazara.store
//    APNS_PRODUCTION = true لنسخة المتجر/TestFlight (افتراضي sandbox للتطوير)
// ===================================================================

const KEY = (process.env.APNS_KEY || '').replace(/\\n/g, '\n');
const KEY_ID = process.env.APNS_KEY_ID || '';
const TEAM_ID = process.env.APNS_TEAM_ID || '';
const TOPIC = process.env.APNS_TOPIC || 'com.bazara.store';
const HOST = process.env.APNS_PRODUCTION === 'true'
  ? 'https://api.push.apple.com'
  : 'https://api.sandbox.push.apple.com';

const configured = Boolean(KEY && KEY_ID && TEAM_ID);

export function isNativePushConfigured() {
  return configured;
}

// توكن مصادقة APNs (JWT موقّع بـ ES256) — صالح ~60 دقيقة، نخزّنه ونعيد توليده
let cachedToken = '';
let cachedAt = 0;
function authToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedAt < 50 * 60) return cachedToken;
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
  const claims = base64url(JSON.stringify({ iss: TEAM_ID, iat: now }));
  const signingInput = `${header}.${claims}`;
  // dsaEncoding 'ieee-p1363' يعطي توقيع JOSE الخام (R||S) المطلوب لـ ES256
  const sig = crypto.sign('SHA256', Buffer.from(signingInput), { key: KEY, dsaEncoding: 'ieee-p1363' });
  cachedToken = `${signingInput}.${sig.toString('base64url')}`;
  cachedAt = now;
  return cachedToken;
}

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

// إرسال إشعار لجهاز آيفون واحد — يُرجِع رمز حالة HTTP من APNs
function sendToToken(deviceToken, payload) {
  return new Promise((resolve) => {
    const client = http2.connect(HOST);
    client.on('error', () => resolve(0));
    const body = JSON.stringify({
      aps: {
        alert: { title: payload.title || 'Bazara', body: payload.body || '' },
        sound: 'default',
        badge: 1,
      },
      url: payload.url || '/',
    });
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${authToken()}`,
      'apns-topic': TOPIC,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    });
    let status = 0;
    req.on('response', (h) => { status = h[':status']; });
    req.on('end', () => { client.close(); resolve(status); });
    req.on('error', () => { client.close(); resolve(0); });
    req.setEncoding('utf8');
    req.on('data', () => {});
    req.write(body);
    req.end();
  });
}

// إرسال لكل أجهزة آيفون مسجّلة لمستخدم — يحذف التوكنات المنتهية تلقائياً
export async function sendNativeToUser(userId, payload) {
  if (!configured || !userId) return;
  try {
    const r = await query(
      "SELECT id, token FROM native_push_tokens WHERE user_id = $1 AND platform = 'ios'",
      [userId]
    );
    await Promise.all(
      r.rows.map(async (t) => {
        const status = await sendToToken(t.token, payload);
        // 410 = الجهاز ألغى التسجيل، 400 = توكن غير صالح → احذفه
        if (status === 410 || status === 400) {
          await query('DELETE FROM native_push_tokens WHERE id = $1', [t.id]).catch(() => {});
        }
      })
    );
  } catch (err) {
    console.error('sendNativeToUser:', err.message);
  }
}

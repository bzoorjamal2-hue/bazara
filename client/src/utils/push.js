import { Capacitor } from '@capacitor/core';
import api from '../api/client.js';

// هل نعمل داخل تطبيق Capacitor الأصلي (آيفون/أندرويد) لا المتصفّح؟
const isNative = Capacitor.isNativePlatform();
const nativePlatform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// ====================== التطبيق الأصلي (APNs / FCM) ======================
let nativeListenersReady = false;

async function setupNativeListeners(PushNotifications) {
  if (nativeListenersReady) return;
  nativeListenersReady = true;
  // وصل التوكن من النظام → سجّله بالخادم لإرسال الإشعارات لاحقاً
  await PushNotifications.addListener('registration', async (token) => {
    try {
      await api.post('/push/register-native', { token: token.value, platform: nativePlatform });
      localStorage.setItem('bz_native_token', token.value);
    } catch { /* تجاهل */ }
  });
  await PushNotifications.addListener('registrationError', () => { /* تجاهل بصمت */ });
  // ضغط المستخدم على الإشعار → افتح الرابط داخل التطبيق
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action?.notification?.data?.url;
    if (url) window.location.href = url;
  });
}

async function enablePushNative() {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') throw new Error('denied');
  await setupNativeListeners(PushNotifications);
  await PushNotifications.register(); // يطلق حدث registration بالتوكن
  return true;
}

async function disablePushNative() {
  try {
    const token = localStorage.getItem('bz_native_token');
    if (token) await api.post('/push/unregister-native', { token }).catch(() => {});
    localStorage.removeItem('bz_native_token');
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners().catch(() => {});
    nativeListenersReady = false;
  } catch { /* تجاهل */ }
  return true;
}

async function pushStatusNative() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'denied') return 'denied';
    return perm.receive === 'granted' && localStorage.getItem('bz_native_token') ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

// ====================== المتصفّح / PWA (Web Push / VAPID) ======================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function webSupported() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function enablePushWeb() {
  if (!webSupported()) throw new Error('unsupported');
  const { data } = await api.get('/push/public-key');
  if (!data.enabled || !data.key) throw new Error('not-configured');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.key),
    });
  }
  await api.post('/push/subscribe', { subscription: sub.toJSON() });
  return true;
}

async function disablePushWeb() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch { /* تجاهل */ }
  return true;
}

async function pushStatusWeb() {
  if (!webSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

// ====================== الواجهة الموحّدة (تختار المسار تلقائياً) ======================
export function pushSupported() {
  return isNative || webSupported();
}

export function enablePush() {
  return isNative ? enablePushNative() : enablePushWeb();
}

export function disablePush() {
  return isNative ? disablePushNative() : disablePushWeb();
}

export function pushStatus() {
  return isNative ? pushStatusNative() : pushStatusWeb();
}

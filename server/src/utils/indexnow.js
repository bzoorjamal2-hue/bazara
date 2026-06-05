// دعم بروتوكول IndexNow لإخطار محركات البحث (Bing/جوجل يستفيد منه) فور إضافة محتوى جديد.
// لا يوقف العملية إذا فشل، فقط يسجّل تحذيراً.

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export async function pingIndexNow(urls) {
  const key = process.env.INDEXNOW_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL;

  if (!key || !siteUrl) return; // غير مفعّل
  if (process.env.NODE_ENV !== 'production') return; // نتجنب الإرسال محلياً

  try {
    const host = new URL(siteUrl).host;
    const urlList = Array.isArray(urls) ? urls : [urls];

    const body = {
      host,
      key,
      keyLocation: `${siteUrl}/${key}.txt`,
      urlList,
    };

    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('IndexNow ping returned status', res.status);
    }
  } catch (err) {
    console.warn('IndexNow ping failed:', err.message);
  }
}

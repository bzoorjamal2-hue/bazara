import { query } from '../config/db.js';

async function getUserStore(userId) {
  const r = await query('SELECT id FROM stores WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

// إضافة ستوري لمتجر المالك (صورة/فيديو من Cloudinary) — تختفي تلقائياً بعد ٢٤ ساعة
export async function createStory(req, res, next) {
  const mediaUrl = String(req.body.mediaUrl || '').trim();
  const mediaType = req.body.mediaType === 'video' ? 'video' : 'image';
  if (!/^https:\/\/res\.cloudinary\.com\//.test(mediaUrl)) {
    return res.status(400).json({ error: 'وسائط غير صالحة.' });
  }
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    // حدّ أقصى ٢٠ ستوري فعّالة لكل متجر
    const cnt = await query('SELECT COUNT(*)::int AS c FROM stories WHERE store_id = $1 AND expires_at > now()', [store.id]);
    if (cnt.rows[0].c >= 20) return res.status(400).json({ error: 'وصلتِ الحد الأقصى للستوريات الحالية.' });
    const r = await query(
      `INSERT INTO stories (store_id, media_url, media_type) VALUES ($1, $2, $3)
       RETURNING id, media_url, media_type, created_at`,
      [store.id, mediaUrl, mediaType]
    );
    const s = r.rows[0];
    res.status(201).json({ story: { id: s.id, mediaUrl: s.media_url, mediaType: s.media_type, createdAt: s.created_at } });
  } catch (err) {
    next(err);
  }
}

export async function deleteStory(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('DELETE FROM stories WHERE id = $1 AND store_id = $2 RETURNING id', [req.params.id, store.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'الستوري غير موجودة.' });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    next(err);
  }
}

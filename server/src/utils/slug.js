import slugify from 'slugify';
import { query } from '../config/db.js';

/**
 * يولّد slug فريد من اسم المتجر. يدعم العربية والإنجليزية.
 * إذا كان الاسم عربياً بالكامل ولم ينتج عنه slug، نستخدم بادئة عشوائية.
 */
export async function generateUniqueStoreSlug(name, excludeStoreId = null) {
  let base = slugify(name, { lower: true, strict: true, locale: 'ar' });

  // إن لم ينتج slug صالح (مثلاً اسم عربي بالكامل) نولّد بديلاً
  if (!base) {
    base = 'store-' + Math.random().toString(36).slice(2, 8);
  }

  let slug = base;
  let counter = 1;

  // نضمن التفرّد
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = excludeStoreId
      ? await query('SELECT id FROM stores WHERE slug = $1 AND id <> $2', [slug, excludeStoreId])
      : await query('SELECT id FROM stores WHERE slug = $1', [slug]);

    if (result.rows.length === 0) break;
    slug = `${base}-${counter++}`;
  }

  return slug;
}

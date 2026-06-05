// بيانات تجريبية: مستخدمان، متجران، ومجموعة منتجات وهمية لمعاينة الشكل فوراً.
import bcrypt from 'bcrypt';
import pool from './config/db.js';
import { generateUniqueStoreSlug } from './utils/slug.js';

const DEMO = [
  {
    user: { name: 'نور أحمد', email: 'noor@example.com', password: 'Passw0rd!' },
    store: {
      name: 'بوتيك نور',
      description: 'أحدث صيحات الموضة النسائية بلمسة راقية وأناقة لا تُقاوم.',
      logoUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200&h=200&fit=crop',
    },
    products: [
      { name: 'فستان سهرة أنيق', price: 79.99, description: 'فستان سهرة طويل بقماش فاخر.', size: 'M', color: 'أسود', category: 'women', imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600' },
      { name: 'بلوزة حريرية', price: 34.5, description: 'بلوزة ناعمة مريحة لإطلالة يومية.', size: 'S', color: 'وردي', category: 'women', imageUrl: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600' },
      { name: 'حقيبة يد جلدية', price: 59.0, description: 'حقيبة يد عملية بتصميم عصري.', size: 'Standard', color: 'بني', category: 'accessories', imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600' },
      { name: 'حذاء كعب عالي', price: 49.99, description: 'حذاء كعب مريح وأنيق.', size: '38', color: 'أحمر', category: 'women', imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600' },
    ],
  },
  {
    user: { name: 'سامي خالد', email: 'sami@example.com', password: 'Passw0rd!' },
    store: {
      name: 'ركن الرجل',
      description: 'ملابس رجالية كلاسيكية وعصرية تناسب كل المناسبات.',
      logoUrl: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=200&h=200&fit=crop',
    },
    products: [
      { name: 'قميص رسمي قطني', price: 39.99, description: 'قميص قطني فاخر بقصّة مثالية.', size: 'L', color: 'أبيض', category: 'men', imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600' },
      { name: 'بنطال جينز', price: 44.0, description: 'جينز مريح بخامة متينة.', size: '32', color: 'أزرق', category: 'men', imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600' },
      { name: 'جاكيت شتوي', price: 89.99, description: 'جاكيت دافئ بتصميم أنيق.', size: 'XL', color: 'كحلي', category: 'men', imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600' },
      { name: 'تيشيرت أطفال', price: 19.99, description: 'تيشيرت قطني مريح للأطفال.', size: '8Y', color: 'أخضر', category: 'kids', imageUrl: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600' },
      { name: 'ساعة يد كلاسيكية', price: 120.0, description: 'ساعة أنيقة تكمّل إطلالتك.', size: 'Standard', color: 'فضي', category: 'accessories', imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600' },
    ],
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const entry of DEMO) {
      // نتخطى إن كان البريد موجوداً مسبقاً
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [entry.user.email]);
      if (existing.rows.length > 0) {
        console.log(`↩️  المستخدم ${entry.user.email} موجود مسبقاً، تخطّي.`);
        continue;
      }

      const hash = await bcrypt.hash(entry.user.password, 12);
      const u = await client.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [entry.user.name, entry.user.email, hash]
      );
      const userId = u.rows[0].id;

      const slug = await generateUniqueStoreSlug(entry.store.name);
      const s = await client.query(
        'INSERT INTO stores (user_id, name, slug, description, logo_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, entry.store.name, slug, entry.store.description, entry.store.logoUrl]
      );
      const storeId = s.rows[0].id;

      for (const p of entry.products) {
        await client.query(
          `INSERT INTO products (store_id, name, price, description, size, color, category, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [storeId, p.name, p.price, p.description, p.size, p.color, p.category, p.imageUrl]
        );
      }
      console.log(`✅ تم إنشاء متجر "${entry.store.name}" (${slug}) مع ${entry.products.length} منتجات.`);
    }
    await client.query('COMMIT');
    console.log('\n🎉 اكتملت البيانات التجريبية. سجّل الدخول بـ: noor@example.com / Passw0rd!');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ فشل إدخال البيانات:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

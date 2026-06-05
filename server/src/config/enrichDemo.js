// إثراء البيانات التجريبية بالحقول الجديدة (idempotent — آمن لإعادة التشغيل)
import pool, { query } from './db.js';

async function run() {
  try {
    // معلومات المتاجر (واتساب/سوشال/لون الهوية/توصيل ودفع)
    await query(
      `UPDATE stores SET whatsapp=$1, phone=$2, instagram=$3, tiktok=$4, theme_color=$5,
              delivery_info=$6, payment_info=$7
       WHERE slug=$8`,
      ['+962790000000', '+962790000000', 'boutique.noor', 'boutique.noor', '#d4af37',
       'توصيل لكل المحافظات خلال 2-4 أيام. التوصيل مجاني للطلبات فوق 50$.',
       'الدفع عند الاستلام، أو تحويل بنكي / محفظة إلكترونية.', 'bwtyk-nwr']
    );
    await query(
      `UPDATE stores SET whatsapp=$1, phone=$2, instagram=$3, theme_color=$4,
              delivery_info=$5, payment_info=$6
       WHERE slug=$7`,
      ['+962791111111', '+962791111111', 'rukn.alrajul', '#caa05a',
       'توصيل خلال 1-3 أيام داخل المدن الرئيسية.',
       'الدفع عند الاستلام أو بطاقة ائتمان.', 'rkn-alrjl']
    );

    // منتجات مميّزة
    await query(`UPDATE products SET featured=true WHERE name IN ('فستان سهرة أنيق','جاكيت شتوي','ساعة يد كلاسيكية')`);

    // خصومات (سعر قديم مشطوب)
    await query(`UPDATE products SET old_price=99.99 WHERE name='فستان سهرة أنيق'`);
    await query(`UPDATE products SET old_price=59.99 WHERE name='قميص رسمي قطني'`);
    await query(`UPDATE products SET old_price=149.00 WHERE name='ساعة يد كلاسيكية'`);

    // مخزون: بعضها متوفّر بعدد، وواحد نفد للتجربة
    await query(`UPDATE products SET stock=5  WHERE name='فستان سهرة أنيق'`);
    await query(`UPDATE products SET stock=0  WHERE name='حذاء كعب عالي'`);
    await query(`UPDATE products SET stock=20 WHERE name='قميص رسمي قطني'`);

    // صور إضافية (معرض) لمنتج واحد كمثال
    await query(
      `UPDATE products SET images=$1 WHERE name='فستان سهرة أنيق'`,
      [['https://images.unsplash.com/photo-1572804013427-4d7ca7268217?w=600', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600']]
    );

    // تفعيل اشتراك حسابات العرض (تبقى ظاهرة بعد تفعيل Stripe)
    await query(
      `UPDATE users SET subscription_status='active', subscription_plan='yearly',
              current_period_end = now() + interval '1 year'
       WHERE email IN ('noor@example.com','sami@example.com')`
    );
    // توليد رمز مشترك لأي مستخدم بدون رمز
    await query(`UPDATE users SET subscriber_code = 'BZ-' || upper(substr(md5(random()::text),1,6)) WHERE subscriber_code IS NULL`);

    console.log('✅ تم إثراء البيانات التجريبية بالحقول الجديدة + تفعيل اشتراك حسابات العرض.');
  } catch (err) {
    console.error('❌ فشل الإثراء:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();

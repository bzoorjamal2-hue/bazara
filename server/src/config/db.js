import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// نبني إعدادات الاتصال إما من DATABASE_URL أو من المتغيرات المنفصلة
const useSsl = process.env.PGSSL === 'true' || /sslmode=require/.test(process.env.DATABASE_URL || '');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });

pool.on('error', (err) => {
  console.error('خطأ غير متوقع في اتصال قاعدة البيانات:', err.message);
});

/**
 * تنفيذ استعلام باستخدام parameterized query (آمن ضد SQL Injection).
 * @param {string} text نص الاستعلام مع $1, $2 ...
 * @param {Array} params القيم
 */
export const query = (text, params) => pool.query(text, params);

/**
 * تنفيذ مجموعة عمليات داخل معاملة واحدة (إمّا تنجح كلها أو تُلغى كلها — ذرّية).
 * يُمرّر للدالة منفّذ `q(text, params)` يستخدم نفس اتصال المعاملة.
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q = (text, params) => client.query(text, params);
    const result = await fn(q);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export default pool;

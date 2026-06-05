// سكربت تهيئة قاعدة البيانات: ينشئ الجداول من schema.sql
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(sql);
    console.log('✅ تم إنشاء الجداول بنجاح.');
  } catch (err) {
    console.error('❌ فشل إنشاء الجداول:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();

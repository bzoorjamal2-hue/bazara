import { query } from '../config/db.js';

// سجلّ أفعال المدير.
//
// التفعيل والإيقاف والحذف وتصفير كلمات السرّ كانت تُنفَّذ بلا أثر: لا سبيل
// لمعرفة من فعل ماذا ومتى إن وقع خطأ أو اختلفت الرواية. السجلّ يجعل كل فعل
// إداريّ قابلاً للمراجعة.
//
// لا يرمي أبداً: فشل الكتابة في السجلّ يجب ألّا يُبطل الفعل نفسه — تفعيلُ
// اشتراكٍ نجح ثم سقط لأن سطر سجلّ لم يُكتب هو أسوأ من سجلٍّ ناقص.
export async function logAdmin(req, action, target = {}) {
  try {
    await query(
      `INSERT INTO admin_actions (admin_id, admin_email, action, target_type, target_id, target_label, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req?.user?.id || null,
        String(req?.user?.email || '').slice(0, 160),
        String(action || '').slice(0, 40),
        String(target.type || '').slice(0, 20),
        String(target.id || '').slice(0, 80),
        String(target.label || '').slice(0, 200),
        JSON.stringify(target.details || {}),
      ]
    );
  } catch (err) {
    console.error('⚠️ تعذّر تسجيل فعل المدير:', err.message);
  }
}

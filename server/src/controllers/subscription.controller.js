import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { isUserActive, daysRemaining, isAdminEmail, planPeriodEnd, adminEmails, activeStoreSql } from '../utils/subscription.js';
import { sendMail, isMailConfigured } from '../utils/mail.js';
import { clearPublicCache } from '../middleware/cache.js';
import { logAdmin } from '../utils/adminLog.js';
import { notifyStoreOwner } from '../utils/notify.js';
import { isPlatformPaytabsConfigured, createPlatformPayment, queryPlatformTransaction, isPaymentSuccess } from '../config/paytabs.js';
import { createSubaccount, isLahzaConfigured, listBanks, initializeTransaction, verifyTransaction } from '../config/lahza.js';

const PLANS = { monthly: true, yearly: true };
const PLAN_PRICES = { monthly: 25, yearly: 250 };
const SITE = () => (process.env.PUBLIC_SITE_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

// ─────────────── حالة الحساب: مصدر حقيقةٍ واحد ───────────────
//
// كانت كلّ عمليةٍ تُرجع ما غيّرته هي فقط، فتُكمِل الواجهة الباقي بالتخمين:
// «فعّلتُ الاشتراك ⇐ صار فعّالاً». لكنّ الإيقاف الإداريّ يعلو على الاشتراك،
// فيظهر الصفّ «موقوف» و«فعّال» معاً بينما متجرها ما زال مخفياً عن الزوّار،
// ويكفي تحديث الصفحة ليعود الحال. صارت كلّ عملية تُعيد قراءة الحساب وترجع
// حالته كاملة، فتطبّقها الواجهة كما هي ولا تخمّن شيئاً.
export async function accountState(email) {
  const r = await query(
    `SELECT email, subscription_status, subscription_plan, subscription_started_at,
            current_period_end, suspended_at, suspended_reason, created_at
       FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  const u = r.rows[0];
  if (!u) return null;
  const admin = isAdminEmail(u.email);
  return {
    email: u.email,
    status: u.subscription_status,
    plan: u.subscription_plan,
    startedAt: u.subscription_started_at || (admin ? u.created_at : null),
    currentPeriodEnd: u.current_period_end,
    suspended: Boolean(u.suspended_at),
    suspendedReason: u.suspended_reason || '',
    active: isUserActive(u),
    isAdmin: admin,
    lifetime: admin,
  };
}
const planLabel = (p) => (p === 'yearly' ? 'سنوية' : 'شهرية');

// تعليمات الدفع: من قاعدة البيانات (يحرّرها المدير)، وإلا من المتغيّر، وإلا نص افتراضي.
async function getPaymentInfo() {
  const r = await query("SELECT value FROM app_settings WHERE key = 'payment_info'");
  const dbVal = r.rows[0]?.value;
  return (
    (dbVal && dbVal.trim()) ||
    process.env.ADMIN_PAYMENT_INFO ||
    'سيتم إضافة تفاصيل الدفع قريباً. تواصل مع إدارة Bazara لإتمام الاشتراك.'
  );
}

// جلب إعدادات المنصة (للمدير)
export async function getSettings(_req, res, next) {
  try {
    res.json({ paymentInfo: await getPaymentInfo() });
  } catch (err) {
    next(err);
  }
}

// تحديث تعليمات الدفع (للمدير)
export async function updateSettings(req, res, next) {
  const { paymentInfo } = req.body;
  try {
    await query(
      `INSERT INTO app_settings (key, value) VALUES ('payment_info', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [paymentInfo || '']
    );
    await logAdmin(req, 'settings.payment', { type: 'settings', id: 'payment_info', label: 'تعليمات الدفع', details: { length: String(paymentInfo || '').length } });
    res.json({ message: 'تم حفظ تعليمات الدفع.', paymentInfo: paymentInfo || '' });
  } catch (err) {
    next(err);
  }
}

// حالة اشتراك المستخدم الحالي + آخر طلب + تعليمات الدفع
export async function getStatus(req, res, next) {
  try {
    const r = await query(
      'SELECT email, subscription_status, subscription_plan, current_period_end, subscriber_code FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = r.rows[0];

    const reqRes = await query(
      'SELECT plan, status, created_at FROM subscription_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    const last = reqRes.rows[0] || null;

    res.json({
      status: u.subscription_status,
      plan: u.subscription_plan,
      currentPeriodEnd: u.current_period_end,
      active: isUserActive(u),
      daysRemaining: daysRemaining(u),
      subscriberCode: u.subscriber_code,
      isAdmin: isAdminEmail(u.email),
      lifetime: isAdminEmail(u.email),
      pending: last && last.status === 'pending',
      lastRequest: last ? { plan: last.plan, status: last.status, createdAt: last.created_at } : null,
      paymentInfo: await getPaymentInfo(),
    });
  } catch (err) {
    next(err);
  }
}

// المشترك يرسل طلب اشتراك بعد الدفع المحلي (مع رقم العملية/ملاحظة)
export async function requestSubscription(req, res, next) {
  const { plan, method, reference } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  try {
    // إن وُجد طلب معلّق نحدّثه بدل إنشاء جديد
    const existing = await query(
      "SELECT id FROM subscription_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1",
      [req.user.id]
    );
    if (existing.rows.length > 0) {
      await query(
        'UPDATE subscription_requests SET plan=$1, method=$2, reference=$3, created_at=now() WHERE id=$4',
        [plan, method || '', reference || '', existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO subscription_requests (user_id, plan, method, reference) VALUES ($1, $2, $3, $4)',
        [req.user.id, plan, method || '', reference || '']
      );
    }
    res.status(201).json({ message: 'تم استلام طلبك، سيتم تفعيل اشتراكك بعد المراجعة.' });
  } catch (err) {
    next(err);
  }
}

// ── دفع الاشتراك عبر Paytabs (بطاقة) ────────────────────────────────────
export async function subscriptionCheckout(req, res, next) {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  if (!isLahzaConfigured()) return res.status(503).json({ error: 'الدفع بالبطاقة غير مُفعّل حالياً.' });
  try {
    const u = await query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const email = u.rows[0]?.email || '';
    const amount = PLAN_PRICES[plan];
    const ref = 'SUB-' + crypto.randomBytes(5).toString('hex').toUpperCase();

    const existing = await query("SELECT id FROM subscription_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1", [req.user.id]);
    let reqId;
    if (existing.rows.length) {
      await query("UPDATE subscription_requests SET plan=$1, method='card', reference=$2, tran_ref='', created_at=now() WHERE id=$3", [plan, ref, existing.rows[0].id]);
      reqId = existing.rows[0].id;
    } else {
      const ins = await query("INSERT INTO subscription_requests (user_id, plan, method, reference) VALUES ($1, $2, 'card', $3) RETURNING id", [req.user.id, plan, ref]);
      reqId = ins.rows[0].id;
    }

    let lahzaRes;
    try {
      lahzaRes = await initializeTransaction({
        email,
        amount,
        currency: 'USD',
        reference: ref,
        callbackUrl: `${SITE()}/subscribe?ref=${ref}`,
        metadata: { type: 'subscription', plan },
      });
    } catch (payErr) {
      console.error('فشل إنشاء صفحة دفع اشتراك:', payErr.message);
      lahzaRes = null;
    }

    const payUrl = lahzaRes?.data?.authorization_url || '';
    if (!payUrl) {
      await query("UPDATE subscription_requests SET tran_ref = '' WHERE id = $1", [reqId]);
      return res.status(502).json({ error: 'تعذّر إنشاء صفحة الدفع. جرّبي التفعيل بالكود أو حاولي لاحقاً.' });
    }
    await query('UPDATE subscription_requests SET tran_ref = $1 WHERE id = $2', [ref, reqId]);
    res.json({ redirectUrl: payUrl, reference: ref });
  } catch (err) {
    next(err);
  }
}

export async function subscriptionVerify(req, res, next) {
  const ref = (req.query.ref || '').trim();
  if (!ref) return res.status(400).json({ error: 'مرجع مفقود.' });
  try {
    const r = await query("SELECT sr.*, u.email, u.name as user_name FROM subscription_requests sr JOIN users u ON u.id = sr.user_id WHERE sr.reference = $1 ORDER BY sr.created_at DESC LIMIT 1", [ref]);
    const sr = r.rows[0];
    if (!sr) return res.status(404).json({ error: 'طلب غير موجود.' });
    if (sr.status === 'approved') return res.json({ status: 'paid' });
    if (!isLahzaConfigured()) return res.json({ status: sr.status });

    const result = await verifyTransaction(ref);
    if (result.data?.status === 'success') {
      const from = new Date();
      const end = planPeriodEnd(sr.plan, from);
      await query(
        `UPDATE users SET subscription_status='active', subscription_plan=$1, subscription_started_at=$2, current_period_end=$3 WHERE id=$4`,
        [sr.plan, from, end, sr.user_id]
      );
      await query("UPDATE subscription_requests SET status='approved' WHERE id=$1", [sr.id]);
      clearPublicCache();

      if (isMailConfigured()) {
        try {
          await sendMail({
            to: sr.email,
            subject: 'تم تفعيل اشتراكك — Bazara',
            html: `<div style="font-family:Tahoma,Arial;direction:rtl;text-align:right">
              <h2>مرحباً ${sr.user_name || ''}!</h2>
              <p>تم الدفع بنجاح وتفعيل اشتراكك في Bazara (حزمة ${planLabel(sr.plan)}).</p>
              <p>اشتراكك فعّال حتى: <strong>${end.toLocaleDateString('ar')}</strong></p>
              <p>يمكنك الآن إنشاء متجرك والبدء بالبيع.</p>
            </div>`,
          });
        } catch (mailErr) {
          console.error('subscription confirmation mail failed:', mailErr.message);
        }
      }

      return res.json({ status: 'paid' });
    }
    return res.json({ status: 'pending' });
  } catch (err) {
    next(err);
  }
}

// Paytabs server-to-server callback للاشتراكات
export async function subscriptionPaytabsCallback(req, res) {
  const { tran_ref, cart_id, payment_result } = req.body;
  if (!tran_ref || !cart_id) return res.status(400).json({ error: 'missing' });
  try {
    const paid = payment_result?.response_status === 'A';
    if (!paid) return res.json({ ok: true });
    const r = await query("SELECT sr.*, u.email FROM subscription_requests sr JOIN users u ON u.id = sr.user_id WHERE sr.reference = $1 AND sr.status = 'pending' LIMIT 1", [cart_id]);
    const sr = r.rows[0];
    if (!sr) return res.json({ ok: true });
    const from = new Date();
    const end = planPeriodEnd(sr.plan, from);
    await query(
      `UPDATE users SET subscription_status='active', subscription_plan=$1, subscription_started_at=$2, current_period_end=$3 WHERE id=$4`,
      [sr.plan, from, end, sr.user_id]
    );
    await query("UPDATE subscription_requests SET status='approved', tran_ref=$1 WHERE id=$2", [tran_ref, sr.id]);
    clearPublicCache();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'internal' });
  }
}

// توليد كود تفعيل عشوائي مكوّن من 6 أرقام
function genCode() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
}

// المشترك يُدخل كود التفعيل بعد التحويل
export async function redeemCode(req, res, next) {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'أدخل كود التفعيل.' });
  try {
    const r = await query('SELECT * FROM activation_codes WHERE code = $1', [code]);
    const c = r.rows[0];
    if (!c || c.used) return res.status(400).json({ error: 'كود غير صالح أو مُستخدَم مسبقاً.' });

    // التمديد من نهاية الفترة الحالية إن كانت مستقبلية (تجديد يتراكم)
    const userRow = await query('SELECT current_period_end FROM users WHERE id = $1', [req.user.id]);
    const cur = userRow.rows[0]?.current_period_end;
    const from = cur && new Date(cur) > new Date() ? new Date(cur) : new Date();
    const end = planPeriodEnd(c.plan, from);

    await query(
      `UPDATE users SET subscription_status='active', subscription_plan=$1, current_period_end=$2,
              subscription_started_at = COALESCE(subscription_started_at, now())
         WHERE id=$3`,
      [c.plan, end, req.user.id]
    );
    await query('UPDATE activation_codes SET used=true, used_by=$1, used_at=now() WHERE id=$2', [req.user.id, c.id]);

    res.json({ message: 'تم تفعيل اشتراكك بنجاح!', plan: c.plan, currentPeriodEnd: end });
  } catch (err) {
    next(err);
  }
}

// ===== مسارات المدير =====

// توليد أكواد تفعيل (للمدير)
export async function generateCodes(req, res, next) {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  const count = Math.min(50, Math.max(1, parseInt(req.body.count, 10) || 1));
  try {
    const created = [];
    for (let i = 0; i < count; i++) {
      let code;
      // نضمن التفرّد
      for (let tries = 0; tries < 5; tries++) {
        code = genCode();
        const exists = await query('SELECT 1 FROM activation_codes WHERE code = $1', [code]);
        if (exists.rows.length === 0) break;
      }
      await query('INSERT INTO activation_codes (code, plan) VALUES ($1, $2)', [code, plan]);
      created.push(code);
    }
    await logAdmin(req, 'codes.generate', { type: 'codes', id: plan, label: `${created.length} كود ${planLabel(plan)}`, details: { count: created.length, plan } });
    res.json({ codes: created, plan });
  } catch (err) {
    next(err);
  }
}

// توليد كود وإرساله مباشرة لبريد المشترك (للمدير)
export async function sendCodeToSubscriber(req, res, next) {
  const { email, plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  try {
    const r = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: 'لا يوجد مشترك بهذا البريد.' });

    let code;
    for (let tries = 0; tries < 5; tries++) {
      code = genCode();
      const exists = await query('SELECT 1 FROM activation_codes WHERE code = $1', [code]);
      if (exists.rows.length === 0) break;
    }
    await query('INSERT INTO activation_codes (code, plan) VALUES ($1, $2)', [code, plan]);

    let mailed = false;
    if (isMailConfigured()) {
      try {
        await sendMail({
          to: email,
          subject: 'كود تفعيل اشتراكك — Bazara',
          html: `<div style="font-family:Tahoma,Arial;direction:rtl;text-align:right">
            <h2>كود تفعيل اشتراكك في Bazara</h2>
            <p>مرحباً ${u.name || ''}، تم تجهيز كود تفعيل اشتراكك (حزمة ${planLabel(plan)}):</p>
            <p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#b8932c">${code}</p>
            <p>سجّل دخولك ← صفحة الاشتراك ← أدخل الكود لتفعيل متجرك.</p>
          </div>`,
        });
        mailed = true;
      } catch (e) {
        console.error('sendCode mail failed:', e.message);
      }
    }
    await logAdmin(req, 'codes.send', { type: 'user', id: email, label: email, details: { plan, mailed } });
    res.json({ message: mailed ? 'تم إرسال الكود إلى بريد المشترك.' : 'تم توليد الكود (تعذّر الإرسال بالبريد، أرسله يدوياً).', code, mailed });
  } catch (err) {
    next(err);
  }
}

// قائمة المشتركين (للمدير)
// نظرة عامة على المنصّة (للمدير): أرقام حقيقية مجمّعة — متاجر، اشتراكات، منتجات،
// طلبات، مبيعات مؤكّدة، مشتركو نشرة، طلبات اشتراك معلّقة. حسابات المدير مستثناة من عدّ المتاجر.
export async function getAdminStats(_req, res, next) {
  try {
    const admins = adminEmails();
    const notAdmin = admins.length
      ? `AND lower(u.email) NOT IN (${admins.map((e) => `'${e.replace(/'/g, "''")}'`).join(',')})`
      : '';
    const storesQ = await query(
      `SELECT
         COUNT(*)::int AS total_stores,
         COUNT(*) FILTER (WHERE ${activeStoreSql('u')})::int AS active_subs,
         COUNT(*) FILTER (WHERE u.created_at >= date_trunc('month', now()))::int AS new_this_month,
         -- توشك على الانتهاء خلال أسبوع: الرقم الوحيد القابل للتصرّف قبل فوات
         -- الأوان — الاشتراك المنتهي خسارةٌ وقعت، والموشك فرصةٌ باقية.
         COUNT(*) FILTER (
           WHERE ${activeStoreSql('u')}
             AND u.current_period_end IS NOT NULL
             AND u.current_period_end <= now() + interval '7 days'
         )::int AS expiring_soon,
         -- الموقوف إدارياً ليس «منتهي الاشتراك»: كان يسقط في طرح (الإجمالي −
         -- الفعّالة) فيُقرأ كخسارةِ تجديد، والتجديد لا يفتح متجره أصلاً.
         COUNT(*) FILTER (WHERE u.suspended_at IS NOT NULL)::int AS suspended_stores,
         -- متجر بلا منتج واحد: اشترك ولم يُطلق. مؤشّر تعثّرٍ مبكّر لا يظهر
         -- في «إجمالي المتاجر» إطلاقاً.
         COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.store_id = s.id))::int AS empty_stores
       FROM stores s JOIN users u ON u.id = s.user_id
       WHERE TRUE ${notAdmin}`
    );
    // متاجر الإدارة مستثناة من كلّ رقمٍ هنا، لا من عدّ المتاجر وحده: كان
    // متجر الاختبار يدخل بالمنتجات والطلبات والمبيعات ويغيب عن عدّ المتاجر،
    // فلا يجمع أيّ رقمين على المنصّة نفسها.
    const NON_ADMIN_STORES = `SELECT s.id FROM stores s JOIN users u ON u.id = s.user_id WHERE TRUE ${notAdmin}`;
    const productsQ = await query(`SELECT COUNT(*)::int AS c FROM products WHERE store_id IN (${NON_ADMIN_STORES})`);
    const PAID = "status IN ('confirmed','shipped','delivered')";
    const ordersQ = await query(
      `SELECT COUNT(*)::int AS total_orders,
              COUNT(*) FILTER (WHERE status='new')::int AS new_orders,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS orders_this_month,
              COALESCE(SUM(total) FILTER (WHERE ${PAID}), 0) AS gmv,
              COALESCE(SUM(total) FILTER (WHERE ${PAID} AND created_at >= date_trunc('month', now())), 0) AS gmv_this_month,
              COALESCE(SUM(total) FILTER (
                WHERE ${PAID}
                  AND created_at >= date_trunc('month', now()) - interval '1 month'
                  AND created_at <  date_trunc('month', now())
              ), 0) AS gmv_last_month
       FROM orders WHERE store_id IN (${NON_ADMIN_STORES})`
    );
    const newsQ = await query('SELECT COUNT(*)::int AS c FROM subscribers');
    const reqQ = await query("SELECT COUNT(*)::int AS c FROM subscription_requests WHERE status = 'pending'");
    const s = storesQ.rows[0];
    const o = ordersQ.rows[0];
    const thisM = Number(o.gmv_this_month) || 0;
    const lastM = Number(o.gmv_last_month) || 0;
    // القسمة على القيمة المطلقة لا الخام: لو كان الشهر الماضي صفراً لا نقسم
    // عليه، ونكتفي بغياب النسبة بدل رقمٍ لا معنى له.
    const gmvChange = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : null;

    res.json({
      totalStores: s.total_stores,
      activeSubs: s.active_subs,
      // منتهية = ليست فعّالة وليست موقوفة. الموقوفة تُعرض على حدة.
      expiredSubs: Math.max(0, s.total_stores - s.active_subs - s.suspended_stores),
      suspendedStores: s.suspended_stores,
      newStoresThisMonth: s.new_this_month,
      expiringSoon: s.expiring_soon,
      emptyStores: s.empty_stores,
      totalProducts: productsQ.rows[0].c,
      totalOrders: o.total_orders,
      newOrders: o.new_orders,
      ordersThisMonth: o.orders_this_month,
      gmv: Number(o.gmv) || 0,
      gmvThisMonth: thisM,
      gmvLastMonth: lastM,
      gmvChange,
      newsletterSubscribers: newsQ.rows[0].c,
      pendingRequests: reqQ.rows[0].c,
    });
  } catch (err) {
    next(err);
  }
}

// رسالة جماعية (للمدير): بريد إعلاني لكل أصحاب المتاجر أو مشتركي النشرة.
// نُرسل بالخلفية بالتتابع بهدوء فلا نحبس الطلب ولا نتجاوز حدود Brevo، ونردّ فوراً بالعدد.
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function broadcastHtml(subject, body) {
  const safe = escapeHtml(body).replace(/\n/g, '<br>');
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#2b2b2b">
    <h2 style="color:#5e4636;margin:0 0 12px">${escapeHtml(subject)}</h2>
    <div style="font-size:15px;line-height:1.7">${safe}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#999">Bazara — بازارا</p>
  </div>`;
}

export async function broadcastMessage(req, res, next) {
  const audience = req.body.audience === 'newsletter' ? 'newsletter' : 'subscribers';
  const subject = String(req.body.subject || '').trim().slice(0, 160);
  const body = String(req.body.body || '').trim().slice(0, 5000);
  if (!subject || !body) return res.status(400).json({ error: 'العنوان والرسالة مطلوبان.' });
  if (!isMailConfigured()) return res.status(400).json({ error: 'خدمة البريد غير مهيّأة على الخادم.' });
  try {
    let emails = [];
    if (audience === 'newsletter') {
      const r = await query("SELECT contact FROM subscribers WHERE kind = 'email'");
      emails = r.rows.map((x) => x.contact);
    } else {
      const admins = adminEmails();
      const notAdmin = admins.length
        ? `AND lower(u.email) NOT IN (${admins.map((e) => `'${e.replace(/'/g, "''")}'`).join(',')})`
        : '';
      const r = await query(`SELECT DISTINCT lower(u.email) AS email FROM users u JOIN stores s ON s.user_id = u.id WHERE u.email <> '' ${notAdmin}`);
      emails = r.rows.map((x) => x.email);
    }
    emails = [...new Set(emails.filter(Boolean))];
    await logAdmin(req, 'broadcast.send', { type: 'broadcast', id: String(emails.length), label: subject, details: { recipients: emails.length } });
    res.json({ queued: emails.length });

    const html = broadcastHtml(subject, body);
    (async () => {
      for (const to of emails) {
        try { await sendMail({ to, subject, html }); }
        catch (e) { console.error('broadcast fail', to, e.message); }
        await new Promise((r) => setTimeout(r, 120)); // هدنة بسيطة بين الرسائل
      }
    })();
  } catch (err) {
    next(err);
  }
}

// تمييز/إلغاء تمييز متجر (للمدير) — المتجر المميّز يتصدّر «متاجر مميزة» بالرئيسية.
// أكثر من هذا العدد يجعل «المميّزة» بلا معنى في الرئيسية
const FEATURED_LIMIT = 8;

export async function setStoreFeatured(req, res, next) {
  const email = (req.body.email || '').trim().toLowerCase();
  const featured = Boolean(req.body.featured);
  if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
  if (isAdminEmail(email)) return res.status(400).json({ error: 'حساب المدير ليس متجراً.' });
  try {
    // حدّ أقصى للمميّزة: لو صار كل متجر مميّزاً فقدت الكلمة معناها وفقدت
    // الرئيسية ترتيبها. الحدّ عند الإضافة فقط — إلغاء التمييز مسموح دائماً.
    if (featured) {
      const cnt = await query('SELECT COUNT(*)::int AS c FROM stores WHERE featured = true');
      if (cnt.rows[0].c >= FEATURED_LIMIT) {
        return res.status(409).json({ error: `الحدّ الأقصى ${FEATURED_LIMIT} متاجر مميّزة. ألغِ تمييز متجر أوّلاً.`, limit: FEATURED_LIMIT });
      }
    }
    const r = await query(
      'UPDATE stores SET featured = $1 WHERE user_id = (SELECT id FROM users WHERE lower(email) = $2) RETURNING id',
      [featured, email]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'لا يوجد متجر بهذا البريد.' });
    clearPublicCache(); // الرئيسية تعكس التمييز فوراً
    await logAdmin(req, featured ? 'store.feature' : 'store.unfeature', { type: 'user', id: email, label: email });
    res.json({ ok: true, featured });
  } catch (err) {
    next(err);
  }
}

export async function listSubscribers(req, res, next) {
  try {
    // حجم المتجر ونشاطه بجانب اسمه: القرار بتفعيل اشتراكٍ أو إيقافه كان
    // يُتّخذ على اسمٍ وبريدٍ فقط، بلا معرفة إن كان المتجر يبيع أصلاً.
    const r = await query(
      `SELECT u.id AS user_id, u.name, u.email, u.subscription_plan, u.subscription_status,
              u.subscription_started_at, u.current_period_end, u.created_at,
              u.suspended_at, u.suspended_reason,
              s.id AS store_id, s.name AS store_name, s.slug AS store_slug, s.featured AS store_featured,
              lr.plan AS requested_plan, lr.status AS requested_status,
              COALESCE(pc.c, 0)::int AS products_count,
              COALESCE(oc.c, 0)::int AS orders_count,
              COALESCE(oc.gmv, 0) AS gmv,
              oc.last_order_at
       FROM users u JOIN stores s ON s.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT plan, status FROM subscription_requests sr
         WHERE sr.user_id = u.id ORDER BY created_at DESC LIMIT 1
       ) lr ON true
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS c FROM products p WHERE p.store_id = s.id) pc ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS c,
                COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('confirmed','shipped','delivered')), 0) AS gmv,
                MAX(o.created_at) AS last_order_at
         FROM orders o WHERE o.store_id = s.id
       ) oc ON true
       ORDER BY u.created_at DESC LIMIT 300`
    );
    res.json({
      subscribers: r.rows.map((x) => ({
        name: x.name,
        email: x.email,
        plan: x.subscription_plan,
        // الخطة التي طلبها المستخدم فعلاً (شهري/سنوي) + حالة الطلب — ليفعّل المدير ما اختاره
        requestedPlan: x.requested_plan || null,
        requestedStatus: x.requested_status || null,
        status: x.subscription_status,
        // المدير: تاريخ اشتراك = تاريخ إنشاء حسابه، واشتراكه مدى الحياة بلا انتهاء
        startedAt: x.subscription_started_at || (isAdminEmail(x.email) ? x.created_at : null),
        currentPeriodEnd: x.current_period_end,
        storeId: x.store_id,
        storeName: x.store_name,
        storeSlug: x.store_slug,
        featured: Boolean(x.store_featured),
        productsCount: x.products_count,
        ordersCount: x.orders_count,
        gmv: Number(x.gmv) || 0,
        lastOrderAt: x.last_order_at,
        suspended: Boolean(x.suspended_at),
        suspendedReason: x.suspended_reason || '',
        active: isUserActive({ email: x.email, subscription_status: x.subscription_status, current_period_end: x.current_period_end, suspended_at: x.suspended_at }),
        isAdmin: isAdminEmail(x.email),
        lifetime: isAdminEmail(x.email),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/subscription/store/:slug ──────────────────────────────────────
// كل ما يخصّ متجراً واحداً في مكان واحد. كان على المدير أن يقرّر التفعيل
// والإيقاف والحذف وهو لا يرى من المتجر إلا اسمه — فأيّ قرارٍ كان تخميناً.
export async function getStoreDetail(req, res, next) {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'المتجر غير محدّد.' });

    const sr = await query(
      `SELECT s.id, s.name, s.slug, s.logo_url, s.featured, s.created_at,
              s.phone, s.whatsapp, s.instagram,
              u.id AS user_id, u.name AS owner_name, u.email, u.phone AS owner_phone,
              u.subscription_status, u.subscription_plan, u.current_period_end, u.created_at AS joined_at
       FROM stores s JOIN users u ON u.id = s.user_id
       WHERE s.slug = $1`,
      [slug]
    );
    const st = sr.rows[0];
    if (!st) return res.status(404).json({ error: 'المتجر غير موجود.' });

    const PAID = "o.status IN ('confirmed','shipped','delivered')";
    const [prod, ord, recent, top] = await Promise.all([
      query(
        // «نفد مخزونه» كان stock = 0 وحده، وnull لا يساوي صفراً بـSQL: نصف
        // المنتجات تقريباً مخزونها لكلّ لون/نمرة وstock عندها فارغ، فكانت
        // تخرج من العدّ كلّياً ويبقى الرقم صفراً بينما الزبونة ترى «نفد
        // المخزون» ويصل المالكة إشعار «نفدت الكمية». نجمع التفصيليّ هنا
        // بنفس منطق البطاقة والإشعار حرفياً.
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE CASE
                    WHEN stock IS NOT NULL THEN stock <= 0
                    WHEN color_stock IS NOT NULL AND color_stock <> '{}'::jsonb THEN (
                      SELECT COALESCE(SUM(q.v), 0) FROM jsonb_each(color_stock) c,
                             LATERAL (SELECT SUM((e.value)::int) AS v FROM jsonb_each_text(c.value) e) q
                    ) <= 0
                    WHEN size_stock IS NOT NULL AND size_stock <> '{}'::jsonb THEN (
                      SELECT COALESCE(SUM((e.value)::int), 0) FROM jsonb_each_text(size_stock) e
                    ) <= 0
                    ELSE FALSE  -- بلا مخزونٍ محدَّد = متوفّر دائماً
                  END
                )::int AS out_of_stock,
                COUNT(*) FILTER (WHERE old_price IS NOT NULL AND old_price > price)::int AS on_sale
         FROM products WHERE store_id = $1`,
        [st.id]
      ),
      query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE o.status = 'new')::int AS pending,
                COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled,
                COALESCE(SUM(o.total) FILTER (WHERE ${PAID}), 0) AS gmv,
                MAX(o.created_at) AS last_order_at
         FROM orders o WHERE o.store_id = $1`,
        [st.id]
      ),
      query(
        `SELECT id, reference, customer_name, total, status, created_at
         FROM orders WHERE store_id = $1 ORDER BY created_at DESC LIMIT 8`,
        [st.id]
      ),
      // الأكثر مبيعاً: يُحتسب من عناصر الطلبات المؤكّدة لا من عدّاد على المنتج
      query(
        `SELECT it->>'name' AS name, SUM((it->>'qty')::int)::int AS qty
         FROM orders o, jsonb_array_elements(o.items) it
         WHERE o.store_id = $1 AND ${PAID}
         GROUP BY 1 ORDER BY qty DESC LIMIT 5`,
        [st.id]
      ),
    ]);

    const p0 = prod.rows[0];
    const o0 = ord.rows[0];
    res.json({
      store: {
        id: st.id, name: st.name, slug: st.slug, logoUrl: st.logo_url || '',
        featured: Boolean(st.featured), createdAt: st.created_at,
        phone: st.phone || '', whatsapp: st.whatsapp || '', instagram: st.instagram || '',
      },
      owner: {
        id: st.user_id, name: st.owner_name, email: st.email, phone: st.owner_phone || '',
        joinedAt: st.joined_at,
        status: st.subscription_status, plan: st.subscription_plan,
        currentPeriodEnd: st.current_period_end,
        active: isUserActive({ email: st.email, subscription_status: st.subscription_status, current_period_end: st.current_period_end }),
        isAdmin: isAdminEmail(st.email),
      },
      products: { total: p0.total, outOfStock: p0.out_of_stock, onSale: p0.on_sale },
      orders: {
        total: o0.total, pending: o0.pending, cancelled: o0.cancelled,
        gmv: Number(o0.gmv) || 0, lastOrderAt: o0.last_order_at,
      },
      recentOrders: recent.rows.map((o) => ({
        id: o.id, reference: o.reference || '', customerName: o.customer_name || '',
        total: Number(o.total), status: o.status, createdAt: o.created_at,
      })),
      topProducts: top.rows.map((x) => ({ name: x.name || '—', qty: x.qty })),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/subscription/store/:slug/products ─────────────────────────────
// منتجات متجرٍ بعين المدير: تشمل المخفيّة (وهي محجوبة عن الزوّار) كي يراجعها
// ويعيدها إن أخطأ. صفحات المتجر العامّة لا تعرضها إطلاقاً.
export async function listStoreProducts(req, res, next) {
  try {
    const slug = String(req.params.slug || '').trim();
    const r = await query(
      `SELECT p.id, p.name, p.price, p.old_price, p.image_url, p.stock, p.category,
              p.created_at, p.hidden_at, p.hidden_reason
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE s.slug = $1
       ORDER BY p.hidden_at IS NULL, p.created_at DESC
       LIMIT 200`,
      [slug]
    );
    res.json({
      products: r.rows.map((x) => ({
        id: x.id,
        name: x.name,
        price: Number(x.price),
        oldPrice: x.old_price != null ? Number(x.old_price) : null,
        imageUrl: x.image_url || '',
        stock: x.stock,
        category: x.category,
        createdAt: x.created_at,
        hidden: Boolean(x.hidden_at),
        hiddenAt: x.hidden_at,
        hiddenReason: x.hidden_reason || '',
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/subscription/product/:id/hide ────────────────────────────────
// إخفاء منتج مخالف بسببٍ مسجَّل. البديل الوحيد قبله كان إيقاف اشتراك المتجر
// كلّه — عقوبةٌ واحدة قاسية بدل أداةٍ دقيقة. السبب إلزاميّ: قرارٌ يُخفي رزق
// أحدهم يجب أن يُعلَّل، ويُعرض على المالكة لاحقاً.
export async function hideProduct(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    if (!reason) return res.status(400).json({ error: 'اكتب سبب الإخفاء.' });

    const r = await query(
      `UPDATE products SET hidden_at = now(), hidden_reason = $2, hidden_by = $3
       WHERE id = $1 RETURNING id, name`,
      [id, reason, req.user?.id || null]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'المنتج غير موجود.' });

    await logAdmin(req, 'product.hide', { type: 'product', id: row.id, label: row.name, details: { reason } });
    res.json({ ok: true, id: row.id, hidden: true, hiddenReason: reason });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/subscription/product/:id/unhide ──────────────────────────────
export async function unhideProduct(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();
    const r = await query(
      `UPDATE products SET hidden_at = NULL, hidden_reason = '', hidden_by = NULL
       WHERE id = $1 RETURNING id, name`,
      [id]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'المنتج غير موجود.' });

    await logAdmin(req, 'product.unhide', { type: 'product', id: row.id, label: row.name });
    res.json({ ok: true, id: row.id, hidden: false });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/subscription/suspend ─────────────────────────────────────────
// إيقاف إداريّ مؤقّت بسبب. كان البديل إمّا إيقاف الاشتراك — فيظهر لصاحبته
// «منتهٍ» وتظنّ أنّ خطأً وقع وتراسلك — أو حذف الحساب وكل بياناته. لا شيء
// بينهما. السبب إلزاميّ ويُعرض لها، فتعرف ما المطلوب لرفع الإيقاف.
export async function suspendSubscriber(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
    if (!reason) return res.status(400).json({ error: 'اكتب سبب الإيقاف.' });
    if (isAdminEmail(email)) return res.status(400).json({ error: 'لا يمكن إيقاف حساب إدارة.' });

    const r = await query(
      `UPDATE users SET suspended_at = now(), suspended_reason = $2, suspended_by = $3
       WHERE lower(email) = lower($1) RETURNING email`,
      [email, reason, req.user?.id || null]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });

    await logAdmin(req, 'account.suspend', { type: 'user', id: email, label: email, details: { reason } });
    res.json({ ok: true, state: await accountState(email) });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/subscription/unsuspend ───────────────────────────────────────
export async function unsuspendSubscriber(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
    const r = await query(
      `UPDATE users SET suspended_at = NULL, suspended_reason = '', suspended_by = NULL
       WHERE lower(email) = lower($1) RETURNING email`,
      [email]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });

    await logAdmin(req, 'account.unsuspend', { type: 'user', id: email, label: email });
    // رفع الإيقاف قد يعيد الحساب فعّالاً أو لا (قد يكون اشتراكه منتهياً أصلاً)
    res.json({ ok: true, state: await accountState(email) });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/subscription/fix-account ─────────────────────────────────────
// تصحيح بريد الحساب أو رابط المتجر. بريدٌ أُدخل خطأً عند التسجيل يعني أنّ
// صاحبته لن تستقبل رمز استعادة أبداً: حسابٌ مقفلٌ فعلياً بلا مخرج.
export async function fixAccount(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
    const newSlug = String(req.body?.newSlug || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'البريد الحالي مطلوب.' });
    if (!newEmail && !newSlug) return res.status(400).json({ error: 'لا يوجد ما يُغيَّر.' });

    const cur = await query('SELECT id FROM users WHERE email = $1', [email]);
    const user = cur.rows[0];
    if (!user) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });

    const changed = {};

    if (newEmail && newEmail !== email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) return res.status(400).json({ error: 'صيغة البريد غير صحيحة.' });
      if (isAdminEmail(newEmail)) return res.status(400).json({ error: 'لا يمكن استعمال بريد إدارة.' });
      const taken = await query('SELECT 1 FROM users WHERE email = $1', [newEmail]);
      if (taken.rows.length) return res.status(409).json({ error: 'البريد مستعمل بحساب آخر.' });
      // أيّ رمز استعادة قديم يُلغى مع تغيّر البريد، وإلا بقي صالحاً لعنوانٍ لم يعد للحساب
      await query('UPDATE users SET email = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [newEmail, user.id]);
      changed.email = newEmail;
    }

    if (newSlug) {
      if (!/^[a-z0-9-]{3,40}$/.test(newSlug)) return res.status(400).json({ error: 'الرابط: أحرف إنجليزية وأرقام وشرطات، 3–40 حرفاً.' });
      const taken = await query('SELECT 1 FROM stores WHERE slug = $1 AND user_id <> $2', [newSlug, user.id]);
      if (taken.rows.length) return res.status(409).json({ error: 'الرابط مستعمل بمتجر آخر.' });
      const up = await query('UPDATE stores SET slug = $1 WHERE user_id = $2 RETURNING slug', [newSlug, user.id]);
      if (!up.rows[0]) return res.status(404).json({ error: 'لا يوجد متجر لهذا الحساب.' });
      changed.slug = newSlug;
    }

    await logAdmin(req, 'account.fix', { type: 'user', id: email, label: email, details: changed });
    res.json({ ok: true, ...changed });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/subscription/admin-log ────────────────────────────────────────
export async function listAdminLog(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const r = await query(
      `SELECT id, admin_email, action, target_type, target_id, target_label, details, created_at
       FROM admin_actions ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({
      actions: r.rows.map((x) => ({
        id: x.id,
        adminEmail: x.admin_email,
        action: x.action,
        targetType: x.target_type,
        targetId: x.target_id,
        targetLabel: x.target_label,
        details: x.details || {},
        createdAt: x.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// حذف حساب مشترك نهائياً (للمدير) — يحذف معه المتجر والمنتجات (CASCADE)
// تعيين/تغيير اشتراك مشترك مباشرة (للمدير):
// يضبط الخطة، وتاريخ البدء = وقت الضغط الفعلي، والانتهاء = البدء + مدة الخطة (شهر/سنة).
export async function setSubscription(req, res, next) {
  const email = (req.body.email || '').trim().toLowerCase();
  const { plan } = req.body;
  if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
  if (!PLANS[plan]) return res.status(400).json({ error: 'خطة غير صالحة.' });
  if (isAdminEmail(email)) return res.status(400).json({ error: 'لا يمكن تعديل اشتراك حساب المدير (اشتراكه مدى الحياة).' });
  try {
    const cur = await query('SELECT id, current_period_end FROM users WHERE lower(email) = $1', [email]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });

    const from = new Date(); // وقت الضغط الفعلي
    // الوقت المتبقّي من الاشتراك الحالي (بالمللي ثانية، دقيق للثانية) — يُضاف فوق الخطة الجديدة
    const cpe = cur.rows[0].current_period_end ? new Date(cur.rows[0].current_period_end) : null;
    const remainingMs = cpe ? Math.max(0, cpe.getTime() - from.getTime()) : 0;
    // النهاية = الآن + مدة الخطة الجديدة + المتبقّي
    const end = new Date(planPeriodEnd(plan, from).getTime() + remainingMs);

    await query(
      // تاريخ البدء = أوّل تفعيلٍ للحساب، لا آخر تعديل: كان يُصفَّر مع كلّ
      // تغيير خطّة فيبدو المشترك القديم كأنّه اشترك اليوم.
      `UPDATE users SET subscription_status='active', subscription_plan=$1, current_period_end=$2,
              subscription_started_at = COALESCE(subscription_started_at, $3)
         WHERE id=$4`,
      [plan, end, from, cur.rows[0].id]
    );
    await logAdmin(req, 'subscription.set', { type: 'user', id: email, label: email, details: { plan, currentPeriodEnd: end } });
    // الحالة الحقيقية بعد التغيير: الحساب الموقوف يبقى موقوفاً ومتجره مخفيّاً
    // مهما فُعّل اشتراكه — نقولها بدل أن تفترض الواجهة أنّه صار فعّالاً.
    res.json({ message: 'تم تحديث الاشتراك.', state: await accountState(email) });
  } catch (err) {
    next(err);
  }
}

// إضافة أيام على اشتراك مشترك (للمدير): تمدّد تاريخ الانتهاء بدقّة (1–365 يوم) دون تغيير الخطة.
export async function addSubscriptionDays(req, res, next) {
  const email = (req.body.email || '').trim().toLowerCase();
  const days = Number(req.body.days);
  if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return res.status(400).json({ error: 'عدد أيام غير صالح (من 1 إلى 365).' });
  }
  if (isAdminEmail(email)) return res.status(400).json({ error: 'لا يمكن تعديل اشتراك حساب المدير.' });
  try {
    const cur = await query('SELECT id, current_period_end FROM users WHERE lower(email) = $1', [email]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });

    const now = new Date();
    const cpe = cur.rows[0].current_period_end ? new Date(cur.rows[0].current_period_end) : null;
    // إن كان لسا فعّالاً نمدّد من تاريخ الانتهاء الحالي، وإن كان منتهياً نبدأ من الآن
    const base = cpe && cpe > now ? cpe : now;
    const end = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    // اضبط ساعة الانتهاء على لحظة الإضافة (أيام كاملة) — يبقى نفس عدد الأيام بدقّة من وقت الضغط
    end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    await query(
      "UPDATE users SET subscription_status='active', current_period_end=$1 WHERE id=$2",
      [end, cur.rows[0].id]
    );
    await logAdmin(req, 'subscription.addDays', { type: 'user', id: email, label: email, details: { days, currentPeriodEnd: end } });
    res.json({ message: 'تمت إضافة الأيام.', addedDays: days, state: await accountState(email) });
  } catch (err) {
    next(err);
  }
}

export async function deleteSubscriber(req, res, next) {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
  if (isAdminEmail(email)) return res.status(400).json({ error: 'لا يمكن حذف حساب المدير.' });
  try {
    const r = await query('DELETE FROM users WHERE lower(email) = $1 RETURNING id', [email]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });
    await logAdmin(req, 'subscriber.delete', { type: 'user', id: email, label: email });
    res.json({ message: 'تم حذف الحساب وكل بياناته.', email });
  } catch (err) {
    next(err);
  }
}

// قائمة الأكواد (للمدير)
export async function listCodes(req, res, next) {
  try {
    const r = await query(
      `SELECT c.code, c.plan, c.used, c.used_at, c.created_at, u.email AS used_email
       FROM activation_codes c LEFT JOIN users u ON u.id = c.used_by
       ORDER BY c.used ASC, c.created_at DESC LIMIT 200`
    );
    res.json({
      codes: r.rows.map((x) => ({
        code: x.code, plan: x.plan, used: x.used, usedAt: x.used_at, usedEmail: x.used_email, createdAt: x.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// قائمة الطلبات (الأحدث أولاً) مع بيانات المستخدم والمتجر
export async function listRequests(req, res, next) {
  try {
    const r = await query(
      `SELECT sr.id, sr.plan, sr.method, sr.reference, sr.status, sr.created_at,
              u.name AS user_name, u.email AS user_email,
              s.name AS store_name, s.slug AS store_slug
       FROM subscription_requests sr
       JOIN users u ON u.id = sr.user_id
       LEFT JOIN stores s ON s.user_id = u.id
       ORDER BY (sr.status = 'pending') DESC, sr.created_at DESC
       LIMIT 200`
    );
    res.json({
      requests: r.rows.map((x) => ({
        id: x.id,
        plan: x.plan,
        method: x.method,
        reference: x.reference,
        status: x.status,
        createdAt: x.created_at,
        userName: x.user_name,
        userEmail: x.user_email,
        storeName: x.store_name,
        storeSlug: x.store_slug,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// موافقة: تفعيل اشتراك المستخدم وتمديد المدة حسب الخطة
export async function approveRequest(req, res, next) {
  const { id } = req.params;
  try {
    const reqRow = await query('SELECT user_id, plan, status FROM subscription_requests WHERE id = $1', [id]);
    const sr = reqRow.rows[0];
    if (!sr) return res.status(404).json({ error: 'الطلب غير موجود.' });

    // نمدد من نهاية الفترة الحالية إن كانت مستقبلية (تجديد يتراكم)
    const userRow = await query('SELECT current_period_end FROM users WHERE id = $1', [sr.user_id]);
    const cur = userRow.rows[0]?.current_period_end;
    const from = cur && new Date(cur) > new Date() ? new Date(cur) : new Date();
    const end = planPeriodEnd(sr.plan, from);

    await query(
      // COALESCE: أول تفعيلٍ يكتب تاريخ البدء، والتجديد يُبقي الأصليّ.
      `UPDATE users SET subscription_status='active', subscription_plan=$1, current_period_end=$2,
              subscription_started_at = COALESCE(subscription_started_at, now())
         WHERE id=$3`,
      [sr.plan, end, sr.user_id]
    );
    await query("UPDATE subscription_requests SET status='approved', reviewed_at=now() WHERE id=$1", [id]);

    await logAdmin(req, 'request.approve', { type: 'request', id: String(id), label: String(id), details: { currentPeriodEnd: end } });
    res.json({ message: 'تم تفعيل الاشتراك.', currentPeriodEnd: end });
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req, res, next) {
  const { id } = req.params;
  try {
    const r = await query(
      "UPDATE subscription_requests SET status='rejected', reviewed_at=now() WHERE id=$1 RETURNING id",
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود.' });
    await logAdmin(req, 'request.reject', { type: 'request', id: String(id), label: String(id) });
    res.json({ message: 'تم رفض الطلب.' });
  } catch (err) {
    next(err);
  }
}


// ── POST /api/subscription/stop-subscription ───────────────────────────────
// إنهاء اشتراكٍ فوراً: لم تدفع، أو ألغت، أو رُدّ التحويل.
//
// كان المتاح إمّا الانتظار حتى ينتهي وحده (فتبقى تبيع شهراً بلا دفع) أو
// الإيقاف الإداريّ — وهو رسالةٌ أخرى تماماً: تظهر لها «موقوف: <سبب>» فتظنّ
// أنّها خالفت شيئاً، ولا زرّ تجديدٍ أمامها. الإنهاء يُغلق المتجر برسالة
// «انتهى اشتراكك» ويضع زرّ التجديد في طريقها — وهو المطلوب حين لا تدفع.
export async function stopSubscription(req, res, next) {
  const email = (req.body.email || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim().slice(0, 200);
  if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
  if (isAdminEmail(email)) return res.status(400).json({ error: 'لا يمكن إنهاء اشتراك حساب المدير.' });
  try {
    const cur = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (!cur.rows.length) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });

    // نهاية الفترة = الآن لا NULL: التاريخ يبقى شاهداً على متى انتهى فعلاً،
    // ولو مسحناه لبدا الحساب كأنّه لم يشترك قطّ فيضيع سجلّه.
    await query(
      "UPDATE users SET subscription_status='expired', current_period_end=now() WHERE id=$1",
      [cur.rows[0].id]
    );
    // طلبٌ معلّق لم يعد له معنى بعد الإنهاء
    await query("UPDATE subscription_requests SET status='rejected', reviewed_at=now() WHERE user_id=$1 AND status='pending'", [cur.rows[0].id]);

    await logAdmin(req, 'subscription.stop', { type: 'user', id: email, label: email, details: reason ? { reason } : {} });
    res.json({ message: 'تم إنهاء الاشتراك.', state: await accountState(email) });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/subscription/impersonate ─────────────────────────────────────
// جلسة «أرى ما تراه هي»: توكن قصير الأجل باسم صاحبة المتجر، يحمل ختم من
// فتحه. أقوى أداة دعم ممكنة — تُشخَّص مشكلتها من داخل لوحتها بلا أن تُطلب
// كلمة سرّها ولا أن تُوصف لك الشاشة عبر الهاتف.
//
// حدودها مقصودة: لا تُفتح على حساب إدارة، ومدّتها ساعة، وأدوات الإدارة
// محجوبة داخلها (requireAdmin يرفض التوكن المختوم)، وكلّ فتحٍ يُسجَّل.
const IMPERSONATE_MINUTES = 60;

export async function impersonate(req, res, next) {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'البريد مطلوب.' });
  if (isAdminEmail(email)) return res.status(400).json({ error: 'لا يمكن فتح جلسة على حساب إدارة.' });
  try {
    const r = await query(
      `SELECT u.id, u.email, u.name, s.name AS store_name, s.slug
         FROM users u LEFT JOIN stores s ON s.user_id = u.id
        WHERE lower(u.email) = lower($1)`,
      [email]
    );
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: 'لا يوجد حساب بهذا البريد.' });

    const token = jwt.sign(
      {
        sub: u.id,
        email: u.email,
        // ختم الجلسة: يمنع صلاحيات الإدارة ويُبقي أثر من فتحها
        imp: { by: req.user.id, byEmail: req.user.email, at: Date.now() },
      },
      process.env.JWT_SECRET,
      { expiresIn: `${IMPERSONATE_MINUTES}m` }
    );

    await logAdmin(req, 'account.impersonate', {
      type: 'user', id: email, label: email,
      details: { store: u.store_name || '', minutes: IMPERSONATE_MINUTES },
    });

    res.json({
      token,
      minutes: IMPERSONATE_MINUTES,
      user: { name: u.name, email: u.email, storeName: u.store_name || '', slug: u.slug || '' },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────── تسجيلُ التاجراتِ مستفيداتٍ لاستلامِ المدفوعات ───────────────
// التاجرةُ تُدخلُ حسابَها البنكيَّ من إعداداتِها، ثمّ نسجّلُها نحن عند PayTabs
// ونضعُ رقمَ المستفيدِ الذي يعطونَنا إيّاه. عندها يظهرُ زرُّ الفيزا بمتجرِها.

// قائمةُ المتاجرِ التي أدخلت حساباً بنكيّاً — للإدارة
export async function listPayoutRequests(req, res, next) {
  try {
    const r = await query(
      `SELECT s.id, s.name, s.slug, s.bank_account_name, s.bank_name, s.bank_iban, s.bank_swift,
              s.paytabs_entity_id, s.lahza_subaccount, s.payout_status, s.platform_fee_percent,
              s.updated_at, u.email
         FROM stores s JOIN users u ON u.id = s.user_id
        WHERE s.bank_iban <> ''
        ORDER BY (s.payout_status = 'pending') DESC, s.updated_at DESC`
    );
    res.json({ payouts: r.rows.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      email: s.email,
      bankAccountName: s.bank_account_name || '',
      bankName: s.bank_name || '',
      bankIban: s.bank_iban || '',
      bankSwift: s.bank_swift || '',
      entityId: s.paytabs_entity_id || '',
      subaccount: s.lahza_subaccount || '',
      status: s.payout_status || 'none',
      feePercent: Number(s.platform_fee_percent || 0),
      updatedAt: s.updated_at,
    })) });
  } catch (err) {
    next(err);
  }
}

// ربطُ متجرٍ برقمِ المستفيدِ بعدَ تسجيلِه عند PayTabs — ويُشعَرُ صاحبُه أنّه صار جاهزاً
export async function setPayoutEntity(req, res, next) {
  const storeId = String(req.params.id || '');
  const entityId = String(req.body?.entityId || '').trim().slice(0, 20);
  const subaccount = String(req.body?.subaccount || '').trim().slice(0, 40);
  const feePercent = Math.min(100, Math.max(0, Number(req.body?.feePercent) || 0));
  try {
    if (entityId && !/^\d+$/.test(entityId)) {
      return res.status(400).json({ error: 'رقم المستفيد أرقام فقط.' });
    }
    if (subaccount && !/^ACCT_[A-Za-z0-9]+$/.test(subaccount)) {
      return res.status(400).json({ error: 'رمز الحساب الفرعي يبدأ بـ ACCT_ ثم أحرف وأرقام.' });
    }
    const r = await query(
      `UPDATE stores
          SET paytabs_entity_id = $1,
              lahza_subaccount = $2,
              platform_fee_percent = $3,
              payout_status = CASE WHEN $1 <> '' OR $2 <> '' THEN 'active' ELSE 'pending' END,
              updated_at = now()
        WHERE id = $4
        RETURNING name, payout_status`,
      [entityId, subaccount, feePercent, storeId]
    );
    const s = r.rows[0];
    if (!s) return res.status(404).json({ error: 'المتجر غير موجود.' });

    clearPublicCache();
    if (s.payout_status === 'active') {
      notifyStoreOwner(storeId, {
        type: 'payout_active',
        title: 'الدفع بالبطاقة صار جاهزاً 💳',
        body: 'زرُّ الدفع بالفيزا صار يظهر لزبوناتك، وثمنُ الطلبات يصل حسابك البنكي.',
        url: '/dashboard/store',
      }).catch(() => {});
    }
    await logAdmin(req.user, 'payout_entity', `${s.name}: lahza=${subaccount || '—'} paytabs=${entityId || '—'} fee=${feePercent}%`);
    res.json({ ok: true, status: s.payout_status });
  } catch (err) {
    next(err);
  }
}

// إنشاءُ حسابٍ فرعيٍّ تلقائياً عند Lahza من بياناتِ التاجرةِ البنكيّة — ضغطة واحدة من الإدارة
export async function autoCreateSubaccount(req, res, next) {
  const storeId = String(req.params.id || '');
  const feePercent = Math.min(100, Math.max(0, Number(req.body?.feePercent) || 0));
  try {
    if (!isLahzaConfigured()) return res.status(503).json({ error: 'Lahza غير مهيّأة على الخادم.' });

    const r = await query(
      'SELECT id, name, bank_code, bank_name, bank_iban, bank_swift, lahza_subaccount FROM stores WHERE id = $1',
      [storeId]
    );
    const store = r.rows[0];
    if (!store) return res.status(404).json({ error: 'المتجر غير موجود.' });
    if (!store.bank_iban) return res.status(400).json({ error: 'التاجرة لم تُدخل بياناتها البنكية بعد.' });
    if (store.lahza_subaccount) return res.status(409).json({ error: `الحساب الفرعي موجود مسبقاً: ${store.lahza_subaccount}` });

    // نجلب قائمة بنوك Lahza ونبحث عن البنك بالسويفت أو الاسم
    let lahzaBankCode = '';
    try {
      const banks = await listBanks();
      const list = banks.data || [];
      const swift = (store.bank_swift || '').toLowerCase();
      const name = (store.bank_name || '').toLowerCase();
      const match = list.find((b) => {
        const bn = (b.name || '').toLowerCase();
        const bs = (b.slug || '').toLowerCase();
        const blc = (b.longcode || '').toLowerCase();
        if (swift && (bn.includes(swift) || bs.includes(swift) || blc.includes(swift))) return true;
        if (name && (bn.includes(name) || name.includes(bn))) return true;
        const words = name.split(/[\s()]+/).filter(Boolean);
        return words.some((w) => w.length > 3 && bn.includes(w));
      });
      if (match) lahzaBankCode = String(match.code || match.bank_code || match.id || '');
    } catch { /* نتابع بكود المتجر لو فشل الجلب */ }

    if (!lahzaBankCode) {
      return res.status(422).json({
        error: `بنك "${store.bank_name || store.bank_code}" غير موجود بقائمة Lahza. استخدم «إدخال يدوي» بعد إنشائه من لوحة Lahza.`,
      });
    }

    let data;
    try {
      data = await createSubaccount({
        businessName: store.name,
        bankCode: lahzaBankCode,
        accountNumber: store.bank_iban.replace(/\s/g, ''),
        percentageCharge: 100 - feePercent,
      });
    } catch (lahzaErr) {
      return res.status(422).json({ error: `Lahza رفضت الطلب (كود البنك: ${lahzaBankCode}): ${lahzaErr.message}` });
    }

    const code = data.data?.subaccount_code || '';
    if (!code) return res.status(422).json({ error: 'Lahza لم تُعِد رمز حساب فرعي.' });

    await query(
      `UPDATE stores SET lahza_subaccount = $1, platform_fee_percent = $2, payout_status = 'active', updated_at = now() WHERE id = $3`,
      [code, feePercent, storeId]
    );

    clearPublicCache();
    notifyStoreOwner(storeId, {
      type: 'payout_active',
      title: 'الدفع بالبطاقة صار جاهزاً 💳',
      body: 'زرُّ الدفع بالفيزا صار يظهر لزبوناتك، وثمنُ الطلبات يصل حسابك البنكي.',
      url: '/dashboard/store',
    }).catch(() => {});

    await logAdmin(req.user, 'payout_auto_create', `${store.name}: ${code} fee=${feePercent}%`);
    res.json({ ok: true, subaccount: code, status: 'active' });
  } catch (err) {
    next(err);
  }
}

// قائمة البنوك المدعومة عند Lahza — يعرضها المدير ليعرف أي بنك يدعمه الإنشاء التلقائي
export async function getLahzaBanks(_req, res, next) {
  try {
    if (!isLahzaConfigured()) return res.status(503).json({ error: 'Lahza غير مهيّأة.' });
    const data = await listBanks();
    res.json({ banks: data.data || [] });
  } catch (err) {
    next(err);
  }
}

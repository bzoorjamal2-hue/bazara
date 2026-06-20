import { query } from '../config/db.js';
import { mapProduct } from './product.controller.js';
import { activeStoreSql } from '../utils/subscription.js';

// مساعِدة التسوّق الذكية (Claude): تتكلّم مع الزبونة وترشّح لها قطعاً من منتجات
// هذا المتجر فقط (grounding). المفتاح يبقى على الخادم ولا يصل المتصفّح أبداً.

const MODEL = process.env.ASSISTANT_MODEL || 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PRODUCTS = 60; // سقف الكتالوج المُمرَّر للنموذج (يوازن الجودة والتكلفة)
const MAX_MESSAGES = 12;  // سقف رسائل المحادثة

// أعمدة مختصرة كفاية لترشيح ذكي بلا تضخيم التوكنات
const CATALOG_SELECT = `
  SELECT p.id, p.name, p.description, p.category, p.price, p.old_price, p.sale_ends_at,
         p.size, p.color, p.stock, p.featured,
         s.slug AS store_slug, s.name AS store_name
  FROM products p
  JOIN stores s ON s.id = p.store_id
  JOIN users u ON u.id = s.user_id
`;

// نص كتالوج مضغوط يقرأه النموذج — معرّف + اسم + فئة + سعر + لون/مقاس + توفّر + وصف مقتطع
function catalogLine(p) {
  let price = Number(p.price);
  let old = p.old_price != null ? Number(p.old_price) : null;
  const saleEnds = p.sale_ends_at ? new Date(p.sale_ends_at) : null;
  const onSale = saleEnds && saleEnds > new Date() && old && old > price;
  const desc = (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const parts = [
    `id:${p.id}`,
    `الاسم:${p.name}`,
    `الفئة:${p.category}`,
    onSale ? `السعر:${price} (كان ${old} — عرض)` : `السعر:${price}`,
  ];
  if (p.color) parts.push(`الألوان:${p.color}`);
  if (p.size) parts.push(`المقاسات:${p.size}`);
  parts.push(p.stock === 0 ? 'التوفّر:نفد' : 'التوفّر:متوفّر');
  if (desc) parts.push(`الوصف:${desc}`);
  return '- ' + parts.join(' | ');
}

const SYSTEM_PROMPT = `أنتِ "مساعِدة بازارا"، خبيرة أناقة وتسوّق في متجر أزياء نسائي فاخر. جمهورك سيّدات، فخاطبيهنّ بصيغة المؤنّث بلطف ودفء وذوق راقٍ.

مهمّتك: تفهمين ما تبحث عنه الزبونة (مناسبة، ستايل، لون، مقاس، ميزانية) وترشّحين لها قطعاً مناسبة من كتالوج هذا المتجر فقط.

قواعد صارمة:
- لا ترشّحي إلا منتجات موجودة في الكتالوج أدناه، وبمعرّفها (id) الحرفي تماماً. لا تخترعي منتجات أو أسعاراً أو معرّفات.
- اذكري في productIds معرّفات القطع التي تقترحينها فعلاً (٦ كحدّ أقصى، الأنسب أولاً). إن لم يناسب شيء، اتركيها فارغة وردّي بلطف واقترحي بديلاً أو اسألي سؤالاً يوضّح طلبها.
- ردّك في reply قصير ودافئ (جملتان أو ثلاث)، يشرح لماذا تناسب هذه القطع أو يكمّل الإطلالة. لا تكرري أسعاراً أو تفاصيل ستظهر تلقائياً على الكروت.
- جاوبي بنفس لغة الزبونة (عربية افتراضياً، وإن كتبت بالإنجليزية فبالإنجليزية).
- إن سألت عن مقاس استرشدي بالمقاسات المتاحة، وإن سألت عن التوصيل/الدفع/الإرجاع فاطلبي منها مراسلة المتجر عبر واتساب (لا تخترعي سياسات).
- كوني موجزة، أنيقة، وبلا مبالغة تسويقية فجّة.`;

export async function chatAssistant(req, res, next) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'المساعِدة الذكية غير مفعّلة حالياً.', disabled: true });
  }

  const slug = String(req.body.store || '').trim();
  if (!slug) return res.status(400).json({ error: 'المتجر مطلوب.' });

  // تنظيف رسائل المحادثة القادمة من العميل
  const raw = Array.isArray(req.body.messages) ? req.body.messages : [];
  const messages = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1000) }))
    .filter((m) => m.content);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'أرسلي رسالة أولاً.' });
  }

  try {
    const active = activeStoreSql('u');
    const storeRes = await query(`SELECT id, name FROM stores s JOIN users u ON u.id = s.user_id WHERE s.slug = $1 AND ${active}`, [slug]);
    const store = storeRes.rows[0];
    if (!store) return res.status(404).json({ error: 'المتجر غير موجود.' });

    const prodRes = await query(
      `${CATALOG_SELECT} WHERE p.store_id = $1 ORDER BY p.featured DESC, p.created_at DESC LIMIT ${MAX_PRODUCTS}`,
      [store.id]
    );
    if (prodRes.rows.length === 0) {
      return res.json({ reply: 'لسّا ما في قطع معروضة بهالمتجر. تابعينا قريباً 🌷', products: [] });
    }

    const catalog = prodRes.rows.map(catalogLine).join('\n');
    const validIds = new Set(prodRes.rows.map((p) => String(p.id)));

    const system = `${SYSTEM_PROMPT}\n\nاسم المتجر: ${store.name}\n\nكتالوج المتجر (المصدر الوحيد المسموح للترشيح):\n${catalog}`;

    // أداة مُلزِمة لمخرجات منظّمة: رسالة + معرّفات القطع المقترحة
    const tools = [{
      name: 'suggest',
      description: 'ترشيح قطع للزبونة مع رسالة ودّية.',
      input_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string', description: 'رسالة قصيرة دافئة للزبونة بلغتها.' },
          productIds: { type: 'array', items: { type: 'string' }, description: 'معرّفات القطع المقترحة من الكتالوج، الأنسب أولاً (٦ كحدّ أقصى).' },
        },
        required: ['reply', 'productIds'],
      },
    }];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let apiRes;
    try {
      apiRes = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 700,
          system,
          tools,
          tool_choice: { type: 'tool', name: 'suggest' },
          messages,
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => '');
      console.error('⚠️ فشل استدعاء Claude:', apiRes.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'تعذّر الوصول للمساعِدة الآن. حاولي بعد لحظات.' });
    }

    const data = await apiRes.json();
    const toolUse = Array.isArray(data.content) ? data.content.find((b) => b.type === 'tool_use') : null;
    const out = toolUse?.input || {};
    const reply = typeof out.reply === 'string' && out.reply.trim()
      ? out.reply.trim()
      : 'تفضّلي بعض الاقتراحات 🌷';
    const ids = Array.isArray(out.productIds) ? out.productIds.map(String).filter((id) => validIds.has(id)).slice(0, 6) : [];

    // نُرجع المنتجات الحقيقية كاملة لتُعرض ككروت (نفس شكل بقية الصفحات)
    let products = [];
    if (ids.length) {
      const r = await query(
        `SELECT p.*, s.slug AS store_slug, s.name AS store_name, s.whatsapp AS store_whatsapp,
                s.instagram AS store_instagram, s.phone AS store_phone, s.size_chart AS store_size_chart,
                s.return_policy AS store_return_policy,
                0 AS rating_avg, 0 AS rating_count
         FROM products p JOIN stores s ON s.id = p.store_id
         WHERE p.id = ANY($1::uuid[])`,
        [ids]
      );
      const byId = new Map(r.rows.map((row) => [String(row.id), mapProduct(row)]));
      products = ids.map((id) => byId.get(id)).filter(Boolean); // نحافظ على ترتيب النموذج
    }

    res.json({ reply, products });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'المساعِدة استغرقت وقتاً أطول من المعتاد. حاولي مجدداً.' });
    }
    next(err);
  }
}

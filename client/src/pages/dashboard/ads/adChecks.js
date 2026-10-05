// فحصُ ما قبلَ النشر — ما يقولُه مسوّقٌ خبيرٌ لو نظرَ فوقَ كتفِ التاجرة.
//
// ثلاثُ درجات: «error» يمنعُ النشرَ (إعلانٌ لن يعملَ أو سيُرفَض)، «warn» ينبّهُ ولا يمنع
// (سيعملُ لكنّه سيصرفُ أكثرَ ممّا يلزم)، «tip» نصيحة. والمفاتيحُ تُترجَمُ بالواجهة:
// adStudio.chk.<key> — والقيمُ بـparams.

const STORY_PLACEMENTS = ['ig_story', 'ig_reels', 'fb_story', 'fb_reels'];

export function runChecks({ product, copy, gen, creative, settings, goal, publishing }) {
  const out = [];
  const add = (level, key, params) => out.push({ level, key, params });
  const a = gen?.audience || {};
  const budget = Number(gen?.budget) || 0;
  const days = Number(gen?.days) || 0;

  if (!product) add('error', 'noProduct');
  if (!copy?.headline?.trim()) add('error', 'noHeadline');
  if (!copy?.primary?.trim()) add('error', 'noPrimary');
  if (budget <= 0) add('error', 'noBudget');
  if (Number(a.ageMin) > Number(a.ageMax)) add('error', 'ageOrder');
  if (settings.format === 'video' && !product?.video) add('error', 'noVideo');
  if (goal === 'messages' && publishing?.enabled && !publishing.pageLinked) add('error', 'noInbox');

  if ((copy?.headline || '').length > 40) add('warn', 'longHeadline', { n: copy.headline.length });
  if ((copy?.primary || '').length > 125) add('tip', 'longPrimary', { n: copy.primary.length });
  if (budget > 0 && budget < 10) add('warn', 'lowBudget');
  if (days > 0 && days < 3) add('warn', 'shortRun');
  if (Number(a.ageMax) - Number(a.ageMin) < 6) add('warn', 'narrowAge');
  if ((a.cities || []).length === 1 && (a.interests || []).length >= 2) add('warn', 'narrowAudience');
  if ((a.interests || []).length > 6) add('tip', 'manyInterests');

  if (goal === 'sales' && !publishing?.pixel) add('tip', 'noPixel');
  if (goal === 'messages' && publishing?.enabled && !publishing.igLinked) add('tip', 'messengerOnly');

  const manual = (settings.placements || []).length > 0;
  const vertical = manual && settings.placements.every((p) => STORY_PLACEMENTS.includes(p));
  if (settings.format === 'image' && vertical && creative?.size !== 'story') add('warn', 'storySize');
  if (settings.format === 'image' && !manual && creative?.size === 'wide') add('tip', 'wideAuto');
  if (product?.video && settings.format === 'image') add('tip', 'tryVideo');

  if (settings.startAt && new Date(settings.startAt).getTime() < Date.now()) add('warn', 'pastStart');
  if (settings.abTest) add('tip', 'abBudget', { per: Math.round(budget / 3) });

  return out;
}

export const blocking = (checks) => checks.some((c) => c.level === 'error');

// تتبّع الستوريات المُشاهَدة محلياً (حلقة ذهبية = غير مشاهَدة، رمادية = مُشاهَدة)
const KEY = 'bz_seen_stories';

export function getSeenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}

export function markSeen(id) {
  if (!id) return;
  try {
    const set = getSeenSet();
    set.add(id);
    const arr = [...set].slice(-600); // حدّ معقول لئلا يكبر التخزين
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch { /* تجاهل */ }
}

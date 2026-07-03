import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';

// حقل بحث قرى gobox (نظام LogesTechs يعتمد القرى): يكتب صاحب المتجر جزءاً من اسم
// القرية/المنطقة، فنبحث حيّاً ونعرض النتائج؛ اختيار عنصر يُرجّع { region, city, village, label }.
// props: value (label نصّي معروض), onPick(villageObj), placeholder, initialQuery
export default function VillageSearch({ value = '', onPick, placeholder, initialQuery = '' }) {
  const { t } = useTranslation();
  const [q, setQ] = useState(value || initialQuery);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(Boolean(value));
  const boxRef = useRef(null);
  const timer = useRef(null);

  // بحث مؤجّل (debounce) — يقلّل الاستدعاءات أثناء الكتابة
  useEffect(() => {
    if (picked) return; // لا نبحث بعد اختيار عنصر (النص صار اسم القرية المختارة)
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get('/gobox/villages', { params: { search: term } });
        setResults(r.data.villages || []);
        setOpen(true);
      } catch { setResults([]); } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q, picked]);

  // إغلاق القائمة عند الضغط خارجها
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (v) => {
    setQ(v.label);
    setPicked(true);
    setOpen(false);
    onPick?.(v);
  };

  const onType = (val) => {
    setQ(val);
    setPicked(false);
    onPick?.(null); // مسح الاختيار السابق حتى يعيد المستخدم الاختيار
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        className="input"
        value={q}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder={placeholder || t('dashboard.gobox.villagePh')}
        autoComplete="off"
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-gold-400/20 bg-ink-900 shadow-2xl">
          {loading && <div className="px-3 py-2 text-xs text-stone-400">{t('common.loading')}</div>}
          {results.map((v) => (
            <button
              key={`${v.village}-${v.city}`}
              type="button"
              onClick={() => choose(v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm text-stone-200 transition hover:bg-gold-400/10"
            >
              <span className="truncate">{v.name}</span>
              {v.cityName && <span className="shrink-0 text-[11px] text-stone-400">{v.cityName}</span>}
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-stone-400">{t('dashboard.gobox.noVillages')}</div>
          )}
        </div>
      )}
    </div>
  );
}

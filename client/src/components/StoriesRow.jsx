import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { cldThumb } from '../utils/cloudinary.js';
import { getSeenSet, markSeen } from '../utils/storySeen.js';
import StoryViewer from './StoryViewer.jsx';
import { StoreIcon } from './icons.jsx';

// صف ستوريات السوق العام (الصفحة الرئيسية): دائرة لكل متجر لديه ستوريات فعّالة،
// الضغط يفتح ستوريات ذلك المتجر. حلقة ذهبية = غير مُشاهَدة.
export default function StoriesRow() {
  const [feed, setFeed] = useState([]);
  const [seen, setSeen] = useState(() => getSeenSet());
  const [active, setActive] = useState(null); // المتجر المفتوح

  useEffect(() => {
    let on = true;
    api.get('/public/stories').then((r) => { if (on) setFeed(r.data.feed || []); }).catch(() => {});
    return () => { on = false; };
  }, []);

  const onSeen = (id) => { markSeen(id); setSeen(getSeenSet()); };

  if (feed.length === 0) return null;

  return (
    <div className="mt-6 -mx-4 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
      <div className="flex gap-4">
        {feed.map((s) => {
          const gold = s.stories.some((x) => !seen.has(x.id));
          return (
            <button key={s.slug} onClick={() => setActive(s)} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 active:scale-95" aria-label={s.name}>
              <span className={`block rounded-full p-[2.5px] ${gold ? 'bg-gradient-to-tr from-gold-400 via-wine to-gold-300' : 'bg-wine/20'}`}>
                <span className="block rounded-full bg-white p-[2px]">
                  {s.logoUrl
                    ? <img src={cldThumb(s.logoUrl, 160)} alt={s.name} className="h-14 w-14 rounded-full object-cover" />
                    : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream text-wine"><StoreIcon className="h-7 w-7" /></span>}
                </span>
              </span>
              <span className="max-w-[4.5rem] truncate text-[11px] font-medium text-wine">{s.name}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <StoryViewer
          stories={active.stories}
          store={{ name: active.name, logoUrl: active.logoUrl, slug: active.slug, whatsapp: active.whatsapp }}
          onClose={() => setActive(null)}
          onSeen={onSeen}
        />
      )}
    </div>
  );
}

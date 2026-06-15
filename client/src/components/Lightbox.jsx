import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import useScrollLock from '../hooks/useScrollLock.js';
import CloseButton from './CloseButton.jsx';

// عارض صور بملء الشاشة مع تكبير (Zoom) — نقر للتكبير، سحب للتنقّل بين الصور.
export default function Lightbox({ images, index = 0, onClose }) {
  const { i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(false);
  useScrollLock(true);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((p) => (p + 1) % images.length);
      if (e.key === 'ArrowLeft') setI((p) => (p - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  const go = (d) => { setZoom(false); setI((p) => (p + d + images.length) % images.length); };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* شريط علوي */}
      <div className="flex items-center justify-between p-4 text-white/90" onClick={(e) => e.stopPropagation()}>
        <span dir="ltr" className="text-sm">{i + 1} / {images.length}</span>
        <CloseButton onClick={onClose} variant="ghost" size="h-10 w-10" />
      </div>

      {/* الصورة */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence mode="wait">
          <motion.img
            key={i}
            src={images[i]}
            alt=""
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: zoom ? 2 : 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={() => setZoom((z) => !z)}
            className={`max-h-full max-w-full select-none object-contain ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            draggable={false}
            style={{ touchAction: 'pinch-zoom' }}
          />
        </AnimatePresence>

        {/* أسهم التنقّل */}
        {images.length > 1 && !zoom && (
          <>
            <button onClick={() => go(rtl ? 1 : -1)} aria-label="prev" className="absolute start-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white text-2xl transition hover:bg-white/20">‹</button>
            <button onClick={() => go(rtl ? -1 : 1)} aria-label="next" className="absolute end-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white text-2xl transition hover:bg-white/20">›</button>
          </>
        )}
      </div>

      {/* مصغّرات */}
      {images.length > 1 && (
        <div className="flex justify-center gap-2 p-4" onClick={(e) => e.stopPropagation()}>
          {images.map((g, idx) => (
            <button
              key={idx}
              onClick={() => { setZoom(false); setI(idx); }}
              className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition ${idx === i ? 'border-white' : 'border-transparent opacity-50'}`}
            >
              <img src={g} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </motion.div>,
    document.body
  );
}

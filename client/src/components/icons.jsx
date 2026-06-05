// مجموعة أيقونات أنيقة (ذهبية على خلفية داكنة). currentColor يتحكم باللون.

const G = { fill: 'currentColor' }; // ظلّ ممتلئ للملابس

// ===== أيقونات فئات الملابس (ظلال ممتلئة) =====
export function DressIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path {...G} d="M26 8 Q32 13 38 8 L46 16 L39.5 22 L42 31 L50 56 L14 56 L22 31 L24.5 22 L18 16 Z" />
    </svg>
  );
}

export function ShirtIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path {...G} d="M24 9 L28 9 Q32 15 36 9 L40 9 L49 19 L42 25 L42 55 L22 55 L22 25 L15 19 Z" />
    </svg>
  );
}

export function KidsIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path {...G} d="M25 14 Q32 19 39 14 L47 21 L41.5 26 L41.5 46 L22.5 46 L22.5 26 L17 21 Z" />
    </svg>
  );
}

export function BagIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M25 27 V22 A7 7 0 0 1 39 22 V27" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path {...G} d="M18 26 H46 L43 55 H21 Z" />
    </svg>
  );
}

export const CATEGORY_ICON = { women: DressIcon, men: ShirtIcon, kids: KidsIcon, accessories: BagIcon };

// ===== أيقونات واجهة (خطّية رفيعة) =====
const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function ShieldIcon({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...L} d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z" />
      <path {...L} d="M9 12 l2 2 4 -4" />
    </svg>
  );
}

export function DiamondIcon({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...L} d="M6 3 H18 L22 9 L12 21 L2 9 Z" />
      <path {...L} d="M2 9 H22 M9 3 L7 9 L12 21 M15 3 L17 9 L12 21" />
    </svg>
  );
}

export function BoltIcon({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...L} d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z" />
    </svg>
  );
}

export function CartIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...L} d="M3 4 H5 L7 16 H19 L21 7 H6" />
      <circle {...L} cx="9" cy="20" r="1.3" />
      <circle {...L} cx="18" cy="20" r="1.3" />
    </svg>
  );
}

export function HeartIcon({ className = 'h-5 w-5', filled = false }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 21 C12 21 4 15 4 8.5 A4.5 4.5 0 0 1 12 6 A4.5 4.5 0 0 1 20 8.5 C20 15 12 21 12 21 Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle {...L} cx="11" cy="11" r="7" />
      <path {...L} d="M21 21 L16.5 16.5" />
    </svg>
  );
}

export function WhatsAppIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648 3.973-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}

// مجموعة أيقونات أنيقة (ذهبية على خلفية داكنة). currentColor يتحكم باللون.

const G = { fill: 'currentColor' }; // ظلّ ممتلئ للملابس
const GE = { fill: 'currentColor', fillRule: 'evenodd', clipRule: 'evenodd' }; // مع فراغات داخلية

// ===== أيقونات فئات الملابس (تفصيلية أنيقة) =====

// فستان: أكمام منفوخة + خصر مشدود + تنورة واسعة + شريط تطريز وسطي
export function DressIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        {...GE}
        d="M26 11 L21 12.5 L17.5 19.5 L22.5 22 L25 17.8 L24 29 L17 57 L47 57 L40 29 L39 17.8 L41.5 22 L46.5 19.5 L43 12.5 L38 11 L34.2 15.2 L32 12.6 L29.8 15.2 Z
           M31 24 L33 24 L33 53 L31 53 Z"
      />
    </svg>
  );
}

// عباية: غطاء رأس (حجاب) + رداء مفتوح بأكمام جرسية + زخرفة وسطية
export function AbayaIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* الحجاب */}
      <path {...G} d="M32 5.5 C26 5.5 21.8 9.4 21.8 14.8 L21.8 18.5 L42.2 18.5 L42.2 14.8 C42.2 9.4 38 5.5 32 5.5 Z" />
      {/* الرداء + الأكمام + الفتحة الأمامية + الزخرفة */}
      <path
        {...GE}
        d="M26 18.5 L16.5 24.5 L11 51 L20.5 51 L25 31 L22.5 56 L41.5 56 L39 31 L43.5 51 L53 51 L47.5 24.5 L38 18.5 Z
           M31 21 L32 42 L33 21 Z
           M32 25.5 L33.8 28.2 L32 30.9 L30.2 28.2 Z"
      />
    </svg>
  );
}

// طقم قطعتين: جاكيت بياقة وأزرار + تنورة واسعة بشكل A
export function SetIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* الجاكيت */}
      <path
        {...GE}
        d="M25 10 C24 10 23.2 10.6 23 11.6 L16.8 16.2 L19.5 22 L22.5 20.3 L22.5 31.5 L41.5 31.5 L41.5 20.3 L44.5 22 L47.2 16.2 L41 11.6 C40.8 10.6 40 10 39 10 L34 10 L32 13.8 L30 10 Z
           M32 17.6 a1.25 1.25 0 1 0 0.01 0
           M32 22.8 a1.25 1.25 0 1 0 0.01 0"
      />
      {/* التنورة */}
      <path {...G} d="M24 34.5 L40 34.5 L49 57 L15 57 Z" />
    </svg>
  );
}

// حجاب: رأس محجّب بأكتاف (شكل نصفي) + فتحة وجه صغيرة
export function HijabIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        {...GE}
        d="M32 6 C24 6 18 12 18 21 C18 25 19.5 28.5 22 31 L15.5 39 C12.5 42 11.5 47 11.5 52 L52.5 52 C52.5 47 51.5 42 48.5 39 L42 31 C44.5 28.5 46 25 46 21 C46 12 40 6 32 6 Z
           M32 11.5 C27.8 11.5 24.5 14.7 24.5 19.5 C24.5 24 27.8 27.2 32 27.2 C36.2 27.2 39.5 24 39.5 19.5 C39.5 14.7 36.2 11.5 32 11.5 Z"
      />
    </svg>
  );
}

// ترنش كوت: معطف بياقة عريضة، حزام عند الخصر، وصفّ أزرار وسطي
export function TrenchIcon({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        {...GE}
        d="M25 9 C24 9 23.2 9.6 23 10.6 L15.5 16 L19 23 L22 21 L22 55 L42 55 L42 21 L45 23 L48.5 16 L41 10.6 C40.8 9.6 40 9 39 9 L34.5 9 L34.5 30 L29.5 30 L29.5 9 Z
           M31.4 33 a0.95 0.95 0 1 0 0.01 0
           M31.4 39 a0.95 0.95 0 1 0 0.01 0
           M31.4 45 a0.95 0.95 0 1 0 0.01 0"
      />
      {/* الحزام */}
      <path {...G} d="M22 30.5 L42 30.5 L42 34 L22 34 Z" />
      <path {...G} d="M40 30 L46 28.5 L46.6 31 L40.6 33 Z" />
    </svg>
  );
}

export const CATEGORY_ICON = { abaya: AbayaIcon, set: SetIcon, dress: DressIcon, hijab: HijabIcon, trench: TrenchIcon };

// ===== أيقونات واجهة (خطّية رفيعة) =====
const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };

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
        strokeWidth="1.75"
        strokeLinecap="round"
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

export function MenuIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...L} d="M4 7 H20 M4 12 H20 M4 17 H20" />
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

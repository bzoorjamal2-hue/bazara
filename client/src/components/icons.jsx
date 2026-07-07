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

// ===== أيقونات واجهة عامة (خطّية أنيقة، currentColor) =====
const svg = (className, children, extra) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...extra}>{children}</svg>
);

export function XIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M6 6 L18 18 M18 6 L6 18" />); }
// أسهم "متابعة/رجوع" تنقلب تلقائياً مع اللغة (كلاس rtl-flip بـ index.css) — بديل موحّد للأسهم النصية ← →
export function ForwardIcon({ className = 'h-4 w-4' }) { return svg(`${className} rtl-flip`, <path {...L} d="M9 6 L15 12 L9 18" />); }
export function BackIcon({ className = 'h-4 w-4' }) { return svg(`${className} rtl-flip`, <path {...L} d="M15 6 L9 12 L15 18" />); }
export function CheckIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M5 13 L10 18 L19 6" />); }
export function GiftIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 11 H20 V20 H4 Z M12 8 V20 M4 8 H20 V11 H4 Z" /><path {...L} d="M12 8 C12 8 10.5 4 8.5 5 C6.5 6 8 8 12 8 C12 8 13.5 4 15.5 5 C17.5 6 16 8 12 8 Z" /></>); }
export function BagIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M6 8 H18 L19 20 H5 Z" /><path {...L} d="M9 10 V7 A3 3 0 0 1 15 7 V10" /></>); }
export function PinIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z" /><circle {...L} cx="12" cy="9.5" r="2.4" /></>); }
export function TicketIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M4 8 A2 2 0 0 0 4 8 H20 V11 A1.5 1.5 0 0 0 20 14 V16 H4 V14 A1.5 1.5 0 0 0 4 11 Z" />); }
export function ReceiptIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M6 3 H18 V21 L15 19 L12 21 L9 19 L6 21 Z" /><path {...L} d="M9 8 H15 M9 12 H15" /></>); }
export function TruckIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M2 7 H14 V16 H2 Z M14 10 H18 L21 13 V16 H14 Z" /><circle {...L} cx="7" cy="18" r="1.6" /><circle {...L} cx="17" cy="18" r="1.6" /></>); }
export function CashIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="3" y="6" width="18" height="12" rx="2" /><circle {...L} cx="12" cy="12" r="2.6" /></>); }
export function PhoneIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M6 3 H9 L10.5 8 L8.5 9.5 C9.5 11.8 12.2 14.5 14.5 15.5 L16 13.5 L21 15 V18 C21 19.5 19.5 21 18 21 C10 20.5 3.5 14 3 6 C3 4.5 4.5 3 6 3 Z" />); }
export function InstagramIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="3.5" y="3.5" width="17" height="17" rx="5" /><circle {...L} cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" /></>); }
export function FacebookIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6v1.9H16l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}
export function PackageIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M12 3 L20 7 V17 L12 21 L4 17 V7 Z" /><path {...L} d="M4 7 L12 11 L20 7 M12 11 V21" /></>); }
export function StoreIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 9 L5 4 H19 L20 9 A3 3 0 0 1 14.5 9 A3 3 0 0 1 9.5 9 A3 3 0 0 1 4 9 Z" /><path {...L} d="M5 9 V20 H19 V9 M10 20 V14 H14 V20" /></>); }
export function BellIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M6 16 V10 A6 6 0 0 1 18 10 V16 L20 18 H4 Z" /><path {...L} d="M10 18 A2 2 0 0 0 14 18" /></>); }
export function SparkleIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M12 3 C12.5 8 14 9.5 19 10 C14 10.5 12.5 12 12 17 C11.5 12 10 10.5 5 10 C10 9.5 11.5 8 12 3 Z" />); }
export function FireIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M12 21 C8 21 5.5 18.5 5.5 15 C5.5 11 9 9 9 5 C12 7 13 9 13 11 C14.5 10 15 8.5 15 7 C17 9 18.5 12 18.5 15 C18.5 18.5 16 21 12 21 Z" />); }
export function VideoIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="3" y="6" width="13" height="12" rx="2" /><path {...L} d="M16 10 L21 7 V17 L16 14 Z" /></>); }
export function SpeakerIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 9 H7 L12 5 V19 L7 15 H4 Z" /><path {...L} d="M16 9 A4 4 0 0 1 16 15" /></>); }
export function UserIcon({ className = 'h-5 w-5' }) { return svg(className, <><circle {...L} cx="12" cy="8" r="4" /><path {...L} d="M5 20 A7 7 0 0 1 19 20" /></>); }
export function UsersIcon({ className = 'h-5 w-5' }) { return svg(className, <><circle {...L} cx="9" cy="8" r="3.2" /><path {...L} d="M3.5 19 A6 6 0 0 1 14.5 19" /><path {...L} d="M16 6 A3 3 0 0 1 16 12 M17 19 A6 6 0 0 0 20.5 16" /></>); }
export function HomeIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M4 11 L12 4 L20 11 M6 9.5 V20 H18 V9.5" />); }
export function ChartIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 4 V20 H20" /><path {...L} d="M8 16 V12 M12 16 V8 M16 16 V10" /></>); }
export function GearIcon({ className = 'h-5 w-5' }) { return svg(className, <><circle {...L} cx="12" cy="12" r="3" /><path {...L} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>); }
export function ImageIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="3" y="5" width="18" height="14" rx="2" /><circle {...L} cx="8.5" cy="10" r="1.6" /><path {...L} d="M5 17 L10 12 L14 16 L17 13 L21 17" /></>); }
export function TrashIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M5 7 H19 M9 7 V5 H15 V7 M7 7 L8 20 H16 L17 7 M10 10 V17 M14 10 V17" />); }
export function PlusIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M12 5 V19 M5 12 H19" />); }
export function MailIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="3" y="5" width="18" height="14" rx="2" /><path {...L} d="M3.5 7 L12 13 L20.5 7" /></>); }
export function SaveIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M5 4 H16 L20 8 V20 H5 Z" /><path {...L} d="M8 4 V9 H15 V4 M8 20 V14 H16 V20" /></>); }
export function KeyIcon({ className = 'h-5 w-5' }) { return svg(className, <><circle {...L} cx="8" cy="8" r="4" /><path {...L} d="M11 11 L20 20 M17 17 L19 15 M15 15 L17 13" /></>); }
export function CrownIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M4 18 H20 M4 18 L5 8 L9 12 L12 6 L15 12 L19 8 L20 18" />); }
export function LinkIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M9 15 L15 9 M8 12 L6 14 A3 3 0 0 0 10 18 L12 16 M16 12 L18 10 A3 3 0 0 0 14 6 L12 8" />); }
export function CopyIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="9" y="9" width="11" height="11" rx="2" /><path {...L} d="M5 15 H4 A1 1 0 0 1 3 14 V4 A1 1 0 0 1 4 3 H14 A1 1 0 0 1 15 4 V5" /></>); }
export function EditIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M4 20 H8 L18 10 L14 6 L4 16 Z M13 7 L17 11" />); }
export function CardIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="3" y="5" width="18" height="14" rx="2" /><path {...L} d="M3 9 H21 M6 15 H10" /></>); }
export function RulerIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M4 8 L16 20 L20 16 L8 4 Z M8 8 L10 10 M11 7 L13 9 M14 10 L16 12" />); }
export function PaletteIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M12 3 A9 9 0 1 0 12 21 C13.5 21 13 19 14 18.5 C15 18 18 19 19.5 16 A9 9 0 0 0 12 3 Z" /><circle cx="8" cy="11" r="1.1" fill="currentColor" /><circle cx="12" cy="8" r="1.1" fill="currentColor" /><circle cx="16" cy="11" r="1.1" fill="currentColor" /></>); }
export function StarIcon({ className = 'h-5 w-5', filled = true }) { return svg(className, <path d="M12 3 L14.6 9 L21 9.6 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.6 L9.4 9 Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />); }
export function MegaphoneIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 10 V14 H7 L16 19 V5 L7 10 Z" /><path {...L} d="M18 9 A4 4 0 0 1 18 15" /></>); }
export function FolderIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M3 6 H9 L11 9 H21 V19 H3 Z" />); }
export function NoteIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M6 3 H15 L19 7 V21 H6 Z" /><path {...L} d="M9 9 H15 M9 13 H15 M9 17 H13" /></>); }
export function TrophyIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z" /><path {...L} d="M7 5 H4 V7 A3 3 0 0 0 7 10 M17 5 H20 V7 A3 3 0 0 1 17 10 M10 14 H14 L13 18 H11 Z M9 20 H15" /></>); }
export function ClockIcon({ className = 'h-5 w-5' }) { return svg(className, <><circle {...L} cx="12" cy="12" r="8" /><path {...L} d="M12 8 V12 L15 14" /></>); }
export function HourglassIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M6 4 H18 M6 20 H18 M7 4 C7 9 17 9 17 4 M7 20 C7 15 17 15 17 20" />); }
export function WarnIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M12 4 L21 19 H3 Z" /><path {...L} d="M12 10 V14 M12 16.5 V16.6" /></>); }
export function ArrowUpIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M12 5 V19 M6 11 L12 5 L18 11" />); }
export function ArrowDownIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M12 5 V19 M6 13 L12 19 L18 13" />); }
export function PhoneShareIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="6" y="3" width="12" height="18" rx="2" /><path {...L} d="M10 18 H14" /></>); }
export function HandIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M9 11 V5.5 A1.5 1.5 0 0 1 12 5.5 V10 M12 9 A1.5 1.5 0 0 1 15 9 V11 M15 10 A1.5 1.5 0 0 1 18 10 V15 A6 6 0 0 1 6 15 V12 A1.5 1.5 0 0 1 9 12" />); }
export function PartyIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 20 L9 8 L16 15 Z" /><path {...L} d="M14 4 V6 M18 8 H16 M19 12 L17.5 11 M15 5.5 L14 7" /></>); }
export function ShareIcon({ className = 'h-5 w-5' }) { return svg(className, <><circle {...L} cx="6" cy="12" r="2.4" /><circle {...L} cx="18" cy="6" r="2.4" /><circle {...L} cx="18" cy="18" r="2.4" /><path {...L} d="M8 11 L16 7 M8 13 L16 17" /></>); }
export function UploadIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M12 16 V5 M7 10 L12 5 L17 10 M5 19 H19" />); }
export function DownloadIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M12 4 V15 M7 10 L12 15 L17 10 M5 19 H19" />); }
export function CameraIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 8 H7 L9 5 H15 L17 8 H20 V19 H4 Z" /><circle {...L} cx="12" cy="13" r="3.4" /></>); }
export function LockOpenIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="5" y="11" width="14" height="9" rx="2" /><path {...L} d="M8 11 V8 A4 4 0 0 1 15.5 6.5" /></>); }
export function GridIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z" />); }
export function InstallIcon({ className = 'h-5 w-5' }) { return svg(className, <><rect {...L} x="6" y="3" width="12" height="18" rx="2" /><path {...L} d="M12 8 V14 M9.5 11.5 L12 14 L14.5 11.5" /></>); }
export function TagIcon({ className = 'h-5 w-5' }) { return svg(className, <><path {...L} d="M4 4 H11 L20 13 L13 20 L4 11 Z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" /></>); }
export function WaveIcon({ className = 'h-5 w-5' }) { return svg(className, <path {...L} d="M7 13 V6.5 A1.4 1.4 0 0 1 9.8 6.5 V11 M9.8 5.5 A1.4 1.4 0 0 1 12.6 5.5 V11 M12.6 6.5 A1.4 1.4 0 0 1 15.4 6.5 V12 M15.4 9 A1.4 1.4 0 0 1 18 9 V14 A6 6 0 0 1 6.5 16.5 L4.5 13 A1.5 1.5 0 0 1 7 11.5" />); }

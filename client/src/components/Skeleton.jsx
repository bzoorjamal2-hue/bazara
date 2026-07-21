// هياكل تحميل (Skeleton) — تعطي إحساس سرعة واحتراف بدل دائرة التحميل الفارغة.

// بطاقة منتج شبحية تطابق شكل ProductCard
export function ProductCardSkeleton() {
  return (
    <div className="glass overflow-hidden">
      <div className="skeleton aspect-[3/4] w-full !rounded-none" />
      <div className="space-y-2.5 p-3.5">
        <div className="skeleton mx-auto h-4 w-3/4" />
        <div className="skeleton mx-auto h-5 w-1/3" />
        <div className="skeleton mt-3 h-9 w-full !rounded-xl" />
      </div>
    </div>
  );
}

// شبكة بطاقات شبحية
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// عنوان قسم شبحي
function TitleSkeleton() {
  return <div className="skeleton mx-auto mb-5 h-7 w-40" />;
}

// هيكل كامل لصفحة المتجر (هيرو + فئات + شبكة منتجات)
export function StorePageSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* هيرو */}
      <div className="skeleton mb-6 h-[260px] w-full !rounded-3xl sm:h-[340px]" />
      {/* فئات */}
      <TitleSkeleton />
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[3/4] w-full !rounded-3xl" />
        ))}
      </div>
      {/* قسم منتجات */}
      <TitleSkeleton />
      <ProductGridSkeleton count={8} />
    </div>
  );
}

// هيكل صفحة تفاصيل المنتج (معرض + تفاصيل)
export function ProductDetailsSkeleton() {
  return (
    <div className="animate-fade-in grid gap-8 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="skeleton aspect-square w-full !rounded-2xl" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-16 !rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4 pt-2">
        <div className="skeleton h-8 w-3/4" />
        <div className="skeleton h-6 w-1/3" />
        <div className="skeleton h-px w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-2/3" />
        <div className="mt-4 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-12 !rounded-xl" />
          ))}
        </div>
        <div className="skeleton mt-4 h-12 w-full !rounded-2xl" />
      </div>
    </div>
  );
}

export default ProductGridSkeleton;

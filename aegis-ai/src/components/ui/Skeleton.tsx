import { cn } from "@/lib/utils";

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("skeleton rounded-2xl", className)} />
);

export const KpiSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="glass rounded-3xl p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-5 h-9 w-28" />
        <Skeleton className="mt-4 h-2 w-full" />
      </div>
    ))}
  </div>
);

export const TimelineSkeleton = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="glass flex items-center gap-4 rounded-3xl p-4">
        <Skeleton className="size-12 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
    ))}
  </div>
);

import { cn } from "@/lib/utils";

type BoneyardSkeletonProps = {
  className?: string;
};

export function BoneyardSkeleton({ className }: BoneyardSkeletonProps) {
  return <div className={cn("boneyard-shimmer rounded-xl", className)} />;
}

export function BoneyardCard({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("dashboard-panel-soft rounded-[26px] p-5", className)}>
      <div className="flex items-center gap-3">
        <BoneyardSkeleton className="h-11 w-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <BoneyardSkeleton className="h-3.5 w-20 rounded-full" />
          <BoneyardSkeleton className="h-4.5 w-32 rounded-full" />
        </div>
      </div>
      <BoneyardSkeleton className="mt-5 h-8 w-3/5 rounded-full" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <BoneyardSkeleton
            key={index}
            className={cn("h-3.5 rounded-full", index === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

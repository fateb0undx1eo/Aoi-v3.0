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
    <div className={cn("rounded-2xl border border-border/70 bg-card/70 p-4", className)}>
      <BoneyardSkeleton className="h-4 w-24" />
      <BoneyardSkeleton className="mt-4 h-10 w-3/5" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <BoneyardSkeleton
            key={index}
            className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

export function BrandMark({ large }: { large?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-full bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)),hsl(var(--primary)/0.85)_55%,hsl(var(--primary)/0.35)_100%)] shadow-[0_0_80px_-18px_hsl(var(--primary)/0.55)]",
        large ? "h-40 w-40" : "h-8 w-8"
      )}
    >
      <span className={cn("absolute rounded-full bg-white", large ? "left-8 top-8 h-6 w-6" : "left-1.5 top-1.5 h-1.5 w-1.5")} />
      <span className={cn("absolute rounded-full bg-white", large ? "bottom-8 left-8 h-6 w-6" : "bottom-1.5 left-1.5 h-1.5 w-1.5")} />
      <span className={cn("absolute rounded-full bg-white", large ? "bottom-8 right-8 h-6 w-6" : "bottom-1.5 right-1.5 h-1.5 w-1.5")} />
      <span
        className={cn(
          "absolute rounded-full border-2 border-white/90",
          large ? "left-8 top-8 h-24 w-24" : "left-1.5 top-1.5 h-5 w-5"
        )}
      />
    </div>
  );
}

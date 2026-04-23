import { cn } from "@/lib/utils";

export function BrandMark({ large }: { large?: boolean }) {
  return (
    <div
      className={cn(
        "aoi-brand-shell relative isolate rounded-[34%]",
        large ? "h-40 w-40" : "h-8 w-8"
      )}
    >
      <span className="aoi-brand-glow" />
      <span className="aoi-brand-ring aoi-brand-ring-outer" />
      <span className="aoi-brand-ring aoi-brand-ring-inner" />
      <span className="aoi-brand-core">
        <span className="aoi-brand-core-mark" />
      </span>
      <span className="aoi-brand-node aoi-brand-node-top" />
      <span className="aoi-brand-node aoi-brand-node-left" />
      <span className="aoi-brand-node aoi-brand-node-right" />
      <span className="aoi-brand-slice aoi-brand-slice-left" />
      <span className="aoi-brand-slice aoi-brand-slice-right" />
    </div>
  );
}

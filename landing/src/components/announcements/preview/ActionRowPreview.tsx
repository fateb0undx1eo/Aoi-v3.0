import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { BUTTON_STYLES } from "../constants";
import type { APIComponentInActionRow, APIButtonComponent, APIStringSelectComponent } from "../types";

export function PreviewButton({ data, onClick }: { data: APIButtonComponent; onClick?: () => void }) {
  const s = BUTTON_STYLES[data.style] ?? BUTTON_STYLES[1]!;
  const isLink = data.style === 5;
  const label = data.style === 6 ? `SKU ${data.sku_id}` : (data.label || (isLink ? "Link" : "Button"));

  const inner = (
    <button
      type="button"
      disabled={data.disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      {data.emoji?.id ? (
        <img src={`https://cdn.discordapp.com/emojis/${data.emoji.id}.${data.emoji.animated ? "gif" : "png"}?size=32`} alt="" className="h-5 w-5 object-contain" />
      ) : data.emoji?.name ? <span>{data.emoji.name}</span> : null}
      {label}
      {isLink && <ExternalLink className="h-3 w-3" />}
    </button>
  );

  if (isLink && data.url) {
    return <a href={data.url} target="_blank" rel="noreferrer noopener" className="contents">{inner}</a>;
  }
  return inner;
}

export function PreviewSelect({ data, onClick }: { data: APIStringSelectComponent; onClick?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={data.disabled}
        onClick={() => { setOpen(!open); onClick?.(); }}
        className="inline-flex max-w-[400px] cursor-pointer items-center gap-2 rounded-lg bg-zinc-700 p-2 text-sm font-medium text-zinc-400 transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate leading-none">{data.placeholder || "Select an option"}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && data.options.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[--anchor-width] min-w-[200px] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
          {data.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-700">
              {opt.emoji?.id ? (
                <img src={`https://cdn.discordapp.com/emojis/${opt.emoji.id}.${opt.emoji.animated ? "gif" : "png"}?size=32`} alt="" className="h-[22px] w-[22px] shrink-0 object-contain" />
              ) : opt.emoji?.name ? <span className="text-base">{opt.emoji.name}</span> : null}
              <div className="min-w-0 truncate">
                <p className="truncate font-medium leading-tight text-zinc-200">{opt.label}</p>
                {opt.description && <p className="truncate text-[11px] text-zinc-400">{opt.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreviewActionRow({
  components,
  onEditComponent,
}: {
  components: APIComponentInActionRow[];
  onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {components.map((comp, ci) => (
        <div key={ci} className="contents">
          {comp.type === 2 ? (
            <PreviewButton data={comp} onClick={() => onEditComponent?.(comp, undefined, ci)} />
          ) : comp.type === 3 ? (
            <PreviewSelect data={comp} onClick={() => onEditComponent?.(comp, undefined, ci)} />
          ) : comp.type >= 5 && comp.type <= 8 ? (
            <button
              type="button"
              onClick={() => onEditComponent?.(comp, undefined, ci)}
              className="inline-flex max-w-[400px] cursor-pointer items-center gap-2 rounded-lg bg-zinc-700 p-2 text-sm font-medium text-zinc-400 hover:brightness-110"
            >
              <span className="truncate leading-none">{comp.placeholder || "Select..."}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

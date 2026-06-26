import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { APIComponentInActionRow, APIButtonComponent, APIStringSelectComponent } from "../types";

const BUTTON_COLORS: Record<number, { bg: string; hover: string; active: string; text: string }> = {
  1: { bg: "#5865F2", hover: "#4752C4", active: "#3C45A5", text: "#fff" },
  2: { bg: "#4E5058", hover: "#6D6F78", active: "#5B5D65", text: "#fff" },
  3: { bg: "#248046", hover: "#1E6B3A", active: "#195C31", text: "#fff" },
  4: { bg: "#DA373C", hover: "#A1282B", active: "#8B1E21", text: "#fff" },
  5: { bg: "transparent", hover: "transparent", active: "transparent", text: "#00A8FC" },
  6: { bg: "#9B59B6", hover: "#824EA0", active: "#6F4290", text: "#fff" },
};

export function PreviewButton({ data, onClick }: { data: APIButtonComponent; onClick?: () => void }) {
  const isLink = data.style === 5;
  const isPremium = data.style === 6;
  const colors = BUTTON_COLORS[data.style] ?? BUTTON_COLORS[1]!;
  const label = isPremium ? `SKU ${data.sku_id}` : (data.label || (isLink ? "Link" : "Button"));

  const inner = (
    <button
      type="button"
      disabled={data.disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium leading-4 transition-colors hover:brightness-110 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        color: colors.text,
        backgroundColor: colors.bg,
        border: isLink ? "1px solid #00A8FC" : "1px solid rgba(255,255,255,0.08)",
      }}
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
        className="inline-flex max-w-[400px] cursor-pointer items-center gap-2 rounded-lg bg-[#ebebeb] p-2 text-sm font-medium text-[#5C5E66] transition-colors hover:border-[#c4c9ce] dark:bg-[#1e1f22] dark:text-[#949BA4] dark:hover:border-[#020202] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        <span className="truncate leading-none">{data.placeholder || "Select an option"}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && data.options.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[--anchor-width] min-w-[200px] overflow-y-auto rounded-lg border border-[#e3e5e8] bg-white shadow-xl dark:border-[#1e1f22] dark:bg-[#3C3D44]">
          {data.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F2F2F3] dark:hover:bg-[#43444B]">
              {opt.emoji?.id ? (
                <img src={`https://cdn.discordapp.com/emojis/${opt.emoji.id}.${opt.emoji.animated ? "gif" : "png"}?size=32`} alt="" className="h-[22px] w-[22px] shrink-0 object-contain" />
              ) : opt.emoji?.name ? <span className="text-base">{opt.emoji.name}</span> : null}
              <div className="min-w-0 truncate">
                <p className="truncate font-medium leading-tight dark:text-[#f2f3f5]">{opt.label}</p>
                {opt.description && <p className="truncate text-[11px] text-[#4e5058] dark:text-[#b5bac1]">{opt.description}</p>}
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
              className="inline-flex max-w-[400px] cursor-pointer items-center gap-2 rounded-lg bg-[#ebebeb] p-2 text-sm font-medium text-[#5C5E66] dark:bg-[#1e1f22] dark:text-[#949BA4]"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
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

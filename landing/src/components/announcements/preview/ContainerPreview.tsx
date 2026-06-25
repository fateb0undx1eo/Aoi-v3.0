import { ExternalLink, FileText } from "lucide-react";
import { BUTTON_STYLES, TEXT_COLOR } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APIV2TextDisplay, APIV2Thumbnail } from "../types";
import { decimalToHex } from "../utils/color";
import { Markdown } from "../utils/markdown";
import Gallery from "./Gallery";

export default function ContainerPreview({ container, hasTopMargin, onEditComponent }: { container: APIContainerComponent; hasTopMargin: boolean; onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void }) {
  return (
    <div className={`${hasTopMargin ? "mt-2" : ""} ${container.spoiler ? "cursor-pointer blur-sm transition-all hover:blur-none" : ""}`}>
      <div
        className="relative flex flex-col gap-1.5 overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4"
        style={{
          maxWidth: 520,
          ...(container.accent_color != null ? { "--accent-color": decimalToHex(container.accent_color) } as React.CSSProperties : {}),
        }}
      >
        {container.accent_color != null && (
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: decimalToHex(container.accent_color) }} />
        )}
        <div className="pl-0.5 space-y-1.5">
          {container.components.map((item, ci) => {
            if (item.type === 10) {
              return <div key={ci} className="whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: TEXT_COLOR }}><Markdown content={item.content} /></div>;
            }
            if (item.type === 11) {
              const url = item.items?.[0]?.media?.url;
              return url ? <img key={ci} src={url} alt="" className="max-h-80 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null;
            }
            if (item.type === 12) {
              const images = item.items?.filter((i) => i.media?.url) || [];
              return images.length > 0 ? <Gallery key={ci} attachments={images.map((i) => ({ id: String(ci), filename: "media", content_type: "image/png", url: i.media.url, proxy_url: "#", size: 0 }))} /> : null;
            }
            if (item.type === 13) {
              const url = item.items?.[0]?.media?.url;
              if (!url) return null;
              const filename = url.split("/").pop() || "file";
              return (
                <div key={ci} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-black/40 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-cyan-400" />
                  <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs text-cyan-400 hover:underline">{filename}</a>
                </div>
              );
            }
            if (item.type === 14) {
              return <div key={ci} className="h-px w-full bg-zinc-700" />;
            }
            if (item.type === 9) {
              const textChild = item.components?.find((c): c is APIV2TextDisplay => c.type === 10);
              const thumbChild = item.components?.find((c): c is APIV2Thumbnail => c.type === 11);
              const accessory = item.accessory;
              return (
                <div key={ci} className="flex items-start gap-3 rounded-lg bg-black/30 px-3 py-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    {textChild && <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: TEXT_COLOR }}><Markdown content={textChild.content} /></div>}
                    {thumbChild && (() => {
                      const url = thumbChild.items?.[0]?.media?.url;
                      return url ? <img src={url} alt="" className="mt-1 max-h-40 w-full rounded-lg object-cover" /> : null;
                    })()}
                  </div>
                  {accessory?.type === 2 && (() => {
                    const btn = accessory as APIButtonComponent;
                    const s = BUTTON_STYLES[btn.style] ?? BUTTON_STYLES[1]!;
                    if (btn.style === 5) {
                      return (
                        <a key="acc" href={btn.url || "#"} target="_blank" rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors hover:brightness-110"
                          style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                          {btn.label || "Link"}<ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      );
                    }
                    return (
                      <button key="acc" type="button" disabled={btn.disabled}
                        onClick={() => onEditComponent?.(btn)}
                        className="inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors hover:brightness-110 disabled:opacity-50"
                        style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                        {btn.label || "Button"}
                      </button>
                    );
                  })()}
                  {accessory?.type === 11 && (() => {
                    const url = (accessory as APIV2Thumbnail).items?.[0]?.media?.url;
                    return url ? <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : null;
                  })()}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

import { ExternalLink, FileText } from "lucide-react";
import { BUTTON_STYLES, TEXT_COLOR } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APIV2TextDisplay, APIV2Thumbnail } from "../types";
import { intToHex } from "../utils/color";
import { renderDiscordText } from "../utils/markdown";

export default function ContainerPreview({ container, hasTopMargin, onEditComponent }: { container: APIContainerComponent; hasTopMargin: boolean; onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void }) {
  const accentColor = container.accent_color != null ? intToHex(container.accent_color) : null;
  return (
    <div className={`${hasTopMargin ? "mt-2" : ""} rounded-lg border border-zinc-700/50 bg-[#2b2d31] ${container.spoiler ? "blur-sm hover:blur-none transition-all cursor-pointer" : ""}`}>
      <div className="flex">
        {accentColor && (
          <div className="w-1 shrink-0 rounded-l-lg" style={{ backgroundColor: accentColor }} />
        )}
        <div className="min-w-0 flex-1 space-y-1.5 px-3 py-2">
          {container.components.map((item, ci) => {
            if (item.type === 10) {
              return <div key={ci} className="whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: TEXT_COLOR }}>{item.content}</div>;
            }
            if (item.type === 11) {
              const url = item.items?.[0]?.media?.url;
              return url ? <img key={ci} src={url} alt="" className="max-h-80 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null;
            }
            if (item.type === 12) {
              const images = item.items?.filter((i) => i.media?.url) || [];
              if (images.length === 0) return null;
              const cols = images.length === 1 ? 1 : images.length === 2 ? 2 : 2;
              return (
                <div key={ci} className={`grid gap-1 ${cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {images.map((img, ii) => (
                    <img key={ii} src={img.media.url} alt="" className="w-full rounded-lg object-cover max-h-60" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ))}
                </div>
              );
            }
            if (item.type === 13) {
              const url = item.items?.[0]?.media?.url;
              if (!url) return null;
              const filename = url.split("/").pop() || "file";
              return (
                <div key={ci} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-black/40 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                  <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs hover:underline" style={{ color: "#00a8fc" }}>{filename}</a>
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
                    {textChild && <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: TEXT_COLOR }}>{textChild.content}</div>}
                    {thumbChild && (() => {
                      const url = thumbChild.items?.[0]?.media?.url;
                      return url ? <img src={url} alt="" className="mt-1 max-h-40 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null;
                    })()}
                  </div>
                  {accessory?.type === 2 && (() => {
                    const btn = accessory as APIButtonComponent;
                    const s = BUTTON_STYLES[btn.style] || BUTTON_STYLES[1];
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
                    return url ? <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : null;
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

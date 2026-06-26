import { ExternalLink, FileText } from "lucide-react";
import { TEXT_COLOR } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APIV2TextDisplay, APIV2Thumbnail, APIV2MediaGallery, APIV2Separator, APIV2File } from "../types";
import { decimalToHex } from "../utils/color";
import { Markdown } from "../utils/markdown";
import { getImageUri } from "../utils/files";
import Gallery from "./Gallery";
import { PreviewButton } from "./ActionRow";

const BUTTON_ACCENT = { bg: "transparent", hover: "transparent", text: "#00A8FC", border: "#00A8FC" };

export default function ContainerPreview({
  container,
  hasTopMargin,
  onEditComponent,
  files,
}: {
  container: APIContainerComponent;
  hasTopMargin: boolean;
  onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void;
  files?: { url?: string; content_type?: string; name: string }[];
}) {
  return (
    <div className={`${hasTopMargin ? "mt-2" : ""} ${container.spoiler ? "cursor-pointer blur-sm transition-all hover:blur-none" : ""}`}>
      <div
        className="relative flex flex-col gap-1.5 overflow-hidden rounded-lg border border-[rgba(227,229,232,0.5)] bg-white p-4 dark:border-[rgba(67,67,73,0.5)] dark:bg-[#2b2d31] dark:text-[#dbdee1]"
        style={{
          maxWidth: 520,
          ...(container.accent_color != null ? { "--accent-color": decimalToHex(container.accent_color) } as React.CSSProperties : {}),
        }}
      >
        {container.accent_color != null && (
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: decimalToHex(container.accent_color) }} />
        )}
        <div className="space-y-1.5">
          {container.components.map((item, ci) => {
            if (item.type === 10) {
              return (
                <div key={ci} className="whitespace-pre-wrap text-sm leading-relaxed dark:text-[#dbdee1]">
                  <Markdown content={item.content} />
                </div>
              );
            }
            if (item.type === 11) {
              const url = item.items?.[0]?.media?.url;
              return url ? (
                <img key={ci} src={url} alt="" className="max-h-80 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : null;
            }
            if (item.type === 12) {
              const images = item.items?.filter((i) => i.media?.url) || [];
              return images.length > 0 ? (
                <Gallery key={ci} attachments={images.map((i) => ({ id: String(ci), filename: "media", content_type: "image/png", url: i.media.url, proxy_url: "#", size: 0 }))} />
              ) : null;
            }
            if (item.type === 13) {
              const url = item.items?.[0]?.media?.url;
              if (!url) return null;
              const filename = url.split("/").pop() || "file";
              return (
                <div key={ci} className="flex items-center gap-2 rounded-lg border border-[rgba(227,229,232,0.5)] bg-[#f2f3f5] px-3 py-2 dark:border-[rgba(67,67,73,0.5)] dark:bg-[#232428]">
                  <FileText className="h-4 w-4 shrink-0 text-[#00A8FC]" />
                  <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs text-[#00A8FC] hover:underline">{filename}</a>
                </div>
              );
            }
            if (item.type === 14) {
              return <hr key={ci} className="border-[rgba(128,132,142,0.24)] dark:border-[rgba(128,132,142,0.48)]" />;
            }
            if (item.type === 9) {
              const textChild = item.components?.find((c): c is APIV2TextDisplay => c.type === 10);
              const thumbChild = item.components?.find((c): c is APIV2Thumbnail => c.type === 11);
              const mediaChild = item.components?.find((c): c is APIV2MediaGallery => c.type === 12);
              const accessory = item.accessory;
              return (
                <div key={ci} className="flex items-start gap-3 rounded-lg bg-black/[0.03] px-3 py-2.5 dark:bg-black/30">
                  <div className="min-w-0 flex-1 space-y-1">
                    {textChild && (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed dark:text-[#dbdee1]">
                        <Markdown content={textChild.content} />
                      </div>
                    )}
                    {thumbChild && (() => {
                      const url = thumbChild.items?.[0]?.media?.url;
                      return url ? <img src={url} alt="" className="mt-1 max-h-40 w-full rounded-lg object-cover" /> : null;
                    })()}
                    {mediaChild && (() => {
                      const images = mediaChild.items?.filter((i) => i.media?.url) || [];
                      return images.length > 0 ? (
                        <Gallery attachments={images.map((i) => ({ id: String(ci), filename: "media", content_type: "image/png", url: i.media.url, proxy_url: "#", size: 0 }))} />
                      ) : null;
                    })()}
                  </div>
                  {accessory?.type === 2 && (() => {
                    const btn = accessory as APIButtonComponent;
                    return (
                      <div className="shrink-0">
                        <PreviewButton data={btn} onClick={() => onEditComponent?.(btn)} />
                      </div>
                    );
                  })()}
                  {accessory?.type === 11 && (() => {
                    const url = (accessory as APIV2Thumbnail).items?.[0]?.media?.url;
                    return url ? <img src={url} alt="" className="h-[85px] w-[85px] shrink-0 rounded-lg object-cover" /> : null;
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

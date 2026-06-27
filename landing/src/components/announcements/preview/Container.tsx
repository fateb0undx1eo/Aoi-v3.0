import { ExternalLink, FileText } from "lucide-react";
import { TEXT_COLOR, C } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APIV2TextDisplay, APIV2Thumbnail, APIV2MediaGallery, APIV2Separator, APIV2File } from "../types";
import { decimalToHex } from "../utils/color";
import { Markdown } from "../utils/markdown";
import { getImageUri } from "../utils/files";
import Gallery from "./Gallery";
import { PreviewButton } from "./ActionRow";

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
  const accentColor = container.accent_color != null ? decimalToHex(container.accent_color) : undefined;

  return (
    <div style={{ marginTop: hasTopMargin ? 8 : 0, ...(container.spoiler ? { cursor: "pointer", filter: "blur(4px)", transition: "all 0.2s", ":hover": { filter: "none" } } as any : {}) }}>
      <div style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
        borderRadius: 4,
        background: C.discEmbed,
        color: "#b5bac1",
        maxWidth: 520,
        padding: "10px 14px",
        ...(accentColor ? { borderLeft: `4px solid ${accentColor}` } : {}),
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {container.components.map((item, ci) => {
            if (item.type === 10) {
              return (
                <div key={ci} style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, color: "#b5bac1" }}>
                  <Markdown content={item.content} />
                </div>
              );
            }
            if (item.type === 11) {
              const url = item.items?.[0]?.media?.url;
              return url ? (
                <img key={ci} src={url} alt="" style={{ maxHeight: 320, width: "100%", borderRadius: 8, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
                <div key={ci} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 4, backgroundColor: "#232428", padding: "6px 12px" }}>
                  <FileText style={{ width: 16, height: 16, flexShrink: 0, color: "#00A8FC" }} />
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "#00A8FC", textDecoration: "none" }}>{filename}</a>
                </div>
              );
            }
            if (item.type === 14) {
              return <hr key={ci} style={{ border: "none", borderTop: "1px solid rgba(128,132,142,0.48)", margin: 0 }} />;
            }
            if (item.type === 9) {
              const textChild = item.components?.find((c): c is APIV2TextDisplay => c.type === 10);
              const thumbChild = item.components?.find((c): c is APIV2Thumbnail => c.type === 11);
              const mediaChild = item.components?.find((c): c is APIV2MediaGallery => c.type === 12);
              const accessory = item.accessory;
              return (
                <div key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 12, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.3)", padding: "10px 12px" }}>
                  <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    {textChild && (
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, color: "#b5bac1" }}>
                        <Markdown content={textChild.content} />
                      </div>
                    )}
                    {thumbChild && (() => {
                      const url = thumbChild.items?.[0]?.media?.url;
                      return url ? <img src={url} alt="" style={{ marginTop: 4, maxHeight: 160, width: "100%", borderRadius: 8, objectFit: "cover" }} /> : null;
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
                      <div style={{ flexShrink: 0 }}>
                        <PreviewButton data={btn} onClick={() => onEditComponent?.(btn)} />
                      </div>
                    );
                  })()}
                  {accessory?.type === 11 && (() => {
                    const url = (accessory as APIV2Thumbnail).items?.[0]?.media?.url;
                    return url ? <img src={url} alt="" style={{ width: 85, height: 85, flexShrink: 0, borderRadius: 8, objectFit: "cover" }} /> : null;
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

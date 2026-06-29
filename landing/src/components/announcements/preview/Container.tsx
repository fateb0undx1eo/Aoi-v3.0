import { useState } from "react";
import { FileText } from "lucide-react";
import { DISCORD, FONT } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APIV2Thumbnail } from "../types";
import { decimalToHex } from "../utils/color";
import { Markdown } from "../utils/markdown";
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

  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  return (
    <div
      onClick={() => { if (container.spoiler) setSpoilerRevealed(true); }}
      style={{
        marginTop: hasTopMargin ? 8 : 0,
        ...(container.spoiler && !spoilerRevealed ? { cursor: "pointer", filter: "blur(4px)", transition: "filter 0.2s" } : {}),
      }}>
      <div style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
        borderRadius: 8,
        background: DISCORD.embedBg,
        color: DISCORD.embedBody,
        maxWidth: 520,
        padding: 16,
        fontFamily: FONT,
        border: `1px solid ${DISCORD.embedBorder}`,
      }}>
        {accentColor && (
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
            background: accentColor, borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
          }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {container.components.map((item, ci) => {
            if (item.type === 10) {
              return (
                <div key={ci} style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, color: DISCORD.embedBody, fontFamily: FONT }}>
                  <Markdown content={item.content} />
                </div>
              );
            }
            if (item.type === 12) {
              const images = item.items?.filter((i) => i.media?.url) || [];
              return images.length > 0 ? (
                <Gallery key={ci} attachments={images.map((i) => ({ id: String(ci), filename: "media", content_type: "image/png", url: i.media.url, proxy_url: "#", size: 0 }))} />
              ) : null;
            }
            if (item.type === 13) {
              const url = item.file?.url;
              if (!url) return null;
              const filename = url.split("/").pop() || "file";
              return (
                <div key={ci} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: DISCORD.embedRadius, backgroundColor: DISCORD.fileCardBg, padding: "6px 12px", fontFamily: FONT }}>
                  <FileText style={{ width: 16, height: 16, flexShrink: 0, color: DISCORD.fileCardIcon }} />
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: DISCORD.textLink, textDecoration: "none", fontFamily: FONT }}>{filename}</a>
                </div>
              );
            }
            if (item.type === 14) {
              return <hr key={ci} style={{ border: "none", borderTop: `1px solid ${DISCORD.embedDivider}`, margin: 0 }} />;
            }
            if (item.type === 9) {
              const textChildren = item.components || [];
              const accessory = item.accessory;
              const hasThumbnail = accessory?.type === 11;
              return (
                <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 4, borderRadius: 8, backgroundColor: DISCORD.sectionBg, padding: "10px 12px", fontFamily: FONT }}>
                  <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
                    <div style={{
                      minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 4,
                      ...(textChildren.length === 1 && !hasThumbnail ? { justifyContent: "center" } : {}),
                    }}>
                      {textChildren.map((tc, tci) => (
                        <div key={tci} style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, color: DISCORD.embedBody, fontFamily: FONT }}>
                          <Markdown content={tc.content} />
                        </div>
                      ))}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "flex-start", minWidth: 0, flexShrink: 0,
                      ...(accessory?.type === 2 ? { maxWidth: "calc(50% - 12px)" } : {}),
                    }}>
                      {accessory?.type === 2 && (() => {
                        const btn = accessory as APIButtonComponent;
                        return <PreviewButton data={btn} onClick={() => onEditComponent?.(btn as any)} />;
                      })()}
                      {hasThumbnail && (() => {
                        const url = (accessory as APIV2Thumbnail).media?.url;
                        return url ? <img src={url} alt="" style={{ width: 85, height: 85, borderRadius: 8, objectFit: "cover" }} /> : null;
                      })()}
                    </div>
                  </div>
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

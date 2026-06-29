import type { ReactNode } from "react";
import type { APIEmbed, APIEmbedField, APIEmbedImage } from "../types";
import { FONT, DISCORD } from "../constants";
import { decimalToHex } from "../utils/color";
import { Markdown, type FeatureConfig } from "../utils/markdown";
import { formatTimestamp } from "../utils/message";
import { resolveAttachmentUri } from "../utils/files";
import Gallery from "./Gallery";

function formatEmbedTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
    return formatTimestamp(iso);
  } catch { return iso; }
}

function EmbedFields({ fields }: { fields: APIEmbedField[] }) {
  const fieldLines: APIEmbedField[][] = [];
  for (const field of fields) {
    const currentLine = fieldLines[fieldLines.length - 1];
    if (!currentLine) { fieldLines.push([field]); continue; }
    const lastField = currentLine[currentLine.length - 1];
    if (field.inline && lastField?.inline && currentLine.length < 3) {
      currentLine.push(field);
    } else {
      fieldLines.push([field]);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: "20px", color: DISCORD.embedBody }}>
      {fieldLines.map((line, li) =>
        <div key={li} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {line.map((f, fi) => {
            const basis = f.inline ? (line.length === 3 ? "30%" : "48%") : "100%";
            return (
              <div key={fi} style={{ flex: `1 1 ${basis}`, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: DISCORD.embedTitle }}>
                  <Markdown content={f.name} features="title" />
                </div>
                <div style={{ marginTop: 2, whiteSpace: "pre-wrap", fontSize: 14, fontWeight: 400, color: DISCORD.embedBody }}>
                  <Markdown content={f.value} features={{ extend: "full", headings: false } as FeatureConfig} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function resolveEmbedUrl(uri: string, files?: { url?: string; content_type?: string; name: string }[]): string {
  if (uri.startsWith("attachment://")) {
    const file = resolveAttachmentUri(uri, files as any);
    if (file?.url) return file.url;
    if (file?.file) return URL.createObjectURL(file.file);
    return "";
  }
  return uri;
}

export default function EmbedPreview({
  embed,
  extraImages,
  files,
}: {
  embed: APIEmbed;
  extraImages?: APIEmbedImage[];
  files?: { url?: string; content_type?: string; name: string }[];
}) {
  const embedColor = embed.color != null ? decimalToHex(embed.color) : DISCORD.accentStrip;

  const showAuthor = !!embed.author?.name;
  const showTitle = !!embed.title;
  const showDesc = !!embed.description;
  const showFields = !!(embed.fields && embed.fields.length > 0);
  const showImage = !!embed.image?.url;
  const showExtraImages = !!(extraImages && extraImages.length > 0);
  const showVideo = !!embed.video?.url;
  const showFooter = !!(embed.footer?.text || embed.timestamp);
  const showProvider = !!embed.provider?.name;

  let hasAbove = false;
  function section(spacing: number, key: string, children: ReactNode) {
    const mt = hasAbove ? spacing : 0;
    hasAbove = true;
    return <div key={key} style={{ marginTop: mt }}>{children}</div>;
  }

  return (
    <div style={{
      borderLeft: `4px solid ${embedColor}`,
      background: DISCORD.embedBg,
      color: DISCORD.embedBody,
      fontSize: 14,
      fontFamily: FONT,
      borderRadius: DISCORD.embedRadius,
      overflow: "hidden",
      maxWidth: 520,
      width: "fit-content",
      minWidth: 0,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    }}>
      <div style={{ padding: "8px 16px 16px 12px", display: "flex", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {showProvider && section(4, "provider", (
            <div style={{ fontSize: 12, fontWeight: 400, color: DISCORD.embedBody }}>
              {embed.provider!.url ? (
                <a href={embed.provider!.url} target="_blank" rel="noreferrer noopener" style={{ color: DISCORD.textLink, textDecoration: "none" }}>{embed.provider!.name}</a>
              ) : (
                embed.provider!.name
              )}
            </div>
          ))}
          {showAuthor && section(2, "author", (
            <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              {embed.author!.icon_url && (() => {
                const url = resolveEmbedUrl(embed.author!.icon_url, files as any);
                    return url ? <img src={url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "contain", marginRight: 8, flexShrink: 0 }} /> : null;
              })()}
              <div style={{ fontSize: 12, fontWeight: 600, color: DISCORD.embedTitle }}>
                {embed.author!.url ? (
                  <a href={embed.author!.url} target="_blank" rel="noreferrer noopener" style={{ color: DISCORD.textLink, textDecoration: "none" }}>{embed.author!.name}</a>
                ) : (
                  embed.author!.name
                )}
              </div>
            </div>
          ))}
          {showTitle && section(2, "title", (
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: "20px", color: DISCORD.embedTitle, wordBreak: "break-word" }}>
              {embed.url ? (
                <a href={embed.url} target="_blank" rel="noreferrer noopener" style={{ color: DISCORD.textLink, textDecoration: "none" }}>
                  <Markdown content={embed.title!} features="title" />
                </a>
              ) : (
                <Markdown content={embed.title!} features="title" />
              )}
            </div>
          ))}
          {showDesc && section(8, "desc", (
            <div style={{ fontSize: 14, fontWeight: 400, lineHeight: "20px", color: DISCORD.embedBody, whiteSpace: "pre-line" }}>
              <Markdown content={embed.description!} />
            </div>
          ))}
          {showFields && section(8, "fields", <EmbedFields fields={embed.fields!} />)}
          {showImage && section(8, "image", (() => {
            const imgUrl = resolveEmbedUrl(embed.image!.url, files as any);
            if (!imgUrl) return null;
            return (
              <img
                src={imgUrl}
                alt=""
                style={{ maxWidth: "100%", maxHeight: 300, width: "auto", height: "auto", display: "block", borderRadius: 4 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            );
          })())}
          {showExtraImages && section(8, "gallery", (
            <Gallery
              attachments={extraImages!.map((img) => ({
                id: "0",
                filename: "image",
                content_type: (img.url ?? "").endsWith(".gif") ? "image/gif" : "image/png",
                url: resolveEmbedUrl(img.url, files as any),
                proxy_url: "#",
                size: 0,
              }))}
            />
          ))}
          {showVideo && section(8, "video", (
            <Gallery
              attachments={[{
                id: "0",
                filename: "video",
                content_type: "video/mp4",
                url: embed.video!.url!,
                proxy_url: "#",
                size: 0,
              }]}
            />
          ))}
          {showFooter && section(8, "footer", (
            <div style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 400, color: DISCORD.embedFooter }}>
              {embed.footer?.text && (
                <>
                  {embed.footer.icon_url && (() => {
                    const url = resolveEmbedUrl(embed.footer.icon_url, files as any);
                return url ? <img src={url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "contain", marginRight: 8, flexShrink: 0 }} /> : null;
                  })()}
                  <span style={{ whiteSpace: "pre-wrap" }}>{embed.footer.text}</span>
                </>
              )}
              {embed.timestamp && (
                <>
                  {embed.footer?.text && <span style={{ margin: "0 4px" }}>·</span>}
                  <span style={{ whiteSpace: "pre-wrap" }}>{formatEmbedTimestamp(embed.timestamp)}</span>
                </>
              )}
            </div>
          ))}
        </div>
        {embed.thumbnail?.url && (
          <div style={{ marginLeft: 16, flexShrink: 0, marginTop: 2 }}>
            <img
              src={resolveEmbedUrl(embed.thumbnail.url, files as any)}
              alt=""
              style={{ maxHeight: 80, maxWidth: 80, borderRadius: DISCORD.embedRadius, objectFit: "cover", display: "block" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.currentTarget.parentElement as HTMLElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

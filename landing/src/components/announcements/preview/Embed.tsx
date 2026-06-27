import type { APIEmbed, APIEmbedField, APIEmbedImage } from "../types";
import { TEXT_COLOR, C } from "../constants";
import { decimalToHex } from "../utils/color";
import { Markdown, type FeatureConfig } from "../utils/markdown";
import { formatTimestamp } from "../utils/message";
import { getImageUri } from "../utils/files";
import Gallery from "./Gallery";

function getRelativeTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return `Today at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
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
    <div style={{ marginTop: 8, display: "grid", gap: "8px 0", gridTemplateColumns: "repeat(12, 1fr)", fontSize: 13, lineHeight: 1.5, color: "#b5bac1" }}>
      {fieldLines.map((line, li) =>
        line.map((f, fi) => {
          let colStart = 1, colEnd = 13;
          if (f.inline) {
            if (line.length === 3) {
              if (fi === 0) { colStart = 1; colEnd = 5; }
              else if (fi === 1) { colStart = 5; colEnd = 9; }
              else { colStart = 9; colEnd = 13; }
            } else if (line.length === 2) {
              if (fi === 0) { colStart = 1; colEnd = 7; }
              else { colStart = 7; colEnd = 13; }
            }
          }
          return (
            <div key={`${li}-${fi}`} style={{ gridColumn: `${colStart} / ${colEnd}` }}>
              <div style={{ marginBottom: 1, fontSize: 12, fontWeight: 600, color: "#f2f3f5" }}>
                <Markdown content={f.name} features="title" />
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 12, fontWeight: 400, color: "#b5bac1" }}>
                <Markdown content={f.value} features={{ extend: "full", headings: false } as FeatureConfig} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
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
  const embedColor = embed.color != null ? decimalToHex(embed.color) : C.burg;
  const images: APIEmbedImage[] = [];
  if (embed.image?.url) images.push(embed.image);
  if (extraImages) images.push(...extraImages);

  return (
    <div style={{ overflow: "hidden", borderRadius: 4, maxWidth: 520, marginTop: 4 }}>
      <div style={{
        display: "flex",
        borderLeft: `4px solid ${embedColor}`,
        background: C.discEmbed,
        color: "#b5bac1",
        fontSize: 13,
        maxWidth: 520,
      }}>
        <div style={{ padding: "8px 14px 10px 14px", minWidth: 0, flex: 1 }}>
          {embed.provider?.name && (
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 400, color: "#b5bac1" }}>
              {embed.provider.url ? (
                <a href={embed.provider.url} target="_blank" rel="noreferrer noopener" style={{ color: "#00a8fc", textDecoration: "none" }}>{embed.provider.name}</a>
              ) : <span>{embed.provider.name}</span>}
            </div>
          )}

          {embed.author?.name && (
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", minWidth: 0 }}>
              {embed.author.icon_url && (() => {
                const url = getImageUri(embed.author.icon_url, files as any);
                return url ? <img src={url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "contain", marginRight: 8 }} /> : null;
              })()}
              <span style={{ display: "inline", fontSize: 12, fontWeight: 600, color: "#f2f3f5" }}>
                {embed.author.url ? (
                  <a href={embed.author.url} target="_blank" rel="noreferrer noopener" style={{ color: "#00a8fc", textDecoration: "none" }}>{embed.author.name}</a>
                ) : <span>{embed.author.name}</span>}
              </span>
            </div>
          )}

          <div style={{ display: "flex" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {embed.title && (
                <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: "#f2f3f5" }}>
                  {embed.url ? (
                    <a href={embed.url} target="_blank" rel="noreferrer noopener" style={{ color: "#00a8fc", textDecoration: "none" }}>
                      <Markdown content={embed.title} features="title" />
                    </a>
                  ) : (
                    <Markdown content={embed.title} features="title" />
                  )}
                </div>
              )}

              {embed.description && (
                <div style={{ marginTop: 4, whiteSpace: "pre-line", fontSize: 13, fontWeight: 400, color: "#b5bac1", lineHeight: 1.5 }}>
                  <Markdown content={embed.description} />
                </div>
              )}

              {embed.fields && embed.fields.length > 0 && <EmbedFields fields={embed.fields} />}

              {images.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Gallery
                    attachments={images.map((img) => ({
                      id: "0",
                      filename: "image",
                      content_type: (img.url ?? "").endsWith(".gif") ? "image/gif" : "image/png",
                      url: getImageUri(img.url, files as any),
                      proxy_url: "#",
                      size: 0,
                    }))}
                  />
                </div>
              )}

              {embed.video?.url && (
                <div style={{ marginTop: 8 }}>
                  <Gallery
                    attachments={[{
                      id: "0",
                      filename: "video",
                      content_type: "video/mp4",
                      url: embed.video.url,
                      proxy_url: "#",
                      size: 0,
                    }]}
                  />
                </div>
              )}
            </div>

            {embed.thumbnail?.url && (
              <div style={{ marginTop: 8, marginLeft: 16, flexShrink: 0, height: "fit-content" }}>
                <img
                  src={getImageUri(embed.thumbnail.url, files as any)}
                  alt=""
                  style={{ maxHeight: 80, maxWidth: 80, borderRadius: 4, objectFit: "cover" }}
                />
              </div>
            )}
          </div>

          {(embed.footer?.text || embed.timestamp) && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 500, color: "#b5bac1" }}>
              {embed.footer?.text && (
                <>
                  {embed.footer.icon_url && (() => {
                    const url = getImageUri(embed.footer.icon_url, files as any);
                    return url ? <img src={url} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "contain", marginRight: 8 }} /> : null;
                  })()}
                  <span style={{ display: "inline", whiteSpace: "pre-wrap" }}>{embed.footer.text}</span>
                </>
              )}
              {embed.timestamp && (
                <>
                  {embed.footer?.text && <span style={{ margin: "0 4px" }}>&bull;</span>}
                  <span style={{ display: "inline", whiteSpace: "pre-wrap" }}>{getRelativeTime(embed.timestamp)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

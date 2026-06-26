import type { APIEmbed, APIEmbedField, APIEmbedImage } from "../types";
import { TEXT_COLOR } from "../constants";
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
    <div className="mt-2 grid gap-y-2 text-sm leading-relaxed dark:text-[#dbdee1]" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
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
              <div className="mb-px text-xs font-semibold dark:text-[#f2f3f5]">
                <Markdown content={f.name} features="title" />
              </div>
              <div className="whitespace-pre-wrap text-xs font-normal dark:text-[#dbdee1]">
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
  const embedColor = embed.color != null ? decimalToHex(embed.color) : undefined;
  const images: APIEmbedImage[] = [];
  if (embed.image?.url) images.push(embed.image);
  if (extraImages) images.push(...extraImages);

  return (
    <div className="overflow-hidden rounded-lg border border-[rgba(227,229,232,0.5)] dark:border-[rgba(67,67,73,0.5)]" style={{ maxWidth: 520 }}>
      <div
        className="inline-grid border-l-4 bg-white pr-4 pb-4 pl-3 pt-0.5 dark:bg-[#2b2d31] dark:text-[#dbdee1]"
        style={{
          borderLeftColor: embedColor ?? "#4A4A50",
          maxWidth: 520,
        }}
      >
        {embed.provider?.name && (
          <div className="mt-2 min-w-0 text-xs font-normal dark:text-[#dbdee1]">
            {embed.provider.url ? (
              <a href={embed.provider.url} target="_blank" rel="noreferrer noopener" className="hover:underline decoration-[#dbdee1]">{embed.provider.name}</a>
            ) : <span>{embed.provider.name}</span>}
          </div>
        )}

        {embed.author?.name && (
          <div className="mt-2 flex min-w-0 items-center">
            {embed.author.icon_url && (() => {
              const url = getImageUri(embed.author.icon_url, files as any);
              return url ? <img src={url} alt="" className="mr-2 h-6 w-6 rounded-full object-contain" /> : null;
            })()}
            <p className="my-auto inline-block whitespace-pre-wrap text-sm font-medium dark:text-[#f2f3f5]">
              {embed.author.url ? (
                <a href={embed.author.url} target="_blank" rel="noreferrer noopener" className="text-[#00a8fc] hover:underline">{embed.author.name}</a>
              ) : <span>{embed.author.name}</span>}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {embed.title && (
              <div className="mt-2 inline-block text-base font-semibold leading-relaxed dark:text-[#f2f3f5]">
                {embed.url ? (
                  <a href={embed.url} target="_blank" rel="noreferrer noopener" className="text-[#00a8fc] hover:underline">
                    <Markdown content={embed.title} features="title" />
                  </a>
                ) : (
                  <Markdown content={embed.title} features="title" />
                )}
              </div>
            )}

            {embed.description && (
              <div className="mt-2 inline-block whitespace-pre-line text-sm font-normal dark:text-[#dbdee1]">
                <Markdown content={embed.description} />
              </div>
            )}

            {embed.fields && embed.fields.length > 0 && <EmbedFields fields={embed.fields} />}

            {images.length > 0 && (
              <div className="mt-2">
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
              <div className="mt-2">
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
            <div className="mt-2 ml-4 flex h-fit shrink-0 justify-self-end" style={{ gridArea: "1 / 2 / 8 / 3" }}>
              <img
                src={getImageUri(embed.thumbnail.url, files as any)}
                alt=""
                className="max-h-20 max-w-[80px] rounded object-cover"
              />
            </div>
          )}
        </div>

        {(embed.footer?.text || embed.timestamp) && (
          <div className="mt-2 flex min-w-0 items-center text-xs font-medium dark:text-[#dbdee1]">
            {embed.footer?.text && (
              <>
                {embed.footer.icon_url && (() => {
                  const url = getImageUri(embed.footer.icon_url, files as any);
                  return url ? <img src={url} alt="" className="mr-2 h-5 w-5 rounded-full object-contain" /> : null;
                })()}
                <p className="my-auto inline-block whitespace-pre-wrap">{embed.footer.text}</p>
              </>
            )}
            {embed.timestamp && (
              <>
                {embed.footer?.text && <span className="mx-1">&bull;</span>}
                <span className="my-auto inline-block whitespace-pre-wrap">{getRelativeTime(embed.timestamp)}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

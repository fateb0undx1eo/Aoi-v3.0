import { ACCENT, EMBED_BG, TEXT_COLOR } from "../constants";
import type { APIComponentInActionRow, APIEmbed, APIEmbedField, APIEmbedImage, DraftFile, QueryDataMessageData, QueryDataTarget } from "../types";
import { TargetType } from "../types";
import { formatTimestamp } from "../utils/message";
import { decimalToHex } from "../utils/color";
import { Markdown } from "../utils/markdown";
import { getImageUri } from "../utils/files";
import { Eye } from "lucide-react";
import ContainerPreview from "./ContainerPreview";
import Gallery from "./Gallery";
import { PreviewActionRow } from "./ActionRowPreview";
import FileAttachmentPreview from "./FileAttachmentPreview";

function getRelativeTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
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
    <div className="mt-2 grid gap-2 text-sm leading-relaxed" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
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
            } else {
              colStart = 1; colEnd = 13;
            }
          }
          return (
            <div key={`${li}-${fi}`} style={{ gridColumn: `${colStart} / ${colEnd}` }}>
              <div className="mb-px text-xs font-semibold text-zinc-100">
                <Markdown content={f.name} features="title" />
              </div>
              <div className="whitespace-pre-wrap text-xs" style={{ color: TEXT_COLOR }}>
                <Markdown content={f.value} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function DiscordPreview({
  message, isV2, targets, onEditComponent, noBg, files, compact, forceSeparateAuthor, threadName, threadThumbnail
}: {
  message: QueryDataMessageData;
  isV2?: boolean;
  targets?: QueryDataTarget[];
  onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void;
  noBg?: boolean;
  files?: DraftFile[];
  compact?: boolean;
  forceSeparateAuthor?: boolean;
  threadName?: string;
  threadThumbnail?: DraftFile;
}) {
  const hasContent = !!message.content;
  const hasEmbeds = !!(message.embeds && message.embeds.length > 0);
  const hasFiles = files && files.length > 0;
  const hasComponents = message.components && message.components.length > 0 && message.components.some((r) => (r.type === 1 && r.components.length > 0) || r.type === 17);
  const suppressEmbeds = (message.flags ?? 0) & 4;

  const webhookName = targets?.find((t) => t.type === TargetType.Webhook)?.url ? "Webhook" : undefined;

  if (!hasContent && !hasEmbeds && !hasFiles && !hasComponents && !threadName) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg px-6 py-12 text-center" style={{ backgroundColor: noBg ? "transparent" : EMBED_BG }}>
        <Eye className="mb-3 h-10 w-10 text-zinc-600" />
        <p className="text-sm text-zinc-500">Your message preview will appear here</p>
        <p className="mt-1 text-xs text-zinc-600">{isV2 ? "Add V2 containers with text, images, or sections" : "Add content, embeds, or components to get started"}</p>
      </div>
    );
  }

  const renderEmbed = (embed: APIEmbed, ei: number) => {
    const embedBorderColor = embed.color != null ? decimalToHex(embed.color) : "#4A4A50";
    const images: APIEmbedImage[] = [];
    if (embed.image?.url) images.push(embed.image);

    return (
      <div
        key={ei}
        className="overflow-hidden rounded-lg border border-zinc-700/50"
        style={{ maxWidth: 520 }}
      >
        <div
          className="inline-grid border-l-4 bg-zinc-800/60 pr-4 pb-4 pl-3 pt-0.5 dark:text-zinc-100"
          style={{ borderLeftColor: embedBorderColor, maxWidth: 520 }}
        >
          {embed.provider?.name && (
            <div className="mt-2 min-w-0 text-xs font-normal text-zinc-400">
              {embed.provider.url ? (
                <a href={embed.provider.url} target="_blank" rel="noreferrer noopener" className="hover:underline">{embed.provider.name}</a>
              ) : <span>{embed.provider.name}</span>}
            </div>
          )}

          {embed.author?.name && (
            <div className="mt-2 flex min-w-0 items-center">
              {embed.author.icon_url && (() => {
                const url = getImageUri(embed.author.icon_url, files);
                return url ? <img src={url} alt="" className="mr-2 h-6 w-6 rounded-full object-contain" /> : null;
              })()}
              <p className="my-auto inline-block whitespace-pre-wrap text-sm font-medium">
                {embed.author.url ? (
                  <a href={embed.author.url} target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:underline">{embed.author.name}</a>
                ) : <span className="text-zinc-200">{embed.author.name}</span>}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              {embed.title && (
                <div className="mt-2 inline-block text-base font-semibold leading-relaxed">
                  {embed.url ? (
                    <a href={embed.url} target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:underline">
                      <Markdown content={embed.title} features="title" />
                    </a>
                  ) : (
                    <span className="text-zinc-100"><Markdown content={embed.title} features="title" /></span>
                  )}
                </div>
              )}

              {embed.description && (
                <div className="mt-2 inline-block whitespace-pre-line text-sm font-normal" style={{ color: TEXT_COLOR }}>
                  <Markdown content={embed.description} />
                </div>
              )}

              {embed.fields && embed.fields.length > 0 && <EmbedFields fields={embed.fields} />}

              {images.length > 0 && (
                <div className="mt-2">
                  <Gallery items={images.map((img) => ({ url: img.url, content_type: img.url.endsWith(".gif") ? "image/gif" : "image/png" }))} files={files} />
                </div>
              )}

              {embed.video?.url && (
                <div className="mt-2">
                  <Gallery items={[{ url: embed.video.url, content_type: "video/mp4" }]} />
                </div>
              )}
            </div>

            {embed.thumbnail?.url && (
              <div className="mt-2 ml-4 flex h-fit shrink-0 justify-self-end" style={{ gridArea: "1 / 2 / 8 / 3" }}>
                <img
                  src={getImageUri(embed.thumbnail.url, files)}
                  alt=""
                  className="max-h-20 max-w-[80px] rounded object-cover"
                />
              </div>
            )}
          </div>

          {(embed.footer?.text || embed.timestamp) && (
            <div className="mt-2 flex min-w-0 items-center text-xs font-medium" style={{ color: TEXT_COLOR }}>
              {embed.footer?.text && (
                <>
                  {embed.footer.icon_url && (() => {
                    const url = getImageUri(embed.footer.icon_url, files);
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
  };

  const renderContent = () => {
    const imageFiles = (files ?? []).filter((f) => !f.spoiler && (f.content_type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)));
    const otherFiles = (files ?? []).filter((f) => !imageFiles.find((img) => img.id === f.id));

    return (
      <>
        {/* Thread header */}
        {(threadName || threadThumbnail) && (
          <div className="mb-2">
            <div className="flex">
              <div className="shrink-0">
                <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700">
                  <svg className="h-10 w-10 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 className="my-2 select-text text-[32px] font-medium leading-5 text-zinc-200">{threadName || "Thread"}</h3>
              </div>
              {threadThumbnail?.url && (threadThumbnail.content_type?.startsWith("image/")) && (
                <div className="ml-auto mt-auto h-20 w-[140px] rounded-md bg-cover bg-center shadow" style={{ backgroundImage: `url(${threadThumbnail.url})` }} />
              )}
            </div>
            <div className="relative my-2">
              <hr className="border-zinc-700" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-2 text-[10px] text-zinc-500">Today</span>
            </div>
          </div>
        )}

        {/* Author header */}
        {!compact && (
          <div className="mb-1 flex items-center gap-3">
            <div className="shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-500 text-base font-bold text-white">
                {webhookName ? "W" : "A"}
              </div>
            </div>
            <div>
              <span className="text-base font-semibold" style={{ color: webhookName ? TEXT_COLOR : ACCENT }}>
                {webhookName || "AOI Bot"}
              </span>
              <span className="ml-1 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">APP</span>
              {isV2 && <span className="ml-1 rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-400">V2</span>}
              <span className="ml-2 text-xs text-zinc-500">Today at 12:00 AM</span>
            </div>
          </div>
        )}

        {/* Compact mode */}
        {compact && (
          <div className="relative pl-20 -indent-16">
            <span className="mr-1 text-[11px] text-zinc-500">12:00 AM</span>
            <span className="mr-1 text-base font-semibold" style={{ color: webhookName ? TEXT_COLOR : ACCENT }}>
              {webhookName || "AOI Bot"}
            </span>
          </div>
        )}

        {/* Content */}
        {hasContent && (
          <div className="whitespace-pre-line text-[15px] font-medium leading-relaxed" style={{ color: TEXT_COLOR }}>
            <Markdown content={message.content} />
          </div>
        )}

        {/* Files */}
        {hasFiles && (
          <div className={`max-w-[550px] ${hasContent ? "mt-1" : ""} space-y-1`}>
            {imageFiles.length > 0 && (
              <Gallery items={imageFiles.map((f) => ({ url: f.file ? URL.createObjectURL(f.file) : (f.url ?? ""), content_type: f.content_type }))} />
            )}
            {otherFiles.map((f) => (
              <FileAttachmentPreview key={f.id} file={f} />
            ))}
          </div>
        )}

        {/* Embeds */}
        {hasEmbeds && !suppressEmbeds && (
          <div className="mt-1 space-y-1">
            {message.embeds!.map((embed, ei) => renderEmbed(embed, ei))}
          </div>
        )}

        {/* Components */}
        {hasComponents && (
          <div className={`mt-1 ${compact ? "pl-20" : ""}`}>
            <div className="flex flex-col items-stretch gap-y-1.5 overflow-hidden" style={{ maxWidth: 600 }}>
              {message.components!.map((row, ri) =>
                row.type === 1 && row.components.length > 0 ? (
                  <div key={ri} className="flex flex-wrap gap-2">
                    <PreviewActionRow components={row.components} onEditComponent={(comp, _, ci) => onEditComponent?.(comp, ri, ci)} />
                  </div>
                ) : row.type === 17 ? (
                  <ContainerPreview key={ri} container={row} hasTopMargin={false} onEditComponent={(comp, _ri, _ci) => onEditComponent?.(comp, ri, _ci)} />
                ) : null
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="rounded-lg px-4 py-3 text-sm leading-relaxed font-discord" style={{ backgroundColor: noBg ? "transparent" : EMBED_BG }}>
      {renderContent()}
    </div>
  );
}

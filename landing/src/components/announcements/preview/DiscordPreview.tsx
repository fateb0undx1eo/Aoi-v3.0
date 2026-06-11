import { ACCENT, BUTTON_STYLES, EMBED_BG, TEXT_COLOR } from "../constants";
import type { APIComponentInActionRow, DraftFile, QueryDataMessageData, QueryDataTarget } from "../types";
import { TargetType } from "../types";
import { formatTimestamp } from "../utils/message";
import { intToHex } from "../utils/color";
import { renderDiscordText } from "../utils/markdown";
import { ChevronDown, ExternalLink, Eye, FileText, Image, Lock, Video } from "lucide-react";
import ContainerPreview from "./ContainerPreview";

export default function DiscordPreview({ message, isV2, targets, onEditComponent, noBg, files }: { message: QueryDataMessageData; isV2?: boolean; targets?: QueryDataTarget[]; onEditComponent?: (comp: APIComponentInActionRow, ri?: number, ci?: number) => void; noBg?: boolean; files?: DraftFile[] }) {
  const hasContent = !!message.content;
  const hasEmbeds = message.embeds && message.embeds.length > 0;
  const hasFiles = files && files.length > 0;
  const hasComponents = message.components && message.components.length > 0 && message.components.some((r) => (r.type === 1 && r.components.length > 0) || r.type === 17);

  const webhookName = targets?.find((t) => t.type === TargetType.Webhook)?.url ? "Webhook" : undefined;

  if (!hasContent && !hasEmbeds && !hasFiles && !hasComponents) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg px-6 py-12 text-center" style={{ backgroundColor: noBg ? "transparent" : EMBED_BG }}>
        <Eye className="mb-3 h-10 w-10 text-zinc-600" />
        <p className="text-sm text-zinc-500">Your message preview will appear here</p>
        <p className="mt-1 text-xs text-zinc-600">{isV2 ? "Add V2 containers with text, images, or sections" : "Add content, embeds, or components to get started"}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg px-4 py-3 text-sm leading-relaxed font-discord ${noBg ? "" : ""}`} style={{ backgroundColor: noBg ? "transparent" : EMBED_BG }}>
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-500 text-sm font-bold text-white">
          {webhookName ? "W" : "A"}
        </div>
        <div>
          <span className="font-semibold" style={{ color: !webhookName ? ACCENT : undefined }}>
            {webhookName || "AOI Bot"}
          </span>
          {isV2 && <span className="ml-1 rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-400">V2</span>}
          <span className="ml-2 text-zinc-500">Today at 12:00 AM</span>
        </div>
      </div>

      {hasContent && <div className="whitespace-pre-wrap text-[15px]" style={{ color: TEXT_COLOR }}>{renderDiscordText(message.content)}</div>}

      {hasFiles && (() => {
        const imageFiles = files!.filter((f) => !f.spoiler && (f.content_type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)));
        const otherFiles = files!.filter((f) => !imageFiles.includes(f));
        return (
          <>
            {imageFiles.length > 0 && (
              <div className={`grid gap-1 ${imageFiles.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${hasContent ? "mt-2" : ""}`}>
                {imageFiles.map((f) => (
                  <div key={f.id} className="relative group">
                    <img src={f.file ? URL.createObjectURL(f.file) : f.url} alt={f.description || f.name}
                      className="w-full rounded-lg object-cover max-h-80"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ))}
              </div>
            )}
            {otherFiles.length > 0 && (
              <div className={`space-y-1 ${hasContent || imageFiles.length > 0 ? "mt-2" : ""}`}>
                {otherFiles.map((f) => (
                  <div key={f.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${f.spoiler ? "border-zinc-700 bg-black/40" : "border-zinc-800 bg-black/20"}`}>
                    {f.spoiler ? (
                      <Lock className="h-4 w-4 shrink-0 text-zinc-500" />
                    ) : f.content_type?.startsWith("video/") ? (
                      <Video className="h-4 w-4 shrink-0 text-zinc-400" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                      {f.spoiler ? <span className="text-zinc-600">SPOILER </span> : null}{f.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {hasEmbeds && message.embeds!.map((embed, ei) => (
        <div key={ei} className={`overflow-hidden rounded-lg border-l-4 ${hasContent || ei > 0 ? "mt-2" : ""}`}
          style={{ borderLeftColor: intToHex(embed.color), backgroundColor: "#2f3136" }}>
          <div className="px-3 py-2">
            {embed.author && (
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-400">
                {embed.author.icon_url && <img src={embed.author.icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                {embed.author.url ? (
                  <a href={embed.author.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "#00a8fc" }}>{embed.author.name}</a>
                ) : <span className="font-semibold text-white">{embed.author.name}</span>}
              </div>
            )}
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                {embed.title && (
                  <div className="mb-1">
                    {embed.url ? (
                      <a href={embed.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:underline" style={{ color: "#00a8fc" }}>{renderDiscordText(embed.title)}</a>
                    ) : <h3 className="text-lg font-semibold text-white">{renderDiscordText(embed.title)}</h3>}
                  </div>
                )}
                {embed.description && <div className="whitespace-pre-wrap text-sm" style={{ color: TEXT_COLOR }}>{renderDiscordText(embed.description)}</div>}
                {embed.fields && embed.fields.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {embed.fields.map((f, fi) => (
                      <div key={fi} className={f.inline ? "col-span-1" : "col-span-3"}>
                        <div className="text-xs font-semibold text-white">{renderDiscordText(f.name)}</div>
                        <div className="whitespace-pre-wrap text-xs" style={{ color: TEXT_COLOR }}>{renderDiscordText(f.value)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {embed.image && <img src={embed.image.url} alt="" className="mt-2 max-h-80 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              </div>
              {embed.thumbnail && <img src={embed.thumbnail.url} alt="" className="mt-1 h-20 w-20 flex-shrink-0 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            </div>
            {(embed.footer || embed.timestamp) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                {embed.footer?.icon_url && <img src={embed.footer.icon_url} alt="" className="h-4 w-4 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                {embed.footer?.text && <span>{embed.footer.text}</span>}
                {embed.footer?.text && embed.timestamp && <span>&bull;</span>}
                {embed.timestamp && <span>{formatTimestamp(embed.timestamp)}</span>}
              </div>
            )}
          </div>
        </div>
      ))}

      {hasComponents && message.components!.map((row, ri) =>
        row.type === 1 && row.components.length > 0 ? (
          <div key={ri} className={`flex flex-wrap gap-2 ${hasContent || hasEmbeds ? "mt-2" : ""}`}>
            {row.components.map((comp, ci) => {
              if (comp.type === 2) {
                const s = BUTTON_STYLES[comp.style] || BUTTON_STYLES[1];
                if (comp.style === 5) {
                  return (
                    <a key={ci} href={comp.url || "#"} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110"
                      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                      {comp.emoji?.id ? (
                        <img src={`https://cdn.discordapp.com/emojis/${comp.emoji.id}.${comp.emoji.animated ? "gif" : "png"}?size=32`}
                          alt="" className="h-5 w-5 object-contain" />
                      ) : comp.emoji?.name ? (
                        <span>{comp.emoji.name}</span>
                      ) : null}{comp.label || "Link"}<ExternalLink className="h-3 w-3" />
                    </a>
                  );
                }
                return (
                  <button key={ci} type="button" disabled={comp.disabled}
                    onClick={() => onEditComponent?.(comp, ri, ci)}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                    {comp.emoji?.id ? (
                      <img src={`https://cdn.discordapp.com/emojis/${comp.emoji.id}.${comp.emoji.animated ? "gif" : "png"}?size=32`}
                        alt="" className="h-5 w-5 object-contain" />
                    ) : comp.emoji?.name ? (
                      <span>{comp.emoji.name}</span>
                    ) : null}{comp.label || "Button"}
                  </button>
                );
              }
              if (comp.type === 3) {
                return (
                  <div key={ci} onClick={() => onEditComponent?.(comp, ri, ci)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400 hover:brightness-110" style={{ backgroundColor: "#4e5058" }}>
                    <ChevronDown className="h-3 w-3" />{comp.placeholder || "Select an option"}
                  </div>
                );
              }
              if (comp.type >= 5 && comp.type <= 8) {
                return (
                  <div key={ci} onClick={() => onEditComponent?.(comp, ri, ci)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-zinc-400 hover:brightness-110" style={{ backgroundColor: "#4e5058" }}>
                    <ChevronDown className="h-3 w-3" />{comp.placeholder || "Select..."}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ) : row.type === 17 ? (
          <ContainerPreview key={ri} container={row} hasTopMargin={hasContent || hasEmbeds} onEditComponent={(comp, _ri, _ci) => onEditComponent?.(comp, ri, _ci)} />
        ) : null
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { EMBED_BG, TEXT_COLOR, ACCENT } from "../constants";
import type { APIEmbed, APIEmbedImage, APIComponentInActionRow, DraftFile, QueryDataMessageData, QueryDataTarget, APIAttachment } from "../types";
import { TargetType } from "../types";
import { isComponentsV2 } from "../utils/message";
import { Markdown } from "../utils/markdown";
import EmbedPreview from "./Embed";
import ContainerPreview from "./Container";
import Gallery from "./Gallery";
import FileAttachmentPreview from "./FileAttachment";
import { PreviewActionRow } from "./ActionRow";
import MessageDivider from "./MessageDivider";

  const defaultAvatarUrl = "/favicon.svg";

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
  const flagsV2 = isComponentsV2(message.flags);

  const webhookName = targets?.find((t) => t.type === TargetType.Webhook)?.url ? "Webhook" : undefined;
  const username = message.username || webhookName || "AOI";

  const now = new Date();
  const [eyeState, setEyeState] = useState<'idle' | 'swirling'>('idle');
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const eyeRef = useRef<HTMLDivElement>(null);
  const eyeStateRef = useRef(eyeState);
  const targetPupilRef = useRef({ x: 0, y: 0 });
  const currentPupilRef = useRef({ x: 0, y: 0 });
  const trackingRafRef = useRef<number | undefined>(undefined);
  const seqAnimRef = useRef<number | undefined>(undefined);
  eyeStateRef.current = eyeState;

  useEffect(() => {
    return () => {
      if (trackingRafRef.current !== undefined) cancelAnimationFrame(trackingRafRef.current);
      if (seqAnimRef.current !== undefined) cancelAnimationFrame(seqAnimRef.current);
    };
  }, []);

  const triggerEyeSequence = useCallback(() => {
    setEyeState('swirling');
    const start = Date.now();
    const duration = 2200;

    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed >= duration || eyeStateRef.current !== 'swirling') {
        setPupilOffset({ x: 0, y: 0 });
        setEyeState('idle');
        return;
      }

      const t = elapsed / duration;
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const angle = eased * Math.PI * 6;
      const radius = Math.sin(t * Math.PI) * 3.5;

      setPupilOffset({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      seqAnimRef.current = requestAnimationFrame(tick);
    };

    seqAnimRef.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = eyeRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = rect.width / 24;
      const mapped = Math.min(e.clientX - rect.left - rect.width / 2, scale * 8) / (scale * 8) * 4;
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const m = Math.min(dist / (scale * 8), 1) * 4;
      const angle = Math.atan2(dy, dx);
      targetPupilRef.current = { x: Math.cos(angle) * m, y: Math.sin(angle) * m };
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  const handleEyeClick = useCallback(() => {
    if (eyeStateRef.current === 'idle') triggerEyeSequence();
  }, [triggerEyeSequence]);

  useEffect(() => {
    if (eyeState !== 'idle') return;
    const tick = () => {
      const t = targetPupilRef.current;
      const c = currentPupilRef.current;
      c.x += (t.x - c.x) * 0.18;
      c.y += (t.y - c.y) * 0.18;
      if (Math.abs(c.x - t.x) < 0.005) c.x = t.x;
      if (Math.abs(c.y - t.y) < 0.005) c.y = t.y;
      setPupilOffset({ x: c.x, y: c.y });
      trackingRafRef.current = requestAnimationFrame(tick);
    };
    trackingRafRef.current = requestAnimationFrame(tick);
    return () => { if (trackingRafRef.current !== undefined) cancelAnimationFrame(trackingRafRef.current); };
  }, [eyeState]);

  if (!hasContent && !hasEmbeds && !hasFiles && !hasComponents && !threadName) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center" style={{ backgroundColor: noBg ? "transparent" : EMBED_BG }}>
        <div ref={eyeRef} className="mb-4 cursor-pointer" onClick={handleEyeClick} onContextMenu={(e) => { e.preventDefault(); handleEyeClick(); }}>
          <svg className="h-12 w-12 overflow-visible text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <g style={{ transformOrigin: "12px 12px" }}>
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
              <circle cx={12 + pupilOffset.x} cy={12 + pupilOffset.y} r="3" fill="currentColor" fillOpacity="0.3" />
            </g>
          </svg>
        </div>
        <p className="text-sm text-zinc-500">Your message preview will appear here</p>
        <p className="mt-1 text-xs text-zinc-600">{isV2 ? "Add V2 containers with text, images, or sections" : "Add content, embeds, or components to get started"}</p>
      </div>
    );
  }

  const embeds: { embed: APIEmbed; extraImages: APIEmbedImage[] }[] = [];
  for (const embed of message.embeds ?? []) {
    const galleryChildren = (message.embeds ?? []).filter((e) => embed.url && e.url === embed.url).slice(1);
    if (galleryChildren.includes(embed)) continue;
    embeds.push({
      embed,
      extraImages: galleryChildren.filter((e) => !!e.image?.url).map((e) => e.image!),
    });
  }

  const allAttachments: APIAttachment[] = flagsV2 ? [] : [
    ...(message.attachments ?? []),
    ...(files
      ?.filter((f) => !(f as any).is_thumbnail)
      ?.map((f) => ({
        id: f.id,
        filename: f.name,
        size: f.size,
        content_type: f.content_type,
        url: f.url ?? (f.file ? URL.createObjectURL(f.file) : "#"),
        proxy_url: "#",
      } satisfies APIAttachment)) ?? []),
  ];
  const mediaAttachments = allAttachments.filter(
    (a) => a.content_type && ["video", "image"].includes(a.content_type.split("/")[0]!),
  );
  const fileAttachments = allAttachments.filter(
    (a) => !a.content_type || !["video", "image"].includes(a.content_type.split("/")[0]!),
  );

  const threadThumb = threadThumbnail ?? files?.find((f) => (f as any).is_thumbnail);

  return (
    <div className="text-sm leading-relaxed" style={{ backgroundColor: noBg ? "transparent" : EMBED_BG }}>
      {threadName && (
        <div className="mb-2">
          <div className="flex">
            <div className="shrink-0">
              <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700">
                <MessageSquare className="h-10 w-10 text-zinc-400" />
              </div>
              <h3 className="my-2 select-text text-[32px] font-medium leading-5 text-zinc-200">{threadName}</h3>
            </div>
            {threadThumb?.url && threadThumb.content_type?.startsWith("image/") && (
              <div className="ml-auto mt-auto h-20 w-[140px] rounded-md bg-cover bg-center shadow" style={{ backgroundImage: `url(${threadThumb.url})` }} />
            )}
          </div>
          <MessageDivider>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </MessageDivider>
        </div>
      )}

      <div className={`flex ${!compact ? "mt-4" : ""}`}>
        {!compact && (
          <div className="mr-3 shrink-0">
            {forceSeparateAuthor ? (
              <img
                src={message.avatar_url || defaultAvatarUrl}
                alt={username}
                className="h-10 w-10 rounded-full hover:shadow-lg"
                onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatarUrl; }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                <img src="/favicon.svg" alt={username} className="h-7 w-7" />
              </div>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {!compact && (
            <p className="mb-0 leading-none">
              <span className="text-base font-semibold text-[#f2f3f5]">
                {username}
              </span>
              <span className="ml-1.5 inline-flex -translate-y-[3px] items-center rounded-sm bg-[#5865F2] px-1 text-[10px] font-semibold leading-none text-white">APP</span>
              {flagsV2 && <span className="ml-1 inline-flex -translate-y-[3px] items-center rounded bg-zinc-700 px-1 text-[9px] font-semibold leading-none text-zinc-400">V2</span>}
              <span className="ml-2 -translate-y-[2px] text-xs leading-none text-zinc-500">
                {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
            </p>
          )}

          {compact && (
            <div className="relative pl-20 -indent-16">
              <span className="mr-1 text-[11px] text-zinc-500">
                {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
              <img src={defaultAvatarUrl} alt="" className="mr-1 inline h-4 w-4 rounded-full" />
              <span className="mr-1 text-base font-semibold text-[#f2f3f5]">
                {username}
              </span>
            </div>
          )}

          {hasContent && (
            <div className={`whitespace-pre-line pr-4 text-[15px] font-medium leading-[1.25] dark:text-[#dbdee1]`}>
              <Markdown content={message.content ?? ""} />
            </div>
          )}

          <div className={compact ? "pl-20 pr-4" : "pr-4"}>
            {mediaAttachments.length > 0 && (
              <div className={`max-w-[550px] ${hasContent ? "mt-1" : ""}`}>
                <Gallery attachments={mediaAttachments} />
              </div>
            )}

            {fileAttachments.length > 0 && (
              <div className={`max-w-[550px] ${hasContent || mediaAttachments.length > 0 ? "mt-1" : ""} space-y-1`}>
                {fileAttachments.map((att) => (
                  <FileAttachmentPreview key={att.id} attachment={att} />
                ))}
              </div>
            )}

            {!flagsV2 && files && files.length > 0 && allAttachments.length === 0 && (
              <div className={`max-w-[550px] ${hasContent ? "mt-1" : ""} space-y-1`}>
                {files
                  .filter((f) => f.content_type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name))
                  .slice(0, 10)
                  .map((f) => (
                    <Gallery key={f.id}
                      attachments={[{
                        id: f.id, filename: f.name, content_type: f.content_type ?? "image/png",
                        url: f.file ? URL.createObjectURL(f.file) : (f.url ?? ""), proxy_url: "#", size: f.size,
                      } satisfies APIAttachment]} />
                  ))}
                {files
                  .filter((f) => !f.content_type?.startsWith("image/") && !/\.(png|jpg|jpeg|gif|webp)$/i.test(f.name))
                  .map((f) => (
                    <FileAttachmentPreview key={f.id} attachment={{
                      id: f.id, filename: f.name, size: f.size, content_type: f.content_type,
                      url: f.file ? URL.createObjectURL(f.file) : (f.url ?? ""), proxy_url: "#",
                    }} />
                  ))}
              </div>
            )}

            {embeds.length > 0 && !suppressEmbeds && (
              <div className="mt-1 space-y-1">
                {embeds.map((ed, i) => (
                  <EmbedPreview key={i} embed={ed.embed} extraImages={ed.extraImages} files={files} />
                ))}
              </div>
            )}

            {hasComponents && (
              <div className={`mt-1 ${compact ? "pl-20" : ""}`}>
                <div className="flex flex-col items-stretch gap-y-1.5 overflow-hidden" style={{ maxWidth: 600 }}>
                  {message.components!.map((row, ri) =>
                    row.type === 1 && row.components.length > 0 ? (
                      <div key={ri} className="flex flex-wrap gap-2">
                        <PreviewActionRow components={row.components} onEditComponent={(comp, _, ci) => onEditComponent?.(comp, ri, ci)} />
                      </div>
                    ) : row.type === 17 ? (
                      <ContainerPreview key={ri} container={row} hasTopMargin={false} onEditComponent={(comp, _ri, _ci) => onEditComponent?.(comp, ri, _ci)} files={files} />
                    ) : null
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

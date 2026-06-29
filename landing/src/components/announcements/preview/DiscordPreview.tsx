import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { EMBED_BG, DISCORD, FONT } from "../constants";
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

export function EmptyPreviewPlaceholder({ isV2, noBg }: { isV2?: boolean; noBg?: boolean }) {
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

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", backgroundColor: noBg ? "transparent" : EMBED_BG, fontFamily: FONT }}>
      <div ref={eyeRef} style={{ marginBottom: 16, cursor: "pointer" }} onClick={handleEyeClick} onContextMenu={(e) => { e.preventDefault(); handleEyeClick(); }}>
        <svg style={{ width: 48, height: 48, overflow: "visible", color: "#52525b" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <g style={{ transformOrigin: "12px 12px" }}>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            <circle cx={12 + pupilOffset.x} cy={12 + pupilOffset.y} r="3" fill="currentColor" fillOpacity="0.3" />
          </g>
        </svg>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: DISCORD.textMuted, fontFamily: FONT }}>Your message preview will appear here</p>
      <p style={{ marginTop: 4, fontSize: 12, color: "#52525b", fontFamily: FONT }}>{isV2 ? "Add V2 containers with text, images, or sections" : "Add content, embeds, or components to get started"}</p>
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
  const flagsV2 = isComponentsV2(message.flags);

  const webhookName = targets?.find((t) => t.type === TargetType.Webhook)?.url ? "Webhook" : undefined;
  const username = message.username || webhookName || "AOI";

  const now = new Date();

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
  const timestampStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const msgBg = {
    backgroundColor: noBg ? "transparent" : "transparent",
    fontFamily: FONT,
    transition: "background-color 0.1s",
    borderRadius: 4,
    padding: "1px 0",
    WebkitFontSmoothing: "antialiased" as const,
    MozOsxFontSmoothing: "grayscale" as const,
  };

  const contentArea = (
    <>
      {hasContent && (
        <div style={{ whiteSpace: "pre-line", fontSize: 15, fontWeight: 500, lineHeight: 1.25, color: DISCORD.textNormal, fontFamily: FONT, marginTop: 0 }}>
          <Markdown content={message.content ?? ""} />
        </div>
      )}

      {mediaAttachments.length > 0 && (
        <div style={{ maxWidth: 550, marginTop: hasContent ? 4 : 0 }}>
          <Gallery attachments={mediaAttachments} />
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div style={{ maxWidth: 550, marginTop: (hasContent || mediaAttachments.length > 0) ? 4 : 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {fileAttachments.map((att) => (
            <FileAttachmentPreview key={att.id} attachment={att} />
          ))}
        </div>
      )}

      {!flagsV2 && files && files.length > 0 && allAttachments.length === 0 && (
        <div style={{ maxWidth: 550, marginTop: hasContent ? 4 : 0, display: "flex", flexDirection: "column", gap: 4 }}>
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
        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
          {embeds.map((ed, i) => (
            <EmbedPreview key={i} embed={ed.embed} extraImages={ed.extraImages} files={files} />
          ))}
        </div>
      )}

      {hasComponents && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, overflow: "hidden", maxWidth: 600 }}>
            {message.components!.map((row, ri) =>
              row.type === 1 && row.components.length > 0 ? (
                <div key={ri} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <PreviewActionRow components={row.components} onEditComponent={(comp, _, ci) => onEditComponent?.(comp, ri, ci)} />
                </div>
              ) : row.type === 17 ? (
                <ContainerPreview key={ri} container={row} hasTopMargin={false} onEditComponent={(comp, _ri, _ci) => onEditComponent?.(comp, ri, _ci)} files={files} />
              ) : null
            )}
          </div>
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <div style={msgBg}>
        <div style={{ position: "relative", paddingLeft: 72, textIndent: -56 }}>
          <span style={{ marginRight: 4, fontSize: 11, color: DISCORD.timestamp, fontFamily: FONT }}>
            {timestampStr}
          </span>
          <img src={defaultAvatarUrl} alt="" style={{ display: "inline", width: 16, height: 16, borderRadius: "50%", marginRight: 4, verticalAlign: "middle" }} />
          <span style={{ marginRight: 4, fontSize: 15, fontWeight: 600, color: DISCORD.username, fontFamily: FONT }}>
            {username}
          </span>
        </div>
        <div style={{ paddingLeft: 72, paddingRight: 16 }}>
          {contentArea}
        </div>
      </div>
    );
  }

  return (
    <div style={msgBg}>
      {threadName && (
        <div style={{ marginBottom: 8, fontFamily: FONT }}>
          <div style={{ display: "flex" }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ marginTop: 16, width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: DISCORD.threadBg }}>
                <MessageSquare style={{ width: 40, height: 40, color: DISCORD.textMuted }} />
              </div>
              <h3 style={{ margin: "8px 0", fontSize: 32, fontWeight: 500, lineHeight: 1.25, color: DISCORD.headerPrimary, fontFamily: FONT, userSelect: "text" }}>{threadName}</h3>
            </div>
            {threadThumb?.url && threadThumb.content_type?.startsWith("image/") && (
              <div style={{ marginLeft: "auto", marginTop: "auto", width: 140, height: 80, borderRadius: 4, backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", backgroundImage: `url(${threadThumb.url})` }} />
            )}
          </div>
          <MessageDivider>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </MessageDivider>
        </div>
      )}

      <div style={{ display: "flex", marginTop: threadName ? 0 : 16 }}>
        <div style={{ width: 40, flexShrink: 0, marginRight: 12, marginLeft: 20 }}>
          {forceSeparateAuthor ? (
            <img
              src={message.avatar_url || defaultAvatarUrl}
              alt={username}
              style={{ width: 40, height: 40, borderRadius: "50%", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatarUrl; }}
            />
          ) : (
            <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#fff" }}>
              <img src="/favicon.svg" alt={username} style={{ width: 28, height: 28 }} />
            </div>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1, paddingRight: 48 }}>
          <p style={{ margin: 0, lineHeight: 1.2, display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: DISCORD.username, fontFamily: FONT, lineHeight: 1.2 }}>
              {username}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 3, background: DISCORD.appBadge, padding: "1px 5px", fontSize: 10, fontWeight: 600, lineHeight: "14px", color: DISCORD.appBadgeText, fontFamily: FONT, verticalAlign: "middle" }}>
              APP
            </span>
            {flagsV2 && (
              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 3, background: DISCORD.v2Badge, padding: "1px 5px", fontSize: 10, fontWeight: 600, lineHeight: "14px", color: DISCORD.v2BadgeText, fontFamily: FONT, verticalAlign: "middle" }}>
                V2
              </span>
            )}
            <span style={{ fontSize: 11, color: DISCORD.timestamp, fontFamily: FONT, lineHeight: 1.2 }}>
              {timestampStr}
            </span>
          </p>

          {contentArea}
        </div>
      </div>
    </div>
  );
}

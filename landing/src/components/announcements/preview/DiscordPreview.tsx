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
  const [eyeState, setEyeState] = useState<'idle' | 'shaking' | 'exploding' | 'exploded'>('idle');
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<{ x: number; y: number; vx: number; vy: number; color: string; size: number; life: number }[]>([]);
  const eyeRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<number | undefined>(undefined);
  const particleRef = useRef<number | undefined>(undefined);
  const explodeStartRef = useRef(0);

  useEffect(() => {
    return () => {
      if (shakeRef.current !== undefined) clearInterval(shakeRef.current);
      if (particleRef.current !== undefined) cancelAnimationFrame(particleRef.current);
    };
  }, []);

  useEffect(() => {
    if (eyeState === 'exploding') {
      document.body.classList.add('page-shake');
      setTimeout(() => document.body.classList.remove('page-shake'), 500);
    }
  }, [eyeState]);

  const handleEyeMove = useCallback((e: React.MouseEvent) => {
    if (eyeState === 'exploded') return;
    const rect = eyeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = rect.width / 24;
    const maxOffset = 4;
    const mapped = Math.min(dist / (scale * 8), 1) * maxOffset;
    const angle = Math.atan2(dy, dx);
    setPupilOffset({ x: Math.cos(angle) * mapped, y: Math.sin(angle) * mapped });

    if (dist < 50 && eyeState === 'idle') {
      setEyeState('shaking');
      let tick = 0;
      shakeRef.current = window.setInterval(() => {
        tick++;
        const intensity = Math.min(tick / 10, 1);
        setShakeOffset({ x: (Math.random() - 0.5) * 16 * intensity, y: (Math.random() - 0.5) * 16 * intensity });
        if (tick >= 20) {
          if (shakeRef.current !== undefined) { clearInterval(shakeRef.current); shakeRef.current = undefined; }
          setShakeOffset({ x: 0, y: 0 });
          setEyeState('exploding');
          const palette = ['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ff8800','#ff4488','#44ff88','#8844ff','#fff','#888'];
          setParticles(Array.from({ length: 60 }, () => {
            const size = 0.4 + Math.random() * 0.8;
            return {
              x: 12 + (Math.random() - 0.5) * 3,
              y: 12 + (Math.random() - 0.5) * 3,
              vx: (Math.random() - 0.5) * 14,
              vy: (Math.random() - 0.5) * 14,
              color: palette[Math.floor(Math.random() * palette.length)]!,
              size,
              life: 1,
            };
          }));
          explodeStartRef.current = Date.now();
          const anim = () => {
            const elapsed = Date.now() - explodeStartRef.current;
            if (elapsed > 2000) { setParticles([]); return; }
            setParticles(prev => prev.map(p => ({
              ...p,
              x: p.x + p.vx * 0.08,
              y: p.y + p.vy * 0.08,
              vx: p.vx * 0.96,
              vy: p.vy * 0.96,
              life: Math.max(0, 1 - elapsed / 2000),
            })));
            particleRef.current = requestAnimationFrame(anim);
          };
          particleRef.current = requestAnimationFrame(anim);
        }
      }, 40);
    }
  }, [eyeState]);

  const handleEyeLeave = useCallback(() => {
    if (shakeRef.current !== undefined) { clearInterval(shakeRef.current); shakeRef.current = undefined; }
    if (particleRef.current !== undefined) { cancelAnimationFrame(particleRef.current); particleRef.current = undefined; }
    if (eyeState === 'idle' || eyeState === 'shaking') {
      setPupilOffset({ x: 0, y: 0 });
      setShakeOffset({ x: 0, y: 0 });
    }
  }, [eyeState]);

  if (!hasContent && !hasEmbeds && !hasFiles && !hasComponents && !threadName) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center" style={{ backgroundColor: noBg ? "transparent" : EMBED_BG }}>
        <style>{`@keyframes pageShake{0%,to{transform:translateX(0)}10%{transform:translateX(-6px) rotate(-.6deg)}20%{transform:translateX(6px) rotate(.6deg)}30%{transform:translateX(-5px) rotate(-.4deg)}40%{transform:translateX(5px) rotate(.4deg)}50%{transform:translateX(-4px) rotate(-.3deg)}60%{transform:translateX(4px) rotate(.3deg)}70%{transform:translateX(-3px)}80%{transform:translateX(3px)}90%{transform:translateX(-1px)}}.page-shake{animation:pageShake .5s ease-in-out}`}</style>
        <div ref={eyeRef} className="mb-4" onMouseMove={handleEyeMove} onMouseLeave={handleEyeLeave}>
          <svg className="h-12 w-12 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {eyeState !== 'exploded' && (
              <g style={{ transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`, transformOrigin: "12px 12px" }}>
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                <circle cx={12 + pupilOffset.x} cy={12 + pupilOffset.y} r="3" fill="currentColor" fillOpacity="0.3" />
              </g>
            )}
            {particles.map((p, i) => (
              <rect key={i} x={p.x - p.size / 2} y={p.y - p.size / 2} width={p.size} height={p.size} fill={p.color} opacity={p.life} />
            ))}
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

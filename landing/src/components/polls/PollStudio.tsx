import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Link2,
  Loader2,
  Music4,
  Plus,
  Search,
  Send,
  Swords,
  Trash2,
  Upload,
} from "lucide-react";

import DiscordPreview from "@/components/announcements/preview/DiscordPreview";
import { ToastContainer, useToasts } from "@/components/announcements/ToastContainer";
import type { GuildChannel } from "@/components/announcements/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import type { PollDraft, PollOptionDraft, ShowResults, VoteMethod } from "./types";
import { POLL_TYPE_META, createDefaultDraft } from "./types";
import { buildPreviewComponents } from "./pollComponents";
import { renderVsCardPreview, renderTrackCardPreview } from "./vsCard";

function CropModal({
  dataUrl,
  onConfirm,
  onCancel,
}: {
  dataUrl: string;
  onConfirm: (cropped: string) => void;
  onCancel: () => void;
}) {
  const S = 500;
  const MIN_CROP = 40;
  const MAX_STAGE = 480;
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<
    | { mode: "move"; x: number; y: number; cx: number; cy: number }
    | { mode: "resize"; x: number; y: number; cx: number; cy: number; cs: number }
    | null
  >(null);
  const [ready, setReady] = useState(false);
  const [stageSize, setStageSize] = useState(() =>
    typeof window === "undefined" ? MAX_STAGE : Math.max(240, Math.min(MAX_STAGE, window.innerWidth - 64)),
  );
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [crop, setCrop] = useState({ cx: 0, cy: 0, cs: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setStageSize(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitScale = stageSize / S;

  const imageRect = useCallback(() => {
    if (!imgSize.w || !imgSize.h) return { ix: 0, iy: 0, iw: 0, ih: 0, disp: 1 };
    const contain = Math.min(S / imgSize.w, S / imgSize.h);
    const disp = contain * scale;
    const iw = imgSize.w * disp;
    const ih = imgSize.h * disp;
    return { ix: (S - iw) / 2, iy: (S - ih) / 2, iw, ih, disp };
  }, [imgSize, scale]);

  const visibleRect = useCallback(() => {
    const r = imageRect();
    const x = Math.max(r.ix, 0);
    const y = Math.max(r.iy, 0);
    const w = Math.min(r.ix + r.iw, S) - x;
    const h = Math.min(r.iy + r.ih, S) - y;
    return { x, y, w, h };
  }, [imageRect]);

  const clampCrop = useCallback(
    (c: { cx: number; cy: number; cs: number }) => {
      const v = visibleRect();
      const maxSide = Math.max(0, Math.min(v.w, v.h));
      let cs = Math.min(c.cs, maxSide);
      cs = Math.max(MIN_CROP, cs);
      const cx = Math.min(v.x + v.w - cs, Math.max(v.x, c.cx));
      const cy = Math.min(v.y + v.h - cs, Math.max(v.y, c.cy));
      return { cx, cy, cs };
    },
    [visibleRect],
  );

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      const contain = Math.min(S / img.naturalWidth, S / img.naturalHeight);
      const iw = img.naturalWidth * contain;
      const ih = img.naturalHeight * contain;
      const side = Math.min(iw, ih);
      setCrop({ cx: (S - iw) / 2 + (iw - side) / 2, cy: (S - ih) / 2 + (ih - side) / 2, cs: side });
      setReady(true);
    };
    img.src = dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl]);

  useEffect(() => {
    setCrop((c) => clampCrop(c));
  }, [scale, clampCrop]);

  const toCropUnits = useCallback(
    (clientDelta: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      const rendered = rect?.width && rect.width > 0 ? rect.width : stageSize;
      return (clientDelta / rendered) * S;
    },
    [stageSize],
  );

  const onPointerDownMove = (e: React.PointerEvent) => {
    dragRef.current = { mode: "move", x: e.clientX, y: e.clientY, cx: crop.cx, cy: crop.cy };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerDownResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { mode: "resize", x: e.clientX, y: e.clientY, cx: crop.cx, cy: crop.cy, cs: crop.cs };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = toCropUnits(e.clientX - d.x);
    const dy = toCropUnits(e.clientY - d.y);
    if (d.mode === "move") {
      setCrop(clampCrop({ cx: d.cx + dx, cy: d.cy + dy, cs: crop.cs }));
    } else {
      const ns = d.cs + (dx + dy) / 2;
      setCrop(clampCrop({ cx: d.cx, cy: d.cy, cs: ns }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const r = imageRect();
    const sx = (crop.cx - r.ix) / r.disp;
    const sy = (crop.cy - r.iy) / r.disp;
    const sw = crop.cs / r.disp;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, S, S);
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-[560px] flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 text-card-foreground sm:p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Crop image"
      >
        <div>
          <p className="text-sm font-medium">Crop your image</p>
          <p className="text-xs text-muted-foreground">Drag the square to choose what lands on the card.</p>
        </div>
        <div
          className="mx-auto w-full"
          style={{ maxWidth: MAX_STAGE }}
        >
          <div
            ref={stageRef}
            className="relative aspect-square w-full select-none overflow-hidden rounded-lg bg-muted"
            style={{ touchAction: "none" }}
          >
            {imgSize.w > 0 && (
              <img
                src={dataUrl}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: imageRect().ix * fitScale,
                  top: imageRect().iy * fitScale,
                  width: imageRect().iw * fitScale,
                  height: imageRect().ih * fitScale,
                  userSelect: "none",
                  pointerEvents: "none",
                  maxWidth: "none",
                }}
              />
            )}
            {ready && (
              <div
                className="absolute cursor-move"
                style={{
                  left: crop.cx * fitScale,
                  top: crop.cy * fitScale,
                  width: crop.cs * fitScale,
                  height: crop.cs * fitScale,
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                  touchAction: "none",
                }}
                onPointerDown={onPointerDownMove}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border border-white bg-primary sm:h-5 sm:w-5"
                  onPointerDown={onPointerDownResize}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Label htmlFor="poll-crop-zoom">Zoom</Label>
          <input
            id="poll-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!ready} onClick={() => confirm()}>
            Use this
          </Button>
        </div>
      </div>
    </div>
  );
}

function makeId(): string {
  return `opt_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>;
}

const ENDS_PRESETS: { value: string; label: string; ms: number | null }[] = [
  { value: "never", label: "Never", ms: null },
  { value: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { value: "12h", label: "12 hours", ms: 12 * 60 * 60 * 1000 },
  { value: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "3 days", ms: 3 * 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "custom", label: "Custom…", ms: null },
];

function endsValueFor(endsAt: string | null): string {
  if (!endsAt) return "never";
  const diff = new Date(endsAt).getTime() - Date.now();
  const match = ENDS_PRESETS.find((preset) => preset.ms != null && Math.abs(diff - preset.ms) < 60_000);
  return match ? match.value : "custom";
}

function endsCustomLabel(endsAt: string): string {
  const date = new Date(endsAt);
  if (!Number.isFinite(date.getTime())) return "Custom…";
  return `Custom (${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })})`;
}

export default function PollStudio({
  guildId,
  channels,
}: {
  guildId: string;
  guild: Record<string, any> | null;
  channels: GuildChannel[];
}) {
  const [draft, setDraft] = useState<PollDraft>(() => createDefaultDraft());
  const [channelId, setChannelId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [devChannelId, setDevChannelId] = useState<string>("");
  const [devSending, setDevSending] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [vsPreview, setVsPreview] = useState<string | null>(null);
  const [trackCards, setTrackCards] = useState<(string | null)[]>([]);
  const [previewClosed, setPreviewClosed] = useState(false);
  const [badgeLabel, setBadgeLabel] = useState("VS");
  const [cropTarget, setCropTarget] = useState<{ optionId: string; dataUrl: string } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toasts, addToast, dismissToast } = useToasts();

  const textChannels = useMemo(() => channels.filter((c) => c.type === 0 || c.type === 5), [channels]);

  useEffect(() => {
    if (!channelId && textChannels.length > 0) setChannelId(textChannels[0]!.id);
  }, [textChannels, channelId]);

  const updateSettings = useCallback((patch: Partial<PollDraft["settings"]>) => {
    setDraft((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const setEndsIn = useCallback(
    (ms: number) => {
      updateSettings({ ends_at: new Date(Date.now() + ms).toISOString() });
    },
    [updateSettings],
  );

  const endsInLabel = useMemo(() => {
    if (!draft.settings.ends_at) return null;
    const diff = new Date(draft.settings.ends_at).getTime() - Date.now();
    if (!Number.isFinite(diff) || diff <= 0) return "in the past — pick a later time";
    const minutes = Math.round(diff / 60_000);
    if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
    const days = Math.round(hours / 24);
    return `in ${days} day${days === 1 ? "" : "s"}`;
  }, [draft.settings.ends_at]);

  const updateOption = useCallback((id: string, patch: Partial<PollOptionDraft>) => {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);

  const addOption = useCallback(() => {
    setDraft((prev) => {
      if (prev.options.length >= 20) return prev;
        return {
          ...prev,
          options: [
            ...prev.options,
            { id: makeId(), label: "", image_url: null, emoji: null, accent: null, track_url: null, track_artist: null },
          ],
        };
    });
  }, []);

  const removeOption = useCallback((id: string) => {
    setDraft((prev) =>
      prev.options.length <= 2
        ? prev
        : { ...prev, options: prev.options.filter((o) => o.id !== id) },
    );
  }, []);

  const selectType = useCallback((type: PollDraft["type"]) => {
    setDraft((prev) => {
      if (type === "music" && prev.options.length !== 1) {
        return {
          ...prev,
          type,
          options: [{ id: makeId(), label: "", image_url: null, emoji: null, accent: null, track_url: null, track_artist: null }],
        };
      }
      return { ...prev, type };
    });
  }, []);

  const moveOption = useCallback((index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev.options];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...prev, options: next };
    });
  }, []);

  const uploadImage = useCallback(
    async (optionId: string, file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        setCropTarget({ optionId, dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const confirmCrop = useCallback(
    async (croppedDataUrl: string) => {
      if (!cropTarget) return;
      const { optionId } = cropTarget;
      setCropTarget(null);
      setUploading(optionId);
      try {
        const res = await fetch(croppedDataUrl);
        const blob = await res.blob();
        const form = new FormData();
        form.append("file", blob, "image.png");
        const uploadRes = await fetch(`/api/backend/guilds/${guildId}/upload`, {
          method: "POST",
          body: form,
        });
        const json = await uploadRes.json();
        if (!uploadRes.ok || !json?.url) throw new Error(json?.error ?? "Upload failed");
        updateOption(optionId, { image_url: json.url });
        addToast("success", "Image uploaded.");
      } catch (error: any) {
        addToast("error", error.message ?? "Upload failed");
      } finally {
        setUploading(null);
      }
    },
    [cropTarget, guildId, updateOption, addToast],
  );

  const fetchTrack = useCallback(
    async (optionId: string, link: string) => {
      const url = link.trim();
      if (!/^https?:\/\//i.test(url)) return;
      setUploading(optionId);
      try {
        const res = await fetch(`/api/backend/polls/oembed?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Could not fetch track");
        updateOption(optionId, {
          track_url: url,
          label: json.title || draft.options.find((o) => o.id === optionId)?.label || "",
          image_url: json.thumbnail_url ?? null,
          track_artist: json.artist ?? null,
          track_duration: typeof json.duration === "number" ? json.duration : null,
        });
        addToast("success", "Track loaded.");
      } catch (error: any) {
        addToast("error", error.message ?? "Could not fetch track");
      } finally {
        setUploading(null);
      }
    },
    [guildId, updateOption, addToast, draft.options],
  );

  useEffect(() => {
    let cancelled = false;
    if (draft.type !== "vs") {
      setVsPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      const dataUrl = await renderVsCardPreview(draft.options, {
        badgeLabel,
      });
      if (!cancelled) setVsPreview(dataUrl);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.options, badgeLabel]);

  useEffect(() => {
    let cancelled = false;
    if (draft.type !== "music") {
      setTrackCards([]);
      return;
    }
    const timer = setTimeout(async () => {
      const cards = await Promise.all(
        draft.options.map((option) =>
          option.image_url ? renderTrackCardPreview(option.image_url, option.label, option.track_artist ?? "", option.track_duration ?? null) : Promise.resolve(null),
        ),
      );
      if (!cancelled) setTrackCards(cards);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft]);

  const trackCardsLoading = draft.type === "music" && draft.options.some((o) => o.image_url) && trackCards.every((c) => c === null);

  const previewData = useMemo(
    () =>
      buildPreviewComponents(draft, {
        mediaUrl: draft.type === "vs" ? vsPreview : null,
        trackCards: draft.type === "music" ? trackCards : undefined,
        trackCardsLoading: draft.type === "music" ? trackCardsLoading : false,
        status: previewClosed ? "closed" : "open",
      }),
    [draft, vsPreview, trackCards, trackCardsLoading, previewClosed],
  );

  const validOptions = useMemo(() => draft.options.filter((o) => o.label.trim()), [draft.options]);
  const canSend = useMemo(() => {
    if (draft.type === "music") {
      return draft.options.every((o) => o.track_url && o.image_url);
    }
    if (validOptions.length < 2) return false;
    if (draft.settings.vote_method === "reactions" && validOptions.length > 10) return false;
    if (draft.type === "vs" && validOptions.some((o) => !o.image_url)) return false;
    return true;
  }, [draft, validOptions]);

  const send = async () => {
    if (!canSend) return;
    if (!channelId) {
      addToast("error", "Select a channel.");
      return;
    }
    setSending(true);
    try {
      const body = {
        channel_id: channelId,
        type: draft.type,
        title: draft.title,
        subtitle: draft.subtitle,
        instructions: draft.settings.instructions,
        options: draft.options.map((o) => ({
          id: o.id,
          label: o.label,
          image_url: o.image_url ?? null,
          emoji: o.emoji ?? null,
          accent: o.accent ?? null,
          track_url: o.track_url ?? null,
          track_artist: o.track_artist ?? null,
        })),
        settings: {
          ...draft.settings,
          ends_at: draft.settings.ends_at ? new Date(draft.settings.ends_at).toISOString() : null,
        },
      };
      const res = await fetch(`/api/backend/polls/${guildId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create poll");
      const poll = json?.poll;
      const link = poll?.message_id
        ? `https://discord.com/channels/${guildId}/${poll.channel_id}/${poll.message_id}`
        : null;
      addToast("success", link ? "Poll created." : "Poll created.");
      if (link) addToast("info", link);
    } catch (error: any) {
      addToast("error", error.message ?? "Failed to create poll");
    } finally {
      setSending(false);
    }
  };

  const devSend = async () => {
    if (!devChannelId.trim()) {
      addToast("error", "Paste a channel ID first.");
      return;
    }
    setDevSending(true);
    try {
      const res = await fetch(`/api/backend/polls/dev/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: devChannelId.trim(), draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as any)?.error ?? "Failed to send dev poll");
      const poll = (data as any).poll;
      const link = poll?.message_id ? `https://discord.com/channels/${poll.guild_id}/${poll.channel_id}/${poll.message_id}` : null;
      addToast("success", link ? `Sent to channel: ${link}` : "Dev poll sent.");
      if (link) addToast("info", link);
    } catch (error: any) {
      addToast("error", error.message ?? "Failed to send dev poll");
    } finally {
      setDevSending(false);
    }
  };

  const readyLabel = canSend ? "Ready to send" : "Not ready yet";

  return (
    <div className="grid grid-cols-1 items-start gap-5 md:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
      <div className="flex min-w-0 flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">New poll</h2>
            <p className="text-sm text-muted-foreground">
              {readyLabel} — the preview matches what lands in Discord.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={canSend ? "default" : "secondary"}>{readyLabel}</Badge>
            <Button onClick={() => void send()} disabled={!canSend || sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : "Send poll"}
            </Button>
          </div>
        </div>
        {process.env.NODE_ENV !== "production" && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dev — send without login</CardTitle>
              <CardDescription>Paste a channel ID to post this draft straight to Discord.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={devChannelId}
                  onChange={(e) => setDevChannelId(e.currentTarget.value)}
                  placeholder="Channel ID"
                  className="min-w-0 flex-1"
                  inputMode="numeric"
                />
                <Button onClick={() => void devSend()} disabled={devSending} size="sm" className="shrink-0">
                  {devSending ? "Sending…" : "Send to channel"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Setup</CardTitle>
            <CardDescription>Type, channel, and the question members see.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Tabs
                  value={draft.type}
                  onValueChange={(value) => selectType(value as PollDraft["type"])}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    {(Object.keys(POLL_TYPE_META) as PollDraft["type"][]).map((type) => (
                      <TabsTrigger key={type} value={type} className="gap-2">
                        {type === "music" ? (
                          <Music4 className="h-4 w-4" />
                        ) : (
                          <Swords className="h-4 w-4" />
                        )}
                        {POLL_TYPE_META[type].label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poll-channel">Channel</Label>
                <Select value={channelId} onValueChange={(value) => setChannelId(value)}>
                  <SelectTrigger id="poll-channel">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {textChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {draft.type !== "music" && (
              <div className="space-y-1.5">
                <Label htmlFor="poll-title">Question</Label>
                <Textarea
                  id="poll-title"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.currentTarget.value }))}
                  maxLength={150}
                  rows={2}
                  placeholder="Which one wins?"
                />
                <FieldHint>Optional — Discord posts omit it when empty.</FieldHint>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {draft.type === "music" ? "Track" : `Options (${draft.options.length})`}
            </CardTitle>
            <CardDescription>
              {draft.type === "music"
                ? "Paste a track link, then fetch it before sending."
                : draft.type === "vs"
                  ? "Versus polls need at least two labelled options with images."
                  : "Voters see these choices as buttons or reactions."}
            </CardDescription>
          </CardHeader>
          <CardContent>
          <div className="flex flex-col gap-2">
            {draft.options.map((option, index) => {
              return (
                  <div
                    key={option.id}
                    className="rounded-lg border border-border/60 bg-card p-2.5"
                  >
                    {draft.type === "music" ? (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-secondary-foreground">
                            {index + 1}
                          </span>
                          <Input
                            value={option.track_url ?? ""}
                            onChange={(e) => updateOption(option.id, { track_url: e.currentTarget.value || null })}
                            onBlur={(e) => { if (e.currentTarget.value.trim()) void fetchTrack(option.id, e.currentTarget.value); }}
                            onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) void fetchTrack(option.id, e.currentTarget.value); }}
                            maxLength={2000}
                            placeholder="Paste Spotify / YouTube track link"
                            inputMode="url"
                            className="min-w-0 flex-1"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => option.track_url && void fetchTrack(option.id, option.track_url)}
                            disabled={uploading === option.id || !option.track_url}
                            className="shrink-0"
                            aria-label="Fetch track"
                            title="Fetch track"
                          >
                            {uploading === option.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {option.image_url ? (
                          <div className="mt-2 flex items-center gap-2">
                            <img
                              src={option.image_url}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-md bg-muted object-cover"
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm font-semibold">
                                {option.label || "Untitled track"}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {option.track_artist || "Spotify"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <FieldHint>Paste a link above and it will load the cover automatically.</FieldHint>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-secondary-foreground">
                            {index + 1}
                          </span>
                          <Input
                            value={option.label}
                            onChange={(e) => updateOption(option.id, { label: e.currentTarget.value })}
                            maxLength={80}
                            placeholder="Option label"
                            className="min-w-0 flex-1"
                          />
                          <div className="flex shrink-0 items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveOption(index, -1)}
                              disabled={index === 0}
                              aria-label={`Move option ${index + 1} up`}
                              className="h-9 w-9 sm:h-10 sm:w-10"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveOption(index, 1)}
                              disabled={index === draft.options.length - 1}
                              aria-label={`Move option ${index + 1} down`}
                              className="h-9 w-9 sm:h-10 sm:w-10"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOption(option.id)}
                              disabled={draft.options.length <= 2}
                              aria-label={`Remove option ${index + 1}`}
                              className="h-9 w-9 sm:h-10 sm:w-10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {draft.type === "vs" ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              type="url"
                              value={option.image_url ?? ""}
                              onChange={(e) => updateOption(option.id, { image_url: e.currentTarget.value || null })}
                              placeholder="Image URL"
                              inputMode="url"
                              className="min-w-0 flex-1"
                            />
                            <input
                              ref={(el) => { fileRefs.current[option.id] = el; }}
                              type="file"
                              hidden
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.currentTarget.files?.[0];
                                if (file) void uploadImage(option.id, file);
                                e.currentTarget.value = "";
                              }}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={uploading === option.id}
                              onClick={() => fileRefs.current[option.id]?.click()}
                              className="shrink-0 gap-1.5"
                            >
                              {uploading === option.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              {uploading === option.id ? "Uploading" : "Upload"}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
            })}
            {draft.type !== "music" && (
              <Button
                type="button"
                variant="outline"
                onClick={addOption}
                disabled={draft.options.length >= 20}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add option
              </Button>
            )}
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Configure</CardTitle>
            <CardDescription>Voting rules, card label, and close timer.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="poll-vote-method">Vote method</Label>
                <Select value={draft.settings.vote_method} onValueChange={(value: VoteMethod) => updateSettings({ vote_method: value })}>
                  <SelectTrigger id="poll-vote-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buttons">Buttons</SelectItem>
                    <SelectItem value="reactions">Reactions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poll-show-results">Results</Label>
                <Select value={draft.settings.show_results} onValueChange={(value: ShowResults) => updateSettings({ show_results: value })}>
                  <SelectTrigger id="poll-show-results">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="after_vote">After vote</SelectItem>
                    <SelectItem value="always">Always</SelectItem>
                    <SelectItem value="closed">When closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poll-ends">Ends</Label>
                <Select
                  value={endsValueFor(draft.settings.ends_at)}
                  onValueChange={(value) => {
                    const preset = ENDS_PRESETS.find((p) => p.value === value);
                    if (!preset || value === "custom") return;
                    if (preset.ms == null) {
                      updateSettings({ ends_at: null });
                    } else {
                      setEndsIn(preset.ms);
                    }
                  }}
                >
                  <SelectTrigger id="poll-ends">
                    <SelectValue placeholder="Select duration">
                      {endsValueFor(draft.settings.ends_at) === "custom" && draft.settings.ends_at
                        ? endsCustomLabel(draft.settings.ends_at)
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ENDS_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {endsValueFor(draft.settings.ends_at) === "custom" ? (
              <div className="space-y-1.5">
                <Label htmlFor="poll-ends-at">Exact end time</Label>
                <Input
                  id="poll-ends-at"
                  type="datetime-local"
                  value={draft.settings.ends_at ? draft.settings.ends_at.slice(0, 16) : ""}
                  onChange={(e) =>
                    updateSettings({
                      ends_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null,
                    })
                  }
                  className="[color-scheme:dark]"
                />
              </div>
            ) : null}
            {endsInLabel ? (
              <p className="-mt-2 text-xs text-muted-foreground">Voting closes {endsInLabel}.</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.type === "vs" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="poll-badge">Card center text</Label>
                  <Input
                    id="poll-badge"
                    value={badgeLabel}
                    onChange={(e) => setBadgeLabel(e.currentTarget.value)}
                    maxLength={12}
                    placeholder="VS"
                  />
                </div>
              ) : null}
              {draft.type !== "music" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="poll-instructions">Instructions</Label>
                  <Input
                    id="poll-instructions"
                    value={draft.settings.instructions ?? ""}
                    onChange={(e) => updateSettings({ instructions: e.currentTarget.value })}
                    maxLength={500}
                    placeholder="Optional note above the poll"
                  />
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">Multiple choices</div>
                  <div className="text-xs text-muted-foreground">Vote for more than one option.</div>
                </div>
                <Switch
                  checked={draft.settings.multi_select}
                  onCheckedChange={(multi_select) => updateSettings({ multi_select })}
                  aria-label="Multiple choices"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">Allow changing vote</div>
                  <div className="text-xs text-muted-foreground">Recast while the poll is open.</div>
                </div>
                <Switch
                  checked={draft.settings.allow_change}
                  onCheckedChange={(allow_change) => updateSettings({ allow_change })}
                  aria-label="Allow changing vote"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {!canSend ? (
          <p className="text-sm text-muted-foreground">
            {draft.type === "music"
              ? "Paste a track link and wait for the cover to load."
              : draft.type === "vs"
                ? "Versus polls need at least two labelled options with images."
                : "Add at least two labelled options."}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 xl:sticky xl:top-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview</CardTitle>
            <CardDescription>Exactly what members will see in Discord.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-muted/30 p-2 sm:p-3 [&_img]:max-w-full [&_video]:max-w-full">
              <DiscordPreview message={previewData} isV2 noBg={false} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {previewClosed ? "Showing the closed state." : "Showing the open state."}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewClosed((v) => !v)}
              >
                {previewClosed ? "Preview as open" : "Preview as closed"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {cropTarget ? (
        <CropModal
          dataUrl={cropTarget.dataUrl}
          onConfirm={confirmCrop}
          onCancel={() => setCropTarget(null)}
        />
      ) : null}
    </div>
  );
}

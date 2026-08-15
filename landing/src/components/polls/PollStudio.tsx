import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { twJoin } from "tailwind-merge";

import { CoolIcon } from "@/components/icons/CoolIcon";
import DiscordPreview from "@/components/announcements/preview/DiscordPreview";
import { Button } from "@/components/announcements/Button";
import { ToastContainer, useToasts } from "@/components/announcements/ToastContainer";
import type { GuildChannel } from "@/components/announcements/types";

import type { PollDraft, PollOptionDraft } from "./types";
import {
  POLL_TYPE_META,
  REACTION_EMOJIS,
  createDefaultDraft,
} from "./types";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const targetW = 500;
      const targetH = 500;
      canvas.width = targetW;
      canvas.height = targetH;

      const scale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      const dx = (targetW - sw) / 2;
      const dy = (targetH - sh) / 2;

      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(img, dx, dy, sw, sh);
      setReady(true);
    };
    img.src = dataUrl;
  }, [dataUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-[#141416] rounded-2xl p-6 flex flex-col gap-4 w-[520px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-zinc-300" style={{ fontFamily: "var(--font-ui-label)" }}>
          Crop your image
        </p>
        <div className="rounded-xl overflow-hidden bg-[#09090b] flex items-center justify-center">
          <canvas ref={canvasRef} className="max-w-full" style={{ maxHeight: "50vh" }} />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-[#1a1a1c] px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            style={{ fontFamily: "var(--font-ui-label)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) onConfirm(canvas.toDataURL("image/png"));
            }}
            className="rounded-xl bg-blurple px-4 py-2 text-sm text-white transition cursor-pointer disabled:opacity-40"
            style={{ fontFamily: "var(--font-ui-label)" }}
          >
            Use this
          </button>
        </div>
      </div>
    </div>
  );
}

function makeId(): string {
  return `opt_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[#141416] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3" style={{ fontFamily: "var(--font-ui-label)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full text-left py-2 cursor-pointer"
    >
      <span className="text-sm text-zinc-300" style={{ fontFamily: "var(--font-ui-label)" }}>{label}</span>
      <div
        className={twJoin(
          "relative w-9 h-5 rounded-full transition-colors shrink-0",
          checked ? "bg-[#23a55a]" : "bg-zinc-700",
        )}
      >
        <div
          className={twJoin(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-[16px]" : "translate-x-0.5",
          )}
        />
      </div>
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 bg-[#1a1a1c] rounded-xl p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={twJoin(
            "flex-1 rounded-lg px-3 py-1.5 text-sm transition cursor-pointer",
            value === option.value ? "bg-blurple text-white" : "text-zinc-500 hover:text-zinc-300",
          )}
          style={{ fontFamily: "var(--font-ui-label)" }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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
    if (!draft.title.trim() || validOptions.length < 2) return false;
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex justify-end">
          <Button discordstyle={5} onClick={() => void send()} disabled={!canSend || sending} className="h-10 shrink-0" style={{ fontFamily: "var(--font-ui-label)" }}>
            {sending ? "Sending…" : "Send poll"}
          </Button>
        </div>
        {process.env.NODE_ENV !== "production" && (
          <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-amber-400/80">Dev — send without login</div>
            <div className="flex gap-2">
              <input
                value={devChannelId}
                onChange={(e) => setDevChannelId(e.currentTarget.value)}
                placeholder="Channel ID"
                className="flex-1 min-w-0 rounded-lg bg-[#222224] px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <Button discordstyle={5} onClick={() => void devSend()} disabled={devSending} className="h-9 shrink-0" style={{ fontFamily: "var(--font-ui-label)" }}>
                {devSending ? "Sending…" : "Send to channel"}
              </Button>
            </div>
          </div>
        )}
        {/* 1. Type */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(POLL_TYPE_META) as PollDraft["type"][]).map((type) => {
            const meta = POLL_TYPE_META[type];
            const active = draft.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className={twJoin(
                  "rounded-2xl px-3 py-3 text-center transition cursor-pointer",
                  active ? "bg-blurple" : "bg-[#1a1a1c] hover:bg-[#222224]",
                )}
              >
                <span className={twJoin("text-base mr-1.5", active ? "" : "grayscale")}>{meta.emoji}</span>
                <span className={twJoin("text-sm font-semibold", active ? "text-white" : "text-zinc-300")} style={{ fontFamily: "var(--font-ui-label)" }}>{meta.label}</span>
                <p className={twJoin("text-[10px] uppercase tracking-wider mt-0.5", active ? "text-white/60" : "text-zinc-600")}>{meta.tag}</p>
              </button>
            );
          })}
        </div>

        {/* 2. Channel */}
        <Section title="Post to">
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.currentTarget.value)}
            className="w-full rounded-xl bg-[#1a1a1c] px-4 py-2.5 text-sm text-zinc-100 outline-none [color-scheme:dark]"
          >
            {textChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </Section>

        {/* 3. Question */}
        {draft.type !== "music" && (
          <Section title="Question">
            <textarea
              value={draft.title}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((prev) => ({ ...prev, title: value }));
              }}
              maxLength={150}
              rows={2}
              placeholder="Ask your question…  (Shift+Enter for a new line)"
              className="w-full resize-none rounded-xl bg-[#1a1a1c] px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 leading-relaxed"
            />
          </Section>
        )}

        {/* 4. Options */}
        <Section title={draft.type === "music" ? "Track" : `Options (${draft.options.length})`}>
          <div className="flex flex-col gap-2">
            {draft.options.map((option, index) => {
              const showImage = draft.type === "vs";
                return (
                  <div
                    key={option.id}
                    className="rounded-xl bg-[#1a1a1c] p-3"
                  >
                    {draft.type === "music" ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#28282c] text-[11px] font-bold text-zinc-400 shrink-0">
                            {index + 1}
                          </span>
                          <input
                            value={option.track_url ?? ""}
                            onChange={(e) => updateOption(option.id, { track_url: e.currentTarget.value || null })}
                            onBlur={(e) => { if (e.currentTarget.value.trim()) void fetchTrack(option.id, e.currentTarget.value); }}
                            onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) void fetchTrack(option.id, e.currentTarget.value); }}
                            maxLength={2000}
                            placeholder="Paste Spotify / YouTube track link"
                            className="flex-1 min-w-0 rounded-lg bg-[#222224] px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                          />
                          <button
                            type="button"
                            onClick={() => option.track_url && void fetchTrack(option.id, option.track_url)}
                            disabled={uploading === option.id || !option.track_url}
                            className="flex items-center gap-1 rounded-lg bg-[#28282c] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer disabled:opacity-40 shrink-0"
                          >
                            {uploading === option.id ? (
                              <span className="animate-spin h-3.5 w-3.5 border-2 border-zinc-500 border-t-transparent rounded-full" />
                            ) : (
                              <CoolIcon icon="Search" className="h-3.5 w-3.5" />
                            )}
                            Fetch
                          </button>
                        </div>
                        {option.image_url ? (
                          <div className="flex items-center gap-2 mt-2">
                            <img
                              src={option.image_url}
                              alt=""
                              className="h-12 w-12 rounded-lg object-cover bg-[#09090b] shrink-0"
                            />
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span className="text-sm font-semibold text-zinc-100 truncate">
                                {option.label || "Untitled track"}
                              </span>
                              <span className="text-xs text-zinc-500 truncate">
                                {option.track_artist || "Spotify"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-zinc-600">Paste a link above and it will load the cover automatically.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#28282c] text-[11px] font-bold text-zinc-400 shrink-0">
                            {index + 1}
                          </span>
                          <input
                            value={option.label}
                            onChange={(e) => updateOption(option.id, { label: e.currentTarget.value })}
                            maxLength={80}
                            placeholder="Option label"
                            className="flex-1 min-w-0 rounded-lg bg-[#222224] px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                          />
                          <button
                            type="button"
                            onClick={() => moveOption(index, -1)}
                            disabled={index === 0}
                            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 p-1 cursor-pointer"
                          >
                            <CoolIcon icon="Arrow_Up_MD" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveOption(index, 1)}
                            disabled={index === draft.options.length - 1}
                            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 p-1 cursor-pointer"
                          >
                            <CoolIcon icon="Arrow_Down_MD" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOption(option.id)}
                            className="text-zinc-600 hover:text-zinc-300 p-1 cursor-pointer"
                          >
                            <CoolIcon icon="Close_MD" className="h-4 w-4" />
                          </button>
                        </div>

                        {showImage ? (
                          <div className="flex gap-2 items-center mt-2">
                            <input
                              type="url"
                              value={option.image_url ?? ""}
                              onChange={(e) => updateOption(option.id, { image_url: e.currentTarget.value || null })}
                              placeholder="Image URL"
                              className="flex-1 min-w-0 rounded-lg bg-[#222224] px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
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
                            <button
                              type="button"
                              disabled={uploading === option.id}
                              onClick={() => fileRefs.current[option.id]?.click()}
                              className="flex items-center gap-1 rounded-lg bg-[#28282c] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer disabled:opacity-40 shrink-0"
                            >
                              {uploading === option.id ? (
                                <span className="animate-spin h-3.5 w-3.5 border-2 border-zinc-500 border-t-transparent rounded-full" />
                              ) : (
                                <CoolIcon icon="File_Upload" className="h-3.5 w-3.5" />
                              )}
                              {uploading === option.id ? "Uploading" : "Upload"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
            })}
            {draft.type !== "music" && (
              <button
                type="button"
                onClick={addOption}
                disabled={draft.options.length >= 20}
                className="flex items-center justify-center gap-1 rounded-xl bg-[#1a1a1c] py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-[#222224] transition cursor-pointer disabled:opacity-30"
                style={{ fontFamily: "var(--font-ui-label)" }}
              >
                <CoolIcon icon="Add_Plus" className="h-4 w-4" />
                Add option
              </button>
            )}
          </div>
        </Section>

        {/* 5. Card appearance */}
        {(draft.type === "vs") && (
          <Section title="Card">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 shrink-0" style={{ fontFamily: "var(--font-ui-label)" }}>Center text</span>
              <input
                value={badgeLabel}
                onChange={(e) => setBadgeLabel(e.currentTarget.value)}
                maxLength={12}
                placeholder="VS"
                className="flex-1 rounded-lg bg-[#1a1a1c] px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>
          </Section>
        )}

        {/* 6. Settings */}
        <Section title="Settings">
          <div className="flex flex-col gap-3">
            <Segmented
              value={draft.settings.vote_method}
              onChange={(vote_method) => updateSettings({ vote_method })}
              options={[
                { value: "buttons", label: "Buttons" },
                { value: "reactions", label: "Reactions" },
              ]}
            />
            <Segmented
              value={draft.settings.show_results}
              onChange={(show_results) => updateSettings({ show_results })}
              options={[
                { value: "after_vote", label: "After vote" },
                { value: "always", label: "Always" },
                { value: "closed", label: "When closed" },
              ]}
            />
            <div className="h-px bg-[#28282c] my-0.5" />
            <Toggle
              checked={draft.settings.multi_select}
              onChange={(multi_select) => updateSettings({ multi_select })}
              label="Multiple choices"
            />
            <Toggle
              checked={draft.settings.allow_change}
              onChange={(allow_change) => updateSettings({ allow_change })}
              label="Allow changing vote"
            />
            {draft.type !== "music" && (
              <input
                value={draft.settings.instructions ?? ""}
                onChange={(e) => updateSettings({ instructions: e.currentTarget.value })}
                maxLength={500}
                placeholder="Instructions (optional)"
                className="rounded-xl bg-[#1a1a1c] px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            )}
            <label className="text-xs text-zinc-500">
              Ends at
              <input
                type="datetime-local"
                value={draft.settings.ends_at ? draft.settings.ends_at.slice(0, 16) : ""}
                onChange={(e) =>
                  updateSettings({
                    ends_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null,
                  })
                }
                className="mt-1.5 w-full rounded-xl bg-[#1a1a1c] px-4 py-2.5 text-sm text-zinc-100 outline-none [color-scheme:dark]"
              />
            </label>
          </div>
        </Section>

        {!canSend ? (
          <p className="-mt-1 text-xs text-zinc-600">
            {draft.type === "music"
              ? "Paste a track link and wait for the cover to load."
              : draft.type === "vs"
                ? "Add a title, labels and images for all options."
                : "Add a title and at least 2 labelled options."}
          </p>
        ) : null}
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-4">
        <div className="rounded-2xl overflow-hidden">
          <DiscordPreview message={previewData} isV2 noBg={false} />
        </div>
        <button
          type="button"
          onClick={() => setPreviewClosed((v) => !v)}
          className={twJoin(
            "mt-2 w-full text-xs rounded-xl px-3 py-2 transition cursor-pointer",
            previewClosed
              ? "text-red-400 bg-[#2a1515]"
              : "text-zinc-500 bg-[#1a1a1c] hover:text-zinc-300",
          )}
        >
          {previewClosed ? "Previewing closed poll" : "Preview as closed"}
        </button>
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

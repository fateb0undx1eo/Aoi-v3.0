import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Copy, Trash2, ChevronDown,
  Send, Save, X, Eye, Check, Bot, Globe, Hash,
  MessageSquare, FileText, Code, RotateCcw, Layers,
  AlertTriangle, Zap, Undo2, Redo2, BookMarked,
  BellOff, Megaphone,
} from "lucide-react";

import type {
  QueryData, QueryDataMessage, QueryDataMessageData,
  GuildChannel, GuildEmoji, DraftFile, FlowActionPayload, FlowAction,
  APIActionRowComponent, APIContainerComponent,
  APIComponentInActionRow, APIV2TextDisplay,
} from "@/components/announcements/types";
import { C, EMBED_BG } from "@/components/announcements/constants";
import { getBackendApiUrl } from "@/lib/backend";
import {
  randomId, createMessage, cloneQueryData,
  isComponentsV2,
} from "@/components/announcements/utils/message";

import CodeGenerator from "@/components/announcements/modals/CodeGenerator";
import ComponentEditModal from "@/components/announcements/modals/ComponentEditModal";
import DiscordPreview from "@/components/announcements/preview/DiscordPreview";
import EmbedEditor from "@/components/announcements/editor/EmbedEditor";
import ComponentEditorForMessage from "@/components/announcements/editor/ComponentEditorForMessage";
import FileAttachmentEditor from "@/components/announcements/editor/FileAttachmentEditor";
import { Section, Toggle, Label, Input, ChannelTag, EmbedRow, AddButton } from "@/components/announcements/editor/ui";

type Toast = { id: string; state: "idle" | "success" | "error" | "info" | "sending"; text: string };

// ─── Palette extensions ───────────────────────────────────────────────────────
// We extend C with some richer accent colours used in the new toolbar.
const ACCENT = {
  reset:  "#e05252",   // warm red   – destructive / reset
  undo:   "#5b8dee",   // periwinkle – temporal back
  redo:   "#52b26e",   // sage green – temporal forward
  presets:"#c084fc",   // soft violet – save / library
  send:   "#f59e0b",   // amber       – primary action (moved to toolbar)
  code:   "#38bdf8",   // sky blue    – code/export
};

// ─── ToolbarButton ─────────────────────────────────────────────────────────────
function ToolbarButton({
  icon, tooltip, onClick, color, pulse,
}: {
  icon: ReactNode; tooltip: string; onClick: () => void; color?: string; pulse?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8,
          border: `1px solid ${hovered ? (color || C.burg) + "99" : (color || C.burg) + "44"}`,
          backgroundColor: hovered ? (color || C.burg) + "28" : (color || C.burg) + "10",
          color: hovered ? (color || C.burg) : (color || C.burg) + "cc",
          cursor: "pointer",
          transition: "all 0.15s",
          boxShadow: hovered ? `0 0 8px ${(color || C.burg)}55` : "none",
          outline: "none",
          position: "relative",
        }}
      >
        {icon}
        {pulse && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            width: 5, height: 5, borderRadius: "50%",
            backgroundColor: color || C.burg,
            boxShadow: `0 0 4px ${color || C.burg}`,
          }} />
        )}
      </button>
      {hovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          padding: "4px 10px", borderRadius: 6,
          backgroundColor: "#18181b", color: C.text,
          fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          border: `1px solid ${C.border}`,
          zIndex: 200, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

// ─── ToastContainer ────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
    }}>
      {toasts.map((toast) => {
        const colors: Record<string, { bg: string; text: string }> = {
          success: { bg: "rgba(5,150,105,0.15)", text: "#34d399" },
          error:   { bg: "rgba(239,68,68,0.15)",  text: "#f87171" },
          info:    { bg: "rgba(14,165,233,0.15)",  text: "#38bdf8" },
          sending: { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24" },
        };
        const c = colors[toast.state] || colors.info!;
        return (
          <div key={toast.id} style={{
            pointerEvents: "auto",
            animation: "slideUp 0.3s ease-out",
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 20px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: c.bg, color: c.text,
            fontSize: 14, fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}>
            {toast.state === "error"   && <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.state === "success" && <Check         style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.state === "sending" && <Zap           style={{ width: 16, height: 16, flexShrink: 0 }} />}
            <span>{toast.text}</span>
            <button type="button" onClick={() => onDismiss(toast.id)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer" }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── SendModal ─────────────────────────────────────────────────────────────────
function SendModal({
  open, channels, selectedChannelIds, onToggleChannel, onSelectAll, onDeselectAll,
  sendAsBot, editMode, webhookUrl, messageLink, suppressMentions,
  onSendAsBotChange, onEditModeChange, onWebhookUrlChange, onMessageLinkChange,
  onSuppressMentionsChange,
  onSend, onClose,
}: {
  open: boolean; channels: GuildChannel[]; selectedChannelIds: Set<string>;
  onToggleChannel: (id: string) => void; onSelectAll: () => void; onDeselectAll: () => void;
  sendAsBot: boolean; editMode: boolean; webhookUrl: string; messageLink: string;
  suppressMentions: boolean;
  onSendAsBotChange: (v: boolean) => void; onEditModeChange: (v: boolean) => void;
  onWebhookUrlChange: (v: string) => void; onMessageLinkChange: (v: string) => void;
  onSuppressMentionsChange: (v: boolean) => void;
  onSend: () => void; onClose: () => void;
}) {
  if (!open) return null;
  const canSend = sendAsBot ? selectedChannelIds.size > 0 : webhookUrl.trim().length > 0;
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: C.surface, borderRadius: 18,
          border: `1px solid ${C.border}`, padding: 26,
          width: 440, maxWidth: "92vw",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.burg}, #a3153f)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Megaphone style={{ width: 16, height: 16, color: "#fff" }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>
              Send Announcement
            </h2>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Send Method */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Send Method
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { val: true,  label: "Bot",     Icon: Bot    },
              { val: false, label: "Webhook", Icon: Globe  },
            ].map(({ val, label, Icon }) => {
              const active = sendAsBot === val;
              return (
                <button key={label} type="button" onClick={() => onSendAsBotChange(val)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 7, padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${active ? C.burg : C.border}`,
                    backgroundColor: active ? `${C.burg}18` : "transparent",
                    color: active ? C.burg : C.textMuted,
                    cursor: "pointer", fontSize: 13, fontWeight: 600,
                    transition: "all 0.15s",
                  }}>
                  <Icon style={{ width: 14, height: 14 }} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit existing toggle */}
        <ModalToggle
          label="Edit existing message"
          checked={editMode}
          onChange={onEditModeChange}
        />

        {/* Suppress mentions toggle */}
        <ModalToggle
          label="Don't mention anyone"
          description="Silences @here, @everyone and role pings"
          checked={suppressMentions}
          onChange={onSuppressMentionsChange}
          icon={<BellOff style={{ width: 13, height: 13 }} />}
        />

        {/* Message Link */}
        {editMode && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Message Link
            </label>
            <input
              value={messageLink}
              onChange={(e) => onMessageLinkChange(e.target.value)}
              placeholder="https://discord.com/channels/…"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${C.border}`, backgroundColor: C.bg,
                color: C.text, fontSize: 13, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Bot: channel picker */}
        {sendAsBot && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Channels ({selectedChannelIds.size})
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={onSelectAll}  style={{ fontSize: 10, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>All</button>
                <button type="button" onClick={onDeselectAll} style={{ fontSize: 10, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>None</button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              {channels.length === 0
                ? <p style={{ fontSize: 11, color: C.textMuted }}>No text channels available.</p>
                : channels.map((ch) => {
                  const sel = selectedChannelIds.has(ch.id);
                  return (
                    <button key={ch.id} type="button" onClick={() => onToggleChannel(ch.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", borderRadius: 6,
                        fontSize: 11, fontWeight: 500,
                        border: `1px solid ${sel ? `${C.burg}60` : C.border}`,
                        backgroundColor: sel ? `${C.burg}15` : "transparent",
                        color: sel ? C.burg : C.textMuted,
                        cursor: "pointer", transition: "all 0.12s",
                      }}>
                      {sel && <Check style={{ width: 10, height: 10 }} />}# {ch.name}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Webhook URL */}
        {!sendAsBot && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Webhook URL
            </label>
            <input
              value={webhookUrl}
              onChange={(e) => onWebhookUrlChange(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${C.border}`, backgroundColor: C.bg,
                color: C.text, fontSize: 13, outline: "none",
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
              Sends to the webhook's pre-configured channel.
            </p>
          </div>
        )}

        {/* Send button */}
        <button
          type="button" onClick={onSend} disabled={!canSend}
          style={{
            display: "flex", width: "100%", alignItems: "center",
            justifyContent: "center", gap: 8,
            padding: "13px 0", borderRadius: 10,
            fontSize: 14, fontWeight: 700, color: "#fff",
            background: canSend ? `linear-gradient(135deg, ${C.burg}, #a3153f)` : "#3f3f46",
            border: "none", cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.5, transition: "all 0.15s",
            letterSpacing: "0.01em",
          }}>
          <Send style={{ width: 15, height: 15 }} />
          {sendAsBot
            ? `Send to ${selectedChannelIds.size} channel${selectedChannelIds.size !== 1 ? "s" : ""}`
            : "Send via Webhook"}
        </button>
      </div>
    </div>
  );
}

// Small helper for the modal toggles
function ModalToggle({
  label, description, checked, onChange, icon,
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; icon?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <div
          onClick={(e) => { e.preventDefault(); onChange(!checked); }}
          style={{
            width: 34, height: 20, borderRadius: 12, position: "relative", flexShrink: 0,
            backgroundColor: checked ? C.burg : "#3f3f46",
            transition: "background 0.2s", cursor: "pointer", marginTop: 1,
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: "50%", backgroundColor: "#fff",
            position: "absolute", top: 3,
            left: checked ? 17 : 3,
            transition: "left 0.2s",
          }} />
        </div>
        <div>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
            {icon}{label}
          </span>
          {description && (
            <span style={{ fontSize: 11, color: C.textMuted, display: "block", marginTop: 1 }}>
              {description}
            </span>
          )}
        </div>
      </label>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GuildAnnouncementsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [loading,      setLoading]      = useState(true);
  const [guild,        setGuild]        = useState<Record<string, any> | null>(null);
  const [modules,      setModules]      = useState<{ name: string; display_name?: string; enabled?: boolean }[]>([]);
  const [channels,     setChannels]     = useState<GuildChannel[]>([]);
  const [serverEmojis, setServerEmojis] = useState<GuildEmoji[]>([]);

  const [data, setData] = useState<QueryData>(() => ({
    version: "d2",
    messages: [{ _id: randomId(), data: {} }],
    targets: [],
  }));
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(0);
  const [messageFiles,         setMessageFiles]         = useState<Record<string, DraftFile[]>>({});
  const [editingComponent,     setEditingComponent]     = useState<APIComponentInActionRow | null>(null);
  const [editingComponentPos,  setEditingComponentPos]  = useState<{ ri: number; ci: number } | null>(null);
  const [componentModalOpen,   setComponentModalOpen]   = useState(false);
  const [selectedChannelIds,   setSelectedChannelIds]   = useState<Set<string>>(new Set());
  const [codeGenOpen,          setCodeGenOpen]          = useState(false);

  const [presets,      setPresets]      = useState<{ id: string; name: string; kind: "draft" | "template"; data: QueryData }[]>([]);
  const [presetName,   setPresetName]   = useState("");
  const [presetsOpen,  setPresetsOpen]  = useState(false);

  const [toasts,         setToasts]         = useState<Toast[]>([]);
  const [sendModalOpen,  setSendModalOpen]  = useState(false);
  const [sendAsBot,      setSendAsBot]      = useState(true);
  const [editMode,       setEditMode]       = useState(false);
  const [webhookUrl,     setWebhookUrl]     = useState("");
  const [messageLink,    setMessageLink]    = useState("");
  // NEW: suppress mentions toggle (lives in modal only)
  const [suppressMentions, setSuppressMentions] = useState(false);

  const [history,    setHistory]    = useState<QueryData[]>([cloneQueryData(data)]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const skipHistoryRef = useRef(false);

  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    setHistory((prev) => {
      const next = prev.slice(0, historyIdx + 1);
      next.push(cloneQueryData(data));
      return next;
    });
    setHistoryIdx((prev) => prev + 1);
  }, [data]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRefs   = useRef<Record<number, HTMLDivElement | null>>({});

  const message = data.messages[selectedMessageIndex];
  const isV2    = isComponentsV2(message?.data.flags);

  const addToast = useCallback((state: Toast["state"], text: string) => {
    const id = nanoid(6);
    setToasts((prev) => [...prev, { id, state, text }]);
    if (state !== "sending") {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!guildId || typeof guildId !== "string") return;
    (async () => {
      try {
        const [ovRes, chRes, emRes] = await Promise.all([
          fetch(`/api/backend/dashboard/guild/${guildId}/overview`),
          fetch(`/api/backend/guilds/${guildId}/channels`),
          fetch(`/api/backend/guilds/${guildId}/emojis`),
        ]);
        if ([ovRes.status, chRes.status, emRes.status].some((s) => s === 401)) {
          router.replace("/api/auth/discord"); return;
        }
        const ov = await ovRes.json();
        const ch = await chRes.json().catch(() => ({ channels: [] }));
        const em = await emRes.json().catch(() => ({ emojis: [] }));
        setGuild(ov.guild);
        setModules(ov.modules || []);
        setChannels(Array.isArray(ch.channels) ? ch.channels.filter((c: GuildChannel) => c.type === 0) : []);
        setServerEmojis(Array.isArray(em.emojis) ? em.emojis : []);
        const announcementsModule = (ov.modules || []).find((m: any) => m.name === "announcements");
        const savedPresets = announcementsModule?.config?.presets;
        if (Array.isArray(savedPresets) && savedPresets.length > 0) {
          setPresets(savedPresets.map((p: any) => ({
            id:   p.id   || `preset-${nanoid()}`,
            name: String(p.name || "").slice(0, 80),
            kind: p.kind === "template" ? "template" as const : "draft" as const,
            data: p.data || { version: "d2", messages: [{ _id: randomId(), data: {} }], targets: [] },
          })));
        }
      } catch { } finally { setLoading(false); }
    })();
  }, [guildId, router]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const setD = useCallback((next: QueryData) => setData(cloneQueryData(next)), []);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    skipHistoryRef.current = true;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    setD(cloneQueryData(history[newIdx]!));
  }, [historyIdx, history, setD]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    skipHistoryRef.current = true;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    setD(cloneQueryData(history[newIdx]!));
  }, [historyIdx, history, setD]);

  const resetAll = useCallback(() => {
    setD({ version: data.version, messages: [{ _id: randomId(), data: {} }], targets: [] });
    setMessageFiles({});
    setSelectedChannelIds(new Set());
    setWebhookUrl("");
    setMessageLink("");
    setEditMode(false);
    setEditEmbedIndex(null);
    setPresetName("");
    setComponentModalOpen(false);
    setEditingComponent(null);
    setEditingComponentPos(null);
    setHistory([cloneQueryData({ version: data.version, messages: [{ _id: randomId(), data: {} }], targets: [] })]);
    setHistoryIdx(0);
    addToast("info", "Reset to empty state.");
  }, [data.version, setD, addToast]);

  const updateMessageData = useCallback((updates: Partial<QueryDataMessageData>) => {
    setD({
      ...data,
      messages: data.messages.map((m, i) =>
        i === selectedMessageIndex ? { ...m, data: { ...m.data, ...updates } } : m,
      ),
    });
  }, [data, selectedMessageIndex, setD]);

  const addMessage = useCallback((isComponentsV2Msg?: boolean) => {
    const flags = isComponentsV2Msg ? (1 << 15) : undefined;
    const msg   = createMessage(flags);
    const next  = [...data.messages, msg];
    setD({ ...data, messages: next });
    setSelectedMessageIndex(next.length - 1);
  }, [data, setD]);

  const removeMessage = useCallback((idx: number) => {
    let next = data.messages.filter((_, i) => i !== idx);
    if (next.length === 0) next = [{ _id: randomId(), data: {} }];
    const newIdx = Math.min(selectedMessageIndex, next.length - 1);
    setSelectedMessageIndex(
      idx === selectedMessageIndex
        ? newIdx
        : selectedMessageIndex > idx ? selectedMessageIndex - 1 : selectedMessageIndex,
    );
    setD({ ...data, messages: next });
  }, [data, selectedMessageIndex, setD]);

  const scrollToMessage = useCallback((idx: number) => {
    const el = msgRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setSelectedMessageIndex(idx);
  }, []);

  const toggleChannel     = useCallback((channelId: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      next.has(channelId) ? next.delete(channelId) : next.add(channelId);
      return next;
    });
  }, []);
  const selectAllChannels  = useCallback(() => setSelectedChannelIds(new Set(channels.map((c) => c.id))), [channels]);
  const deselectAllChannels = useCallback(() => setSelectedChannelIds(new Set()), []);

  const savePreset = useCallback(async (kind: "draft" | "template") => {
    const name = presetName.trim().slice(0, 80);
    if (!name) { addToast("error", "Enter a name before saving."); return; }
    const existingIdx = presets.findIndex((p) => p.kind === kind && p.name.toLowerCase() === name.toLowerCase());
    const next = [...presets];
    const preset = {
      id:   existingIdx >= 0 ? next[existingIdx]!.id : `preset-${nanoid()}`,
      name, kind, data: cloneQueryData(data),
    };
    if (existingIdx >= 0) next[existingIdx]! = preset;
    else next.unshift(preset);
    setPresets(next);
    try {
      const announcementsModule = modules.find((m) => m.name === "announcements");
      await fetch(`/api/backend/modules/${guildId}/announcements`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: announcementsModule?.enabled ?? true,
          config: { presets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) },
        }),
      });
      addToast("success", `${kind === "template" ? "Template" : "Draft"} saved.`);
    } catch { addToast("error", "Failed to save preset."); }
  }, [presetName, presets, data, modules, guildId, addToast]);

  const loadPreset = useCallback((preset: { id: string; name: string; kind: "draft" | "template"; data: QueryData }) => {
    setData(cloneQueryData(preset.data));
    setPresetName(preset.name);
    setSelectedMessageIndex(0);
    addToast("info", `Loaded ${preset.kind} "${preset.name}".`);
  }, [setData, addToast]);

  const deletePreset = useCallback(async (presetId: string) => {
    const next = presets.filter((p) => p.id !== presetId);
    setPresets(next);
    try {
      const announcementsModule = modules.find((m) => m.name === "announcements");
      await fetch(`/api/backend/modules/${guildId}/announcements`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: announcementsModule?.enabled ?? true,
          config: { presets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) },
        }),
      });
      addToast("success", "Preset deleted.");
    } catch { addToast("error", "Failed to delete preset."); }
  }, [presets, modules, guildId, addToast]);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    if (sendAsBot && selectedChannelIds.size === 0) { addToast("error", "Select at least one channel."); return; }
    if (!sendAsBot && !webhookUrl.trim())            { addToast("error", "Enter a webhook URL."); return; }
    if (editMode && !messageLink.trim())             { addToast("error", "Enter the message link to edit."); return; }

    const hasContent = (m: QueryDataMessage) => {
      if (m.data.content) return true;
      if (m.data.embeds?.length) return true;
      if ((messageFiles[m._id || ""] || []).length > 0) return true;
      const comps = m.data.components || [];
      for (const row of comps) {
        if (row.type === 17) {
          const children = (row as APIContainerComponent).components || [];
          for (const child of children) {
            if (child.type === 10 && child.content) return true;
            if (child.type === 9 && child.components?.some((c) => c.type === 10 && (c as APIV2TextDisplay).content)) return true;
            if ((child.type === 11 || child.type === 12 || child.type === 13) && child.items?.some((i: any) => i.media?.url)) return true;
          }
        }
      }
      return false;
    };
    if (!data.messages.some(hasContent)) { addToast("error", "Add content to at least one message."); return; }

    addToast("sending", "Sending announcement…");

    // Build allowed_mentions from suppressMentions flag
    const buildAllowedMentions = (existing: any) => {
      if (suppressMentions) return { parse: [] };
      return existing;
    };

    try {
      const msgData = data.messages[0]?.data;
      const payload = {
        content:          msgData?.content || undefined,
        embeds:           msgData?.embeds?.filter((e) => e.title || e.description || (e.fields && e.fields.length > 0) || e.image?.url || e.thumbnail?.url || e.footer?.text || e.author?.name),
        components:       msgData?.components || undefined,
        flags:            msgData?.flags || undefined,
        allowed_mentions: buildAllowedMentions(msgData?.allowed_mentions),
      };

      if (!sendAsBot && webhookUrl.trim()) {
        const isEdit = editMode && messageLink.trim();
        const url    = isEdit
          ? `${webhookUrl.replace(/\/$/, "")}/messages/${messageLink.split("/").pop()}`
          : webhookUrl;
        const res = await fetch(url, {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Webhook ${isEdit ? "edit" : "send"} failed (${res.status})`);
        addToast("success", "Announcement sent via webhook!");
      } else {
        const body = {
          channel_ids: Array.from(selectedChannelIds),
          entries: data.messages.map((m) => {
            const flows: FlowActionPayload[] = [];
            const cleanComponents = (m.data.components || []).map((row, ri) => {
              if (row.type === 1) {
                const children = (row as APIActionRowComponent).components.map((comp, ci) => {
                  const f = (comp as any)._flows as FlowAction[] | undefined;
                  if (f) f.forEach((a) => flows.push({ ...a, ri, ci }));
                  const { _flows, ...clean } = comp as any;
                  return clean;
                });
                return { type: 1, components: children };
              }
              if (row.type === 17) {
                const children = ((row as any).components || []).map((comp: any, ci: number) => {
                  const f = comp._flows as FlowAction[] | undefined;
                  if (f) f.forEach((a) => flows.push({ ...a, ri, ci }));
                  const { _flows, ...clean } = comp;
                  return clean;
                });
                return { ...row, components: children };
              }
              return row;
            });
            return {
              id:               m._id,
              content:          m.data.content || undefined,
              embeds:           m.data.embeds?.filter((e) => e.title || e.description || (e.fields && e.fields.length > 0) || e.image?.url || e.thumbnail?.url || e.footer?.text || e.author?.name),
              components:       cleanComponents,
              flags:            m.data.flags,
              edit_existing:    editMode && !!messageLink,
              message_link:     editMode ? messageLink : m.reference || undefined,
              thread_name:      m.data.thread_name || undefined,
              allowed_mentions: buildAllowedMentions(m.data.allowed_mentions),
              flows:            flows.length > 0 ? flows : undefined,
            };
          }),
        };

        const hasFiles = data.messages.some((m) => (messageFiles[m._id || ""] || []).length > 0);
        let res: Response;
        if (hasFiles) {
          const fd = new FormData();
          fd.append("payload", JSON.stringify(body));
          data.messages.forEach((m) => {
            const files = messageFiles[m._id || ""] || [];
            const metas = files.map((f) => ({ name: f.name, spoiler: f.spoiler, description: f.description }));
            fd.append(`filemeta_${m._id || "unknown"}`, JSON.stringify(metas));
            files.forEach((f) => { if (f.file) fd.append(`file_${m._id || "unknown"}`, f.file, f.name); });
          });
          res = await fetch(`${getBackendApiUrl()}/api/guilds/${guildId}/announcements`, {
            method: "POST", body: fd, credentials: "include",
          });
        } else {
          res = await fetch(`/api/backend/guilds/${guildId}/announcements`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
        const responseData = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(responseData?.error || "Failed to send");
        addToast("success", "Announcement sent successfully!");
      }
      setSendModalOpen(false);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to send");
    }
  }, [
    guildId, data, selectedChannelIds, messageFiles, addToast,
    sendAsBot, webhookUrl, editMode, messageLink, suppressMentions,
  ]);

  // ── Local state ───────────────────────────────────────────────────────────────
  const mid          = message?._id || "";
  const currentFiles = messageFiles[mid] || [];
  const [editEmbedIndex, setEditEmbedIndex] = useState<number | null>(null);
  const msg = message?.data;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout
      guildId={String(guildId || "")}
      guildName={guild?.name || "Guild"}
      heading=""
      modules={modules}
      flush
    >
      <style>{`
        /* ── Slide-up animation ────────────────────────────────────── */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Inter + Syne from Google Fonts ──────────────────────── */
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

        /* ── Left-pane slim scrollbar ─────────────────────────────── */
        .left-scroll::-webkit-scrollbar        { width: 6px; }
        .left-scroll::-webkit-scrollbar-track  { background: #1a1a1a; }
        .left-scroll::-webkit-scrollbar-thumb  {
          background: #555;
          border-radius: 10px;
        }
        .left-scroll::-webkit-scrollbar-thumb:hover {
          background: #777;
        }

        /* ── Preview scrollbar ────────────────────────────────────── */
        .preview-scroll::-webkit-scrollbar        { width: 5px; }
        .preview-scroll::-webkit-scrollbar-track  { background: transparent; }
        .preview-scroll::-webkit-scrollbar-thumb  {
          background: rgba(255,255,255,0.08);
          border-radius: 10px;
        }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <SendModal
        open={sendModalOpen}
        channels={channels}
        selectedChannelIds={selectedChannelIds}
        onToggleChannel={toggleChannel}
        onSelectAll={selectAllChannels}
        onDeselectAll={deselectAllChannels}
        sendAsBot={sendAsBot}
        editMode={editMode}
        webhookUrl={webhookUrl}
        messageLink={messageLink}
        suppressMentions={suppressMentions}
        onSendAsBotChange={setSendAsBot}
        onEditModeChange={setEditMode}
        onWebhookUrlChange={setWebhookUrl}
        onMessageLinkChange={setMessageLink}
        onSuppressMentionsChange={setSuppressMentions}
        onSend={handleSend}
        onClose={() => setSendModalOpen(false)}
      />

      <CodeGenerator messageData={msg || {}} open={codeGenOpen} onClose={() => setCodeGenOpen(false)} />
      <ComponentEditModal
        open={componentModalOpen}
        onClose={() => setComponentModalOpen(false)}
        component={editingComponent}
        onChange={(comp) => {
          if (!editingComponentPos) return;
          const { ri, ci } = editingComponentPos;
          const components = [...(msg?.components || [])];
          if (components[ri]?.type === 1) {
            const row = { ...components[ri], components: [...(components[ri] as APIActionRowComponent).components] };
            row.components[ci] = comp;
            components[ri] = row;
            updateMessageData({ components });
          }
        }}
        serverEmojis={serverEmojis}
      />

      {/* ── Two-panel layout ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "calc(100vh - 120px)" }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div style={{
          width: "45%", display: "flex", flexDirection: "column",
          backgroundColor: C.surface, borderRight: `1px solid ${C.border}`,
          position: "relative",
        }}>

          {/* ── Fixed header (never scrolls) ──────────────────────────────────── */}
          <div style={{
            padding: "10px 14px 8px",
            borderBottom: `1px solid ${C.border}`,
            backgroundColor: C.surface,
            flexShrink: 0,
            zIndex: 10,
          }}>
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>

              {/* Studio wordmark */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Tiny discord-esque diamond icon */}
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: `linear-gradient(135deg, ${C.burg} 0%, #a3153f 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${C.burg}55`,
                }}>
                  <Megaphone style={{ width: 13, height: 13, color: "#fff" }} />
                </div>
                <span style={{
                  fontFamily: "'Syne', 'Inter', system-ui, sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  color: C.text,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}>
                  Announcement{" "}
                  <span style={{
                    background: `linear-gradient(90deg, ${C.burg}, #e05295)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    Studio
                  </span>
                </span>
              </div>

              {/* Toolbar buttons */}
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <ToolbarButton
                  icon={<RotateCcw style={{ width: 13, height: 13 }} />}
                  tooltip="Reset everything"
                  color={ACCENT.reset}
                  onClick={resetAll}
                />
                <ToolbarButton
                  icon={<Undo2 style={{ width: 13, height: 13 }} />}
                  tooltip="Undo"
                  color={ACCENT.undo}
                  onClick={undo}
                />
                <ToolbarButton
                  icon={<Redo2 style={{ width: 13, height: 13 }} />}
                  tooltip="Redo"
                  color={ACCENT.redo}
                  onClick={redo}
                />
                <ToolbarButton
                  icon={<BookMarked style={{ width: 13, height: 13 }} />}
                  tooltip="Presets"
                  color={ACCENT.presets}
                  onClick={() => setPresetsOpen(!presetsOpen)}
                />
                {/* Divider */}
                <div style={{ width: 1, height: 18, backgroundColor: C.border, margin: "0 2px" }} />
                {/* Send — icon-only, same style, amber accent */}
                <ToolbarButton
                  icon={<Send style={{ width: 13, height: 13 }} />}
                  tooltip="Send announcement"
                  color={ACCENT.send}
                  onClick={() => setSendModalOpen(true)}
                  pulse
                />
              </div>
            </div>

            {/* Message navigator — also fixed */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Msg
              </span>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                {data.messages.map((_, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => scrollToMessage(i)}
                    title={`Message ${i + 1}`}
                    style={{
                      width: 22, height: 22, borderRadius: 5,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700,
                      border: `1px solid ${selectedMessageIndex === i ? C.burg : C.border}`,
                      backgroundColor: selectedMessageIndex === i ? `${C.burg}22` : "transparent",
                      color: selectedMessageIndex === i ? C.burg : C.textMuted,
                      cursor: "pointer", transition: "all 0.12s",
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                {/* Add standard */}
                <button
                  type="button"
                  onClick={() => addMessage(false)}
                  title="Add Standard Message"
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px dashed ${C.border}`, backgroundColor: "transparent",
                    color: C.textMuted, cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  <MessageSquare style={{ width: 10, height: 10 }} />
                </button>
                {/* Add V2 */}
                <button
                  type="button"
                  onClick={() => addMessage(true)}
                  title="Add Components V2 Message"
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px dashed ${C.border}`, backgroundColor: "transparent",
                    color: C.textMuted, cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  <Layers style={{ width: 10, height: 10 }} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Scrollable content area ────────────────────────────────────────── */}
          {/* Scrollbar on the RIGHT edge of left panel */}
          <div
            className="left-scroll"
            style={{
              flex: 1,
              overflowY: "scroll",
              overflowX: "hidden",
              padding: "12px 14px",
              // The slim scrollbar appears on the right edge naturally
            }}
          >
            {!msg ? (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "60px 0", textAlign: "center",
              }}>
                <MessageSquare style={{ width: 32, height: 32, color: "#52525b", marginBottom: 10 }} />
                <p style={{ fontSize: 13, color: C.textMuted }}>No messages yet</p>
                <p style={{ fontSize: 11, color: "#52525b" }}>Use the buttons above to add one</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>

                {/* CONTENT */}
                <Section title="Content" badge={`${msg.content?.length || 0}/2000`}>
                  <Input
                    multiline rows={5}
                    value={msg.content || ""}
                    onChange={(v) => updateMessageData({ content: v || undefined })}
                    placeholder="Message content (Discord markdown supported)"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: C.textMuted }}>
                      {msg.content?.length ? `${msg.content.length} chars` : "Empty"}
                    </span>
                    <span style={{
                      fontSize: 9,
                      color: (msg.content?.length || 0) >= 2000
                        ? "#ef4444"
                        : (msg.content?.length || 0) >= 1800 ? "#eab308" : C.textMuted,
                    }}>
                      {msg.content?.length || 0}/2000
                    </span>
                  </div>
                </Section>

                {/* EMBEDS */}
                <Section title="Embeds" badge={`${msg.embeds?.length || 0}/10`}>
                  {(msg.embeds ?? []).length === 0 ? (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                      <p style={{ fontSize: 10, color: C.textMuted }}>No embeds yet</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(msg.embeds ?? []).map((embed, ei) => (
                        <div key={ei}>
                          <EmbedRow
                            title={embed.title || embed.description?.slice(0, 40) || `Embed ${ei + 1}`}
                            onEdit={() => setEditEmbedIndex(editEmbedIndex === ei ? null : ei)}
                            onRemove={() => {
                              const embeds = msg.embeds?.filter((_, i) => i !== ei);
                              updateMessageData({ embeds: embeds?.length ? embeds : undefined });
                            }}
                          />
                          {editEmbedIndex === ei && (
                            <div style={{ padding: "8px 10px" }}>
                              <EmbedEditor
                                embed={embed}
                                embedIndex={ei}
                                maxEmbeds={msg.embeds?.length ?? 0}
                                onChange={(updated) => {
                                  const embeds = [...(msg.embeds ?? [])];
                                  embeds[ei] = updated;
                                  updateMessageData({ embeds });
                                }}
                                onRemove={() => {
                                  const embeds = msg.embeds?.filter((_, i) => i !== ei);
                                  updateMessageData({ embeds: embeds?.length ? embeds : undefined });
                                }}
                                onMoveUp={() => {
                                  if (ei === 0) return;
                                  const embeds = [...(msg.embeds ?? [])];
                                  [embeds[ei], embeds[ei - 1]] = [embeds[ei - 1]!, embeds[ei]!];
                                  updateMessageData({ embeds });
                                }}
                                onMoveDown={() => {
                                  const embeds = [...(msg.embeds ?? [])];
                                  if (ei >= embeds.length - 1) return;
                                  [embeds[ei], embeds[ei + 1]] = [embeds[ei + 1]!, embeds[ei]!];
                                  updateMessageData({ embeds });
                                }}
                                canMoveUp={ei > 0}
                                canMoveDown={ei < (msg.embeds?.length ?? 0) - 1}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <AddButton
                    label={`Add Embed (${msg.embeds?.length ?? 0}/10)`}
                    disabled={(msg.embeds?.length ?? 0) >= 10}
                    onClick={() => {
                      const embeds = [...(msg.embeds ?? [])];
                      embeds.push({});
                      updateMessageData({ embeds });
                      setEditEmbedIndex(embeds.length - 1);
                    }}
                  />
                </Section>

                {/* COMPONENTS */}
                <Section title="Components" badge={msg.components ? `${msg.components.length} rows` : "0 rows"}>
                  <ComponentEditorForMessage
                    components={msg.components ?? []}
                    onChange={(comps) => updateMessageData({ components: comps })}
                    onEditComponent={(comp, ri, ci) => {
                      setEditingComponent(comp);
                      setEditingComponentPos({ ri: ri!, ci: ci! });
                      setComponentModalOpen(true);
                    }}
                    serverEmojis={serverEmojis}
                    isV2={isV2}
                  />
                </Section>

                {/* OPTIONS — file attachments only, no flag toggles */}
                <Section title="Options" defaultOpen={false}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label muted style={{ fontSize: 10, display: "block" }}>File Attachments</Label>
                    <FileAttachmentEditor
                      files={currentFiles}
                      onChange={(f) => setMessageFiles((prev) => ({ ...prev, [mid]: f }))}
                      messageData={msg}
                      updateMessageData={updateMessageData}
                    />
                  </div>
                </Section>

              </div>
            )}
          </div>
          {/* ── No bottom send bar — moved to toolbar ── */}
        </div>

        {/* ── RIGHT PANEL — Preview ──────────────────────────────────────────── */}
        <div style={{
          width: "55%", display: "flex", flexDirection: "column",
          backgroundColor: EMBED_BG, overflow: "hidden",
        }}>
          <div
            className="preview-scroll"
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px" }}
          >
            {data.messages.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "80px 24px", textAlign: "center",
              }}>
                <Eye style={{ width: 48, height: 48, color: "#52525b", marginBottom: 16 }} />
                <p style={{ fontSize: 14, color: "#71717a" }}>No messages yet</p>
                <p style={{ fontSize: 12, color: "#52525b" }}>Add a message to see the preview</p>
              </div>
            ) : data.messages.map((m, i) => {
              const pMid = m._id || String(i);
              return (
                <DiscordPreview
                  key={`preview-${pMid}`}
                  message={m.data}
                  isV2={isComponentsV2(m.data.flags)}
                  targets={data.targets}
                  onEditComponent={(comp, ri, ci) => {
                    setEditingComponent(comp);
                    setEditingComponentPos({ ri: ri!, ci: ci! });
                    setComponentModalOpen(true);
                  }}
                  files={messageFiles[pMid]}
                />
              );
            })}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
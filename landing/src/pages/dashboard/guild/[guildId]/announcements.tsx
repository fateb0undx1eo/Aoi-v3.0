import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import {
  Copy, Trash2, ChevronDown,
  Send, Save, X, Eye, Check, Bot, Globe, Hash,
  MessageSquare, FileText, Code, RotateCcw, Layers,
  AlertTriangle, Zap, Undo2, Redo2, BookMarked,
  BellOff, Megaphone, RefreshCw, CornerUpLeft,
  CornerUpRight, SendHorizonal,
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

type Toast = { id: string; state: "idle" | "success" | "error" | "info" | "sending" | "confirm"; text: string; onConfirm?: () => void; onCancel?: () => void };

// ─── ToolbarButton ─────────────────────────────────────────────────────────────
function ToolbarButton({
  icon, tooltip, onClick,
}: {
  icon: ReactNode; tooltip: string; onClick: () => void;
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
          width: 26, height: 26, borderRadius: 6,
          border: "none",
          backgroundColor: "transparent",
          color: hovered ? C.text : C.textMuted,
          cursor: "pointer",
          transition: "all 0.12s",
          outline: "none",
          transform: hovered ? "translateY(-2px)" : "none",
        }}
      >
        {icon}
      </button>
      {hovered && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: "50%",
          transform: "translateX(-50%)",
          padding: "4px 10px", borderRadius: 6,
          backgroundColor: "#18181b", color: C.text,
          fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          border: `1px solid ${C.border}`,
          zIndex: 200, pointerEvents: "none",
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
            padding: toast.state === "confirm" ? "16px 20px" : "12px 20px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: c.bg, color: c.text,
            fontSize: 14, fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            flexDirection: toast.state === "confirm" ? "column" : "row",
          }}>
            {toast.state === "confirm" ? (
              <>
                <span style={{ marginBottom: 10 }}>{toast.text}</span>
                <div style={{ display: "flex", gap: 8, width: "100%" }}>
                  <button type="button" onClick={() => { toast.onConfirm?.(); onDismiss(toast.id); }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                      backgroundColor: C.burg, color: "#fff", cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                    }}>
                    Confirm
                  </button>
                  <button type="button" onClick={() => { toast.onCancel?.(); onDismiss(toast.id); }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${C.border}`,
                      backgroundColor: "transparent", color: C.textMuted, cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                    }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {toast.state === "error"   && <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />}
                {toast.state === "success" && <Check         style={{ width: 16, height: 16, flexShrink: 0 }} />}
                {toast.state === "sending" && <Zap           style={{ width: 16, height: 16, flexShrink: 0 }} />}
                <span>{toast.text}</span>
                <button type="button" onClick={() => onDismiss(toast.id)}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer" }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </>
            )}
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
  const hasWebhookError = !sendAsBot && webhookUrl.trim().length > 0 && !/^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([\w-]+)\/?$/.test(webhookUrl.trim());
  const canSend = sendAsBot ? selectedChannelIds.size > 0 : (!hasWebhookError && webhookUrl.trim().length > 0);
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
              aria-invalid={hasWebhookError}
              aria-describedby={hasWebhookError ? "webhook-error" : undefined}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${hasWebhookError ? "#ef4444" : C.border}`, backgroundColor: C.bg,
                color: C.text, fontSize: 13, outline: "none",
                boxSizing: "border-box",
              }}
            />
            {hasWebhookError && (
              <p id="webhook-error" style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>
                Invalid Discord webhook URL. Must be https://discord.com/api/webhooks/...
              </p>
            )}
            {!hasWebhookError && (
              <p style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                Sends to the webhook's pre-configured channel.
              </p>
            )}
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
  const [editEmbedIndex, setEditEmbedIndex] = useState<number | null>(null);

  const [history,    setHistory]    = useState<QueryData[]>([cloneQueryData(data)]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const skipHistoryRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef(data);
  const historyIdxRef = useRef(historyIdx);
  latestDataRef.current = data;
  historyIdxRef.current = historyIdx;

  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const hidx = historyIdxRef.current;
      setHistory((prev) => {
        const next = prev.slice(0, hidx + 1);
        next.push(cloneQueryData(latestDataRef.current));
        if (next.length > 50) next.splice(0, next.length - 50);
        return next;
      });
      setHistoryIdx((prev) => prev + 1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [data]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRefs   = useRef<Record<number, HTMLDivElement | null>>({});

  const safeSelectedIndex = Math.min(selectedMessageIndex, Math.max(0, data.messages.length - 1));
  const safeIdxRef = useRef(safeSelectedIndex);
  safeIdxRef.current = safeSelectedIndex;
  const message = data.messages[safeSelectedIndex];
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

  const confirmAction = useCallback((text: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = nanoid(6);
      setToasts((prev) => [...prev, {
        id, state: "confirm", text,
        onConfirm: () => {
          setToasts((prev) => prev.map((t) => t.id === id ? { ...t, state: "success", text: "Done", onConfirm: undefined, onCancel: undefined } : t));
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000);
          resolve(true);
        },
        onCancel: () => {
          setToasts((prev) => prev.map((t) => t.id === id ? { ...t, state: "info", text: "Canceled", onConfirm: undefined, onCancel: undefined } : t));
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000);
          resolve(false);
        },
      }]);
    });
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load guild data";
        addToast("error", msg);
        console.error("Data loading error:", err);
      } finally { setLoading(false); }
    })();
  }, [guildId, router]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const setD = useCallback((next: QueryData) => setData(cloneQueryData(next)), []);

  const flushHistory = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      const hidx = historyIdxRef.current;
      setHistory((prev) => {
        const next = prev.slice(0, hidx + 1);
        next.push(cloneQueryData(latestDataRef.current));
        if (next.length > 50) next.splice(0, next.length - 50);
        return next;
      });
      setHistoryIdx((prev) => prev + 1);
    }
  }, []);

  const undo = useCallback(() => {
    flushHistory();
    if (historyIdx <= 0) return;
    skipHistoryRef.current = true;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    setD(cloneQueryData(history[newIdx]!));
  }, [historyIdx, history, setD, flushHistory]);

  const redo = useCallback(() => {
    flushHistory();
    if (historyIdx >= history.length - 1) return;
    skipHistoryRef.current = true;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    setD(cloneQueryData(history[newIdx]!));
  }, [historyIdx, history, setD, flushHistory]);

  const resetAll = useCallback(async () => {
    const ok = await confirmAction("Reset everything? All messages, files, and history will be cleared.");
    if (!ok) return;
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
  }, [data.version, setD, addToast, confirmAction]);

  const updateMessageData = useCallback((updates: Partial<QueryDataMessageData>) => {
    const idx = Math.min(safeIdxRef.current, data.messages.length - 1);
    setD({
      ...data,
      messages: data.messages.map((m, i) =>
        i === idx ? { ...m, data: { ...m.data, ...updates } } : m,
      ),
    });
  }, [data, setD]);

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

  const duplicateMessage = useCallback((idx: number) => {
    const original = data.messages[idx];
    if (!original) return;
    const clone = cloneQueryData({
      ...data,
      messages: [original],
    }).messages[0]!;
    clone._id = randomId();
    const next = [...data.messages];
    next.splice(idx + 1, 0, clone);
    setD({ ...data, messages: next });
    setSelectedMessageIndex(idx + 1);
  }, [data, setD]);

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save preset";
      addToast("error", msg);
    }
  }, [presetName, presets, data, modules, guildId, addToast]);

  const loadPreset = useCallback((preset: { id: string; name: string; kind: "draft" | "template"; data: QueryData }) => {
    setData(cloneQueryData(preset.data));
    setPresetName(preset.name);
    setSelectedMessageIndex(0);
    addToast("info", `Loaded ${preset.kind} "${preset.name}".`);
  }, [setData, addToast]);

  const deletePreset = useCallback(async (presetId: string) => {
    const target = presets.find((p) => p.id === presetId);
    if (!target) return;
    const ok = await confirmAction(`Delete preset "${target.name}"?`);
    if (!ok) return;
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete preset";
      addToast("error", msg);
    }
  }, [presets, modules, guildId, addToast, confirmAction]);

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
            if (child.type === 11 && child.media?.url) return true;
            if (child.type === 12 && child.items?.some((i) => i.media?.url)) return true;
            if (child.type === 13 && child.file?.url) return true;
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
      if (!sendAsBot && webhookUrl.trim()) {
        const isEdit = editMode && messageLink.trim();
        let sent = 0, failed = 0;
        for (const m of data.messages) {
          const md = m.data;
          const p = {
            content:          md?.content || undefined,
            embeds:           md?.embeds?.filter((e) => e.title || e.description || (e.fields && e.fields.length > 0) || e.image?.url || e.thumbnail?.url || e.footer?.text || e.author?.name),
            components:       md?.components || undefined,
            flags:            md?.flags || undefined,
            allowed_mentions: buildAllowedMentions(md?.allowed_mentions),
          };
          const url = isEdit
            ? `${webhookUrl.replace(/\/$/, "")}/messages/${messageLink.split("/").pop()}`
            : webhookUrl;
          try {
            const res = await fetch(url, {
              method: isEdit ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p),
            });
            if (res.ok) sent++;
            else failed++;
          } catch { failed++; }
          if (data.messages.length > 1) await new Promise((r) => setTimeout(r, 500));
        }
        if (failed === 0) addToast("success", `Sent ${sent} message${sent !== 1 ? "s" : ""} via webhook!`);
        else addToast("error", `Sent ${sent}, failed ${failed} message${failed !== 1 ? "s" : ""}`);
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
  const msg = message?.data;

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            border: `3px solid ${C.border}`,
            borderTopColor: C.burg,
            animation: "spin 0.7s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ fontSize: 14, color: C.textMuted }}>Loading studio...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* ── Slide-up animation ────────────────────────────────────── */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
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
      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "100vh" }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div style={{
          width: "45%", display: "flex", flexDirection: "column",
          backgroundColor: C.surface, borderRight: `1px solid ${C.border}`,
          position: "relative",
        }}>

          {/* ── Fixed header (never scrolls) ──────────────────────────────────── */}
          <div style={{
            padding: "8px 12px 6px",
            borderBottom: `1px solid ${C.border}`,
            backgroundColor: C.surface,
            flexShrink: 0,
            zIndex: 10,
          }}>
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>

              {/* Studio wordmark */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Tiny discord-esque diamond icon */}
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  backgroundColor: C.burg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
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
                    background: `linear-gradient(135deg, ${C.burg} 40%, #b91c4a 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    Studio
                  </span>
                </span>
              </div>

              {/* Toolbar buttons */}
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                <ToolbarButton
                  icon={<RefreshCw style={{ width: 14, height: 14 }} />}
                  tooltip="Reset"
                  onClick={resetAll}
                />
                <ToolbarButton
                  icon={<CornerUpLeft style={{ width: 14, height: 14 }} />}
                  tooltip="Undo"
                  onClick={undo}
                />
                <ToolbarButton
                  icon={<CornerUpRight style={{ width: 14, height: 14 }} />}
                  tooltip="Redo"
                  onClick={redo}
                />
                <ToolbarButton
                  icon={<Save style={{ width: 14, height: 14 }} />}
                  tooltip="Presets"
                  onClick={() => setPresetsOpen(!presetsOpen)}
                />
                <ToolbarButton
                  icon={<SendHorizonal style={{ width: 14, height: 14 }} />}
                  tooltip="Send"
                  onClick={() => setSendModalOpen(true)}
                />
              </div>
            </div>

            {/* ── Message management — Solution 1 ── */}
            <div style={{
              borderTop: `1px solid ${C.border}`,
              padding: "4px 10px",
            }}>
              {/* Top row: label + actions */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>
                  Messages ({data.messages.length})
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 3, alignItems: "center" }}>
                  <button type="button" onClick={() => addMessage(false)} title="Add message"
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "0 7px", height: 20, borderRadius: 999,
                      border: `1px dashed ${C.border}`, backgroundColor: "transparent",
                      color: C.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 600, transition: "all 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.burg; e.currentTarget.style.color = C.burg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
                  >
                    <MessageSquare style={{ width: 10, height: 10 }} /> Add
                  </button>
                  <button type="button" onClick={() => addMessage(true)} title="Add V2"
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "0 7px", height: 20, borderRadius: 999,
                      border: `1px dashed ${C.border}`, backgroundColor: "transparent",
                      color: C.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 600, transition: "all 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.burg; e.currentTarget.style.color = C.burg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
                  >
                    <Layers style={{ width: 10, height: 10 }} /> V2
                  </button>
                  <div style={{ width: 1, height: 14, backgroundColor: C.border, flexShrink: 0 }} />
                  <button type="button" onClick={() => duplicateMessage(safeSelectedIndex)} title="Duplicate"
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "0 7px", height: 20, borderRadius: 999,
                      border: `1px solid ${C.border}`, backgroundColor: "transparent",
                      color: C.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 600, transition: "all 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.textMuted; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}
                  >
                    <Copy style={{ width: 10, height: 10 }} /> Dup
                  </button>
                  {data.messages.length > 1 && (
                    <button type="button" onClick={() => removeMessage(safeSelectedIndex)} title="Delete"
                      style={{
                        display: "flex", alignItems: "center", gap: 3,
                        padding: "0 7px", height: 20, borderRadius: 999,
                        border: "1px solid rgba(220,38,38,0.25)", backgroundColor: "transparent",
                        color: "#ef4444", cursor: "pointer", fontSize: 10, fontWeight: 600, transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <Trash2 style={{ width: 10, height: 10 }} /> Del
                    </button>
                  )}
                </div>
              </div>
              {/* Bottom row: scrollable pill chips */}
              <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
                {data.messages.map((_, i) => {
                  const active = selectedMessageIndex === i;
                  return (
                    <button
                      key={i} type="button"
                      onClick={() => scrollToMessage(i)}
                      title={`Message ${i + 1}`}
                      style={{
                        height: 22, minWidth: 22, borderRadius: 999,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 8px",
                        fontSize: 10, fontWeight: 700, lineHeight: 1,
                        border: `1px solid ${active ? C.burg : C.border}`,
                        backgroundColor: active ? C.burg : "transparent",
                        color: active ? "#fff" : C.textMuted,
                        cursor: "pointer", transition: "all 0.12s",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "#18181b"; e.currentTarget.style.color = C.text; } }}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = C.textMuted; } }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Scrollable content area ────────────────────────────────────────── */}
          <div
            className="left-scroll"
            style={{
              flex: 1,
              overflowY: "scroll",
              overflowX: "hidden",
              padding: "12px 14px",
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
                  key={`preview-${pMid}-${i}-${JSON.stringify(m.data)}`}
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
    </>
  );
}
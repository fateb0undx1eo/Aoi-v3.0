import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import {
  Copy, Trash2, ChevronDown, Plus, Star, Clipboard,
  Send, Save, X, Check, Bot, Globe, Hash,
  MessageSquare, FileText, Code, RotateCcw,
  AlertTriangle, Zap, Undo2, Redo2, BookMarked,
  BellOff, Megaphone, RefreshCw, CornerUpLeft,
  CornerUpRight, SendHorizonal, Smile,
} from "lucide-react";

import type {
  QueryData, QueryDataMessage, QueryDataMessageData,
  GuildChannel, GuildEmoji, APIEmoji, DraftFile, FlowActionPayload, FlowAction,
  APIActionRowComponent, APIContainerComponent,
  APIComponentInActionRow, APIV2TextDisplay,
} from "@/components/announcements/types";
import { C, CDN, EMBED_BG } from "@/components/announcements/constants";
import { getBackendApiUrl } from "@/lib/backend";
import {
  randomId, createMessage, cloneQueryData,
  isComponentsV2, getTotalEmbedLength, embedHasDisplayContent,
} from "@/components/announcements/utils/message";
import { buildDiscordPayload, executeWebhook, updateWebhookMessage, getWebhook, parseMessageLink, WEBHOOK_URL_RE } from "@/components/announcements/utils/discord";

import CodeGenerator from "@/components/announcements/modals/CodeGenerator";
import ComponentEditModal from "@/components/announcements/modals/ComponentEditModal";
import { ImageModal } from "@/components/announcements/modals/ImageModal";
import DiscordPreview, { EmptyPreviewPlaceholder } from "@/components/announcements/preview/DiscordPreview";
import EmbedEditor from "@/components/announcements/editor/EmbedEditor";
import ComponentEditorForMessage from "@/components/announcements/editor/ComponentEditorForMessage";
import V2ChildEditor from "@/components/announcements/editor/V2ChildEditor";
import V2ContainerEditor from "@/components/announcements/editor/V2ContainerEditor";
import FileAttachmentEditor from "@/components/announcements/editor/FileAttachmentEditor";
import EmojiPickerPopover from "@/components/announcements/pickers/EmojiPickerPopover";
import { Section, Toggle, Label, Input, ChannelTag, EmbedRow, AddButton } from "@/components/announcements/editor/ui";
import { getPlacement } from "@/components/announcements/utils/placement";

type Toast = { id: string; state: "idle" | "success" | "error" | "info" | "sending" | "confirm"; text: string; onConfirm?: () => void; onCancel?: () => void };

// ─── AddDropdown ──────────────────────────────────────────────────────────────
function AddDropdown({ isV2, canAddEmbed, canAddRow, onAddEmbed, onAddRow, onAddV2Component }: {
  isV2: boolean; canAddEmbed: boolean; canAddRow: boolean;
  onAddEmbed: () => void; onAddRow: () => void;
  onAddV2Component: (type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open) {
      if (btnRef.current) setPlacement(getPlacement(btnRef.current));
    }
    setOpen(!open);
  };

  const v2Items = [
    { label: "Content", value: "text" },
    { label: "Container", value: "container" },
    { label: "Media Gallery", value: "media" },
    { label: "File", value: "file" },
    { label: "Separator", value: "divider" },
    { label: "Row", value: "row" },
  ];

  const close = () => setOpen(false);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{
          height: 22, padding: "0 8px", borderRadius: 4,
          border: `1px solid ${C.border}`, backgroundColor: "transparent",
          color: C.textMuted, cursor: "pointer",
          fontSize: 9, fontWeight: 600, transition: "all 0.12s",
          display: "flex", alignItems: "center", gap: 3,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.burg; e.currentTarget.style.color = C.burg; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
      >
        + Add <ChevronDown style={{ width: 8, height: 8 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", left: 0, zIndex: 50, marginTop: placement === "below" ? 4 : undefined, marginBottom: placement === "above" ? 4 : undefined,
          bottom: placement === "above" ? "100%" : undefined, top: placement === "below" ? "100%" : undefined,
          minWidth: 140, borderRadius: 6, border: `1px solid ${C.border}`,
          backgroundColor: "#18181b", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          padding: 4,
        }}>
          {!isV2 ? (
            <>
              <DropItem label="Embed" disabled={!canAddEmbed} onClick={() => { onAddEmbed(); close(); }} />
              <DropItem label="Action Row" disabled={!canAddRow} onClick={() => { onAddRow(); close(); }} />
            </>
          ) : v2Items.map((item) => (
            <DropItem key={item.value} label={item.label} onClick={() => { onAddV2Component(item.value); close(); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function DropItem({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  const [h, sH] = useState(false);
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "5px 8px", borderRadius: 4, border: "none",
        backgroundColor: h ? `${C.burg}20` : "transparent",
        color: h ? C.burg : C.textMuted, cursor: disabled ? "default" : "pointer",
        fontSize: 10, fontWeight: 500, transition: "all 0.1s",
        opacity: disabled ? 0.35 : 1,
      }}>
      {label}
    </button>
  );
}

// ─── MessageActionBtn ──────────────────────────────────────────────
function MessageActionBtn({ icon, tooltip, onClick, popover }: {
  icon: ReactNode; tooltip: string; onClick: () => void; popover?: (close: () => void) => ReactNode;
}) {
  const [h, sH] = useState(false);
  if (popover) {
    return <MessageAddBtn icon={icon} tooltip={tooltip} renderPopover={popover} />;
  }
  return (
    <button type="button" onClick={onClick} title={tooltip}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, borderRadius: 6, border: "none",
        backgroundColor: h ? "#1a1a1a" : "transparent",
        color: h ? C.text : "#52525b", cursor: "pointer",
        fontSize: 10, fontWeight: 600, transition: "all 0.12s", flexShrink: 0,
      }}>
      {icon}
    </button>
  );
}

// ─── MessageAddBtn (with popover) ──────────────────────────────────
function MessageAddBtn({ icon, tooltip, renderPopover }: {
  icon: ReactNode; tooltip: string; renderPopover: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const [h, sH] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open) {
      if (btnRef.current) setPlacement(getPlacement(btnRef.current));
    }
    setOpen(!open);
  };

  const close = () => setOpen(false);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button ref={btnRef} type="button" onClick={toggle} title={tooltip}
        onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 6, border: "none",
          backgroundColor: h ? "#1a1a1a" : "transparent",
          color: h ? C.text : "#52525b", cursor: "pointer",
          fontSize: 10, fontWeight: 600, transition: "background-color 0.12s, color 0.12s", flexShrink: 0,
        }}>
        <span style={{
          display: "inline-block",
          transform: open ? "rotate(135deg)" : "rotate(0deg)",
          transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          {icon}
        </span>
      </button>
      <div style={{
        position: "absolute", right: 0, zIndex: 200,
        top: placement === "below" ? "calc(100% + 4px)" : undefined,
        bottom: placement === "above" ? "calc(100% + 4px)" : undefined,
        minWidth: 260, maxWidth: 300,
        borderRadius: 8, border: `1px solid ${C.border}`,
        backgroundColor: C.surface,
        boxShadow: "0 0 0 100vmax rgba(0,0,0,0.55)",
        padding: 4,
        opacity: open ? 1 : 0,
        transform: `translateY(${open ? 0 : placement === "below" ? -4 : 4}px)`,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.15s ease, transform 0.15s ease",
      }}>
        {renderPopover(close)}
      </div>
    </div>
  );
}

// ─── AddContentPopover (for standard message content) ──────────────
function AddContentPopover({
  maxedOut, onAddEmbed, onAddComponent, onAddLink,
}: {
  maxedOut: boolean;
  onAddEmbed: () => void; onAddComponent: () => void; onAddLink?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    if (!open) {
      if (btnRef.current) setPlacement(getPlacement(btnRef.current));
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 16px", borderRadius: 8, border: `1px solid #27272a`,
          backgroundColor: "transparent", color: C.textMuted, cursor: "pointer",
          fontSize: 12, fontWeight: 500,
          transition: "background-color 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#18181b"; e.currentTarget.style.color = C.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = C.textMuted; }}>
        <Plus style={{ width: 13, height: 13 }} /> Add
      </button>
      {open && (
        <div style={{
          position: "absolute", left: "50%", zIndex: 200,
          top: placement === "below" ? "calc(100% + 4px)" : undefined,
          bottom: placement === "above" ? "calc(100% + 4px)" : undefined,
          transform: `translateX(-50%)${placement === "above" ? " translateY(0)" : ""}`,
          minWidth: 160, borderRadius: 8, border: `1px solid #1a1a1a`,
          backgroundColor: "#111111", padding: 4,
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.55)",
        }}>
          <button type="button" disabled={maxedOut} onClick={() => { onAddEmbed(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: maxedOut ? "not-allowed" : "pointer",
              opacity: maxedOut ? 0.4 : 1, fontSize: 12, color: C.text,
            }}
            onMouseEnter={(e) => { if (!maxedOut) e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            Embed
          </button>
          <button type="button" onClick={() => { onAddComponent(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: "pointer",
              fontSize: 12, color: C.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            Button
          </button>
          <button type="button" onClick={() => { onAddLink?.(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", borderRadius: 6, border: "none",
              backgroundColor: "transparent", cursor: "pointer",
              fontSize: 12, color: C.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#18181b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
            Link Button
          </button>
        </div>
      )}
    </div>
  );
}

// ─── AddMessagePopover (for + button) ──────────────────────────────
function AddMessagePopover({ onAddStandard, onAddV2 }: { onAddStandard: () => void; onAddV2: () => void }) {
  return (
    <>
      <button type="button" onClick={onAddStandard}
        style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "8px 10px", borderRadius: 6, border: "none",
          backgroundColor: "transparent", color: C.text, cursor: "pointer",
          fontSize: 11, fontWeight: 600, transition: "all 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${C.burg}20`; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Standard Message
        <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 400, marginTop: 2, lineHeight: 1.4, opacity: 0.65 }}>
          Can display text, then attachments, then embeds. If you aren't sure, choose this.
        </div>
      </button>
      <button type="button" onClick={onAddV2}
        style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "8px 10px", borderRadius: 6, border: "none",
          backgroundColor: "transparent", color: C.text, cursor: "pointer",
          fontSize: 11, fontWeight: 600, transition: "all 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${C.burg}20`; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Components-based Message
        <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 400, marginTop: 2, lineHeight: 1.4, opacity: 0.65 }}>
          Can display text, media, files, and containers (similar to embeds) in any order! This is more customizable than a standard message.
        </div>
      </button>
    </>
  );
}

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
          color: "#fff",
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
  const confirmToast = toasts.find((t) => t.state === "confirm");
  const regularToasts = toasts.filter((t) => t.state !== "confirm");
  return (
    <>
      {confirmToast && (
        <div key={confirmToast.id} onClick={() => { confirmToast.onCancel?.(); onDismiss(confirmToast.id); }} style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.55)",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            animation: "slideUp 0.3s ease-out",
            display: "flex", alignItems: "center", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "#111111", color: "#fff",
            fontSize: 14, fontWeight: 500,
            overflow: "hidden", maxWidth: 420, width: "100%",
          }}>
            <div style={{ width: 4, backgroundColor: "#ef4444", flexShrink: 0, alignSelf: "stretch" }} />
            <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle style={{ width: 18, height: 18, color: "#ef4444", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.4 }}>{confirmToast.text}</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { confirmToast.onConfirm?.(); onDismiss(confirmToast.id); }}
                  style={{
                    padding: "7px 16px", borderRadius: 6, border: "none",
                    backgroundColor: "#ef4444", color: "#fff", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                  }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{
        position: "fixed", bottom: 24, left: 0, right: 0,
        zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
        alignItems: "center",
      }}>
        {regularToasts.map((toast) => {
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

    </>
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
  const hasWebhookError = !sendAsBot && webhookUrl.trim().length > 0 && !WEBHOOK_URL_RE.test(webhookUrl.trim());
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
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
function EmojiBtn({ onEmoji, serverEmojis }: { onEmoji: (text: string) => void; serverEmojis: GuildEmoji[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" onClick={() => setOpen(true)} title="Insert emoji"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: 4, border: "none",
          background: "transparent", color: "#52525b", cursor: "pointer",
          fontSize: 11, padding: 0, lineHeight: 1,
        }}>
        <Smile style={{ width: 13, height: 13 }} />
      </button>
      <EmojiPickerPopover
        open={open}
        onClose={() => setOpen(false)}
        onEmojiSelect={(emoji: APIEmoji) => {
          const text = emoji.name
            ? emoji.id
              ? emoji.animated
                ? `<a:${emoji.name}:${emoji.id}>`
                : `<:${emoji.name}:${emoji.id}>`
              : emoji.name
            : "";
          onEmoji(text);
          setOpen(false);
        }}
        serverEmojis={serverEmojis}
      />
    </div>
  );
}

function AccessoryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
        border: `1px solid ${C.border}`, backgroundColor: "transparent",
        color: C.textMuted, cursor: "pointer", transition: "all 0.12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.textMuted; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}>
      {label}
    </button>
  );
}

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
  const [imageModalData,       setImageModalData]       = useState<import("@/components/announcements/types").ImageModalProps>();

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

  const [starredMessages, setStarredMessages] = useState<Set<string>>(new Set());
  const [starAnimatingOut, setStarAnimatingOut] = useState<Set<string>>(new Set());

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
  const v2ContentRef = useRef<HTMLTextAreaElement>(null);
  const stdContentRef = useRef<HTMLTextAreaElement>(null);

  const safeSelectedIndex = Math.min(selectedMessageIndex, Math.max(0, data.messages.length - 1));
  const safeIdxRef = useRef(safeSelectedIndex);
  safeIdxRef.current = safeSelectedIndex;
  const message = data.messages[safeSelectedIndex];
  const isV2    = isComponentsV2(message?.data.flags);

  const hasAnyContent = useMemo(() => {
    return data.messages.some((m) => {
      if (m.data.content) return true;
      if ((m.data.embeds ?? []).length > 0) return true;
      if ((messageFiles[m._id || ""] || []).length > 0) return true;
      const comps = m.data.components || [];
      return comps.some((row) => {
        if (row.type === 17) {
          const children = (row as APIContainerComponent).components || [];
          return children.some((child) =>
            (child.type === 10 && child.content) ||
            (child.type === 9 && child.components?.some((c) => c.content)) ||
            (child.type === 12 && child.items?.some((i) => i.media?.url)) ||
            (child.type === 13 && child.file?.url)
          );
        }
        return false;
      });
    });
  }, [data, messageFiles]);

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
    const gid = typeof guildId === "string" ? guildId : undefined;
    if (process.env.NODE_ENV === "development") {
      setGuild({ id: gid || "dev", name: "Dev Server", icon: null, owner_id: "1", roles: [] } as any);
      setModules([{ name: "announcements", display_name: "Announcements", enabled: true }]);
      setChannels([{ id: "111", name: "general", type: 0 } as GuildChannel]);
      setServerEmojis([]);
      setLoading(false);
      return;
    }
    if (!gid) return;
    (async () => {
      try {
        const [ovRes, chRes, emRes] = await Promise.all([
          fetch(`/api/backend/dashboard/guild/${gid}/overview`),
          fetch(`/api/backend/guilds/${gid}/channels`),
          fetch(`/api/backend/guilds/${gid}/emojis`),
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

  const [dupAnim, setDupAnim] = useState(false);
  const [codeAnim, setCodeAnim] = useState(false);
  const [delAnim, setDelAnim] = useState(false);

  const triggerAnim = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 500);
  };

  const toggleStar = useCallback((msgId: string) => {
    setStarredMessages((prev) => {
      if (prev.has(msgId)) {
        setStarAnimatingOut((a) => new Set(a).add(msgId));
        setTimeout(() => {
          setStarredMessages((p) => { const n = new Set(p); n.delete(msgId); return n; });
          setStarAnimatingOut((a) => { const n = new Set(a); n.delete(msgId); return n; });
        }, 500);
        return prev;
      }
      return new Set(prev).add(msgId);
    });
  }, []);

  const copyPayload = useCallback(async () => {
    const m = data.messages[safeSelectedIndex];
    if (!m?.data) return;
    const payload = buildDiscordPayload(m.data);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      addToast("success", "Payload copied!");
    } catch {
      addToast("error", "Failed to copy");
    }
  }, [data, safeSelectedIndex, addToast]);

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
            if (child.type === 9 && child.components?.some((c) => c.content)) return true;
            if (child.type === 12 && child.items?.some((i) => i.media?.url)) return true;
            if (child.type === 13 && child.file?.url) return true;
          }
        }
      }
      return false;
    };
    if (!data.messages.some(hasContent)) { addToast("error", "Add content to at least one message."); return; }

    for (const m of data.messages) {
      const emptyEmbeds = (m.data.embeds ?? []).reduce<number[]>((acc, e, i) => {
        if (!embedHasDisplayContent(e)) acc.push(i + 1);
        return acc;
      }, []);
      if (emptyEmbeds.length > 0) {
        addToast("error", `Message embed${emptyEmbeds.length > 1 ? "s" : ""} ${emptyEmbeds.join(", ")} ${emptyEmbeds.length > 1 ? "have" : "has"} no content — add a title, description, or other content.`);
        return;
      }
    }

    addToast("sending", "Sending announcement…");

    // Build allowed_mentions from suppressMentions flag
    const buildAllowedMentions = (existing: any) => {
      if (suppressMentions) return { parse: [] };
      return existing;
    };

    try {
      if (!sendAsBot && webhookUrl.trim()) {
        const match = webhookUrl.trim().match(WEBHOOK_URL_RE);
        if (!match) { addToast("error", "Invalid webhook URL"); return; }
        const [, webhookId, webhookToken] = match;
        const parsedLink = editMode && messageLink.trim() ? parseMessageLink(messageLink.trim()) : null;
        const isEdit = !!parsedLink;
        let sent = 0, failed = 0;
        for (const m of data.messages) {
          const md = m.data;
          const payload = buildDiscordPayload(md);
          payload.allowed_mentions = buildAllowedMentions(md?.allowed_mentions);
          try {
            const files = (messageFiles[m._id || ""] || []).map((f) => f.file).filter(Boolean) as File[];
            const res = isEdit
              ? await updateWebhookMessage(webhookId!, webhookToken!, parsedLink!.messageId ?? "", payload, files.length > 0 ? files : undefined)
              : await executeWebhook(webhookId!, webhookToken!, payload, files.length > 0 ? files : undefined);
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

  // ── Embed attachment upload ──────────────────────────────────────────────────
  const handleAddAttachment = useCallback(async (file: File): Promise<string> => {
    if (process.env.NODE_ENV === "development") {
      return URL.createObjectURL(file);
    }
    const gid = typeof guildId === "string" ? guildId : "";
    if (!gid) throw new Error("No guild ID");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${getBackendApiUrl()}/api/guilds/${gid}/upload`, {
      method: "POST", body: fd, credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || "Upload failed");
    }
    const data = await res.json();
    return data.url;
  }, [guildId]);

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

        @keyframes starPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes starBounce {
          0%   { transform: scale(1); }
          25%  { transform: scale(1.3); }
          50%  { transform: scale(0.9); }
          75%  { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        @keyframes dupFlip {
          0%   { transform: rotateY(0deg); }
          25%  { transform: rotateY(90deg); }
          50%  { transform: rotateY(180deg); }
          75%  { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }

        @keyframes codeCapture {
          0%   { opacity: 1; transform: scale(1); }
          20%  { opacity: 0.3; transform: scale(0.8); }
          40%  { opacity: 1; transform: scale(1.2); }
          70%  { opacity: 0.8; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes trashTip {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(-20deg); }
          50%  { transform: rotate(10deg); }
          75%  { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
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

      <ImageModal {...imageModalData} clear={() => setImageModalData(undefined)} />

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
            padding: "16px 12px 6px",
            borderBottom: `1px solid ${C.border}`,
            backgroundColor: C.surface,
            flexShrink: 0,
            zIndex: 10,
          }}>
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>

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

            </div>

            {/* ── Message management ── */}
            <div style={{
              padding: "4px 10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>
                  Messages ({data.messages.length})
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 2, alignItems: "center" }}>
                  <MessageActionBtn icon={<Plus style={{ width: 11, height: 11 }} />} tooltip="Add message"
                    onClick={() => {}}
                    popover={(close: () => void) =>
                      <AddMessagePopover onAddStandard={() => { addMessage(false); close(); }} onAddV2={() => { addMessage(true); close(); }} />
                    }
                  />
                  <MessageActionBtn icon={<span style={{ display: "inline-block", animation: dupAnim ? "dupFlip 0.9s cubic-bezier(0.22, 1, 0.36, 1)" : "none" }}>
                    <Copy style={{ width: 11, height: 11 }} />
                  </span>} tooltip="Duplicate"
                    onClick={() => { duplicateMessage(safeSelectedIndex); triggerAnim(setDupAnim); }}
                  />
                  <MessageActionBtn icon={<span style={{ display: "inline-block", animation: codeAnim ? "codeCapture 0.5s ease" : "none" }}>
                    <Code style={{ width: 11, height: 11 }} />
                  </span>} tooltip="Copy raw payload"
                    onClick={() => { copyPayload(); triggerAnim(setCodeAnim); }}
                  />
                  <MessageActionBtn icon={<Star key={`ab-star-${starredMessages.has(mid)}`} style={{ width: 11, height: 11, fill: starredMessages.has(mid) ? "#eab308" : "none", color: starredMessages.has(mid) ? "#eab308" : undefined, animation: starredMessages.has(mid) ? "starBounce 0.5s cubic-bezier(0.4, 0, 0.2, 1)" : "none" }} />} tooltip={starredMessages.has(mid) ? "Unstar message" : "Star message"}
                    onClick={() => toggleStar(mid)}
                  />
                  <MessageActionBtn icon={<span style={{ display: "inline-block", animation: delAnim ? "trashTip 0.5s ease" : "none" }}>
                    <Trash2 style={{ width: 11, height: 11 }} />
                  </span>} tooltip="Delete"
                    onClick={() => { removeMessage(safeSelectedIndex); triggerAnim(setDelAnim); }}
                  />
                </div>
              </div>
              {/* Pill chips (scrollable) */}
              <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 2, alignItems: "center" }}>
                {data.messages.map((m, i) => {
                  const mid = m._id || "";
                  const active = selectedMessageIndex === i;
                  const isStarred = starredMessages.has(mid);
                  const isAnimatingOut = starAnimatingOut.has(mid);
                  const showStar = isStarred || isAnimatingOut;
                  return (
                    <button
                      key={mid || i} type="button"
                      onClick={() => scrollToMessage(i)}
                      title={`Message ${i + 1}${showStar ? " ★" : ""}`}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700,
                        border: `1px solid ${active ? C.burg : C.border}`,
                        backgroundColor: active ? C.burg : "transparent",
                        color: active ? "#fff" : C.textMuted,
                        cursor: "pointer", transition: "all 0.12s",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "#18181b"; e.currentTarget.style.color = C.text; } }}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = C.textMuted; } }}
                    >
                      {showStar
                        ? <Star key={`s-${isStarred}-${isAnimatingOut}`} style={{
                            width: 12, height: 12, fill: "#eab308", color: "#eab308",
                            animation: isAnimatingOut
                              ? "starPop 0.5s cubic-bezier(0.4, 0, 0.2, 1) reverse"
                              : "starPop 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                          }} />
                        : (i + 1)}
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
            ) : isV2 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* CONTENT with 4000 char limit */}
                <Section title="MESSAGE" titleStyle={{ color: "#fff", textTransform: "uppercase" }} collapsible={false}>
                  <div style={{ position: "relative" }}>
                    <Input
                      multiline rows={5}
                      value={msg.content || ""}
                      onChange={(v) => updateMessageData({ content: v || undefined })}
                      placeholder=""
                      inputRef={v2ContentRef}
                    />
                    <div style={{
                      position: "absolute", top: 2, right: 6,
                      display: "flex", gap: 2, alignItems: "center",
                    }}>
                      <EmojiBtn serverEmojis={serverEmojis} onEmoji={(text) => {
                        const ta = v2ContentRef.current;
                        if (ta) {
                          const start = ta.selectionStart;
                          const end = ta.selectionEnd;
                          const val = ta.value;
                          const newVal = val.slice(0, start) + text + val.slice(end);
                          updateMessageData({ content: newVal || undefined });
                          requestAnimationFrame(() => {
                            ta.focus();
                            const pos = start + text.length;
                            ta.setSelectionRange(pos, pos);
                          });
                        }
                      }} />
                      <span style={{
                        fontSize: 9, lineHeight: 1, color: "#52525b",
                        pointerEvents: "none", fontVariantNumeric: "tabular-nums",
                      }}>
                        {4000 - (msg.content?.length || 0)}
                      </span>
                    </div>
                  </div>
                  {/* Accessory buttons */}
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <AccessoryBtn label="+ Button" onClick={() => {
                      const comps = [...(msg.components ?? [])];
                      if (comps.length === 0 || (comps[comps.length - 1] as any)?.type !== 1) {
                        comps.push({ type: 1, components: [] });
                      }
                      const row = comps[comps.length - 1] as any;
                      if (row.type === 1) {
                        row.components = [...row.components, { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}`, disabled: false }];
                        updateMessageData({ components: comps });
                      }
                    }} />
                    <AccessoryBtn label="+ Link" onClick={() => {
                      const comps = [...(msg.components ?? [])];
                      if (comps.length === 0 || (comps[comps.length - 1] as any)?.type !== 1) {
                        comps.push({ type: 1, components: [] });
                      }
                      const row = comps[comps.length - 1] as any;
                      if (row.type === 1) {
                        row.components = [...row.components, { type: 2, style: 5, label: "Link", url: "https://", disabled: false }];
                        updateMessageData({ components: comps });
                      }
                    }} />
                  </div>
                </Section>

                {/* V2 COMPONENTS */}
                {(msg.components ?? []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(msg.components ?? []).map((comp, ci) => {
                      if (comp.type === 10 || comp.type === 12 || comp.type === 13 || comp.type === 14 || comp.type === 9) {
                        return (
                          <div key={ci} style={{ position: "relative" }}>
                            <V2ChildEditor
                              child={comp as any}
                              onChange={(updated) => {
                                const comps = [...(msg.components ?? [])];
                                comps[ci] = updated as any;
                                updateMessageData({ components: comps });
                              }}
                              onRemove={() => {
                                const comps = msg.components?.filter((_, i) => i !== ci);
                                updateMessageData({ components: comps?.length ? comps : undefined });
                              }}
                            />
                          </div>
                        );
                      }
                      if (comp.type === 17) {
                        return (
                          <div key={ci} style={{ position: "relative" }}>
                            <V2ContainerEditor
                              container={comp}
                              onContainerChange={(updated) => {
                                const comps = [...(msg.components ?? [])];
                                comps[ci] = updated;
                                updateMessageData({ components: comps });
                              }}
                              onRemove={() => {
                                const comps = msg.components?.filter((_, i) => i !== ci);
                                updateMessageData({ components: comps?.length ? comps : undefined });
                              }}
                            />
                          </div>
                        );
                      }
                      if (comp.type === 1) {
                        return (
                          <div key={ci} style={{ position: "relative", borderRadius: 8, border: `1px solid ${C.border}`, padding: 8, backgroundColor: "#000" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>Row ({ci + 1})</span>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button type="button" onClick={() => {
                                  const comps = [...(msg.components ?? [])];
                                  const row = { ...comp, components: [...comp.components, { type: 2 as const, style: 1 as const, label: "Button", custom_id: `btn_${randomId()}`, disabled: false }] };
                                  comps[ci] = row;
                                  updateMessageData({ components: comps });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>+Btn</button>
                                <button type="button" onClick={() => {
                                  const comps = [...(msg.components ?? [])];
                                  const row = { ...comp, components: [...comp.components, { type: 2 as const, style: 5 as const, label: "Link", url: "https://", disabled: false }] };
                                  comps[ci] = row;
                                  updateMessageData({ components: comps });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>+Link</button>
                                <button type="button" onClick={() => {
                                  const comps = [...(msg.components ?? [])];
                                  const row = { ...comp, components: [...comp.components, { type: 3 as const, custom_id: `select_${randomId()}`, placeholder: "Choose an option", options: [] }] };
                                  comps[ci] = row;
                                  updateMessageData({ components: comps });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>+Select</button>
                                <button type="button" onClick={() => {
                                  const comps = [...(msg.components ?? [])];
                                  const row = { ...comp, components: [...comp.components, { type: 5 as const, custom_id: `um_${randomId()}`, placeholder: "Pick a user" }] };
                                  comps[ci] = row;
                                  updateMessageData({ components: comps });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>+User</button>
                                <button type="button" onClick={() => {
                                  const comps = [...(msg.components ?? [])];
                                  const row = { ...comp, components: [...comp.components, { type: 6 as const, custom_id: `rm_${randomId()}`, placeholder: "Pick a role" }] };
                                  comps[ci] = row;
                                  updateMessageData({ components: comps });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>+Role</button>
                                <button type="button" onClick={() => {
                                  const comps = [...(msg.components ?? [])];
                                  const row = { ...comp, components: [...comp.components, { type: 7 as const, custom_id: `mr_${randomId()}`, placeholder: "Pick a member or role" }] };
                                  comps[ci] = row;
                                  updateMessageData({ components: comps });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>+Mentionable</button>
                                <button type="button" onClick={() => {
                                  const comps = [...(msg.components ?? [])];
                                  const row = { ...comp, components: [...comp.components, { type: 8 as const, custom_id: `cm_${randomId()}`, placeholder: "Pick a channel" }] };
                                  comps[ci] = row;
                                  updateMessageData({ components: comps });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>+Channel</button>
                                <button type="button" onClick={() => {
                                  const comps = msg.components?.filter((_, i) => i !== ci);
                                  updateMessageData({ components: comps?.length ? comps : undefined });
                                }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(220,38,38,0.3)", background: "transparent", color: "#ef4444", cursor: "pointer" }}>Del</button>
                              </div>
                            </div>
                            {comp.components.length === 0 ? (
                              <div style={{ textAlign: "center", padding: "12px 0", fontSize: 10, color: "#52525b" }}>Empty row — add buttons or select menus</div>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {comp.components.map((item, itemIdx) => (
                                  <button key={itemIdx} type="button" onClick={() => {
                                    setEditingComponent(item as any);
                                    setEditingComponentPos({ ri: ci, ci: itemIdx });
                                    setComponentModalOpen(true);
                                  }} style={{ position: "relative", padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#1a1a1a", color: C.text, fontSize: 10, cursor: "pointer" }}>
                                    {item.type === 2 ? <span>{item.label || "Button"} ({item.style === 5 ? "Link" : ["Primary","Secondary","Success","Danger","Link","Premium"][(item.style || 1) - 1] || "?"})</span> : null}
                                    {item.type >= 3 && item.type <= 8 ? <span>{["Select","Select","User Select","Role Select","Mentionable","Channel Select"][item.type - 3] || "Select"}</span> : null}
                                    <span style={{ position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: "50%", backgroundColor: "#ef4444", color: "#fff", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                      onClick={(e) => { e.stopPropagation();
                                        const comps = [...(msg.components ?? [])];
                                        const row = { ...comps[ci] as any, components: (comps[ci] as any).components.filter((_: any, j: number) => j !== itemIdx) };
                                        comps[ci] = row as any;
                                        updateMessageData({ components: comps });
                                      }}>
                                      ×
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}

                {/* Add button — centered */}
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                  <AddDropdown
                    isV2={true}
                    canAddEmbed={false}
                    canAddRow={false}
                    onAddEmbed={() => {}}
                    onAddRow={() => {}}
                    onAddV2Component={(type) => {
                      const comps = [...(msg.components ?? [])];
                      switch (type) {
                        case "text": comps.push({ type: 10, content: "" }); break;
                        case "container": comps.push({ type: 17, components: [] }); break;
                        case "media": comps.push({ type: 12, items: [] }); break;
                        case "file": comps.push({ type: 13, file: { url: "" } }); break;
                        case "divider": comps.push({ type: 14 }); break;
                        case "row": comps.push({ type: 1, components: [] }); break;
                      }
                      updateMessageData({ components: comps });
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* CONTENT + Add button */}
                <Section title="MESSAGE" titleStyle={{ color: "#fff", textTransform: "uppercase" }} collapsible={false}>
                  <div style={{ position: "relative" }}>
                    <Input
                      multiline rows={5}
                      value={msg.content || ""}
                      onChange={(v) => updateMessageData({ content: v || undefined })}
                      placeholder=""
                      inputRef={v2ContentRef}
                    />
                    <div style={{
                      position: "absolute", top: 2, right: 6,
                      display: "flex", gap: 2, alignItems: "center",
                    }}>
                      <EmojiBtn serverEmojis={serverEmojis} onEmoji={(text) => {
                        const ta = stdContentRef.current;
                        if (ta) {
                          const start = ta.selectionStart;
                          const end = ta.selectionEnd;
                          const val = ta.value;
                          const newVal = val.slice(0, start) + text + val.slice(end);
                          updateMessageData({ content: newVal || undefined });
                          requestAnimationFrame(() => {
                            ta.focus();
                            const pos = start + text.length;
                            ta.setSelectionRange(pos, pos);
                          });
                        }
                      }} />
                      <span style={{
                        fontSize: 9, lineHeight: 1, color: "#52525b",
                        pointerEvents: "none", fontVariantNumeric: "tabular-nums",
                      }}>
                        {2000 - (msg.content?.length || 0)}
                      </span>
                    </div>
                  </div>
                </Section>
                {/* EMBEDS — collapsible via EmbedEditor header */}
                {(msg.embeds ?? []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {(msg.embeds ?? []).map((embed, ei) => (
                      <EmbedEditor
                        key={ei}
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
                        serverEmojis={serverEmojis}
                        onAddAttachment={handleAddAttachment}
                        onAttachmentError={(msg) => addToast("error", msg)}
                      />
                    ))}
                  </div>
                )}

                {/* COMPONENTS */}
                {((msg.components ?? []).length > 0) && (
                  <Section title="Components" badge={`${msg.components?.length ?? 0} rows`}>
                    <ComponentEditorForMessage
                      components={msg.components ?? []}
                      onChange={(comps) => updateMessageData({ components: comps })}
                      onEditComponent={(comp, ri, ci) => {
                        setEditingComponent(comp);
                        setEditingComponentPos({ ri: ri!, ci: ci! });
                        setComponentModalOpen(true);
                      }}
                      isV2={false}
                    />
                  </Section>
                )}

                {/* ADD EMBED / COMPONENT */}
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                  <AddContentPopover
                    maxedOut={(msg.embeds?.length ?? 0) >= 10}
                    onAddEmbed={() => {
                      const embeds = [...(msg.embeds ?? [])];
                      embeds.push({ color: 0x8B1538 });
                      updateMessageData({ embeds });
                    }}
                    onAddComponent={() => {
                      const comps: any[] = [...(msg.components ?? [])];
                      if (comps.length === 0 || (comps[comps.length - 1] as any).components?.length >= 5) {
                        comps.push({ type: 1, components: [] });
                      }
                      const row = comps[comps.length - 1] as any;
                      row.components = [...row.components, { type: 2 as const, style: 1 as const, label: "Button", custom_id: `btn_${randomId()}`, disabled: false }];
                      updateMessageData({ components: comps });
                    }}
                    onAddLink={() => {
                      const comps: any[] = [...(msg.components ?? [])];
                      if (comps.length === 0 || (comps[comps.length - 1] as any).components?.length >= 5) {
                        comps.push({ type: 1, components: [] });
                      }
                      const row = comps[comps.length - 1] as any;
                      row.components = [...row.components, { type: 2 as const, style: 5 as const, label: "Link", url: "https://", disabled: false }];
                      updateMessageData({ components: comps });
                    }}
                  />
                </div>
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
          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            padding: "8px 12px 6px", flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <ToolbarButton
                icon={<RefreshCw style={{ width: 16, height: 16 }} />}
                tooltip="Reset"
                onClick={resetAll}
              />
              <ToolbarButton
                icon={<CornerUpLeft style={{ width: 16, height: 16 }} />}
                tooltip="Undo"
                onClick={undo}
              />
              <ToolbarButton
                icon={<CornerUpRight style={{ width: 16, height: 16 }} />}
                tooltip="Redo"
                onClick={redo}
              />
              <ToolbarButton
                icon={<Save style={{ width: 16, height: 16 }} />}
                tooltip="Presets"
                onClick={() => setPresetsOpen(!presetsOpen)}
              />
              <ToolbarButton
                icon={<SendHorizonal style={{ width: 16, height: 16 }} />}
                tooltip="Send"
                onClick={() => setSendModalOpen(true)}
              />
            </div>
          </div>
          <div
            className="preview-scroll"
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px" }}
          >
            {!hasAnyContent ? (
              <EmptyPreviewPlaceholder isV2={isV2} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {data.messages.map((m, i) => {
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
                      setImageModalData={setImageModalData}
                      cdn={CDN}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
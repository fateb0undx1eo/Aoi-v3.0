import { type ReactNode } from "react";
import { Bot, Megaphone } from "lucide-react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { C } from "./constants";
import { WEBHOOK_URL_RE } from "./utils/discord";
import type { GuildChannel } from "./types";

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

export function SendModal({
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
            <CoolIcon icon="Close_MD" size={18} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Send Method
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { val: true,  label: "Bot",     icon: "Bot"   },
              { val: false, label: "Webhook", icon: "Globe" },
            ].map(({ val, label, icon }) => {
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
                  {icon === "Bot" ? <Bot style={{ width: 14, height: 14 }} /> : <CoolIcon icon="Globe" size={14} />} {label}
                </button>
              );
            })}
          </div>
        </div>

        <ModalToggle
          label="Edit existing message"
          checked={editMode}
          onChange={onEditModeChange}
        />

        <ModalToggle
          label="Don't mention anyone"
          description="Silences @here, @everyone and role pings"
          checked={suppressMentions}
          onChange={onSuppressMentionsChange}
          icon={<CoolIcon icon="Bell_Off" size={13} />}
        />

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
                      {sel && <CoolIcon icon="Check" size={10} />}# {ch.name}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

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
          <CoolIcon icon="Paper_Plane" size={15} />
          {sendAsBot
            ? `Send to ${selectedChannelIds.size} channel${selectedChannelIds.size !== 1 ? "s" : ""}`
            : "Send via Webhook"}
        </button>
      </div>
    </div>
  );
}

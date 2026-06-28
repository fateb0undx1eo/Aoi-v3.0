import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Megaphone, Copy, Trash2, ChevronDown,
  Send, Save, X, Eye, Check, Bot, Globe, Hash,
  MessageSquare, FileText, Code, RotateCcw, Layers,
  AlertTriangle, Zap,
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

function ToolbarButton({ icon, tooltip, onClick }: { icon: ReactNode; tooltip: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8,
          border: `1px solid ${hovered ? "#3f3f46" : C.border}`,
          backgroundColor: "transparent",
          color: hovered ? C.text : C.textMuted,
          cursor: "pointer", transition: "all 0.15s",
        }}>
        {icon}
      </button>
      {hovered && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          marginBottom: 6, padding: "4px 10px", borderRadius: 6,
          backgroundColor: "#18181b", color: C.text,
          fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          border: `1px solid ${C.border}`,
          zIndex: 100, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
    }}>
      {toasts.map((toast) => {
        const colors: Record<string, { bg: string; text: string }> = {
          success: { bg: "rgba(5,150,105,0.15)", text: "#34d399" },
          error: { bg: "rgba(239,68,68,0.15)", text: "#f87171" },
          info: { bg: "rgba(14,165,233,0.15)", text: "#38bdf8" },
          sending: { bg: "rgba(245,158,11,0.15)", text: "#fbbf24" },
        };
        const c = colors[toast.state] || colors.info!;
        return (
          <div key={toast.id} style={{
            pointerEvents: "auto",
            animation: "slideUp 0.3s ease-out",
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 20px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: c.bg,
            color: c.text,
            fontSize: 14, fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}>
            {toast.state === "error" && <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.state === "success" && <Check style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.state === "sending" && <Zap style={{ width: 16, height: 16, flexShrink: 0 }} />}
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

function SendModal({
  open, channels, selectedChannelIds, onToggleChannel, onSelectAll, onDeselectAll,
  sendMode, onSendModeChange, onSend, onClose,
}: {
  open: boolean; channels: GuildChannel[]; selectedChannelIds: Set<string>;
  onToggleChannel: (id: string) => void; onSelectAll: () => void; onDeselectAll: () => void;
  sendMode: "webhook" | "bot" | "edit_webhook" | "edit_bot";
  onSendModeChange: (mode: "webhook" | "bot" | "edit_webhook" | "edit_bot") => void;
  onSend: () => void; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Send Announcement</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8, display: "block" }}>Send Mode</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {([
              { value: "webhook" as const, label: "Send as Webhook", icon: Globe },
              { value: "bot" as const, label: "Send as Bot", icon: Bot },
              { value: "edit_webhook" as const, label: "Edit Message as Webhook", icon: Globe },
              { value: "edit_bot" as const, label: "Edit Message as Bot", icon: Bot },
            ]).map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => onSendModeChange(value)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${sendMode === value ? C.burg : C.border}`, backgroundColor: sendMode === value ? `${C.burg}15` : "transparent", color: sendMode === value ? C.burg : C.text, cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.15s" }}>
                <Icon style={{ width: 16, height: 16 }} />
                {label}
                {sendMode === value && <Check style={{ width: 14, height: 14, marginLeft: "auto" }} />}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>
              <Hash style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              Channels ({selectedChannelIds.size})
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onSelectAll} style={{ fontSize: 10, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>All</button>
              <button type="button" onClick={onDeselectAll} style={{ fontSize: 10, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>None</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
            {channels.length === 0 ? (
              <p style={{ fontSize: 11, color: C.textMuted }}>No text channels available.</p>
            ) : channels.map((ch) => {
              const sel = selectedChannelIds.has(ch.id);
              return (
                <button key={ch.id} type="button" onClick={() => onToggleChannel(ch.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, border: `1px solid ${sel ? `${C.burg}60` : C.border}`, backgroundColor: sel ? `${C.burg}15` : "transparent", color: sel ? C.burg : C.textMuted, cursor: "pointer", transition: "all 0.15s" }}>
                  {sel && <Check style={{ width: 10, height: 10 }} />}
                  # {ch.name}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" onClick={onSend} disabled={selectedChannelIds.size === 0}
          style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff", background: selectedChannelIds.size > 0 ? `linear-gradient(135deg, ${C.burg}, #a3153f)` : "#3f3f46", border: "none", cursor: selectedChannelIds.size === 0 ? "not-allowed" : "pointer", opacity: selectedChannelIds.size === 0 ? 0.5 : 1, transition: "all 0.15s" }}>
          <Send style={{ width: 16, height: 16 }} />
          Send to {selectedChannelIds.size} channel{selectedChannelIds.size !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

export default function GuildAnnouncementsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<Record<string, any> | null>(null);
  const [modules, setModules] = useState<{ name: string; display_name?: string; enabled?: boolean }[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [serverEmojis, setServerEmojis] = useState<GuildEmoji[]>([]);

  const [data, setData] = useState<QueryData>(() => ({
    version: "d2",
    messages: [{ _id: randomId(), data: {} }],
    targets: [],
  }));
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(0);
  const [messageFiles, setMessageFiles] = useState<Record<string, DraftFile[]>>({});
  const [editingComponent, setEditingComponent] = useState<APIComponentInActionRow | null>(null);
  const [editingComponentPos, setEditingComponentPos] = useState<{ ri: number; ci: number } | null>(null);
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [addMsgOpen, setAddMsgOpen] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [codeGenOpen, setCodeGenOpen] = useState(false);

  const [presets, setPresets] = useState<{ id: string; name: string; kind: "draft" | "template"; data: QueryData }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sendMode, setSendMode] = useState<"webhook" | "bot" | "edit_webhook" | "edit_bot">("webhook");
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const message = data.messages[selectedMessageIndex];
  const isV2 = isComponentsV2(message?.data.flags);

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

  useEffect(() => {
    if (!guildId || typeof guildId !== "string") return;
    (async () => {
      try {
        const [ovRes, chRes, emRes] = await Promise.all([
          fetch(`/api/backend/dashboard/guild/${guildId}/overview`),
          fetch(`/api/backend/guilds/${guildId}/channels`),
          fetch(`/api/backend/guilds/${guildId}/emojis`),
        ]);
        if ([ovRes.status, chRes.status, emRes.status].some((s) => s === 401)) { router.replace("/api/auth/discord"); return; }
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
            id: p.id || `preset-${nanoid()}`,
            name: String(p.name || "").slice(0, 80),
            kind: p.kind === "template" ? "template" as const : "draft" as const,
            data: p.data || { version: "d2", messages: [{ _id: randomId(), data: {} }], targets: [] },
          })));
        }
      } catch { } finally { setLoading(false); }
    })();
  }, [guildId, router]);

  const setD = useCallback((next: QueryData) => setData(cloneQueryData(next)), []);

  const updateMessageData = useCallback((updates: Partial<QueryDataMessageData>) => {
    setD({ ...data, messages: data.messages.map((m, i) => i === selectedMessageIndex ? { ...m, data: { ...m.data, ...updates } } : m) });
  }, [data, selectedMessageIndex, setD]);

  const addMessage = useCallback((isComponentsV2Msg?: boolean) => {
    const flags = isComponentsV2Msg ? (1 << 15) : undefined;
    const msg = createMessage(flags);
    const next = [...data.messages, msg];
    setD({ ...data, messages: next });
    setSelectedMessageIndex(next.length - 1);
    setAddMsgOpen(false);
  }, [data, setD]);

  const duplicateMessage = useCallback((idx: number) => {
    const msg = JSON.parse(JSON.stringify(data.messages[idx]));
    msg._id = randomId();
    const next = [...data.messages];
    next.splice(idx + 1, 0, msg);
    setD({ ...data, messages: next });
  }, [data, setD]);

  const removeMessage = useCallback((idx: number) => {
    let next = data.messages.filter((_, i) => i !== idx);
    if (next.length === 0) next = [{ _id: randomId(), data: {} }];
    const newIdx = Math.min(selectedMessageIndex, next.length - 1);
    setSelectedMessageIndex(idx === selectedMessageIndex ? newIdx : (selectedMessageIndex > idx ? selectedMessageIndex - 1 : selectedMessageIndex));
    setD({ ...data, messages: next });
  }, [data, selectedMessageIndex, setD]);

  const moveMessage = useCallback((idx: number, dir: "up" | "down") => {
    const t = dir === "up" ? idx - 1 : idx + 1;
    if (t < 0 || t >= data.messages.length) return;
    const next = [...data.messages];
    [next[idx]!, next[t]!] = [next[t]!, next[idx]!];
    setD({ ...data, messages: next });
    setSelectedMessageIndex(t);
  }, [data, setD]);

  const scrollToMessage = useCallback((idx: number) => {
    const el = msgRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setSelectedMessageIndex(idx);
  }, []);

  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }, []);

  const selectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set(channels.map((c) => c.id)));
  }, [channels]);

  const deselectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set());
  }, []);

  const savePreset = useCallback(async (kind: "draft" | "template") => {
    const name = presetName.trim().slice(0, 80);
    if (!name) { addToast("error", "Enter a name before saving."); return; }
    const existingIdx = presets.findIndex((p) => p.kind === kind && p.name.toLowerCase() === name.toLowerCase());
    const next = [...presets];
    const preset = { id: existingIdx >= 0 ? next[existingIdx]!.id : `preset-${nanoid()}`, name, kind, data: cloneQueryData(data) };
    if (existingIdx >= 0) next[existingIdx]! = preset;
    else next.unshift(preset);
    setPresets(next);
    try {
      const announcementsModule = modules.find((m) => m.name === "announcements");
      await fetch(`/api/backend/modules/${guildId}/announcements`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: announcementsModule?.enabled ?? true, config: { presets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) } }),
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
        body: JSON.stringify({ enabled: announcementsModule?.enabled ?? true, config: { presets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) } }),
      });
      addToast("success", "Preset deleted.");
    } catch { addToast("error", "Failed to delete preset."); }
  }, [presets, modules, guildId, addToast]);

  const handleSend = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    if (selectedChannelIds.size === 0) { addToast("error", "Select at least one channel to send to."); return; }
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
    addToast("sending", "Sending announcement...");
    try {
      const hasFiles = data.messages.some((m) => (messageFiles[m._id || ""] || []).length > 0);
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
            id: m._id,
            content: m.data.content || undefined,
            embeds: m.data.embeds?.filter((e) => e.title || e.description || (e.fields && e.fields.length > 0) || e.image?.url || e.thumbnail?.url || e.footer?.text || e.author?.name),
            components: cleanComponents,
            flags: m.data.flags,
            edit_existing: !!m.reference,
            message_link: m.reference || undefined,
            thread_name: m.data.thread_name || undefined,
            allowed_mentions: m.data.allowed_mentions || undefined,
            flows: flows.length > 0 ? flows : undefined,
          };
        }),
      };
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
        res = await fetch(`${getBackendApiUrl()}/api/guilds/${guildId}/announcements`, { method: "POST", body: fd, credentials: "include" });
      } else {
        res = await fetch(`/api/backend/guilds/${guildId}/announcements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseData?.error || "Failed to send");
      addToast("success", "Announcement sent successfully!");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to send");
    }
  }, [guildId, data, selectedChannelIds, messageFiles, addToast]);

  const mid = message?._id || "";
  const currentFiles = messageFiles[mid] || [];

  const [editEmbedIndex, setEditEmbedIndex] = useState<number | null>(null);

  const msg = message?.data;

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} modules={modules}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <SendModal
        open={sendModalOpen} channels={channels}
        selectedChannelIds={selectedChannelIds}
        onToggleChannel={toggleChannel} onSelectAll={selectAllChannels} onDeselectAll={deselectAllChannels}
        sendMode={sendMode} onSendModeChange={setSendMode}
        onSend={handleSend} onClose={() => setSendModalOpen(false)}
      />

      <CodeGenerator messageData={msg || {}} open={codeGenOpen} onClose={() => setCodeGenOpen(false)} />
      <ComponentEditModal open={componentModalOpen} onClose={() => setComponentModalOpen(false)}
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
        serverEmojis={serverEmojis} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "calc(100vh - 120px)" }}>
        {/* LEFT PANEL - 50% */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", backgroundColor: C.surface, borderRight: `1px solid ${C.border}` }}>

          {/* Compact toolbar + message nav */}
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.surface, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <ToolbarButton icon={<Save style={{ width: 11, height: 11 }} />} tooltip="Presets" onClick={() => setPresetsOpen(!presetsOpen)} />
            <ToolbarButton icon={<Code style={{ width: 11, height: 11 }} />} tooltip="Generate Code" onClick={() => setCodeGenOpen(true)} />
            <ToolbarButton icon={<RotateCcw style={{ width: 11, height: 11 }} />} tooltip="Reset" onClick={() => { setD({ version: data.version, messages: [{ _id: randomId(), data: {} }], targets: [] }); addToast("info", "Reset to empty state."); }} />
            <span style={{ width: 1, height: 16, backgroundColor: C.border, margin: "0 4px" }} />
            <span style={{ fontSize: 10, color: C.textMuted }}>Msg:</span>
            <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {data.messages.map((_, i) => (
                <button key={i} type="button" onClick={() => scrollToMessage(i)} title={`Message ${i + 1}`}
                  style={{ width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, border: `1px solid ${selectedMessageIndex === i ? C.burg : C.border}`, backgroundColor: selectedMessageIndex === i ? `${C.burg}20` : "transparent", color: selectedMessageIndex === i ? C.burg : C.textMuted, cursor: "pointer" }}>
                  {i + 1}
                </button>
              ))}
              <button type="button" onClick={() => addMessage(false)} title="Add Standard Message"
                style={{ width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, border: `1px solid ${C.border}`, backgroundColor: "transparent", color: C.textMuted, cursor: "pointer" }}>
                <MessageSquare style={{ width: 9, height: 9 }} />
              </button>
              <button type="button" onClick={() => addMessage(true)} title="Add Components V2"
                style={{ width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, border: `1px solid ${C.border}`, backgroundColor: "transparent", color: C.textMuted, cursor: "pointer" }}>
                <Layers style={{ width: 9, height: 9 }} />
              </button>
            </div>
          </div>

          {/* Scrollable sections area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }} className="scrollbar-thin">
            {!msg ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", textAlign: "center" }}>
                <MessageSquare style={{ width: 32, height: 32, color: "#52525b", marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: C.textMuted }}>No messages yet</p>
                <p style={{ fontSize: 10, color: "#52525b" }}>Click Msg or V2 above to add one</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                {/* TARGET SECTION */}
                <Section title="Target" badge={`${selectedChannelIds.size} channels`}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {(["webhook", "bot", "edit_webhook", "edit_bot"] as const).map((mode) => (
                      <button key={mode} type="button" onClick={() => setSendMode(mode)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 9, fontWeight: 500,
                          border: `1px solid ${sendMode === mode ? C.burg : C.border}`,
                          backgroundColor: sendMode === mode ? `${C.burg}15` : "transparent",
                          color: sendMode === mode ? C.burg : C.textMuted, cursor: "pointer",
                        }}>
                        {mode === "webhook" || mode === "edit_webhook" ? <Globe style={{ width: 10, height: 10, display: "inline", marginRight: 2 }} /> : <Bot style={{ width: 10, height: 10, display: "inline", marginRight: 2 }} />}
                        {mode.startsWith("edit_") ? "Edit" : mode === "webhook" ? "Webhook" : "Bot"}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <Label muted style={{ fontSize: 10 }}><Hash style={{ width: 10, height: 10, display: "inline", marginRight: 2 }} />Channels</Label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={selectAllChannels} style={{ fontSize: 9, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>All</button>
                      <button type="button" onClick={deselectAllChannels} style={{ fontSize: 9, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>None</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 120, overflowY: "auto" }}>
                    {channels.length === 0 ? (
                      <p style={{ fontSize: 10, color: C.textMuted }}>No text channels available.</p>
                    ) : channels.map((ch) => (
                      <ChannelTag key={ch.id} name={ch.name} selected={selectedChannelIds.has(ch.id)} onClick={() => toggleChannel(ch.id)} />
                    ))}
                  </div>
                </Section>

                {/* CONTENT SECTION */}
                <Section title="Content" badge={`${msg.content?.length || 0}/2000`}>
                  <Input multiline rows={5} value={msg.content || ""}
                    onChange={(v) => updateMessageData({ content: v || undefined })}
                    placeholder="Message content (Discord markdown supported)" />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: C.textMuted }}>
                      {msg.content?.length ? `${msg.content.length} chars` : "Empty"}
                    </span>
                    <span style={{ fontSize: 9, color: (msg.content?.length || 0) >= 2000 ? "#ef4444" : (msg.content?.length || 0) >= 1800 ? "#eab308" : C.textMuted }}>
                      {msg.content?.length || 0}/2000
                    </span>
                  </div>
                </Section>

                {/* EMBEDS SECTION */}
                <Section title="Embeds" badge={`${msg.embeds?.length || 0}/10`}>
                  {(msg.embeds ?? []).length === 0 ? (
                    <div style={{ borderRadius: 8, border: `1px dashed ${C.border}`, padding: "16px 0", textAlign: "center" }}>
                      <FileText style={{ width: 20, height: 20, color: "#52525b", margin: "0 auto 4px" }} />
                      <p style={{ fontSize: 10, color: C.textMuted }}>No embeds yet</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(msg.embeds ?? []).map((embed, ei) => (
                        <div key={ei} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                          <EmbedRow
                            title={embed.title || embed.description?.slice(0, 40) || `Embed ${ei + 1}`}
                            onEdit={() => setEditEmbedIndex(editEmbedIndex === ei ? null : ei)}
                            onRemove={() => {
                              const embeds = msg.embeds?.filter((_, i) => i !== ei);
                              updateMessageData({ embeds: embeds?.length ? embeds : undefined });
                            }} />
                          {editEmbedIndex === ei && (
                            <div style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, backgroundColor: C.bg }}>
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
                  <AddButton label={`Add Embed (${msg.embeds?.length ?? 0}/10)`}
                    disabled={(msg.embeds?.length ?? 0) >= 10}
                    onClick={() => {
                      const embeds = [...(msg.embeds ?? [])];
                      embeds.push({});
                      updateMessageData({ embeds });
                      setEditEmbedIndex(embeds.length - 1);
                    }} />
                </Section>

                {/* COMPONENTS SECTION */}
                <Section title="Components" badge={msg.components ? `${msg.components.length} rows` : "0 rows"}>
                  <ComponentEditorForMessage
                    components={msg.components ?? []}
                    onChange={(comps) => updateMessageData({ components: comps })}
                    onEditComponent={(comp, ri, ci) => { setEditingComponent(comp); setEditingComponentPos({ ri: ri!, ci: ci! }); setComponentModalOpen(true); }}
                    serverEmojis={serverEmojis}
                    isV2={isV2} />
                </Section>

                {/* OPTIONS SECTION */}
                <Section title="Options" defaultOpen={false}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Toggle
                      checked={(msg.flags ?? 0) & 4 ? true : false}
                      onChange={(v) => {
                        let f = msg.flags || 0;
                        f = v ? f | 4 : f & ~4;
                        updateMessageData({ flags: f || undefined });
                      }}
                      label="Suppress Embeds" />
                    <Toggle
                      checked={(msg.flags ?? 0) & 4096 ? true : false}
                      onChange={(v) => {
                        let f = msg.flags || 0;
                        f = v ? f | 4096 : f & ~4096;
                        updateMessageData({ flags: f || undefined });
                      }}
                      label="Suppress Notifications" />
                    <Toggle
                      checked={!!msg.allowed_mentions}
                      onChange={(v) => updateMessageData({
                        allowed_mentions: v ? { parse: ["users", "roles"] } : undefined,
                      })}
                      label="Allow Mentions" />
                    <div style={{ marginTop: 4 }}>
                      <Label muted style={{ fontSize: 10, marginBottom: 6, display: "block" }}>File Attachments</Label>
                      <FileAttachmentEditor
                        files={currentFiles}
                        onChange={(f) => setMessageFiles((prev) => ({ ...prev, [mid]: f }))}
                        messageData={msg}
                        updateMessageData={updateMessageData} />
                    </div>
                  </div>
                </Section>

              </div>
            )}
          </div>

          {/* SEND BAR */}
          <div style={{
            padding: "8px 12px", borderTop: `1px solid ${C.border}`,
            backgroundColor: C.surface, flexShrink: 0,
          }}>
            <button type="button" onClick={() => setSendModalOpen(true)}
              style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: `linear-gradient(135deg, ${C.burg}, #a3153f)`,
                color: "#fff", transition: "all 0.15s",
              }}>
              <Send style={{ width: 14, height: 14 }} /> Send Announcement
            </button>
          </div>
        </div>

        {/* RIGHT PANEL - Preview 50% */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", backgroundColor: EMBED_BG, overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "scroll", padding: "12px 14px" }}>
            {data.messages.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
                <Eye style={{ width: 48, height: 48, color: "#52525b", marginBottom: 16 }} />
                <p style={{ fontSize: 14, color: "#71717a" }}>No messages yet</p>
                <p style={{ fontSize: 12, color: "#52525b" }}>Add a message to see the preview</p>
              </div>
            ) : data.messages.map((m, i) => {
              const pMid = m._id || String(i);
              return (
                <DiscordPreview key={`preview-${pMid}`}
                  message={m.data}
                  isV2={isComponentsV2(m.data.flags)}
                  targets={data.targets}
                  onEditComponent={(comp, ri, ci) => { setEditingComponent(comp); setEditingComponentPos({ ri: ri!, ci: ci! }); setComponentModalOpen(true); }}
                  files={messageFiles[pMid]} />
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

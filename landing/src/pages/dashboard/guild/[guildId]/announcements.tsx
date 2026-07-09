import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { CoolIcon } from "@/components/icons/CoolIcon";

import type {
  QueryData, QueryDataMessage, QueryDataMessageData,
  GuildChannel, GuildEmoji, DraftFile, FlowActionPayload, FlowAction,
  APIActionRowComponent, APIContainerComponent,
  APIComponentInActionRow, APIV2TextDisplay,
} from "@/components/announcements/types";
import { C, CDN, EMBED_BG } from "@/components/announcements/constants";
import { getBackendApiUrl } from "@/lib/backend";
import {
  randomId, createMessage, cloneQueryData,
  isComponentsV2, embedHasDisplayContent,
} from "@/components/announcements/utils/message";
import { buildDiscordPayload, executeWebhook, updateWebhookMessage, parseMessageLink, WEBHOOK_URL_RE } from "@/components/announcements/utils/discord";

import CodeGenerator from "@/components/announcements/modals/CodeGenerator";
import ComponentEditModal from "@/components/announcements/modals/ComponentEditModal";
import { ImageModal } from "@/components/announcements/modals/ImageModal";
import DiscordPreview, { EmptyPreviewPlaceholder } from "@/components/announcements/preview/DiscordPreview";
import EmbedEditor from "@/components/announcements/editor/EmbedEditor";
import ComponentEditorForMessage from "@/components/announcements/editor/ComponentEditorForMessage";
import V2ChildEditor from "@/components/announcements/editor/V2ChildEditor";
import V2ContainerEditor from "@/components/announcements/editor/V2ContainerEditor";
import { TextDisplayEditor } from "@/components/announcements/editor/TextDisplayEditor";
import { SectionEditor } from "@/components/announcements/editor/SectionEditor";
import { Section, Input } from "@/components/announcements/editor/ui";

import { ToastContainer, useToasts } from "@/components/announcements/ToastContainer";
import { SendModal } from "@/components/announcements/SendModal";
import { AddDropdown } from "@/components/announcements/AddDropdown";
import { MessageActionBtn, AddMessagePopover, AddContentPopover } from "@/components/announcements/MessageHeader";
import { ToolbarButton } from "@/components/announcements/ToolbarButton";
import { EmojiBtn } from "@/components/announcements/EmojiBtn";
import { AccessoryBtn } from "@/components/announcements/AccessoryBtn";
import { useUndoHistory } from "@/components/announcements/hooks/useUndoHistory";

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
  const [imageModalData,       setImageModalData]       = useState<import("@/components/announcements/types").ImageModalProps>();

  const [presets,      setPresets]      = useState<{ id: string; name: string; kind: "draft" | "template"; data: QueryData }[]>([]);
  const [presetName,   setPresetName]   = useState("");
  const [presetsOpen,  setPresetsOpen]  = useState(false);

  const { toasts, addToast, updateToast, dismissToast, confirmAction } = useToasts();
  const { undo: rawUndo, redo: rawRedo, resetHistory, skipHistoryRef } = useUndoHistory(data);

  const [sendModalOpen,  setSendModalOpen]  = useState(false);
  const [sendAsBot,      setSendAsBot]      = useState(true);
  const [editMode,       setEditMode]       = useState(false);
  const [webhookUrl,     setWebhookUrl]     = useState("");
  const [messageLink,    setMessageLink]    = useState("");
  const [suppressMentions, setSuppressMentions] = useState(false);
  const [starredMessages, setStarredMessages] = useState<Set<string>>(new Set());
  const [starAnimatingOut, setStarAnimatingOut] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRefs   = useRef<Record<number, HTMLDivElement | null>>({});
  const v2ContentRef = useRef<HTMLTextAreaElement>(null);
  const stdContentRef = useRef<HTMLTextAreaElement>(null);
  const [pillPage, setPillPage] = useState(0);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(data.messages.length / 10));
    if (pillPage >= totalPages) setPillPage(0);
  }, [data.messages.length]);

  const safeSelectedIndex = data.messages.length === 0 ? 0 : Math.min(selectedMessageIndex, data.messages.length - 1);
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
        if (row.type === 1 && row.components && row.components.length > 0) return true;
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
        const [ovRes, chRes, emRes, prRes] = await Promise.all([
          fetch(`/api/backend/dashboard/guild/${gid}/overview`),
          fetch(`/api/backend/guilds/${gid}/channels`),
          fetch(`/api/backend/guilds/${gid}/emojis`),
          fetch(`/api/backend/modules/${gid}/announcements/presets`),
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
        // Load presets from new table, fall back to legacy config
        if (prRes.ok) {
          const prData = await prRes.json();
          if (Array.isArray(prData.presets) && prData.presets.length > 0) {
            setPresets(prData.presets.map((p: any) => ({
              id:   p.id,
              name: String(p.name || "").slice(0, 80),
              kind: p.kind === "template" ? "template" as const : "draft" as const,
              data: p.data || { version: "d2", messages: [{ _id: randomId(), data: {} }], targets: [] },
            })));
          }
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

  const undo = useCallback(() => {
    const snapshot = rawUndo();
    if (snapshot) { skipHistoryRef.current = true; setD(snapshot); }
  }, [rawUndo, setD, skipHistoryRef]);

  const redo = useCallback(() => {
    const snapshot = rawRedo();
    if (snapshot) { skipHistoryRef.current = true; setD(snapshot); }
  }, [rawRedo, setD, skipHistoryRef]);

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
    resetHistory({ version: data.version, messages: [{ _id: randomId(), data: {} }], targets: [] });
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
    try {
      if (existingIdx >= 0) {
        const existing = presets[existingIdx]!;
        const body = { name, kind, data: cloneQueryData(data) };
        await fetch(`/api/backend/modules/${guildId}/announcements/presets/${existing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      } else {
        const body = { name, kind, data: cloneQueryData(data) };
        const res = await fetch(`/api/backend/modules/${guildId}/announcements/presets`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error || "Failed to save preset");
        // Use server-assigned id
        const next = [{ ...body, id: result.preset.id }, ...presets];
        setPresets(next);
        addToast("success", `${kind === "template" ? "Template" : "Draft"} saved.`);
        return;
      }
      const next = [...presets];
      next[existingIdx]! = { ...next[existingIdx]!, name, data: cloneQueryData(data) };
      setPresets(next);
      addToast("success", `${kind === "template" ? "Template" : "Draft"} saved.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save preset";
      addToast("error", msg);
    }
  }, [presetName, presets, data, guildId, addToast]);

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
    try {
      await fetch(`/api/backend/modules/${guildId}/announcements/presets/${presetId}`, { method: "DELETE" });
      setPresets((prev: any) => prev.filter((p: any) => p.id !== presetId));
      addToast("success", "Preset deleted.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete preset";
      addToast("error", msg);
    }
  }, [guildId, addToast, confirmAction, presets]);

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

    const sendingToastId = addToast("sending", "Sending announcement…");

    // Build allowed_mentions from suppressMentions flag
    const buildAllowedMentions = (existing: any) => {
      if (suppressMentions) return { parse: [] };
      return existing;
    };

    try {
      if (!sendAsBot && webhookUrl.trim()) {
        const match = webhookUrl.trim().match(WEBHOOK_URL_RE);
        if (!match) { updateToast(sendingToastId, "error", "Invalid webhook URL"); return; }
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
        if (failed === 0) updateToast(sendingToastId, "success", `Sent ${sent} message${sent !== 1 ? "s" : ""} via webhook!`);
        else updateToast(sendingToastId, "error", `Sent ${sent}, failed ${failed} message${failed !== 1 ? "s" : ""}`);
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
        const url = `${getBackendApiUrl()}/api/guilds/${guildId}/announcements`;
        if (hasFiles) {
          const fd = new FormData();
          fd.append("payload", JSON.stringify(body));
          data.messages.forEach((m) => {
            const files = messageFiles[m._id || ""] || [];
            const metas = files.map((f) => ({ name: f.name, spoiler: f.spoiler, description: f.description }));
            fd.append(`filemeta_${m._id || "unknown"}`, JSON.stringify(metas));
            files.forEach((f) => { if (f.file) fd.append(`file_${m._id || "unknown"}`, f.file, f.name); });
          });
          res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
        } else {
          res = await fetch(url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body), credentials: "include",
          });
        }
        const responseData = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(responseData?.error || "Failed to send");
        updateToast(sendingToastId, "success", "Announcement sent!");
      }
      setSendModalOpen(false);
    } catch (err) {
      updateToast(sendingToastId, "error", err instanceof Error ? err.message : "Failed to send");
    }
  }, [
    guildId, data, selectedChannelIds, messageFiles, addToast,
    sendAsBot, webhookUrl, editMode, messageLink, suppressMentions,
  ]);

  // ── Embed attachment upload ──────────────────────────────────────────────────
  const handleAddAttachment = useCallback(async (file: File): Promise<string> => {
    if (guildId && process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_BACKEND_API_URL) {
      return URL.createObjectURL(file);
    }
    const gid = typeof guildId === "string" ? guildId : "";
    if (!gid) throw new Error("No guild ID");
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    const base64 = btoa(binary);
    const res = await fetch(`/api/backend/guilds/${gid}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, mimetype: file.type, size: buffer.byteLength, data: base64 }),
    });
    if (!res.ok) {
      let msg = "Upload failed";
      try { const body = await res.json(); msg = body.error || msg; } catch { msg = `HTTP ${res.status}: ${res.statusText}`; }
      throw new Error(msg);
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
          width: "45%", minWidth: 340, maxWidth: 580,
          display: "flex", flexDirection: "column",
          backgroundColor: C.surface, borderRight: `1px solid ${C.border}`,
          position: "relative",
        }}>

          {/* ── Fixed header (never scrolls) ──────────────────────────────────── */}
          <div style={{
            padding: "20px 12px 6px",
            backgroundColor: C.surface,
            flexShrink: 0,
            zIndex: 10,
          }}>
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 15 }}>

              {/* Studio wordmark */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 1961 1446" style={{ width: 28, height: 21 }}>
  <path fill="#FEFEFE" d="M673.785 288.214C677.12 278.107 678.945 267.608 682.378 257.52C692.485 227.818 712.593 199.066 741.024 184.79C771.388 169.544 807.89 170.612 839.553 181.273C966.463 224.002 1081.21 406.234 1138.37 522.228C1211.65 670.903 1304.01 923.783 1248.84 1086.89C1239.34 1114.99 1224.7 1139.51 1197.08 1152.88C1173.04 1164.53 1142.53 1162.28 1117.74 1153.53C1115.79 1152.84 1113.86 1152.1 1111.95 1151.31C1110.88 1152.07 1109.35 1152.92 1107.96 1152.66C1084.56 1147.8 1060.88 1140.77 1038.14 1133.33C923.487 1095.83 809.975 1058.16 688.904 1047.03C664.38 1044.72 639.757 1043.61 615.125 1043.71C602.887 1043.79 580.864 1045.02 569.406 1044.28L568.435 1044.21C556.271 1064.03 532.628 1078.98 510.814 1086.63C505.146 1088.62 493.989 1090.47 489.835 1093.87C481.414 1095.09 474.175 1099.8 465.328 1100.3C445.616 1101.42 424.936 1096.68 405.514 1099.7C389.892 1102.13 238.086 1146.26 234.594 1151.15C233.163 1153.15 232.751 1155.31 232.23 1157.67C214.747 1158.32 193.666 1149.6 177.395 1143.99C173.725 1145.36 167.379 1147.16 163.673 1147.8C64.1244 1164.67 -4.18414 1047.92 3.97453 960.591C8.84051 908.509 35.6187 869.699 75.1441 837.039C97.7201 797.845 105.989 792.446 147.934 772.1C153.269 769.511 168.304 763.128 172.428 759.725C181.443 752.284 191.667 730.123 199.75 722.29C209.056 713.273 240.908 718.579 254.095 719.394C274.176 708.56 295.563 698.804 316.111 688.545C338.708 677.971 359.434 665.141 383.841 659.075C404.015 654.062 413.403 656.508 432.448 662.188C435.618 658.013 442.467 650.678 446.131 646.317C456.838 633.602 467.333 620.711 477.613 607.649C512.358 562.866 544.226 515.923 573.025 467.102C597.671 425.632 619.93 384.153 643.303 342.096C649.948 330.139 666.714 297.716 673.785 288.214Z"/>
  <path fill="#9F0F3B" d="M673.785 288.214C677.12 278.107 678.945 267.608 682.378 257.52C692.485 227.818 712.593 199.066 741.024 184.79C771.388 169.544 807.89 170.612 839.553 181.273C966.463 224.002 1081.21 406.234 1138.37 522.228C1211.65 670.903 1304.01 923.783 1248.84 1086.89C1239.34 1114.99 1224.7 1139.51 1197.08 1152.88C1173.04 1164.53 1142.53 1162.28 1117.74 1153.53C1115.79 1152.84 1113.86 1152.1 1111.95 1151.31C1105.89 1146.41 1089.96 1140.52 1082.34 1135.85C1061.82 1123.27 1041.38 1108.27 1023.4 1092.13C837.576 923.043 716.396 675.688 676.219 429.198C669.908 390.478 668.793 349.735 672.425 310.891C673.074 303.944 674.378 294.981 673.785 288.214Z"/>
  <path fill="#83082D" d="M785.931 575.274C782.277 572.163 777.417 554.021 775.377 548.193C755.177 490.475 741.528 432.154 735.725 372.316C721.618 226.853 787.922 158.509 911.946 270.806C954.271 309.129 991.749 353.811 1024.76 401.518C1128.75 557.493 1215.38 758.352 1232.24 946.144C1235.58 983.296 1231.68 1044.3 1205.62 1071.62C1195.57 1083.54 1181.08 1088.91 1165.65 1089.76C1129.65 1091.73 1087.06 1065.44 1061.4 1040.91C1013.63 995.234 953.929 926.261 924.072 867.113L924.846 864.313C921.865 864.934 923.199 865.16 920.673 863.904C910.772 849.419 900.099 830.433 891.435 814.929C855.748 751.063 825.909 683.143 799.526 614.96C796.815 607.956 786.291 581.062 785.931 575.274Z"/>
  <path fill="#FEFEFE" d="M785.931 575.274C816.629 567.422 856.837 561.433 887.626 554.624C900.636 553.481 964.886 536.589 974.608 539.428C1035.02 557.068 1073.56 641.444 1088.81 697.597C1095.75 723.124 1099.68 772.121 1077.19 791.679C1072.77 795.517 1051.73 804.717 1044.65 808.069L964.031 846.069C957.742 848.973 929.4 861.376 924.846 864.313C921.865 864.934 923.199 865.16 920.673 863.904C910.772 849.419 900.099 830.433 891.435 814.929C855.748 751.063 825.909 683.143 799.526 614.96C796.815 607.956 786.291 581.062 785.931 575.274Z"/>
  <path fill="#2E2E2E" d="M1007.36 602.499C1029.09 600.254 1043.41 621.142 1052.43 638.337C1062.85 658.213 1082.05 705.617 1059.12 721.317C1027.07 728.215 992.084 644.831 998.008 618.762C999.934 610.285 1000.46 607.727 1007.36 602.499Z"/>
  <path fill="#2E2E2E" d="M254.095 719.394C274.176 708.56 295.563 698.804 316.111 688.545C338.708 677.971 359.434 665.141 383.841 659.075C404.015 654.062 413.403 656.508 432.448 662.188L431.978 662.78C423.175 673.664 412.302 682.457 404.044 694.624C337.991 791.95 383.226 940.042 467.452 1011.88C487.817 1029.25 514.855 1041.94 541.493 1043.37C546.451 1043.66 565.609 1043.62 568.435 1044.21C556.271 1064.03 532.628 1078.98 510.814 1086.63C505.146 1088.62 493.989 1090.47 489.835 1093.87C481.414 1095.09 474.175 1099.8 465.328 1100.3C445.616 1101.42 424.936 1096.68 405.514 1099.7C389.892 1102.13 238.086 1146.26 234.594 1151.15C233.163 1153.15 232.751 1155.31 232.23 1157.67C214.747 1158.32 193.666 1149.6 177.395 1143.99C173.725 1145.36 167.379 1147.16 163.673 1147.8C64.1244 1164.67 -4.18414 1047.92 3.97453 960.591C8.84051 908.509 35.6187 869.699 75.1441 837.039C97.7201 797.845 105.989 792.446 147.934 772.1C153.269 769.511 168.304 763.128 172.428 759.725C181.443 752.284 191.667 730.123 199.75 722.29C209.056 713.273 240.908 718.579 254.095 719.394Z"/>
  <path fill="#9F0F3B" d="M177.395 1143.99C173.725 1145.36 167.379 1147.16 163.673 1147.8C64.1244 1164.67 -4.18414 1047.92 3.97453 960.591C8.84051 908.509 35.6187 869.699 75.1441 837.039C76.1518 842.257 70.1887 849.609 68.5983 854.903C65.2008 866.213 63.014 877.872 61.463 889.575C50.7962 971.153 84.0409 1069.68 146.713 1123.98C155.145 1131.28 173.523 1140.43 177.395 1143.99Z"/>
  <path fill="#9F0F3B" d="M1656.72 671.687C1674.73 672.616 1694.24 675.631 1712.25 678.019L1798.71 689.781L1871 699.421C1884.66 701.252 1899.27 703.128 1913.1 705.666C1934.15 709.531 1937.08 745.896 1942.92 762.849C1948.27 778.392 1954.51 799.994 1941.85 813.04C1934.03 821.086 1922.34 819.612 1912.01 819.838C1867.77 819.937 1823.47 821.997 1779.23 821.643C1783.3 835.708 1794.11 881.188 1795.03 894.665C1789.24 901.859 1781.17 908.848 1774 914.659C1763.7 912.435 1747.64 906.934 1737.26 903.632C1714.62 896.298 1691.93 889.116 1669.19 882.086L1461.14 814.853C1432.38 805.653 1403.56 796.543 1374.76 787.494C1360.25 782.937 1337.64 774.838 1359.87 759.328L1662.99 759.352C1657.99 749.669 1644.51 707.678 1641.46 696.246C1641.68 695.435 1641.93 694.633 1642.21 693.84C1644.33 687.827 1650.81 674.454 1656.72 671.687Z"/>
  <path fill="#9F0F3B" d="M232.23 1157.67C232.751 1155.31 233.163 1153.15 234.594 1151.15C238.086 1146.26 389.892 1102.13 405.514 1099.7C424.936 1096.68 445.616 1101.42 465.328 1100.3C474.175 1099.8 481.414 1095.09 489.835 1093.87C481.032 1111.55 468.092 1115.12 453.539 1124.96C483.988 1192.86 513.818 1251.99 563.74 1308.21C572.965 1318.59 618.21 1364.57 619.654 1369.72C632.8 1416.6 502.499 1447.55 476.434 1442.03C454.838 1437.45 422.549 1381.36 406.54 1364.54C359.374 1305.32 316.77 1245.75 272.281 1184.85C270.558 1182.49 236.364 1159.8 232.23 1157.67Z"/>
  <path fill="#9F0F3B" d="M1334.5 1.158C1347.67 0.404516 1362.71 4.40644 1375.91 5.82819C1382.87 6.96102 1394.71 8.18118 1397.86 15.5293C1403.76 29.2963 1400.19 47.2385 1396.57 61.1064C1390.93 82.6924 1386.51 104.972 1380.15 126.264C1393.28 128.24 1425.54 131.619 1437.72 137.316C1441.55 139.106 1442.15 151.229 1442.61 156.04C1437.31 167.518 1428.67 181.155 1422.03 192.07C1410.87 210.428 1399.61 228.724 1388.24 246.956L1325.82 347.555C1315.77 363.71 1305.66 380.948 1295.31 396.732C1292.58 401.36 1278.41 431.967 1267.04 414.833C1264.62 411.189 1270.84 393.567 1272.5 387.776L1284.85 344.967C1298.06 299.386 1311.83 251.131 1326.03 205.982C1307.61 208.049 1279.98 210.757 1262.14 209.326C1243.48 207.83 1268.37 155.376 1271.67 146.477L1300.68 69.137C1307.92 50.1705 1315.52 29.0109 1323.87 10.5153C1326.01 5.77434 1330.11 3.49265 1334.5 1.158Z"/>
  <path fill="#9F0F3B" d="M1860.41 0L1868.09 0C1886.47 5.95845 1910.62 46.9293 1924.25 62.698C1940.56 81.5744 1960.64 106.61 1954.98 132.948C1952.35 145.202 1926.88 163.202 1916.27 171.989L1863.6 215.662C1839.6 235.666 1808.09 264.35 1784.16 282.245L1824.18 349.964C1832.85 364.61 1846.64 386.094 1852.04 401.269C1849.45 410.207 1844.6 424.093 1839.08 431.678C1836.77 434.842 1826.81 438.748 1822.66 440.133C1781.14 454.009 1739.64 468.389 1698.2 482.49L1453.01 565.187C1422.19 575.399 1380.53 589.95 1348.25 598.658C1340.86 599.638 1330.74 591.934 1333.24 584.402C1336.81 573.662 1355.01 561.994 1364.43 554.471L1421.3 509.466C1484.26 458.889 1547.52 408.683 1611.08 358.851C1595.06 337.883 1575.8 316.643 1559.7 295.464C1552.35 285.793 1542.3 274.672 1536.77 264.055C1537.67 254.792 1543.06 240.335 1546.31 231.264C1548.39 225.467 1551.43 220.553 1556.37 216.803C1574.44 203.071 1593.56 189.866 1612.07 176.767L1703.75 110.916L1800.94 40.4411C1814.46 30.6238 1846.63 5.92102 1860.41 0Z"/>
</svg>
                <span style={{
                  fontFamily: "'Syne', 'Inter', sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  color: C.text,
                  lineHeight: 1.3,
                }}>
                  Announcement{" "}
                  <span style={{
                    color: C.burg,
                  }}>
                    Studio
                  </span>
                </span>
              </div>

            </div>

          {/* ── Message management ── */}
          <div style={{
            backgroundColor: "#0E0E0F",
            marginLeft: -12,
            marginRight: -12,
            padding: "6px 12px 8px 12px",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
              backgroundColor: C.burg,
            }} />
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Messages
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, color: "#a1a1aa",
                backgroundColor: "#1f1f22", borderRadius: 4,
                padding: "1px 5px", lineHeight: "14px", marginLeft: 6,
                fontVariantNumeric: "tabular-nums",
              }}>
                {data.messages.length}
              </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 2, alignItems: "center" }}>
                  <MessageActionBtn icon={<CoolIcon icon="Add_Plus" size={11} />} tooltip="Add message"
                    onClick={() => {}}
                    popover={(close: () => void) =>
                      <AddMessagePopover onAddStandard={() => { addMessage(false); close(); }} onAddV2={() => { addMessage(true); close(); }} />
                    }
                  />
                  <MessageActionBtn icon={<span style={{ display: "inline-block", animation: dupAnim ? "dupFlip 0.9s cubic-bezier(0.22, 1, 0.36, 1)" : "none" }}>
                    <CoolIcon icon="Copy" size={11} />
                  </span>} tooltip="Duplicate"
                    onClick={() => { duplicateMessage(safeSelectedIndex); triggerAnim(setDupAnim); }}
                  />
                  <MessageActionBtn icon={<span style={{ display: "inline-block", animation: codeAnim ? "codeCapture 0.5s ease" : "none" }}>
                    <CoolIcon icon="Code" size={11} />
                  </span>} tooltip="Copy raw payload"
                    onClick={() => { copyPayload(); triggerAnim(setCodeAnim); }}
                  />
                  <MessageActionBtn icon={<CoolIcon key={`ab-star-${starredMessages.has(mid)}`} icon="Star" size={11} fill={starredMessages.has(mid)} style={{ color: starredMessages.has(mid) ? "#eab308" : undefined, animation: starredMessages.has(mid) ? "starBounce 0.5s cubic-bezier(0.4, 0, 0.2, 1)" : "none" }} />} tooltip={starredMessages.has(mid) ? "Unstar message" : "Star message"}
                    onClick={() => toggleStar(mid)}
                  />
                  <MessageActionBtn icon={<span style={{ display: "inline-block", animation: delAnim ? "trashTip 0.5s ease" : "none" }}>
                    <CoolIcon icon="Trash_Empty" size={11} />
                  </span>} tooltip="Delete"
                    onClick={() => { removeMessage(safeSelectedIndex); triggerAnim(setDelAnim); }}
                  />
                </div>
              </div>
              {/* Pill chips (paginated, 10 per page) */}
              {(() => {
                const PER_PAGE = 15;
                const PILL_WIDTH = 28;
                const GAP = 3;
                const PAGE_WIDTH = PER_PAGE * PILL_WIDTH + (PER_PAGE - 1) * GAP;
                const totalPages = Math.max(1, Math.ceil(data.messages.length / PER_PAGE));
                const start = pillPage * PER_PAGE;
                const visibleMessages = data.messages.slice(start, start + PER_PAGE);
                return (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                    <button type="button" disabled={pillPage === 0}
                      onClick={() => setPillPage(p => Math.max(0, p - 1))}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        border: "none", backgroundColor: "transparent",
                        color: pillPage === 0 ? "#3f3f46" : C.textMuted,
                        cursor: pillPage === 0 ? "default" : "pointer", padding: 0,
                        transition: "all 0.12s",
                      }}
                    >
                      <CoolIcon icon="Caret_Left_SM" size={20} />
                    </button>
                    <div style={{
                      position: "absolute", left: "50%", transform: "translateX(-50%)",
                      display: "flex", gap: GAP,
                    }}>
                      {visibleMessages.map((m, localIdx) => {
                        const actualIdx = start + localIdx;
                        const mid = m._id || "";
                        const active = selectedMessageIndex === actualIdx;
                        const isStarred = starredMessages.has(mid);
                        const isAnimatingOut = starAnimatingOut.has(mid);
                        const showStar = isStarred || isAnimatingOut;
                        return (
                          <button key={mid || actualIdx} type="button"
                            onClick={() => scrollToMessage(actualIdx)}
                            title={`Message ${actualIdx + 1}${showStar ? " ★" : ""}`}
                            style={{
                              width: PILL_WIDTH, height: PILL_WIDTH, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700,
                              border: active ? `1px solid ${C.burg}` : "none",
                              backgroundColor: active ? C.burg : "#0E0E0F",
                              color: active ? "#fff" : C.textMuted,
                              cursor: "pointer", transition: "background-color 0.25s, color 0.25s, border-color 0.25s",
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "#1f1f22"; e.currentTarget.style.color = C.text; } }}
                            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "#0E0E0F"; e.currentTarget.style.color = C.textMuted; } }}
                          >
                            {showStar
                              ? <CoolIcon icon="Star" size={12} fill style={{ color: "#eab308",
                                  animation: isAnimatingOut
                                    ? "starPop 0.5s cubic-bezier(0.4, 0, 0.2, 1) reverse"
                                    : "starPop 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                                }} />
                              : (actualIdx + 1)}
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" disabled={pillPage >= totalPages - 1}
                      onClick={() => setPillPage(p => Math.min(totalPages - 1, p + 1))}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        border: "none", backgroundColor: "transparent",
                        color: pillPage >= totalPages - 1 ? "#3f3f46" : C.textMuted,
                        cursor: pillPage >= totalPages - 1 ? "default" : "pointer", padding: 0,
                        transition: "all 0.12s",
                      }}
                    >
                      <CoolIcon icon="Caret_Right_SM" size={20} />
                    </button>
                  </div>
                );
              })()}
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
                <CoolIcon icon="Chat_Dots" size={32} style={{ color: "#52525b", marginBottom: 10 }} />
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
                      if (comp.type === 10) {
                        return (
                          <div key={ci} style={{ position: "relative" }}>
                            <TextDisplayEditor
                              message={message}
                              component={comp as any}
                              parent={undefined}
                              index={ci}
                              data={data}
                              setData={setData}
                            />
                          </div>
                        );
                      }
                      if (comp.type === 9) {
                        return (
                          <div key={ci} style={{ position: "relative" }}>
                            <SectionEditor
                              message={message}
                              component={comp as any}
                              parent={undefined}
                              index={ci}
                              data={data}
                              setData={setData}
                              setEditingComponent={setEditingComponent as any}
                              componentFoundBackupsHook={undefined as any}
                              files={currentFiles}
                              setFiles={(updater) => {
                                setMessageFiles(prev => {
                                  const prevFiles = prev[mid] || [];
                                  const next = typeof updater === "function" ? updater(prevFiles) : updater;
                                  return { ...prev, [mid]: next };
                                });
                              }}
                            />
                          </div>
                        );
                      }
                      if (comp.type === 12 || comp.type === 13 || comp.type === 14) {
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
                      comps.push({ type: 1, components: [] });
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
          flex: 1, minWidth: 0,
          display: "flex", flexDirection: "column",
          backgroundColor: EMBED_BG, overflow: "hidden",
        }}>
          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            padding: "8px 12px 6px", flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <ToolbarButton
                icon={<CoolIcon icon="Arrows_Reload_01" size={16} />}
                tooltip="Reset"
                onClick={resetAll}
              />
              <ToolbarButton
                icon={<CoolIcon icon="Arrow_Undo_Up_Left" size={16} />}
                tooltip="Undo"
                onClick={undo}
              />
              <ToolbarButton
                icon={<CoolIcon icon="Arrow_Undo_Up_Right" size={16} />}
                tooltip="Redo"
                onClick={redo}
              />
              <ToolbarButton
                icon={<CoolIcon icon="Save" size={16} />}
                tooltip="Presets"
                onClick={() => setPresetsOpen(!presetsOpen)}
              />
              <ToolbarButton
                icon={<CoolIcon icon="Paper_Plane" size={16} />}
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
                      key={`preview-${pMid}-${i}`}
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
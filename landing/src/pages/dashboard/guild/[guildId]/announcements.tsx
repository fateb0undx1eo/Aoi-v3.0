import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BoneyardCard } from "@/components/ui/boneyard-skeleton";
import {
  Megaphone, Plus, Copy, Trash2, ChevronDown, ChevronUp,
  Send, Save, X, Palette, Eye, ExternalLink, Check, Bot, Globe, Webhook,
  Search, Hash, Folder, Flag, Activity, CloudSun, Gift, Clock, ArrowUpDown,
  Smile, MessageSquare, FileText, Image, Music, Video, Minus,
  Zap, Layers, ToggleLeft, Upload, Paperclip, Lock, AlertTriangle, Code, Share2, RotateCcw,
} from "lucide-react";

import type {
  QueryData, QueryDataMessage, QueryDataMessageData, QueryDataTarget,
  StatusMsg, GuildChannel, GuildRole, GuildEmoji, DraftFile, FlowActionPayload, FlowAction,
  ButtonStyle, APITopLevelComponent, APIActionRowComponent, APIContainerComponent,
  APIComponentInActionRow, APIEmbed, APIV2TextDisplay, APIAllowedMentions, ModuleRow,
} from "@/components/announcements/types";
import { ACCENT } from "@/components/announcements/constants";
import { TargetType } from "@/components/announcements/types";
import { getBackendApiUrl } from "@/lib/backend";
import {
  randomId, createMessage, getNewMessageData, cloneQueryData,
  isComponentsV2, getMessageDisplayName, formatTimestamp,
} from "@/components/announcements/utils/message";

import StatusBanner from "@/components/announcements/StatusBanner";
import MessageEditorCard from "@/components/announcements/editor/MessageEditorCard";
import CodeGenerator from "@/components/announcements/modals/CodeGenerator";
import ComponentEditModal from "@/components/announcements/modals/ComponentEditModal";
import DiscordPreview from "@/components/announcements/preview/DiscordPreview";

export default function GuildAnnouncementsPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<Record<string, any> | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [serverEmojis, setServerEmojis] = useState<GuildEmoji[]>([]);

  const [data, setData] = useState<QueryData>(() => ({
    version: "d2",
    messages: [{ _id: randomId(), data: {} }],
    targets: [],
  }));
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(0);
  const [status, setStatus] = useState<StatusMsg>(null);
  const [editTab, setEditTab] = useState<"content" | "embed" | "files" | "components" | "json">("content");
  const [messageFiles, setMessageFiles] = useState<Record<string, DraftFile[]>>({});
  const [editingComponent, setEditingComponent] = useState<APIComponentInActionRow | null>(null);
  const [editingComponentPos, setEditingComponentPos] = useState<{ ri: number; ci: number } | null>(null);
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [newMsgFlags, setNewMsgFlags] = useState<number | undefined>(undefined);
  const [addMsgOpen, setAddMsgOpen] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [codeGenOpen, setCodeGenOpen] = useState(false);

  const [presets, setPresets] = useState<{ id: string; name: string; kind: "draft" | "template"; data: QueryData }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(false);

  const message = data.messages[selectedMessageIndex];
  const isV2 = isComponentsV2(message?.data.flags);

  useEffect(() => {
    if (!guildId || typeof guildId !== "string") return;
    (async () => {
      try {
        const [ovRes, chRes, emRes] = await Promise.all([
          fetch(`/api/dashboard/guild/${guildId}/overview`),
          fetch(`/api/guilds/${guildId}/channels`),
          fetch(`/api/guilds/${guildId}/emojis`),
        ]);
        if ([ovRes.status, chRes.status, emRes.status].some((s) => s === 401)) { router.replace("/api/auth/discord"); return; }
        const ov = await ovRes.json();
        const ch = await chRes.json().catch(() => ({ channels: [] }));
        const em = await emRes.json().catch(() => ({ emojis: [] }));
        setGuild(ov.guild);
        setModules(ov.modules || []);
        setChannels(Array.isArray(ch.channels) ? ch.channels.filter((c: GuildChannel) => c.type === 0) : []);
        setServerEmojis(Array.isArray(em.emojis) ? em.emojis : []);
        const communityModule = (ov.modules || []).find((m: ModuleRow) => m.name === "community");
        const savedPresets = communityModule?.config?.announcements_studio?.dashboardPresets;
        if (Array.isArray(savedPresets) && savedPresets.length > 0) {
          setPresets(savedPresets.map((p: any) => ({
            id: p.id || `preset-${Date.now()}`,
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

  const addEmbed = useCallback(() => {
    const embeds = [...(data.messages[selectedMessageIndex]?.data.embeds || [])];
    if (embeds.length >= 10) return;
    embeds.push({});
    updateMessageData({ embeds });
  }, [data, selectedMessageIndex, updateMessageData]);

  const removeEmbed = useCallback((ei: number) => {
    const embeds = data.messages[selectedMessageIndex]?.data.embeds?.filter((_, i) => i !== ei) || [];
    updateMessageData({ embeds: embeds.length > 0 ? embeds : undefined });
  }, [data, selectedMessageIndex, updateMessageData]);

  const updateEmbed = useCallback((ei: number, updates: Partial<APIEmbed>) => {
    const embeds = [...(data.messages[selectedMessageIndex]?.data.embeds || [])];
    if (!embeds[ei]) return;
    embeds[ei] = { ...embeds[ei], ...updates };
    updateMessageData({ embeds });
  }, [data, selectedMessageIndex, updateMessageData]);

  const [webhookUrl, setWebhookUrl] = useState("");
  const addTarget = useCallback(() => {
    if (!webhookUrl) return;
    const targets = [...(data.targets || [])];
    targets.push({ type: TargetType.Webhook, url: webhookUrl });
    setD({ ...data, targets });
    setWebhookUrl("");
  }, [data, webhookUrl, setD]);
  const removeTarget = useCallback((ti: number) => {
    setD({ ...data, targets: data.targets?.filter((_, i) => i !== ti) });
  }, [data, setD]);

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
    if (!name) { setStatus({ state: "error", text: "Enter a name before saving." }); return; }
    const existingIdx = presets.findIndex((p) => p.kind === kind && p.name.toLowerCase() === name.toLowerCase());
    const next = [...presets];
    const preset = { id: existingIdx >= 0 ? next[existingIdx]!.id : `preset-${Date.now()}-${randomId()}`, name, kind, data: cloneQueryData(data) };
    if (existingIdx >= 0) next[existingIdx]! = preset;
    else next.unshift(preset);
    setPresets(next);
    try {
      const communityModule = modules.find((m) => m.name === "community");
      await fetch(`/api/modules/${guildId}/community`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: communityModule?.enabled ?? true,
          config: { ...(communityModule?.config ?? {}), announcements_studio: { ...(communityModule?.config?.announcements_studio ?? {}), dashboardPresets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) } },
        }),
      });
      setStatus({ state: "success", text: `${kind === "template" ? "Template" : "Draft"} saved.` });
    } catch { setStatus({ state: "error", text: "Failed to save preset." }); }
  }, [presetName, presets, data, modules, guildId]);

  const loadPreset = useCallback((preset: { id: string; name: string; kind: "draft" | "template"; data: QueryData }) => {
    setData(cloneQueryData(preset.data));
    setPresetName(preset.name);
    setSelectedMessageIndex(0);
    setStatus({ state: "info", text: `Loaded ${preset.kind} "${preset.name}".` });
  }, [setData]);

  const deletePreset = useCallback(async (presetId: string) => {
    const next = presets.filter((p) => p.id !== presetId);
    setPresets(next);
    try {
      const communityModule = modules.find((m) => m.name === "community");
      await fetch(`/api/modules/${guildId}/community`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: communityModule?.enabled ?? true,
          config: { ...(communityModule?.config ?? {}), announcements_studio: { ...(communityModule?.config?.announcements_studio ?? {}), dashboardPresets: next.map((p) => ({ id: p.id, name: p.name, kind: p.kind, data: p.data })) } },
        }),
      });
      setStatus({ state: "success", text: "Preset deleted." });
    } catch { setStatus({ state: "error", text: "Failed to delete preset." }); }
  }, [presets, modules, guildId]);

  const handleSend = useCallback(async () => {
    if (!guildId || typeof guildId !== "string") return;
    if (selectedChannelIds.size === 0) {
      setStatus({ state: "error", text: "Select at least one channel to send to." }); return;
    }
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
            if (child.type === 9) {
              if (child.components?.some((c) => c.type === 10 && (c as APIV2TextDisplay).content)) return true;
            }
            if (child.type === 11 || child.type === 12 || child.type === 13) {
              if (child.items?.some((i: any) => i.media?.url)) return true;
            }
          }
        }
      }
      return false;
    };
    if (!data.messages.some(hasContent)) {
      setStatus({ state: "error", text: "Add content to at least one message." }); return;
    }
    setStatus({ state: "sending", text: "Sending announcement..." });
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
                if (f) { f.forEach((a) => flows.push({ ...a, ri, ci })); }
                const { _flows, ...clean } = comp as any;
                return clean;
              });
              return { type: 1, components: children };
            }
            if (row.type === 17) {
              const children = (row as any).components?.map((comp: any, ci: number) => {
                const f = comp._flows as FlowAction[] | undefined;
                if (f) { f.forEach((a) => flows.push({ ...a, ri, ci })); }
                const { _flows, ...clean } = comp;
                return clean;
              }) || [];
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
          files.forEach((f) => {
            if (f.file) fd.append(`file_${m._id || "unknown"}`, f.file, f.name);
          });
        });
        res = await fetch(`${getBackendApiUrl()}/api/guilds/${guildId}/announcements`, { method: "POST", body: fd, credentials: "include" });
      } else {
        res = await fetch(`/api/guilds/${guildId}/announcements`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseData?.error || "Failed to send");
      setStatus({ state: "success", text: "Announcement sent successfully!" });
    } catch (err) {
      setStatus({ state: "error", text: err instanceof Error ? err.message : "Failed to send" });
    }
  }, [guildId, data, selectedChannelIds]);

  if (loading) {
    return (
      <DashboardLayout guildId={String(guildId || "")} guildName="Guild" heading="Announcements" modules={[]}>
        <BoneyardCard lines={6} />
      </DashboardLayout>
    );
  }

  const msg = message?.data;

  return (
    <DashboardLayout guildId={String(guildId || "")} guildName={guild?.name || "Guild"} heading="Announcements" modules={modules}>
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

      <div className="h-[calc(100%_-_3rem)] flex">
        <div className="py-4 h-full overflow-y-scroll w-1/2">
          <div className="px-4 space-y-3">
            <StatusBanner status={status} />

            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <button type="button" onClick={() => {}}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button type="button" onClick={() => setPresetsOpen(!presetsOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
                <Save className="h-3.5 w-3.5" /> Presets
              </button>
              <button type="button" onClick={() => setCodeGenOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
                <Code className="h-3.5 w-3.5" /> Generate
              </button>
              <button type="button" onClick={() => {
                setD({ version: data.version, messages: [{ data: getNewMessageData(1, false) }] });
              }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            <div className="space-y-2">
              {Object.values(data.targets || []).map((t, ti) => (
                <div key={ti} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                    <Bot className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1 truncate">
                    <p className="text-sm font-medium text-zinc-200 truncate">{t.type === TargetType.Webhook ? t.url?.split("/").pop() || "Webhook" : `Bot: ${t.channel_id}`}</p>
                  </div>
                  <button type="button" onClick={() => removeTarget(ti)} className="text-zinc-600 hover:text-red-400"><X className="h-4 w-4" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                <button type="button" onClick={addTarget}
                  className="shrink-0 rounded-lg bg-primary/20 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/30">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-black p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400"><Hash className="mr-1 inline h-3 w-3" />Channels ({selectedChannelIds.size})</span>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllChannels} className="text-[10px] text-zinc-500 hover:text-zinc-300">All</button>
                  <button type="button" onClick={deselectAllChannels} className="text-[10px] text-zinc-500 hover:text-zinc-300">None</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {channels.length === 0 ? (
                  <p className="text-[10px] text-zinc-600">No text channels available.</p>
                ) : channels.map((ch) => {
                  const sel = selectedChannelIds.has(ch.id);
                  return (
                    <button key={ch.id} type="button" onClick={() => toggleChannel(ch.id)}
                      className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        sel ? "border-primary/50 bg-primary/10 text-primary" : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                      }`}>
                      {sel && <Check className="mr-0.5 inline h-2.5 w-2.5" />}# {ch.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={handleSend} disabled={status?.state === "sending"}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}>
                {status?.state === "sending" ? <><span className="animate-pulse">Sending...</span></> : <><Send className="h-4 w-4" /> Send</>}
              </button>
              <button type="button" onClick={() => {}}
                className="flex items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-xs font-medium text-zinc-400 hover:text-zinc-200">
                <MessageSquare className="h-3.5 w-3.5" /> {data.messages.length} msgs
              </button>
            </div>

            {data.messages.map((m, i) => {
              const isSelected = selectedMessageIndex === i;
              const mid = m._id || String(i);
              const files = messageFiles[mid] || [];
              return (
                <MessageEditorCard key={mid}
                  message={m}
                  index={i}
                  isSelected={isSelected}
                  isV2={isComponentsV2(m.data.flags)}
                  onSelect={() => setSelectedMessageIndex(i)}
                  onMoveUp={() => moveMessage(i, "up")}
                  onMoveDown={() => moveMessage(i, "down")}
                  canMoveUp={i > 0}
                  canMoveDown={i < data.messages.length - 1}
                  onDuplicate={() => duplicateMessage(i)}
                  onRemove={() => removeMessage(i)}
                  updateMessageData={(upd) => {
                    const next = [...data.messages];
                    next[i] = { ...next[i]!, data: { ...next[i]!.data, ...upd } };
                    setD({ ...data, messages: next });
                  }}
                  files={files}
                  setFiles={(f) => setMessageFiles((prev) => ({ ...prev, [mid]: f }))}
                  editTab={isSelected ? editTab : "content"}
                  setEditTab={isSelected ? setEditTab : undefined}
                  serverEmojis={serverEmojis}
                  onEditComponent={(comp, ri, ci) => { setEditingComponent(comp); setEditingComponentPos({ ri: ri!, ci: ci! }); setComponentModalOpen(true); }}
                />
              );
            })}

            <div className="relative">
              <button type="button" onClick={() => setAddMsgOpen(!addMsgOpen)}
                disabled={data.messages.length >= 10}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-800 py-3 text-sm font-medium text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-40">
                <Plus className="h-4 w-4" /> Add Message
              </button>
              {addMsgOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-zinc-800 bg-black shadow-xl overflow-hidden">
                  <button type="button" onClick={() => { addMessage(false); setAddMsgOpen(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800">
                    <MessageSquare className="h-5 w-5 text-zinc-500" />
                    <div className="text-left">
                      <p className="font-medium">Standard Message</p>
                      <p className="text-[10px] text-zinc-500">Content with embeds and action rows</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => { addMessage(true); setAddMsgOpen(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 border-t border-zinc-800">
                    <Layers className="h-5 w-5 text-zinc-500" />
                    <div className="text-left">
                      <p className="font-medium">Components V2 Message</p>
                      <p className="text-[10px] text-zinc-500">Containers with text, media, sections</p>
                    </div>
                    <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold text-white uppercase" style={{ backgroundColor: ACCENT }}>New</span>
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-black p-3">
              <button type="button" onClick={() => setPresetsOpen(!presetsOpen)}
                className="flex w-full items-center justify-between">
                <span className="text-xs font-medium text-zinc-400"><Save className="mr-1 inline h-3.5 w-3.5" /> Presets ({presets.length})</span>
                <ChevronDown className={`h-3 w-3 text-zinc-500 transition-transform ${presetsOpen ? "rotate-180" : ""}`} />
              </button>
              {presetsOpen && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Preset name..." maxLength={80}
                      className="min-w-0 flex-1 rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                    <button type="button" onClick={() => savePreset("draft")}
                      className="rounded px-2 py-1 text-[9px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">Draft</button>
                    <button type="button" onClick={() => savePreset("template")}
                      className="rounded px-2 py-1 text-[9px] font-medium bg-violet-500/10 text-violet-400 hover:bg-violet-500/20">Template</button>
                  </div>
                  {presets.length > 0 && (
                    <div className="max-h-28 space-y-1 overflow-y-auto">
                      {presets.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 rounded border border-zinc-800 bg-black px-2.5 py-1.5 text-xs">
                          <button type="button" onClick={() => loadPreset(p)}
                            className="min-w-0 flex-1 truncate text-left text-zinc-400 hover:text-zinc-200">{p.name}</button>
                          <span className={`shrink-0 text-[9px] uppercase ${p.kind === "template" ? "text-violet-400" : "text-amber-400"}`}>{p.kind === "template" ? "T" : "D"}</span>
                          <button type="button" onClick={() => deletePreset(p.id)} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <hr className="border-zinc-800" />
            <div className="flex items-center gap-3 pb-4 text-[10px] text-zinc-600">
              <Megaphone className="h-3.5 w-3.5 text-zinc-700" />
              <p>Announcements Studio</p>
              <span className="text-zinc-800">&middot;</span>
              <span>{data.messages.length} message{data.messages.length !== 1 ? "s" : ""}</span>
              {data.targets?.length ? <><span className="text-zinc-800">&middot;</span><span>{data.targets.length} target{data.targets.length !== 1 ? "s" : ""}</span></> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col w-1/2 border-s-2 border-zinc-800">
          <div className="overflow-y-scroll grow p-4 pb-8">
            {data.messages.map((m, i) => {
              const mid = m._id || String(i);
              return (
                <DiscordPreview key={`preview-${mid}`}
                  message={m.data}
                  isV2={isComponentsV2(m.data.flags)}
                  targets={data.targets}
                  onEditComponent={(comp, ri, ci) => { setEditingComponent(comp); setEditingComponentPos({ ri: ri!, ci: ci! }); setComponentModalOpen(true); }}
                  files={messageFiles[mid]} />
              );
            })}
            {data.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Eye className="mb-4 h-12 w-12 text-zinc-700" />
                <p className="text-sm text-zinc-500">No messages yet</p>
                <p className="mt-1 text-xs text-zinc-600">Add a message to see the preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

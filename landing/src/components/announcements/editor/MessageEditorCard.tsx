import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
  Image,
  FileText,
  Code,
  Layers,
  MessageSquare,
  BellOff,
  BellMinus,
  X,
} from "lucide-react";
import type {
  APIComponentInActionRow,
  APIEmbed,
  DraftFile,
  GuildEmoji,
  QueryDataMessage,
  QueryDataMessageData,
} from "../types";
import { getMessageLimitWarnings, hasFlag } from "../utils/message";
import { DISCORD_LIMITS } from "../types";
import FileAttachmentEditor from "./FileAttachmentEditor";
import ComponentEditorForMessage from "./ComponentEditorForMessage";
import EmbedEditor from "./EmbedEditor";
import { messageDataSchema } from "./JsonEditor";

function JsonEditorInline({
  messageData,
  onChange,
}: {
  messageData: QueryDataMessageData;
  onChange: (d: QueryDataMessageData) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(messageData, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setText(value);
    setError(null);
    try {
      const parsed = JSON.parse(value);
      const result = messageDataSchema.safeParse(parsed);
      if (!result.success) {
        const issues = result.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        );
        setError(issues[0] ?? null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-1">
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        className="h-32 w-full resize-none rounded bg-black px-2 py-1.5 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-500"
        spellCheck={false}
      />
      {error && <p className="text-[9px] text-red-400">{error}</p>}
      {!error && text !== JSON.stringify(messageData, null, 2) && (
        <button
          type="button"
          onClick={() => {
            try {
              onChange(JSON.parse(text));
            } catch {}
          }}
          className="rounded px-2 py-1 text-[9px] font-medium text-primary hover:bg-primary/10"
        >
          Apply Changes
        </button>
      )}
    </div>
  );
}

export default function MessageEditorCard({
  message,
  index,
  isSelected,
  isV2,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDuplicate,
  onRemove,
  updateMessageData,
  files,
  setFiles,
  editTab,
  setEditTab,
  serverEmojis,
  onEditComponent,
}: {
  message: QueryDataMessage;
  index: number;
  isSelected: boolean;
  isV2: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  updateMessageData: (upd: Partial<QueryDataMessageData>) => void;
  files: DraftFile[];
  setFiles: (f: DraftFile[]) => void;
  editTab: string;
  setEditTab:
    | ((t: "content" | "embed" | "files" | "components" | "json") => void)
    | undefined;
  serverEmojis: GuildEmoji[];
  onEditComponent: (
    comp: APIComponentInActionRow,
    ri: number,
    ci: number,
  ) => void;
}) {
  const [collapsed, setCollapsed] = useState(!isSelected);
  useEffect(() => {
    if (isSelected) setCollapsed(false);
  }, [isSelected]);

  const msg = message.data;
  const [localTab, setLocalTab] = useState<
    "content" | "embed" | "files" | "components" | "json"
  >("content");
  const activeTab = setEditTab ? (editTab as any) : localTab;
  const setActiveTab = setEditTab ? setEditTab : setLocalTab;

  const warnings = getMessageLimitWarnings(msg);

  const getContentLength = () => msg.content?.length ?? 0;
  const getTotalEmbedLength = () => {
    if (!msg.embeds) return 0;
    let total = 0;
    for (const e of msg.embeds) {
      total += (e.title?.length ?? 0) + (e.description?.length ?? 0);
      total += (e.author?.name?.length ?? 0) + (e.footer?.text?.length ?? 0);
      for (const f of e.fields ?? []) {
        total += (f.name?.length ?? 0) + (f.value?.length ?? 0);
      }
    }
    return total;
  };

  const embedLength = getTotalEmbedLength();
  const contentLen = getContentLength();

  return (
    <div
      className={`rounded-lg transition-colors ${
        isSelected
          ? "bg-primary/5"
          : "bg-black hover:bg-zinc-900/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect();
            setCollapsed(!collapsed);
          }}
          className="min-w-0 flex-1 text-left truncate"
        >
          <span className="text-xs font-medium text-zinc-300">
            {isV2 && (
              <span className="mr-1 rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary">
                V2
              </span>
            )}
            {message.name ||
              msg.content?.slice(0, 40) ||
              (msg.embeds?.[0]?.title?.slice(0, 40) ?? `Message ${index + 1}`)}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate"
            className="text-zinc-600 hover:text-zinc-300"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove"
            className="text-zinc-600 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-zinc-600 hover:text-zinc-300"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-180"}`}
            />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-3 py-3 space-y-3">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 rounded bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300"
                >
                  <span>&#9888;</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 rounded-lg bg-black p-0.5">
            {(
              ["content", "embed", "files", "components", "json"] as const
            ).filter(tab => !(isV2 && tab === "embed")).map((tab) => {
              const labels: Record<string, string> = {
                content: `Content${contentLen > 0 ? ` (${contentLen})` : ""}`,
                embed: `Embeds${msg.embeds ? ` (${msg.embeds.length})` : " (0)"}`,
                files: `Files${files.length > 0 ? ` (${files.length})` : ""}`,
                components: "Components",
                json: "JSON",
              };
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-primary/15 text-primary"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab === "files" ? (
                    <>
                      <Image className="mr-0.5 inline h-2.5 w-2.5" />
                      {labels[tab]}
                    </>
                  ) : tab === "embed" ? (
                    <>
                      <FileText className="mr-0.5 inline h-2.5 w-2.5" />
                      {labels[tab]}
                    </>
                  ) : tab === "json" ? (
                    <>
                      <Code className="mr-0.5 inline h-2.5 w-2.5" />
                      {labels[tab]}
                    </>
                  ) : tab === "components" ? (
                    <>
                      <Layers className="mr-0.5 inline h-2.5 w-2.5" />
                      {labels[tab]}
                    </>
                  ) : (
                    labels[tab]
                  )}
                </button>
              );
            })}
          </div>

          {/* Content Tab */}
          {activeTab === "content" && (
            <div>
              {isV2 && (
                <div className="mb-2 flex items-start gap-1.5 rounded border border-yellow-700/40 bg-yellow-500/10 px-2.5 py-1.5 text-[10px] text-yellow-300">
                  <span>&#9888;</span>
                  <span>V2 messages: content field is ignored by Discord. Use Text Display components instead.</span>
                </div>
              )}
              <textarea
                value={msg.content ?? ""}
                onChange={(e) =>
                  updateMessageData({
                    content: e.target.value || undefined,
                  })
                }
                placeholder="Message content (supports Discord markdown)"
                rows={5}
                maxLength={2000}
                className="w-full resize-none rounded-lg bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
              <div className="mt-1 text-right text-[10px] text-zinc-600">
                <span
                  className={
                    contentLen >= 2000
                      ? "text-red-400"
                      : contentLen >= 1800
                        ? "text-yellow-500"
                        : ""
                  }
                >
                  {contentLen}/2000
                </span>
              </div>
            </div>
          )}

          {/* Embeds Tab */}
          {activeTab === "embed" && (
            <div className="space-y-2">
              {isV2 && (
                <div className="flex items-start gap-1.5 rounded bg-yellow-500/10 px-2.5 py-1.5 text-[10px] text-yellow-300">
                  <span>&#9888;</span>
                  <span>V2 messages: embeds are ignored by Discord. Remove the V2 flag or use embed-free components.</span>
                </div>
              )}
              {/* Total embed length warning */}
              {embedLength > 6000 && (
                <div className="flex items-start gap-1.5 rounded bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300">
                  <span>&#9888;</span>
                  <span>
                    Total embed characters exceed {embedLength.toLocaleString()}
                    /6,000
                  </span>
                </div>
              )}

              {(msg.embeds ?? []).length === 0 && (
                <div className="rounded-lg bg-zinc-800/10 p-4 text-center">
                  <FileText className="mx-auto mb-1 h-6 w-6 text-zinc-600" />
                  <p className="text-xs text-zinc-500">
                    No embeds yet. Click below to add one.
                  </p>
                </div>
              )}

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
                    updateMessageData({
                      embeds: embeds && embeds.length > 0 ? embeds : undefined,
                    });
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
              ))}

              <button
                type="button"
                onClick={() => {
                  const embeds = [...(msg.embeds ?? [])];
                  if (embeds.length >= 10) return;
                  embeds.push({});
                  updateMessageData({ embeds });
                }}
                disabled={(msg.embeds?.length ?? 0) >= 10}
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-800/30 py-2.5 text-xs text-zinc-500 hover:bg-zinc-700/30 hover:text-zinc-300 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Add Embed (
                {msg.embeds?.length ?? 0}/10)
              </button>
            </div>
          )}

          {/* Files Tab */}
          {activeTab === "files" && (
            <FileAttachmentEditor
              files={files}
              onChange={setFiles}
              messageData={msg}
              updateMessageData={updateMessageData}
            />
          )}

          {/* JSON Tab */}
          {activeTab === "json" && (
            <JsonEditorInline
              messageData={msg}
              onChange={(updated) => updateMessageData(updated)}
            />
          )}

          {/* Components Tab */}
          {activeTab === "components" && (
            <ComponentEditorForMessage
              components={msg.components ?? []}
              onChange={(comps) => updateMessageData({ components: comps })}
              onEditComponent={onEditComponent}
              isV2={isV2}
            />
          )}

          {/* Message flags row */}
          <div className="flex flex-wrap gap-2 pt-1">
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input
                type="checkbox"
                checked={hasFlag(msg.flags, 4)}
                onChange={(e) => {
                  let f = msg.flags || 0;
                  f = e.target.checked ? f | 4 : f & ~4;
                  updateMessageData({ flags: f || undefined });
                }}
                className="h-3 w-3 rounded border-zinc-700 bg-zinc-800"
              />
              <BellOff className="h-2.5 w-2.5" /> Suppress Embeds
            </label>
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input
                type="checkbox"
                checked={hasFlag(msg.flags, 4096)}
                onChange={(e) => {
                  let f = msg.flags || 0;
                  f = e.target.checked ? f | 4096 : f & ~4096;
                  updateMessageData({ flags: f || undefined });
                }}
                className="h-3 w-3 rounded border-zinc-700 bg-zinc-800"
              />
              <BellOff className="h-2.5 w-2.5" /> Suppress Notifications
            </label>
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input
                type="checkbox"
                checked={!!msg.allowed_mentions}
                onChange={(e) =>
                  updateMessageData({
                    allowed_mentions: e.target.checked
                      ? { parse: ["users", "roles"] }
                      : undefined,
                  })
                }
                className="h-3 w-3 rounded border-zinc-700 bg-zinc-800"
              />
              <BellMinus className="h-2.5 w-2.5" /> Allow Mentions
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

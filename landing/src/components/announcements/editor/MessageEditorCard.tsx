import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Paperclip, Plus, Trash2, X } from "lucide-react";
import type { APIComponentInActionRow, APIEmbed, DraftFile, GuildEmoji, QueryDataMessage, QueryDataMessageData } from "../types";
import { getMessageDisplayName, getMessageLimitWarnings, hasFlag } from "../utils/message";
import FileAttachmentEditor from "./FileAttachmentEditor";
import ComponentEditorForMessage from "./ComponentEditorForMessage";
import { messageDataSchema } from "./JsonEditor";

function JsonEditorEditorInline({ messageData, onChange }: { messageData: QueryDataMessageData; onChange: (d: QueryDataMessageData) => void }) {
  const [text, setText] = useState(() => JSON.stringify(messageData, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(false);

  const handleChange = (value: string) => {
    setText(value);
    setError(null);
    setValid(false);
    try {
      const parsed = JSON.parse(value);
      const result = messageDataSchema.safeParse(parsed);
      if (result.success) { setValid(true); }
      else { const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`); setError(issues[0] ?? null); }
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="space-y-1">
      <textarea value={text} onChange={(e) => handleChange(e.target.value)}
        className="h-32 w-full resize-none rounded border border-zinc-800 bg-black px-2 py-1.5 font-mono text-[11px] text-zinc-200 outline-none" spellCheck={false} />
      {error && <p className="text-[9px] text-red-400">{error}</p>}
      {valid && (
        <button type="button" onClick={() => { try { onChange(JSON.parse(text)); } catch {} }}
          className="rounded px-2 py-1 text-[9px] font-medium text-primary hover:bg-primary/10">Apply Changes</button>
      )}
    </div>
  );
}

export default function MessageEditorCard({ message, index, isSelected, isV2, onSelect, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onDuplicate, onRemove, updateMessageData, files, setFiles, editTab, setEditTab, serverEmojis, onEditComponent }: {
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
  setEditTab: ((t: "content" | "embed" | "files" | "components" | "json") => void) | undefined;
  serverEmojis: GuildEmoji[];
  onEditComponent: (comp: APIComponentInActionRow, ri: number, ci: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(!isSelected);
  useEffect(() => { if (isSelected) setCollapsed(false); }, [isSelected]);

  const msg = message.data;
  const [localTab, setLocalTab] = useState<"content" | "embed" | "files" | "components" | "json">("content");
  const activeTab = setEditTab ? editTab : localTab;
  const setActiveTab = setEditTab ? setEditTab : setLocalTab;

  const ws = getMessageLimitWarnings(msg);

  const handleDataChange = (upd: Partial<QueryDataMessageData>) => {
    updateMessageData(upd);
    onSelect();
  };

  return (
    <div className={`rounded-lg border transition-colors ${
      isSelected ? "border-primary/40 bg-primary/5" : "border-zinc-800 bg-black hover:border-zinc-700"
    }`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-2.5 w-2.5" /></button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-2.5 w-2.5" /></button>
        </div>
        <button type="button" onClick={() => { onSelect(); setCollapsed(!collapsed); }}
          className="min-w-0 flex-1 text-left truncate">
          <span className="text-xs font-medium text-zinc-300">
            {isV2 && <span className="mr-1 rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary">V2</span>}
            {getMessageDisplayName(undefined, index, message)}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onDuplicate} title="Duplicate" className="text-zinc-600 hover:text-zinc-300"><Copy className="h-3 w-3" /></button>
          <button type="button" onClick={onRemove} title="Remove" className="text-zinc-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
          <button type="button" onClick={() => setCollapsed(!collapsed)}
            className="text-zinc-600 hover:text-zinc-300"><ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-180"}`} /></button>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-zinc-800 px-3 py-3 space-y-3">
          {ws.length > 0 && (
            <div className="space-y-1">
              {ws.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 rounded border border-red-700/40 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300">
                  <span>&#9888;</span><span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-1 rounded-lg border border-zinc-800 bg-black p-0.5">
            {(["content", "embed", "files", "components", "json"] as const).map((tab) => {
              const labels: Record<string, string> = {
                content: "Content", embed: `Embeds (${msg?.embeds?.length || 0})`,
                files: `Files (${files.length})`, components: "Components", json: "JSON",
              };
              return (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                    activeTab === tab ? "bg-primary/15 text-primary" : "text-zinc-500 hover:text-zinc-300"
                  }`}>
                  {tab === "files" ? <><Paperclip className="mr-0.5 inline h-2.5 w-2.5" />{labels[tab]}</> : labels[tab]}
                </button>
              );
            })}
          </div>

          {activeTab === "content" && (
            <textarea value={msg?.content || ""} onChange={(e) => handleDataChange({ content: e.target.value || undefined })}
              placeholder="Message content..." rows={4} maxLength={2000}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none" />
          )}

          {activeTab === "embed" && (
            <div className="space-y-2">
              <button type="button" onClick={() => {
                const embeds = [...(msg?.embeds || [])];
                if (embeds.length >= 10) return;
                embeds.push({});
                handleDataChange({ embeds });
              }} disabled={(msg?.embeds?.length || 0) >= 10}
                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-zinc-800 py-2 text-[10px] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-40">
                <Plus className="h-3 w-3" /> Add Embed ({(msg?.embeds?.length || 0)}/10)
              </button>
              {(msg?.embeds || []).map((embed, ei) => (
                <div key={ei} className="rounded border border-zinc-800 bg-black p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-medium text-zinc-500">Embed {ei + 1}</span>
                    <button type="button" onClick={() => {
                      const embeds = msg?.embeds?.filter((_, i) => i !== ei) || [];
                      handleDataChange({ embeds: embeds.length > 0 ? embeds : undefined });
                    }} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                  </div>
                  <input type="text" value={embed.title || ""} onChange={(e) => {
                    const embeds = [...(msg?.embeds || [])];
                    embeds[ei] = { ...embeds[ei], title: e.target.value || undefined };
                    handleDataChange({ embeds });
                  }} placeholder="Title" maxLength={256}
                    className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                  <textarea value={embed.description || ""} onChange={(e) => {
                    const embeds = [...(msg?.embeds || [])];
                    embeds[ei] = { ...embeds[ei], description: e.target.value || undefined };
                    handleDataChange({ embeds });
                  }} placeholder="Description" rows={2} maxLength={4000}
                    className="w-full resize-none rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                  <input type="text" value={embed.url || ""} onChange={(e) => {
                    const embeds = [...(msg?.embeds || [])];
                    embeds[ei] = { ...embeds[ei], url: e.target.value || undefined };
                    handleDataChange({ embeds });
                  }} placeholder="URL"
                    className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                </div>
              ))}
            </div>
          )}

          {activeTab === "files" && (
            <FileAttachmentEditor files={files} onChange={setFiles} />
          )}

          {activeTab === "json" && (
            <JsonEditorEditorInline messageData={msg} onChange={(updated) => handleDataChange(updated)} />
          )}

          {activeTab === "components" && (
            <ComponentEditorForMessage
              components={msg?.components || []}
              onChange={(comps) => handleDataChange({ components: comps })}
              onEditComponent={onEditComponent}
              serverEmojis={serverEmojis}
              isV2={isV2} />
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input type="checkbox" checked={hasFlag(msg.flags, 4)}
                onChange={(e) => {
                  let f = msg.flags || 0;
                  f = e.target.checked ? f | 4 : f & ~4;
                  handleDataChange({ flags: f || undefined });
                }}
                className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
              Suppress Embeds
            </label>
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input type="checkbox" checked={hasFlag(msg.flags, 4096)}
                onChange={(e) => {
                  let f = msg.flags || 0;
                  f = e.target.checked ? f | 4096 : f & ~4096;
                  handleDataChange({ flags: f || undefined });
                }}
                className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
              Suppress Notifications
            </label>
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input type="checkbox" checked={!!msg.allowed_mentions}
                onChange={(e) => handleDataChange({ allowed_mentions: e.target.checked ? { parse: ["users", "roles"] } : undefined })}
                className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
              Allow Mentions
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

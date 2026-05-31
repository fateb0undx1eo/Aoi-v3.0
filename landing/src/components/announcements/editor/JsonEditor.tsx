import { useEffect, useState } from "react";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";
import { ACCENT } from "../constants";
import type { QueryDataMessageData } from "../types";

export const messageDataSchema = z.object({
  content: z.string().max(2000).optional(),
  embeds: z.array(z.object({
    title: z.string().max(256).optional(),
    description: z.string().max(4000).optional(),
    url: z.string().max(1000).optional(),
    color: z.number().int().optional(),
    author: z.object({ name: z.string().max(256).optional(), icon_url: z.string().max(1000).optional(), url: z.string().max(1000).optional() }).optional(),
    fields: z.array(z.object({
      name: z.string().max(256),
      value: z.string().max(1024),
      inline: z.boolean().optional(),
    })).max(25).optional(),
    footer: z.object({ text: z.string().max(2048).optional(), icon_url: z.string().max(1000).optional() }).optional(),
    image: z.object({ url: z.string().max(1000) }).optional(),
    thumbnail: z.object({ url: z.string().max(1000) }).optional(),
    timestamp: z.string().optional(),
  })).max(10).optional(),
  components: z.array(z.any()).optional(),
  flags: z.number().int().optional(),
  thread_name: z.string().max(100).optional(),
  allowed_mentions: z.object({ parse: z.array(z.string()).optional(), users: z.array(z.string()).optional(), roles: z.array(z.string()).optional(), replied_user: z.boolean().optional() }).optional(),
});

export default function JsonEditor({ messageData, onChange }: { messageData: QueryDataMessageData; onChange: (d: QueryDataMessageData) => void }) {
  const [text, setText] = useState(() => JSON.stringify(messageData, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<QueryDataMessageData | null>(null);

  useEffect(() => {
    setText(JSON.stringify(messageData, null, 2));
    setError(null);
    setWarnings([]);
    setPreview(null);
  }, [messageData]);

  const handleChange = (value: string) => {
    setText(value);
    setError(null);
    setWarnings([]);
    setPreview(null);
    try {
      const parsed = JSON.parse(value);
      const result = messageDataSchema.safeParse(parsed);
      if (result.success) {
        setPreview(result.data as QueryDataMessageData);
      } else {
        const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        setWarnings(issues.slice(0, 10));
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError(e.message);
      }
    }
  };

  const handleApply = () => {
    if (preview) onChange(preview);
  };

  const isValid = preview !== null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-500">Edit raw message data. Changes validated against Discord API limits.</p>
        <button type="button" onClick={handleApply} disabled={!isValid}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
            isValid ? "text-white" : "cursor-not-allowed text-zinc-600"
          }`} style={{ backgroundColor: isValid ? ACCENT : undefined }}>
          {isValid ? "Apply Changes" : "Invalid JSON"}
        </button>
      </div>
      <textarea value={text} onChange={(e) => handleChange(e.target.value)}
        className="h-52 w-full resize-none rounded-lg border border-zinc-800 bg-black/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-200 outline-none"
        spellCheck={false} />
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-0.5 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2">
          <p className="text-[10px] font-medium text-amber-400">Validation warnings ({warnings.length}):</p>
          {warnings.map((w, i) => (
            <p key={i} className="text-[10px] leading-relaxed text-amber-300/70">{w}</p>
          ))}
        </div>
      )}
      {preview && (
        <div className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Preview:</p>
          <p className="whitespace-pre-wrap text-xs text-zinc-400">
            {preview.content ? `content: "${preview.content.slice(0, 100)}${preview.content.length > 100 ? "..." : ""}"` : ""}
            {preview.embeds?.length ? `\n${preview.embeds.length} embed(s)` : ""}
            {preview.components?.length ? `\n${preview.components.length} component row(s)` : ""}
            {preview.thread_name ? `\nthread: ${preview.thread_name}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

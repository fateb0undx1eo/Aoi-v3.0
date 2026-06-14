import { Plus, X } from "lucide-react";
import type { APIEmbed, APIEmbedField } from "../types";
import ColorSwatch from "../pickers/ColorSwatch";

function EmbedFieldEditor({ fields, onChange }: { fields: APIEmbedField[]; onChange: (f: APIEmbedField[]) => void }) {
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-black p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Field {i + 1}</span>
            <label className="flex items-center gap-1 text-xs text-zinc-400">
              <input type="checkbox" checked={f.inline || false} onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, inline: e.target.checked } : x))} className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" /> Inline
            </label>
          </div>
          <input type="text" value={f.name} placeholder="Field name" onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            className="mb-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          <textarea value={f.value} placeholder="Field value" rows={2} onChange={(e) => onChange(fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            className="w-full rounded border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none outline-none" />
          <button type="button" onClick={() => onChange(fields.filter((_, j) => j !== i))} className="mt-1 text-[10px] text-zinc-600 hover:text-red-400"><X className="mr-0.5 inline h-3 w-3" /> Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, { name: "", value: "", inline: false }])}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
        <Plus className="h-3 w-3" /> Add Field
      </button>
    </div>
  );
}

export default function EmbedEditor({ embed, onChange }: { embed: APIEmbed; onChange: (e: APIEmbed) => void }) {
  const update = (updates: Partial<APIEmbed>) => onChange({ ...embed, ...updates });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input type="text" value={embed.title || ""} onChange={(e) => update({ title: e.target.value || undefined })}
            placeholder="Embed title" maxLength={256}
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
          <input type="text" value={embed.url || ""} onChange={(e) => update({ url: e.target.value || undefined })}
            placeholder="Title URL (optional)"
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600" />
          <textarea value={embed.description || ""} onChange={(e) => update({ description: e.target.value || undefined })}
            placeholder="Embed description" rows={3} maxLength={4000}
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none focus:border-zinc-600" />
        </div>
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <span className="text-[10px] text-zinc-500">Color</span>
          <ColorSwatch value={embed.color ?? null} onChange={(v) => update({ color: v ?? undefined })} />
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Author</h3>
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={embed.author?.name || ""} onChange={(e) => update({ author: { name: e.target.value || embed.author?.name || "", icon_url: embed.author?.icon_url, url: embed.author?.url } })}
            placeholder="Author name" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          <input type="text" value={embed.author?.icon_url || ""} onChange={(e) => update({ author: { name: embed.author?.name || "", icon_url: e.target.value || undefined, url: embed.author?.url } })}
            placeholder="Icon URL" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          <input type="text" value={embed.author?.url || ""} onChange={(e) => update({ author: { name: embed.author?.name || "", icon_url: embed.author?.icon_url, url: e.target.value || undefined } })}
            placeholder="Author URL" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Fields ({embed.fields?.length || 0}/25)</h3>
        <EmbedFieldEditor fields={embed.fields || []} onChange={(fields) => update({ fields })} />
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Images</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Thumbnail URL</label>
            <input type="text" value={embed.thumbnail?.url || ""} onChange={(e) => update({ thumbnail: e.target.value ? { url: e.target.value } : undefined })}
              placeholder="https://..." className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Image URL</label>
            <input type="text" value={embed.image?.url || ""} onChange={(e) => update({ image: e.target.value ? { url: e.target.value } : undefined })}
              placeholder="https://..." className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">Footer &amp; Timestamp</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={embed.footer?.text || ""} onChange={(e) => update({ footer: { text: e.target.value || embed.footer?.text || "", icon_url: embed.footer?.icon_url } })}
              placeholder="Footer text" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
            <input type="text" value={embed.footer?.icon_url || ""} onChange={(e) => update({ footer: { text: embed.footer?.text || "", icon_url: e.target.value || undefined } })}
              placeholder="Icon URL" className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          </div>
          <input type="datetime-local" value={embed.timestamp?.slice(0, 16) || ""} onChange={(e) => update({ timestamp: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
            className="w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-200 outline-none" />
        </div>
      </div>
    </div>
  );
}

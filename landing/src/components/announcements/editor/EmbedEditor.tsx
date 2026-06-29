import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Copy, Plus, Trash2, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import type { APIEmbed, APIEmbedField } from "../types";
import { DISCORD_LIMITS } from "../types";
import { isEmbedEmpty, getEmbedLength, getEmbedErrors } from "../utils/message";
import { getPlacement } from "../utils/placement";

function ColorPickerPopover({
 value,
 onChange,
}: {
 value: number | null | undefined;
 onChange: (v: number | undefined) => void;
}) {
 const hex =
  typeof value === "number"
   ? `#${value.toString(16).padStart(6, "0")}`
   : "#8B1538";
 const [open, setOpen] = useState(false);
 const [placement, setPlacement] = useState<"below" | "above">("below");
 const popoverRef = useRef<HTMLDivElement>(null);
 const btnRef = useRef<HTMLButtonElement>(null);

 useEffect(() => {
  const handleClick = (e: MouseEvent) => {
   if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
    setOpen(false);
  };
  if (open) document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
 }, [open]);

 const toggle = () => {
  if (!open) {
   if (btnRef.current) setPlacement(getPlacement(btnRef.current));
  }
  setOpen(!open);
 };

 return (
  <div ref={popoverRef} style={{ position: "relative" }}>
   <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
    <button ref={btnRef} type="button" onClick={toggle}
     style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 10px", borderRadius: 6,
      backgroundColor: "rgba(0,0,0,0.3)", cursor: "pointer",
      fontSize: 11, color: "#a1a1aa", fontFamily: "monospace",
     }}>
     <div style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: hex, flexShrink: 0 }} />
     {hex}
    </button>
    {value != null && (
     <button type="button" onClick={() => onChange(undefined)}
      style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", fontSize: 10, padding: 2 }}>
      Reset
     </button>
    )}
   </div>
   {open && (
    <div style={{
     position: "absolute", left: 0, zIndex: 30,
     top: placement === "below" ? "calc(100% + 4px)" : undefined,
     bottom: placement === "above" ? "calc(100% + 4px)" : undefined,
      borderRadius: 8,
     backgroundColor: "#111111", padding: 10,
     boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
     <HexColorPicker
      color={hex}
      onChange={(h) => {
       const num = Number.parseInt(h.replace("#", ""), 16);
       if (!isNaN(num)) onChange(num);
      }}
      style={{ width: 200, height: 160 }}
     />
     <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <span style={{ fontSize: 10, color: "#52525b", fontFamily: "monospace", alignSelf: "center" }}>#</span>
      <input type="text" value={hex.replace("#", "")}
       onChange={(e) => {
        const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
        if (v.length <= 6) {
         const num = Number.parseInt(v, 16);
         onChange(!isNaN(num) ? num : undefined);
        }
       }}
       style={{
        flex: 1, background: "transparent", border: "none", borderBottom: "1px solid #3f3f46",
        color: "#a1a1aa", fontSize: 11, fontFamily: "monospace", outline: "none",
       }}
      />
     </div>
    </div>
   )}
  </div>
 );
}

function EmbedFieldEditor({
 fields,
 onChange,
}: {
 fields: APIEmbedField[];
 onChange: (f: APIEmbedField[]) => void;
}) {
 const addField = useCallback(() => {
  if (fields.length >= 25) return;
  onChange([...fields, { name: "", value: "", inline: false }]);
 }, [fields, onChange]);

 const removeField = useCallback(
  (i: number) => onChange(fields.filter((_, j) => j !== i)),
  [onChange],
 );

 const updateField = useCallback(
  (i: number, upd: Partial<APIEmbedField>) =>
   onChange(fields.map((f, j) => (j === i ? { ...f, ...upd } : f))),
  [fields, onChange],
 );

 const moveField = useCallback(
  (i: number, dir: "up" | "down") => {
   const t = dir === "up" ? i - 1 : i + 1;
   if (t < 0 || t >= fields.length) return;
   const next = [...fields];
   [next[i], next[t]] = [next[t]!, next[i]!];
   onChange(next);
  },
  [fields, onChange],
 );

 return (
  <div className="space-y-2">
   {fields.map((f, i) => (
    <div
     key={i}
     className="rounded-lg bg-zinc-800/20 p-2 space-y-1.5"
    >
     <div className="flex items-center justify-between gap-1">
      <span className="text-[10px] font-medium text-zinc-500">
       FIELD {i + 1}
      </span>
      <span className="text-[8px] text-zinc-600">name 256 | value 1024</span>
      <div className="flex items-center gap-1">
       <button
        type="button"
        disabled={i === 0}
        onClick={() => moveField(i, "up")}
        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
       >
        <ChevronUp className="h-3 w-3" />
       </button>
       <button
        type="button"
        disabled={i === fields.length - 1}
        onClick={() => moveField(i, "down")}
        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
       >
        <ChevronDown className="h-3 w-3" />
       </button>
       <button
        type="button"
        onClick={() => {
         onChange([
          ...fields.slice(0, i + 1),
          { ...f },
          ...fields.slice(i + 1),
         ]);
        }}
        className="text-zinc-600 hover:text-zinc-300"
       >
        <Copy className="h-3 w-3" />
       </button>
       <button
        type="button"
        onClick={() => removeField(i)}
        className="text-zinc-600 hover:text-red-400"
       >
        <Trash2 className="h-3 w-3" />
       </button>
      </div>
     </div>
     <div className="flex items-center gap-2">
      <div className="flex-1">
       <input
        type="text"
        value={f.name}
        onChange={(e) => updateField(i, { name: e.target.value })}
        placeholder="Field name"
        maxLength={DISCORD_LIMITS.FIELD_NAME}
        className="w-full rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
       />
       <div className="mt-0.5 text-right text-[9px] text-zinc-600">
        {(f.name?.length ?? 0)}/{DISCORD_LIMITS.FIELD_NAME}
       </div>
      </div>
      <label className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0">
       <input
        type="checkbox"
        checked={!!f.inline}
        onChange={(e) => updateField(i, { inline: e.target.checked })}
        className="h-3 w-3 rounded border-zinc-600 bg-zinc-800"
       />
       Inline
      </label>
     </div>
     <div>
      <textarea
       value={f.value}
       onChange={(e) => updateField(i, { value: e.target.value })}
       placeholder="Field value"
       rows={2}
       maxLength={DISCORD_LIMITS.FIELD_VALUE}
        className="w-full resize-none rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
       />
       <div className="mt-0.5 text-right text-[9px] text-zinc-600">
        {(f.value?.length ?? 0)}/{DISCORD_LIMITS.FIELD_VALUE}
      </div>
     </div>
    </div>
   ))}
   <button
    type="button"
    onClick={addField}
    disabled={fields.length >= 25}
    className="flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-800/30 py-2 text-xs text-zinc-500 hover:bg-zinc-700/30 hover:text-zinc-300 disabled:opacity-40"
   >
    <Plus className="h-3 w-3" /> Add Field {fields.length}/25
   </button>
  </div>
 );
}

export default function EmbedEditor({
 embed,
 onChange,
 embedIndex,
 maxEmbeds,
 onRemove,
 onMoveUp,
 onMoveDown,
 canMoveUp,
 canMoveDown,
}: {
 embed: APIEmbed;
 onChange: (e: APIEmbed) => void;
 embedIndex?: number;
 maxEmbeds?: number;
 onRemove?: () => void;
 onMoveUp?: () => void;
 onMoveDown?: () => void;
 canMoveUp?: boolean;
 canMoveDown?: boolean;
}) {
 const errors = getEmbedErrors(embed);
 const embedLen = getEmbedLength(embed);
 const isEmpty = isEmbedEmpty(embed);

 const update = (upd: Partial<APIEmbed>) => {
  let next = { ...embed, ...upd };
  if (next.author && !next.author.name && !next.author.icon_url && !next.author.url) {
   next.author = undefined;
  }
  if (next.footer && !next.footer.text && !next.footer.icon_url) {
   next.footer = undefined;
  }
  onChange(next);
 };

 const colorHex =
  typeof embed.color === "number"
   ? `#${embed.color.toString(16).padStart(6, "0")}`
   : undefined;

 return (
  <div
   className="rounded-lg bg-zinc-800/10"
   style={
    colorHex
     ? { borderLeftColor: colorHex, borderLeftWidth: 4 }
     : { borderLeftWidth: 4, borderLeftColor: "#4a4a50" }
   }
  >
   {/* Header with embed index, move, duplicate, remove */}
   {embedIndex != null && (
     <div className="flex items-center justify-between px-2.5 py-1.5">
     <span className="text-[10px] font-medium text-zinc-500">
      Embed {embedIndex + 1}{maxEmbeds != null ? ` / ${maxEmbeds}` : ""}
     </span>
     <div className="flex items-center gap-1">
      <button type="button" disabled={!canMoveUp} onClick={() => onMoveUp?.()}
       className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
      <button type="button" disabled={!canMoveDown} onClick={() => onMoveDown?.()}
       className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
      {onRemove && (
       <button type="button" onClick={onRemove}
        className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
      )}
     </div>
    </div>
   )}
   <div className="px-2.5 pb-2.5 space-y-2 pt-2">
    {/* Validation errors */}
    {errors.length > 0 && (
     <div className="space-y-1">
      {errors.map((err, i) => (
       <div
        key={i}
         className="flex items-start gap-1.5 rounded bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300"
       >
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
        <span>{err}</span>
       </div>
      ))}
     </div>
    )}

    {/* Empty embed notice */}
    {isEmpty && (
     <div className="rounded bg-zinc-800/10 px-3 py-2 text-[10px] text-zinc-500">
      This embed is empty and won't appear in the preview. Add a title, description, or other content.
     </div>
    )}

    {/* Total character count */}
    <div className="flex justify-between items-center">
     <span className="text-[10px] text-zinc-500">Embed total</span>
     <span className={`text-[10px] font-mono ${embedLen > DISCORD_LIMITS.TOTAL_EMBED_CHARS ? "text-red-400" : embedLen > 5000 ? "text-yellow-500" : "text-zinc-500"}`}>
      {embedLen}/{DISCORD_LIMITS.TOTAL_EMBED_CHARS}
     </span>
    </div>

    {/* Author Section */}
    <details className="group/section">
     <summary
      className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
     >
      <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
      Author <span className="text-zinc-600 font-normal" style={{ fontSize: 9 }}>name max 256</span>
     </summary>
     <div className="space-y-1">
      <div className="flex gap-1.5">
       <input
        type="text"
        value={embed.author?.name ?? ""}
        onChange={(e) =>
         update({
          author: {
           name: e.target.value,
           icon_url: embed.author?.icon_url,
           url: embed.author?.url,
          },
         })
        }
        placeholder="Author name"
        maxLength={DISCORD_LIMITS.AUTHOR_NAME}
         className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
        style={{ backgroundColor: "#111111" }}
       />
       {embed.author?.url === undefined && (
        <button
         type="button"
         onClick={() =>
          update({
           author: {
            name: embed.author?.name ?? "",
            icon_url: embed.author?.icon_url,
            url: "https://",
           },
          })
         }
         className="shrink-0 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-700"
        >
         + URL
        </button>
       )}
      </div>
      {embed.author?.url !== undefined && (
       <div className="flex gap-1.5">
        <input
         type="text"
         value={embed.author.url}
         onChange={(e) =>
          update({
           author: {
            name: embed.author?.name ?? "",
            icon_url: embed.author?.icon_url,
            url: e.target.value,
           },
          })
         }
         placeholder="https://..."
         className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
        />
        <button
         type="button"
         onClick={() => {
          const a = embed.author;
          if (a)
           update({ author: { name: a.name, icon_url: a.icon_url } });
         }}
         className="shrink-0 px-1 text-zinc-600 hover:text-zinc-300"
        >
         <X className="h-3 w-3" />
        </button>
       </div>
      )}
      <div className="flex gap-1.5 items-center">
       <input
        type="text"
        value={embed.author?.icon_url ?? ""}
        onChange={(e) =>
         update({
          author: {
           name: embed.author?.name ?? "",
           icon_url: e.target.value || undefined,
           url: embed.author?.url,
          },
         })
        }
        placeholder="Icon URL"
        className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
       />
      </div>
     </div>
    </details>

    {/* Body Section */}
    <details className="group/section">
     <summary
      className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
     >
      <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
      Body <span className="text-zinc-600 font-normal" style={{ fontSize: 9 }}>title 256 / desc 4096</span>
     </summary>
     <div className="space-y-1">
      <div>
       <div className="flex gap-1.5">
        <input
         type="text"
         value={embed.title ?? ""}
         onChange={(e) =>
          update({ title: e.target.value || undefined })
         }
         placeholder="Embed title"
         maxLength={DISCORD_LIMITS.EMBED_TITLE}
         className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
        />
        {embed.url === undefined && (
         <button
          type="button"
          onClick={() => update({ url: "https://" })}
          className="shrink-0 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 hover:text-zinc-200"
         >
          + URL
         </button>
        )}
       </div>
       <div className="mt-0.5 text-right text-[9px] text-zinc-600">
        {(embed.title?.length ?? 0)}/{DISCORD_LIMITS.EMBED_TITLE}
       </div>
      </div>
      {embed.url !== undefined && (
       <div className="flex gap-1.5">
        <input
         type="text"
         value={embed.url}
         onChange={(e) => update({ url: e.target.value || undefined })}
         placeholder="Title URL"
         className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
        />
        <button
         type="button"
         onClick={() => update({ url: undefined })}
         className="shrink-0 px-1 text-zinc-600 hover:text-zinc-300"
        >
         <X className="h-3 w-3" />
        </button>
       </div>
      )}
      <div>
       <textarea
        value={embed.description ?? ""}
        onChange={(e) =>
         update({ description: e.target.value || undefined })
        }
        placeholder="Embed description"
        rows={3}
        maxLength={DISCORD_LIMITS.EMBED_DESCRIPTION}
        className="w-full resize-none rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
       />
       <div className="mt-0.5 text-right text-[9px] text-zinc-600">
        {(embed.description?.length ?? 0)}/{DISCORD_LIMITS.EMBED_DESCRIPTION}
       </div>
      </div>
      <div>
       <div style={{ fontSize: 10, color: "#71717a", marginBottom: 4 }}>Strip color <span style={{ fontSize: 9, color: "#52525b" }}>— set the left border color in preview</span></div>
       <ColorPickerPopover
        value={embed.color}
        onChange={(c) => update({ color: c })}
       />
      </div>
     </div>
    </details>

    {/* Fields Section */}
    <details className="group/section">
     <summary
      className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
     >
      <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
      Fields <span className="text-zinc-600 font-normal" style={{ fontSize: 9 }}>name 256 / value 1024</span>
      <span className="text-zinc-600" style={{ fontSize: 9, marginLeft: "auto" }}>{embed.fields?.length ?? 0}/{DISCORD_LIMITS.EMBED_FIELDS}</span>
     </summary>
     <EmbedFieldEditor
      fields={embed.fields ?? []}
      onChange={(f) => update({ fields: f })}
     />
    </details>

    {/* Images Section */}
    <details className="group/section" open>
     <summary
      className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
     >
      <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
      Images
      </summary>
      <div className="space-y-1">
       <div>
        <label className="mb-0.5 block text-[10px] text-zinc-500">
         Thumbnail URL
        </label>
        <input
         type="text"
         value={embed.thumbnail?.url ?? ""}
         onChange={(e) =>
          update({
           thumbnail: e.target.value
            ? { url: e.target.value }
            : undefined,
          })
         }
         placeholder="https://..."
         className="w-full rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
        />
       </div>
       <div>
        <label className="mb-0.5 block text-[10px] text-zinc-500">
         Image URL
        </label>
        <input
         type="text"
         value={embed.image?.url ?? ""}
         onChange={(e) =>
          update({
           image: e.target.value
            ? { url: e.target.value }
            : undefined,
          })
         }
         placeholder="https://..."
         className="w-full rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
        />
       </div>
      </div>
     </details>

    {/* Footer Section */}
    <details className="group/section">
     <summary
      className="flex items-center gap-1.5 cursor-pointer select-none marker:content-none list-none text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
     >
      <ChevronDown className="h-3 w-3 text-zinc-500 group-open/section:rotate-0 -rotate-90 transition-transform" />
      Footer <span className="text-zinc-600 font-normal" style={{ fontSize: 9 }}>text max 2048</span>
     </summary>
     <div className="space-y-1">
      <div className="flex gap-1.5">
       <input
        type="text"
        value={embed.footer?.text ?? ""}
        onChange={(e) =>
         update({
          footer: {
           text: e.target.value,
           icon_url: embed.footer?.icon_url,
          },
         })
        }
        placeholder="Footer text"
        maxLength={DISCORD_LIMITS.FOOTER_TEXT}
        className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
       />
       <input
        type="text"
        value={embed.footer?.icon_url ?? ""}
        onChange={(e) =>
         update({
          footer: {
           text: embed.footer?.text ?? "",
           icon_url: e.target.value || undefined,
          },
         })
        }
        placeholder="Icon URL"
        className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
       />
      </div>
      <div className="grid grid-cols-2 gap-2">
       <div>
        <label className="mb-0.5 block text-[10px] text-zinc-500">
         Date
        </label>
        <input
         type="date"
         value={
          embed.timestamp
           ? embed.timestamp.slice(0, 10)
           : ""
         }
         onChange={(e) => {
          if (!e.target.value) { update({ timestamp: undefined }); return; }
          const existing = embed.timestamp ? new Date(embed.timestamp) : new Date();
          const [y, m, d] = e.target.value.split("-").map(Number);
          existing.setFullYear(y!, m! - 1, d!);
          update({ timestamp: existing.toISOString() });
         }}
         className="w-full rounded px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500" style={{ backgroundColor: "#111111" }}
        />
       </div>
       <div>
        <label className="mb-0.5 block text-[10px] text-zinc-500">
         Time
        </label>
        <input
         type="time"
         value={
          embed.timestamp
           ? embed.timestamp.slice(11, 16)
           : ""
         }
         disabled={!embed.timestamp}
         step={60}
         onChange={(e) => {
          if (!embed.timestamp || !e.target.value) return;
          const [hours, minutes] = e.target.value.split(":").map(Number);
          const ts = new Date(embed.timestamp);
          ts.setHours(hours!, minutes!, 0, 0);
          update({ timestamp: ts.toISOString() });
         }}
         className="w-full rounded px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500 disabled:opacity-30" style={{ backgroundColor: "#111111" }}
        />
       </div>
      </div>
     </div>
    </details>
   </div>
  </div>
 );
}



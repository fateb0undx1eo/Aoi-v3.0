import { useCallback, useRef, useState, type ReactNode } from "react";
import { Smile } from "lucide-react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import EmojiPickerPopover from "../pickers/EmojiPickerPopover";
import ColorPickerPopover from "../pickers/ColorPickerPopover";
import type { APIEmbed, APIEmbedField, APIEmoji, GuildEmoji } from "../types";
import { DISCORD_LIMITS } from "../types";
import { isEmbedEmpty, getEmbedLength, getEmbedErrors } from "../utils/message";
import { getPlacement } from "../utils/placement";
import ImagePicker from "./ImagePicker";

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
  currentValue: string
): string {
  if (!el) return currentValue + text;
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  return currentValue.slice(0, start) + text + currentValue.slice(end);
}

function EmojiBtn({ onEmoji, serverEmojis }: { onEmoji: (text: string) => void; serverEmojis: GuildEmoji[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" onClick={() => setOpen(true)} title="Insert emoji"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 14, height: 14, borderRadius: 3, border: "none",
          background: "transparent", color: "#52525b", cursor: "pointer",
          fontSize: 10, padding: 0, lineHeight: 1,
        }}>
        <Smile style={{ width: 10, height: 10 }} />
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

function FieldOverlay({ max, length, serverEmojis, onEmoji, children }: {
  max: number; length: number;
  serverEmojis?: GuildEmoji[];
  onEmoji?: (text: string) => void;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: "relative", flex: 1 }}>
      {children}
      <div style={{ position: "absolute", top: 2, right: 3, display: "flex", gap: 2, alignItems: "center", zIndex: 1, pointerEvents: "none" }}>
        {serverEmojis && onEmoji && <div style={{ pointerEvents: "auto" }}><EmojiBtn serverEmojis={serverEmojis} onEmoji={onEmoji} /></div>}
        <span style={{ fontSize: 10, color: "#52525b", fontVariantNumeric: "tabular-nums" }}>
          {max - length}
        </span>
      </div>
    </div>
  );
}



function FieldRow({
 field, index, onUpdate, onDuplicate, onRemove, onMoveUp, onMoveDown,
 canMoveUp, canMoveDown, serverEmojis,
}: {
 field: APIEmbedField; index: number;
 onUpdate: (upd: Partial<APIEmbedField>) => void;
 onDuplicate: () => void;
 onRemove: () => void;
 onMoveUp: () => void; onMoveDown: () => void;
 canMoveUp: boolean; canMoveDown: boolean;
 serverEmojis: GuildEmoji[];
}) {
 const nameRef = useRef<HTMLInputElement>(null);
 const valueRef = useRef<HTMLTextAreaElement>(null);

 return (
   <div className="rounded-lg bg-zinc-800/30 p-1.5 space-y-1.5">
   <div className="flex items-center justify-between gap-1">
    <span className="text-[10px] font-medium text-zinc-500">
     FIELD {index + 1}
    </span>
    <div className="flex items-center gap-1">
     <button type="button" disabled={!canMoveUp} onClick={onMoveUp}
      className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><CoolIcon icon="Chevron_Up" size={12} /></button>
     <button type="button" disabled={!canMoveDown} onClick={onMoveDown}
      className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><CoolIcon icon="Chevron_Down" size={12} /></button>
     <button type="button" onClick={onDuplicate}
      className="text-zinc-600 hover:text-zinc-300"><CoolIcon icon="Copy" size={12} /></button>
     <button type="button" onClick={onRemove}
      className="text-zinc-600 hover:text-red-400"><CoolIcon icon="Trash_Empty" size={12} /></button>
    </div>
   </div>
    <div>
     <span className="block text-[9px] text-zinc-500 mb-0.5">Field name</span>
     <div className="flex items-center gap-1.5">
      <div className="flex-1">
       <FieldOverlay max={DISCORD_LIMITS.FIELD_NAME} length={field.name?.length ?? 0}
        serverEmojis={serverEmojis}
        onEmoji={(text) => {
         onUpdate({ name: insertAtCursor(nameRef.current, text, field.name) });
        }}>
        <input
         type="text" ref={nameRef}
         value={field.name}
         onChange={(e) => onUpdate({ name: e.target.value })}
         maxLength={DISCORD_LIMITS.FIELD_NAME}
         className="w-full rounded px-2 py-1 text-xs text-zinc-200 outline-none"
         style={{ backgroundColor: "#1A1A1A", paddingRight: 60 }}
        />
       </FieldOverlay>
      </div>
      <label className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0 cursor-pointer">
       <input type="checkbox" checked={!!field.inline}
        onChange={(e) => onUpdate({ inline: e.target.checked })}
        className="peer sr-only" />
       <div className="w-3.5 h-3.5 rounded-sm bg-zinc-800 relative after:content-[''] after:absolute after:w-2 after:h-2 after:top-[3px] after:left-[3px] after:rounded-full after:bg-primary after:opacity-0 peer-checked:after:opacity-100 after:transition-opacity after:duration-150">
       </div>
       Inline
      </label>
     </div>
    </div>
    <div>
     <span className="block text-[9px] text-zinc-500 mb-0.5">Field value</span>
     <FieldOverlay max={DISCORD_LIMITS.FIELD_VALUE} length={field.value?.length ?? 0}
      serverEmojis={serverEmojis}
      onEmoji={(text) => {
       onUpdate({ value: insertAtCursor(valueRef.current, text, field.value) });
      }}>
      <textarea
       ref={valueRef}
       value={field.value}
       onChange={(e) => onUpdate({ value: e.target.value })}
       rows={2}
       maxLength={DISCORD_LIMITS.FIELD_VALUE}
       className="w-full resize-none rounded px-2 py-1 text-xs text-zinc-200 outline-none"
       style={{ backgroundColor: "#1A1A1A", paddingRight: 60 }}
      />
     </FieldOverlay>
    </div>
  </div>
 );
}

function EmbedFieldEditor({
 fields, onChange, serverEmojis,
}: {
 fields: APIEmbedField[];
 onChange: (f: APIEmbedField[]) => void;
 serverEmojis: GuildEmoji[];
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
    <FieldRow
     key={i}
     field={f}
     index={i}
     serverEmojis={serverEmojis}
     onUpdate={(upd) => updateField(i, upd)}
     onDuplicate={() => {
      onChange([
       ...fields.slice(0, i + 1),
       { ...f },
       ...fields.slice(i + 1),
      ]);
     }}
     onRemove={() => removeField(i)}
     onMoveUp={() => moveField(i, "up")}
     onMoveDown={() => moveField(i, "down")}
     canMoveUp={i > 0}
     canMoveDown={i < fields.length - 1}
    />
   ))}
   <button
    type="button"
    onClick={addField}
    disabled={fields.length >= 25}
     className="flex w-full items-center justify-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 disabled:opacity-40"
   >
     <CoolIcon icon="Add_Plus" size={16} />
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
 onAddAttachment,
 onAttachmentError,
 serverEmojis,
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
 onAddAttachment?: (file: File) => Promise<string>;
 onAttachmentError?: (message: string) => void;
 serverEmojis?: GuildEmoji[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const authorNameRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLInputElement>(null);
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
    className="rounded-lg bg-zinc-800/20"
   style={
    colorHex
     ? { borderLeftColor: colorHex, borderLeftWidth: 4 }
     : { borderLeftWidth: 4, borderLeftColor: "#4a4a50" }
   }
  >
   {/* Clickable header — combines embed index, char count, actions */}
   {embedIndex != null && (
     <div onClick={() => setCollapsed(!collapsed)}
      className="flex items-center justify-between w-full"
      style={{
       padding: "5px 8px", cursor: "pointer",
       color: "#a1a1aa", fontSize: 12,
      }}>
       <div className="flex items-center gap-1.5">
<CoolIcon icon="Chevron_Down" className="h-3 w-3 transition-transform" style={{
          color: "#52525b",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
         }} />
        <span className="text-[9px] font-medium text-zinc-500">
         Embed {embedIndex + 1}
        </span>
       </div>
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
       <button type="button" disabled={!canMoveUp} onClick={() => onMoveUp?.()}
        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><CoolIcon icon="Chevron_Up" size={12} /></button>
       <button type="button" disabled={!canMoveDown} onClick={() => onMoveDown?.()}
        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><CoolIcon icon="Chevron_Down" size={12} /></button>
       {onRemove && (
        <button type="button" onClick={onRemove}
         className="text-zinc-600 hover:text-red-400"><CoolIcon icon="Close_MD" size={12} /></button>
       )}
      </div>
     </div>
    )}
   {!collapsed && (
    <div className="px-2 pb-2 space-y-1.5">
    {/* Validation errors */}
    {errors.length > 0 && (
     <div className="space-y-0.5">
      {errors.map((err, i) => (
       <div
        key={i}
         className="flex items-start gap-1.5 rounded bg-red-500/10 px-2.5 py-1 text-[10px] text-red-300"
       >
        <CoolIcon icon="Triangle_Warning" size={12} className="shrink-0 mt-0.5" />
        <span>{err}</span>
       </div>
      ))}
     </div>
    )}


    {/* Author Section */}
    <div>
     <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-white uppercase tracking-wider">
      Author
     </div>
      <div className="space-y-1.5">
       <div>
        <span className="block text-[9px] text-zinc-500 mb-0.5">Author name</span>
        <div className="flex gap-1 items-center">
        <FieldOverlay max={DISCORD_LIMITS.AUTHOR_NAME} length={embed.author?.name?.length ?? 0}
         serverEmojis={serverEmojis}
         onEmoji={(text) => {
          update({ author: { name: insertAtCursor(authorNameRef.current, text, embed.author?.name ?? ""), icon_url: embed.author?.icon_url, url: embed.author?.url } });
         }}>
         <input
          type="text" ref={authorNameRef}
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
          maxLength={DISCORD_LIMITS.AUTHOR_NAME}
          className="w-full rounded px-2 py-1 text-xs text-zinc-200 outline-none"
          style={{ backgroundColor: "#1A1A1A", paddingRight: serverEmojis ? 56 : 28 }}
         />
        </FieldOverlay>
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
      className="shrink-0 text-zinc-500 hover:text-zinc-300"
          >
           <CoolIcon icon="Link" size={12} />
          </button>
         )}
        </div>
       </div>
       {embed.author?.url !== undefined && (
        <div>
         <span className="block text-[9px] text-zinc-500 mb-0.5">Author URL</span>
         <div className="flex gap-1">
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
          className="flex-1 rounded px-2 py-1 text-xs text-zinc-200 outline-none" style={{ backgroundColor: "#1A1A1A" }}
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
          <CoolIcon icon="Close_MD" size={12} />
         </button>
        </div>
        </div>
       )}
        <div>
         <span className="block text-[9px] text-zinc-500 mb-0.5">Author icon</span>
         <ImagePicker
           value={embed.author?.icon_url}
           onValue={(url) => update({ author: { name: embed.author?.name ?? "", icon_url: url, url: embed.author?.url } })}
           onAddAttachment={onAddAttachment}
           onError={onAttachmentError}
         />
        </div>
      </div>
     </div>

    {/* Body Section */}
    <div>
     <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-white uppercase tracking-wider">
      Body
     </div>
      <div className="space-y-1.5">
       <div>
        <span className="block text-[9px] text-zinc-500 mb-0.5">Title</span>
        <div className="flex gap-1 items-center">
        <FieldOverlay max={DISCORD_LIMITS.EMBED_TITLE} length={embed.title?.length ?? 0}
         serverEmojis={serverEmojis}
         onEmoji={(text) => {
          update({ title: insertAtCursor(titleRef.current, text, embed.title ?? "") || undefined });
         }}>
         <input
          type="text" ref={titleRef}
          value={embed.title ?? ""}
          onChange={(e) =>
           update({ title: e.target.value || undefined })
          }
          maxLength={DISCORD_LIMITS.EMBED_TITLE}
          className="w-full rounded px-2 py-1 text-xs text-zinc-200 outline-none"
          style={{ backgroundColor: "#1A1A1A", paddingRight: serverEmojis ? 56 : 28 }}
         />
        </FieldOverlay>
        {embed.url === undefined && (
         <button
          type="button"
          onClick={() => update({ url: "https://" })}
            className="shrink-0 text-zinc-500 hover:text-zinc-300"
            >
             <CoolIcon icon="Link" size={12} />
          </button>
         )}
         </div>
        </div>
       {embed.url !== undefined && (
        <div>
         <span className="block text-[9px] text-zinc-500 mb-0.5">Title URL</span>
         <div className="flex gap-1">
         <input
          type="text"
          value={embed.url}
          onChange={(e) => update({ url: e.target.value || undefined })}
          className="flex-1 rounded px-2 py-1 text-xs text-zinc-200 outline-none" style={{ backgroundColor: "#1A1A1A" }}
         />
         <button
          type="button"
          onClick={() => update({ url: undefined })}
          className="shrink-0 px-1 text-zinc-600 hover:text-zinc-300"
         >
          <CoolIcon icon="Close_MD" size={12} />
         </button>
        </div>
        </div>
       )}
       <div>
        <span className="block text-[9px] text-zinc-500 mb-0.5">Description</span>
        <FieldOverlay max={DISCORD_LIMITS.EMBED_DESCRIPTION} length={embed.description?.length ?? 0}
         serverEmojis={serverEmojis}
         onEmoji={(text) => {
          update({ description: insertAtCursor(descRef.current, text, embed.description ?? "") || undefined });
         }}>
         <textarea
          ref={descRef}
          value={embed.description ?? ""}
          onChange={(e) =>
           update({ description: e.target.value || undefined })
          }
          rows={4}
          maxLength={DISCORD_LIMITS.EMBED_DESCRIPTION}
          className="w-full resize-none rounded px-2 py-1 text-xs text-zinc-200 outline-none"
          style={{ backgroundColor: "#1A1A1A", paddingRight: serverEmojis ? 56 : 28 }}
         />
        </FieldOverlay>
       </div>
       <div>
        <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-white uppercase tracking-wider">
         ACCENT
        </div>
       <ColorPickerPopover
        value={embed.color}
        onChange={(c) => update({ color: c })}
       />
      </div>
     </div>
    </div>

    {/* Fields Section */}
    <div>
     <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-white uppercase tracking-wider">
      Fields
      <span className="text-zinc-600" style={{ fontSize: 8, marginLeft: "auto" }}>{embed.fields?.length ?? 0}/{DISCORD_LIMITS.EMBED_FIELDS}</span>
     </div>
     <EmbedFieldEditor
      fields={embed.fields ?? []}
      onChange={(f) => update({ fields: f })}
      serverEmojis={serverEmojis ?? []}
     />
    </div>

    {/* Images Section */}
    <div>
     <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-white uppercase tracking-wider">
      Images
     </div>
       <div className="space-y-0.5">
        <div>
         <label className="mb-0.5 block text-[9px] text-zinc-500">
          Thumbnail
         </label>
         <div className="flex gap-1">
          <ImagePicker
            value={embed.thumbnail?.url}
            onValue={(url) => update({ thumbnail: url ? { url } : undefined })}
            onAddAttachment={onAddAttachment}
            onError={onAttachmentError}
          />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[9px] text-zinc-500">
           Image
         </label>
         <div className="flex gap-1">
          <ImagePicker
            value={embed.image?.url}
            onValue={(url) => update({ image: url ? { url } : undefined })}
            onAddAttachment={onAddAttachment}
            onError={onAttachmentError}
          />
          </div>
        </div>
       </div>
    </div>

    {/* Footer Section */}
    <div>
     <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-white uppercase tracking-wider">
      Footer
     </div>
       <div className="space-y-1.5">
        <div>
         <span className="block text-[9px] text-zinc-500 mb-0.5">Footer text</span>
         <FieldOverlay max={DISCORD_LIMITS.FOOTER_TEXT} length={embed.footer?.text?.length ?? 0}
          serverEmojis={serverEmojis}
          onEmoji={(text) => {
           update({ footer: { text: insertAtCursor(footerRef.current, text, embed.footer?.text ?? ""), icon_url: embed.footer?.icon_url } });
          }}>
          <input
           type="text" ref={footerRef}
           value={embed.footer?.text ?? ""}
           onChange={(e) =>
            update({
             footer: {
              text: e.target.value,
              icon_url: embed.footer?.icon_url,
             },
            })
           }
           maxLength={DISCORD_LIMITS.FOOTER_TEXT}
           className="w-full rounded px-2 py-1 text-xs text-zinc-200 outline-none"
           style={{ backgroundColor: "#1A1A1A", paddingRight: serverEmojis ? 56 : 28 }}
          />
         </FieldOverlay>
        </div>
        <div>
         <span className="block text-[9px] text-zinc-500 mb-0.5">Footer icon</span>
         <ImagePicker
           value={embed.footer?.icon_url}
           onValue={(url) => update({ footer: { text: embed.footer?.text ?? "", icon_url: url } })}
           onAddAttachment={onAddAttachment}
           onError={onAttachmentError}
         />
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 pt-1 cursor-pointer">
         <input type="checkbox" checked={!!embed.timestamp}
          onChange={(e) => {
           update({ timestamp: e.target.checked ? new Date().toISOString() : undefined });
          }}
          className="peer sr-only" />
         <div className="w-3.5 h-3.5 rounded-sm bg-zinc-800 relative after:content-[''] after:absolute after:w-2 after:h-2 after:top-[3px] after:left-[3px] after:rounded-full after:bg-primary after:opacity-0 peer-checked:after:opacity-100 after:transition-opacity after:duration-150">
         </div>
         Use current date & time
        </label>
     </div>
    </div>
    </div>
   )}
   </div>
  );
}




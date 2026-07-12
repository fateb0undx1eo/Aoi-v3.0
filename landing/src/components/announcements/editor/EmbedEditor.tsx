import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { HexColorPicker, HexColorInput } from "react-colorful";

import { CoolIcon } from "@/components/icons/CoolIcon";
import type { APIEmbed, APIEmbedField } from "../types";
import { DISCORD_LIMITS } from "../types";
import { isEmbedEmpty, getEmbedLength, getEmbedErrors } from "../utils/message";
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

function FieldOverlay({ max, length, children }: {
  max: number; length: number;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: "relative", flex: 1 }}>
      {children}
      <div style={{ position: "absolute", top: 2, right: 3, display: "flex", gap: 2, alignItems: "center", zIndex: 1 }}>
        <span style={{ fontSize: 10, color: "#52525b", fontVariantNumeric: "tabular-nums" }}>
          {max - length}
        </span>
      </div>
    </div>
  );
}



function FieldRow({
 field, index, onUpdate, onDuplicate, onRemove, onMoveUp, onMoveDown,
 canMoveUp, canMoveDown,
}: {
 field: APIEmbedField; index: number;
 onUpdate: (upd: Partial<APIEmbedField>) => void;
 onDuplicate: () => void;
 onRemove: () => void;
 onMoveUp: () => void; onMoveDown: () => void;
 canMoveUp: boolean; canMoveDown: boolean;
}) {
 const nameRef = useRef<HTMLInputElement>(null);
 const valueRef = useRef<HTMLTextAreaElement>(null);

 return (
   <div className="rounded-lg bg-zinc-800/30 p-1 space-y-1">
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
     <span className="block text-[11px] text-zinc-400 mb-0">Field name</span>
     <div className="flex items-center gap-1.5">
      <div className="flex-1">
        <FieldOverlay max={DISCORD_LIMITS.FIELD_NAME} length={field.name?.length ?? 0}>
         <input
          type="text" ref={nameRef}
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          maxLength={DISCORD_LIMITS.FIELD_NAME}
          className="w-full rounded px-2 py-0.5 text-xs text-zinc-200 outline-none"
          style={{ backgroundColor: "#1A1A1A" }}
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
     <span className="block text-[11px] text-zinc-400 mb-0">Field value</span>
      <FieldOverlay max={DISCORD_LIMITS.FIELD_VALUE} length={field.value?.length ?? 0}>
       <textarea
        ref={valueRef}
        value={field.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        rows={2}
        maxLength={DISCORD_LIMITS.FIELD_VALUE}
        className="w-full resize-none rounded px-2 py-0.5 text-xs text-zinc-200 outline-none"
        style={{ backgroundColor: "#1A1A1A" }}
       />
     </FieldOverlay>
    </div>
  </div>
 );
}

function EmbedFieldEditor({
 fields, onChange,
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
    <FieldRow
     key={i}
     field={f}
     index={i}
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
  onDuplicate,
  onAddAttachment,
  onAttachmentError,
 }: {
  embed: APIEmbed;
  onChange: (e: APIEmbed) => void;
  embedIndex?: number;
  maxEmbeds?: number;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onAddAttachment?: (file: File) => Promise<string>;
  onAttachmentError?: (message: string) => void;
 }) {
  const [collapsed, setCollapsed] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorBtnRect, setColorBtnRect] = useState<DOMRect | null>(null);
  const [colorPlacement, setColorPlacement] = useState<"above" | "below">("below");
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const previousColorRef = useRef<number | undefined | null>(undefined);
  const colorChosenRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const authorNameRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLInputElement>(null);
  const errors = getEmbedErrors(embed);

  useEffect(() => {
   if (!colorOpen) return;
   colorChosenRef.current = false;
   const handleClick = (e: MouseEvent) => {
    if (colorPopoverRef.current && !colorPopoverRef.current.contains(e.target as Node) &&
     colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)) {
     if (!colorChosenRef.current && previousColorRef.current !== embed.color) {
      update({ color: previousColorRef.current ?? undefined });
     }
     setColorOpen(false);
    }
   };
   document.addEventListener("mousedown", handleClick);
   return () => document.removeEventListener("mousedown", handleClick);
   }, [colorOpen]);
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
        padding: "10px 8px", cursor: "pointer",
        color: "#a1a1aa", fontSize: 12,
       }}>
        <div className="flex items-center gap-1.5">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48" style={{
          width: 16, height: 16, display: "block", transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
        }}>
          <g id="arrow-right-circle-1--arrow-keyboard-circle-button-right">
            <path id="Subtract" fill="#ababab" fill-rule="evenodd" d="M46.5 24c0 12.426 -10.074 22.5 -22.5 22.5S1.5 36.426 1.5 24 11.574 1.5 24 1.5 46.5 11.574 46.5 24Z" clip-rule="evenodd" stroke-width="1"></path>
            <path id="Subtract_2" fill="#4a4a4b" fill-rule="evenodd" d="M24.146 24.353a0.5 0.5 0 0 0 0 -0.707l-6.498 -6.498c-0.97 -0.97 -1.169 -2.487 -0.29 -3.539 0.701 -0.838 1.537 -1.673 2.392 -2.275 1.008 -0.708 2.302 -0.376 3.218 0.447 3.274 2.942 7.602 7.329 9.779 10.211 0.919 1.218 0.92 2.797 0 4.015 -2.177 2.883 -6.505 7.27 -9.779 10.211 -0.916 0.823 -2.21 1.156 -3.218 0.447 -0.855 -0.602 -1.69 -1.436 -2.392 -2.275 -0.879 -1.052 -0.68 -2.569 0.29 -3.538l6.498 -6.499Z" clip-rule="evenodd" stroke-width="1"></path>
          </g>
        </svg>
         <span className="font-bold text-embed-label" style={{ fontFamily: "var(--font-embed-label)", fontSize: 13 }}>
          Embed {embedIndex + 1}
        </span>
       </div>
       <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => {
           if (colorBtnRef.current) {
            const rect = colorBtnRef.current.getBoundingClientRect();
            setColorBtnRect(rect);
            const center = rect.top + rect.height / 2;
            setColorPlacement(center < window.innerHeight / 2 ? "below" : "above");
           }
           previousColorRef.current = embed.color;
           setColorOpen(!colorOpen);
          }}
          ref={colorBtnRef}
          style={{
           width: 14, height: 14, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)",
           backgroundColor: colorHex ?? "transparent",
           cursor: "pointer", padding: 0, flexShrink: 0,
          }}
          title="Accent color"
         />
        </div>
         {colorOpen && colorBtnRect && (
          <div ref={colorPopoverRef}
           style={{
            position: "fixed", zIndex: 9999,
            top: colorPlacement === "below" ? colorBtnRect.bottom + 4 : colorBtnRect.top - 222 - 4,
            left: colorBtnRect.left, borderRadius: 8,
            backgroundColor: "#1A1A1A", padding: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
           }}>
            <style>{`
             .small-pointer {
              --react-colorful-saturation-pointer-width: 10px;
              --react-colorful-saturation-pointer-height: 10px;
              --react-colorful-hue-width: 14px;
              --react-colorful-hue-pointer-width: 14px;
              --react-colorful-hue-pointer-height: 14px;
             }
              .small-pointer .react-colorful__saturation-pointer {
               width: 10px !important;
               height: 10px !important;
               border-radius: 50%;
               border: 2px solid white;
               box-sizing: border-box;
               background: transparent !important;
              }
             .small-pointer .react-colorful__hue-pointer {
              width: 14px !important;
              height: 14px !important;
              border-radius: 50%;
              background: transparent !important;
              border: 2px solid white;
              box-shadow: none !important;
             }
            `}</style>
            <div className="small-pointer">
              <HexColorPicker
               color={embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : "#8B1538"}
               onChange={(h) => {
                const num = Number.parseInt(h.replace("#", ""), 16);
                if (!isNaN(num)) update({ color: num });
               }}
               style={{ width: 180, height: 130 }}
              />
            </div>
             <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" style={{ width: 12, height: 12, display: "block", flexShrink: 0 }}>
               <g id="sign-hashtag--mail-sharp-sign-hashtag-tag">
                <path id="Union" fill="#52525b" fill-rule="evenodd" d="M11.178 0.09a0.75 0.75 0 0 1 0.594 0.879l-0.513 2.67h1.913a0.75 0.75 0 1 1 0 1.5h-2.201l-0.716 3.722h2.917a0.75 0.75 0 1 1 0 1.5H9.966l-0.568 2.953a0.75 0.75 0 1 1 -1.473 -0.283l0.514 -2.67H4.743l-0.568 2.953a0.75 0.75 0 1 1 -1.473 -0.283l0.514 -2.67H0.827a0.75 0.75 0 0 1 0 -1.5h2.677l0.716 -3.723H0.827a0.75 0.75 0 1 1 0 -1.5H4.51L5.076 0.686A0.75 0.75 0 1 1 6.55 0.969l-0.513 2.67h3.696L10.3 0.686a0.75 0.75 0 0 1 0.879 -0.595Zm-5.43 5.048 -0.716 3.723h3.695l0.716 -3.723H5.748Z" clip-rule="evenodd" stroke-width="1"></path>
               </g>
              </svg>
              <HexColorInput
                color={embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : "#8B1538"}
                onChange={(h) => {
                 const num = Number.parseInt(h.replace("#", ""), 16);
                 if (!isNaN(num)) update({ color: num });
                }}
               prefixed
               style={{
                width: 72, background: "#111", border: "none", borderRadius: 4,
                color: "#a1a1aa", fontSize: 11, fontFamily: "monospace", outline: "none", textTransform: "uppercase",
                padding: "4px 6px",
               }}
              />
             <button type="button" onClick={() => {
              colorChosenRef.current = true;
              setColorOpen(false);
             }}
              style={{
               padding: "4px 10px", borderRadius: 4, border: "none",
               backgroundColor: "#2a2a2b", color: "#a1a1aa", cursor: "pointer",
               fontSize: 10, fontWeight: 600, marginLeft: "auto",
              }}>
              Choose
             </button>
            </div>
          </div>
         )}
        <button type="button" disabled={maxEmbeds != null && maxEmbeds >= 10} onClick={() => onDuplicate?.()}
         className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 flex items-center cursor-pointer">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48" style={{ width: 16, height: 16, display: "block" }}>
          <g id="calendar-add--add-calendar-date-day-month">
           <path id="Union" fill="#ababab" d="M24 46.5c-7.632 0 -12.948 -0.485 -16.147 -0.911 -2.862 -0.382 -5.068 -2.554 -5.479 -5.419 -0.417 -2.91 -0.874 -7.506 -0.874 -13.67s0.457 -10.76 0.874 -13.67c0.41 -2.864 2.617 -5.037 5.48 -5.418C11.051 6.985 16.367 6.5 24 6.5c7.632 0 12.948 0.485 16.147 0.912 2.862 0.381 5.068 2.554 5.479 5.418 0.417 2.91 0.874 7.506 0.874 13.67s-0.457 10.76 -0.874 13.67c-0.41 2.864 -2.617 5.037 -5.48 5.419 -3.198 0.426 -8.514 0.911 -16.146 0.911Z" stroke-width="1"></path>
           <path id="Union_2" fill="#4a4a4b" d="M33.5 14.518c-0.504 0 -0.947 -0.014 -1.336 -0.037 -2.27 -0.133 -3.547 -2.002 -3.618 -3.918a69.407 69.407 0 0 1 0 -5.091c0.07 -1.916 1.348 -3.785 3.618 -3.918 0.389 -0.023 0.832 -0.036 1.336 -0.036 0.504 0 0.947 0.013 1.336 0.036 2.27 0.133 3.547 2.002 3.618 3.918a69.409 69.409 0 0 1 0 5.091c-0.07 1.916 -1.348 3.785 -3.618 3.918a22.66 22.66 0 0 1 -1.336 0.037Z" stroke-width="1"></path>
           <path id="Union_3" fill="#4a4a4b" d="M14.5 14.518c-0.504 0 -0.947 -0.014 -1.336 -0.037 -2.27 -0.133 -3.547 -2.002 -3.618 -3.918a69.263 69.263 0 0 1 0 -5.091c0.07 -1.916 1.348 -3.785 3.618 -3.918 0.389 -0.023 0.832 -0.036 1.336 -0.036 0.504 0 0.947 0.013 1.336 0.036 2.27 0.133 3.547 2.002 3.618 3.918a69.409 69.409 0 0 1 0 5.091c-0.07 1.916 -1.348 3.785 -3.618 3.918a22.66 22.66 0 0 1 -1.336 0.037Z" stroke-width="1"></path>
           <path id="Subtract" fill="#4a4a4b" fill-rule="evenodd" d="M21 31h-5a3 3 0 1 1 0 -6h5v-5a3 3 0 1 1 6 0v5h5a3 3 0 1 1 0 6h-5v5a3 3 0 1 1 -6 0v-5Z" clip-rule="evenodd" stroke-width="1"></path>
          </g>
         </svg>
        </button>
        {onRemove && (
         <button type="button" onClick={onRemove}
          className="text-zinc-600 hover:text-red-400 flex items-center cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" style={{ width: 16, height: 16, display: "block" }}>
           <g id="subtract-circle--delete-add-circle-subtract-button-buttons-remove-mathematics-math-minus">
            <path id="Ellipse 639" fill="#ababab" d="M0 7a7 7 0 1 0 14 0A7 7 0 1 0 0 7" stroke-width="1"></path>
            <path id="Vector 1452 (Stroke)" fill="#4a4a4b" fill-rule="evenodd" d="M3.25 7A0.75 0.75 0 0 1 4 6.25h6a0.75 0.75 0 0 1 0 1.5H4A0.75 0.75 0 0 1 3.25 7Z" clip-rule="evenodd" stroke-width="1"></path>
           </g>
          </svg>
         </button>
        )}
      </div>
     </div>
    )}
   <motion.div
    animate={{ height: collapsed ? 0 : "auto" }}
    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    className="overflow-hidden"
   >
    <div className="px-2 pb-1.5 space-y-1">
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
     <div className="flex items-center gap-1 mb-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
      Author
     </div>
      <div className="space-y-1">
       <div className="flex gap-2">
        <div className="flex-1">
         <span className="block text-[11px] text-zinc-400 mb-0">Author name</span>
         <div className="flex gap-1 items-center">
         <FieldOverlay max={DISCORD_LIMITS.AUTHOR_NAME} length={embed.author?.name?.length ?? 0}>
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
           className="w-full rounded px-2 py-[6px] text-xs text-zinc-200 outline-none"
           style={{ backgroundColor: "#1A1A1A" }}
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" style={{ width: 12, height: 12, display: "block" }}>
  <g id="link-chain--create-hyperlink-link-make-unlink-connection-chain">
    <path id="Union" fill="#ababab" fill-rule="evenodd" d="m7.671 2.743 -0.964 0.964a1 1 0 0 1 -1.414 -1.414l0.964 -0.965a4.536 4.536 0 0 1 6.415 6.415l-0.965 0.964a1 1 0 1 1 -1.414 -1.414l0.964 -0.965a2.536 2.536 0 0 0 -3.585 -3.585Zm-3.964 2.55a1 1 0 0 1 0 1.414l-0.964 0.965a2.536 2.536 0 0 0 3.585 3.585l0.965 -0.964a1 1 0 0 1 1.414 1.414l-0.964 0.964a4.536 4.536 0 0 1 -6.415 -6.414l0.965 -0.964a1 1 0 0 1 1.414 0Zm5.5 0.914a1 1 0 0 0 -1.414 -1.414l-3 3a1 1 0 0 0 1.414 1.414l3 -3Z" clip-rule="evenodd" stroke-width="1"></path>
  </g>
</svg>
           </button>
          )}
         </div>
        </div>
        <div>
         <span className="block text-[11px] text-zinc-400 mb-0">Author icon</span>
         <ImagePicker
           value={embed.author?.icon_url}
           onValue={(url) => update({ author: { name: embed.author?.name ?? "", icon_url: url, url: embed.author?.url } })}
           onAddAttachment={onAddAttachment}
           onError={onAttachmentError}
         />
        </div>
       </div>
       {embed.author?.url !== undefined && (
        <div>
         <span className="block text-[11px] text-zinc-400 mb-0">Author URL</span>
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
          className="flex-1 rounded px-2 py-0.5 text-xs text-zinc-200 outline-none" style={{ backgroundColor: "#1A1A1A" }}
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
      </div>
     </div>

    {/* Body Section */}
    <div>
     <div className="flex items-center gap-1 mb-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
      Body
     </div>
      <div className="space-y-1">
       <div>
        <span className="block text-[11px] text-zinc-400 mb-0">Title</span>
        <div className="flex gap-1 items-center">
        <FieldOverlay max={DISCORD_LIMITS.EMBED_TITLE} length={embed.title?.length ?? 0}>
         <input
          type="text" ref={titleRef}
          value={embed.title ?? ""}
          onChange={(e) =>
           update({ title: e.target.value || undefined })
          }
          maxLength={DISCORD_LIMITS.EMBED_TITLE}
          className="w-full rounded px-2 py-[6px] text-xs text-zinc-200 outline-none"
          style={{ backgroundColor: "#1A1A1A" }}
         />
        </FieldOverlay>
        {embed.url === undefined && (
         <button
          type="button"
          onClick={() => update({ url: "https://" })}
            className="shrink-0 text-zinc-500 hover:text-zinc-300"
            >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" style={{ width: 12, height: 12, display: "block" }}>
  <g id="link-chain--create-hyperlink-link-make-unlink-connection-chain">
    <path id="Union" fill="#ababab" fill-rule="evenodd" d="m7.671 2.743 -0.964 0.964a1 1 0 0 1 -1.414 -1.414l0.964 -0.965a4.536 4.536 0 0 1 6.415 6.415l-0.965 0.964a1 1 0 1 1 -1.414 -1.414l0.964 -0.965a2.536 2.536 0 0 0 -3.585 -3.585Zm-3.964 2.55a1 1 0 0 1 0 1.414l-0.964 0.965a2.536 2.536 0 0 0 3.585 3.585l0.965 -0.964a1 1 0 0 1 1.414 1.414l-0.964 0.964a4.536 4.536 0 0 1 -6.415 -6.414l0.965 -0.964a1 1 0 0 1 1.414 0Zm5.5 0.914a1 1 0 0 0 -1.414 -1.414l-3 3a1 1 0 0 0 1.414 1.414l3 -3Z" clip-rule="evenodd" stroke-width="1"></path>
  </g>
</svg>
          </button>
         )}
         </div>
        </div>
       {embed.url !== undefined && (
        <div>
         <span className="block text-[11px] text-zinc-400 mb-0">Title URL</span>
         <div className="flex gap-1">
         <input
          type="text"
          value={embed.url}
          onChange={(e) => update({ url: e.target.value || undefined })}
          className="flex-1 rounded px-2 py-0.5 text-xs text-zinc-200 outline-none" style={{ backgroundColor: "#1A1A1A" }}
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
        <span className="block text-[11px] text-zinc-400 mb-0">Description</span>
        <FieldOverlay max={DISCORD_LIMITS.EMBED_DESCRIPTION} length={embed.description?.length ?? 0}>
         <textarea
          ref={descRef}
          value={embed.description ?? ""}
          onChange={(e) =>
           update({ description: e.target.value || undefined })
          }
          rows={3}
          maxLength={DISCORD_LIMITS.EMBED_DESCRIPTION}
          className="w-full resize-none rounded px-2 py-0.5 text-xs text-zinc-200 outline-none"
          style={{ backgroundColor: "#1A1A1A" }}
         />
         </FieldOverlay>
       </div>
      </div>
     </div>

    {/* Fields Section */}
    <div>
     <div className="flex items-center gap-1 mb-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
      Fields
      <span className="text-zinc-600" style={{ fontSize: 8, marginLeft: "auto" }}>{embed.fields?.length ?? 0}/{DISCORD_LIMITS.EMBED_FIELDS}</span>
     </div>
      <EmbedFieldEditor
       fields={embed.fields ?? []}
       onChange={(f) => update({ fields: f })}
      />
    </div>

    {/* Images Section */}
    <div>
     <div className="flex items-center gap-1 mb-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
      Images
     </div>
       <div className="flex gap-2">
        <div className="flex-1">
         <label className="mb-0.5 block text-[11px] text-zinc-400">
          Thumbnail
         </label>
          <ImagePicker
            value={embed.thumbnail?.url}
            onValue={(url) => update({ thumbnail: url ? { url } : undefined })}
            onAddAttachment={onAddAttachment}
            onError={onAttachmentError}
          />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-[11px] text-zinc-400">
           Image
         </label>
          <ImagePicker
            value={embed.image?.url}
            onValue={(url) => update({ image: url ? { url } : undefined })}
            onAddAttachment={onAddAttachment}
            onError={onAttachmentError}
          />
          </div>
         </div>
     </div>

    {/* Footer Section */}
    <div>
     <div className="flex items-center gap-1 mb-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
      Footer
     </div>
       <div className="space-y-1">
        <div>
         <span className="block text-[11px] text-zinc-400 mb-0">Footer text</span>
         <FieldOverlay max={DISCORD_LIMITS.FOOTER_TEXT} length={embed.footer?.text?.length ?? 0}>
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
           className="w-full rounded px-2 py-[6px] text-xs text-zinc-200 outline-none"
           style={{ backgroundColor: "#1A1A1A" }}
          />
         </FieldOverlay>
        </div>
        <div>
         <span className="block text-[11px] text-zinc-400 mb-0">Footer icon</span>
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
    </motion.div>
    </div>
  );
}




import { useState, useRef } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { BUTTON_STYLES } from "../constants";
import type { APIButtonComponent, APIV2ChildComponent, APIV2Thumbnail, ButtonStyle, MediaGalleryItem, UnfurledMediaItem } from "../types";
import { randomId } from "../utils/message";
import { getPlacement } from "../utils/placement";

const TYPE_LABELS: Record<number, { label: string; colorClass: string }> = {
  10: { label: "Text Display", colorClass: "text-indigo-400" },
  12: { label: "Media Gallery", colorClass: "text-green-400" },
  13: { label: "File", colorClass: "text-amber-400" },
  14: { label: "Separator", colorClass: "text-zinc-400" },
  9:  { label: "Section", colorClass: "text-purple-400" },
  1:  { label: "Action Row", colorClass: "text-blue-400" },
  17: { label: "Container", colorClass: "text-pink-400" },
};

function TypeBadge({ type }: { type: number }) {
  const info = TYPE_LABELS[type];
  if (!info) return null;
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wider ${info.colorClass}`}>
      {info.label}
    </span>
  );
}

export default function V2ChildEditor({ child, onChange, onRemove, onAddAttachment }: {
  child: APIV2ChildComponent;
  onChange: (c: APIV2ChildComponent) => void;
  onRemove: () => void;
  onAddAttachment?: (file: File) => Promise<string>;
}) {
  const [sectionAccOpen, setSectionAccOpen] = useState(false);
  const [accPlacement, setAccPlacement] = useState<"above" | "below">("above");
  const accBtnRef = useRef<HTMLButtonElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const cardClass = "rounded-lg border border-zinc-800 p-2";
  const cardBg = "#151515";
  const inputBg = "#1A1A1A";
  const inputClass = "w-full rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none";
  const inlineInputClass = "w-full rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none";
  const sectionLabelClass = "text-[10px] font-semibold text-white uppercase tracking-wider";

  const headerBtnClass = "shrink-0 text-zinc-600 hover:text-zinc-300";

  const [uploading, setUploading] = useState<string | null>(null);

  const triggerUpload = (target: string, onUrl: (url: string) => void) => {
    if (!onAddAttachment) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(target);
      try {
        const url = await onAddAttachment(file);
        onUrl(url);
      } catch {
        // error handled by parent
      } finally {
        setUploading(null);
      }
    };
    input.click();
  };

  function UploadBtn({ target, onUrl }: { target: string; onUrl: (url: string) => void }) {
    return (
      <button type="button" onClick={() => triggerUpload(target, onUrl)} disabled={uploading === target} title="Upload image from device"
        className="shrink-0 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-wait"
      >
        {uploading === target ? (
          <span className="inline-block animate-spin" style={{ width: 14, height: 14, border: "2px solid currentcolor", borderTopColor: "transparent", borderRadius: "50%" }} />
        ) : (
          <CoolIcon icon="Cloud_Upload" size={14} />
        )}
      </button>
    );
  }

  const removeBtn = (
    <button type="button" onClick={onRemove} className={headerBtnClass}>
      <CoolIcon icon="Close_MD" size={12} />
    </button>
  );

  // ── Text Display ─────────────────────────────────────────────────
  if (child.type === 10) {
    return (
      <div className={cardClass} style={{ backgroundColor: cardBg }}>
        <div className="flex items-center justify-between mb-1.5">
          <TypeBadge type={10} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">{child.content?.length ?? 0}/4000</span>
            {removeBtn}
          </div>
        </div>
        <textarea
          value={child.content}
          onChange={(e) => onChange({ ...child, content: e.target.value })}
          placeholder="Markdown text content..."
          rows={3}
          maxLength={4000}
          className={`${inputClass} resize-none leading-relaxed`}
          style={{ backgroundColor: inputBg }}
        />
      </div>
    );
  }

  // ── Media Gallery ─────────────────────────────────────────────────
  if (child.type === 12) {
    const items = child.items || [];
    const updateItem = (ii: number, upd: { media?: UnfurledMediaItem; description?: string; spoiler?: boolean }) => {
      const next = [...items];
      next[ii] = { ...next[ii], ...upd } as MediaGalleryItem;
      onChange({ ...child, items: next });
    };
    const removeItem = (ii: number) => {
      onChange({ ...child, items: items.filter((_, i) => i !== ii) });
    };
    const addItem = () => {
      onChange({ ...child, items: [...items, { media: { url: "" } }] });
    };
    return (
      <div className={cardClass} style={{ backgroundColor: cardBg }}>
        <div className="flex items-center justify-between mb-1.5">
          <TypeBadge type={12} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">{items.length}/10 items</span>
            {removeBtn}
          </div>
        </div>
        <div className="space-y-1.5">
          {items.map((item, ii) => (
            <div key={ii} className="rounded border border-zinc-800 p-1.5" style={{ backgroundColor: "#111" }}>
              <div className="flex items-center gap-1.5">
                {item.media?.url && (
                  <img src={item.media.url} alt=""
                    className="h-6 w-6 flex-shrink-0 rounded object-cover border border-zinc-800"
                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
                )}
                <input type="text" value={item.media?.url || ""}
                  onChange={(e) => updateItem(ii, { media: { url: e.target.value } })}
                  placeholder="Image URL..."
                  className={`${inputClass} flex-1 min-w-0`}
                  style={{ backgroundColor: inputBg }} />
                {onAddAttachment && <UploadBtn target={"media-" + ii} onUrl={(url) => updateItem(ii, { media: { url } })} />}
                <button type="button" onClick={() => removeItem(ii)} className={headerBtnClass}>
                  <CoolIcon icon="Close_MD" size={12} />
                </button>
              </div>
              {(item.description != null || item.spoiler) && (
                <div className="flex items-center gap-1.5 mt-1">
                  <input type="text" value={item.description || ""}
                    onChange={(e) => updateItem(ii, { description: e.target.value || undefined })}
                    placeholder="Description (alt text)..."
                    className={`${inputClass} flex-1 text-[10px]`}
                    style={{ backgroundColor: inputBg }} />
                  <label className="flex items-center gap-1 text-[9px] text-zinc-500 whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={item.spoiler || false}
                      onChange={(e) => updateItem(ii, { spoiler: e.target.checked || undefined })}
                      className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
                    Spoiler
                  </label>
                </div>
              )}
            </div>
          ))}
          {items.length < 10 && (
            <button type="button" onClick={addItem}
              className="w-full py-1 text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center justify-center">
              <CoolIcon icon="Add_Plus" size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── File ──────────────────────────────────────────────────────────
  if (child.type === 13) {
    return (
      <div className={cardClass} style={{ backgroundColor: cardBg }}>
        <div className="flex items-center justify-between mb-1.5">
          <TypeBadge type={13} />
          {removeBtn}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input type="text" value={child.file?.url || ""}
              onChange={(e) => onChange({ ...child, file: { url: e.target.value } })}
              placeholder="File URL (attachment://filename)..."
              className={`${inputClass} flex-1`}
              style={{ backgroundColor: inputBg }} />
            {onAddAttachment && <UploadBtn target="file" onUrl={(url) => onChange({ ...child, file: { url } })} />}
          </div>
          <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer">
            <input type="checkbox" checked={child.spoiler || false}
              onChange={(e) => onChange({ ...child, spoiler: e.target.checked || undefined })}
              className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
            Spoiler
          </label>
        </div>
      </div>
    );
  }

  // ── Separator ─────────────────────────────────────────────────────
  if (child.type === 14) {
    return (
      <div className={`${cardClass} flex items-center gap-2`} style={{ backgroundColor: cardBg }}>
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-[9px] text-zinc-500 whitespace-nowrap">Separator</span>
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
            <input type="checkbox" checked={child.divider ?? true}
              onChange={(e) => onChange({ ...child, divider: e.target.checked })}
              className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
            Divider
          </label>
          <select value={child.spacing ?? 1}
            onChange={(e) => onChange({ ...child, spacing: Number(e.target.value) as 1 | 2 })}
            className="rounded border border-zinc-800 bg-[#1A1A1A] text-zinc-400 text-[9px] px-1 py-0.5 outline-none">
            <option value={1}>Small</option>
            <option value={2}>Large</option>
          </select>
        </div>
        <div className="flex-1 h-px bg-zinc-800" />
        {removeBtn}
      </div>
    );
  }

  // ── Section ───────────────────────────────────────────────────────
  if (child.type === 9) {
    const textChildren = child.components || [];
    const addTextChild = () => {
      if (textChildren.length >= 3) return;
      onChange({ ...child, components: [...textChildren, { type: 10 as const, content: "" }] });
    };
    const updateTextChild = (ti: number, content: string) => {
      const updated = textChildren.map((tc, i) => i === ti ? { ...tc, content } : tc);
      onChange({ ...child, components: updated });
    };
    const removeTextChild = (ti: number) => {
      if (textChildren.length <= 1) return;
      onChange({ ...child, components: textChildren.filter((_, i) => i !== ti) });
    };

    const accessory = child.accessory;
    const isButtonAcc = accessory?.type === 2 || (!accessory?.type && false);
    const isThumbAcc = accessory?.type === 11;

    return (
      <div className={`${cardClass} border-l-[3px] border-l-purple-500`} style={{ backgroundColor: cardBg }}>
        <div className="flex items-center justify-between mb-1.5">
          <TypeBadge type={9} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">{textChildren.length}/3 text blocks</span>
            {removeBtn}
          </div>
        </div>
        {/* Text children */}
        <div className="space-y-1.5 mb-2">
          {textChildren.map((tc, ti) => (
            <div key={ti} className="flex items-start gap-1">
              <textarea
                value={tc.content || ""}
                onChange={(e) => updateTextChild(ti, e.target.value)}
                placeholder={`Text block ${ti + 1}...`}
                rows={2}
                maxLength={2000}
                className={`${inputClass} flex-1 resize-none leading-relaxed`}
                style={{ backgroundColor: inputBg }} />
              {textChildren.length > 1 && (
                <button type="button" onClick={() => removeTextChild(ti)} className="mt-1 text-zinc-600 hover:text-zinc-300">
                  <CoolIcon icon="Close_MD" size={10} />
                </button>
              )}
            </div>
          ))}
          {textChildren.length < 3 && (
            <button type="button" onClick={addTextChild}
              className="w-full py-1 text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center justify-center">
              <CoolIcon icon="Add_Plus" size={16} />
            </button>
          )}
        </div>
        {/* Accessory */}
        <div className="border-t border-zinc-800 pt-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Accessory</span>
            <div className="relative">
              <button ref={accBtnRef} type="button" onClick={() => {
                if (!sectionAccOpen && accBtnRef.current) setAccPlacement(getPlacement(accBtnRef.current));
                setSectionAccOpen(!sectionAccOpen);
              }}
                className="text-[9px] px-2 py-1 rounded border border-zinc-800 bg-[#111] text-zinc-400 hover:text-zinc-300 cursor-pointer">
                {accessory ? (isButtonAcc ? "Edit Button" : isThumbAcc ? "Edit Thumbnail" : "Edit") : "+ Add"}
              </button>
              {sectionAccOpen && (
                <div className="absolute right-0 z-20 w-52 rounded-lg border border-zinc-800 bg-[#18181b] p-2 shadow-xl"
                  style={accPlacement === "above" ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }}>
                  {!accessory && (
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => {
                        onChange({ ...child, accessory: { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}` } } as any);
                        setSectionAccOpen(false);
                      }}
                        className="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer">
                        Button
                      </button>
                      <button type="button" onClick={() => {
                        onChange({ ...child, accessory: { type: 11, media: { url: "" } } } as any);
                        setSectionAccOpen(false);
                      }}
                        className="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer">
                        Thumbnail
                      </button>
                    </div>
                  )}
                  {accessory?.type === 2 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] text-zinc-500 uppercase">Button Accessory</span>
                      <input type="text" value={(accessory as APIButtonComponent).label || ""}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, label: e.target.value || undefined } } as any)}
                        placeholder="Label"
                        className={inlineInputClass}
                        style={{ backgroundColor: inputBg }} />
                      {(accessory as APIButtonComponent).style === 5 ? (
                        <input type="text" value={(accessory as APIButtonComponent).url || ""}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, url: e.target.value } } as any)}
                          placeholder="URL"
                          className={inlineInputClass}
                          style={{ backgroundColor: inputBg }} />
                      ) : (
                        <input type="text" value={(accessory as APIButtonComponent).custom_id || ""}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, custom_id: e.target.value } } as any)}
                          placeholder="Custom ID"
                          className={inlineInputClass}
                          style={{ backgroundColor: inputBg }} />
                      )}
                      <input type="text" value={(accessory as APIButtonComponent).emoji ? ((accessory as APIButtonComponent).emoji!.name || (accessory as APIButtonComponent).emoji!.id || "") : ""}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, emoji: e.target.value ? { name: e.target.value } : undefined } } as any)}
                        placeholder="Emoji (name or id)"
                        className={inlineInputClass}
                        style={{ backgroundColor: inputBg }} />
                      <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
                        <input type="checkbox" checked={(accessory as APIButtonComponent).disabled || false}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, disabled: e.target.checked || undefined } } as any)}
                          className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
                        Disabled
                      </label>
                      <select value={(accessory as APIButtonComponent).style}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, style: Number(e.target.value) as ButtonStyle } } as any)}
                        className="w-full rounded border border-zinc-800 bg-[#1A1A1A] text-zinc-400 text-[10px] px-1.5 py-1 outline-none">
                        {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{BUTTON_STYLES[s]?.label || s}</option>)}
                      </select>
                      <button type="button" onClick={() => onChange({ ...child, accessory: undefined } as any)}
                        className="w-full py-1 text-[9px] rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer mt-1">
                        Remove
                      </button>
                    </div>
                  )}
                  {accessory?.type === 11 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] text-zinc-500 uppercase">Thumbnail Accessory</span>
                      <div className="flex items-center gap-1.5">
                        <input type="text" value={(accessory as APIV2Thumbnail).media?.url || ""}
                          onChange={(e) => onChange({ ...child, accessory: { type: 11, media: { url: e.target.value }, description: (accessory as APIV2Thumbnail).description, spoiler: (accessory as APIV2Thumbnail).spoiler } } as any)}
                          placeholder="Image URL..."
                          className={`${inlineInputClass} flex-1`}
                          style={{ backgroundColor: inputBg }} />
                        {onAddAttachment && <UploadBtn target="thumb-acc" onUrl={(url) => onChange({ ...child, accessory: { type: 11, media: { url }, description: (accessory as APIV2Thumbnail).description, spoiler: (accessory as APIV2Thumbnail).spoiler } } as any)} />}
                      </div>
                      <input type="text" value={(accessory as APIV2Thumbnail).description || ""}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, description: e.target.value || undefined } } as any)}
                        placeholder="Description (alt text)"
                        className={inlineInputClass}
                        style={{ backgroundColor: inputBg }} />
                      <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
                        <input type="checkbox" checked={(accessory as APIV2Thumbnail).spoiler || false}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, spoiler: e.target.checked || undefined } } as any)}
                          className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
                        Spoiler
                      </label>
                      <button type="button" onClick={() => onChange({ ...child, accessory: undefined } as any)}
                        className="w-full py-1 text-[9px] rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer mt-1">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {accessory && (
            <div className="rounded border border-zinc-800 bg-[#111] px-2 py-1 text-[10px] text-zinc-400 flex items-center gap-1.5">
              {isButtonAcc && <span>Button: {(accessory as APIButtonComponent).label || "unnamed"}</span>}
              {isThumbAcc && <span>Thumbnail: {(accessory as APIV2Thumbnail).media?.url?.slice(0, 30) || "no URL"}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Action Row (V1 inside V2, type 1) ────────────────────────────
  if (child.type === 1) {
    const items = child.components || [];
    const hasSelect = items.some(i => i.type !== 2);
    const hasButtons = items.some(i => i.type === 2);

    const updateItem = (ii: number, upd: Record<string, unknown>) => {
      const next = [...items];
      next[ii] = { ...next[ii], ...upd } as any;
      onChange({ ...child, components: next as any });
    };
    const removeItem = (ii: number) => {
      if (editingIndex === ii) setEditingIndex(null);
      onChange({ ...child, components: items.filter((_, i) => i !== ii) as any });
    };

    const addBtnClass = "px-1.5 py-0.5 text-[9px] uppercase rounded border border-zinc-800 bg-[#111] text-zinc-500 hover:text-zinc-300 cursor-pointer";

    return (
      <div className={cardClass} style={{ backgroundColor: cardBg }}>
        <div className="flex items-center justify-between mb-1.5">
          <TypeBadge type={1} />
          <div className="flex items-center gap-1.5">
            {editingIndex !== null && (
              <button type="button" onClick={() => setEditingIndex(null)}
                className="text-[9px] text-zinc-500 hover:text-zinc-300 cursor-pointer bg-none border-none p-0">
                Done
              </button>
            )}
            <span className="text-[10px] text-zinc-600">{items.length} items</span>
            {removeBtn}
          </div>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-2 text-[9px] text-zinc-600">
            Empty row &mdash; add buttons or select menus below
          </div>
        ) : (
          <div className="space-y-1.5 mb-1">
            {items.map((item, ii) => (
              <div key={ii}>
                {editingIndex === ii ? (
                  <div className="rounded border border-zinc-800 bg-[#111] p-1.5 flex flex-col gap-1.5">
                    {item.type === 2 ? (
                      <>
                        {item.style === 6 ? (
                          <input type="text" value={item.sku_id || ""}
                            onChange={(e) => updateItem(ii, { sku_id: e.target.value })}
                            placeholder="SKU ID"
                            className={inlineInputClass}
                            style={{ backgroundColor: inputBg }} />
                        ) : (
                          <>
                            <input type="text" value={item.label || ""}
                              onChange={(e) => updateItem(ii, { label: e.target.value })}
                              placeholder="Button label"
                              className={inlineInputClass}
                              style={{ backgroundColor: inputBg }} />
                            {item.style === 5 ? (
                              <input type="text" value={item.url || ""}
                                onChange={(e) => updateItem(ii, { url: e.target.value })}
                                placeholder="URL"
                                className={inlineInputClass}
                                style={{ backgroundColor: inputBg }} />
                            ) : (
                              <input type="text" value={item.custom_id || ""}
                                onChange={(e) => updateItem(ii, { custom_id: e.target.value })}
                                placeholder="Custom ID"
                                className={inlineInputClass}
                                style={{ backgroundColor: inputBg }} />
                            )}
                            <input type="text" value={item.emoji ? (item.emoji.name || item.emoji.id || "") : ""}
                              onChange={(e) => updateItem(ii, { emoji: e.target.value ? { name: e.target.value } : undefined })}
                              placeholder="Emoji (name or id)"
                              className={inlineInputClass}
                              style={{ backgroundColor: inputBg }} />
                            <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
                              <input type="checkbox" checked={item.disabled || false}
                                onChange={(e) => updateItem(ii, { disabled: e.target.checked || undefined })}
                                className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
                              Disabled
                            </label>
                          </>
                        )}
                        <select value={item.style}
                          onChange={(e) => updateItem(ii, { style: Number(e.target.value) })}
                          className="w-full rounded border border-zinc-800 bg-[#1A1A1A] text-zinc-400 text-[10px] px-1.5 py-1 outline-none">
                          {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{BUTTON_STYLES[s]?.label || s}</option>)}
                        </select>
                        <button type="button" onClick={() => removeItem(ii)}
                          className="w-full py-1 text-[9px] rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer">
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                          {["String Select","","","User Select","Role Select","Mentionable Select","Channel Select"][item.type - 3] || "Select"}
                        </span>
                        <input type="text" value={item.custom_id || ""}
                          onChange={(e) => updateItem(ii, { custom_id: e.target.value })}
                          placeholder="Custom ID"
                          className={inlineInputClass}
                          style={{ backgroundColor: inputBg }} />
                        <input type="text" value={item.placeholder || ""}
                          onChange={(e) => updateItem(ii, { placeholder: e.target.value })}
                          placeholder="Placeholder"
                          className={inlineInputClass}
                          style={{ backgroundColor: inputBg }} />
                        {item.type === 3 && item.options && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-zinc-500 uppercase mt-1">Options ({item.options.length}/25)</span>
                            {item.options.map((opt: any, oi: number) => (
                              <div key={oi} className="rounded border border-zinc-800 bg-[#111] p-1.5">
                                <div className="flex items-center gap-1 mb-1">
                                  <input type="text" value={opt.label || ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], label: e.target.value };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Label"
                                    className={`${inlineInputClass} flex-1`}
                                    style={{ backgroundColor: inputBg }} />
                                  <input type="text" value={opt.value || ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], value: e.target.value };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Value"
                                    className={`${inlineInputClass} flex-1`}
                                    style={{ backgroundColor: inputBg }} />
                                  <button type="button" onClick={() => {
                                    const opts = item.options.filter((_: any, i: number) => i !== oi);
                                    updateItem(ii, { options: opts } as any);
                                  }} className="text-zinc-600 hover:text-zinc-300 flex-shrink-0">
                                    <CoolIcon icon="Close_MD" size={10} />
                                  </button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input type="text" value={opt.description || ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], description: e.target.value || undefined };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Description"
                                    className={`${inlineInputClass} flex-1`}
                                    style={{ backgroundColor: inputBg }} />
                                  <input type="text" value={opt.emoji ? (opt.emoji.name || opt.emoji.id || "") : ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], emoji: e.target.value ? { name: e.target.value } : undefined };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Emoji"
                                    className={`${inlineInputClass} w-14`}
                                    style={{ backgroundColor: inputBg }} />
                                  <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer whitespace-nowrap">
                                    <input type="checkbox" checked={opt.default || false}
                                      onChange={(e) => {
                                        const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], default: e.target.checked || undefined };
                                        updateItem(ii, { options: opts } as any);
                                      }}
                                      className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
                                    Default
                                  </label>
                                </div>
                              </div>
                            ))}
                            {item.options.length < 25 && (
                              <button type="button" onClick={() => {
                                const opts: any[] = [...item.options, { label: "", value: "" }];
                                updateItem(ii, { options: opts } as any);
                              }}
                                className="w-full py-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center justify-center">
                                <CoolIcon icon="Add_Plus" size={16} />
                              </button>
                            )}
                          </div>
                        )}
                        {item.type >= 5 && item.type <= 8 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-zinc-500 uppercase mt-1">Default Values</span>
                            {((item as any).default_values || []).map((dv: any, di: number) => (
                              <div key={di} className="flex items-center gap-1">
                                <input type="text" value={dv.id || ""}
                                  onChange={(e) => {
                                    const dvs: any[] = [...((item as any).default_values || [])]; dvs[di] = { ...dvs[di], id: e.target.value };
                                    updateItem(ii, { default_values: dvs } as any);
                                  }}
                                  placeholder="ID"
                                  className={`${inlineInputClass} flex-1`}
                                  style={{ backgroundColor: inputBg }} />
                                <select value={dv.type || "user"}
                                  onChange={(e) => {
                                    const dvs: any[] = [...((item as any).default_values || [])]; dvs[di] = { ...dvs[di], type: e.target.value as "user" | "role" | "channel" };
                                    updateItem(ii, { default_values: dvs } as any);
                                  }}
                                  className="rounded border border-zinc-800 bg-[#1A1A1A] text-zinc-400 text-[9px] px-1 py-0.5 outline-none w-16">
                                  <option value="user">User</option>
                                  <option value="role">Role</option>
                                  <option value="channel">Channel</option>
                                </select>
                                <button type="button" onClick={() => {
                                  const dvs = ((item as any).default_values || []).filter((_: any, i: number) => i !== di);
                                  updateItem(ii, { default_values: (dvs.length > 0 ? dvs : undefined) } as any);
                                }} className="text-zinc-600 hover:text-zinc-300">
                                  <CoolIcon icon="Close_MD" size={10} />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => {
                              const dvs: any[] = [...((item as any).default_values || []), { id: "", type: "user" }];
                              updateItem(ii, { default_values: dvs } as any);
                            }}
                              className="w-full py-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center justify-center">
                              <CoolIcon icon="Add_Plus" size={16} />
                            </button>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
                            Min
                            <input type="number" value={item.min_values ?? 0} min={0} max={25}
                              onChange={(e) => updateItem(ii, { min_values: Number(e.target.value) || undefined })}
                              className="w-8 rounded border border-zinc-800 bg-[#1A1A1A] text-zinc-400 text-[9px] px-1 py-0.5 outline-none" />
                          </label>
                          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
                            Max
                            <input type="number" value={item.max_values ?? 1} min={0} max={25}
                              onChange={(e) => updateItem(ii, { max_values: Number(e.target.value) || undefined })}
                              className="w-8 rounded border border-zinc-800 bg-[#1A1A1A] text-zinc-400 text-[9px] px-1 py-0.5 outline-none" />
                          </label>
                          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
                            <input type="checkbox" checked={item.disabled || false}
                              onChange={(e) => updateItem(ii, { disabled: e.target.checked || undefined })}
                              className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
                            Disabled
                          </label>
                          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
                            <input type="checkbox" checked={item.required ?? false}
                              onChange={(e) => updateItem(ii, { required: e.target.checked || undefined })}
                              className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
                            Required
                          </label>
                        </div>
                        <button type="button" onClick={() => removeItem(ii)}
                          className="w-full py-1 text-[9px] rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer">
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div onClick={() => setEditingIndex(ii)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded border border-zinc-800 bg-[#111] text-[10px] text-zinc-400 cursor-pointer hover:border-zinc-700">
                    {item.type === 2 ? (
                      <span>{item.label || "Button"} <span className="text-zinc-600">({["Primary","Secondary","Success","Danger","Link","Premium"][(item.style || 1) - 1] || "?"})</span></span>
                    ) : (
                      <span>
                        {["String Select","","","User Select","Role Select","Mentionable Select","Channel Select"][item.type - 3] || "Select"}
                        {item.type === 3 && item.options ? <span className="text-zinc-600 ml-1">({item.options.length} opts)</span> : null}
                        {item.type >= 5 && (item as any).default_values?.length ? <span className="text-zinc-600 ml-1">({(item as any).default_values.length} defaults)</span> : null}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {!hasSelect && items.length < 5 && (
            <>
              <button type="button" onClick={() => {
                setEditingIndex(null);
                const updated = [...items, { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}`, disabled: false }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+Btn</button>
              <button type="button" onClick={() => {
                setEditingIndex(null);
                const updated = [...items, { type: 2, style: 5, label: "Link", url: "https://", disabled: false }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+Link</button>
              <button type="button" onClick={() => {
                setEditingIndex(null);
                const updated = [...items, { type: 2, style: 6, sku_id: "" }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+Premium</button>
            </>
          )}
          {items.length === 0 && !hasButtons && (
            <>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 3, custom_id: `sel_${randomId()}`, placeholder: "Choose", options: [] }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+Select</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 5, custom_id: `usr_${randomId()}`, placeholder: "User" }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+User</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 6, custom_id: `role_${randomId()}`, placeholder: "Role" }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+Role</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 7, custom_id: `ment_${randomId()}`, placeholder: "Mentionable" }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+Mentionable</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 8, custom_id: `ch_${randomId()}`, placeholder: "Channel" }];
                onChange({ ...child, components: updated as any });
              }} className={addBtnClass}>+Channel</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}

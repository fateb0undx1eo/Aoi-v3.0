import { useState } from "react";
import { Plus, X } from "lucide-react";
import { BUTTON_STYLES } from "../constants";
import type { APIButtonComponent, APIV2ChildComponent, APIV2Thumbnail, ButtonStyle, MediaGalleryItem, UnfurledMediaItem } from "../types";
import { randomId } from "../utils/message";

export default function V2ChildEditor({ child, onChange, onRemove }: {
  child: APIV2ChildComponent;
  onChange: (c: APIV2ChildComponent) => void;
  onRemove: () => void;
}) {
  const [sectionAccessoryOpen, setSectionAccessoryOpen] = useState(false);

  if (child.type === 10) {
    return (
      <div className="rounded border border-zinc-700 bg-black p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">Text Display</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <textarea value={child.content} onChange={(e) => onChange({ ...child, content: e.target.value })}
          placeholder="Text content..." rows={2} maxLength={2000}
          className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none outline-none" />
      </div>
    );
  }

  if (child.type === 11) {
    return (
      <div className="rounded border border-zinc-700 bg-black p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">Thumbnail</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <div className="space-y-1">
          <input type="text" value={child.media?.url || ""}
            onChange={(e) => onChange({ ...child, media: { url: e.target.value } })}
            placeholder="Image URL..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          {child.description != null && (
            <input type="text" value={child.description || ""}
              onChange={(e) => onChange({ ...child, description: e.target.value || undefined })}
              placeholder="Description (alt text)..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          )}
          <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <input type="checkbox" checked={child.spoiler || false}
              onChange={(e) => onChange({ ...child, spoiler: e.target.checked || undefined })}
              className="rounded border-zinc-700 bg-black" />
            Spoiler
          </label>
        </div>
      </div>
    );
  }

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
      <div className="rounded border border-zinc-700 bg-black p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">Media Gallery ({items.length}/10)</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <div className="space-y-1">
          {items.map((item, ii) => (
            <div key={ii} className="flex flex-col gap-1 rounded border border-zinc-800 p-1.5">
              <div className="flex items-center gap-1">
                <input type="text" value={item.media?.url || ""}
                  onChange={(e) => updateItem(ii, { media: { url: e.target.value } })}
                  placeholder="Image URL..." className="min-w-0 flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
                <button type="button" onClick={() => removeItem(ii)}
                  className="shrink-0 text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
              </div>
              {item.description != null && (
                <input type="text" value={item.description || ""}
                  onChange={(e) => updateItem(ii, { description: e.target.value || undefined })}
                  placeholder="Description..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
              )}
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <input type="checkbox" checked={item.spoiler || false}
                  onChange={(e) => updateItem(ii, { spoiler: e.target.checked || undefined })}
                  className="rounded border-zinc-700 bg-black" />
                Spoiler
              </label>
            </div>
          ))}
          {items.length < 10 && (
            <button type="button" onClick={addItem}
              className="w-full rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
              <Plus className="mr-0.5 inline h-2.5 w-2.5" />Add Media
            </button>
          )}
        </div>
      </div>
    );
  }

  if (child.type === 13) {
    return (
      <div className="rounded border border-zinc-700 bg-black p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">File</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <div className="space-y-1">
          <input type="text" value={child.file?.url || ""}
            onChange={(e) => onChange({ ...child, file: { url: e.target.value } })}
            placeholder="File URL (attachment://filename)..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
          <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <input type="checkbox" checked={child.spoiler || false}
              onChange={(e) => onChange({ ...child, spoiler: e.target.checked || undefined })}
              className="rounded border-zinc-700 bg-black" />
            Spoiler
          </label>
        </div>
      </div>
    );
  }

  if (child.type === 14) {
    return (
      <div className="flex items-center gap-2 rounded border border-zinc-700 bg-black px-2 py-1">
        <div className="h-px flex-1 bg-zinc-700" />
        <span className="text-[10px] text-zinc-500">Separator</span>
        <select value={child.spacing ?? 1}
          onChange={(e) => onChange({ ...child, spacing: Number(e.target.value) as 1 | 2 })}
          className="rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px] text-zinc-400 outline-none">
          <option value={1}>Small</option>
          <option value={2}>Large</option>
        </select>
        <div className="h-px flex-1 bg-zinc-700" />
        <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  if (child.type === 9) {
    const textChildren = child.components || [];
    const addTextChild = () => {
      onChange({ ...child, components: [...textChildren, { type: 10 as const, content: "" }] });
    };
    const updateTextChild = (ti: number, content: string) => {
      const updated = textChildren.map((tc, i) => i === ti ? { ...tc, content } : tc);
      onChange({ ...child, components: updated });
    };
    const removeTextChild = (ti: number) => {
      onChange({ ...child, components: textChildren.filter((_, i) => i !== ti) });
    };
    return (
      <div className="rounded border border-zinc-700 bg-black p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">Section ({textChildren.length} text blocks)</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <div className="space-y-1">
          {textChildren.map((tc, ti) => (
            <div key={ti} className="flex gap-1">
              <textarea value={tc.content || ""}
                onChange={(e) => updateTextChild(ti, e.target.value)}
                placeholder={`Text block ${ti + 1}...`} rows={2} maxLength={2000}
                className="min-w-0 flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 resize-none outline-none" />
              <button type="button" onClick={() => removeTextChild(ti)}
                className="shrink-0 text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <button type="button" onClick={addTextChild}
            className="w-full rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            <Plus className="mr-0.5 inline h-2.5 w-2.5" />Add Text Block
          </button>
        </div>
        <div className="flex gap-1">
          <div className="relative">
            <button type="button" onClick={() => setSectionAccessoryOpen(!sectionAccessoryOpen)}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
              {child.accessory ? "Edit Acc" : "+Acc"}
            </button>
            {sectionAccessoryOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1 w-44 rounded border border-zinc-700 bg-black p-2 shadow-xl">
                {child.accessory?.type === 2 && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-zinc-500">Button Accessory</p>
                    <input type="text" value={(child.accessory as APIButtonComponent).label || ""}
                      onChange={(e) => onChange({ ...child, accessory: { ...child.accessory, label: e.target.value } as APIButtonComponent } as any)}
                      placeholder="Label" className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                    <input type="text" value={(child.accessory as APIButtonComponent).url || (child.accessory as APIButtonComponent).custom_id || ""}
                      onChange={(e) => {
                        const acc = child.accessory as APIButtonComponent;
                        if (acc.style === 5) onChange({ ...child, accessory: { ...acc, url: e.target.value } } as any);
                        else onChange({ ...child, accessory: { ...acc, custom_id: e.target.value } } as any);
                      }}
                      placeholder="URL / Custom ID" className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                    <select value={(child.accessory as APIButtonComponent).style}
                      onChange={(e) => onChange({ ...child, accessory: { ...child.accessory, style: Number(e.target.value) as ButtonStyle } } as any)}
                      className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none">
                      {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{BUTTON_STYLES[s]?.label || s}</option>)}
                    </select>
                  </div>
                )}
                {child.accessory?.type === 11 && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-zinc-500">Thumbnail Accessory</p>
                    <input type="text" value={(child.accessory as APIV2Thumbnail).media?.url || ""}
                      onChange={(e) => onChange({ ...child, accessory: { type: 11, media: { url: e.target.value }, description: (child.accessory as APIV2Thumbnail).description, spoiler: (child.accessory as APIV2Thumbnail).spoiler } } as any)}
                      placeholder="URL..." className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                  </div>
                )}
                {!child.accessory && (
                  <div className="space-y-1">
                    <button type="button" onClick={() => onChange({ ...child, accessory: { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}` } } as any)}
                      className="block w-full rounded px-1.5 py-1 text-[10px] text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Button</button>
                    <button type="button" onClick={() => onChange({ ...child, accessory: { type: 11, media: { url: "" } } } as any)}
                      className="block w-full rounded px-1.5 py-1 text-[10px] text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Thumbnail</button>
                  </div>
                )}
                {(child.accessory) && (
                  <button type="button" onClick={() => onChange({ ...child, accessory: undefined } as any)}
                    className="mt-1 w-full rounded px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-zinc-800">Remove</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

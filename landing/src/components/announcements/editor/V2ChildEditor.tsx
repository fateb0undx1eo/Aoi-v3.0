import { useState } from "react";
import { Image, Plus, X } from "lucide-react";
import { BUTTON_STYLES } from "../constants";
import type { APIButtonComponent, APIV2ChildComponent, APIV2TextDisplay, APIV2Thumbnail, ButtonStyle } from "../types";
import { randomId } from "../utils/message";

export default function V2ChildEditor({ child, onChange, onRemove }: {
  child: APIV2ChildComponent;
  onChange: (c: APIV2ChildComponent) => void;
  onRemove: () => void;
}) {
  const [sectionAccessoryOpen, setSectionAccessoryOpen] = useState(false);

  if (child.type === 10) {
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
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

  if (child.type === 11 || child.type === 12) {
    const label = child.type === 11 ? "Thumbnail" : "Media Gallery";
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">{label}</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <input type="text" value={child.items?.[0]?.media?.url || ""}
          onChange={(e) => onChange({ ...child, items: [{ media: { url: e.target.value } }] } as any)}
          placeholder="Image URL..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
      </div>
    );
  }

  if (child.type === 13) {
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">File</span>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
        <input type="text" value={child.items?.[0]?.media?.url || ""}
          onChange={(e) => onChange({ ...child, items: [{ media: { url: e.target.value } }] } as any)}
          placeholder="File URL..." className="w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
      </div>
    );
  }

  if (child.type === 14) {
    return (
      <div className="flex items-center gap-2 rounded border border-zinc-700 bg-black/30 px-2 py-1">
        <div className="h-px flex-1 bg-zinc-700" />
        <span className="text-[10px] text-zinc-500">Separator</span>
        <div className="h-px flex-1 bg-zinc-700" />
        <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  if (child.type === 9) {
    const textChildren = child.components?.filter((c): c is APIV2TextDisplay => c.type === 10) || [];
    const thumbChild = child.components?.find((c): c is APIV2Thumbnail => c.type === 11);
    const addTextChild = () => {
      const updated = [...(child.components || []), { type: 10 as const, content: "" }];
      onChange({ ...child, components: updated } as any);
    };
    const updateTextChild = (ti: number, content: string) => {
      const updated = [...(child.components || [])];
      const textIdx = updated.findIndex((c, i) => {
        let idx = -1;
        if (c.type === 10) { idx++; if (idx === ti) return true; }
        return false;
      });
      if (textIdx >= 0) updated[textIdx] = { type: 10, content } as APIV2TextDisplay;
      onChange({ ...child, components: updated } as any);
    };
    const removeTextChild = (ti: number) => {
      let idx = -1;
      const updated = (child.components || []).filter((c) => {
        if (c.type === 10) { idx++; if (idx === ti) return false; }
        return true;
      });
      onChange({ ...child, components: updated } as any);
    };
    return (
      <div className="rounded border border-zinc-700 bg-black/30 p-2">
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
        {thumbChild && (
          <input type="text" value={thumbChild.items?.[0]?.media?.url || ""}
            onChange={(e) => {
              const noThumb = (child.components || []).filter((c) => c.type !== 11);
              onChange({ ...child, components: [...noThumb, { type: 11, items: [{ media: { url: e.target.value } }] }] } as any);
            }}
            placeholder="Thumbnail URL..." className="mt-1 w-full rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none" />
        )}
        <div className="flex gap-1">
          {!thumbChild && (
            <button type="button" onClick={() => onChange({ ...child, components: [...(child.components || []), { type: 11, items: [{ media: { url: "" } }] }] } as any)}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"><Image className="mr-0.5 inline h-2.5 w-2.5" />+Thumbnail</button>
          )}
          {thumbChild && (
            <button type="button" onClick={() => onChange({ ...child, components: child.components.filter((c) => c.type !== 11) } as any)}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-red-300">-Thumbnail</button>
          )}
          <div className="relative">
            <button type="button" onClick={() => setSectionAccessoryOpen(!sectionAccessoryOpen)}
              className="rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
              {child.accessory ? "Edit Acc" : "+Acc"}
            </button>
            {sectionAccessoryOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1 w-44 rounded border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
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
                    <input type="text" value={(child.accessory as APIV2Thumbnail).items?.[0]?.media?.url || ""}
                      onChange={(e) => onChange({ ...child, accessory: { type: 11, items: [{ media: { url: e.target.value } }] } } as any)}
                      placeholder="URL..." className="w-full rounded border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] text-zinc-200 outline-none" />
                  </div>
                )}
                {!child.accessory && (
                  <div className="space-y-1">
                    <button type="button" onClick={() => onChange({ ...child, accessory: { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}` } } as any)}
                      className="block w-full rounded px-1.5 py-1 text-[10px] text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Button</button>
                    <button type="button" onClick={() => onChange({ ...child, accessory: { type: 11, items: [{ media: { url: "" } }] } } as any)}
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

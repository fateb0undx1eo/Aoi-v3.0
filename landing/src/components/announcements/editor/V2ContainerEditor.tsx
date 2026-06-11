import { ChevronDown, ChevronUp, Minus, Plus, X } from "lucide-react";
import type { APIContainerComponent, APIV2ChildComponent } from "../types";
import { ACCENT } from "../constants";
import { intToHex } from "../utils/color";
import ColorSwatch from "../pickers/ColorSwatch";
import V2ChildEditor from "./V2ChildEditor";

export default function V2ContainerEditor({ container, onContainerChange, onRemove }: {
  container: APIContainerComponent;
  onContainerChange: (c: APIContainerComponent) => void;
  onRemove: () => void;
}) {
  const addChild = (type: APIV2ChildComponent["type"]) => {
    const item: APIV2ChildComponent = type === 10 ? { type: 10, content: "" }
      : type === 11 ? { type: 11, items: [{ media: { url: "" } }] }
      : type === 12 ? { type: 12, items: [{ media: { url: "" } }] }
      : type === 13 ? { type: 13, items: [{ media: { url: "" } }] }
      : type === 14 ? { type: 14, divider: true, spacing: 1 }
      : { type: 9, components: [{ type: 10, content: "" }] };
    onContainerChange({ ...container, components: [...container.components, item] });
  };
  const updateChild = (ci: number, c: APIV2ChildComponent) => {
    const next = [...container.components];
    next[ci] = c;
    onContainerChange({ ...container, components: next });
  };
  const removeChild = (ci: number) => {
    onContainerChange({ ...container, components: container.components.filter((_, i) => i !== ci) });
  };
  const moveChild = (ci: number, dir: "up" | "down") => {
    const next = [...container.components];
    const swap = dir === "up" ? ci - 1 : ci + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[ci], next[swap]] = [next[swap], next[ci]];
    onContainerChange({ ...container, components: next });
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-black p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">V2 Container ({container.components.length} items)</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded border border-zinc-800 bg-black px-1.5 py-0.5">
            <span className="text-[9px] text-zinc-500">Accent</span>
            {container.accent_color != null ? (
              <div className="flex items-center gap-0.5">
                <div className="h-3 w-3 rounded-sm border border-zinc-600" style={{ backgroundColor: intToHex(container.accent_color) }} />
                <ColorSwatch value={container.accent_color} onChange={(v) => onContainerChange({ ...container, accent_color: v ?? undefined })} />
                <button type="button" onClick={() => onContainerChange({ ...container, accent_color: undefined })}
                  className="text-zinc-600 hover:text-red-400" title="Remove accent">
                  <Minus className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => onContainerChange({ ...container, accent_color: 0x06b6d4 })}
                className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
                <Plus className="h-2.5 w-2.5" /> Add
              </button>
            )}
          </div>
          <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="mb-1 space-y-1">
        {container.components.length === 0 ? (
          <div className="py-1 text-center text-[10px] text-zinc-600">Empty container</div>
        ) : (
          container.components.map((child, ci) => (
            <div key={ci} className="group relative">
              <div className="absolute -left-4 top-1/2 flex -translate-y-1/2 flex-col gap-0 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => moveChild(ci, "up")} disabled={ci === 0}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-2.5 w-2.5" /></button>
                <button type="button" onClick={() => moveChild(ci, "down")} disabled={ci === container.components.length - 1}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-2.5 w-2.5" /></button>
              </div>
              <V2ChildEditor child={child} onChange={(c) => updateChild(ci, c)} onRemove={() => removeChild(ci)} />
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {([10, 14, 12, 11, 13, 9] as const).map((t) => (
          <button key={t} type="button" onClick={() => addChild(t)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            +{t === 10 ? "Text" : t === 11 ? "Thumb" : t === 12 ? "Media" : t === 13 ? "File" : t === 14 ? "Divider" : "Section"}
          </button>
        ))}
      </div>
    </div>
  );
}

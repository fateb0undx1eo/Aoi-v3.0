import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { BUTTON_STYLES } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APIStringSelectComponent, APITopLevelComponent, APIV2ChildComponent, ButtonStyle, GuildEmoji } from "../types";
import { randomId } from "../utils/message";
import V2ChildEditor from "./V2ChildEditor";
import V2ContainerEditor from "./V2ContainerEditor";

export default function ComponentEditorForMessage({ components, onChange, onEditComponent, serverEmojis, isV2 }: {
  components: APITopLevelComponent[];
  onChange: (c: APITopLevelComponent[]) => void;
  onEditComponent: (comp: APIComponentInActionRow, ri: number, ci: number) => void;
  serverEmojis: GuildEmoji[];
  isV2?: boolean;
}) {
  const addRow = () => onChange([...components, { type: 1, components: [] }]);
  const removeRow = (ri: number) => onChange(components.filter((_, i) => i !== ri));
  const addButton = (ri: number, style: ButtonStyle = 1) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length >= 5) return r;
      return { ...r, components: [...r.components, { type: 2 as const, style, label: "Button", custom_id: `btn_${randomId()}`, disabled: false } as APIButtonComponent] };
    }));
  };
  const addStringSelect = (ri: number) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length >= 5) return r;
      return { ...r, components: [...r.components, { type: 3 as const, custom_id: `select_${randomId()}`, placeholder: "Choose an option", options: [] } as APIStringSelectComponent] };
    }));
  };
  const removeComp = (ri: number, ci: number) => {
    onChange(components.map((r, i) => i === ri && r.type === 1 ? { ...r, components: r.components.filter((_, j) => j !== ci) } : r));
  };

  const addV2Container = (itemType: APIV2ChildComponent["type"]) => {
    const item: APIV2ChildComponent = itemType === 10 ? { type: 10, content: "" }
      : itemType === 11 ? { type: 11, items: [{ media: { url: "" } }] }
      : itemType === 12 ? { type: 12, items: [{ media: { url: "" } }] }
      : itemType === 13 ? { type: 13, items: [{ media: { url: "" } }] }
      : itemType === 14 ? { type: 14, divider: true, spacing: 1 }
      : { type: 9, components: [{ type: 10, content: "" }] };
    onChange([...components, { type: 17, components: [item] }]);
  };

  const updateContainer = (ri: number, updated: APIContainerComponent) => {
    onChange(components.map((r, i) => i === ri ? updated : r));
  };
  const moveComponent = (ri: number, dir: "up" | "down") => {
    const next = [...components];
    const swap = dir === "up" ? ri - 1 : ri + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[ri], next[swap]] = [next[swap], next[ri]];
    onChange(next);
  };

  const v2AddLabels: { type: APIV2ChildComponent["type"]; label: string }[] = [
    { type: 10, label: "Text" },
    { type: 14, label: "Divider" },
    { type: 12, label: "Media" },
    { type: 11, label: "Thumb" },
    { type: 13, label: "File" },
    { type: 9, label: "Section" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-500">{isV2 ? "Layout Containers (V2)" : "Action Rows"}</p>
        {isV2 && (
          <div className="flex gap-1">
            {v2AddLabels.map(({ type, label }) => (
              <button key={type} type="button" onClick={() => addV2Container(type)}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                <Plus className="h-2.5 w-2.5" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {components.map((row, ri) =>
        row.type === 1 ? (
          <div key={ri} className="group relative rounded-lg border border-zinc-800 bg-black p-2">
            <div className="absolute -left-3 top-1/2 flex -translate-y-1/2 flex-col gap-0 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-2.5 w-2.5" /></button>
              <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-2.5 w-2.5" /></button>
            </div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Row {ri + 1} ({row.components.length}/5)</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => addButton(ri)} className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">+Btn</button>
                <button type="button" onClick={() => addStringSelect(ri)} className="rounded px-2 py-0.5 text-[10px] uppercase text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">+Sel</button>
                {components.length > 1 && <button type="button" onClick={() => removeRow(ri)} className="text-zinc-600 hover:text-red-400"><X className="h-3 w-3" /></button>}
              </div>
            </div>
            {row.components.length === 0 ? (
              <div className="py-2 text-center text-[10px] text-zinc-600">Empty row</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {row.components.map((comp, ci) => (
                  <button key={ci} type="button"
                    onClick={() => onEditComponent(comp, ri, ci)}
                    className="group relative rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-500">
                    {comp.type === 2 ? (
                      <span>{comp.label || "Button"} <span className="text-zinc-500">({BUTTON_STYLES[comp.style]?.label || "?"})</span></span>
                    ) : (
                      <span>Select{comp.placeholder ? `: ${comp.placeholder}` : ""}</span>
                    )}
                    <span className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-500 p-0.5 group-hover:block"
                      onClick={(e) => { e.stopPropagation(); removeComp(ri, ci); }}>
                      <X className="h-2.5 w-2.5 text-white" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : row.type === 17 ? (
          <div key={ri} className="group relative">
            <div className="absolute -left-3 top-6 flex -translate-y-1/2 flex-col gap-0 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-2.5 w-2.5" /></button>
              <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-2.5 w-2.5" /></button>
            </div>
            <V2ContainerEditor container={row} onContainerChange={(c) => updateContainer(ri, c)} onRemove={() => removeRow(ri)} />
          </div>
        ) : null
      )}
      {!isV2 && (
        <button type="button" onClick={addRow}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
          <Plus className="h-3 w-3" /> Add Row
        </button>
      )}
    </div>
  );
}

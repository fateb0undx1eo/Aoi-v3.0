import { CoolIcon } from "@/components/icons/CoolIcon";
import { BUTTON_STYLES, DISCORD_LIMITS } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APITopLevelComponent, APIV2ChildComponent } from "../types";
import { randomId } from "../utils/message";
import V2ChildEditor from "./V2ChildEditor";
import V2ContainerEditor from "./V2ContainerEditor";

export function totalComponentCount(components: any[]): number {
  return components.reduce((sum, c) => {
    let count = 1;
    if (c.components) {
      count += c.components.length;
      for (const child of c.components) {
        if (child.components) count += child.components.length;
      }
    }
    return sum + count;
  }, 0);
}

function reIdComponent(comp: any) {
  if (comp.type === 2 && comp.style !== 5) comp.custom_id = `btn_${randomId()}`;
  if (comp.type >= 3 && comp.type <= 8) comp.custom_id = `sel_${randomId()}`;
  if (comp.components) comp.components.forEach(reIdComponent);
}

export default function ComponentEditorForMessage({ components, onChange, onEditComponent, isV2, onAddAttachment, onAttachmentError }: {
  components: APITopLevelComponent[];
  onChange: (c: APITopLevelComponent[]) => void;
  onEditComponent: (comp: APIComponentInActionRow, ri: number, ci: number) => void;
  isV2?: boolean;
  onAddAttachment?: (file: File) => Promise<string>;
  onAttachmentError?: (message: string) => void;
}) {
  // ── V1 helpers ──────────────────────────────────────────────────
  const addRow = () => {
    if (components.length >= DISCORD_LIMITS.V1_ROWS) return;
    onChange([...components, { type: 1, components: [] }]);
  };
  const removeTop = (ri: number) => onChange(components.filter((_, i) => i !== ri));
  const addButton = (ri: number, style: number = 1) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length >= DISCORD_LIMITS.V1_COMPONENTS_PER_ROW) return r;
      return { ...r, components: [...r.components, { type: 2 as const, style: style as 1|2|3|4|5|6, label: "Button", custom_id: `btn_${randomId()}`, disabled: false } as APIButtonComponent] };
    }));
  };
  const addSelectToRow = (ri: number, selType: number) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length > 0) return r;
      const sel: any = selType === 3
        ? { type: 3, custom_id: `sel_${randomId()}`, placeholder: "Choose", options: [] }
        : { type: selType, custom_id: `sel_${randomId()}`, placeholder: "Select..." };
      return { ...r, components: [sel] };
    }));
  };
  const removeComp = (ri: number, ci: number) => {
    onChange(components.map((r, i) => i === ri && r.type === 1 ? { ...r, components: r.components.filter((_, j) => j !== ci) } : r));
  };
  const duplicate = (ri: number) => {
    const row = components[ri];
    if (!row) return;
    const cloned = JSON.parse(JSON.stringify(row));
    if (cloned.type === 1) reIdComponent(cloned);
    if (cloned.type === 17) cloned.components?.forEach(reIdComponent);
    const next = [...components];
    next.splice(ri + 1, 0, cloned);
    onChange(next);
  };

  // ── V2 helpers ──────────────────────────────────────────────────
  const addV2Bare = (itemType: APIV2ChildComponent["type"]) => {
    if (totalComponentCount(components) >= DISCORD_LIMITS.V2_TOTAL_COMPONENTS) return;
    const item: APIV2ChildComponent = itemType === 10 ? { type: 10, content: "" }
      : itemType === 12 ? { type: 12, items: [{ media: { url: "" } }] }
      : itemType === 13 ? { type: 13, file: { url: "" } }
      : itemType === 14 ? { type: 14, spacing: 1 }
      : itemType === 9 ? { type: 9, components: [{ type: 10, content: "" }] }
      : { type: 1, components: [] };
    onChange([...components, item]);
  };
  const addV2Container = () => {
    if (totalComponentCount(components) >= DISCORD_LIMITS.V2_TOTAL_COMPONENTS) return;
    onChange([...components, { type: 17, components: [] }]);
  };
  const updateContainer = (ri: number, updated: APIContainerComponent) => {
    onChange(components.map((r, i) => i === ri ? updated : r));
  };
  const updateBare = (ri: number, updated: APIV2ChildComponent) => {
    onChange(components.map((r, i) => i === ri ? updated : r));
  };
  const moveComponent = (ri: number, dir: "up" | "down") => {
    const next = [...components];
    const swap = dir === "up" ? ri - 1 : ri + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[ri]!, next[swap]!] = [next[swap]!, next[ri]!];
    onChange(next);
  };

  const v2BareLabels: { type: APIV2ChildComponent["type"]; label: string }[] = [
    { type: 10, label: "Text" },
    { type: 14, label: "Divider" },
    { type: 12, label: "Media" },
    { type: 13, label: "File" },
    { type: 9, label: "Section" },
    { type: 1, label: "Row" },
  ];

  const total = totalComponentCount(components);

  // ── V1 row: detect contents ──────────────────────────────────────
  function v1RowAdders(row: APITopLevelComponent & { type: 1 }, ri: number) {
    const hasSelect = row.components.some(c => c.type !== 2);
    const hasButton = row.components.some(c => c.type === 2);
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {!hasSelect && row.components.length < DISCORD_LIMITS.V1_COMPONENTS_PER_ROW && (
          <>
            <button type="button" onClick={() => addButton(ri, 1)}
              className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-800 bg-[#111] text-zinc-500 hover:text-zinc-300 cursor-pointer uppercase">+Btn</button>
            <button type="button" onClick={() => addButton(ri, 5)}
              className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-800 bg-[#111] text-zinc-500 hover:text-zinc-300 cursor-pointer uppercase">+Link</button>
          </>
        )}
        {row.components.length === 0 && (
          <select defaultValue="" onChange={(e) => { const v = e.target.value; if (v) { addSelectToRow(ri, Number(v)); } }}
            className="text-[9px] px-1 py-0.5 rounded border border-zinc-800 bg-[#111] text-zinc-500 outline-none">
            <option value="" disabled>+Select...</option>
            <option value={3}>String</option>
            <option value={5}>User</option>
            <option value={6}>Role</option>
            <option value={7}>Mentionable</option>
            <option value={8}>Channel</option>
          </select>
        )}
        <button type="button" onClick={() => duplicate(ri)}
          className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-800 bg-[#111] text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center">
          <CoolIcon icon="Copy" size={10} />
        </button>
        {components.length > 1 && (
          <button type="button" onClick={() => removeTop(ri)}
            className="text-zinc-600 hover:text-red-400 flex items-center p-0 border-none bg-none cursor-pointer">
            <CoolIcon icon="Close_MD" size={12} />
          </button>
        )}
      </div>
    );
  }

  const addBtnClass = "flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-300 cursor-pointer";

  return (
    <div className="flex flex-col gap-2">
      {/* Header + V2 add buttons */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">
          {isV2 ? `Components (${total}/${DISCORD_LIMITS.V2_TOTAL_COMPONENTS})` : `Action Rows (${components.length}/${DISCORD_LIMITS.V1_ROWS})`}
        </span>
        {isV2 && (
          <div className="flex gap-1 flex-wrap">
            {v2BareLabels.map(({ type, label }) => (
              <button key={type} type="button" onClick={() => addV2Bare(type)}
                className={addBtnClass}>
                <CoolIcon icon="Add_Plus" size={16} />
              </button>
            ))}
            <button type="button" onClick={addV2Container}
              className="flex items-center justify-center w-7 h-7 rounded text-purple-400 hover:text-purple-300 cursor-pointer">
              <CoolIcon icon="Add_Plus" size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Component list */}
      <div className="space-y-1">
        {components.map((row, ri) => {
          // V1 Action Row
          if (row.type === 1) {
            return (
              <div key={ri} className="relative rounded-lg border border-zinc-800 p-2" style={{ backgroundColor: "#151515" }}>
                {/* Move buttons */}
                <div
                  className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-30 hover:opacity-100 transition-opacity"
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                  <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === 0 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Up" size={10} />
                  </button>
                  <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === components.length - 1 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Down" size={10} />
                  </button>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-400">
                    Row {ri + 1} <span className="text-zinc-600 font-normal">({row.components.length}/{DISCORD_LIMITS.V1_COMPONENTS_PER_ROW})</span>
                  </span>
                  {v1RowAdders(row, ri)}
                </div>
                {row.components.length === 0 ? (
                  <div className="text-center py-2 text-[10px] text-zinc-600">Empty &mdash; add buttons or a select menu</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {row.components.map((comp, ci) => (
                      <button key={ci} type="button" onClick={() => onEditComponent(comp, ri, ci)}
                        className="relative px-2 py-1 rounded border border-zinc-800 bg-[#111] text-zinc-400 text-[10px] cursor-pointer hover:border-zinc-700">
                        {comp.type === 2 ? (
                          <span>{comp.label || "Button"} <span className="text-zinc-600">({BUTTON_STYLES[comp.style]?.label || "?"})</span></span>
                        ) : (
                          <span>{["String","","User","Role","Mentionable","Channel"][comp.type - 3] || "Select"} Select</span>
                        )}
                        <span
                          className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); removeComp(ri, ci); }}>x</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // V2 Container
          if (row.type === 17) {
            return (
              <div key={ri} className="relative">
                <div
                  className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-30 hover:opacity-100 transition-opacity"
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                  <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === 0 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Up" size={10} />
                  </button>
                  <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === components.length - 1 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Down" size={10} />
                  </button>
                </div>
                <V2ContainerEditor container={row} onContainerChange={(c) => updateContainer(ri, c)} onRemove={() => removeTop(ri)} totalComponentCount={total} onAddAttachment={onAddAttachment} onAttachmentError={onAttachmentError} />
              </div>
            );
          }

          // V2 bare component
          if (row.type === 10 || row.type === 12 || row.type === 13 || row.type === 14 || row.type === 9) {
            return (
              <div key={ri} className="relative">
                <div
                  className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-30 hover:opacity-100 transition-opacity"
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                  <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === 0 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Up" size={10} />
                  </button>
                  <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === components.length - 1 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Down" size={10} />
                  </button>
                </div>
                <V2ChildEditor child={row} onChange={(c) => updateBare(ri, c)} onRemove={() => removeTop(ri)} onAddAttachment={onAddAttachment} onAttachmentError={onAttachmentError} />
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* V1 add row button */}
      {!isV2 && (
        <button type="button" onClick={addRow} disabled={components.length >= DISCORD_LIMITS.V1_ROWS}
          className="w-full py-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer disabled:opacity-40 flex items-center justify-center">
          <CoolIcon icon="Add_Plus" size={16} />
        </button>
      )}
    </div>
  );
}

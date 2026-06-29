import { ChevronDown, ChevronUp, Copy, Plus, X } from "lucide-react";
import { BUTTON_STYLES, DISCORD_LIMITS } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APITopLevelComponent, APIV2ChildComponent } from "../types";
import { randomId } from "../utils/message";
import V2ChildEditor from "./V2ChildEditor";
import V2ContainerEditor from "./V2ContainerEditor";

function totalComponentCount(components: any[]): number {
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

export default function ComponentEditorForMessage({ components, onChange, onEditComponent, isV2 }: {
  components: APITopLevelComponent[];
  onChange: (c: APITopLevelComponent[]) => void;
  onEditComponent: (comp: APIComponentInActionRow, ri: number, ci: number) => void;
  isV2?: boolean;
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
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {/* Buttons — only if no select present */}
        {!hasSelect && row.components.length < DISCORD_LIMITS.V1_COMPONENTS_PER_ROW && (
          <>
            <button type="button" onClick={() => addButton(ri, 1)}
              style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, border: "1px solid #27272a", background: "#111", color: "#71717a", cursor: "pointer", textTransform: "uppercase" }}>+Btn</button>
            <button type="button" onClick={() => addButton(ri, 5)}
              style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, border: "1px solid #27272a", background: "#111", color: "#71717a", cursor: "pointer", textTransform: "uppercase" }}>+Link</button>
          </>
        )}
        {/* Select — only if row is empty */}
        {row.components.length === 0 && (
          <select defaultValue="" onChange={(e) => { const v = e.target.value; if (v) { addSelectToRow(ri, Number(v)); } }}
            style={{ fontSize: 9, padding: "2px 4px", borderRadius: 3, border: "1px solid #27272a", background: "#111", color: "#71717a", outline: "none" }}>
            <option value="" disabled>+Select...</option>
            <option value={3}>String</option>
            <option value={5}>User</option>
            <option value={6}>Role</option>
            <option value={7}>Mentionable</option>
            <option value={8}>Channel</option>
          </select>
        )}
        <button type="button" onClick={() => duplicate(ri)}
          style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, border: "1px solid #27272a", background: "#111", color: "#71717a", cursor: "pointer" }}>
          <Copy size={10} />
        </button>
        {components.length > 1 && (
          <button type="button" onClick={() => removeTop(ri)}
            style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#71717a" }}>
          {isV2 ? `Components (${total}/${DISCORD_LIMITS.V2_TOTAL_COMPONENTS})` : `Action Rows (${components.length}/${DISCORD_LIMITS.V1_ROWS})`}
        </span>
        {isV2 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {v2BareLabels.map(({ type, label }) => (
              <button key={type} type="button" onClick={() => addV2Bare(type)}
                style={{ fontSize: 9, padding: "3px 7px", borderRadius: 4, border: "1px solid #27272a", background: "#111", color: "#71717a", cursor: "pointer", textTransform: "uppercase" }}>
                <Plus size={9} style={{ display: "inline", marginRight: 2 }} />{label}
              </button>
            ))}
            <button type="button" onClick={addV2Container}
              style={{ fontSize: 9, padding: "3px 7px", borderRadius: 4, border: "1px solid #a855f7", background: "#1a0a2e", color: "#a855f7", cursor: "pointer", textTransform: "uppercase", fontWeight: 600 }}>
              <Plus size={9} style={{ display: "inline", marginRight: 2 }} />Container
            </button>
          </div>
        )}
      </div>

      {/* Component list */}
      {components.map((row, ri) => {
        // V1 Action Row
        if (row.type === 1) {
          return (
            <div key={ri} style={{ position: "relative", borderRadius: 8, border: "1px solid #27272a", backgroundColor: "#000", padding: 8 }}>
              <div style={{
                position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                display: "flex", flexDirection: "column", gap: 1, opacity: 0.3,
              }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ri === 0 ? 0.3 : 1 }}>
                  <ChevronUp size={10} />
                </button>
                <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ri === components.length - 1 ? 0.3 : 1 }}>
                  <ChevronDown size={10} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa" }}>
                  Row {ri + 1} <span style={{ color: "#52525b", fontWeight: 400 }}>({row.components.length}/{DISCORD_LIMITS.V1_COMPONENTS_PER_ROW})</span>
                </span>
                {v1RowAdders(row, ri)}
              </div>
              {row.components.length === 0 ? (
                <div style={{ textAlign: "center", padding: "8px 0", fontSize: 10, color: "#52525b" }}>Empty — add buttons or a select menu</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {row.components.map((comp, ci) => (
                    <button key={ci} type="button" onClick={() => onEditComponent(comp, ri, ci)}
                      style={{ position: "relative", padding: "4px 8px", borderRadius: 6, border: "1px solid #27272a", backgroundColor: "#111", color: "#a1a1aa", fontSize: 10, cursor: "pointer" }}>
                      {comp.type === 2 ? (
                        <span>{comp.label || "Button"} <span style={{ color: "#52525b" }}>({BUTTON_STYLES[comp.style]?.label || "?"})</span></span>
                      ) : (
                        <span>{["String","","","User","Role","Mentionable","Channel"][comp.type - 3] || "Select"} Select</span>
                      )}
                      <span style={{ position: "absolute", top: -5, right: -5, width: 12, height: 12, borderRadius: "50%", backgroundColor: "#ef4444", color: "#fff", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
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
            <div key={ri} style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                display: "flex", flexDirection: "column", gap: 1, opacity: 0.3,
              }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ri === 0 ? 0.3 : 1 }}>
                  <ChevronUp size={10} />
                </button>
                <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ri === components.length - 1 ? 0.3 : 1 }}>
                  <ChevronDown size={10} />
                </button>
              </div>
              <V2ContainerEditor container={row} onContainerChange={(c) => updateContainer(ri, c)} onRemove={() => removeTop(ri)} totalComponentCount={total} />
            </div>
          );
        }

        // V2 bare component (Text Display, Separator, Media Gallery, File, Section)
        if (row.type === 10 || row.type === 12 || row.type === 13 || row.type === 14 || row.type === 9) {
          return (
            <div key={ri} style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                display: "flex", flexDirection: "column", gap: 1, opacity: 0.3,
              }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ri === 0 ? 0.3 : 1 }}>
                  <ChevronUp size={10} />
                </button>
                <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ri === components.length - 1 ? 0.3 : 1 }}>
                  <ChevronDown size={10} />
                </button>
              </div>
              <V2ChildEditor child={row} onChange={(c) => updateBare(ri, c)} onRemove={() => removeTop(ri)} />
            </div>
          );
        }

        return null;
      })}

      {/* V1 add row button */}
      {!isV2 && (
        <button type="button" onClick={addRow} disabled={components.length >= DISCORD_LIMITS.V1_ROWS}
          style={{
            width: "100%", padding: "6px 0", fontSize: 10, borderRadius: 8,
            border: "1px dashed #27272a", background: "transparent", color: "#71717a",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
          <Plus size={12} /> Add Row
        </button>
      )}
    </div>
  );
}

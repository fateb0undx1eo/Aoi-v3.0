import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { APIContainerComponent, APIV2ChildComponent } from "../types";

import { intToHex, decimalToRgb } from "../utils/color";
import ColorSwatch from "../pickers/ColorSwatch";
import V2ChildEditor from "./V2ChildEditor";

const CONTAINER_CHILD_TYPES: { type: APIV2ChildComponent["type"]; label: string }[] = [
  { type: 10, label: "Text" },
  { type: 14, label: "Separator" },
  { type: 12, label: "Media" },
  { type: 13, label: "File" },
  { type: 9,  label: "Section" },
  { type: 1,  label: "Row" },
];

export default function V2ContainerEditor({ container, onContainerChange, onRemove, totalComponentCount }: {
  container: APIContainerComponent;
  onContainerChange: (c: APIContainerComponent) => void;
  onRemove: () => void;
  totalComponentCount?: number;
}) {
  const accentColorVal = container.accent_color;
  const hasAccent = accentColorVal != null;

  const addChild = (type: APIV2ChildComponent["type"]) => {
    if (totalComponentCount != null && totalComponentCount >= 40) return;
    const item: APIV2ChildComponent = type === 10 ? { type: 10, content: "" }
      : type === 12 ? { type: 12, items: [{ media: { url: "" } }] }
      : type === 13 ? { type: 13, file: { url: "" } }
      : type === 14 ? { type: 14, spacing: 1 }
      : type === 9 ? { type: 9, components: [{ type: 10, content: "" }] }
      : { type: 1, components: [] };
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
    [next[ci]!, next[swap]!] = [next[swap]!, next[ci]!];
    onContainerChange({ ...container, components: next });
  };

  return (
    <div style={{
      borderRadius: 8, border: hasAccent ? `1px solid rgba(${decimalToRgb(accentColorVal!).r},${decimalToRgb(accentColorVal!).g},${decimalToRgb(accentColorVal!).b},0.25)` : "1px solid #27272a",
      backgroundColor: "#000",
      padding: 10,
      borderLeft: hasAccent ? `4px solid ${intToHex(accentColorVal!)}` : "4px solid transparent",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa" }}>
            Container <span style={{ color: "#52525b", fontWeight: 400 }}>({container.components.length} items)</span>
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#71717a", cursor: "pointer" }}>
            <input type="checkbox" checked={container.spoiler ?? false}
              onChange={(e) => onContainerChange({ ...container, spoiler: e.target.checked || undefined })}
              style={{ width: 11, height: 11 }} />
            Spoiler
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Accent */}
          {hasAccent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3, borderRadius: 4, border: "1px solid #27272a", padding: "2px 6px", backgroundColor: "#09090b" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, border: "1px solid #3f3f46", backgroundColor: intToHex(accentColorVal!) }} />
              <ColorSwatch value={accentColorVal!} onChange={(v) => { if (v != null) onContainerChange({ ...container, accent_color: v }); }} />
              <button type="button" onClick={() => onContainerChange({ ...container, accent_color: undefined })}
                style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}
                title="Remove accent">
                <X size={10} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => onContainerChange({ ...container, accent_color: 0x5865F2 })}
              style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4,
                border: "1px solid #27272a", backgroundColor: "#111",
                color: "#71717a", cursor: "pointer",
              }}>
              + Accent
            </button>
          )}
          <button type="button" onClick={onRemove}
            style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Children */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
        {container.components.length === 0 ? (
          <div style={{ textAlign: "center", padding: "8px 0", fontSize: 10, color: "#52525b" }}>
            Container is empty — add children below
          </div>
        ) : (
          container.components.map((child, ci) => (
            <div key={ci} style={{ position: "relative" }}>
              {/* Move buttons */}
              <div style={{
                position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                display: "flex", flexDirection: "column", gap: 1, opacity: 0.6,
              }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}>
                <button type="button" onClick={() => moveChild(ci, "up")} disabled={ci === 0}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ci === 0 ? 0.3 : 1 }}>
                  <ChevronUp size={10} />
                </button>
                <button type="button" onClick={() => moveChild(ci, "down")} disabled={ci === container.components.length - 1}
                  style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1, opacity: ci === container.components.length - 1 ? 0.3 : 1 }}>
                  <ChevronDown size={10} />
                </button>
              </div>
              <V2ChildEditor child={child} onChange={(c) => updateChild(ci, c)} onRemove={() => removeChild(ci)} />
            </div>
          ))
        )}
      </div>

      {/* Add buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {CONTAINER_CHILD_TYPES.map(({ type, label }) => (
          <button key={type} type="button" onClick={() => addChild(type)}
            style={{
              display: "flex", alignItems: "center", gap: 3, padding: "3px 8px",
              fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em",
              borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
              color: "#71717a", cursor: "pointer",
            }}>
            <Plus size={9} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

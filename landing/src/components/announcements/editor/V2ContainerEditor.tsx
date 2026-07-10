import { CoolIcon } from "@/components/icons/CoolIcon";
import type { APIContainerComponent, APIV2ChildComponent } from "../types";
import { intToHex, decimalToRgb } from "../utils/color";
import ColorPickerPopover from "../pickers/ColorPickerPopover";
import V2ChildEditor from "./V2ChildEditor";

const CONTAINER_CHILD_TYPES: { type: APIV2ChildComponent["type"]; label: string }[] = [
  { type: 10, label: "Text" },
  { type: 14, label: "Separator" },
  { type: 12, label: "Media" },
  { type: 13, label: "File" },
  { type: 9,  label: "Section" },
  { type: 1,  label: "Row" },
];

export default function V2ContainerEditor({ container, onContainerChange, onRemove, totalComponentCount, onAddAttachment, onAttachmentError }: {
  container: APIContainerComponent;
  onContainerChange: (c: APIContainerComponent) => void;
  onRemove: () => void;
  totalComponentCount: number;
  onAddAttachment?: (file: File) => Promise<string>;
  onAttachmentError?: (message: string) => void;
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

  const borderColor = hasAccent
    ? `rgba(${decimalToRgb(accentColorVal!).r},${decimalToRgb(accentColorVal!).g},${decimalToRgb(accentColorVal!).b},0.25)`
    : "#27272a";
  const leftBorderColor = hasAccent ? intToHex(accentColorVal!) : "transparent";

  return (
    <div
      className="rounded-lg p-2.5"
      style={{
        backgroundColor: "#151515",
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${leftBorderColor}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-400">
            Container <span className="text-zinc-600 font-normal">({container.components.length} items)</span>
          </span>
          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer">
            <input type="checkbox" checked={container.spoiler ?? false}
              onChange={(e) => onContainerChange({ ...container, spoiler: e.target.checked || undefined })}
              className="h-2.5 w-2.5 rounded border-zinc-700 bg-zinc-800" />
            Spoiler
          </label>
        </div>
        <div className="flex items-center gap-1">
          {/* Accent color */}
          {hasAccent ? (
            <div className="flex items-center gap-1 rounded border border-zinc-800 px-1.5 py-0.5" style={{ backgroundColor: "#09090b" }}>
              <div
                className="h-2.5 w-2.5 rounded border border-zinc-700"
                style={{ backgroundColor: intToHex(accentColorVal!) }}
              />
              <ColorPickerPopover value={accentColorVal!} onChange={(v) => { onContainerChange({ ...container, accent_color: v }); }} />
              <button type="button" onClick={() => onContainerChange({ ...container, accent_color: undefined })}
                className="text-zinc-600 hover:text-zinc-300 flex items-center p-0 border-none bg-none cursor-pointer"
                title="Remove accent">
                <CoolIcon icon="Close_MD" size={10} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => onContainerChange({ ...container, accent_color: 0x5865F2 })}
              className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-800 bg-[#111] text-zinc-500 hover:text-zinc-300 cursor-pointer">
              + Accent
            </button>
          )}
          <button type="button" onClick={onRemove}
            className="text-zinc-600 hover:text-red-400 flex items-center p-0 border-none bg-none cursor-pointer">
            <CoolIcon icon="Close_MD" size={12} />
          </button>
        </div>
      </div>

      {/* Children */}
      <div className="space-y-1 mb-2">
        {container.components.length === 0 ? (
          <div className="text-center py-3 text-[10px] text-zinc-600">
            Container is empty &mdash; add children below
          </div>
        ) : (
          container.components.map((child, ci) => (
            <div key={ci} className="relative">
              {/* Move buttons */}
              <div
                className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-60 hover:opacity-100 transition-opacity"
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}>
                <button type="button" onClick={() => moveChild(ci, "up")} disabled={ci === 0}
                  className={`flex items-center p-0 border-none bg-none cursor-pointer ${ci === 0 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                  <CoolIcon icon="Chevron_Up" size={10} />
                </button>
                <button type="button" onClick={() => moveChild(ci, "down")} disabled={ci === container.components.length - 1}
                  className={`flex items-center p-0 border-none bg-none cursor-pointer ${ci === container.components.length - 1 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                  <CoolIcon icon="Chevron_Down" size={10} />
                </button>
              </div>
              <V2ChildEditor child={child} onChange={(c) => updateChild(ci, c)} onRemove={() => removeChild(ci)} onAddAttachment={onAddAttachment} onAttachmentError={onAttachmentError} />
            </div>
          ))
        )}
      </div>

      {/* Add buttons */}
      <div className="flex flex-wrap gap-1">
        {CONTAINER_CHILD_TYPES.map(({ type, label }) => (
          <button key={type} type="button" onClick={() => addChild(type)}
            className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider rounded border border-zinc-800 bg-[#111] text-zinc-500 hover:text-zinc-300 cursor-pointer">
            <CoolIcon icon="Add_Plus" size={11} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

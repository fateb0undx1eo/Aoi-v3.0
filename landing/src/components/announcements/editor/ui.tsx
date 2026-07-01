import { useState, useRef, type ReactNode } from "react";
import { ChevronDown, Plus, Hash } from "lucide-react";
import { C } from "../constants";

export function Label({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, color: muted ? C.textMuted : C.text, ...style }}>
      {children}
    </span>
  );
}

export function Input({ value, onChange, placeholder, multiline, rows, style, inputRef, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; rows?: number; style?: React.CSSProperties;
  inputRef?: React.Ref<HTMLTextAreaElement | HTMLInputElement>;
  disabled?: boolean;
}) {
  const cls: React.CSSProperties = {
    width: "100%", borderRadius: 8, border: "none",
    backgroundColor: "#1A1A1A", color: C.text, fontSize: 13, outline: "none",
    padding: multiline ? "8px 12px" : "6px 10px", fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1,
    ...style,
  };
  const setRef = (node: HTMLTextAreaElement | HTMLInputElement | null) => {
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef && "current" in inputRef) (inputRef as React.MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>).current = node;
  };
  if (multiline) {
    return (
      <textarea ref={setRef as any} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled}
        rows={rows || 4} style={{ ...cls, resize: "vertical" }} />
    );
  }
  return (
    <input ref={setRef as any} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={cls} />
  );
}

export function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean;
}) {
  return (
    <label
      onClick={() => { if (!disabled) onChange(!checked); }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}>
      <div style={{
        width: 32, height: 18, borderRadius: 10, position: "relative",
        backgroundColor: checked ? C.burg : "#3f3f46",
        transition: "background 0.2s", flexShrink: 0, pointerEvents: "none",
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%", backgroundColor: "#fff",
          position: "absolute", top: 2, left: checked ? 16 : 2,
          transition: "left 0.2s",
        }} />
      </div>
      {label && <span style={{ fontSize: 12, color: C.text, userSelect: "none" }}>{label}</span>}
    </label>
  );
}

export function Section({ title, badge, defaultOpen, titleStyle, collapsible, children }: {
  title: string; badge?: string; defaultOpen?: boolean; titleStyle?: React.CSSProperties; collapsible?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen !== false);
  const show = collapsible === false ? true : open;
  return (
    <div style={{ borderBottom: `1px solid #181818` }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "10px 12px", color: C.text,
        fontSize: 13, fontWeight: 600, textAlign: "left",
        ...(collapsible !== false ? { cursor: "pointer", background: "none", border: "none" } : {}),
      }}
        onClick={() => { if (collapsible !== false) setOpen(!open); }}
        role={collapsible !== false ? "button" : undefined}
        aria-expanded={collapsible !== false ? open : undefined}
        tabIndex={collapsible !== false ? 0 : undefined}
        onKeyDown={collapsible !== false ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } } : undefined}
      >
        {collapsible !== false && (
          <ChevronDown style={{
            width: 14, height: 14, color: C.textMuted, flexShrink: 0,
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.15s",
          }} />
        )}
        <span style={{ flex: 1, ...titleStyle }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 500, padding: "1px 8px", borderRadius: 10,
            backgroundColor: "transparent", color: C.textMuted, flexShrink: 0,
          }}>{badge}</span>
        )}
      </div>
      {show && <div style={{ padding: "0 12px 12px 12px" }}>{children}</div>}
    </div>
  );
}

export function ChannelTag({ name, selected, onClick }: { name: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
        border: `1px solid ${selected ? `${C.burg}60` : C.border}`,
        backgroundColor: selected ? `${C.burg}15` : "transparent",
        color: selected ? C.burg : C.textMuted, cursor: "pointer",
        transition: "all 0.15s",
      }}>
      <Hash style={{ width: 10, height: 10 }} />{name}
    </button>
  );
}

export function EmbedRow({ title, onEdit, onRemove }: { title?: string; onEdit?: () => void; onRemove?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px",
    }}>
      <div style={{
        width: 3, height: 28, borderRadius: 2, backgroundColor: C.burg, flexShrink: 0,
      }} />
      <span style={{ flex: 1, fontSize: 12, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title || "Untitled Embed"}
      </span>
      {onEdit && <button type="button" onClick={onEdit} style={{ fontSize: 10, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>Edit</button>}
      {onRemove && <button type="button" onClick={onRemove} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Remove</button>}
    </div>
  );
}

export function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        display: "flex", width: "100%", alignItems: "center", gap: 6,
        padding: "6px 0", fontSize: 11, fontWeight: 500,
        backgroundColor: "transparent", border: "none",
        color: disabled ? "#52525b" : C.textMuted, cursor: disabled ? "not-allowed" : "pointer",
        transition: "color 0.12s",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = C.text; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.color = C.textMuted; }}>
      <Plus style={{ width: 12, height: 12 }} /> {label}
    </button>
  );
}

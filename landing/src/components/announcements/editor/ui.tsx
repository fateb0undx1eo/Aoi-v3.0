import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, Hash } from "lucide-react";
import { C } from "../constants";

export function Label({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, color: muted ? C.textMuted : C.text, ...style }}>
      {children}
    </span>
  );
}

export function Input({ value, onChange, placeholder, multiline, rows, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; rows?: number; style?: React.CSSProperties;
}) {
  const cls: React.CSSProperties = {
    width: "100%", borderRadius: 8, border: `1px solid ${C.border}`,
    backgroundColor: C.bg, color: C.text, fontSize: 13, outline: "none",
    padding: multiline ? "8px 12px" : "6px 10px", fontFamily: "inherit",
    ...style,
  };
  if (multiline) {
    return (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        rows={rows || 4} style={{ ...cls, resize: "vertical" }} />
    );
  }
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={cls} />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        style={{
          width: 32, height: 18, borderRadius: 10, position: "relative",
          backgroundColor: checked ? C.burg : "#3f3f46",
          transition: "background 0.2s", cursor: "pointer", flexShrink: 0,
        }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%", backgroundColor: "#fff",
          position: "absolute", top: 2, left: checked ? 16 : 2,
          transition: "left 0.2s",
        }} />
      </div>
      {label && <span style={{ fontSize: 12, color: C.text }}>{label}</span>}
    </label>
  );
}

export function Section({ title, badge, defaultOpen, children, accent }: {
  title: string; badge?: string; defaultOpen?: boolean; children: ReactNode; accent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${accent ? `${C.burg}60` : C.border}`,
      backgroundColor: C.card, overflow: "hidden",
    }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "10px 12px", background: "none", border: "none", color: C.text,
          cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left",
        }}>
        <ChevronDown style={{
          width: 14, height: 14, color: C.textMuted, flexShrink: 0,
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          transition: "transform 0.15s",
        }} />
        <span style={{ flex: 1 }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 10,
            backgroundColor: `${C.burg}20`, color: C.burg, flexShrink: 0,
          }}>{badge}</span>
        )}
      </button>
      {open && <div style={{ padding: "0 12px 12px 12px" }}>{children}</div>}
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
      <Hash style={{ width: 10, height: 10 }} /> {name}
    </button>
  );
}

export function EmbedRow({ title, onEdit, onRemove }: { title?: string; onEdit?: () => void; onRemove?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px", borderRadius: 8,
      border: `1px solid ${C.border}`, backgroundColor: C.bg,
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
        display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "8px 0", borderRadius: 8, fontSize: 11, fontWeight: 500,
        border: `1px dashed ${C.border}`, backgroundColor: "transparent",
        color: disabled ? "#52525b" : C.textMuted, cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}>
      <Plus style={{ width: 12, height: 12 }} /> {label}
    </button>
  );
}

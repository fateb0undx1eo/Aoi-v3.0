import { C } from "./constants";

export function AccessoryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
        border: `1px solid ${C.border}`, backgroundColor: "transparent",
        color: C.textMuted, cursor: "pointer", transition: "all 0.12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.textMuted; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}>
      {label}
    </button>
  );
}

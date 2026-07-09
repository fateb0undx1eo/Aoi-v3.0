import { useState, type ReactNode } from "react";
import { C } from "./constants";

export function ToolbarButton({ icon, tooltip, onClick }: { icon: ReactNode; tooltip: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, borderRadius: 6, border: "none",
          backgroundColor: "transparent", color: "#fff", cursor: "pointer",
          transition: "all 0.12s", outline: "none",
          transform: hovered ? "translateY(-2px)" : "none",
        }}
      >
        {icon}
      </button>
      {hovered && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: "50%",
          transform: "translateX(-50%)",
          padding: "4px 10px", borderRadius: 6,
          backgroundColor: "#18181b", color: C.text,
          fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          border: `1px solid ${C.border}`,
          zIndex: 200, pointerEvents: "none",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

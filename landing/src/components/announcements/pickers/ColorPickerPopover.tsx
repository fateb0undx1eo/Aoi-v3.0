import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { getPlacement } from "../utils/placement";

export default function ColorPickerPopover({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const hex =
    typeof value === "number"
      ? `#${value.toString(16).padStart(6, "0")}`
      : "#8B1538";
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = () => {
    if (!open) {
      if (btnRef.current) setPlacement(getPlacement(btnRef.current));
    }
    setOpen(!open);
  };

  return (
    <div ref={popoverRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button ref={btnRef} type="button" onClick={toggle}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 8px", borderRadius: 6,
            backgroundColor: "rgba(0,0,0,0.3)", cursor: "pointer",
            fontSize: 10, color: "#a1a1aa", fontFamily: "monospace",
          }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: hex, flexShrink: 0 }} />
          {hex}
        </button>
        {value != null && (
          <button type="button" onClick={() => onChange(undefined)}
            style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", fontSize: 10, padding: 2 }}>
            Reset
          </button>
        )}
      </div>
      {open && (
        <div style={{
          position: "absolute", left: 0, zIndex: 30,
          top: placement === "below" ? "calc(100% + 4px)" : undefined,
          bottom: placement === "above" ? "calc(100% + 4px)" : undefined,
          borderRadius: 8,
          backgroundColor: "#1A1A1A", padding: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <HexColorPicker
            color={hex}
            onChange={(h) => {
              const num = Number.parseInt(h.replace("#", ""), 16);
              if (!isNaN(num)) onChange(num);
            }}
            style={{ width: 180, height: 130 }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: "#52525b", fontFamily: "monospace", alignSelf: "center" }}>#</span>
            <input type="text" value={hex.replace("#", "")}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                if (v.length <= 6) {
                  if (v.length === 6) {
                    const num = Number.parseInt(v, 16);
                    onChange(!isNaN(num) ? num : undefined);
                  }
                }
              }}
              style={{
                flex: 1, background: "transparent", border: "none", borderBottom: "1px solid #3f3f46",
                color: "#a1a1aa", fontSize: 11, fontFamily: "monospace", outline: "none",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

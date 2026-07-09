import { useState, useEffect, useRef } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { C } from "./constants";
import { getPlacement } from "./utils/placement";

function DropItem({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  const [h, sH] = useState(false);
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "5px 8px", borderRadius: 4, border: "none",
        backgroundColor: h ? `${C.burg}20` : "transparent",
        color: h ? C.burg : C.textMuted, cursor: disabled ? "default" : "pointer",
        fontSize: 10, fontWeight: 500, transition: "all 0.1s",
        opacity: disabled ? 0.35 : 1,
      }}>
      {label}
    </button>
  );
}

export function AddDropdown({ isV2, canAddEmbed, canAddRow, onAddEmbed, onAddRow, onAddV2Component }: {
  isV2: boolean; canAddEmbed: boolean; canAddRow: boolean;
  onAddEmbed: () => void; onAddRow: () => void;
  onAddV2Component: (type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open) {
      if (btnRef.current) setPlacement(getPlacement(btnRef.current));
    }
    setOpen(!open);
  };

  const v2Items = [
    { label: "Content", value: "text" },
    { label: "Container", value: "container" },
    { label: "Media Gallery", value: "media" },
    { label: "File", value: "file" },
    { label: "Separator", value: "divider" },
    { label: "Row", value: "row" },
  ];

  const close = () => setOpen(false);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8, border: "none",
          backgroundColor: "transparent", color: C.textMuted, cursor: "pointer",
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.burg; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}
      >
        <CoolIcon icon="Add_Plus_Circle" size={20} />
      </button>
      {open && (
        <div style={{
          position: "absolute", left: 0, zIndex: 50, marginTop: placement === "below" ? 4 : undefined, marginBottom: placement === "above" ? 4 : undefined,
          bottom: placement === "above" ? "100%" : undefined, top: placement === "below" ? "100%" : undefined,
          minWidth: 140, borderRadius: 6, border: `1px solid ${C.border}`,
          backgroundColor: "#18181b", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          padding: 4,
        }}>
          {!isV2 ? (
            <>
              <DropItem label="Embed" disabled={!canAddEmbed} onClick={() => { onAddEmbed(); close(); }} />
              <DropItem label="Action Row" disabled={!canAddRow} onClick={() => { onAddRow(); close(); }} />
            </>
          ) : v2Items.map((item) => (
            <DropItem key={item.value} label={item.label} onClick={() => { onAddV2Component(item.value); close(); }} />
          ))}
        </div>
      )}
    </div>
  );
}
